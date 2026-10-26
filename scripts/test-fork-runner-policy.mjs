import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const gate = 'scripts/gates/check-fork-runner-policy.mjs';

function run(dir) {
  return spawnSync(process.execPath, [gate, dir], { encoding: 'utf8' });
}

function withWorkflow(name, body, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'fork-runner-'));
  try {
    writeFileSync(join(dir, name), body);
    fn(run(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('repository workflows satisfy the fork runner policy', () => {
  const result = spawnSync(process.execPath, [gate], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('pull_request on a self-hosted runner fails', () => {
  withWorkflow('bad.yml', `
name: bad
on:
  pull_request:
jobs:
  test:
    runs-on: [self-hosted, nixos]
    steps:
      - run: echo hi
`, (result) => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /pull_request/);
  });
});

test('pull_request_target without a runner guard fails', () => {
  withWorkflow('bad.yml', `
name: bad
on:
  pull_request_target:
permissions:
  contents: read
jobs:
  test:
    runs-on: [self-hosted, nixos]
    steps:
      - run: echo hi
`, (result) => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /same-repo or push-only/);
  });
});

test('a fork-capable job that reads a secret fails', () => {
  withWorkflow('bad.yml', `
name: bad
on:
  pull_request_target:
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
        env:
          TOKEN: \${{ secrets.EXAMPLE }}
`, (result) => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must not reference secrets/);
  });
});

test('a dynamic runner without the refuse step fails', () => {
  withWorkflow('bad.yml', `
name: bad
on:
  pull_request_target:
permissions:
  contents: read
jobs:
  test:
    runs-on: \${{ (github.event_name == 'pull_request_target' && github.event.pull_request.head.repo.full_name != github.repository) && 'ubuntu-latest' || fromJSON('["self-hosted", "nixos"]') }}
    steps:
      - run: echo hi
`, (result) => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /inline self-hosted refuse step/);
  });
});

test('workflow_run on a self-hosted runner without a head repository guard fails', () => {
  withWorkflow('bad.yml', `
name: bad
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
jobs:
  doctor:
    if: github.event.workflow_run.conclusion == 'failure'
    runs-on: [self-hosted, nixos]
    steps:
      - run: echo hi
`, (result) => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /head_repository/);
  });
});

test('a same-repo self-hosted pull_request_target job passes', () => {
  withWorkflow('ok.yml', `
name: ok
on:
  pull_request_target:
permissions:
  contents: write
jobs:
  merge:
    if: github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`, (result) => {
    assert.equal(result.status, 0, result.stderr);
  });
});
