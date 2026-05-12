/**
 * usePretextFlow — Variable-width text flow around obstacles.
 *
 * The killer feature: text that flows around rectangles, circles,
 * and pull-quotes at 60fps. Pure arithmetic — zero DOM reflow.
 *
 * Based on the editorial-engine demo from @chenglou/pretext.
 */
import {
	type LayoutCursor,
	layoutNextLine,
	type PreparedTextWithSegments,
	type PrepareOptions,
	prepareWithSegments,
} from "@chenglou/pretext";
import { useEffect, useMemo, useRef, useState } from "react";

// ─── Obstacle Types ─────────────────────────────────────

export interface RectObstacle {
	type: "rect";
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface CircleObstacle {
	type: "circle";
	cx: number;
	cy: number;
	r: number;
	hPad?: number;
	vPad?: number;
}

export type Obstacle = RectObstacle | CircleObstacle;

// ─── Positioned Line ────────────────────────────────────

export interface PositionedLine {
	/** Line text content */
	text: string;
	/** X offset from container left */
	x: number;
	/** Y offset from container top */
	y: number;
	/** Measured text width */
	width: number;
}

export interface PretextFlowResult {
	/** Lines with absolute positions */
	lines: PositionedLine[];
	/** Total flow height in px */
	totalHeight: number;
	/** Whether computation is ready */
	isReady: boolean;
}

// ─── Internal helpers ───────────────────────────────────

interface Interval {
	left: number;
	right: number;
}

const MIN_SLOT_WIDTH = 30;

/**
 * Carve available horizontal slots from a base interval,
 * subtracting all blocked intervals.
 */
function carveSlots(base: Interval, blocked: Interval[]): Interval[] {
	let slots: Interval[] = [base];
	for (const interval of blocked) {
		const next: Interval[] = [];
		for (const slot of slots) {
			if (interval.right <= slot.left || interval.left >= slot.right) {
				next.push(slot);
				continue;
			}
			if (interval.left > slot.left)
				next.push({ left: slot.left, right: interval.left });
			if (interval.right < slot.right)
				next.push({ left: interval.right, right: slot.right });
		}
		slots = next;
	}
	return slots.filter((s) => s.right - s.left >= MIN_SLOT_WIDTH);
}

/**
 * Compute the blocked horizontal interval for a circle
 * intersecting a vertical band.
 */
function circleIntervalForBand(
	cx: number,
	cy: number,
	r: number,
	bandTop: number,
	bandBottom: number,
	hPad: number,
	vPad: number,
): Interval | null {
	const top = bandTop - vPad;
	const bottom = bandBottom + vPad;
	if (top >= cy + r || bottom <= cy - r) return null;
	const minDy =
		cy >= top && cy <= bottom ? 0 : cy < top ? top - cy : cy - bottom;
	if (minDy >= r) return null;
	const maxDx = Math.sqrt(r * r - minDy * minDy);
	return { left: cx - maxDx - hPad, right: cx + maxDx + hPad };
}

// ─── Hook ───────────────────────────────────────────────

/**
 * Flow text around obstacles with zero DOM reads.
 *
 * ```tsx
 * const { lines, totalHeight } = usePretextFlow(
 *   articleText,
 *   '15px Georgia',
 *   24,           // lineHeight
 *   0, 0, 600, 800, // region: x, y, w, h
 *   [
 *     { type: 'rect', x: 200, y: 100, w: 180, h: 120 },   // pull quote
 *     { type: 'circle', cx: 400, cy: 300, r: 80 },          // orb
 *   ]
 * )
 * ```
 */
export function usePretextFlow(
	text: string,
	font: string,
	lineHeight: number,
	regionX: number,
	regionY: number,
	regionW: number,
	regionH: number,
	obstacles: Obstacle[],
	options?: PrepareOptions,
): PretextFlowResult {
	const [fontsReady, setFontsReady] = useState(false);
	const preparedRef = useRef<PreparedTextWithSegments | null>(null);
	const prevTextKey = useRef("");

	useEffect(() => {
		document.fonts.ready.then(() => setFontsReady(true));
	}, []);

	const textKey = `${text}│${font}│${options?.whiteSpace ?? ""}│${options?.wordBreak ?? ""}`;

	return useMemo(() => {
		if (!fontsReady || !text || regionW <= 0 || regionH <= 0) {
			return { lines: [], totalHeight: 0, isReady: false };
		}

		// Re-prepare only when text or font changes
		if (textKey !== prevTextKey.current || !preparedRef.current) {
			prevTextKey.current = textKey;
			preparedRef.current = prepareWithSegments(text, font, options);
		}

		const prepared = preparedRef.current;
		const positionedLines: PositionedLine[] = [];
		let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };
		let lineTop = regionY;
		let textExhausted = false;

		while (lineTop + lineHeight <= regionY + regionH && !textExhausted) {
			const bandTop = lineTop;
			const bandBottom = lineTop + lineHeight;
			const blocked: Interval[] = [];

			// Compute blocked intervals from obstacles
			for (const obs of obstacles) {
				if (obs.type === "circle") {
					const interval = circleIntervalForBand(
						obs.cx,
						obs.cy,
						obs.r,
						bandTop,
						bandBottom,
						obs.hPad ?? 14,
						obs.vPad ?? 4,
					);
					if (interval !== null) blocked.push(interval);
				} else if (obs.type === "rect") {
					if (bandBottom > obs.y && bandTop < obs.y + obs.h) {
						blocked.push({ left: obs.x, right: obs.x + obs.w });
					}
				}
			}

			// Carve available slots
			const slots = carveSlots(
				{ left: regionX, right: regionX + regionW },
				blocked,
			);
			if (slots.length === 0) {
				lineTop += lineHeight;
				continue;
			}

			// Fill slots left-to-right
			const sorted = [...slots].sort((a, b) => a.left - b.left);
			for (const slot of sorted) {
				const slotWidth = slot.right - slot.left;
				const line = layoutNextLine(prepared, cursor, slotWidth);
				if (line === null) {
					textExhausted = true;
					break;
				}
				positionedLines.push({
					text: line.text,
					x: Math.round(slot.left),
					y: Math.round(lineTop),
					width: line.width,
				});
				cursor = line.end;
			}

			lineTop += lineHeight;
		}

		// Total height = bottom of last line + one line height
		const totalHeight =
			positionedLines.length > 0
				? positionedLines[positionedLines.length - 1]!.y - regionY + lineHeight
				: 0;

		return { lines: positionedLines, totalHeight, isReady: true };
	}, [
		fontsReady,
		text,
		font,
		lineHeight,
		regionX,
		regionY,
		regionW,
		regionH,
		obstacles,
		textKey,
	]);
}
