/**
 * OWASP LLM Top 10 Compliance Dashboard
 *
 * Displays security posture across OWASP LLM Top 10 categories.
 * Styled via CSS variables to match the MapleSpike portal design system.
 */
import * as React from 'react';
import type { ReactElement, CSSProperties } from 'react';
import { owaspCategories, getStatusColor, getSeverityColor } from '../lib/owaspData';

export default function OWASP(): ReactElement {
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
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>OWASP LLM Top 10 Compliance Dashboard</h1>
        <p style={styles.subtitle}>
          Security posture assessment based on OWASP Top 10 for Large Language Model Applications (2023)
        </p>
      </header>

      {/* Summary Cards */}
      <div style={styles.summaryGrid}>
        <SummaryCard label="Total Categories" value={owaspCategories.length} />
        <SummaryCard label="Passing" value={passCount} accent="#10b981" />
        <SummaryCard label="Partial" value={partialCount} accent="#f59e0b" />
        <SummaryCard label="Failing" value={failCount} accent="#ef4444" />
      </div>

      {/* Severity Alerts */}
      {(criticalCount > 0 || highCount > 0) && (
        <div style={styles.alertBox}>
          <h2 style={styles.alertTitle}>⚠️ Attention Required</h2>
          <ul style={styles.alertList}>
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
      <div style={{ display: 'grid', gap: '20px' }}>
        {owaspCategories.map((category) => (
          <div
            key={category.id}
            style={{
              ...styles.categoryCard,
              borderColor: getStatusColor(category.status) + '55',
            }}
          >
            <div style={styles.categoryHead}>
              <div style={{ flex: 1 }}>
                <div style={styles.categoryTitleRow}>
                  <h3 style={styles.categoryTitle}>
                    {category.id}: {category.name}
                  </h3>
                  <span
                    style={{
                      ...styles.pill,
                      background: getSeverityColor(category.severity),
                    }}
                  >
                    {category.severity}
                  </span>
                  <span
                    style={{
                      ...styles.pill,
                      background: getStatusColor(category.status),
                    }}
                  >
                    {category.status}
                  </span>
                </div>
                <p style={styles.categoryDesc}>{category.description}</p>
              </div>
            </div>

            {/* Checklist Items */}
            <div style={{ marginTop: '16px' }}>
              <h4 style={styles.checklistTitle}>
                Checklist ({category.checkItems.length} items)
              </h4>
              <div style={{ display: 'grid', gap: '8px' }}>
                {category.checkItems.map((item, idx) => (
                  <div key={idx} style={styles.checkItem}>
                    <span style={styles.checkIcon}>
                      {item.status === 'pass' ? '✅' : item.status === 'fail' ? '❌' : item.status === 'partial' ? '⚠️' : '➖'}
                    </span>
                    <span style={styles.checkText}>{item.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer style={styles.footer}>
        <p style={styles.footerText}>Last updated: {new Date().toLocaleDateString('en-CA')}</p>
        <p style={styles.footerText}>
          Reference:{' '}
          <a
            href="https://owasp.org/www-project-top-10-for-large-language-model-applications/"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.footerLink}
          >
            OWASP Top 10 for Large Language Model Applications
          </a>
        </p>
      </footer>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}): ReactElement {
  return (
    <div style={styles.summaryCard}>
      <div style={{ ...styles.summaryLabel, ...(accent ? { color: accent } : {}) }}>
        {label}
      </div>
      <div style={{ ...styles.summaryValue, ...(accent ? { color: accent } : {}) }}>
        {value}
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
    fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
  } as CSSProperties,
  header: {
    marginBottom: '32px',
  } as CSSProperties,
  title: {
    color: '#fafafa',
    fontSize: '32px',
    fontWeight: 700,
    letterSpacing: '-0.025em',
    marginBottom: '8px',
    margin: 0,
  } as CSSProperties,
  subtitle: {
    color: '#9ca3af',
    fontSize: '16px',
    margin: 0,
  } as CSSProperties,
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px',
  } as CSSProperties,
  summaryCard: {
    background: 'hsl(0 0% 6.5%)',
    border: '1px solid hsl(0 0% 15%)',
    borderRadius: '12px',
    padding: '20px',
  } as CSSProperties,
  summaryLabel: {
    color: '#9ca3af',
    fontSize: '14px',
    marginBottom: '8px',
  } as CSSProperties,
  summaryValue: {
    color: '#fafafa',
    fontSize: '32px',
    fontWeight: 700,
  } as CSSProperties,
  alertBox: {
    background: 'hsl(0 72% 14%)',
    border: '1px solid hsl(0 72% 51% / 0.4)',
    borderRadius: '12px',
    padding: '16px 20px',
    marginBottom: '32px',
  } as CSSProperties,
  alertTitle: {
    color: '#fca5a5',
    fontSize: '18px',
    fontWeight: 600,
    margin: '0 0 8px 0',
  } as CSSProperties,
  alertList: {
    color: '#fecaca',
    margin: 0,
    paddingLeft: '20px',
    fontSize: '14px',
  } as CSSProperties,
  categoryCard: {
    background: 'hsl(0 0% 6.5%)',
    border: '1px solid hsl(0 0% 15%)',
    borderRadius: '12px',
    padding: '24px',
  } as CSSProperties,
  categoryHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
  } as CSSProperties,
  categoryTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap' as const,
    marginBottom: '6px',
  } as CSSProperties,
  categoryTitle: {
    color: '#fafafa',
    fontSize: '20px',
    fontWeight: 600,
    margin: 0,
  } as CSSProperties,
  pill: {
    color: '#fff',
    padding: '3px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.025em',
  } as CSSProperties,
  categoryDesc: {
    color: '#9ca3af',
    fontSize: '14px',
    lineHeight: 1.6,
    margin: 0,
  } as CSSProperties,
  checklistTitle: {
    color: '#fafafa',
    fontSize: '13px',
    fontWeight: 600,
    margin: '0 0 8px 0',
  } as CSSProperties,
  checkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    background: 'hsl(0 0% 3.5%)',
    borderRadius: '8px',
    border: '1px solid hsl(0 0% 12%)',
  } as CSSProperties,
  checkIcon: {
    fontSize: '16px',
    minWidth: '20px',
  } as CSSProperties,
  checkText: {
    color: '#d4d4d4',
    fontSize: '14px',
    flex: 1,
  } as CSSProperties,
  footer: {
    marginTop: '48px',
    padding: '24px 0',
    borderTop: '1px solid hsl(0 0% 15%)',
  } as CSSProperties,
  footerText: {
    color: '#6b7280',
    fontSize: '14px',
    margin: 0,
  } as CSSProperties,
  footerLink: {
    color: 'hsl(0 72% 60%)',
    textDecoration: 'none',
  } as CSSProperties,
};
