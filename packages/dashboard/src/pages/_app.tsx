import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Nav from '../components/Nav'
import AuthGuard from '../components/AuthGuard'
import Footer from '../components/Footer'

const globalStyles = `
  :root {
    --color-primary: #e84545; --color-secondary: #06b6d4; --color-tertiary: #10b981;
    --color-warning: #f59e0b; --color-neutral: #0a0e17; --color-surface: #111827;
    --color-surface-elevated: #1a2332; --color-border: #1e2d45;
    --color-text: #e2e8f0; --color-text-secondary: #94a3b8; --color-text-muted: #64748b;
    --chart-1: #e84545; --chart-2: #06b6d4; --chart-3: #10b981; --chart-4: #f59e0b;
    --chart-5: #8b5cf6; --chart-6: #ec4899; --chart-7: #14b8a6; --chart-8: #f97316;
    --font-ui: Inter, system-ui, sans-serif; --font-mono: 'JetBrains Mono', monospace;
    --radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px;
    --spacing-xs: 4px; --spacing-sm: 8px; --spacing-md: 16px; --spacing-lg: 24px; --spacing-xl: 32px;
    --motion-fast: 100ms; --motion-normal: 200ms; --motion-slow: 300ms;
    --bg-primary: var(--color-neutral); --bg-card: var(--color-surface);
    --bg-elevated: var(--color-surface-elevated); --border: var(--color-border);
    --accent: var(--color-primary); --accent-cyan: var(--color-secondary);
    --text-primary: var(--color-text); --text-secondary: var(--color-text-secondary);
    --text-muted: var(--color-text-muted); --success: var(--color-tertiary);
    --warning: var(--color-warning); --radius: var(--radius-md); --radius-lg: var(--radius-lg);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--font-ui); background: var(--bg-primary); color: var(--text-primary); min-height: 100vh; }
  a { color: var(--color-secondary); transition: color var(--motion-normal) ease-out; }
  a:hover { opacity: 0.85; }
  button { font-family: inherit; cursor: pointer; transition: opacity var(--motion-normal) ease-out; }
  button:hover { opacity: 0.85; }
  button:active { transform: scale(0.98); }
  .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; transition: border-color var(--motion-normal) ease-out, box-shadow var(--motion-normal) ease-out; }
  .card:hover { border-color: #2d4a6a; box-shadow: 0 0 0 1px rgba(6,182,212,0.1); }
  .card-entrance { animation: fadeIn var(--motion-slow) ease-out, slideUp var(--motion-slow) ease-out; }
  .card-entrance:nth-child(2) { animation-delay: 50ms; }
  .card-entrance:nth-child(3) { animation-delay: 100ms; }
  .card-entrance:nth-child(4) { animation-delay: 150ms; }
  .card-entrance:nth-child(5) { animation-delay: 200ms; }
  code { font-family: var(--font-mono); font-size: 0.85em; color: var(--color-secondary); background: rgba(6,182,212,0.08); padding: 2px 6px; border-radius: var(--radius-sm); }
  .page { max-width: 1280px; margin: 0 auto; padding: var(--spacing-xl) 24px 80px; }
  .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--spacing-md); margin-bottom: 24px; }
  .shimmer { background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-elevated) 50%, var(--bg-card) 75%); background-size: 200% 100%; animation: shimmer 1500ms infinite; border-radius: var(--radius); }
  .stat-value { font-variant-numeric: tabular-nums; }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
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
