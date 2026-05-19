export const owaspCategories = [
  {
    id: 'LLM01',
    name: 'Prompt Injection',
    coverage: 'STRONG',
    controls: [
      '9a (provenance, session tracking, trust decay)',
      '9b (content classification, EXTERNAL blocking)',
      '9c (read→write detection)',
      '9f (audit log, anomaly detection)',
      '9g (reduced capabilities)',
      '9h (session isolation)'
    ],
    gapAnalysis: 'All controls DONE or TODO with clear mitigation path',
    priority: 'P1' // based on the gap priorities, but LLM01 is STRONG so no immediate P1 gap
  },
  {
    id: 'LLM02',
    name: 'Insecure Output Handling',
    coverage: 'PARTIAL',
    controls: [
      '9d (output interception)',
      '9h (argument validation, output sanitization)'
    ],
    gapAnalysis: 'MCP server output sanitization (9h) is TODO — existing `sanitizeOutput()` in mcp-server covers LLM07 but not full LLM02',
    priority: 'P3' // from the gap priorities: LLM02: MCP output sanitization incomplete
  },
  {
    id: 'LLM03',
    name: 'Training Data Poisoning',
    coverage: 'PARTIAL',
    controls: [
      '9a (provenance tagging on memory)',
      '9b (content classification, TTL enforcement)'
    ],
    gapAnalysis: 'All memory-related controls are TODO — no active training data verification',
    priority: 'P2' // from the gap priorities: LLM03: No active training data verification
  },
  {
    id: 'LLM04',
    name: 'Model Denial of Service',
    coverage: 'WEAK',
    controls: [
      '9h (rate limiting per client)'
    ],
    gapAnalysis: 'Only one control, all TODO — no token budget enforcement, no context window limits',
    priority: 'P1' // from the gap priorities: LLM04: No DoS protection
  },
  {
    id: 'LLM05',
    name: 'Supply Chain Vulnerabilities',
    coverage: 'PARTIAL',
    controls: [
      '9i (image digest pinning, integrity checks, weight verification)'
    ],
    gapAnalysis: 'All controls TODO — no active supply chain verification in place',
    priority: 'P2' // from the gap priorities: LLM05: No active supply chain verification
  },
  {
    id: 'LLM06',
    name: 'Sensitive Information Disclosure',
    coverage: 'STRONG',
    controls: [
      '9d (pattern matchers, output interception, allowlist)',
      '9e (network isolation, egress whitelist)',
      '9f (audit log, alerting)',
      '9h (session isolation)'
    ],
    gapAnalysis: 'Secret redaction DONE; network controls (9e) all TODO',
    priority: '' // No specific P1/P2/P3 for LLM06 in the gap priorities, but network controls are TODO
  },
  {
    id: 'LLM07',
    name: 'Insecure Plugin Design',
    coverage: 'STRONG',
    controls: [
      '9a (provenance propagation)',
      '9c (gate intercept, skill overrides)',
      '9g (microVM, securityContext, reduced capabilities)',
      '9h (argument validation)'
    ],
    gapAnalysis: 'Gate intercept DONE; sandbox and MCP hardening TODO',
    priority: '' // No specific gap priority for LLM07
  },
  {
    id: 'LLM08',
    name: 'Excessive Agency',
    coverage: 'STRONG',
    controls: [
      '9c (risk classification, sequence detection, gate intercept, panic mode)',
      '9f (audit log, anomaly detection)',
      '9g (reduced capabilities)'
    ],
    gapAnalysis: 'Action gate controls DONE; monitoring TODO',
    priority: '' // No specific gap priority for LLM08
  },
  {
    id: 'LLM09',
    name: 'Overreliance',
    coverage: 'WEAK',
    controls: [
      '9c (confirmation UI, human-in-the-loop)'
    ],
    gapAnalysis: 'Only confirmation UI addresses this — TODO. No automated fact-checking or source verification',
    priority: 'P1' // from the gap priorities: LLM09: No overreliance protection
  },
  {
    id: 'LLM10',
    name: 'Model Theft',
    coverage: 'WEAK',
    controls: [
      '9e (network namespace)',
      '9g (microVM isolation)',
      '9i (weight verification)'
    ],
    gapAnalysis: 'All controls TODO — no active model theft prevention',
    priority: 'P1' // from the gap priorities: LLM10: No model theft protection
  }
];

// Extract all TODO items for alerts
export const getTodoItems = () => {
  const todos = [];
  owaspCategories.forEach(cat => {
    // We'll parse the controls string to find TODOs, but for simplicity, we can hardcode based on the document
    // Alternatively, we can create a separate list from the threat model document.
    // For now, we'll return an empty array and later we can extract from the markdown if needed.
  });
  // Since we don't have the parsed TODOs, we'll return a placeholder.
  // In a real implementation, we would parse the markdown file or have a separate data source.
  return [
    { id: 'todo1', category: 'LLM04', description: 'Add token budget enforcement + context window limits to MCP server', effort: '1-2 days' },
    { id: 'todo2', category: 'LLM09', description: 'Add confirmation UI for RED/BLACK tool calls (9c) + source citation requirement', effort: '2-3 days' },
    { id: 'todo3', category: 'LLM10', description: 'Implement network egress control (9e) + weight verification (9i)', effort: '3-5 days' },
    { id: 'todo4', category: 'LLM03', description: 'Implement memory provenance tagging + TTL enforcement (9b)', effort: '1-2 days' },
    { id: 'todo5', category: 'LLM05', description: 'Implement container digest pinning + MCP integrity checks (9i)', effort: '1-2 days' },
    { id: 'todo6', category: 'LLM02', description: 'Complete 9h output sanitization + argument validation', effort: '1 day' }
  ];
};