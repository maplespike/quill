import ReactECharts from "echarts-for-react";
import { useCallback, useMemo } from "react";
import { useChartTheme } from "../hooks/useChartTheme";
import { defaultTheme } from "../theme/dark";

export interface AreaDataPoint {
	date: string;
	values: Record<string, number>;
}

export interface AnomalyMarker {
	date: string;
	series: string;
	type: "spike" | "drop";
	description?: string;
}

export interface SpendingAreaChartProps {
	data: AreaDataPoint[];
	anomalies?: AnomalyMarker[];
	width?: number;
	height?: number;
	title?: string;
	stackLabels?: boolean;
	onPointClick?: (date: string, series: string) => void;
}

export function SpendingAreaChart({
	data,
	anomalies,
	width,
	height = 400,
	title,
	stackLabels = true,
	onPointClick,
}: SpendingAreaChartProps) {
	const chartTheme = useChartTheme();

	const option = useMemo(() => {
		// Extract series names from first data point
		const seriesNames = Object.keys(data[0]?.values ?? {});

		const colors = defaultTheme.chartColors;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const series: any[] = seriesNames.map((name, i) => ({
			name,
			type: "line" as const,
			stack: stackLabels ? "total" : undefined,
			areaStyle: {
				opacity: 0.3,
			},
			lineStyle: {
				width: 2,
				color: colors[i % colors.length],
			},
			itemStyle: {
				color: colors[i % colors.length],
			},
			emphasis: {
				focus: "series" as const,
			},
			smooth: true,
			data: data.map((d) => d.values[name] ?? 0),
			animationDuration: 800,
			animationDelay: (idx: number) => idx * 15,
		}));

		// Build anomaly mark points
		const markPoints =
			anomalies?.map((a) => {
				const seriesIdx = seriesNames.indexOf(a.series);
				const dateIdx = data.findIndex((d) => d.date === a.date);
				const value = dateIdx >= 0 ? (data[dateIdx].values[a.series] ?? 0) : 0;

				return {
					name: a.description ?? a.type,
					coord: [a.date, value],
					symbol:
						a.type === "spike"
							? ("triangle" as const)
							: ("path://M0,0L10,0L5,10Z" as const),
					symbolSize: 14,
					itemStyle: {
						color:
							a.type === "spike"
								? defaultTheme.colors.red
								: defaultTheme.colors.amber,
					},
					label: {
						show: true,
						formatter: a.type === "spike" ? "▲" : "▼",
						color: "#fff",
						fontSize: 9,
					},
				};
			}) ?? [];

		// Add marks to first series
		if (markPoints.length > 0 && series.length > 0) {
			series[0] = {
				...series[0],
				markPoint: {
					data: markPoints,
					animation: true,
				},
			};
		}

		return {
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
				trigger: "axis" as const,
				backgroundColor: "rgba(15, 23, 42, 0.92)",
				borderColor: defaultTheme.colors.border,
				textStyle: { color: defaultTheme.colors.text, fontSize: 12 },
				axisPointer: {
					type: "cross" as const,
					label: {
						backgroundColor: defaultTheme.colors.surface,
						color: defaultTheme.colors.text,
					},
				},
			},
			legend: {
				data: seriesNames,
				top: title ? 32 : 0,
				textStyle: { color: defaultTheme.colors.textSecondary, fontSize: 11 },
			},
			grid: {
				top: title ? 64 : 36,
				bottom: 32,
				left: 60,
				right: 20,
			},
			xAxis: {
				type: "category" as const,
				boundaryGap: false,
				data: data.map((d) => d.date),
				axisLabel: {
					color: defaultTheme.colors.textMuted,
					fontSize: 10,
				},
				axisLine: { lineStyle: { color: defaultTheme.colors.border } },
			},
			yAxis: {
				type: "value" as const,
				axisLabel: {
					color: defaultTheme.colors.textMuted,
					fontSize: 10,
					formatter: (v: number) => `$${(v / 1_000_000).toFixed(0)}M`,
				},
				splitLine: {
					lineStyle: {
						color: `${defaultTheme.colors.border}22`,
						type: "dashed" as const,
					},
				},
			},
			series,
			animationEasing: "cubicInOut",
		};
	}, [data, anomalies, title, stackLabels]);

	const handleClick = useCallback(
		(params: Record<string, unknown>) => {
			if (params.componentType === "series") {
				onPointClick?.(params.name as string, params.seriesName as string);
			}
		},
		[onPointClick],
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
