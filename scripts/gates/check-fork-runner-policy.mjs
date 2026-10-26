#!/usr/bin/env node
// Fail when a workflow can run untrusted fork code on a self-hosted runner.
//
// `on: pull_request` uses the workflow file from the merge commit. A fork can
// delete every `if` and set `runs-on: [self-hosted, nixos]`. Those runners
// share the host home directory and can reach the cluster.
//
// Contract:
// 1. No workflow uses the `pull_request` trigger. Use `pull_request_target`
//    so the workflow file is the base branch.
// 2. A self-hosted job on `pull_request_target` must require a same-repo head,
//    require `github.event_name == 'push'`, or send forks to ubuntu-latest.
//    The split form starts with the inline refuse step, checks out the head
//    SHA with persist-credentials false, and clears GITHUB_TOKEN before
//    repository code.
// 3. A self-hosted `workflow_run` job must require
//    head_repository.full_name == github.repository, and must not check out
//    the triggering SHA.
// 4. A job that can run for a fork must not read `secrets.*`, must not have
//    a write token, and must not run `git commit`.
// 5. A self-hosted `workflow_call` job must skip untrusted pull_request events
//    unless the head repository is this repository.
//
// A workflow file added by the fork is not in the base tree, so this gate
// cannot see it. scripts/ci/refuse-untrusted-self-hosted.sh is the runner
// hook that refuses that job. Install it on each self-hosted runner.

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
        "permissions": doc.get("permissions"),
        "env": doc.get("env"),
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

function isSelfHosted(runsOn) {
  return runsOnText(runsOn).includes('self-hosted');
}

function isDynamicRunner(runsOn) {
  const text = runsOnText(runsOn);
  return text.includes('ubuntu-latest')
    && text.includes('self-hosted')
    && text.includes('head.repo.full_name != github.repository');
}

function ifText(job) {
  const value = job && job.if;
  return typeof value === 'string' ? value : '';
}

function restrictsToTrusted(job) {
  const text = ifText(job);
  if (text.includes('head.repo.full_name == github.repository')) return true;
  if (text.includes('head_repository.full_name == github.repository')) return true;
  if (text.includes("github.event_name == 'push'") && !text.includes('pull_request')) return true;
  return false;
}

function effectivePerms(workflowPerms, job) {
  if (job && job.permissions) return job.permissions;
  return workflowPerms ?? null;
}

function hasWrite(perms) {
  if (perms == null) return true;
  if (typeof perms === 'string') return perms !== 'read-all' && perms !== 'read';
  return Object.values(perms).some((value) => String(value).includes('write'));
}

function stepsOf(job) {
  return Array.isArray(job.steps) ? job.steps : [];
}

function runText(step) {
  return typeof step?.run === 'string' ? step.run : '';
}

function usesCheckout(step) {
  return typeof step?.uses === 'string' && step.uses.startsWith('actions/checkout@');
}

const UNTRUSTED_IN_RUN = [
  'github.event.pull_request.title',
  'github.event.pull_request.body',
  'github.event.pull_request.head.ref',
  'github.event.pull_request.head.label',
  'github.head_ref',
  'github.event.workflow_run.head_branch',
  'github.event.workflow_run.name',
  'github.event.workflow_run.html_url',
  'github.event.workflow_run.display_title',
  'github.event.workflow_run.head_commit',
];

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
  if (triggers.includes('pull_request')) {
    fail(wf.path, 'uses on.pull_request. Use pull_request_target so the base workflow chooses the runner.');
  }
  const forkEvents = triggers.includes('pull_request_target') || triggers.includes('workflow_run');
  const jobs = wf.jobs && typeof wf.jobs === 'object' ? wf.jobs : {};

  for (const [name, job] of Object.entries(jobs)) {
    if (!job || typeof job !== 'object') continue;
    const where = `${wf.path} job ${name}`;
    const runsOn = job['runs-on'];
    const selfHosted = isSelfHosted(runsOn);
    const dynamic = isDynamicRunner(runsOn);
    const trusted = restrictsToTrusted(job);
    const steps = stepsOf(job);

    if (triggers.includes('pull_request_target') && selfHosted) {
      if (dynamic) {
        const first = runText(steps[0]);
        if (!first.includes('RUNNER_ENVIRONMENT') || !first.includes('pull_request')) {
          fail(where, 'dynamic runner must start with the inline self-hosted refuse step.');
        }
      } else if (!trusted) {
        fail(where, 'self-hosted pull_request_target job has no same-repo or push-only guard.');
      }
    }

    if (triggers.includes('workflow_run') && selfHosted) {
      if (!ifText(job).includes('head_repository.full_name == github.repository')) {
        fail(where, 'self-hosted workflow_run job must require head_repository.full_name == github.repository.');
      }
      for (const step of steps) {
        if (!usesCheckout(step)) continue;
        const ref = String(step.with?.ref ?? '');
        if (ref.includes('workflow_run.head_sha') || ref.includes('pull_request.head')) {
          fail(where, 'workflow_run must not check out the triggering head on a self-hosted runner.');
        }
      }
    }

    if (triggers.includes('workflow_call') && selfHosted) {
      const text = ifText(job);
      const skipsPullRequest = /!= 'pull_request'(?!_)/.test(text);
      const skipsTarget = text.includes("!= 'pull_request_target'");
      const sameRepo = text.includes('head.repo.full_name == github.repository');
      if (!skipsPullRequest || !skipsTarget || !sameRepo) {
        fail(where, 'self-hosted workflow_call job must skip untrusted pull_request events.');
      }
    }

    const forkCapable = triggers.includes('pull_request_target') && !trusted;
    if (forkCapable) {
      const blob = JSON.stringify(job);
      if (blob.includes('secrets.')) {
        fail(where, 'a job that can run for a fork must not reference secrets.');
      }
      if (hasWrite(effectivePerms(wf.permissions, job))) {
        fail(where, 'a job that can run for a fork must not receive a write token.');
      }
      for (const step of steps) {
        if (/^\s*git commit\b/m.test(runText(step))) {
          fail(where, 'a job that can run for a fork must not git commit.');
        }
      }
      const checkout = steps.find(usesCheckout);
      if (checkout) {
        const creds = checkout.with?.['persist-credentials'];
        if (creds !== false && creds !== 'false') {
          fail(where, 'checkout in a fork-capable job must set persist-credentials: false.');
        }
        const ref = String(checkout.with?.ref ?? '');
        if (!ref.includes('pull_request.head.sha')) {
          fail(where, 'checkout in a fork-capable job must use the pull request head SHA.');
        }
        const dropped = steps.some((step) => (
          runText(step).includes('GITHUB_TOKEN=')
          && ifText(step).includes('head.repo.full_name != github.repository')
        ));
        if (!dropped) {
          fail(where, 'clear GITHUB_TOKEN after checkout and before repository code on a fork.');
        }
      }
    }

    if (forkEvents) {
      for (const step of steps) {
        const run = runText(step);
        for (const needle of UNTRUSTED_IN_RUN) {
          if (run.includes(needle)) {
            fail(where, `pass ${needle} through env, not into run.` );
          }
        }
      }
    }
  }

  const anyForkJob = triggers.includes('pull_request_target') && Object.values(jobs).some((job) => job && !restrictsToTrusted(job));
  if (anyForkJob && JSON.stringify(wf.env ?? {}).includes('secrets.')) {
    fail(wf.path, 'workflow env passes a secret to a job that can run for a fork.');
  }
}

if (failures.length) {
  for (const line of failures) console.error(`FAIL ${line}`);
  exit(1);
}
console.log(`OK ${workflows.length} workflow files`);
