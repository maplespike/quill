import { useMemo } from "react";

/**
 * ECharts theme configuration for the dark civic-intel aesthetic.
 *
 * Returns a complete theme object compatible with ECharts registerTheme().
 * Uses colors from the named CivicIntel theme variant.
 */
export function useChartTheme(themeName?: string) {
	return useMemo(() => {
		const colors = getThemeColors(themeName);

		const theme = {
			color: colors.chartColors,
			backgroundColor: colors.background,
			textStyle: {
				color: colors.text,
				fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
			},
			title: {
				textStyle: {
					color: colors.text,
					fontSize: 18,
					fontWeight: 600,
				},
				subtextStyle: {
					color: colors.textSecondary,
					fontSize: 13,
				},
			},
			legend: {
				textStyle: {
					color: colors.textSecondary,
				},
			},
			tooltip: {
				backgroundColor: colors.surface,
				borderColor: colors.border,
				borderWidth: 1,
				textStyle: {
					color: colors.text,
					fontSize: 13,
				},
				extraCssText: `backdrop-filter: blur(12px); box-shadow: 0 8px 32px ${colors.glowStrong}; border-radius: 8px;`,
			},
			categoryAxis: {
				axisLine: { lineStyle: { color: colors.border } },
				axisTick: { lineStyle: { color: colors.border } },
				axisLabel: { color: colors.textMuted },
				splitLine: { lineStyle: { color: `${colors.border}44` } },
			},
			valueAxis: {
				axisLine: { lineStyle: { color: colors.border } },
				axisTick: { lineStyle: { color: colors.border } },
				axisLabel: { color: colors.textMuted },
				splitLine: {
					lineStyle: { color: `${colors.border}33`, type: "dashed" as const },
				},
			},
			visualMap: {
				textStyle: { color: colors.textSecondary },
			},
			toolbox: {
				iconStyle: { borderColor: colors.textMuted },
				emphasis: { iconStyle: { borderColor: colors.cyan } },
			},
		};

		return theme;
	}, [themeName]);
}

function getThemeColors(themeName?: string) {
	const themes: Record<string, ThemeColors> = {
		nightwatch: {
			background: "#0a0e1a",
			surface: "#1e293bdd",
			border: "#334155",
			text: "#f1f5f9",
			textSecondary: "#94a3b8",
			textMuted: "#64748b",
			cyan: "#22d3ee",
			gold: "#d4a853",
			red: "#ef4444",
			amber: "#f59e0b",
			green: "#22c55e",
			purple: "#a78bfa",
			blue: "#3b82f6",
			glowStrong: "rgba(34,211,238,0.3)",
			chartColors: [
				"#22d3ee",
				"#d4a853",
				"#ef4444",
				"#f59e0b",
				"#22c55e",
				"#a78bfa",
				"#3b82f6",
				"#ec4899",
				"#14b8a6",
				"#f97316",
			],
		},
		phosphor: {
			background: "#000000",
			surface: "#1a1a1acc",
			border: "#333333",
			text: "#33ff33",
			textSecondary: "#22cc22",
			textMuted: "#1a8c1a",
			cyan: "#33ff99",
			gold: "#99ff33",
			red: "#ff3333",
			amber: "#ccff33",
			green: "#33ff33",
			purple: "#99cc33",
			blue: "#33cc99",
			glowStrong: "rgba(51,255,51,0.25)",
			chartColors: [
				"#33ff33",
				"#33ff99",
				"#99ff33",
				"#ccff33",
				"#33cc99",
				"#22cc22",
				"#66ff66",
				"#33ccff",
				"#99cc33",
				"#33ffcc",
			],
		},
	};

	return themes[themeName ?? "nightwatch"] ?? themes.nightwatch;
}

interface ThemeColors {
	background: string;
	surface: string;
	border: string;
	text: string;
	textSecondary: string;
	textMuted: string;
	cyan: string;
	gold: string;
	red: string;
	amber: string;
	green: string;
	purple: string;
	blue: string;
	glowStrong: string;
	chartColors: string[];
}

export type { ThemeColors };
