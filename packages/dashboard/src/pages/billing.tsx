import { useEffect, useState } from 'react'
import { getPlans, getHealth } from '../lib/api'

interface Plan {
  id: string; name: string; priceUsd: number; requests: number; rateLimit: number
}

interface Chain {
  id: string; name: string; token: string; usdc: boolean; kind: string
}

export default function Billing() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [chains, setChains] = useState<Chain[]>([])
  const [currentTier, setCurrentTier] = useState('free')
  const [selectedPlan, setSelectedPlan] = useState('')
  const [selectedChain, setSelectedChain] = useState('solana-usdc')
  const [order, setOrder] = useState<null | { orderId: string; wallet: string; amount: number; token: string; explorer: string }>(null)
  const [txHash, setTxHash] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    getPlans().then(r => { if (r.success && r.data) { const d = r.data as any; setPlans(d.plans || []); setChains(d.chains || []) } })
    getHealth().then(r => { if (r.success && r.data?.tenant) setCurrentTier(r.data.tenant.tier) })
  }, [])

  async function handleOrder() {
    setMsg(''); setOrder(null)
    const res = await fetch('/api/billing/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: selectedPlan, chainId: selectedChain }),
    })
    const data = await res.json()
    if (data.success) setOrder(data.data)
    else setMsg(data.error?.message || 'Failed to create order')
  }

  async function handleVerify() {
    if (!order || !txHash.trim()) return
    setMsg('')
    const res = await fetch('/api/billing/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.orderId, txHash: txHash.trim() }),
    })
    const data = await res.json()
    if (data.success) setMsg('✅ Payment verified! Your tier has been upgraded.')
    else setMsg(data.error?.message || 'Verification failed')
  }

  return (
    <div className="page">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 24 }}>Billing & Plans</h1>
      <p style={{ marginBottom: 24, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        Current tier: <strong>{currentTier}</strong>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 32 }}>
        {plans.filter(p => p.priceUsd > 0).map(plan => (
          <div key={plan.id} onClick={() => setSelectedPlan(plan.id)} style={{
            padding: 24, borderRadius: 'var(--radius)', border: `2px solid ${selectedPlan === plan.id ? 'var(--accent)' : 'var(--border)'}`,
            background: selectedPlan === plan.id ? 'var(--bg-elevated)' : 'transparent', cursor: 'pointer',
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{plan.name}</h3>
            <p style={{ fontSize: '2rem', fontWeight: 700, margin: '12px 0' }}>${plan.priceUsd}<span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span></p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{plan.requests.toLocaleString()} requests/mo</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{plan.rateLimit} req/s rate limit</p>
          </div>
        ))}
      </div>

      {selectedPlan && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Pay with Crypto</h2>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            {chains.filter(c => c.kind === 'x402' || c.usdc).map(chain => (
              <button key={chain.id} onClick={() => setSelectedChain(chain.id)} style={{
                padding: '8px 16px', fontSize: '0.82rem', borderRadius: 'var(--radius)',
                border: `1px solid ${selectedChain === chain.id ? 'var(--accent)' : 'var(--border)'}`,
                background: selectedChain === chain.id ? 'var(--accent)' : 'transparent',
                color: selectedChain === chain.id ? '#fff' : 'var(--text-primary)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {chain.name} {chain.usdc ? '(USDC)' : `(${chain.token})`}
              </button>
            ))}
          </div>
          <button onClick={handleOrder} style={{
            padding: '12px 24px', background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: 600,
          }}>
            Generate Payment Address
          </button>
        </div>
      )}

      {order && (
        <div className="card" style={{ marginBottom: 24, borderColor: 'var(--accent-cyan)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>Send Payment</h2>
          <p style={{ fontSize: '0.82rem', marginBottom: 8 }}>
            Send <strong>${order.amount} {order.token}</strong> to:
          </p>
          <code style={{
            display: 'block', padding: 16, background: 'var(--bg-elevated)', borderRadius: 'var(--radius)',
            fontSize: '0.82rem', wordBreak: 'break-all', marginBottom: 12,
          }}>
            {order.wallet}
          </code>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            Include reference: <code>{order.orderId}</code>
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input value={txHash} onChange={e => setTxHash(e.target.value)}
              placeholder="Paste transaction hash after sending"
              style={{ flex: 1, padding: '12px 16px', fontSize: '0.9rem', background: 'var(--bg-elevated)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', outline: 'none' }} />
            <button onClick={handleVerify} style={{
              padding: '12px 24px', background: 'var(--accent)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: 600,
            }}>
              Verify Payment
            </button>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>
            View on explorer: <a href={order.explorer} target="_blank" rel="noreferrer">{order.explorer}</a>
          </p>
        </div>
      )}
      {msg && <p style={{ fontSize: '0.85rem' }}>{msg}</p>}
    </div>
  )
}
