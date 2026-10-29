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
// only record of why `pullPolicy: IfNotPresent` and the registry host are correct.
// Rewriting them away would be a silent loss on every deploy.
//
// Usage:
//   node scripts/apply-image-pins.mjs --migrate --values charts/quill/values-prod.yaml < pin-block.txt
//   node scripts/apply-image-pins.mjs --values charts/quill/values-prod.yaml < pin-block.txt
//   node scripts/apply-image-pins.mjs --values ... --json pins.json
//
// --migrate is the cutover. It HEADs every service digest and, only when all
// of them match, writes registry, repository, pullPolicy IfNotPresent, digest,
// and tag for every service in one file write. A miss throws and does not
// touch the file. Without --migrate the script only replaces digest and tag
// and leaves the legacy docker.io / Never pin in place.
//
// Input is either the human-readable block pin-images.sh prints, or JSON of the
// form {"api":{"digest":"sha256:...","tag":"..."}, ...}.

import { readFileSync, writeFileSync } from 'node:fs'
import { argv, exit } from 'node:process'
import {
  QUILL_IMAGE_SERVICES,
  REGISTRY_HOST,
  parsePinBlock,
  pinCommitDecision,
  readManifestDigest,
  resolveEndpoint,
} from './gates/check-node-images.mjs'

function fail(msg) {
  console.error(`apply-image-pins: ${msg}`)
  exit(1)
}

/**
 * Rewrite values text to the registry pin. Throws, and does not touch the
 * input string's source file, when any service is missing or its registry
 * HEAD did not return that digest.
 */
export function applyMigrationText(valuesText, pins, heads) {
  const decision = pinCommitDecision(pins, heads)
  if (!decision.ok) {
    throw new Error(`refusing pin commit: ${decision.missing.join('; ')}`)
  }
  const lines = String(valuesText).split('\n')
  const start = lines.findIndex((line) => /^images:\s*$/.test(line))
  if (start === -1) throw new Error('refusing pin commit: no top-level images: block')
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    // A top-level key or a column-0 comment ends the images map. The CPU-order
    // comment sits between search and affinityHosts and must survive the rewrite.
    if (/^[A-Za-z#]/.test(lines[i])) {
      end = i
      break
    }
  }
  const ranges = []
  for (let i = start + 1; i < end; i++) {
    const svc = lines[i].match(/^ {2}([a-z][a-z0-9-]*):\s*$/)
    if (!svc) continue
    let j = i + 1
    while (j < end && !/^ {2}[a-z]/.test(lines[j])) j++
    ranges.push({ svc: svc[1], from: i, to: j })
  }
  for (let r = ranges.length - 1; r >= 0; r--) {
    const { svc, from, to } = ranges[r]
    const pin = pins[svc]
    if (!pin) continue
    lines.splice(from, to - from, ...[
      `  ${svc}:`,
      `    registry: "${REGISTRY_HOST}"`,
      `    repository: "quill/${svc}"`,
      '    pullPolicy: IfNotPresent',
      `    digest: "${pin.digest}"`,
      `    tag: "${pin.tag}"`,
    ])
  }
  return lines.join('\n')
}

async function run(args, raw) {
  const valuesIdx = args.indexOf('--values')
  const jsonIdx = args.indexOf('--json')
  const valuesPath = valuesIdx === -1 ? 'charts/quill/values-prod.yaml' : args[valuesIdx + 1]
  if (valuesIdx !== -1 && !valuesPath) fail('--values needs a path')

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
  pins = parsePinBlock(raw)
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

const migrate = args.includes('--migrate')
let text = readFileSync(valuesPath, 'utf8')

if (migrate) {
  const endpoint = resolveEndpoint()
  const heads = {}
  for (const svc of QUILL_IMAGE_SERVICES) {
    const digest = pins[svc]?.digest
    if (!digest) {
      heads[svc] = { status: 0, digest: '' }
      continue
    }
    try {
      heads[svc] = await readManifestDigest(endpoint, `quill/${svc}`, digest)
    } catch (err) {
      heads[svc] = { status: 0, digest: '' }
      console.error(`apply-image-pins: ${svc}: ${err.message}`)
    }
  }
  let next
  try {
    next = applyMigrationText(text, pins, heads)
  } catch (err) {
    fail(`${err.message}. values-prod.yaml was not modified`)
  }
  if (next === text) {
    console.log('apply-image-pins: no change (pins already current)')
  } else {
    writeFileSync(valuesPath, next, 'utf8')
    console.log(`apply-image-pins: migrated ${QUILL_IMAGE_SERVICES.join(', ')} to ${REGISTRY_HOST}`)
  }
  return
}

// ---- rewrite (digest and tag only; does not switch registry or pull policy) --
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
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = argv.slice(2)
  const valuesIdx = cli.indexOf('--values')
  const jsonIdx = cli.indexOf('--json')
  let raw = ''
  if (jsonIdx !== -1) {
    const p = cli[jsonIdx + 1]
    if (!p) fail('--json needs a path')
    raw = readFileSync(p, 'utf8')
  } else {
    raw = readFileSync(0, 'utf8')
  }
  run(cli, raw).catch((err) => fail(err.message))
}
