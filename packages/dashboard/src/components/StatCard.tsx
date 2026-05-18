interface StatCardProps {
  label: string
  value: string | number
  icon?: string
  accent?: string
}

export default function StatCard({ label, value, icon, accent }: StatCardProps) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '20px 24px',
      display: 'flex', flexDirection: 'column', gap: 4,
      borderTop: `3px solid ${accent || 'var(--accent)'}`,
    }}>
      {icon && <span style={{ fontSize: '1.4rem' }}>{icon}</span>}
      <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  )
}
