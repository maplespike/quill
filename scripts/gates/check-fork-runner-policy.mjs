#!/usr/bin/env node
// Fail when a workflow can run untrusted fork code on a self-hosted runner.
//
// `on: pull_request` uses the workflow file from the merge commit. GitHub
// withholds secrets from a fork pull request and gives that job a read-only
// token. The runner still has to be GitHub-hosted. A fork can replace the
// workflow file, so this gate checks the files in this repository. The runner
// hook scripts/ci/refuse-untrusted-self-hosted.sh is the backstop.
//
// Contract:
// 1. No `pull_request_target` job checks out the pull request head.
// 2. No self-hosted `runs-on` is reachable by a fork `pull_request`,
//    `pull_request_target`, or `workflow_call`.
// 3. A self-hosted `workflow_run` job skips a fork head repository and does
//    not check out the triggering SHA.
//
// Self-hosted means the `self-hosted` label or an ARC runner scale set
// (`arc-<name>`, e.g. `arc-maplespike` on sentry). Both run on the homelab.
//
// A runs-on expression is fork-safe when a fork evaluates it to
// `ubuntu-latest`. The safe form keeps self-hosted on the same-repo side:
//
//   (github.event_name != 'pull_request' || head.repo.full_name == github.repository)
//     && 'arc-maplespike' || 'ubuntu-latest'
//
// (`fromJSON('["self-hosted", ...]')` in place of `'arc-maplespike'` is
// treated the same way.)
//
// `head.repo.full_name != github.repository` selecting self-hosted fails.

import { readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { argv, exit } from 'node:process';

const dir = argv[2] || '.github/workflows';

function findPython() {
  for (const py of ['python3', '/usr/bin/python3', 'python']) {
    try {
      execFileSync(py, ['-c', 'import yaml'], { stdio: 'ignore' });
      return py;
    } catch {
      /* next */
    }
  }
  return null;
}

function listWorkflows(workflowDir) {
  let entries;
  try {
    entries = readdirSync(workflowDir);
  } catch {
    console.error(`fork-runner: ${workflowDir} not found`);
    exit(2);
  }
  return entries
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => join(workflowDir, name))
    .filter((p) => statSync(p).isFile())
    .sort();
}

function loadWorkflows(py, files) {
  const script = `
import json, sys, yaml
def triggers(doc):
    on = None
    for key, value in doc.items():
        if key is True or key == "on":
            on = value
    if on is None:
        return {}
    if isinstance(on, str):
        return {on: {}}
    if isinstance(on, list):
        return {str(k): {} for k in on}
    if isinstance(on, dict):
        return {str(k): v for k, v in on.items()}
    return {}
out = []
for path in sys.argv[1:]:
    doc = yaml.safe_load(open(path, encoding="utf-8"))
    if not isinstance(doc, dict):
        doc = {}
    out.append({
        "path": path,
        "on": triggers(doc),
        "jobs": doc.get("jobs") or {},
    })
print(json.dumps(out))
`;
  const raw = execFileSync(py, ['-c', script, ...files], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(raw);
}

function runsOnText(runsOn) {
  if (Array.isArray(runsOn)) return runsOn.join(' ');
  if (typeof runsOn === 'string') return runsOn;
  return '';
}

// ARC runner scale sets are selected by their scale-set name, not by the
// `self-hosted` label, so they need their own match.
const ARC_LABEL = /(^|[^\w-])arc-[a-z0-9][a-z0-9-]*/;

function isSelfHostedLabel(text) {
  return text.includes('self-hosted') || ARC_LABEL.test(text);
}

function mentionsSelfHosted(runsOn) {
  return isSelfHostedLabel(runsOnText(runsOn));
}

function ifText(job) {
  if (!job || job.if == null || job.if === '') return '';
  if (typeof job.if === 'boolean') return job.if ? 'true' : 'false';
  return String(job.if);
}

function stepsOf(job) {
  return Array.isArray(job?.steps) ? job.steps : [];
}

function runText(step) {
  return typeof step?.run === 'string' ? step.run : '';
}

function checksOutPrHead(step) {
  const run = runText(step);
  if (/git\s+checkout/.test(run) && /pull_request\.head|github\.head_ref/.test(run)) return true;
  if (typeof step?.uses !== 'string' || !step.uses.startsWith('actions/checkout@')) return false;
  const with_ = step.with || {};
  const blob = `${with_.ref ?? ''}\n${with_.repository ?? ''}`;
  return /pull_request\.head|github\.head_ref/.test(blob);
}

function checksOutTriggeringSha(step) {
  if (typeof step?.uses !== 'string' || !step.uses.startsWith('actions/checkout@')) return false;
  const ref = String(step.with?.ref ?? '');
  return /workflow_run\.head_sha|pull_request\.head/.test(ref);
}

function truthy(value) {
  return value !== 'false';
}

function exprAnd(left, right) {
  if (left === 'false') return 'false';
  if (left === 'UNKNOWN') return right === 'false' ? 'false' : 'UNKNOWN';
  return right;
}

function exprOr(left, right) {
  if (left === 'false') return right;
  if (left === 'UNKNOWN') {
    return right === 'false' || right === 'UNKNOWN' ? 'UNKNOWN' : right;
  }
  return left;
}

function substitute(expr, scenario) {
  let text = String(expr).trim();
  if (text.startsWith('${{') && text.endsWith('}}')) {
    text = text.slice(3, -2).trim();
  }
  text = text.replace(/fromJSON\(\s*'([^']*)'\s*\)/g, (_, inner) => (
    isSelfHostedLabel(inner) ? 'SELF' : 'OTHER'
  ));
  text = text.replace(/fromJSON\(\s*"([^"]*)"\s*\)/g, (_, inner) => (
    isSelfHostedLabel(inner) ? 'SELF' : 'OTHER'
  ));
  text = text.replace(/'ubuntu-latest'|"ubuntu-latest"/g, 'UBUNTU');
  text = text.replace(/'self-hosted'|"self-hosted"/g, 'SELF');
  text = text.replace(/'arc-[a-z0-9][a-z0-9-]*'|"arc-[a-z0-9][a-z0-9-]*"/g, 'SELF');
  const pairs = [
    ['github.event.pull_request.head.repo.full_name == github.repository', scenario.headSame],
    ['github.event.pull_request.head.repo.full_name != github.repository', !scenario.headSame],
    ['github.event.workflow_run.head_repository.full_name == github.repository', scenario.headSame],
    ['github.event.workflow_run.head_repository.full_name != github.repository', !scenario.headSame],
    ["github.event_name != 'pull_request_target'", scenario.event !== 'pull_request_target'],
    ["github.event_name != 'pull_request'", scenario.event !== 'pull_request'],
    ["github.event_name == 'pull_request_target'", scenario.event === 'pull_request_target'],
    ["github.event_name == 'pull_request'", scenario.event === 'pull_request'],
    ["github.event_name == 'push'", scenario.event === 'push'],
    ["github.ref == 'refs/heads/prod'", scenario.ref === 'refs/heads/prod'],
  ];
  for (const [needle, value] of pairs) {
    text = text.split(needle).join(value ? 'true' : 'false');
  }
  text = text.replace(
    /[A-Za-z_][\w.]*\s*(?:==|!=|>=|<=)\s*(?:'[^']*'|"[^"]*"|[A-Za-z_][\w.]*)/g,
    'UNKNOWN',
  );
  return text;
}

function evaluate(expr, scenario) {
  const text = substitute(expr, scenario);
  let i = 0;
  function skip() {
    while (text[i] === ' ' || text[i] === '\n' || text[i] === '\t') i += 1;
  }
  function parseOr() {
    let left = parseAnd();
    skip();
    while (text.startsWith('||', i)) {
      i += 2;
      left = exprOr(left, parseAnd());
      skip();
    }
    return left;
  }
  function parseAnd() {
    let left = parseUnary();
    skip();
    while (text.startsWith('&&', i)) {
      i += 2;
      left = exprAnd(left, parseUnary());
      skip();
    }
    return left;
  }
  function parseUnary() {
    skip();
    if (text[i] === '!') {
      i += 1;
      const value = parseUnary();
      if (value === 'UNKNOWN') return 'UNKNOWN';
      return truthy(value) ? 'false' : 'true';
    }
    return parsePrimary();
  }
  function parsePrimary() {
    skip();
    if (text[i] === '(') {
      i += 1;
      const value = parseOr();
      skip();
      if (text[i] !== ')') return 'UNKNOWN';
      i += 1;
      return value;
    }
    const match = /^(true|false|SELF|UBUNTU|OTHER|UNKNOWN)/.exec(text.slice(i));
    if (!match) return 'UNKNOWN';
    i += match[0].length;
    return match[0];
  }
  const value = parseOr();
  skip();
  if (i !== text.length) return 'UNKNOWN';
  return value;
}

function jobSkipped(job, scenario) {
  const text = ifText(job).trim();
  if (!text) return false;
  const value = evaluate(text, scenario);
  return value === 'false';
}

function runnerFor(job, scenario) {
  const runsOn = job['runs-on'];
  if (Array.isArray(runsOn) || (typeof runsOn === 'string' && !runsOn.includes('${{'))) {
    return mentionsSelfHosted(runsOn) ? 'SELF' : 'OTHER';
  }
  if (typeof runsOn !== 'string') return 'UNKNOWN';
  return evaluate(runsOn, scenario);
}

const files = listWorkflows(dir);
if (files.length === 0) {
  console.error(`fork-runner: no workflow files in ${dir}`);
  exit(2);
}
const py = findPython();
if (!py) {
  console.error('fork-runner: no python3 with PyYAML available.');
  exit(2);
}

const workflows = loadWorkflows(py, files);
const failures = [];

function fail(path, message) {
  failures.push(`${path}: ${message}`);
}

for (const wf of workflows) {
  const triggers = Object.keys(wf.on || {});
  const jobs = wf.jobs && typeof wf.jobs === 'object' ? wf.jobs : {};
  const scenarios = [];
  if (triggers.includes('pull_request') || triggers.includes('workflow_call')) {
    scenarios.push({ event: 'pull_request', headSame: false, ref: 'refs/pull/1/merge' });
  }
  if (triggers.includes('pull_request_target')) {
    scenarios.push({ event: 'pull_request_target', headSame: false, ref: 'refs/heads/main' });
  }

  for (const [name, job] of Object.entries(jobs)) {
    if (!job || typeof job !== 'object') continue;
    const where = `${wf.path} job ${name}`;
    const steps = stepsOf(job);

    if (triggers.includes('pull_request_target')) {
      if (steps.some(checksOutPrHead)) {
        fail(where, 'pull_request_target must not check out the pull request head.');
      }
    }

    if (job['runs-on'] == null) continue;
    if (!mentionsSelfHosted(job['runs-on'])) continue;

    for (const scenario of scenarios) {
      if (jobSkipped(job, scenario)) continue;
      const runner = runnerFor(job, scenario);
      if (runner === 'SELF' || runner === 'UNKNOWN') {
        fail(where, `a fork ${scenario.event} can reach a self-hosted runner.`);
      }
    }

    if (triggers.includes('workflow_run')) {
      const scenario = { event: 'workflow_run', headSame: false, ref: '' };
      if (!jobSkipped(job, scenario)) {
        const runner = runnerFor(job, scenario);
        if (runner === 'SELF' || runner === 'UNKNOWN') {
          fail(where, 'a fork workflow_run can reach a self-hosted runner.');
        }
      }
      if (steps.some(checksOutTriggeringSha)) {
        fail(where, 'workflow_run must not check out the triggering head on a self-hosted runner.');
      }
    }
  }
}

if (failures.length) {
  for (const line of failures) console.error(`FAIL ${line}`);
  exit(1);
}
console.log(`OK ${workflows.length} workflow files`);
