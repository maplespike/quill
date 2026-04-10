/**
 * FlowText — Text that flows around obstacles in real-time.
 *
 * The signature pretext component. Text wraps around rectangles
 * (pull quotes, embedded charts) and circles (graph nodes, orbs)
 * using pure arithmetic. Zero DOM layout reflow.
 *
 * Use this for:
 * - Magazine editorial layouts
 * - Text around embedded visualizations
 * - Real-time reflow around animated elements
 */

import { useMemo } from "react";
import { type Obstacle, usePretextFlow } from "../hooks/usePretextFlow";
import { PretextText } from "./PretextText";

export interface FlowTextProps {
	/** The paragraph text */
	text: string;
	/** Canvas font shorthand */
	font: string;
	/** Line height in px */
	lineHeight: number;
	/** Total available width */
	width: number;
	/** Maximum height (text clips beyond this) */
	maxHeight?: number;
	/** Obstacles to flow around */
	obstacles?: Obstacle[];
	/** Text color */
	color?: string;
	/** Additional CSS class */
	className?: string;
	/** Additional CSS styles */
	style?: React.CSSProperties;
	/** Stagger animation delay between lines (ms) */
	staggerDelay?: number;
	/** Whether to animate line appearance */
	animate?: boolean;
}

export function FlowText({
	text,
	font,
	lineHeight,
	width,
	maxHeight = 9999,
	obstacles = [],
	color,
	className,
	style,
	staggerDelay = 0,
	animate = true,
}: FlowTextProps) {
	const { lines, isReady } = usePretextFlow(
		text,
		font,
		lineHeight,
		0, // regionX (offset from container left)
		0, // regionY
		width,
		maxHeight,
		obstacles,
	);

	const filteredLines = useMemo(
		() => lines.filter((l) => l.text.trim().length > 0),
		[lines],
	);

	if (!isReady || filteredLines.length === 0) return null;

	return (
		<PretextText
			lines={filteredLines}
			font={font}
			lineHeight={lineHeight}
			color={color}
			className={className}
			style={style}
			staggerDelay={staggerDelay}
			animate={animate}
		/>
	);
}
