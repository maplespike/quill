/**
 * AdaptiveHeadline — Auto-sizing headline that fills available space.
 *
 * Binary-searches for the largest font size that fits without
 * word-breaking. The result: headlines that perfectly fill their
 * container regardless of content length.
 *
 * This is the typography detail that separates professional from amateur.
 */

import { motion } from "motion/react";
import { useAdaptiveHeadline } from "../hooks/useAdaptiveHeadline";

export interface AdaptiveHeadlineProps {
	/** Headline text */
	text: string;
	/** Font family string, e.g. 'Georgia, serif' */
	fontFamily: string;
	/** Maximum width in px */
	maxWidth: number;
	/** Maximum height in px */
	maxHeight: number;
	/** Maximum font size (default 92) */
	maxSize?: number;
	/** Font weight (default 700) */
	weight?: number;
	/** Text color */
	color?: string;
	/** Glow effect color (CSS text-shadow) */
	glowColor?: string;
	/** Additional CSS class */
	className?: string;
	/** Additional CSS styles */
	style?: React.CSSProperties;
	/** Animate headline entrance */
	animate?: boolean;
}

export function AdaptiveHeadline({
	text,
	fontFamily,
	maxWidth,
	maxHeight,
	maxSize,
	weight,
	color = "inherit",
	glowColor,
	className,
	style,
	animate = true,
}: AdaptiveHeadlineProps) {
	const { font, lineHeight, lines, height, isReady, fontSize } =
		useAdaptiveHeadline(text, fontFamily, maxWidth, maxHeight, maxSize, weight);

	if (!isReady || lines.length === 0) return null;

	const containerStyle: React.CSSProperties = {
		position: "relative",
		height,
		width: "100%",
		textRendering: "optimizeLegibility",
		WebkitFontSmoothing: "antialiased",
		textShadow: glowColor
			? `0 0 40px ${glowColor}, 0 0 80px ${glowColor}`
			: undefined,
		...style,
	};

	return (
		<motion.div
			className={className}
			style={containerStyle}
			initial={animate ? { opacity: 0 } : undefined}
			animate={animate ? { opacity: 1 } : undefined}
			transition={{ duration: 0.6, ease: "easeOut" }}
		>
			{lines.map((line, i) => (
				<motion.span
					key={`hl-${i}`}
					style={{
						position: "absolute",
						left: line.x,
						top: line.y,
						font,
						lineHeight: `${lineHeight}px`,
						color,
						whiteSpace: "nowrap",
					}}
					initial={
						animate
							? {
									opacity: 0,
									x: -10,
									clipPath: "inset(0 100% 0 0)",
								}
							: undefined
					}
					animate={
						animate
							? {
									opacity: 1,
									x: 0,
									clipPath: "inset(0 0% 0 0)",
								}
							: undefined
					}
					transition={{
						duration: 0.5,
						delay: 0.1 + i * 0.08,
						ease: [0.25, 0.46, 0.45, 0.94],
					}}
				>
					{line.text}
				</motion.span>
			))}
		</motion.div>
	);
}
