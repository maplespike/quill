import ReactECharts from "echarts-for-react";
import { useCallback, useMemo } from "react";
import { useChartTheme } from "../hooks/useChartTheme";
import { defaultTheme } from "../theme/dark";

export interface GaugeSignalProps {
  /** Signal strength score 0-100 */
  value: number;
  /** Display label for the signal type */
  label: string;
  /** Optional sub-label */
  subLabel?: string;
  width?: number;
  height?: number;
  /** Called when gauge value changes */
  onThresholdClick?: (value: number) => void;
}

export function GaugeSignal({
  value,
  label,
  subLabel,
  width,
  height = 220,
  onThresholdClick,
}: GaugeSignalProps) {
  const chartTheme = useChartTheme();
  const clampedValue = Math.max(0, Math.min(100, value));

  const option = useMemo(
    () => ({
      series: [
        {
          type: "gauge" as const,
          startAngle: 180,
          endAngle: 0,
          center: ["50%", "70%"],
          radius: "90%",
          min: 0,
          max: 100,
          splitNumber: 5,
          axisLine: {
            lineStyle: {
              width: 20,
              color: [
                [0.3, defaultTheme.colors.green],
                [0.6, defaultTheme.colors.amber],
                [1, defaultTheme.colors.red],
              ],
            },
          },
          pointer: {
            icon: "path://M12.8,0.7l12,40.1H0.7L12.8,0.7z",
            length: "55%",
            width: 8,
            offsetCenter: [0, "-10%"],
            itemStyle: {
              color: "auto",
            },
          },
          axisTick: {
            length: 8,
            lineStyle: {
              color: "auto",
              width: 1,
            },
          },
          splitLine: {
            length: 16,
            lineStyle: {
              color: "auto",
              width: 2,
            },
          },
          axisLabel: {
            color: defaultTheme.colors.textMuted,
            fontSize: 10,
            distance: -36,
            formatter: (val: number) => {
              if (val === 0 || val === 50 || val === 100) return `${val}`;
              return "";
            },
          },
          title: {
            offsetCenter: [0, "20%"],
            fontSize: 14,
            fontWeight: 600,
            color: defaultTheme.colors.text,
          },
          detail: {
            fontSize: 32,
            fontWeight: 700,
            offsetCenter: [0, "-2%"],
            valueAnimation: true,
            formatter: (val: number) => `${Math.round(val)}`,
            color:
              clampedValue > 60
                ? defaultTheme.colors.red
                : clampedValue > 30
                  ? defaultTheme.colors.amber
                  : defaultTheme.colors.green,
          },
          data: [
            {
              value: clampedValue,
              name: label,
            },
          ],
          animationDuration: 1200,
          animationEasing: "bounceOut" as never,
        },
      ],
      graphic: subLabel
        ? [
            {
              type: "text" as const,
              left: "center",
              bottom: 4,
              style: {
                text: subLabel,
                fill: defaultTheme.colors.textMuted,
                fontSize: 11,
              },
            },
          ]
        : undefined,
    }),
    [clampedValue, label, subLabel],
  );

  return (
    <ReactECharts
      option={option}
      style={{ width: width ?? "100%", height }}
      theme={chartTheme as never}
      opts={{ renderer: "canvas" }}
    />
  );
}
