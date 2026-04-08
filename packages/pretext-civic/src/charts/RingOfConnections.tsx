import ReactECharts from "echarts-for-react";
import { useCallback, useMemo } from "react";
import { useChartTheme } from "../hooks/useChartTheme";
import { defaultTheme } from "../theme/dark";

export interface ConnectionSegment {
	type:
		| "contracts"
		| "lobbying"
		| "donations"
		| "disclosures"
		| "international";
	count: number;
	totalValue?: number;
	label?: string;
}

export interface RingOfConnectionsProps {
	segments: ConnectionSegment[];
	entityName?: string;
	width?: number;
	height?: number;
	onSegmentClick?: (type: ConnectionSegment["type"]) => void;
}

const SEGMENT_COLORS: Record<ConnectionSegment["type"], string> = {
	contracts: defaultTheme.colors.gold,
	lobbying: defaultTheme.colors.red,
	donations: defaultTheme.colors.purple,
	disclosures: defaultTheme.colors.blue,
	international: defaultTheme.colors.green,
};

const SEGMENT_LABELS: Record<ConnectionSegment["type"], string> = {
	contracts: "Contracts",
	lobbying: "Lobbying",
	donations: "Donations",
	disclosures: "Disclosures",
	international: "International",
};

export function RingOfConnections({
	segments,
	entityName,
	width,
	height = 400,
	onSegmentClick,
}: RingOfConnectionsProps) {
	const chartTheme = useChartTheme();

	const option = useMemo(() => {
		const pieData = segments.map((seg) => ({
			name: seg.label ?? SEGMENT_LABELS[seg.type],
			value: seg.count,
			itemStyle: {
				color: SEGMENT_COLORS[seg.type],
				borderColor: defaultTheme.colors.background,
				borderWidth: 3,
			},
		}));

		const total = segments.reduce((sum, s) => sum + s.count, 0);

		return {
			tooltip: {
				trigger: "item" as const,
				backgroundColor: "rgba(15, 23, 42, 0.92)",
				borderColor: defaultTheme.colors.border,
				textStyle: { color: defaultTheme.colors.text },
				formatter: (params: Record<string, unknown>) => {
					const seg = segments.find(
						(s) => (s.label ?? SEGMENT_LABELS[s.type]) === params.name,
					);
					if (!seg) return `${params.name}: ${params.value}`;
					let html = `<strong>${params.name}</strong><br/>`;
					html += `${seg.count} connection${seg.count !== 1 ? "s" : ""}`;
					html += `<br/>${((seg.count / total) * 100).toFixed(1)}%`;
					if (seg.totalValue) {
						html += `<br/>$${(seg.totalValue / 1_000_000).toFixed(1)}M total`;
					}
					return html;
				},
			},
			graphic: entityName
				? [
						{
							type: "text" as const,
							left: "center",
							top: "42%",
							style: {
								text: entityName,
								textAlign: "center" as const,
								fill: defaultTheme.colors.text,
								fontSize: 14,
								fontWeight: 600,
								fontFamily: defaultTheme.fonts.sans,
							},
						},
						{
							type: "text" as const,
							left: "center",
							top: "50%",
							style: {
								text: `${total} connections`,
								textAlign: "center" as const,
								fill: defaultTheme.colors.textMuted,
								fontSize: 11,
								fontFamily: defaultTheme.fonts.sans,
							},
						},
					]
				: undefined,
			series: [
				{
					type: "pie" as const,
					radius: ["42%", "72%"],
					center: ["50%", "50%"],
					avoidLabelOverlap: true,
					padAngle: 2,
					itemStyle: {
						borderRadius: 6,
					},
					label: {
						show: true,
						color: defaultTheme.colors.textSecondary,
						fontSize: 11,
						formatter: "{b}\n{d}%",
					},
					emphasis: {
						label: {
							show: true,
							fontSize: 13,
							fontWeight: 600,
							color: defaultTheme.colors.text,
						},
						itemStyle: {
							shadowBlur: 20,
							shadowColor: "rgba(34, 211, 238, 0.3)",
						},
					},
					data: pieData,
					animationType: "expansion" as const,
					animationDuration: 1000,
					animationEasing: "cubicOut" as never,
				},
			],
		};
	}, [segments, entityName]);

	const handleClick = useCallback(
		(params: Record<string, unknown>) => {
			const seg = segments.find(
				(s) => (s.label ?? SEGMENT_LABELS[s.type]) === params.name,
			);
			if (seg) onSegmentClick?.(seg.type);
		},
		[segments, onSegmentClick],
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
