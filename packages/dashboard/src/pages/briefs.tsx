import { useEffect, useState } from 'react'
import { getBriefs, Brief } from '../lib/api'

export default function BriefsPage() {
  const [briefs, setBriefs] = useState<Brief[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Brief | null>(null)

  useEffect(() => {
    getBriefs().then(res => {
      if (res.success && res.data?.briefs) {
        setBriefs(res.data.briefs)
        if (res.data.briefs.length > 0) setSelected(res.data.briefs[0])
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="page"><div className="shimmer" style={{ height: 400 }} /></div>

  const brief = selected || briefs[0]

  return (
    <div className="page">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 24 }}>Intelligence Briefs</h1>

      {briefs.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {briefs.map(b => (
            <button key={b.id} onClick={() => setSelected(b)} style={{
              padding: '8px 16px', fontSize: '0.8rem',
              background: selected?.id === b.id ? 'var(--accent)' : 'var(--bg-elevated)',
              color: selected?.id === b.id ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {b.title?.slice(0, 40)}...
            </button>
          ))}
        </div>
      )}

      {brief ? (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{brief.title}</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Generated {new Date(brief.generatedAt).toLocaleString()}
              </p>
            </div>
            <span style={{
              padding: '4px 12px', borderRadius: 99, fontSize: '0.78rem',
              background: brief.confidence > 0.7 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              color: brief.confidence > 0.7 ? 'var(--success)' : 'var(--warning)',
            }}>
              {(brief.confidence * 100).toFixed(0)}% confidence
            </span>
          </div>

          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
            {brief.summary}
          </p>

          {brief.sections?.map((section, i) => (
            <div key={i} style={{
              padding: '16px 20px', marginBottom: 12,
              background: 'var(--bg-elevated)', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 8 }}>
                {section.title}
              </h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {section.content}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>📋</div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
            No Briefs Available
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
            Intelligence briefs are generated automatically once the engine pipeline processes committee transcripts, lobbying records, and procurement data. Run the pipeline to produce your first brief.
          </p>
        </div>
      )}
    </div>
  )
}
