/**
 * useURLSync — Synchronize navigation state with URL
 *
 * Enables deep linking: /?view=explore&entity=person-123&thread=thread-456
 */
import { useEffect, useRef } from "react";
import { useCivicStore, type ViewTab } from "./store";

interface URLParams {
	view?: string;
	entity?: string;
	thread?: string;
}

export function useURLSync() {
	const { activeView, focusEntity, focusThread, navigateTo } = useCivicStore();
	const initialized = useRef(false);

	// Restore from URL on mount
	useEffect(() => {
		if (initialized.current) return;
		initialized.current = true;

		const params = new URLSearchParams(window.location.search);
		const view = params.get("view") as ViewTab | null;
		const entity = params.get("entity");
		const thread = params.get("thread");

		if (view || entity || thread) {
			navigateTo({
				view: view || "monitor",
				focusEntity: entity,
				focusThread: thread,
			});
		}
	}, [navigateTo]);

	// Update URL when state changes
	useEffect(() => {
		const params = new URLSearchParams();
		if (activeView !== "monitor") params.set("view", activeView);
		if (focusEntity) params.set("entity", focusEntity);
		if (focusThread) params.set("thread", focusThread);

		const queryString = params.toString();
		const newURL = queryString
			? `${window.location.pathname}?${queryString}`
			: window.location.pathname;

		window.history.replaceState({}, "", newURL);
	}, [activeView, focusEntity, focusThread]);
}

// Helper to generate shareable URL
export function getShareableURL(options: {
	view?: ViewTab;
	entity?: string;
	thread?: string;
}): string {
	const params = new URLSearchParams();
	if (options.view) params.set("view", options.view);
	if (options.entity) params.set("entity", options.entity);
	if (options.thread) params.set("thread", options.thread);

	const base = window.location.origin + window.location.pathname;
	return params.toString() ? `${base}?${params.toString()}` : base;
}
