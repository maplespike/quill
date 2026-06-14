/**
 * OWASP LLM Top 10 (2023) Compliance Data
 *
 * Based on: https://owasp.org/www-project-top-10-for-large-language-model-applications/
 */
import * as React from 'react';

export interface OWASPCategory {
  id: string;
  name: string;
  description: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'pass' | 'fail' | 'partial';
  checkItems: {
    description: string;
    status: 'pass' | 'fail' | 'partial' | 'na';
  }[];
}

export const owaspCategories: OWASPCategory[] = [
  {
    id: 'LLM01',
    name: 'Prompt Injection',
    description: 'Prompt injection vulnerabilities occur when malicious users craft inputs that manipulate the LLM to execute unintended actions, bypass controls, or access restricted information.',
    severity: 'Critical',
    status: 'partial',
    checkItems: [
      { description: 'Input sanitization for user prompts', status: 'partial' },
      { description: 'Output filtering for code execution', status: 'pass' },
      { description: 'Context window isolation', status: 'pass' },
      { description: 'Jailbreak detection', status: 'fail' }
    ]
  },
  {
    id: 'LLM02',
    name: 'Insecure Output Handling',
    description: 'Vulnerabilities where the LLM output is not validated or sanitized before being used to control downstream components or systems.',
    severity: 'High',
    status: 'pass',
    checkItems: [
      { description: 'Output type validation', status: 'pass' },
      { description: 'SQL injection prevention', status: 'pass' },
      { description: 'XSS prevention in web responses', status: 'pass' },
      { description: 'Code execution sandboxing', status: 'na' }
    ]
  },
  {
    id: 'LLM03',
    name: 'Training Data Poisoning',
    description: 'Malicious actors manipulate training data or fine-tuning processes to introduce vulnerabilities, backdoors, or biased behavior.',
    severity: 'Critical',
    status: 'pass',
    checkItems: [
      { description: 'Source data provenance tracking', status: 'pass' },
      { description: 'Data integrity verification', status: 'pass' },
      { description: 'Unauthorized modification detection', status: 'pass' },
      { description: 'Training pipeline audit logging', status: 'pass' }
    ]
  },
  {
    id: 'LLM04',
    name: 'Model Denial of Service',
    description: 'Resource exhaustion attacks that target the LLM or its infrastructure, causing degraded performance or service unavailability.',
    severity: 'High',
    status: 'partial',
    checkItems: [
      { description: 'Rate limiting per user', status: 'pass' },
      { description: 'Context window limits', status: 'pass' },
      { description: 'GPU resource quotas', status: 'partial' },
      { description: 'Request throttling', status: 'pass' }
    ]
  },
  {
    id: 'LLM05',
    name: 'Supply Chain Vulnerabilities',
    description: 'Compromises in the LLM supply chain, including models, datasets, libraries, or infrastructure.',
    severity: 'High',
    status: 'pass',
    checkItems: [
      { description: 'Model source verification', status: 'pass' },
      { description: 'Dependency vulnerability scanning', status: 'pass' },
      { description: 'Signed model artifacts', status: 'pass' },
      { description: 'Vendor SBOM requirements', status: 'pass' }
    ]
  },
  {
    id: 'LLM06',
    name: 'Sensitive Information Disclosure',
    description: 'Llama-based LLMs may inadvertently reveal sensitive information, including training data or user-provided confidential data.',
    severity: 'Medium',
    status: 'partial',
    checkItems: [
      { description: 'PII detection and redaction', status: 'partial' },
      { description: 'Training data confidentiality', status: 'pass' },
      { description: 'Prompt data encryption at rest', status: 'pass' },
      { description: 'Audit log review', status: 'fail' }
    ]
  },
  {
    id: 'LLM07',
    name: 'Insecure Plugin Design',
    description: 'Vulnerabilities in plugin architectures or tool calling mechanisms that allow unauthorized actions or data access.',
    severity: 'High',
    status: 'pass',
    checkItems: [
      { description: 'Plugin permission boundaries', status: 'pass' },
      { description: 'Tool input validation', status: 'pass' },
      { description: 'Authorization checks per tool', status: 'pass' },
      { description: 'Plugin sandboxing', status: 'na' }
    ]
  },
  {
    id: 'LLM08',
    name: 'Excessive Agency',
    description: 'Llama-based LLMs may take actions beyond their intended scope, potentially causing harm or unintended consequences.',
    severity: 'High',
    status: 'partial',
    checkItems: [
      { description: 'Action allowlist enforcement', status: 'partial' },
      { description: 'Human-in-the-loop for sensitive operations', status: 'pass' },
      { description: 'Goal constraint validation', status: 'pass' },
      { description: 'Tool use logging', status: 'pass' }
    ]
  },
  {
    id: 'LLM09',
    name: 'Overreliance',
    description: 'Users may place excessive trust in LLM outputs without verification, leading to errors or security issues.',
    severity: 'Low',
    status: 'fail',
    checkItems: [
      { description: 'Citation provenance tracking', status: 'pass' },
      { description: 'Confidence scoring', status: 'fail' },
      { description: 'Human verification prompts', status: 'fail' },
      { description: 'Hallucination detection', status: 'fail' }
    ]
  },
  {
    id: 'LLM10',
    name: 'Model Theft',
    description: 'Unauthorized access to or exfiltration of proprietary models, fine-tuned weights, or training data.',
    severity: 'Medium',
    status: 'pass',
    checkItems: [
      { description: 'Model artifact encryption', status: 'pass' },
      { description: 'Access controls on model storage', status: 'pass' },
      { description: 'Exfiltration monitoring', status: 'pass' },
      { description: 'Watermarking for model identification', status: 'pass' }
    ]
  }
];

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'pass':
      return '#10b981'; // green
    case 'fail':
      return '#ef4444'; // red
    case 'partial':
      return '#f59e0b'; // amber
    case 'na':
      return '#6b7280'; // gray
    default:
      return '#6b7280';
  }
};

export const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'Critical':
      return '#ef4444'; // red
    case 'High':
      return '#f97316'; // orange
    case 'Medium':
      return '#f59e0b'; // amber
    case 'Low':
      return '#10b981'; // green
    default:
      return '#6b7280';
  }
};