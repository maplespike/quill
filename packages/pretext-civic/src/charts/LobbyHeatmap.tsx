import ReactECharts from "echarts-for-react";
import { useCallback, useMemo } from "react";
import { useChartTheme } from "../hooks/useChartTheme";
import { defaultTheme } from "../theme/dark";

export interface HeatmapCell {
	department: string;
	period: string; // e.g. "2024-W05" or "2024-01"
	count: number;
}

export interface LobbyHeatmapProps {
	data: HeatmapCell[];
	width?: number;
	height?: number;
	title?: string;
	onCellClick?: (cell: HeatmapCell) => void;
}

export function LobbyHeatmap({
	data,
	width,
	height = 400,
	title,
	onCellClick,
}: LobbyHeatmapProps) {
	const chartTheme = useChartTheme();

	const { departments, periods, values, min, max } = useMemo(() => {
		const deptSet = new Set<string>();
		const periodSet = new Set<string>();
		const vals: [number, number, number][] = []; // [deptIdx, periodIdx, count]

		const depts: string[] = [];
		const pers: string[] = [];

		for (const cell of data) {
			if (!deptSet.has(cell.department)) {
				deptSet.add(cell.department);
				depts.push(cell.department);
			}
			if (!periodSet.has(cell.period)) {
				periodSet.add(cell.period);
				pers.push(cell.period);
			}
		}

		// Sort periods chronologically
		pers.sort();

		const deptIdx = new Map(depts.map((d, i) => [d, i]));
		const perIdx = new Map(pers.map((p, i) => [p, i]));

		let lo = Number.POSITIVE_INFINITY;
		let hi = 0;
		for (const cell of data) {
			const di = deptIdx.get(cell.department)!;
			const pi = perIdx.get(cell.period)!;
			vals.push([pi, di, cell.count]);
			if (cell.count < lo) lo = cell.count;
			if (cell.count > hi) hi = cell.count;
		}

		return {
			departments: depts,
			periods: pers,
			values: vals,
			min: lo === Number.POSITIVE_INFINITY ? 0 : lo,
			max: hi,
		};
	}, [data]);

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
				position: "top" as const,
				backgroundColor: "rgba(15, 23, 42, 0.92)",
				borderColor: defaultTheme.colors.border,
				textStyle: { color: defaultTheme.colors.text, fontSize: 12 },
				formatter: (params: Record<string, unknown>) => {
					const d = params.data as number[];
					const dept = departments[d[1]];
					const period = periods[d[0]];
					const count = d[2];
					return `<strong>${dept}</strong><br/>${period}<br/>${count} communication${count !== 1 ? "s" : ""}`;
				},
			},
			grid: {
				top: title ? 52 : 16,
				bottom: 20,
				left: 140,
				right: 20,
			},
			xAxis: {
				type: "category" as const,
				data: periods,
				splitArea: { show: true },
				axisLabel: {
					color: defaultTheme.colors.textMuted,
					fontSize: 9,
					rotate: 45,
				},
				axisLine: { lineStyle: { color: defaultTheme.colors.border } },
			},
			yAxis: {
				type: "category" as const,
				data: departments,
				axisLabel: {
					color: defaultTheme.colors.textSecondary,
					fontSize: 11,
				},
				axisLine: { lineStyle: { color: defaultTheme.colors.border } },
			},
			visualMap: {
				min: 0,
				max: Math.max(max, 1),
				calculable: true,
				orient: "horizontal" as const,
				left: "center",
				bottom: 0,
				inRange: {
					color: [
						"#1a1a2e",
						"#2d1f0e",
						"#4a2c0a",
						"#7c4a0a",
						"#b58900",
						"#f59e0b",
					],
				},
				textStyle: { color: defaultTheme.colors.textMuted },
			},
			series: [
				{
					type: "heatmap" as const,
					data: values,
					emphasis: {
						itemStyle: {
							shadowBlur: 10,
							shadowColor: "rgba(245, 158, 11, 0.4)",
						},
					},
					itemStyle: {
						borderColor: defaultTheme.colors.background,
						borderWidth: 2,
						borderRadius: 3,
					},
					animation: true,
					animationDuration: 600,
				},
			],
		}),
		[departments, periods, values, max, title],
	);

	const handleClick = useCallback(
		(params: Record<string, unknown>) => {
			const d = params.data as number[];
			if (d && d.length === 3) {
				onCellClick?.({
					department: departments[d[1]],
					period: periods[d[0]],
					count: d[2],
				});
			}
		},
		[departments, periods, onCellClick],
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
