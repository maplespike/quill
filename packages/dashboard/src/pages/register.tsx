import { useState, FormEvent } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { setToken } from '../lib/auth'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://dev-maplespike-api.lan/v1'

export default function Register() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!email.trim() || !name.trim()) {
      setError('Email and name are required')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        setError(json.error?.message || json.message || 'Registration failed')
        return
      }

      const token = json.data?.apiKey || json.data?.token || json.apiKey || json.token
      if (token) {
        setToken(token)
      }
      router.push('/account')
    } catch {
      setError('Network error — API unreachable')
    } finally {
      setLoading(false)
    }
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
            Get Your API Key
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 8 }}>
            Register to access Canada&apos;s sovereign data pipeline
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            placeholder="Email address"
            autoFocus
            style={inputStyle}
          />
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            placeholder="Your name"
            style={inputStyle}
          />
          {error && (
            <p style={{ fontSize: '0.82rem', color: 'var(--accent)', margin: 0 }}>{error}</p>
          )}
          <button type="submit" disabled={loading} style={{
            ...buttonStyle,
            opacity: loading ? 0.6 : 1,
          }}>
            {loading ? 'Registering...' : 'Get API Key'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Already have an API key?{' '}
            <Link href="/login" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>
              Sign in
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
