import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const gate = 'scripts/gates/check-fork-runner-policy.mjs';
const arcRunsOn = "${{ (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository) && 'arc-maplespike' || 'ubuntu-latest' }}";
const safeRunsOn = "${{ (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository) && fromJSON('[\"self-hosted\", \"nixos\"]') || 'ubuntu-latest' }}";

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

test('static self-hosted pull_request fails', () => {
  withWorkflow('bad.yml', `
name: bad
on: pull_request
jobs:
  test:
    runs-on: [self-hosted, nixos]
    steps:
      - run: echo hi
`, (result) => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /self-hosted runner/);
  });
});

test('same-repo guard on a static self-hosted job passes', () => {
  withWorkflow('ok.yml', `
name: ok
on:
  pull_request:
  push:
jobs:
  test:
    if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository
    runs-on: [self-hosted, nixos]
    steps:
      - run: echo hi
`, (result) => {
    assert.equal(result.status, 0, result.stderr);
  });
});

test('push-safe runs-on expression passes', () => {
  withWorkflow('ok.yml', `
name: ok
on:
  pull_request:
  push:
jobs:
  test:
    runs-on: ${safeRunsOn}
    steps:
      - uses: actions/checkout@v7
`, (result) => {
    assert.equal(result.status, 0, result.stderr);
  });
});

test('expression that sends a fork pull_request to self-hosted fails', () => {
  withWorkflow('bad.yml', `
name: bad
on:
  pull_request:
  push:
jobs:
  test:
    runs-on: \${{ (github.event_name == 'pull_request_target' && github.event.pull_request.head.repo.full_name != github.repository) && 'ubuntu-latest' || fromJSON('["self-hosted", "nixos"]') }}
    steps:
      - run: echo hi
`, (result) => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /self-hosted runner/);
  });
});

test('inequality that selects self-hosted fails', () => {
  withWorkflow('bad.yml', `
name: bad
on: pull_request
jobs:
  test:
    runs-on: \${{ github.event.pull_request.head.repo.full_name != github.repository && fromJSON('["self-hosted", "nixos"]') || 'ubuntu-latest' }}
    steps:
      - run: echo hi
`, (result) => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /self-hosted runner/);
  });
});

test('pull_request_target that checks out the head SHA fails', () => {
  withWorkflow('bad.yml', `
name: bad
on: pull_request_target
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: \${{ github.event.pull_request.head.sha }}
`, (result) => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must not check out the pull request head/);
  });
});

test('pull_request_target without a checkout passes', () => {
  withWorkflow('ok.yml', `
name: ok
on: pull_request_target
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
    assert.match(result.stderr, /workflow_run/);
  });
});

test('static ARC scale set on pull_request fails', () => {
  withWorkflow('bad.yml', `
name: bad
on: pull_request
jobs:
  test:
    runs-on: arc-maplespike
    steps:
      - run: echo hi
`, (result) => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /self-hosted runner/);
  });
});

test('fork-safe ARC runs-on expression passes', () => {
  withWorkflow('ok.yml', `
name: ok
on:
  pull_request:
  push:
jobs:
  test:
    runs-on: ${arcRunsOn}
    steps:
      - uses: actions/checkout@v7
`, (result) => {
    assert.equal(result.status, 0, result.stderr);
  });
});

test('expression that sends a fork pull_request to ARC fails', () => {
  withWorkflow('bad.yml', `
name: bad
on: pull_request
jobs:
  test:
    runs-on: \${{ github.event.pull_request.head.repo.full_name != github.repository && 'arc-maplespike' || 'ubuntu-latest' }}
    steps:
      - run: echo hi
`, (result) => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /self-hosted runner/);
  });
});
