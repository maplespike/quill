/**
 * @civic-intel/pretext-civic
 *
 * Pretext visualization components for CivicIntel.
 * Magazine layouts, semantic chips, animated metrics, Sankey flows,
 * timelines, and interactive chart library.
 */

export type {
	ComparisonBarProps,
	ComparisonItem,
} from "./charts/ComparisonBar";
export { ComparisonBar } from "./charts/ComparisonBar";
export type { GaugeSignalProps } from "./charts/GaugeSignal";
export { GaugeSignal } from "./charts/GaugeSignal";
export type { GeoCanadaProps, ProvinceData } from "./charts/GeoCanada";
export { GeoCanada } from "./charts/GeoCanada";
export type { HeatmapCell, LobbyHeatmapProps } from "./charts/LobbyHeatmap";
export { LobbyHeatmap } from "./charts/LobbyHeatmap";
export type {
	NetworkRadialProps,
	RadialEdge,
	RadialNode,
} from "./charts/NetworkRadial";
export { NetworkRadial } from "./charts/NetworkRadial";
export type {
	ConnectionSegment,
	RingOfConnectionsProps,
} from "./charts/RingOfConnections";
export { RingOfConnections } from "./charts/RingOfConnections";
export type {
	SankeyFlowLink,
	SankeyFlowNode,
	SankeyFlowProps,
} from "./charts/SankeyFlow";
// Charts
export { SankeyFlow } from "./charts/SankeyFlow";
export type {
	AnomalyMarker,
	AreaDataPoint,
	SpendingAreaChartProps,
} from "./charts/SpendingAreaChart";
export { SpendingAreaChart } from "./charts/SpendingAreaChart";
export type {
	SpendingTreemapProps,
	TreemapItem,
} from "./charts/SpendingTreemap";

export { SpendingTreemap } from "./charts/SpendingTreemap";
export type {
	TimelineMilestone,
	TimelineTrackerProps,
} from "./charts/TimelineTracker";
export { TimelineTracker } from "./charts/TimelineTracker";
export type { AnimatedMetricProps } from "./components/AnimatedMetric";
// Components
export { AnimatedMetric } from "./components/AnimatedMetric";
export type { BriefLayoutProps } from "./components/BriefLayout";
export { BriefLayout } from "./components/BriefLayout";
export type {
	FlowingSankeyProps,
	SankeyLink as FlowingSankeyLink,
	SankeyNode as FlowingSankeyNode,
} from "./components/FlowingSankey";
export { FlowingSankey } from "./components/FlowingSankey";
export type { IntelChipProps } from "./components/IntelChip";
export { IntelChip } from "./components/IntelChip";
export type {
	EventEntry,
	PromiseEntry,
	PromiseTimelineProps,
} from "./components/PromiseTimeline";
export { PromiseTimeline } from "./components/PromiseTimeline";
export { useAnimatedCounter } from "./hooks/useAnimatedCounter";
export { useChartTheme } from "./hooks/useChartTheme";
// Hooks
export { usePretextLayout } from "./hooks/usePretextLayout";
export type { CivicTheme, CivicThemeColors } from "./theme/dark";
// Theme
export { defaultTheme, getTheme, themes, themeToCSSVars } from "./theme/dark";
