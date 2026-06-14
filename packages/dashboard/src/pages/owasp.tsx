/**
 * OWASP LLM Top 10 Compliance Dashboard
 *
 * Displays security posture across OWASP LLM Top 10 categories
 */

import { owaspCategories, getStatusColor, getSeverityColor } from '../lib/owaspData';

export default function OWASP() {
  const passCount = owaspCategories.filter((c) => c.status === 'pass').length;
  const partialCount = owaspCategories.filter((c) => c.status === 'partial').length;
  const failCount = owaspCategories.filter((c) => c.status === 'fail').length;
  const criticalCount = owaspCategories.filter(
    (c) => c.severity === 'Critical' && c.status !== 'pass'
  ).length;
  const highCount = owaspCategories.filter(
    (c) => c.severity === 'High' && c.status !== 'pass'
  ).length;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ color: '#fff', fontSize: '32px', marginBottom: '8px' }}>
          OWASP LLM Top 10 Compliance Dashboard
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '16px', margin: 0 }}>
          Security posture assessment based on OWASP Top 10 for Large Language Model Applications (2023)
        </p>
      </header>

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px'
        }}
      >
        <div
          style={{
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            padding: '16px'
          }}
        >
          <div style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '8px' }}>
            Total Categories
          </div>
          <div style={{ color: '#fff', fontSize: '32px', fontWeight: 'bold' }}>
            {owaspCategories.length}
          </div>
        </div>

        <div
          style={{
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            padding: '16px'
          }}
        >
          <div style={{ color: '#10b981', fontSize: '14px', marginBottom: '8px' }}>
            Passing
          </div>
          <div style={{ color: '#10b981', fontSize: '32px', fontWeight: 'bold' }}>
            {passCount}
          </div>
        </div>

        <div
          style={{
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            padding: '16px'
          }}
        >
          <div style={{ color: '#f59e0b', fontSize: '14px', marginBottom: '8px' }}>
            Partial
          </div>
          <div style={{ color: '#f59e0b', fontSize: '32px', fontWeight: 'bold' }}>
            {partialCount}
          </div>
        </div>

        <div
          style={{
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            padding: '16px'
          }}
        >
          <div style={{ color: '#ef4444', fontSize: '14px', marginBottom: '8px' }}>
            Failing
          </div>
          <div style={{ color: '#ef4444', fontSize: '32px', fontWeight: 'bold' }}>
            {failCount}
          </div>
        </div>
      </div>

      {/* Severity Alerts */}
      {(criticalCount > 0 || highCount > 0) && (
        <div
          style={{
            background: '#fee2e2',
            border: '1px solid #f87171',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '32px'
          }}
        >
          <h2 style={{ color: '#991b1b', fontSize: '18px', margin: '0 0 8px 0' }}>
            ⚠️ Attention Required
          </h2>
          <ul style={{ color: '#7f1d1d', margin: 0, paddingLeft: '20px' }}>
            {criticalCount > 0 && (
              <li>{criticalCount} Critical severity item(s) need immediate action</li>
            )}
            {highCount > 0 && (
              <li>{highCount} High severity item(s) should be addressed soon</li>
            )}
          </ul>
        </div>
      )}

      {/* OWASP Categories */}
      <div style={{ display: 'grid', gap: '24px' }}>
        {owaspCategories.map((category) => (
          <div
            key={category.id}
            style={{
              background: '#1f2937',
              border: `1px solid ${getStatusColor(category.status)}`,
              borderRadius: '8px',
              padding: '20px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                  <h3 style={{ color: '#fff', fontSize: '20px', margin: 0 }}>
                    {category.id}: {category.name}
                  </h3>
                  <span
                    style={{
                      background: getSeverityColor(category.severity),
                      color: '#fff',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    {category.severity}
                  </span>
                  <span
                    style={{
                      background: getStatusColor(category.status),
                      color: '#fff',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}
                  >
                    {category.status}
                  </span>
                </div>
                <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>
                  {category.description}
                </p>
              </div>
            </div>

            {/* Checklist Items */}
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '8px', margin: 0 }}>
                Checklist ({category.checkItems.length} items)
              </h4>
              <div style={{ display: 'grid', gap: '8px' }}>
                {category.checkItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      background: '#111827',
                      borderRadius: '4px'
                    }}
                  >
                    <span
                      style={{
                        fontSize: '16px',
                        minWidth: '20px'
                      }}
                    >
                      {item.status === 'pass' ? '✅' : item.status === 'fail' ? '❌' : item.status === 'partial' ? '⚠️' : '➖'}
                    </span>
                    <span style={{ color: '#9ca3af', fontSize: '14px', flex: 1 }}>
                      {item.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer style={{ marginTop: '48px', padding: '24px 0', borderTop: '1px solid #374151' }}>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
          Last updated: {new Date().toLocaleDateString('en-CA')}
        </p>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: '4px 0 0 0' }}>
          Reference:{' '}
          <a
            href="https://owasp.org/www-project-top-10-for-large-language-model-applications/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#3b82f6', textDecoration: 'none' }}
          >
            OWASP Top 10 for Large Language Model Applications
          </a>
        </p>
      </footer>
    </div>
  );
}