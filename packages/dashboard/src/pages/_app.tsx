import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Nav from '../components/Nav'
import AuthGuard from '../components/AuthGuard'
import Footer from '../components/Footer'

const globalStyles = `
  :root {
    --bg-primary: #0a0e17; --bg-card: #111827; --bg-elevated: #1a2332;
    --border: #1e2d45; --accent: #e84545; --accent-cyan: #06b6d4;
    --text-primary: #e2e8f0; --text-secondary: #94a3b8; --text-muted: #64748b;
    --success: #10b981; --warning: #f59e0b; --radius: 8px; --radius-lg: 12px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Inter, system-ui, sans-serif; background: var(--bg-primary); color: var(--text-primary); min-height: 100vh; }
  a { color: var(--accent-cyan); }
  button:hover { opacity: 0.85; }
  a:hover { opacity: 0.85; }
  .card { transition: border-color 0.2s; }
  .card:hover { border-color: #2d4a6a; }
  code { font-family: 'JetBrains Mono', monospace; font-size: 0.85em; color: var(--accent-cyan); background: rgba(6,182,212,0.08); padding: 2px 6px; border-radius: 4px; }
  .page { max-width: 1280px; margin: 0 auto; padding: 32px 24px 80px; }
  .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; }
  .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .shimmer { background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-elevated) 50%, var(--bg-card) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius); }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
`

const pageTitles: Record<string, string> = {
  '/': 'Overview \u2014 MapleSpike Dashboard',
  '/search': 'Search \u2014 MapleSpike Dashboard',
  '/briefs': 'Intelligence Briefs \u2014 MapleSpike Dashboard',
  '/signals': 'Active Signals \u2014 MapleSpike Dashboard',
  '/account': 'Account \u2014 MapleSpike Dashboard',
  '/login': 'Sign In \u2014 MapleSpike Dashboard',
  '/register': 'Register \u2014 MapleSpike Dashboard',
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const title = pageTitles[router.pathname] || 'MapleSpike Dashboard'

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <style>{globalStyles}</style>
      <Nav />
      <AuthGuard>
        <Component {...pageProps} />
        <Footer />
      </AuthGuard>
    </>
  )
}
