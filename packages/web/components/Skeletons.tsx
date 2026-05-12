"use client";

/**
 * Skeleton loaders for each view.
 * Shows animated placeholder while content loads.
 */
export function MonitorSkeleton() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 h-full">
			{/* Left panel skeleton */}
			<div className="md:col-span-3 flex flex-col gap-3">
				<div className="p-4">
					<div className="skeleton h-3 w-24 mb-4" />
					{[16, 20, 14, 18, 16].map((h, i) => (
						<div key={i} className="skeleton h-10 w-full mb-2" />
					))}
				</div>
			</div>
			{/* Center skeleton */}
			<div className="md:col-span-6 flex flex-col gap-3">
				<div className="grid grid-cols-4 gap-2">
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className="skeleton h-16 rounded-lg" />
					))}
				</div>
				<div className="skeleton h-32 rounded-lg" />
				<div className="skeleton h-24 rounded-lg" />
			</div>
			{/* Right panel skeleton */}
			<div className="md:col-span-3 flex flex-col gap-3">
				<div className="p-4">
					<div className="skeleton h-3 w-20 mb-4" />
					{[12, 16, 14, 12].map((h, i) => (
						<div key={i} className="skeleton h-8 w-full mb-2" />
					))}
				</div>
			</div>
		</div>
	);
}

export function BriefSkeleton() {
	return (
		<div className="max-w-3xl mx-auto p-8 space-y-4">
			<div className="skeleton h-8 w-3/4" />
			<div className="skeleton h-4 w-full" />
			<div className="skeleton h-4 w-5/6" />
			<div className="skeleton h-48 w-full rounded-lg" />
			<div className="skeleton h-4 w-full" />
			<div className="skeleton h-4 w-4/5" />
		</div>
	);
}

export function ExplorerSkeleton() {
	return (
		<div className="flex h-full">
			<div className="w-56 border-r border-[var(--border)] p-4 space-y-3">
				<div className="skeleton h-3 w-20" />
				<div className="skeleton h-8 w-full" />
				<div className="skeleton h-8 w-full" />
			</div>
			<div className="flex-1 flex items-center justify-center">
				<div className="skeleton h-64 w-64 rounded-full" />
			</div>
		</div>
	);
}

export function SignalsSkeleton() {
	return (
		<div className="flex h-full">
			<div className="w-56 border-r border-[var(--border)] p-4 space-y-3">
				<div className="skeleton h-3 w-16" />
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="skeleton h-7 w-full" />
				))}
			</div>
			<div className="flex-1 p-4 space-y-3">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="skeleton h-20 w-full rounded-lg" />
				))}
			</div>
		</div>
	);
}

export function GenericSkeleton() {
	return (
		<div className="p-8 space-y-4">
			<div className="skeleton h-6 w-48" />
			<div className="skeleton h-4 w-full" />
			<div className="skeleton h-4 w-3/4" />
			<div className="skeleton h-32 w-full rounded-lg" />
		</div>
	);
}
