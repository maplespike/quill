/**
 * Navigation Component
 *
 * Main navigation for the dashboard
 */

export default function Nav() {
  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        background: '#111827',
        borderBottom: '1px solid #374151',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <a
          href="/"
          style={{
            color: '#fff',
            fontSize: '20px',
            fontWeight: 'bold',
            textDecoration: 'none'
          }}
        >
          MapleSpike
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a
            href="/"
            style={{
              color: '#9ca3af',
              fontSize: '14px',
              textDecoration: 'none',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
          >
            Overview
          </a>
          <a
            href="/owasp"
            style={{
              color: '#9ca3af',
              fontSize: '14px',
              textDecoration: 'none',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
          >
            OWASP Compliance
          </a>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <a
          href="https://github.com/reverb256/maplespike"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#9ca3af',
            fontSize: '14px',
            textDecoration: 'none',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
        >
          GitHub
        </a>
      </div>
    </nav>
  );
}