import ReactECharts from "echarts-for-react";
import { useCallback, useMemo } from "react";
import { useChartTheme } from "../hooks/useChartTheme";
import { defaultTheme } from "../theme/dark";

export interface TimelineMilestone {
  id: string;
  name: string;
  date: string;
  type: "promised" | "actual" | "milestone";
  status?: "on_track" | "delayed" | "completed" | "missed";
  description?: string;
}

export interface TimelineTrackerProps {
  milestones: TimelineMilestone[];
  width?: number;
  height?: number;
  title?: string;
  onMilestoneClick?: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  on_track: defaultTheme.colors.green,
  delayed: defaultTheme.colors.amber,
  completed: defaultTheme.colors.cyan,
  missed: defaultTheme.colors.red,
};

export function TimelineTracker({
  milestones,
  width,
  height = 300,
  title,
  onMilestoneClick,
}: TimelineTrackerProps) {
  const chartTheme = useChartTheme();

  // Split into promised vs actual series
  const { promised, actual, timeData } = useMemo(() => {
    const promisedData: Array<{
      value: [string, number];
      itemStyle: Record<string, string>;
    }> = [];
    const actualData: Array<{
      value: [string, number];
      itemStyle: Record<string, string>;
    }> = [];

    const sorted = [...milestones].sort((a, b) => a.date.localeCompare(b.date));

    for (const m of sorted) {
      const color = STATUS_COLORS[m.status ?? "on_track"];
      const entry = {
        value: [m.date, m.type === "promised" ? 2 : 1] as [string, number],
        itemStyle: { color },
      };

      if (m.type === "promised") {
        promisedData.push(entry);
      } else {
        actualData.push(entry);
      }
    }

    return {
      promised: promisedData,
      actual: actualData,
      timeData: sorted,
    };
  }, [milestones]);

  const option = useMemo(
    () => ({
      title: title
        ? {
            text: title,
            left: "center",
            textStyle: {
              color: defaultTheme.colors.text,
              fontSize: 16,
              fontWeight: 600,
            },
          }
        : undefined,
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        borderColor: defaultTheme.colors.border,
        textStyle: { color: defaultTheme.colors.text },
        formatter: (params: Record<string, unknown>) => {
          const ms = timeData.find(
            (m) => m.date === (params.value as unknown[])[0],
          );
          if (!ms) return "";
          const statusColor = STATUS_COLORS[ms.status ?? "on_track"];
          return `
            <strong>${ms.name}</strong><br/>
            <span style="color:${statusColor}">${ms.status?.replace("_", " ") ?? ""}</span><br/>
            <span style="color:#64748b">${ms.date}</span>
            ${ms.description ? `<br/><span style="color:#94a3b8">${ms.description}</span>` : ""}
          `;
        },
      },
      grid: {
        top: title ? 52 : 24,
        bottom: 40,
        left: 60,
        right: 40,
      },
      xAxis: {
        type: "time" as const,
        axisLabel: {
          color: defaultTheme.colors.textMuted,
          fontSize: 10,
          formatter: "{MMM} {yy}",
        },
        axisLine: { lineStyle: { color: defaultTheme.colors.border } },
        splitLine: {
          lineStyle: {
            color: `${defaultTheme.colors.border}33`,
            type: "dashed" as const,
          },
        },
      },
      yAxis: {
        type: "category" as const,
        data: ["Actual", "Promised"],
        axisLabel: { color: defaultTheme.colors.textSecondary, fontSize: 11 },
        axisLine: { lineStyle: { color: defaultTheme.colors.border } },
      },
      series: [
        {
          name: "Promised",
          type: "scatter" as const,
          symbolSize: 16,
          data: promised,
          label: {
            show: true,
            formatter: (params: Record<string, unknown>) => {
              const ms = timeData.find(
                (m) => m.date === (params.value as unknown[])[0],
              );
              return ms?.name ?? "";
            },
            position: "top" as const,
            color: defaultTheme.colors.textSecondary,
            fontSize: 9,
          },
          animationDuration: 600,
          animationDelay: (idx: number) => idx * 80,
        },
        {
          name: "Actual",
          type: "scatter" as const,
          symbolSize: 16,
          symbol: "diamond" as const,
          data: actual,
          label: {
            show: true,
            formatter: (params: Record<string, unknown>) => {
              const ms = timeData.find(
                (m) => m.date === (params.value as unknown[])[0],
              );
              return ms?.name ?? "";
            },
            position: "bottom" as const,
            color: defaultTheme.colors.textSecondary,
            fontSize: 9,
          },
          animationDuration: 600,
          animationDelay: (idx: number) => idx * 80 + 200,
        },
      ],
    }),
    [promised, actual, timeData, title],
  );

  const handleClick = useCallback(
    (params: Record<string, unknown>) => {
      const ms = timeData.find(
        (m) => m.date === (params.value as unknown[])[0],
      );
      if (ms) onMilestoneClick?.(ms.id);
    },
    [timeData, onMilestoneClick],
  );

  return (
    <ReactECharts
      option={option}
      style={{ width: width ?? "100%", height }}
      onEvents={{ click: handleClick }}
      theme={chartTheme as never}
      opts={{ renderer: "canvas" }}
    />
  );
}
