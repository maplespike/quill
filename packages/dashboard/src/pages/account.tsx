import { useEffect, useState } from 'react'
import { getHealth, getUsage, listKeys, createKey, deleteKey, HealthData, ApiKey } from '../lib/api'
import StatCard from '../components/StatCard'

export default function Account() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [usage, setUsage] = useState<{ daily: number; monthly: number } | null>(null)
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState('')
  const [msg, setMsg] = useState('')

  function loadData() {
    setLoading(true)
    Promise.all([getHealth(), getUsage(), listKeys()]).then(([h, u, k]) => {
      if (h.success && h.data) setHealth(h.data)
      if (u.success && u.data) setUsage(u.data)
      if (k.success && Array.isArray(k.data)) setKeys(k.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(loadData, [])

  async function handleCreateKey() {
    if (!newKeyName.trim()) return
    setMsg('')
    const res = await createKey(newKeyName)
    if (res.success) {
      setNewKeyName('')
      setMsg('Key created!')
      loadData()
    } else {
      setMsg(res.error?.message || 'Failed')
    }
  }

  async function handleDeleteKey(id: string) {
    await deleteKey(id)
    loadData()
  }

  if (loading) return <div className="page"><div className="shimmer" style={{ height: 300 }} /></div>

  return (
    <div className="page">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 24 }}>Account & API Keys</h1>

      <div className="stats-row">
        <StatCard label="Your Tier" value={health?.tenant?.tier || 'free'} icon="🔑" />
        <StatCard label="Daily Calls" value={usage?.daily ?? 0} icon="📞" accent="#06b6d4" />
        <StatCard label="Monthly" value={usage?.monthly ?? 0} icon="📊" accent="#10b981" />
        <StatCard label="Account" value={health?.tenant?.name || 'Anonymous'} icon="👤" />
      </div>

      {health?.tenant?.tier === 'free' && (
        <div className="card" style={{ marginBottom: 24, borderColor: 'var(--accent-cyan)' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Free tier: {usage?.monthly || 0}/1000 monthly calls used.
            <a href="/pricing" style={{ marginLeft: 8, color: 'var(--accent-cyan)' }}>Upgrade →</a>
          </p>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Create API Key</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateKey()}
            placeholder="e.g. my-app-key"
            style={{
              flex: 1, padding: '12px 16px', fontSize: '0.9rem',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', color: 'var(--text-primary)',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button onClick={handleCreateKey} style={{
            padding: '12px 24px', background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
            fontWeight: 600, fontFamily: 'inherit',
          }}>
            Create Key
          </button>
        </div>
        {msg && <p style={{ marginTop: 8, fontSize: '0.82rem', color: msg.includes('!') ? 'var(--success)' : 'var(--accent)' }}>{msg}</p>}
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Active API Keys ({keys.length})</h2>
        {keys.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No API keys yet. Create one above.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {keys.map(key => (
              <div key={key.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius)', border: '1px solid var(--border)',
              }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{key.name}</div>
                  <code style={{ fontSize: '0.78rem' }}>{key.keyPrefix}...</code>
                  <span style={{ marginLeft: 12, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Created {new Date(key.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <button onClick={() => handleDeleteKey(key.id)} style={{
                  padding: '6px 14px', fontSize: '0.78rem',
                  background: 'transparent', color: 'var(--accent)',
                  border: '1px solid var(--accent)', borderRadius: 'var(--radius)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
