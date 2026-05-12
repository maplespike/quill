"use client";

import { useState } from "react";
import type { IntelligenceThread } from "../lib/data";
import { useCivicStore } from "../lib/store";
import { getShareableURL } from "../lib/useURLSync";

export function ShareModal({
	thread,
	onClose,
}: {
	thread: IntelligenceThread;
	onClose: () => void;
}) {
	const [copied, setCopied] = useState(false);
	const { navigateTo } = useCivicStore();

	const url = getShareableURL({ view: "brief", thread: thread.id });

	const handleCopy = async () => {
		await navigator.clipboard.writeText(url);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleOpenBrief = () => {
		navigateTo({ view: "brief", focusThread: thread.id });
		onClose();
	};

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center"
			onClick={onClose}
		>
			<div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
			<div
				className="relative w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl p-6"
				onClick={(e) => e.stopPropagation()}
			>
				<h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">
					Share Signal
				</h3>

				<div className="mb-4">
					<p className="text-xs text-[var(--muted)] mb-2">{thread.title}</p>
					<div className="flex items-center gap-2">
						<input
							readOnly
							value={url}
							className="flex-1 px-3 py-2 text-xs bg-[var(--background)] border border-[var(--border)] rounded text-[var(--foreground)]"
						/>
						<button
							onClick={handleCopy}
							className="px-3 py-2 text-xs rounded bg-[var(--primary)] text-white hover:brightness-110 transition-all flex-shrink-0"
						>
							{copied ? "Copied!" : "Copy"}
						</button>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<button
						onClick={handleOpenBrief}
						className="flex-1 px-3 py-2 text-xs rounded border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-colors"
					>
						Open in Brief View
					</button>
					<button
						onClick={onClose}
						className="px-3 py-2 text-xs rounded text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	);
}
