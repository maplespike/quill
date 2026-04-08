import ReactECharts from "echarts-for-react";
import { useCallback, useMemo } from "react";
import { useChartTheme } from "../hooks/useChartTheme";
import { defaultTheme } from "../theme/dark";

export interface ComparisonItem {
	name: string;
	value: number;
	compareTo: number;
	category?: string;
}

export interface ComparisonBarProps {
	data: ComparisonItem[];
	orientation?: "horizontal" | "vertical";
	width?: number;
	height?: number;
	title?: string;
	labels?: { value: string; compareTo: string };
	onItemClick?: (name: string) => void;
}

export function ComparisonBar({
	data,
	orientation = "horizontal",
	width,
	height = 400,
	title,
	labels = { value: "Actual", compareTo: "Promised" },
	onItemClick,
}: ComparisonBarProps) {
	const chartTheme = useChartTheme();

	const option = useMemo(() => {
		const names = data.map((d) => d.name);
		const isHorizontal = orientation === "horizontal";

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
				axisPointer: { type: "shadow" as const },
				backgroundColor: "rgba(15, 23, 42, 0.92)",
				borderColor: defaultTheme.colors.border,
				textStyle: { color: defaultTheme.colors.text },
				formatter: (params: Array<Record<string, unknown>>) => {
					const name = params[0]?.name as string;
					const v1 = params[0]?.value as number;
					const v2 = (params[1]?.value as number) ?? 0;
					const diff = v1 - v2;
					const pct = v2 !== 0 ? ((diff / v2) * 100).toFixed(1) : "N/A";
					const arrow = diff >= 0 ? "▲" : "▼";
					const color =
						diff >= 0 ? defaultTheme.colors.green : defaultTheme.colors.red;
					return `
            <strong>${name}</strong><br/>
            ${labels.value}: $${(v1 / 1_000_000).toFixed(1)}M<br/>
            ${labels.compareTo}: $${(v2 / 1_000_000).toFixed(1)}M<br/>
            <span style="color:${color}">${arrow} ${pct}%</span>
          `;
				},
			},
			legend: {
				data: [labels.value, labels.compareTo],
				top: title ? 32 : 0,
				textStyle: { color: defaultTheme.colors.textSecondary },
			},
			grid: {
				top: title ? 64 : 36,
				bottom: 32,
				left: isHorizontal ? 140 : 60,
				right: 20,
			},
			[isHorizontal ? "yAxis" : "xAxis"]: {
				type: "category" as const,
				data: names,
				axisLabel: {
					color: defaultTheme.colors.textSecondary,
					fontSize: 11,
					...(isHorizontal ? {} : { rotate: 30 }),
				},
				axisLine: { lineStyle: { color: defaultTheme.colors.border } },
			},
			[isHorizontal ? "xAxis" : "yAxis"]: {
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
			series: [
				{
					name: labels.value,
					type: "bar" as const,
					data: data.map((d) => ({
						value: d.value,
						itemStyle: {
							color:
								d.value >= d.compareTo
									? defaultTheme.colors.cyan
									: defaultTheme.colors.red,
							borderRadius: isHorizontal ? [0, 3, 3, 0] : [3, 3, 0, 0],
						},
					})),
					barWidth: "35%",
					animationDuration: 800,
					animationDelay: (idx: number) => idx * 100,
					animationEasing: "elasticOut" as never,
				},
				{
					name: labels.compareTo,
					type: "bar" as const,
					data: data.map((d) => ({
						value: d.compareTo,
						itemStyle: {
							color: defaultTheme.colors.textMuted,
							opacity: 0.5,
							borderRadius: isHorizontal ? [0, 3, 3, 0] : [3, 3, 0, 0],
						},
					})),
					barWidth: "35%",
					animationDuration: 800,
					animationDelay: (idx: number) => idx * 100 + 100,
					animationEasing: "elasticOut" as never,
				},
			],
		};
	}, [data, orientation, title, labels]);

	const handleClick = useCallback(
		(params: Record<string, unknown>) => {
			onItemClick?.(params.name as string);
		},
		[onItemClick],
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
