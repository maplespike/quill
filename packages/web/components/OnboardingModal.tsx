"use client";

import { useState } from "react";
import { useCivicStore, type ViewTab } from "../lib/store";

const STEPS = [
	{
		title: "CivicIntel watches Canadian government",
		body: "Trace money, lobbying, and connections across federal contracts, political donations, ethics disclosures, and international development.",
		icon: "🏛️",
	},
	{
		title: "Signals are detected connections",
		body: "The system automatically detects 7 types of intelligence signals — procurement-lobbying overlap, revolving doors, spousal interests, and more. Each signal is scored by confidence and linked to primary sources.",
		icon: "⚡",
	},
	{
		title: "Explore the evidence",
		body: "Every signal links to real government data. Click any entity to see its full connection profile. Navigate between Monitor, Brief, Explorer, and Signals views to follow the story.",
		icon: "🔍",
	},
];

export function OnboardingModal({ onComplete }: { onComplete: () => void }) {
	const [step, setStep] = useState(0);
	const { navigateTo } = useCivicStore();
	const current = STEPS[step];
	const isLast = step === STEPS.length - 1;

	const handleNext = () => {
		if (isLast) {
			localStorage.setItem("civicintel-onboarded", "1");
			onComplete();
		} else {
			setStep(step + 1);
		}
	};

	const handleSkip = () => {
		localStorage.setItem("civicintel-onboarded", "1");
		onComplete();
	};

	return (
		<div className="onboarding-overlay" onClick={handleSkip}>
			<div className="onboarding-card" onClick={(e) => e.stopPropagation()}>
				{/* Progress dots */}
				<div className="flex items-center justify-center gap-2 mb-6">
					{STEPS.map((_, i) => (
						<div
							key={i}
							className={
								"w-2 h-2 rounded-full transition-colors " +
								(i === step
									? "bg-[var(--primary)]"
									: i < step
										? "bg-[var(--muted)]"
										: "bg-[var(--border)]")
							}
						/>
					))}
				</div>

				{/* Icon */}
				<div className="text-4xl text-center mb-4">{current.icon}</div>

				{/* Content */}
				<h2 className="text-lg font-semibold text-[var(--foreground)] text-center mb-3">
					{current.title}
				</h2>
				<p className="text-sm text-[var(--muted)] text-center leading-relaxed mb-6">
					{current.body}
				</p>

				{/* Actions */}
				<div className="flex items-center justify-between">
					<button
						onClick={handleSkip}
						className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
					>
						Skip tour
					</button>
					<button
						onClick={handleNext}
						className="px-4 py-2 text-sm rounded-lg bg-[var(--primary)] text-white hover:brightness-110 transition-all"
					>
						{isLast ? "Start Exploring" : "Next →"}
					</button>
				</div>
			</div>
		</div>
	);
}

export function hasCompletedOnboarding(): boolean {
	if (typeof window === "undefined") return false;
	return localStorage.getItem("civicintel-onboarded") === "1";
}
