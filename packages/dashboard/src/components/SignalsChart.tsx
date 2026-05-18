import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { IntelligenceThread } from '../lib/api'

const SIGNAL_COLORS: Record<string, string> = {
  procurement_lobbying_overlap: '#e84545',
  revolving_door: '#f59e0b',
  spousal_interest_proximity: '#8b5cf6',
  sole_source_heavy_lobbying: '#ef4444',
  donation_proximity_correlation: '#10b981',
  mandate_divergence: '#06b6d4',
  international_layering: '#f97316',
}

const SIGNAL_LABELS: Record<string, string> = {
  procurement_lobbying_overlap: 'Procurement-Lobbying Overlap',
  revolving_door: 'Revolving Door',
  spousal_interest_proximity: 'Spousal Interest Proximity',
  sole_source_heavy_lobbying: 'Sole-Source Heavy Lobbying',
  donation_proximity_correlation: 'Donation-Proximity Correlation',
  mandate_divergence: 'Mandate Divergence',
  international_layering: 'International Layering',
}

interface ChartDatum {
  name: string
  type: string
  value: number
  color: string
}

interface SignalsChartProps {
  signals: IntelligenceThread[]
  onFilter: (type: string) => void
}

export default function SignalsChart({ signals, onFilter }: SignalsChartProps) {
  const counts: Record<string, number> = {}
  signals.forEach(s => {
    counts[s.signalType] = (counts[s.signalType] || 0) + 1
  })

  const data: ChartDatum[] = Object.entries(counts)
    .map(([type, value]) => ({
      name: SIGNAL_LABELS[type] || type,
      type,
      value,
      color: SIGNAL_COLORS[type] || '#64748b',
    }))
    .sort((a, b) => b.value - a.value)

  if (data.length === 0) return null

  return (
    <div className="card" style={{ marginBottom: 24, padding: '20px 24px' }}>
      <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 2 }}>
        Signal Breakdown
      </h2>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
        Click a slice to filter
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
          >
            {data.map(entry => (
              <Cell
                key={entry.type}
                fill={entry.color}
                onClick={() => onFilter(entry.type)}
                style={{ cursor: 'pointer' }}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', fontSize: '0.82rem', color: 'var(--text-primary)',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', justifyContent: 'center', marginTop: 8 }}>
        {data.map(d => (
          <div
            key={d.type}
            onClick={() => onFilter(d.type)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)' }}
          >
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, display: 'inline-block', flexShrink: 0 }} />
            <span>{d.name}</span>
            <span style={{ color: 'var(--text-muted)' }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
