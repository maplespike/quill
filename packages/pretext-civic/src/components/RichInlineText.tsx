/**
 * RichInlineText — Inline text with styled entity chips.
 *
 * Entity names, dollar amounts, and signal tags flow inline with
 * narrative text. Chips are atomic (never break mid-chip).
 * Uses @chenglou/pretext/rich-inline for layout.
 *
 * This is how you render:
 *   "Contract awarded to [L3Harris] for [$45M] during active lobbying"
 * where bracketed items are styled pills.
 */

import { motion } from "motion/react";
import {
	type CivicRichItem,
	usePretextRichInline,
} from "../hooks/usePretextRichInline";

export interface RichInlineTextProps {
	/** Rich items with text, font, and optional chip styling */
	items: CivicRichItem[];
	/** Maximum line width */
	maxWidth: number;
	/** Additional CSS class */
	className?: string;
	/** Additional CSS styles */
	style?: React.CSSProperties;
	/** Line height (default 24) */
	lineHeight?: number;
	/** Animate line entrance */
	animate?: boolean;
	/** Gap between lines */
	lineGap?: number;
}

export function RichInlineText({
	items,
	maxWidth,
	className,
	style,
	lineHeight = 24,
	animate = true,
	lineGap = 0,
}: RichInlineTextProps) {
	const { lines, isReady } = usePretextRichInline(items, maxWidth);

	if (!isReady || lines.length === 0) return null;

	const totalHeight = lines.length * (lineHeight + lineGap);

	const containerStyle: React.CSSProperties = {
		position: "relative",
		height: totalHeight,
		width: "100%",
		userSelect: "text",
		...style,
	};

	return (
		<div className={className} style={containerStyle}>
			{lines.map((line, lineIndex) => (
				<motion.div
					key={`rich-line-${lineIndex}`}
					style={{
						position: "absolute",
						top: lineIndex * (lineHeight + lineGap),
						left: 0,
						height: lineHeight,
						display: "flex",
						alignItems: "baseline",
						flexWrap: "nowrap",
					}}
					initial={animate ? { opacity: 0, y: 3 } : undefined}
					animate={animate ? { opacity: 1, y: 0 } : undefined}
					transition={{
						duration: 0.2,
						delay: lineIndex * 0.03,
						ease: "easeOut",
					}}
				>
					{line.fragments.map((frag, fragIndex) => {
						const item = frag.item;
						const isChip = item.background || item.borderColor;

						const fragStyle: React.CSSProperties = isChip
							? {
									display: "inline-flex",
									alignItems: "center",
									padding: `1px ${item.paddingX ?? 6}px`,
									borderRadius: item.borderRadius ?? 4,
									background: item.background ?? "transparent",
									border: item.borderColor
										? `1px solid ${item.borderColor}`
										: undefined,
									color: item.color ?? "inherit",
									font: item.font,
									whiteSpace: "nowrap",
									flexShrink: 0,
								}
							: {
									color: item.color ?? "inherit",
									font: item.font,
								};

						// Add gap before fragment if needed
						const gapStyle: React.CSSProperties =
							frag.gapBefore > 0 ? { marginLeft: frag.gapBefore } : {};

						return (
							<span
								key={`frag-${lineIndex}-${fragIndex}`}
								style={{ ...fragStyle, ...gapStyle }}
							>
								{frag.text}
							</span>
						);
					})}
				</motion.div>
			))}
		</div>
	);
}
