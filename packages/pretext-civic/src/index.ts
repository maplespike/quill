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
export type { AdaptiveHeadlineProps } from "./components/AdaptiveHeadline";
// Pretext Components
export { AdaptiveHeadline } from "./components/AdaptiveHeadline";
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
export type { FlowTextProps } from "./components/FlowText";
export { FlowText } from "./components/FlowText";
export type { IntelChipProps } from "./components/IntelChip";
export { IntelChip } from "./components/IntelChip";
export type {
  ColumnContent,
  MultiColumnFlowProps,
} from "./components/MultiColumnFlow";
export { MultiColumnFlow } from "./components/MultiColumnFlow";
export type { PretextTextProps } from "./components/PretextText";
export { PretextText } from "./components/PretextText";
export type { PretextTooltipProps } from "./components/PretextTooltip";
export { PretextTooltip } from "./components/PretextTooltip";
export type {
  EventEntry,
  PromiseEntry,
  PromiseTimelineProps,
} from "./components/PromiseTimeline";
export { PromiseTimeline } from "./components/PromiseTimeline";
export type { RichInlineTextProps } from "./components/RichInlineText";
export { RichInlineText } from "./components/RichInlineText";
export type { AdaptiveHeadlineResult } from "./hooks/useAdaptiveHeadline";
// Pretext Hooks
export { useAdaptiveHeadline } from "./hooks/useAdaptiveHeadline";
// Legacy Hooks
export { useAnimatedCounter } from "./hooks/useAnimatedCounter";
export { useChartTheme } from "./hooks/useChartTheme";
export type { PretextResult } from "./hooks/usePretext";
export { usePretext } from "./hooks/usePretext";
export type {
  CircleObstacle,
  Obstacle,
  PositionedLine,
  PretextFlowResult,
  RectObstacle,
} from "./hooks/usePretextFlow";
export { usePretextFlow } from "./hooks/usePretextFlow";
export { usePretextLayout } from "./hooks/usePretextLayout";
export type { PretextLinesResult } from "./hooks/usePretextLines";
export { usePretextLines } from "./hooks/usePretextLines";
export type {
  CivicRichItem,
  PretextRichInlineResult,
  RichInlineLine,
} from "./hooks/usePretextRichInline";
export { usePretextRichInline } from "./hooks/usePretextRichInline";
export type { ShrinkwrapResult } from "./hooks/usePretextShrinkwrap";
export { usePretextShrinkwrap } from "./hooks/usePretextShrinkwrap";
export type { CivicTheme, CivicThemeColors } from "./theme/dark";
// Theme
export { defaultTheme, getTheme, themes, themeToCSSVars } from "./theme/dark";
