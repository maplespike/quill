import { useState, FormEvent } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { setToken } from '../lib/auth'

export default function Login() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!value.trim()) {
      setError('Please enter an API key or token')
      return
    }
    setLoading(true)
    setToken(value.trim())
    router.push('/')
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.02em' }}>
              MAPLESPIKE
            </div>
          </Link>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 600, marginTop: 24, color: 'var(--text-primary)' }}>
            Sign In
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 8 }}>
            Enter your API key or JWT token to access the dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            type="text"
            value={value}
            onChange={e => { setValue(e.target.value); setError('') }}
            placeholder="Paste your API key or JWT token"
            autoFocus
            style={inputStyle}
          />
          {error && (
            <p style={{ fontSize: '0.82rem', color: 'var(--accent)', margin: 0 }}>{error}</p>
          )}
          <button type="submit" disabled={loading} style={{
            ...buttonStyle,
            opacity: loading ? 0.6 : 1,
          }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Don&apos;t have an API key?{' '}
            <Link href="/register" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>
              Get one here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  minHeight: '100vh', padding: 24,
  background: 'var(--bg-primary)',
}

const cardStyle: React.CSSProperties = {
  width: '100%', maxWidth: 420,
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)', padding: '40px 36px',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '14px 16px', fontSize: '0.9rem',
  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', color: 'var(--text-primary)',
  outline: 'none', fontFamily: 'inherit',
}

const buttonStyle: React.CSSProperties = {
  width: '100%', padding: '14px 24px', fontSize: '0.9rem',
  background: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
  fontWeight: 600, fontFamily: 'inherit',
}
