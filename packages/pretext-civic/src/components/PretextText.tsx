/**
 * PretextText — Core text rendering primitive.
 *
 * Takes pretext-computed lines and renders them as absolutely positioned
 * spans. Zero CSS layout. Zero reflow. Perfect text positioning.
 *
 * Screen reader compatible. Text selectable. CSS effects work.
 * This is how you render pretext output in the DOM.
 */

import type { LayoutLine } from "@chenglou/pretext";
import { motion } from "motion/react";
import { useMemo } from "react";

export interface PretextTextProps {
	/** Lines from usePretextLines or usePretextFlow */
	lines: Array<{
		text: string;
		x?: number;
		y: number;
		width?: number;
	}>;
	/** Canvas font shorthand, e.g. '15px Georgia' */
	font: string;
	/** Line height in px */
	lineHeight: number;
	/** Text color */
	color?: string;
	/** Additional CSS for the container */
	className?: string;
	style?: React.CSSProperties;
	/** Stagger line appearance animation delay (ms per line, 0 = no animation) */
	staggerDelay?: number;
	/** Whether to animate */
	animate?: boolean;
	/** Opacity override */
	opacity?: number;
	/** Text alignment for lines with computed widths */
	align?: "left" | "center" | "right";
	/** Click handler for text */
	onClick?: () => void;
}

export function PretextText({
	lines,
	font,
	lineHeight,
	color = "inherit",
	className,
	style,
	staggerDelay = 0,
	animate = true,
	opacity = 1,
	align = "left",
	onClick,
}: PretextTextProps) {
	const totalHeight = useMemo(() => {
		if (lines.length === 0) return 0;
		const lastLine = lines[lines.length - 1]!;
		return lastLine.y + lineHeight;
	}, [lines, lineHeight]);

	if (lines.length === 0) return null;

	const containerStyle: React.CSSProperties = {
		position: "relative",
		height: totalHeight,
		width: "100%",
		userSelect: "text",
		cursor: onClick ? "pointer" : "default",
		...style,
	};

	return (
		<div
			className={className}
			style={containerStyle}
			onClick={onClick}
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : undefined}
		>
			{lines.map((line, i) => {
				const x = line.x ?? 0;
				let xOffset = x;
				if (align === "center" && line.width) {
					xOffset = x; // Centering handled by container or parent
				}

				const lineStyle: React.CSSProperties = {
					position: "absolute",
					left: xOffset,
					top: line.y,
					font,
					lineHeight: `${lineHeight}px`,
					color,
					opacity,
					whiteSpace: "nowrap",
					pointerEvents: "none",
				};

				if (animate && staggerDelay > 0) {
					return (
						<motion.span
							key={`${i}-${line.text.slice(0, 20)}`}
							style={lineStyle}
							initial={{ opacity: 0, y: 4 }}
							animate={{ opacity, y: 0 }}
							transition={{
								duration: 0.25,
								delay: i * (staggerDelay / 1000),
								ease: "easeOut",
							}}
						>
							{line.text}
						</motion.span>
					);
				}

				return (
					<span key={`${i}-${line.text.slice(0, 20)}`} style={lineStyle}>
						{line.text}
					</span>
				);
			})}

			{/* Invisible text layer for screen readers and selection */}
			<span
				aria-hidden="false"
				style={{
					position: "absolute",
					width: 1,
					height: 1,
					padding: 0,
					margin: -1,
					overflow: "hidden",
					clip: "rect(0, 0, 0, 0)",
					whiteSpace: "nowrap",
					border: 0,
				}}
			>
				{lines.map((l) => l.text).join(" ")}
			</span>
		</div>
	);
}
