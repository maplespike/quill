export default function HomePage() {
	return (
		<main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
			<h1 className="text-4xl font-bold tracking-tight">
				CivicIntel
				<span className="ml-2 text-[var(--muted)] text-2xl font-normal">
					— Systems Intelligence
				</span>
			</h1>
			<p className="max-w-xl text-center text-[var(--muted)] leading-relaxed">
				Observability for Canadian government: procurement, lobbying, donations,
				and the relationships between them.
			</p>
			<div className="mt-8 grid grid-cols-3 gap-4 text-sm">
				{["Contracts", "Lobbying", "Donations"].map((label) => (
					<div
						key={label}
						className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-6 py-4 text-center"
					>
						<span className="text-[var(--muted)]">{label}</span>
					</div>
				))}
			</div>
		</main>
	);
}
