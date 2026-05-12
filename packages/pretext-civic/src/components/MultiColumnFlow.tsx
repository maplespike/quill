/**
 * MultiColumnFlow — Newspaper-style multi-column text with cursor handoff.
 *
 * The left column consumes text until it reaches the bottom, then the
 * cursor hands off to the right column. The right column picks up
 * exactly where the left column stopped — no duplication, no gap,
 * perfect line breaking at the column boundary.
 *
 * This is how newspapers and magazines work on paper.
 * Now it works on the web. Zero DOM layout reflow.
 */
import {
	type LayoutCursor,
	layoutNextLine,
	type PreparedTextWithSegments,
	type PrepareOptions,
	prepareWithSegments,
} from "@chenglou/pretext";
import { motion } from "motion/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { Obstacle } from "../hooks/usePretextFlow";

// ─── Types ──────────────────────────────────────────────

export interface ColumnContent {
	text?: string;
	component?: ReactNode;
}

export interface MultiColumnFlowProps {
	/** Text to flow across columns */
	text: string;
	/** Canvas font shorthand */
	font: string;
	/** Line height in px */
	lineHeight: number;
	/** Total container width */
	width: number;
	/** Number of columns */
	columns?: number;
	/** Gap between columns */
	gap?: number;
	/** Padding inside container */
	padding?: number;
	/** Max height per column (0 = auto) */
	maxColumnHeight?: number;
	/** Obstacles per column (for pull quotes etc.) */
	obstacles?: Obstacle[];
	/** Text color */
	color?: string;
	/** Animated reveal */
	animate?: boolean;
	/** Drop cap on first letter */
	dropCap?: boolean;
	/** Drop cap font family */
	dropCapFontFamily?: string;
	/** Pull quote to embed */
	pullQuote?: {
		text: string;
		font?: string;
		column?: number;
		yPosition?: number;
	};
	/** Additional CSS class */
	className?: string;
	/** Additional CSS styles */
	style?: React.CSSProperties;
}

interface PositionedLine {
	text: string;
	x: number;
	y: number;
	width: number;
}

interface ColumnLayout {
	columnIndex: number;
	x: number;
	width: number;
	lines: PositionedLine[];
	textExhausted: boolean;
}

// ─── Component ──────────────────────────────────────────

export function MultiColumnFlow({
	text,
	font,
	lineHeight,
	width,
	columns = 2,
	gap = 40,
	padding = 0,
	maxColumnHeight = 0,
	obstacles = [],
	color = "inherit",
	animate = true,
	dropCap = false,
	dropCapFontFamily,
	pullQuote,
	className,
	style,
}: MultiColumnFlowProps) {
	const [fontsReady, setFontsReady] = useState(false);
	const preparedRef = useRef<PreparedTextWithSegments | null>(null);
	const prevTextKey = useRef("");

	useEffect(() => {
		document.fonts.ready.then(() => setFontsReady(true));
	}, []);

	const textKey = `${text}│${font}`;
	const innerWidth = width - padding * 2;
	const colWidth = (innerWidth - gap * (columns - 1)) / columns;

	const columnLayouts = useMemo(() => {
		if (!fontsReady || !text || innerWidth <= 0) return [];

		if (textKey !== prevTextKey.current || !preparedRef.current) {
			prevTextKey.current = textKey;
			preparedRef.current = prepareWithSegments(text, font);
		}

		const prepared = preparedRef.current;
		const maxH = maxColumnHeight > 0 ? maxColumnHeight : 99999;
		const layouts: ColumnLayout[] = [];

		let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };

		for (let col = 0; col < columns; col++) {
			const colX = padding + col * (colWidth + gap);
			const lines: PositionedLine[] = [];
			let lineY = 0;
			let textExhausted = false;

			// Drop cap on first column
			const dropCapLines = dropCap && col === 0 ? 3 : 0;
			const dropCapWidth = dropCap && col === 0 ? lineHeight * 2.5 : 0;

			while (lineY + lineHeight <= maxH && !textExhausted) {
				// Calculate available width for this line
				let availWidth = colWidth;

				// Drop cap region
				if (
					dropCapLines > 0 &&
					col === 0 &&
					lineY < dropCapLines * lineHeight
				) {
					availWidth = colWidth - dropCapWidth;
				}

				// Check obstacles
				const blockedRanges: Array<{
					left: number;
					right: number;
				}> = [];
				for (const obs of obstacles) {
					if (obs.type === "rect") {
						if (
							lineY + lineHeight > obs.y &&
							lineY < obs.y + obs.h &&
							obs.x >= colX &&
							obs.x < colX + colWidth
						) {
							blockedRanges.push({
								left: obs.x,
								right: obs.x + obs.w,
							});
						}
					}
				}

				if (blockedRanges.length > 0) {
					// Skip lines blocked by obstacles
					lineY += lineHeight;
					continue;
				}

				const line = layoutNextLine(prepared, cursor, availWidth);
				if (line === null) {
					textExhausted = true;
					break;
				}

				const x =
					dropCapLines > 0 && col === 0 && lineY < dropCapLines * lineHeight
						? colX + dropCapWidth
						: colX;

				lines.push({
					text: line.text,
					x: Math.round(x),
					y: Math.round(lineY),
					width: line.width,
				});
				cursor = line.end;
				lineY += lineHeight;
			}

			layouts.push({
				columnIndex: col,
				x: colX,
				width: colWidth,
				lines,
				textExhausted,
			});

			if (textExhausted && lines.length === 0) break;
		}

		return layouts;
	}, [
		fontsReady,
		text,
		font,
		innerWidth,
		colWidth,
		columns,
		gap,
		padding,
		maxColumnHeight,
		obstacles,
		dropCap,
		lineHeight,
		textKey,
	]);

	if (!fontsReady || columnLayouts.length === 0) return null;

	// Calculate total height
	const maxColHeight = Math.max(
		...columnLayouts.map((c) =>
			c.lines.length > 0 ? c.lines[c.lines.length - 1]!.y + lineHeight : 0,
		),
	);

	const containerStyle: React.CSSProperties = {
		position: "relative",
		height: maxColHeight + padding * 2,
		width,
		userSelect: "text",
		...style,
	};

	return (
		<div className={className} style={containerStyle}>
			{/* Drop cap */}
			{dropCap && columnLayouts[0]?.lines[0] && (
				<motion.span
					initial={animate ? { opacity: 0, scale: 0.8 } : undefined}
					animate={
						animate
							? {
									opacity: 1,
									scale: 1,
								}
							: undefined
					}
					transition={{ duration: 0.6, delay: 0.2 }}
					style={{
						position: "absolute",
						left: padding,
						top: 0,
						font: `700 ${lineHeight * 3 - 4}px ${dropCapFontFamily ?? "'Georgia', serif"}`,
						lineHeight: `${lineHeight * 3}px`,
						color,
						float: "left",
						opacity: 0.9,
					}}
				>
					{text[0]}
				</motion.span>
			)}

			{/* Pull quote */}
			{pullQuote && (
				<motion.div
					initial={animate ? { opacity: 0, x: 20 } : undefined}
					animate={animate ? { opacity: 1, x: 0 } : undefined}
					transition={{ duration: 0.5, delay: 0.4 }}
					style={{
						position: "absolute",
						right: padding,
						top: pullQuote.yPosition ?? maxColHeight * 0.35,
						width: colWidth * 0.8,
						padding: "16px 20px",
						borderLeft: `3px solid currentColor`,
						opacity: 0.7,
						font: pullQuote.font ?? `italic 16px Georgia, serif`,
						color,
						lineHeight: 1.5,
					}}
				>
					{pullQuote.text}
				</motion.div>
			)}

			{/* Column text */}
			{columnLayouts.map((col) =>
				col.lines.map((line, i) => (
					<motion.span
						key={`col${col.columnIndex}-line${i}`}
						style={{
							position: "absolute",
							left: line.x,
							top: line.y + padding,
							font,
							lineHeight: `${lineHeight}px`,
							color,
							whiteSpace: "nowrap",
						}}
						initial={animate ? { opacity: 0 } : undefined}
						animate={animate ? { opacity: 1 } : undefined}
						transition={{
							duration: 0.15,
							delay: 0.05 + col.columnIndex * 0.1 + i * 0.015,
						}}
					>
						{line.text}
					</motion.span>
				)),
			)}

			{/* Screen reader text */}
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
				{text}
			</span>
		</div>
	);
}
