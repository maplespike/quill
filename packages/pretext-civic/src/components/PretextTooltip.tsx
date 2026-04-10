"use client";

/**
 * PretextTooltip — Auto-sizing tooltip that shrinkwraps to content.
 *
 * Uses `usePretextShrinkwrap` to find the tightest bounding box
 * for the tooltip text. No dead space, no overflow guessing.
 * Perfect width every time, zero DOM reflow.
 */

import { type ReactNode, useEffect, useRef, useState } from "react";
import {
	type ShrinkwrapResult,
	usePretextShrinkwrap,
} from "../hooks/usePretextShrinkwrap";

export interface PretextTooltipProps {
	/** Content to show in tooltip */
	text: string;
	/** Font shorthand for measurement (default: '12px Inter, system-ui, sans-serif') */
	font?: string;
	/** Line height (default: 18) */
	lineHeight?: number;
	/** Maximum width before wrapping (default: 280) */
	maxWidth?: number;
	/** Maximum lines before truncation (default: 5) */
	maxLines?: number;
	/** Delay before showing in ms (default: 300) */
	delay?: number;
	/** Children that trigger the tooltip */
	children: ReactNode;
	/** Additional CSS class for tooltip container */
	className?: string;
	/** Background color override */
	background?: string;
	/** Text color override */
	color?: string;
	/** Border color override */
	borderColor?: string;
	/** Side to prefer (default: 'top') */
	side?: "top" | "bottom" | "left" | "right";
}

export function PretextTooltip({
	text,
	font = "12px 'Space Grotesk', system-ui, sans-serif",
	lineHeight = 18,
	maxWidth = 280,
	maxLines = 5,
	delay = 300,
	children,
	className,
	background = "var(--card)",
	color = "var(--foreground)",
	borderColor = "var(--border)",
	side = "top",
}: PretextTooltipProps) {
	const [visible, setVisible] = useState(false);
	const [position, setPosition] = useState<{ x: number; y: number }>({
		x: 0,
		y: 0,
	});
	const triggerRef = useRef<HTMLDivElement>(null);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);

	const { width, height, isReady }: ShrinkwrapResult = usePretextShrinkwrap(
		text,
		font,
		lineHeight,
		maxWidth,
		maxLines,
	);

	const show = () => {
		timeoutRef.current = setTimeout(() => setVisible(true), delay);
	};
	const hide = () => {
		clearTimeout(timeoutRef.current);
		setVisible(false);
	};

	// Position the tooltip relative to trigger
	useEffect(() => {
		if (!visible || !triggerRef.current) return;
		const rect = triggerRef.current.getBoundingClientRect();
		let x = 0;
		let y = 0;

		if (side === "top") {
			x = rect.left + rect.width / 2 - width / 2;
			y = rect.top - height - 12;
		} else if (side === "bottom") {
			x = rect.left + rect.width / 2 - width / 2;
			y = rect.bottom + 12;
		} else if (side === "left") {
			x = rect.left - width - 12;
			y = rect.top + rect.height / 2 - height / 2;
		} else {
			x = rect.right + 12;
			y = rect.top + rect.height / 2 - height / 2;
		}

		// Clamp to viewport
		x = Math.max(8, Math.min(x, window.innerWidth - width - 8));
		y = Math.max(8, Math.min(y, window.innerHeight - height - 8));

		setPosition({ x, y });
	}, [visible, width, height, side]);

	// Clean up timeout on unmount
	useEffect(() => {
		return () => clearTimeout(timeoutRef.current);
	}, []);

	if (!text) return <>{children}</>;

	return (
		<div
			ref={triggerRef}
			onMouseEnter={show}
			onMouseLeave={hide}
			onFocus={show}
			onBlur={hide}
			className={`relative inline-flex ${className ?? ""}`}
		>
			{children}
			{visible && isReady && (
				<div
					role="tooltip"
					style={{
						position: "fixed",
						left: position.x,
						top: position.y,
						width: width + 16, // +padding
						padding: "8px",
						background,
						color,
						border: `1px solid ${borderColor}`,
						borderRadius: 6,
						font,
						lineHeight: `${lineHeight}px`,
						zIndex: 9999,
						pointerEvents: "none",
						boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
						whiteSpace: "pre-wrap",
						overflowWrap: "break-word",
					}}
				>
					{text}
				</div>
			)}
		</div>
	);
}
