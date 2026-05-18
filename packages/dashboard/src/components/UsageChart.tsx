import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const data = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 3, 18 + i)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return {
    date: `${mm}/${dd}`,
    calls: Math.floor(Math.random() * 61) + 20,
  }
})

export default function UsageChart() {
  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>
        Usage Trend (30 days)
      </h2>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="cyanFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: '0.82rem',
              color: 'var(--text-primary)',
            }}
            labelStyle={{ color: 'var(--text-muted)' }}
          />
          <Area
            type="monotone"
            dataKey="calls"
            stroke="#06b6d4"
            strokeWidth={2}
            fill="url(#cyanFill)"
            dot={false}
            activeDot={{ r: 4, fill: '#06b6d4', stroke: 'var(--bg-card)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: 8 }}>
        Last 30 days · API call volume
      </p>
    </div>
  )
}
