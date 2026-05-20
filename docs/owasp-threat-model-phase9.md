---
last-reviewed: 2026-05-19
status: active

---
last-reviewed: 2026-05-19
status: active

# OWASP LLM Top 10 Threat Model — Phase 9: Agent Security Firewall

> **Created:** 2026-05-19
> **Issue:** #35
> **Scope:** Phase 9 sub-phases 9a–9j mapped to OWASP Top 10 for LLM Applications v1.1
> **Source:** [OWASP LLM Top 10](https://genai.owasp.org/llm-top-10/)

---

## OWASP LLM Top 10 Reference (v1.1)

| ID | Category | Description |
|----|----------|-------------|
| LLM01 | Prompt Injection | Manipulating LLMs via crafted inputs can lead to unauthorized access, data breaches, and compromised decision-making |
| LLM02 | Insecure Output Handling | Neglecting to validate LLM outputs may lead to downstream security exploits, including code execution |
| LLM03 | Training Data Poisoning | Tampered training data can impair LLM models leading to responses that compromise security, accuracy, or ethical behavior |
| LLM04 | Model Denial of Service | Overloading LLMs with resource-heavy operations can cause service disruptions and increased costs |
| LLM05 | Supply Chain Vulnerabilities | Depending upon compromised components, services or datasets undermines system integrity |
| LLM06 | Sensitive Information Disclosure | Failure to protect against disclosure of sensitive information in LLM outputs |
| LLM07 | Insecure Plugin Design | LLM plugins processing untrusted inputs with insufficient access control risk severe exploits like RCE |
| LLM08 | Excessive Agency | Granting LLMs unchecked autonomy to take action can lead to unintended consequences |
| LLM09 | Overreliance | Failing to critically assess LLM outputs can lead to compromised decision making and legal liabilities |
| LLM10 | Model Theft | Unauthorized access to proprietary LLMs risks theft and dissemination of sensitive information |

---

## Phase 9 Mapping Matrix

### 9a: Trust Context Tracker

| Control | OWASP Category | Mitigation Mechanism | Status | OWASP Link |
|---------|---------------|---------------------|--------|------------|
| Provenance type system (USER/SYSTEM/AGENT/EXTERNAL_WEB/EXTERNAL_GIT/EXTERNAL_MAIL) | LLM01 | Segregates external content from trusted context — Mitigation #6 | DONE | [LLM01](https://genai.owasp.org/llm01/) |
| Per-session context tracking | LLM01 | Isolates trust state per session, prevents cross-session injection bleed | DONE | [LLM01](https://genai.owasp.org/llm01/) |
| Trust decay logic | LLM01 | Auto-recovers trust after clean calls, limits injection persistence | DONE | [LLM01](https://genai.owasp.org/llm01/) |
| Provenance tagging on memory::add | LLM01, LLM03 | Tags memory entries with source — prevents poisoned memory from being treated as trusted | TODO | [LLM01](https://genai.owasp.org/llm01/), [LLM03](https://genai.owasp.org/llm03/) |
| Provenance propagation to subagents | LLM01, LLM07 | Subagents inherit parent trust level — prevents privilege escalation via delegation | TODO | [LLM01](https://genai.owasp.org/llm01/), [LLM07](https://genai.owasp.org/llm07/) |

**Categories covered:** LLM01, LLM03, LLM07

### 9b: Memory Guardian

| Control | OWASP Category | Mitigation Mechanism | Status | OWASP Link |
|---------|---------------|---------------------|--------|------------|
| Content classification (FACT vs INSTRUCTION) | LLM01, LLM03 | Pattern-based classifier detects instruction-style injection attempts in memory writes | DONE | [LLM01](https://genai.owasp.org/llm01/), [LLM03](https://genai.owasp.org/llm03/) |
| Instruction-from-EXTERNAL blocking | LLM01 | Blocks INSTRUCTION-type writes from EXTERNAL/LOW provenance sources | DONE | [LLM01](https://genai.owasp.org/llm01/) |
| Provenance tagging on memory entries | LLM01, LLM03 | Every entry stores source, session ID, context hash for auditability | TODO | [LLM01](https://genai.owasp.org/llm01/), [LLM03](https://genai.owasp.org/llm03/) |
| Session-start memory diff | LLM01 | Shows what changed since last session — detects persistent injection | TODO | [LLM01](https://genai.owasp.org/llm01/) |
| TTL enforcement | LLM03 | EXTERNAL=30d, AGENT=90d, USER=indefinite — limits poisoning persistence window | TODO | [LLM03](https://genai.owasp.org/llm03/) |

**Categories covered:** LLM01, LLM03

### 9c: Action Gate

| Control | OWASP Category | Mitigation Mechanism | Status | OWASP Link |
|---------|---------------|---------------------|--------|------------|
| Tool risk classification (GREEN/YELLOW/RED/BLACK, 150+ tools) | LLM08 | Restricts agent actions by risk level — prevents excessive agency | DONE | [LLM08](https://genai.owasp.org/llm08/) |
| Read→write sequence detection | LLM01, LLM08 | EXTERNAL read drops trust, blocks subsequent RED/YELLOW tool calls | DONE | [LLM01](https://genai.owasp.org/llm01/), [LLM08](https://genai.owasp.org/llm08/) |
| Gate intercept middleware (pre_tool_call hook) | LLM07, LLM08 | Intercepts every tool call before execution — enforces risk-based confirmation | DONE | [LLM07](https://genai.owasp.org/llm07/), [LLM08](https://genai.owasp.org/llm08/) |
| Confirmation UI | LLM08, LLM09 | Shows trust context + risk level + allow/block/allow-session — human-in-the-loop | TODO | [LLM08](https://genai.owasp.org/llm08/), [LLM09](https://genai.owasp.org/llm09/) |
| Configurable per-skill overrides | LLM07, LLM08 | Skills declare maxRiskLevel — least-privilege per capability | TODO | [LLM07](https://genai.owasp.org/llm07/), [LLM08](https://genai.owasp.org/llm08/) |
| Panic mode toggle | LLM08 | `hermes security panic` — levels up all risk classifications to maximum restriction | DONE | [LLM08](https://genai.owasp.org/llm08/) |

**Categories covered:** LLM01, LLM07, LLM08, LLM09

### 9d: Secret Redaction

| Control | OWASP Category | Mitigation Mechanism | Status | OWASP Link |
|---------|---------------|---------------------|--------|------------|
| Pattern matchers (API keys, JWT, SSH keys, GitHub tokens, AWS keys, connection strings, internal IPs) | LLM06 | Detects and redacts sensitive data before it reaches the model output | DONE | [LLM06](https://genai.owasp.org/llm06/) |
| Tool output interception (transform_terminal_output hook) | LLM02, LLM06 | Sanitizes tool outputs before returning to agent — prevents unsafe output propagation | DONE | [LLM02](https://genai.owasp.org/llm02/), [LLM06](https://genai.owasp.org/llm06/) |
| Configurable allowlist | LLM06 | Internal IPs preserved for cluster-status context; config files preserve IPs — reduces false positives | DONE | [LLM06](https://genai.owasp.org/llm06/) |
| Redaction logging | LLM06 | Logs what was redacted (pattern name, tool, session) — audit trail for data leakage | TODO | [LLM06](https://genai.owasp.org/llm06/) |

**Categories covered:** LLM02, LLM06

### 9e: Network Egress Control

| Control | OWASP Category | Mitigation Mechanism | Status | OWASP Link |
|---------|---------------|---------------------|--------|------------|
| Agent network namespace | LLM06, LLM10 | Isolates agent network — prevents data exfiltration and model extraction | TODO | [LLM06](https://genai.owasp.org/llm06/), [LLM10](https://genai.owasp.org/llm10/) |
| Egress whitelist | LLM06 | Only allows github.com, nexus:5000, kubernetes API, SearXNG, gateway — blocks exfil channels | TODO | [LLM06](https://genai.owasp.org/llm06/) |
| nftables/iptables rules | LLM06 | NixOS module for agent network restrictions — OS-level enforcement | TODO | [LLM06](https://genai.owasp.org/llm06/) |
| Block DNS tunneling | LLM06 | Restrict nameserver to cluster DNS only — prevents covert exfiltration channel | TODO | [LLM06](https://genai.owasp.org/llm06/) |

**Categories covered:** LLM06, LLM10

### 9f: Audit & Monitoring

| Control | OWASP Category | Mitigation Mechanism | Status | OWASP Link |
|---------|---------------|---------------------|--------|------------|
| SQLite audit log (append-only at ~/.hermes/agent-firewall/audit.db) | LLM01, LLM06, LLM08 | Records gate decisions, redactions, trust changes — forensic trail for all OWASP-relevant events | DONE | [LLM01](https://genai.owasp.org/llm01/), [LLM06](https://genai.owasp.org/llm06/), [LLM08](https://genai.owasp.org/llm08/) |
| Grafana dashboard | LLM01, LLM06, LLM08 | Call rate, rejection rate, provenance distribution, anomaly scores — visibility into attack surface | TODO | [LLM01](https://genai.owasp.org/llm01/), [LLM06](https://genai.owasp.org/llm06/), [LLM08](https://genai.owasp.org/llm08/) |
| Anomaly detection rules | LLM01, LLM08 | Spike in YELLOW/RED calls, too much EXTERNAL provenance — detects active injection campaigns | TODO | [LLM01](https://genai.owasp.org/llm01/), [LLM08](https://genai.owasp.org/llm08/) |
| Alerting | LLM01, LLM06, LLM08 | Prometheus alerts for repeated BLOCKED actions — real-time incident response | TODO | [LLM01](https://genai.owasp.org/llm01/), [LLM06](https://genai.owasp.org/llm06/), [LLM08](https://genai.owasp.org/llm08/) |

**Categories covered:** LLM01, LLM06, LLM08

### 9g: Sandbox Escalation

| Control | OWASP Category | Mitigation Mechanism | Status | OWASP Link |
|---------|---------------|---------------------|--------|------------|
| Default microVM for subagents | LLM07, LLM10 | Subagents run in microVMs with no host access — contains plugin exploits and model extraction | TODO | [LLM07](https://genai.owasp.org/llm07/), [LLM10](https://genai.owasp.org/llm10/) |
| Restricted securityContext | LLM07 | No hostPath mounts, read-only root, no privilege escalation — limits plugin attack surface | TODO | [LLM07](https://genai.owasp.org/llm07/) |
| Reduced capabilities for EXTERNAL-trusted subagents | LLM01, LLM07, LLM08 | File writes disabled, network restricted — untrusted agents get minimal permissions | TODO | [LLM01](https://genai.owasp.org/llm01/), [LLM07](https://genai.owasp.org/llm07/), [LLM08](https://genai.owasp.org/llm08/) |

**Categories covered:** LLM01, LLM07, LLM08, LLM10

### 9h: MCP Server Hardening

| Control | OWASP Category | Mitigation Mechanism | Status | OWASP Link |
|---------|---------------|---------------------|--------|------------|
| Tool argument validation | LLM02, LLM07 | Validate all inputs before processing — prevents injection via tool parameters | TODO | [LLM02](https://genai.owasp.org/llm02/), [LLM07](https://genai.owasp.org/llm07/) |
| Rate limiting per client | LLM04 | Prevent tool call flooding — mitigates resource exhaustion attacks | TODO | [LLM04](https://genai.owasp.org/llm04/) |
| Session isolation | LLM01, LLM06 | Separate state per session — prevents cross-session data leakage and injection | TODO | [LLM01](https://genai.owasp.org/llm01/), [LLM06](https://genai.owasp.org/llm06/) |
| Output sanitization | LLM02 | Sanitize outputs before returning to agent — prevents unsafe output handling | TODO | [LLM02](https://genai.owasp.org/llm02/) |

**Categories covered:** LLM01, LLM02, LLM04, LLM06, LLM07

### 9i: Supply Chain Verification

| Control | OWASP Category | Mitigation Mechanism | Status | OWASP Link |
|---------|---------------|---------------------|--------|------------|
| Container image digest pinning | LLM05 | All K8s images use sha256: digest — prevents tampered container deployment | TODO | [LLM05](https://genai.owasp.org/llm05/) |
| MCP server integrity checks | LLM05 | SHA-256 of binaries at startup — detects binary tampering | TODO | [LLM05](https://genai.owasp.org/llm05/) |
| Model weight verification | LLM05, LLM10 | Verify SHA-256 of weights before loading — prevents poisoned model loading and theft | TODO | [LLM05](https://genai.owasp.org/llm05/), [LLM10](https://genai.owasp.org/llm10/) |

**Categories covered:** LLM05, LLM10

### 9j: OWASP Threat Model Mapping

| Control | OWASP Category | Mitigation Mechanism | Status | OWASP Link |
|---------|---------------|---------------------|--------|------------|
| OWASP category mapping per phase | ALL | This document — every control cross-referenced to LLM01–LLM10 | DONE | [Top 10](https://genai.owasp.org/llm-top-10/) |
| Compliance dashboard | ALL | Grafana panel showing coverage across categories — tracks security posture | TODO | [Top 10](https://genai.owasp.org/llm-top-10/) |
| Penetration testing framework | ALL | Simulate known injection patterns against own defenses — validates all categories | TODO | [Top 10](https://genai.owasp.org/llm-top-10/) |

**Categories covered:** ALL (LLM01–LLM10)

---

## OWASP Category Coverage Summary

| OWASP Category | Phase 9 Coverage | Controls Addressing It | Gap Analysis |
|---------------|-----------------|----------------------|--------------|
| **LLM01: Prompt Injection** | STRONG | 9a (provenance, session tracking, trust decay), 9b (content classification, EXTERNAL blocking), 9c (read→write detection), 9f (audit log, anomaly detection), 9g (reduced capabilities), 9h (session isolation) | All controls DONE or TODO with clear mitigation path |
| **LLM02: Insecure Output Handling** | PARTIAL | 9d (output interception), 9h (argument validation, output sanitization) | MCP server output sanitization (9h) is TODO — existing `sanitizeOutput()` in mcp-server covers LLM07 but not full LLM02 |
| **LLM03: Training Data Poisoning** | PARTIAL | 9a (provenance tagging on memory), 9b (content classification, TTL enforcement) | All memory-related controls are TODO — no active training data verification |
| **LLM04: Model Denial of Service** | WEAK | 9h (rate limiting per client) | Only one control, all TODO — no token budget enforcement, no context window limits |
| **LLM05: Supply Chain Vulnerabilities** | PARTIAL | 9i (image digest pinning, integrity checks, weight verification) | All controls TODO — no active supply chain verification in place |
| **LLM06: Sensitive Information Disclosure** | STRONG | 9d (pattern matchers, output interception, allowlist), 9e (network isolation, egress whitelist), 9f (audit log, alerting), 9h (session isolation) | Secret redaction DONE; network controls (9e) all TODO |
| **LLM07: Insecure Plugin Design** | STRONG | 9a (provenance propagation), 9c (gate intercept, skill overrides), 9g (microVM, securityContext, reduced capabilities), 9h (argument validation) | Gate intercept DONE; sandbox and MCP hardening TODO |
| **LLM08: Excessive Agency** | STRONG | 9c (risk classification, sequence detection, gate intercept, panic mode), 9f (audit log, anomaly detection), 9g (reduced capabilities) | Action gate controls DONE; monitoring TODO |
| **LLM09: Overreliance** | WEAK | 9c (confirmation UI, human-in-the-loop) | Only confirmation UI addresses this — TODO. No automated fact-checking or source verification |
| **LLM10: Model Theft** | WEAK | 9e (network namespace), 9g (microVM isolation), 9i (weight verification) | All controls TODO — no active model theft prevention |

### Coverage Legend

| Level | Definition |
|-------|-----------|
| STRONG | 3+ controls, at least 1 DONE, clear mitigation for all TODOs |
| PARTIAL | 1–2 controls, mix of DONE/TODO, gaps exist but path forward is clear |
| WEAK | 1 control or all TODOs, significant gaps, needs dedicated work |

---

## Coverage Gap Priorities

| Priority | Gap | Recommended Action | Effort |
|----------|-----|-------------------|--------|
| P1 | LLM04: No DoS protection | Add token budget enforcement + context window limits to MCP server | 1-2 days |
| P1 | LLM09: No overreliance protection | Add confirmation UI for RED/BLACK tool calls (9c) + source citation requirement | 2-3 days |
| P1 | LLM10: No model theft protection | Implement network egress control (9e) + weight verification (9i) | 3-5 days |
| P2 | LLM03: No active training data verification | Implement memory provenance tagging + TTL enforcement (9b) | 1-2 days |
| P2 | LLM05: No active supply chain verification | Implement container digest pinning + MCP integrity checks (9i) | 1-2 days |
| P3 | LLM02: MCP output sanitization incomplete | Complete 9h output sanitization + argument validation | 1 day |

---

## OWASP Documentation Links

| Category | Primary Guide | Mitigations | MCP-Specific |
|----------|--------------|-------------|--------------|
| LLM01: Prompt Injection | [Guide](https://genai.owasp.org/llm01/) | [Mitigations](https://genai.owasp.org/llm01/#mitigations) | [MCP Guide](https://genai.owasp.org/) |
| LLM02: Insecure Output Handling | [Guide](https://genai.owasp.org/llm02/) | [Mitigations](https://genai.owasp.org/llm02/#mitigations) | — |
| LLM03: Training Data Poisoning | [Guide](https://genai.owasp.org/llm03/) | [Mitigations](https://genai.owasp.org/llm03/#mitigations) | — |
| LLM04: Model Denial of Service | [Guide](https://genai.owasp.org/llm04/) | [Mitigations](https://genai.owasp.org/llm04/#mitigations) | — |
| LLM05: Supply Chain Vulnerabilities | [Guide](https://genai.owasp.org/llm05/) | [Mitigations](https://genai.owasp.org/llm05/#mitigations) | — |
| LLM06: Sensitive Information Disclosure | [Guide](https://genai.owasp.org/llm06/) | [Mitigations](https://genai.owasp.org/llm06/#mitigations) | — |
| LLM07: Insecure Plugin Design | [Guide](https://genai.owasp.org/llm07/) | [Mitigations](https://genai.owasp.org/llm07/#mitigations) | [MCP Guide](https://genai.owasp.org/), [Third-Party MCP Cheat Sheet](https://genai.owasp.org/) |
| LLM08: Excessive Agency | [Guide](https://genai.owasp.org/llm08/) | [Mitigations](https://genai.owasp.org/llm08/#mitigations) | — |
| LLM09: Overreliance | [Guide](https://genai.owasp.org/llm09/) | [Mitigations](https://genai.owasp.org/llm09/#mitigations) | — |
| LLM10: Model Theft | [Guide](https://genai.owasp.org/llm10/) | [Mitigations](https://genai.owasp.org/llm10/#mitigations) | — |

### Additional OWASP Resources

- [OWASP GenAI Security Project](https://genai.owasp.org/)
- [OWASP Agentic Security Initiative](https://genai.owasp.org/)
- [OWASP MCP Server Development Guide](https://genai.owasp.org/)
- [OWASP Third-Party MCP Cheat Sheet v1.0](https://genai.owasp.org/)
- [Project Mission and Charter](https://genai.owasp.org/project-mission-and-charter/)

---

## ROADMAP.md Category Numbering Note

The ROADMAP.md file uses OWASP category references that predate the v1.1 release. The mapping between ROADMAP.md references and this document:

| ROADMAP.md Reference | This Document (v1.1) |
|---------------------|---------------------|
| LLM01:2025 (#6) — Segregate external content | LLM01: Prompt Injection |
| LLM05:2025 — Improper Output Handling | LLM02: Insecure Output Handling |
| LLM06:2025 — Excessive Agency | LLM08: Excessive Agency |
| LLM03:2025 — Supply Chain | LLM05: Supply Chain Vulnerabilities |
| LLM07 (mcp-server/src/server.ts) | LLM02: Insecure Output Handling (sanitization) |

The ROADMAP.md references align with the 2025 draft numbering. This document uses the stable v1.1 release numbering. Both reference the same underlying categories — only the IDs differ.
