import { useState } from 'react'
import { searchGov, GovSearchResult } from '../lib/api'

const suggestions = [
  'housing', 'AI regulation', 'in-camera', 'lobbying',
  'ethics', 'catherine tait', 'brookfield', 'carbon tax',
]

export default function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GovSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function doSearch(q: string) {
    const term = q || query
    if (!term.trim()) return
    setLoading(true)
    setError('')
    const res = await searchGov(term)
    if (res.success && res.data) {
      setResults(res.data)
    } else {
      setError(res.error?.message || 'Search failed')
    }
    setLoading(false)
  }

  return (
    <div className="page">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 24 }}>Government Data Search</h1>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch(query)}
            placeholder="Search committees, people, companies, datasets..."
            style={{
              flex: 1, padding: '14px 18px', fontSize: '0.95rem',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', color: 'var(--text-primary)',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button onClick={() => doSearch(query)} disabled={loading} style={{
            padding: '14px 28px', background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.9rem', opacity: loading ? 0.7 : 1,
          }}>
            {loading ? '...' : 'Search'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {suggestions.map(s => (
            <button key={s} onClick={() => { setQuery(s); doSearch(s) }} style={{
              padding: '6px 16px', fontSize: '0.8rem',
              background: 'rgba(6,182,212,0.1)', color: 'var(--accent-cyan)',
              border: '1px solid rgba(6,182,212,0.2)', borderRadius: 99,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--accent)', marginBottom: 16 }}>
        <p style={{ color: 'var(--accent)' }}>{error}</p>
      </div>}

      {!results && !loading && !error && (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
            Enter a search term to query government data across committees, people, companies, and datasets.
          </p>
        </div>
      )}

      {results && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Results for &quot;{results.query}&quot;</h2>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {results.totalCount} found
            </span>
          </div>

          {results.results.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              No results found for your query. Try a different search term or browse the overview page.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.results.slice(0, 20).map((r, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius)', border: '1px solid transparent',
                  transition: 'all 0.15s',
                }}>
                  <span style={{
                    fontSize: '0.72rem', color: 'var(--accent-cyan)',
                    fontWeight: 600, minWidth: 80,
                  }}>
                    {r.source || 'Gov'}
                  </span>
                  <span style={{ flex: 1, fontSize: '0.88rem' }}>
                    {r.title}
                  </span>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '1.1rem' }}>
                      ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
