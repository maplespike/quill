import * as d3 from "d3";
import { sankey as d3Sankey, sankeyLinkHorizontal } from "d3-sankey";
import ReactECharts from "echarts-for-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useChartTheme } from "../hooks/useChartTheme";
import { defaultTheme } from "../theme/dark";

export interface SankeyFlowNode {
	id: string;
	name: string;
	color?: string;
}

export interface SankeyFlowLink {
	source: string;
	target: string;
	value: number;
}

export interface SankeyFlowProps {
	nodes: SankeyFlowNode[];
	links: SankeyFlowLink[];
	width?: number;
	height?: number;
	title?: string;
	onNodeClick?: (nodeId: string) => void;
	onDrillDown?: (nodeId: string) => void;
}

export function SankeyFlow({
	nodes,
	links,
	width,
	height = 500,
	title,
	onNodeClick,
	onDrillDown,
}: SankeyFlowProps) {
	const chartTheme = useChartTheme();
	const [hoveredNode, setHoveredNode] = useState<string | null>(null);

	const option = useMemo(() => {
		// Use ECharts built-in sankey support
		const echartsNodes = nodes.map((n) => ({
			name: n.name,
			itemStyle: {
				color: n.color ?? defaultTheme.colors.cyan,
			},
		}));

		const echartsLinks = links.map((l) => ({
			source: nodes.find((n) => n.id === l.source)?.name ?? l.source,
			target: nodes.find((n) => n.id === l.target)?.name ?? l.target,
			value: l.value,
		}));

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
				trigger: "item" as const,
				triggerOn: "mousemove" as const,
				backgroundColor: "rgba(15, 23, 42, 0.92)",
				borderColor: defaultTheme.colors.border,
				textStyle: { color: defaultTheme.colors.text },
				formatter: (params: Record<string, unknown>) => {
					const data = params.data as Record<string, unknown>;
					if (data.source && data.target) {
						return `<strong>${data.source}</strong> → <strong>${data.target}</strong><br/>$${((data.value as number) / 1_000_000).toFixed(1)}M`;
					}
					return `${data.name}`;
				},
			},
			series: [
				{
					type: "sankey" as const,
					layout: "none" as const,
					emphasis: {
						focus: "adjacency" as const,
					},
					nodeAlign: "justify" as const,
					layoutIterations: 32,
					data: echartsNodes,
					links: echartsLinks,
					lineStyle: {
						color: "gradient" as const,
						opacity: 0.3,
						curveness: 0.5,
					},
					itemStyle: {
						borderWidth: 0,
					},
					label: {
						color: defaultTheme.colors.textSecondary,
						fontSize: 11,
						fontFamily: defaultTheme.fonts.sans,
					},
					animationDuration: 800,
					animationEasing: "cubicInOut",
				},
			],
		};
	}, [nodes, links, title]);

	const handleClick = useCallback(
		(params: Record<string, unknown>) => {
			const name = params.name as string;
			const node = nodes.find((n) => n.name === name);
			if (node) {
				onNodeClick?.(node.id);
				onDrillDown?.(node.id);
			}
		},
		[nodes, onNodeClick, onDrillDown],
	);

	return (
		<ReactECharts
			option={option}
			style={{ width: width ?? "100%", height }}
			onEvents={{ click: handleClick }}
			theme={chartTheme as never}
			opts={{ renderer: "svg" }}
		/>
	);
}
