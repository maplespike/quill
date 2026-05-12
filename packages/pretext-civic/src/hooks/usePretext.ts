/**
 * usePretext — Core text measurement hook wrapping @chenglou/pretext.
 *
 * Provides DOM-free height prediction. Two-phase internally:
 *   prepare() when text/font change (one-time measurement pass)
 *   layout() when width changes (pure arithmetic, ~0.0002ms)
 *
 * Zero layout reflow. Zero DOM reads.
 */
import {
	layout,
	type PreparedText,
	type PrepareOptions,
	prepare,
} from "@chenglou/pretext";
import { useEffect, useMemo, useRef, useState } from "react";

export interface PretextResult {
	/** Total text height in px */
	height: number;
	/** Number of wrapped lines */
	lineCount: number;
	/** Whether font loading + preparation is complete */
	isReady: boolean;
}

/**
 * Measure paragraph height without ever touching the DOM layout tree.
 *
 * ```tsx
 * const { height, lineCount } = usePretext(bodyText, '15px Georgia', 600, 24)
 * // height = exact pixel height, no reflow
 * ```
 */
export function usePretext(
	text: string,
	font: string,
	maxWidth: number,
	lineHeight: number,
	options?: PrepareOptions,
): PretextResult {
	const [fontsReady, setFontsReady] = useState(false);
	const preparedRef = useRef<PreparedText | null>(null);
	const prevDepsRef = useRef("");

	useEffect(() => {
		document.fonts.ready.then(() => setFontsReady(true));
	}, []);

	const depsKey = `${text}│${font}│${options?.whiteSpace ?? ""}│${options?.wordBreak ?? ""}`;

	return useMemo(() => {
		if (!fontsReady || !text) {
			return { height: 0, lineCount: 0, isReady: false };
		}

		// Only re-prepare when text or font changes (expensive)
		if (depsKey !== prevDepsRef.current || !preparedRef.current) {
			prevDepsRef.current = depsKey;
			preparedRef.current = prepare(text, font, options);
		}

		// Layout is pure arithmetic — run on every width change (cheap)
		const result = layout(preparedRef.current, maxWidth, lineHeight);
		return { ...result, isReady: true };
	}, [fontsReady, text, font, maxWidth, lineHeight, depsKey]);
}
