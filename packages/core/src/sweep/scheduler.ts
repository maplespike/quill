/**
 * Sweep Scheduler
 *
 * Simple interval-based scheduler for running sweeps at configured intervals.
 * Each source has its own refresh interval:
 *   - spending/lobbying: 15 minutes (high-frequency)
 *   - gac/ciec: daily (low-frequency)
 */

import type { FullSweepOutput, SweepCallback, SweepStatus } from "./engine";

/** Schedule configuration for a data source */
export interface SourceSchedule {
  /** Source name */
  source: string;
  /** Interval in milliseconds */
  intervalMs: number;
  /** Whether this source is enabled */
  enabled: boolean;
}

/** Default schedules for Canadian government sources */
export const DEFAULT_SCHEDULES: SourceSchedule[] = [
  { source: "spending", intervalMs: 15 * 60 * 1000, enabled: true }, // 15 min
  { source: "lobbying", intervalMs: 15 * 60 * 1000, enabled: true }, // 15 min
  { source: "ciec", intervalMs: 24 * 60 * 60 * 1000, enabled: true }, // daily
  { source: "gac", intervalMs: 24 * 60 * 60 * 1000, enabled: true }, // daily
];

/** Callback for when a scheduled sweep is due */
export type SweepDueCallback = (
  source: string,
) => Promise<FullSweepOutput | null>;

/**
 * Manages timed sweep cycles for each data source.
 */
export class SweepScheduler {
  private schedules: SourceSchedule[];
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private running = false;
  private lastRuns: Map<string, number> = new Map();
  private onSweepDue: SweepDueCallback | null = null;

  constructor(schedules?: SourceSchedule[]) {
    this.schedules = schedules ?? DEFAULT_SCHEDULES;
  }

  /**
   * Set the callback that fires when a sweep is due for a source.
   */
  setSweepCallback(callback: SweepDueCallback): void {
    this.onSweepDue = callback;
  }

  /**
   * Start the scheduler. Begins running intervals for all enabled sources.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    for (const schedule of this.schedules) {
      if (!schedule.enabled) continue;

      const timer = setInterval(() => {
        this.lastRuns.set(schedule.source, Date.now());
        if (this.onSweepDue) {
          this.onSweepDue(schedule.source).catch((err) => {
            console.error(`Sweep failed for ${schedule.source}:`, err);
          });
        }
      }, schedule.intervalMs);

      this.timers.set(schedule.source, timer);
    }
  }

  /**
   * Stop the scheduler. Clears all intervals.
   */
  stop(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
    this.running = false;
  }

  /**
   * Get the scheduler's current status.
   */
  getStatus(): SweepStatus & { schedules: SourceSchedule[] } {
    const now = Date.now();
    const scheduleStatuses = this.schedules.map((s) => {
      const lastRun = this.lastRuns.get(s.source);
      const nextRun = lastRun
        ? new Date(lastRun + s.intervalMs).toISOString()
        : null;
      return { ...s, lastRun: lastRun ?? null, nextRun };
    });

    // Find soonest next run
    const nextRuns = scheduleStatuses
      .filter((s) => s.nextRun && s.enabled)
      .map((s) => new Date(s.nextRun!).getTime())
      .filter((t) => t > now);

    const nextRunAt =
      nextRuns.length > 0
        ? new Date(Math.min(...nextRuns)).toISOString()
        : null;

    // Find most recent run
    const lastRuns = [...this.lastRuns.values()];
    const lastRunAt =
      lastRuns.length > 0
        ? new Date(Math.max(...lastRuns)).toISOString()
        : null;

    return {
      running: this.running,
      lastRunAt,
      nextRunAt,
      sweepCount: 0,
      lastDelta: null,
      schedules: this.schedules,
    };
  }

  /**
   * Update the interval for a specific source.
   */
  updateInterval(source: string, intervalMs: number): void {
    const schedule = this.schedules.find((s) => s.source === source);
    if (schedule) {
      schedule.intervalMs = intervalMs;
      // Restart if running
      if (this.running && schedule.enabled) {
        const existing = this.timers.get(source);
        if (existing) clearInterval(existing);

        const timer = setInterval(() => {
          this.lastRuns.set(source, Date.now());
          if (this.onSweepDue) {
            this.onSweepDue(source).catch((err) => {
              console.error(`Sweep failed for ${source}:`, err);
            });
          }
        }, intervalMs);
        this.timers.set(source, timer);
      }
    }
  }

  /**
   * Enable or disable a source.
   */
  setSourceEnabled(source: string, enabled: boolean): void {
    const schedule = this.schedules.find((s) => s.source === source);
    if (schedule) {
      schedule.enabled = enabled;
      if (!enabled) {
        const timer = this.timers.get(source);
        if (timer) {
          clearInterval(timer);
          this.timers.delete(source);
        }
      } else if (this.running) {
        // Re-enable
        const timer = setInterval(() => {
          this.lastRuns.set(source, Date.now());
          if (this.onSweepDue) {
            this.onSweepDue(source).catch((err) => {
              console.error(`Sweep failed for ${source}:`, err);
            });
          }
        }, schedule.intervalMs);
        this.timers.set(source, timer);
      }
    }
  }
}
