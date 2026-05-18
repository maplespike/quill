export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      padding: '24px 24px 32px',
      fontSize: '0.78rem',
      color: 'var(--text-muted)',
      textAlign: 'center',
      marginTop: 48,
    }}>
      <div style={{ marginBottom: 10 }}>
        MapleSpike Dashboard v0.1.0 — Canadian government data intelligence
      </div>
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
        <a href="https://maplespike.ca" target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>
          Portal
        </a>
        <a href="https://github.com/reverb256/maplespike" target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>
          GitHub
        </a>
        <a href="https://maplespike.ca/docs/api" target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>
          API Docs
        </a>
      </div>
    </footer>
  )
}
