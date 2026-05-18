import Link from 'next/link'
import { useRouter } from 'next/router'
import { isAuthenticated, clearToken } from '../lib/auth'

const NO_NAV_PATHS = ['/login', '/register']

export default function Nav() {
  const router = useRouter()

  if (NO_NAV_PATHS.includes(router.pathname)) {
    return null
  }

  const authed = isAuthenticated()

  function handleLogout() {
    clearToken()
    router.push('/login')
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)',
      padding: '0 24px', height: 48, display: 'flex', alignItems: 'center', gap: 24,
      fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem',
    }}>
      <Link href="/" style={{ fontWeight: 800, color: 'var(--accent)', textDecoration: 'none' }}>
        MAPLESPIKE
      </Link>
      <div style={{ display: 'flex', gap: 16, flex: 1 }}>
        <Link href="/" style={linkStyle}>OVERVIEW</Link>
        <Link href="/search" style={linkStyle}>SEARCH</Link>
        <Link href="/briefs" style={linkStyle}>BRIEFS</Link>
        <Link href="/signals" style={linkStyle}>SIGNALS</Link>
      </div>
      {authed ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/account" style={linkStyle}>ACCOUNT</Link>
          <button onClick={handleLogout} style={{
            color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '4px 10px', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '0.78rem', transition: 'color 0.2s',
          }}>
            Logout
          </button>
        </div>
      ) : (
        <Link href="/login" style={linkStyle}>LOGIN</Link>
      )}
    </nav>
  )
}

const linkStyle: React.CSSProperties = {
  color: 'var(--text-secondary)', textDecoration: 'none',
  transition: 'color 0.2s', fontSize: '0.82rem', letterSpacing: '0.02em',
}
