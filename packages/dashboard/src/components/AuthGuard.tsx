import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { isAuthenticated } from '../lib/auth'

const PUBLIC_PATHS = ['/login', '/register']

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  // During SSR/static generation, render children immediately
  if (typeof window === 'undefined') {
    return <>{children}</>
  }

  useEffect(() => {
    if (PUBLIC_PATHS.includes(router.pathname)) {
      setChecked(true)
      return
    }

    if (!isAuthenticated()) {
      router.replace('/login')
      return
    }

    setChecked(true)
  }, [router.pathname])

  if (!checked) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--bg-primary)',
      }}>
        <div className="shimmer" style={{ width: 48, height: 48, borderRadius: '50%' }} />
      </div>
    )
  }

  return <>{children}</>
}
