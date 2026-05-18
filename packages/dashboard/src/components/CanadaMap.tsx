const coverage: Record<string, { name: string; modules: number }> = {
  ON: { name: 'Ontario', modules: 62 },
  BC: { name: 'British Columbia', modules: 45 },
  AB: { name: 'Alberta', modules: 38 },
  QC: { name: 'Québec', modules: 52 },
  SK: { name: 'Saskatchewan', modules: 18 },
  MB: { name: 'Manitoba', modules: 22 },
  NS: { name: 'Nova Scotia', modules: 25 },
  NB: { name: 'New Brunswick', modules: 15 },
  NL: { name: 'Newfoundland & Labrador', modules: 12 },
  PE: { name: 'Prince Edward Island', modules: 8 },
  YT: { name: 'Yukon', modules: 14 },
  NT: { name: 'Northwest Territories', modules: 10 },
  NU: { name: 'Nunavut', modules: 6 },
}

function getColor(modules: number): string {
  if (modules >= 60) return '#10b981'
  if (modules >= 30) return '#06b6d4'
  if (modules >= 1) return '#f59e0b'
  return '#64748b'
}

function getOpacity(modules: number): number {
  if (modules >= 60) return 1
  if (modules >= 30) return 0.9
  return 0.8
}

const provincePaths: Record<string, string> = {
  YT: 'M20,18 L105,15 L115,130 L12,120 Z',
  NT: 'M118,18 L230,15 L248,115 L115,130 Z',
  NU: 'M233,14 L440,10 L458,68 L448,128 L325,125 L248,118 Z',
  BC: 'M10,125 L115,130 L128,250 L12,240 Z',
  AB: 'M118,130 L200,130 L212,250 L130,252 Z',
  SK: 'M204,130 L275,132 L282,252 L214,252 Z',
  MB: 'M279,132 L352,138 L362,255 L284,254 Z',
  ON: 'M356,138 L438,132 L452,282 L364,284 Z',
  QC: 'M442,132 L542,128 L558,284 L454,286 Z',
  NB: 'M545,205 L582,202 L594,268 L550,272 Z',
  NS: 'M542,274 L596,278 L600,332 L535,328 Z',
  PE: 'M565,248 L583,246 L587,258 L567,262 Z',
  NL: 'M540,128 L596,130 L600,198 L548,200 Z M555,205 L588,208 L585,240 L556,237 Z',
}

export default function CanadaMap() {
  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>
          Province Data Coverage
        </h2>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {Object.values(coverage).filter((c) => c.modules > 0).length} / 13 active
        </span>
      </div>

      <svg
        viewBox="0 0 610 350"
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="Canada map showing province data coverage"
      >
        <style>{`
          .province {
            transition: opacity 0.2s, filter 0.2s;
            cursor: pointer;
          }
          .province:hover {
            opacity: 1 !important;
            filter: brightness(1.2) drop-shadow(0 0 4px rgba(255,255,255,0.15));
          }
        `}</style>

        {Object.entries(provincePaths).map(([code, d]) => {
          const data = coverage[code]
          return (
            <path
              key={code}
              className="province"
              d={d}
              fill={getColor(data.modules)}
              opacity={getOpacity(data.modules)}
              stroke="var(--bg-card)"
              strokeWidth={1.5}
              strokeLinejoin="round"
            >
              <title>
                {data.name} — {data.modules} data module{data.modules !== 1 ? 's' : ''}
              </title>
            </path>
          )
        })}
      </svg>

      <div
        style={{
          display: 'flex',
          gap: 20,
          marginTop: 12,
          flexWrap: 'wrap',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}
      >
        <LegendItem color="#10b981" label="High (60+)" />
        <LegendItem color="#06b6d4" label="Medium (30–59)" />
        <LegendItem color="#f59e0b" label="Low (1–29)" />
        <LegendItem color="#64748b" label="None" />
      </div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      <span>{label}</span>
    </div>
  )
}
