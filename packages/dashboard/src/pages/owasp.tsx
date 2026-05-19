import { useEffect, useState } from 'react'
import { owaspCategories, getTodoItems } from '../lib/owaspData'

export default function OWASPCompliance() {
  const [todos, setTodos] = useState<Array<any>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate fetching TODO items (in a real app, this would come from an API)
    setTimeout(() => {
      setTodos(getTodoItems())
      setLoading(false)
    }, 500)
  }, [])

  if (loading) {
    return (
      <div className="page">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 24 }}>
          OWASP LLM Top 10 Compliance Dashboard
        </h1>
        <div className="stats-row">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="shimmer" style={{ height: 80, width: '100%' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
          OWASP LLM Top 10 Compliance Dashboard
        </h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => {
              // In a real app, this would trigger an export function
              alert('Export functionality would be implemented here')
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 20px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              textDecoration: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <span>📥</span>
            <span>Export for Audit</span>
          </button>
        </div>
      </div>

      {/* Compliance Matrix */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>
          Compliance Matrix
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px',
                    background: 'var(--bg-elevated)',
                    fontWeight: 600,
                    borderBottom: '2px solid var(--border)',
                  }}
                >
                  OWASP Category
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px',
                    background: 'var(--bg-elevated)',
                    fontWeight: 600,
                    borderBottom: '2px solid var(--border)',
                  }}
                >
                  Coverage
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px',
                    background: 'var(--bg-elevated)',
                    fontWeight: 600,
                    borderBottom: '2px solid var(--border)',
                  }}
                >
                  Controls Addressed
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px',
                    background: 'var(--bg-elevated)',
                    fontWeight: 600,
                    borderBottom: '2px solid var(--border)',
                  }}
                >
                  Gap Analysis
                </th>
              </tr>
            </thead>
            <tbody>
              {owaspCategories.map((category) => (
                <tr key={category.id}>
                  <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontWeight: 600,
                          color:
                            category.coverage === 'STRONG'
                              ? 'var(--success)'
                              : category.coverage === 'PARTIAL'
                              ? 'var(--warning)'
                              : 'var(--error)',
                        }}
                      >
                        {category.id}
                      </span>
                      <span>{category.name}</span>
                    </div>
                  </td>
                  <td
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid var(--border)',
                      fontWeight:
                        category.coverage === 'STRONG'
                          ? 600
                          : category.coverage === 'PARTIAL'
                          ? 500
                          : 400,
                      color:
                        category.coverage === 'STRONG'
                          ? 'var(--success)'
                          : category.coverage === 'PARTIAL'
                          ? 'var(--warning)'
                          : 'var(--error)',
                    }}
                  >
                    {category.coverage}
                  </td>
                  <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                    {category.controls.map((control, index) => (
                      <div key={index} style={{ marginBottom: 4 }}>
                        • {control}
                      </div>
                    ))}
                  </td>
                  <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                    {category.gapAnalysis}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Progress Tracking */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>
          Progress Tracking by Category
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {owaspCategories.map((category) => (
            <div
              key={category.id}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span
                  style={{
                    fontWeight: 600,
                    color:
                      category.coverage === 'STRONG'
                        ? 'var(--success)'
                        : category.coverage === 'PARTIAL'
                        ? 'var(--warning)'
                        : 'var(--error)',
                  }}
                >
                  {category.id}
                </span>
                <span
                  style={{
                    fontSize: '0.9rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  {category.coverage}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                {category.controls.length} controls
              </div>
              <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width:
                      category.coverage === 'STRONG'
                        ? '80%' // Approximate for STRONG
                        : category.coverage === 'PARTIAL'
                        ? '50%' // Approximate for PARTIAL
                        : '20%', // Approximate for WEAK
                    background:
                      category.coverage === 'STRONG'
                        ? 'var(--success)'
                        : category.coverage === 'PARTIAL'
                        ? 'var(--warning)'
                        : 'var(--error)',
                    borderRadius: '3px',
                    transition: 'width 0.8s ease',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts Section */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>
          Priority Action Items
        </h2>
        {todos.length > 0 ? (
          <div>
            {todos.map((todo) => (
              <div
                key={todo.id}
                style={{
                  background: 'var(--bg-card)',
                  borderLeft: `4px solid ${todo.priority === 'P1' ? 'var(--error)' : todo.priority === 'P2' ? 'var(--warning)' : 'var(--info)'}`,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '16px',
                  marginBottom: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                  <div>
                    <span
                      style={{
                        fontWeight: 600,
                        color: todo.priority === 'P1' ? 'var(--error)' : todo.priority === 'P2' ? 'var(--warning)' : 'var(--info)',
                      }}
                    >
                      [{todo.priority}]
                    </span>
                    <span style={{ marginLeft: 8 }}>{todo.category}</span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {todo.effort}
                  </span>
                </div>
                <p style={{ margin: 0, color: 'var(--text-primary)' }}>{todo.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
            No priority action items at this time.
          </p>
        )}
      </div>

      {/* Legend */}
      <div className="card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>
          Coverage Legend
        </h2>
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 12,
                height: 12,
                background: 'var(--success)',
                borderRadius: '2px',
              }}
            />
            <span>STRONG: 3+ controls, at least 1 DONE, clear mitigation for all TODOs</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 12,
                height: 12,
                background: 'var(--warning)',
                borderRadius: '2px',
              }}
            />
            <span>
              PARTIAL: 1–2 controls, mix of DONE/TODO, gaps exist but path forward is clear
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 12,
                height: 12,
                background: 'var(--error)',
                borderRadius: '2px',
              }}
            />
            <span>
              WEAK: 1 control or all TODOs, significant gaps, needs dedicated work
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}