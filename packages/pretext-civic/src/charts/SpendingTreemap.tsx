import ReactECharts from "echarts-for-react";
import { useCallback, useMemo, useState } from "react";
import { useChartTheme } from "../hooks/useChartTheme";
import { defaultTheme } from "../theme/dark";

export interface TreemapItem {
	name: string;
	value: number;
	change?: number;
	children?: TreemapItem[];
}

export interface SpendingTreemapProps {
	data: TreemapItem[];
	width?: number;
	height?: number;
	title?: string;
	onZoom?: (name: string) => void;
}

export function SpendingTreemap({
	data,
	width,
	height = 500,
	title,
	onZoom,
}: SpendingTreemapProps) {
	const chartTheme = useChartTheme();
	const [breadcrumb, setBreadcrumb] = useState<string[]>([]);

	const option = useMemo(() => {
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
				backgroundColor: "rgba(15, 23, 42, 0.92)",
				borderColor: defaultTheme.colors.border,
				textStyle: { color: defaultTheme.colors.text },
				formatter: (params: Record<string, unknown>) => {
					const d = params.data as Record<string, unknown>;
					const val = d.value as number;
					const change = d.change as number | undefined;
					let html = `<strong>${params.name}</strong><br/>`;
					html += `$${(val / 1_000_000).toFixed(1)}M`;
					if (change !== undefined) {
						const arrow = change >= 0 ? "▲" : "▼";
						const color =
							change >= 0 ? defaultTheme.colors.green : defaultTheme.colors.red;
						html += `<br/><span style="color:${color}">${arrow} ${Math.abs(change).toFixed(1)}%</span>`;
					}
					return html;
				},
			},
			series: [
				{
					type: "treemap" as const,
					data: data.map(transformItem),
					width: "92%",
					height: "80%",
					top: title ? 48 : 16,
					roam: false,
					nodeClick: "zoomToNode" as const,
					breadcrumb: {
						show: true,
						top: "bottom",
						height: 24,
						itemStyle: {
							color: defaultTheme.colors.surface,
							borderColor: defaultTheme.colors.border,
							textStyle: {
								color: defaultTheme.colors.textSecondary,
								fontSize: 11,
							},
						},
						emphasis: {
							itemStyle: {
								color: defaultTheme.colors.surfaceHover,
							},
						},
					},
					visualMin: -20,
					visualMax: 20,
					visualDimension: 1, // index of 'change' in the value array
					levels: [
						{
							itemStyle: {
								borderColor: defaultTheme.colors.border,
								borderWidth: 2,
								gapWidth: 4,
							},
							upperLabel: {
								show: true,
								height: 28,
								color: defaultTheme.colors.text,
								fontSize: 13,
								fontWeight: 600,
							},
						},
						{
							colorSaturation: [0.3, 0.7],
							itemStyle: {
								borderColor: defaultTheme.colors.border,
								borderWidth: 1,
								gapWidth: 2,
							},
						},
						{
							colorSaturation: [0.35, 0.65],
							itemStyle: {
								borderWidth: 0,
							},
						},
					],
					label: {
						show: true,
						formatter: (params: Record<string, unknown>) => {
							const d = params.data as Record<string, unknown>;
							const val = d.value as number | number[];
							const v = Array.isArray(val) ? val[0] : val;
							return `${params.name}\n$${(v / 1_000_000).toFixed(1)}M`;
						},
						color: defaultTheme.colors.text,
						fontSize: 11,
					},
					animationDuration: 600,
					animationEasing: "cubicInOut",
				},
			],
		};
	}, [data, title]);

	const handleClick = useCallback(
		(params: Record<string, unknown>) => {
			const treePathInfo = params.treePathInfo as
				| Array<{ name: string }>
				| undefined;
			if (treePathInfo && treePathInfo.length > 0) {
				const path = treePathInfo.map((p) => p.name);
				setBreadcrumb(path);
				onZoom?.(params.name as string);
			}
		},
		[onZoom],
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

/** Transform our TreemapItem into ECharts treemap data format with visual dimension. */
function transformItem(item: TreemapItem): Record<string, unknown> {
	const result: Record<string, unknown> = {
		name: item.name,
		value: [item.value, item.change ?? 0],
	};
	if (item.children && item.children.length > 0) {
		result.children = item.children.map(transformItem);
	}
	return result;
}
