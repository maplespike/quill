import { useEffect, useState } from 'react'
import { getSignals, IntelligenceThread } from '../lib/api'
import SignalsChart from '../components/SignalsChart'

const signalTypeLabels: Record<string, string> = {
  procurement_lobbying_overlap: 'Procurement-Lobbying Overlap',
  revolving_door: 'Revolving Door',
  spousal_interest_proximity: 'Spousal Interest Proximity',
  sole_source_heavy_lobbying: 'Sole-Source Heavy Lobbying',
  donation_proximity_correlation: 'Donation-Proximity Correlation',
  mandate_divergence: 'Mandate Divergence',
  international_layering: 'International Layering',
}

function signalColor(signalType: string): string {
  const colors: Record<string, string> = {
    procurement_lobbying_overlap: '#e84545',
    revolving_door: '#f59e0b',
    spousal_interest_proximity: '#8b5cf6',
    sole_source_heavy_lobbying: '#ef4444',
    donation_proximity_correlation: '#10b981',
    mandate_divergence: '#06b6d4',
    international_layering: '#f97316',
  }
  return colors[signalType] || '#64748b'
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<IntelligenceThread[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<IntelligenceThread | null>(null)

  useEffect(() => {
    getSignals().then(res => {
      if (res.success && Array.isArray(res.data)) setSignals(res.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const types = [...new Set(signals.map(s => s.signalType))]
  const filtered = filter === 'all' ? signals : signals.filter(s => s.signalType === filter)

  if (loading) return <div className="page"><div className="shimmer" style={{ height: 300 }} /></div>

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Active Signals</h1>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {signals.length} total
        </span>
      </div>

      <SignalsChart signals={signals} onFilter={(type) => setFilter(type)} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('all')} style={filterBtnStyle(filter === 'all')}>
          All ({signals.length})
        </button>
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            style={{ ...filterBtnStyle(filter === t), borderLeft: `3px solid ${signalColor(t)}` }}>
            {signalTypeLabels[t] || t} ({signals.filter(s => s.signalType === t).length})
          </button>
        ))}
      </div>

      {selected ? (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{selected.title}</h2>
              <span style={{
                display: 'inline-block', marginTop: 8, padding: '4px 10px',
                borderRadius: 99, fontSize: '0.75rem',
                background: `${signalColor(selected.signalType)}22`,
                color: signalColor(selected.signalType),
              }}>
                {signalTypeLabels[selected.signalType] || selected.signalType}
              </span>
            </div>
            <button onClick={() => setSelected(null)} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: '1.2rem',
            }}>
              ✕
            </button>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
            {selected.description}
          </p>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', gap: 20 }}>
            <span>Confidence: {(selected.confidence * 100).toFixed(0)}%</span>
            <span>Sources: {selected.sources?.length || 0}</span>
            <span>Entities: {selected.nodes?.length || 0}</span>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔍</div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
            No Intelligence Signals
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
            The data pipeline has not generated any signals yet. Signals appear after the engine processes committee meetings, lobbying records, and procurement data.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.slice(0, 50).map(s => (
            <div key={s.id} onClick={() => setSelected(s)} style={{
              padding: '16px 20px', background: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: signalColor(s.signalType), display: 'inline-block',
                  }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{s.title}</span>
                </div>
                <span style={{
                  fontSize: '0.78rem', padding: '2px 8px', borderRadius: 99,
                  background: s.confidence > 0.7 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                  color: s.confidence > 0.7 ? 'var(--success)' : 'var(--warning)',
                }}>
                  {(s.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {s.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function filterBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 16px', fontSize: '0.78rem', fontFamily: 'inherit',
    background: active ? 'var(--accent)' : 'var(--bg-elevated)',
    color: active ? '#fff' : 'var(--text-secondary)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    cursor: 'pointer',
  }
}
