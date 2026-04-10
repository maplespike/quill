/**
 * usePretextRichInline — Rich text with inline entity chips.
 *
 * Wraps @chenglou/pretext/rich-inline for React.
 * Entity names, signal tags, and monetary amounts flow inline
 * as atomic pills that never break mid-chip.
 *
 * This is how you make "L3Harris lobbied DND for a $45M contract"
 * where "L3Harris" and "$45M" are styled chips that wrap as atomic units.
 */
import {
	materializeRichInlineLineRange,
	type PreparedRichInline,
	prepareRichInline,
	type RichInlineCursor,
	type RichInlineFragment,
	type RichInlineItem,
	walkRichInlineLineRanges,
} from "@chenglou/pretext/rich-inline";
import { useEffect, useMemo, useRef, useState } from "react";

// ─── Extended Item Type ─────────────────────────────────

export interface CivicRichItem extends RichInlineItem {
	/** Text color for this fragment */
	color?: string;
	/** Background color (renders as pill/chip) */
	background?: string;
	/** Border color for chip */
	borderColor?: string;
	/** Extra horizontal padding (added to extraWidth) */
	paddingX?: number;
	/** Border radius for chip */
	borderRadius?: number;
	/** Font weight string */
	weight?: number;
}

// ─── Materialized Line ──────────────────────────────────

export interface RichInlineLine {
	/** Fragments on this line */
	fragments: Array<{
		/** Index back into original items array */
		itemIndex: number;
		/** Text content for this fragment */
		text: string;
		/** Gap before this fragment on this line */
		gapBefore: number;
		/** Total occupied width including extraWidth */
		occupiedWidth: number;
		/** Original item with styling info */
		item: CivicRichItem;
	}>;
	/** Total line width */
	width: number;
}

export interface PretextRichInlineResult {
	/** Materialized lines with styled fragments */
	lines: RichInlineLine[];
	/** Whether computation is ready */
	isReady: boolean;
}

// ─── Hook ───────────────────────────────────────────────

/**
 * Lay out rich inline text with atomic chips.
 *
 * ```tsx
 * const { lines } = usePretextRichInline([
 *   { text: 'Contract awarded to ', font: '15px Georgia' },
 *   { text: 'L3Harris', font: '700 12px Inter', break: 'never', extraWidth: 16,
 *     background: 'rgba(239,68,68,0.15)', borderColor: '#ef4444', color: '#fca5a5' },
 *   { text: ' during active lobbying.', font: '15px Georgia' },
 * ], 400)
 * ```
 */
export function usePretextRichInline(
	items: CivicRichItem[],
	maxWidth: number,
): PretextRichInlineResult {
	const [fontsReady, setFontsReady] = useState(false);
	const preparedRef = useRef<PreparedRichInline | null>(null);
	const prevItemsKey = useRef("");

	useEffect(() => {
		document.fonts.ready.then(() => setFontsReady(true));
	}, []);

	// Serialize items for cache key
	const itemsKey = items
		.map((i) => `${i.text}│${i.font}│${i.break ?? ""}│${i.extraWidth ?? 0}`)
		.join("║");

	return useMemo(() => {
		if (!fontsReady || items.length === 0 || maxWidth <= 0) {
			return { lines: [], isReady: false };
		}

		// Re-prepare only when items change
		if (itemsKey !== prevItemsKey.current || !preparedRef.current) {
			prevItemsKey.current = itemsKey;
			preparedRef.current = prepareRichInline(items);
		}

		const prepared = preparedRef.current;
		const materializedLines: RichInlineLine[] = [];

		walkRichInlineLineRanges(prepared, maxWidth, (range) => {
			const line = materializeRichInlineLineRange(prepared, range);
			materializedLines.push({
				fragments: line.fragments.map((f: RichInlineFragment) => ({
					itemIndex: f.itemIndex,
					text: f.text,
					gapBefore: f.gapBefore,
					occupiedWidth: f.occupiedWidth,
					item: items[f.itemIndex]!,
				})),
				width: line.width,
			});
		});

		return { lines: materializedLines, isReady: true };
	}, [fontsReady, items, maxWidth, itemsKey]);
}
