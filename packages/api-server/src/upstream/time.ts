/**
 * Quill — timezone-aware cron windows for upstream maintenance.
 *
 * The declarative config in `maintenance-config.ts` names windows in wall-clock
 * time in a source's own timezone ("weekdays 00:00-08:30 America/Toronto").
 * The API runs in UTC and the browser runs in whatever zone the reader picked,
 * so a window must be converted once, here, and never re-derived in the UI.
 *
 * No cron library: the config uses five-field crons with single minute/hour
 * values, and the whole surface is `*`, `N`, `N-M` and comma lists. A
 * dependency for that is more risk than code. `parseCron` throws on anything it
 * does not understand, so a typo in the config fails at boot instead of
 * silently disabling a window.
 */

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  /** 0 = Sunday … 6 = Saturday, matching cron's day-of-week field. */
  weekday: number;
  hour: number;
  minute: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    });
    formatterCache.set(timezone, fmt);
  }
  return fmt;
}

/** Wall-clock parts of `date` in `timezone`. */
export function zonedParts(date: Date, timezone: string): ZonedParts {
  const parts = formatterFor(timezone).formatToParts(date);
  const value = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return {
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day')),
    weekday: Math.max(0, WEEKDAYS.indexOf(value('weekday'))),
    hour: Number(value('hour')) % 24,
    minute: Number(value('minute')),
  };
}

/**
 * Convert a wall-clock time in `timezone` to an absolute instant.
 *
 * Two passes converge for every real zone/date pair: the first pass is off by
 * the zone offset (or by an hour across a DST boundary), the second corrects it.
 */
export function utcFromZoned(
  timezone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = target;
  for (let pass = 0; pass < 3; pass++) {
    const parts = zonedParts(new Date(guess), timezone);
    const actual = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
    const delta = target - actual;
    if (delta === 0) break;
    guess += delta;
  }
  return new Date(guess);
}

export interface CronSpec {
  /** Original expression, kept for diagnostics. */
  expression: string;
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

function parseField(field: string, min: number, max: number, expression: string): number[] {
  const values = new Set<number>();
  for (const chunk of field.split(',')) {
    const step = /^(.+)\/(\d+)$/.exec(chunk);
    if (step) {
      const every = Number(step[2]);
      if (!(every > 0)) throw new Error(`cron "${expression}": step must be > 0 in "${chunk}"`);
      const base = parseField(step[1] === '*' ? `${min}-${max}` : step[1], min, max, expression);
      base.forEach((value, index) => {
        if (index % every === 0) values.add(value);
      });
      continue;
    }
    if (chunk === '*') {
      for (let i = min; i <= max; i++) values.add(i);
      continue;
    }
    const range = /^(\d+)-(\d+)$/.exec(chunk);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (from > to) throw new Error(`cron "${expression}": reversed range "${chunk}"`);
      for (let i = from; i <= to; i++) values.add(i);
      continue;
    }
    const single = /^(\d+)$/.exec(chunk);
    if (!single) throw new Error(`cron "${expression}": unsupported field "${chunk}"`);
    values.add(Number(single[1]));
  }
  const out = [...values].sort((a, b) => a - b);
  for (const v of out) {
    if (v < min || v > max) throw new Error(`cron "${expression}": ${v} outside ${min}-${max}`);
  }
  return out;
}

export function parseCron(expression: string): CronSpec {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`cron "${expression}": expected 5 fields, got ${fields.length}`);
  }
  return {
    expression,
    minute: parseField(fields[0], 0, 59, expression),
    hour: parseField(fields[1], 0, 23, expression),
    dayOfMonth: parseField(fields[2], 1, 31, expression),
    month: parseField(fields[3], 1, 12, expression),
    dayOfWeek: parseField(fields[4], 0, 6, expression).map((d) => (d === 7 ? 0 : d)),
  };
}

export interface WindowDefinition {
  /** Five-field cron for the window start. */
  cron: string;
  durationMinutes: number;
  /** IANA zone the cron is written in. */
  timezone: string;
}

export interface ActiveWindow {
  startsAt: Date;
  endsAt: Date;
}

/**
 * The occurrence of `window` covering `now`, or null when outside it.
 *
 * Looks back three days: the longest window in the config is 20 h, and a
 * midnight-start window is still "yesterday's" occurrence at 00:05.
 */
export function activeWindow(window: WindowDefinition, now: Date): ActiveWindow | null {
  const spec = parseCron(window.cron);
  const durationMs = window.durationMinutes * 60_000;
  let best: ActiveWindow | null = null;

  for (let daysBack = 0; daysBack <= 3; daysBack++) {
    const probeDay = new Date(now.getTime() - daysBack * 86_400_000);
    const parts = zonedParts(probeDay, window.timezone);
    // Day-level fields decide whether this date can host the window; the hour
    // and minute are enumerated below.
    if (
      !spec.dayOfMonth.includes(parts.day) ||
      !spec.month.includes(parts.month) ||
      !spec.dayOfWeek.includes(parts.weekday)
    ) {
      continue;
    }
    for (const hour of spec.hour) {
      for (const minute of spec.minute) {
        const startsAt = utcFromZoned(window.timezone, parts.year, parts.month, parts.day, hour, minute);
        const endsAt = new Date(startsAt.getTime() + durationMs);
        if (startsAt.getTime() <= now.getTime() && now.getTime() < endsAt.getTime()) {
          if (!best || startsAt > best.startsAt) best = { startsAt, endsAt };
        }
      }
    }
  }
  return best;
}

const ZONE_LABELS: Record<string, string> = {
  'America/Toronto': 'ET',
  'America/Montreal': 'ET',
  'America/Chicago': 'CT',
  'America/Edmonton': 'MT',
  'America/Vancouver': 'PT',
  'America/St_Johns': 'NT',
  'UTC': 'UTC',
};

/** Short label for a zone, for copy like "back by 08:30 ET". */
export function zoneLabel(timezone: string): string {
  return ZONE_LABELS[timezone] ?? timezone;
}

/** "08:30" in the window's own zone. */
export function formatClock(date: Date, timezone: string): string {
  const parts = zonedParts(date, timezone);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}
