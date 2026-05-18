import { useEffect, useState } from 'react'
import { getHealth, getUsage, HealthData } from '../lib/api'
import StatCard from '../components/StatCard'
import UsageChart from '../components/UsageChart'
import CanadaMap from '../components/CanadaMap'

export default function Overview() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [usage, setUsage] = useState<{ daily: number; monthly: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getHealth(), getUsage()]).then(([h, u]) => {
      if (h.success && h.data) setHealth(h.data)
      if (u.success && u.data) setUsage(u.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="page">{shimmerRow(4)}</div>

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Civic Pulse Overview</h1>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {health?.status === 'ok' ? 'System Healthy' : 'System Error'}
        </span>
      </div>

      <div className="stats-row">
        <StatCard label="Service" value={health?.service || '--'} icon="📡" />
        <StatCard label="Version" value={health?.version || '--'} icon="📦" />
        <StatCard label="Environment" value={health?.environment || '--'} icon="🌐" />
        <StatCard label="Tier" value={health?.tenant?.tier || 'free'} icon="🔑" />
      </div>

      <div className="stats-row">
        <StatCard label="Daily Calls" value={usage?.daily ?? 0} icon="📞" accent="#06b6d4" />
        <StatCard label="Monthly Calls" value={usage?.monthly ?? 0} icon="📊" accent="#10b981" />
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>API Usage</h2>
        {usage && (
          <div style={{ height: 40, background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', overflow: 'hidden', position: 'relative' }}>
            <div style={{
              height: '100%', width: `${Math.min((usage.daily / 1000) * 100, 100)}%`,
              background: 'var(--accent-cyan)', borderRadius: 'var(--radius)',
              transition: 'width 0.8s ease',
            }} />
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{usage?.daily || 0} / 1,000 daily</span>
          <span>{usage?.monthly || 0} monthly total</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
        <UsageChart />
        <CanadaMap />
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>Quick Links</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { href: '/search', label: 'Search Government Data', icon: '🔍' },
            { href: '/briefs', label: 'Daily Intelligence Brief', icon: '📋' },
            { href: '/signals', label: 'Active Signals', icon: '🔔' },
            { href: '/account', label: 'API Keys & Account', icon: '🔑' },
          ].map(link => (
            <a key={link.href} href={link.href} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 20px', background: 'var(--bg-elevated)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              textDecoration: 'none', color: 'var(--text-primary)',
              fontSize: '0.85rem', transition: 'all 0.2s',
            }}>
              <span>{link.icon}</span>
              <span>{link.label}</span>
              <span style={{ color: 'var(--text-muted)' }}>→</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

function shimmerRow(count: number) {
  return (
    <div className="stats-row">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="shimmer" style={{ height: 100 }} />
      ))}
    </div>
  )
}
