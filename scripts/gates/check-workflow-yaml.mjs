#!/usr/bin/env node
// Fail if any workflow file is not valid YAML.
//
// Why this gate exists: an invalid workflow file is not a loud failure. GitHub
// records the run, starts zero jobs, and marks it failed — which looks like an
// infrastructure problem rather than a syntax error, and sends people looking
// at runner labels and secrets instead of at the file. Two workflows in this
// repository have been broken this way and neither was noticed:
//
//   * deploy-prod.yml had a `run: |` block whose first body line was indented
//     further than the rest. Its last eight runs all failed with zero jobs.
//   * portal-artifact-drift.yml had a heredoc body at column 0 inside a `run: |`
//     block, which ends the block scalar early and leaves the remaining lines
//     to be parsed as YAML. Added and green-checked, then broken by the same
//     mistake while writing its own failure message.
//
// The recurring cause is a heredoc inside a block scalar. YAML takes the block
// indentation from its first non-empty line, so any later line at column 0
// terminates the scalar. This gate does not try to prevent that; it makes the
// consequence impossible to miss.
//
// No dependencies: it shells out to whichever Python is present, because the
// repo has no YAML parser of its own in the root package.

import { readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { argv, exit } from 'node:process'

const WORKFLOW_DIR = '.github/workflows'

function listWorkflows(dir) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    console.error(`workflow-yaml: ${dir} not found`)
    exit(2)
  }
  for (const name of entries) {
    // `.disabled` files are kept deliberately and are not loaded by GitHub.
    if (!/\.ya?ml$/.test(name)) continue
    const p = join(dir, name)
    if (!statSync(p).isFile()) continue
    out.push(p)
  }
  return out.sort()
}

// Find a Python that can import yaml. Returns null if none can, which the
// caller reports rather than silently passing.
function findPython() {
  const candidates = ['python3', '/usr/bin/python3', 'python']
  for (const py of candidates) {
    try {
      execFileSync(py, ['-c', 'import yaml'], { stdio: 'ignore' })
      return py
    } catch {
      /* try the next one */
    }
  }
  return null
}

const files = listWorkflows(WORKFLOW_DIR)
if (files.length === 0) {
  console.error('workflow-yaml: no workflow files found')
  exit(2)
}

const py = findPython()
if (!py) {
  // Passing here would make the gate decorative. Say so and fail, so the gap is
  // visible rather than discovered the next time a workflow silently dies.
  console.error('workflow-yaml: no python3 with PyYAML available; cannot validate.')
  console.error('workflow-yaml: install PyYAML, or run this check somewhere that has it.')
  exit(2)
}

const script = [
  'import sys, yaml',
  'for path in sys.argv[1:]:',
  '    try:',
  "        doc = yaml.safe_load(open(path, encoding='utf-8'))",
  '    except Exception as exc:',
  '        print(f"FAIL {path}: {exc}")',
  '        sys.exit(1)',
  '    if not isinstance(doc, dict):',
  '        print(f"FAIL {path}: top level is {type(doc).__name__}, expected a mapping")',
  '        sys.exit(1)',
  "    # A bare 'on' key is parsed as the boolean True by YAML 1.1, so accept either.",
  "    if True not in doc and 'on' not in doc:",
  '        print(f"FAIL {path}: no trigger key (on)")',
  '        sys.exit(1)',
  "    jobs = doc.get('jobs')",
  '    if not isinstance(jobs, dict) or not jobs:',
  '        print(f"FAIL {path}: no jobs defined")',
  '        sys.exit(1)',
  'print(f"OK {len(sys.argv)-1} workflow files")',
].join('\n')

let failed = false
try {
  const out = execFileSync(py, ['-c', script, ...files], { encoding: 'utf8' })
  process.stdout.write(out)
} catch (e) {
  failed = true
  if (e.stdout) process.stdout.write(e.stdout)
  if (e.stderr) process.stderr.write(e.stderr)
  console.error('')
  console.error('An invalid workflow file means GitHub schedules zero jobs for it and')
  console.error('reports the run as failed with no indication of a syntax error. The usual')
  console.error('cause is a heredoc inside a `run: |` block whose body is not indented to')
  console.error('match the block, which ends the scalar early.')
}

if (failed) exit(1)

// A second heuristic — "a heredoc opened in a step must be closed in it" — was
// written and removed. It flagged live-data-check.yml, where `failures<<EOF`
// appears inside a string being written to $GITHUB_ENV and is not a heredoc at
// all. Distinguishing the two needs real shell parsing, and a gate that fails
// on valid input is worse than no gate: it gets ignored, and then it is not
// catching the real thing either. The YAML parse is the check with proven
// value — it is what caught both of the bugs quoted above.

console.log('workflow-yaml: OK')
