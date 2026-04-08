import ReactECharts from "echarts-for-react";
import { useCallback, useMemo } from "react";
import { useChartTheme } from "../hooks/useChartTheme";
import { defaultTheme } from "../theme/dark";

export interface ProvinceData {
	code: string; // e.g. "CA-ON", "CA-BC", etc.
	name: string;
	spending?: number;
	lobbyingDensity?: number;
	contractConcentration?: number;
}

export interface GeoCanadaProps {
	data: ProvinceData[];
	activeLayer?: "spending" | "lobbyingDensity" | "contractConcentration";
	width?: number;
	height?: number;
	title?: string;
	onProvinceClick?: (code: string) => void;
}

const LAYER_CONFIG = {
	spending: {
		label: "Spending ($M)",
		colorRange: ["#1a2332", "#0d3b66", "#0e6ba8", "#22d3ee"],
		accessor: (d: ProvinceData) => d.spending ?? 0,
		format: (v: number) => `$${(v / 1_000_000).toFixed(1)}M`,
	},
	lobbyingDensity: {
		label: "Lobbying Density",
		colorRange: ["#1a1a2e", "#4a2006", "#7c4a0a", "#f59e0b"],
		accessor: (d: ProvinceData) => d.lobbyingDensity ?? 0,
		format: (v: number) => `${v} filings`,
	},
	contractConcentration: {
		label: "Contract Concentration",
		colorRange: ["#1a2332", "#1a3a2a", "#166534", "#22c55e"],
		accessor: (d: ProvinceData) => d.contractConcentration ?? 0,
		format: (v: number) => `${v} contracts`,
	},
} as const;

// Simplified Canada provinces GeoJSON (minimal for echarts)
// In production, load from CDN or local file.
// ECharts can register map via `registerMap('canada', geoJson)`.
// For now, we use the built-in scatter-based approach with lat/lng for province centroids.
const PROVINCE_COORDS: Record<string, [number, number]> = {
	"CA-ON": [-79.38, 43.65], // Ontario
	"CA-QC": [-73.57, 45.5], // Quebec
	"CA-BC": [-123.12, 49.28], // British Columbia
	"CA-AB": [-113.49, 53.55], // Alberta
	"CA-MB": [-97.14, 49.9], // Manitoba
	"CA-SK": [-104.62, 52.13], // Saskatchewan
	"CA-NS": [-63.57, 44.65], // Nova Scotia
	"CA-NB": [-66.46, 46.56], // New Brunswick
	"CA-NL": [-52.71, 47.56], // Newfoundland
	"CA-PE": [-63.21, 46.24], // PEI
	"CA-NT": [-114.37, 62.45], // Northwest Territories
	"CA-YT": [-135.06, 63.07], // Yukon
	"CA-NU": [-95.0, 63.5], // Nunavut
};

export function GeoCanada({
	data,
	activeLayer = "spending",
	width,
	height = 500,
	title,
	onProvinceClick,
}: GeoCanadaProps) {
	const chartTheme = useChartTheme();
	const layerConfig = LAYER_CONFIG[activeLayer];

	const option = useMemo(() => {
		const values = data.map(layerConfig.accessor);
		const maxVal = Math.max(...values, 1);

		const scatterData = data
			.filter((d) => PROVINCE_COORDS[d.code])
			.map((d) => ({
				name: d.name,
				value: [...PROVINCE_COORDS[d.code], layerConfig.accessor(d)],
				provinceCode: d.code,
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
				backgroundColor: "rgba(15, 23, 42, 0.92)",
				borderColor: defaultTheme.colors.border,
				textStyle: { color: defaultTheme.colors.text },
				formatter: (params: Record<string, unknown>) => {
					const val = (params.value as number[])[2];
					return `<strong>${params.name}</strong><br/>${layerConfig.label}: ${layerConfig.format(val)}`;
				},
			},
			visualMap: {
				min: 0,
				max: maxVal,
				calculable: true,
				orient: "horizontal" as const,
				left: "center",
				bottom: 0,
				inRange: {
					color: [...layerConfig.colorRange],
				},
				textStyle: { color: defaultTheme.colors.textMuted, fontSize: 10 },
				formatter: (val: number) => {
					if (activeLayer === "spending")
						return `$${(val / 1_000_000).toFixed(0)}M`;
					return `${Math.round(val)}`;
				},
			},
			geo: {
				show: false,
			},
			series: [
				{
					type: "effectScatter" as const,
					coordinateSystem: "geo" as const,
					geoIndex: 0,
					data: scatterData,
					symbolSize: (val: number | number[]) => {
						const v = Array.isArray(val) ? val[2] : val;
						return Math.max(
							12,
							Math.sqrt(v / Math.max(...data.map(layerConfig.accessor), 1)) *
								40,
						);
					},
					encode: { tooltip: [2] },
					rippleEffect: {
						brushType: "stroke" as const,
						scale: 3,
						period: 4,
					},
					label: {
						show: true,
						formatter: "{b}",
						position: "right" as const,
						color: defaultTheme.colors.textSecondary,
						fontSize: 10,
					},
					itemStyle: {
						color: layerConfig.colorRange[layerConfig.colorRange.length - 1],
						shadowBlur: 10,
						shadowColor: "rgba(34, 211, 238, 0.3)",
					},
					animationDuration: 1000,
				},
			],
		};
	}, [data, activeLayer, layerConfig]);

	const handleClick = useCallback(
		(params: Record<string, unknown>) => {
			const d = data.find((item) => item.name === params.name);
			if (d) onProvinceClick?.(d.code);
		},
		[data, onProvinceClick],
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
