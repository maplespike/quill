#!/usr/bin/env node
// Write a pin block into charts/quill/values-prod.yaml.
//
// Why this exists: the real deploy path is pin-images.sh -> values-prod.yaml ->
// commit -> ArgoCD. pin-images.sh prints a block for a human to paste, so the
// step where an actual deploy gets recorded is a manual edit. That is fine when
// an operator is watching and a liability when a workflow is driving: a bot
// that cannot paste will either skip the commit (deploy silently does nothing)
// or hand-edit YAML (which is how the pin block ends up wrong).
//
// The edit is line-based rather than a YAML round-trip on purpose. A parse and
// re-emit would discard every comment in the file, and those comments are the
// only record of why `pullPolicy: Never` and the empty `image.tag` are correct.
// Rewriting them away would be a silent loss on every deploy.
//
// Usage:
//   node scripts/apply-image-pins.mjs --values charts/quill/values-prod.yaml < pin-block.txt
//   node scripts/apply-image-pins.mjs --values ... --json pins.json
//
// Input is either the human-readable block pin-images.sh prints, or JSON of the
// form {"api":{"digest":"sha256:...","tag":"..."}, ...}.

import { readFileSync, writeFileSync } from 'node:fs'
import { argv, exit, stdin } from 'node:process'

function fail(msg) {
  console.error(`apply-image-pins: ${msg}`)
  exit(1)
}

const args = argv.slice(2)
const valuesIdx = args.indexOf('--values')
const jsonIdx = args.indexOf('--json')
const valuesPath = valuesIdx === -1 ? 'charts/quill/values-prod.yaml' : args[valuesIdx + 1]
if (valuesIdx !== -1 && !valuesPath) fail('--values needs a path')

// ---- read input -------------------------------------------------------------
let raw = ''
if (jsonIdx !== -1) {
  const p = args[jsonIdx + 1]
  if (!p) fail('--json needs a path')
  raw = readFileSync(p, 'utf8')
} else {
  raw = readFileSync(0, 'utf8') // piped pin block
}

// Accept both shapes so the same script serves a human and a workflow.
let pins = {}
if (jsonIdx !== -1) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    fail(`--json input is not valid JSON: ${e.message}`)
  }
  for (const [svc, v] of Object.entries(parsed)) {
    if (!v?.digest) fail(`json pin for "${svc}" has no digest`)
    pins[svc] = { digest: v.digest, tag: v.tag ?? '' }
  }
} else {
  // pin-images.sh emits, under a `images:` heading:
  //   api:
  //     digest: "sha256:..."
  //     tag: "2026-09-25-..."
  const re = /^\s{2}([a-z][a-z0-9-]*):\s*$\n\s{4}digest:\s*"([^"]+)"\s*$\n\s{4}tag:\s*"([^"]*)"\s*$/gm
  let m
  while ((m = re.exec(raw)) !== null) {
    pins[m[1]] = { digest: m[2], tag: m[3] }
  }
}

const services = Object.keys(pins)
if (services.length === 0) {
  fail('no pins found in input. Expected lines like:\n  api:\n    digest: "sha256:..."\n    tag: "..."')
}

for (const [svc, v] of Object.entries(pins)) {
  if (!/^sha256:[0-9a-f]{64}$/.test(v.digest)) {
    fail(`pin for "${svc}" is not a sha256 digest: ${v.digest}`)
  }
}

// ---- rewrite ----------------------------------------------------------------
let text = readFileSync(valuesPath, 'utf8')
const lines = text.split('\n')

// Locate the top-level `images:` key. Anchoring at column 0 is what keeps this
// from matching the `images:` that appears inside a comment or a nested block.
const start = lines.findIndex((l) => /^images:\s*$/.test(l))
if (start === -1) fail(`no top-level "images:" key in ${valuesPath}`)

let end = lines.length
for (let i = start + 1; i < lines.length; i++) {
  if (/^[A-Za-z]/.test(lines[i])) {
    end = i
    break
  }
}

const applied = []
const missing = []
for (let i = start + 1; i < end; i++) {
  const svc = lines[i].match(/^ {2}([a-z][a-z0-9-]*):\s*$/)
  if (!svc) continue
  const name = svc[1]
  if (!pins[name]) {
    missing.push(name)
    continue
  }
  // Replace the digest/tag lines belonging to this service.
  for (let j = i + 1; j < end; j++) {
    if (/^ {2}[a-z]/.test(lines[j])) break // next service
    if (/^ {4}digest:/.test(lines[j])) {
      lines[j] = `    digest: "${pins[name].digest}"`
      applied.push(`${name} digest`)
    } else if (/^ {4}tag:/.test(lines[j])) {
      lines[j] = `    tag: "${pins[name].tag}"`
      applied.push(`${name} tag`)
    }
  }
}

for (const svc of services) {
  if (!applied.some((a) => a.startsWith(`${svc} `))) {
    fail(`pin supplied for "${svc}" but ${valuesPath} has no \`${svc}:\` entry under images:`)
  }
}

if (missing.length) {
  console.error(`apply-image-pins: WARNING not in pin block, left untouched: ${missing.join(', ')}`)
}

const out = lines.join('\n')
if (out === text) {
  console.log('apply-image-pins: no change (pins already current)')
} else {
  writeFileSync(valuesPath, out, 'utf8')
  console.log(`apply-image-pins: updated ${applied.length} fields for ${[...new Set(services)].join(', ')} in ${valuesPath}`)
}
