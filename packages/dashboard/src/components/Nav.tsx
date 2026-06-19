/**
 * Navigation Component
 *
 * Main navigation for the dashboard
 */
import * as React from 'react';
import type { ReactElement } from 'react';

export default function Nav(): ReactElement {
  return (
    <nav style={navStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <a href="/" style={brandStyle}>
          MapleSpike
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <NavLink href="/" label="Overview" />
          <NavLink href="/owasp" label="OWASP Compliance" />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <a
          href="https://github.com/reverb256/maplespike"
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fafafa')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
        >
          GitHub
        </a>
      </div>
    </nav>
  );
}

function NavLink({ href, label }: { href: string; label: string }): ReactElement {
  return (
    <a
      href={href}
      style={linkStyle}
      onMouseEnter={(e) => (e.currentTarget.style.color = '#fafafa')}
      onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
    >
      {label}
    </a>
  );
}

const navStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 24px',
  height: '64px',
  background: 'hsl(0 0% 3.5%)',
  borderBottom: '1px solid hsl(0 0% 15%)',
  position: 'sticky',
  top: 0,
  zIndex: 50,
  fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
};

const brandStyle: React.CSSProperties = {
  color: '#fafafa',
  fontSize: '20px',
  fontWeight: 700,
  letterSpacing: '-0.025em',
  textDecoration: 'none',
};

const linkStyle: React.CSSProperties = {
  color: '#9ca3af',
  fontSize: '14px',
  fontWeight: 500,
  textDecoration: 'none',
  transition: 'color 0.2s',
  padding: '8px 12px',
  borderRadius: '8px',
};
