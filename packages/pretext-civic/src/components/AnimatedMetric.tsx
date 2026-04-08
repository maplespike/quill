import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAnimatedCounter } from "../hooks/useAnimatedCounter";
import { defaultTheme } from "../theme/dark";

export interface AnimatedMetricProps {
	/** Target numeric value */
	value: number;
	/** Previous value to animate from (defaults to 0 on first render) */
	previousValue?: number;
	/** Display format */
	format: "currency" | "percent" | "number";
	/** Optional label rendered above the number */
	label?: string;
	/** Animation duration in ms */
	duration?: number;
}

/** Format a number into the requested display string. */
function formatValue(n: number, format: AnimatedMetricProps["format"]): string {
	switch (format) {
		case "currency": {
			if (Math.abs(n) >= 1_000_000_000)
				return `$${(n / 1_000_000_000).toFixed(1)}B`;
			if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
			if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
			return `$${n.toFixed(0)}`;
		}
		case "percent":
			return `${n.toFixed(1)}%`;
		case "number": {
			if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
			if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
			return n.toFixed(0);
		}
	}
}

export function AnimatedMetric({
	value,
	previousValue,
	format,
	label,
	duration = 700,
}: AnimatedMetricProps) {
	const { value: animatedValue, isAnimating } = useAnimatedCounter(
		value,
		duration,
	);
	const display = formatValue(animatedValue, format);

	const containerStyle: React.CSSProperties = {
		display: "inline-flex",
		flexDirection: "column",
		alignItems: "flex-start",
		gap: 4,
		fontFamily: defaultTheme.fonts.sans,
	};

	const numberStyle: React.CSSProperties = {
		fontSize: 32,
		fontWeight: 700,
		color: defaultTheme.colors.text,
		fontVariantNumeric: "tabular-nums",
		letterSpacing: "-0.02em",
		lineHeight: 1,
		transition: "width 0.3s ease",
	};

	const labelStyle: React.CSSProperties = {
		fontSize: 12,
		fontWeight: 500,
		color: defaultTheme.colors.textMuted,
		textTransform: "uppercase" as const,
		letterSpacing: "0.08em",
	};

	return (
		<motion.div
			style={containerStyle}
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.35, ease: "easeOut" }}
		>
			{label && <span style={labelStyle}>{label}</span>}
			<motion.span
				style={numberStyle}
				key={value}
				initial={{ opacity: 0.5, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.25 }}
			>
				{display}
			</motion.span>
			{isAnimating && (
				<motion.div
					style={{
						height: 2,
						background: defaultTheme.colors.cyan,
						borderRadius: 1,
					}}
					initial={{ width: 0 }}
					animate={{ width: "100%" }}
					transition={{ duration: duration / 1000, ease: "easeOut" }}
				/>
			)}
		</motion.div>
	);
}
