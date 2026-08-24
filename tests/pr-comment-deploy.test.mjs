// Regression tests for the /deploy comment matcher in pr-comment-deploy.yml.
//
// The matcher can't live in a standalone script: pr-comment-deploy.yml is a
// reusable workflow, and callers never check out this repo, so a script file
// wouldn't exist at runtime. Instead, these tests extract the real `run:`
// block out of the YAML and execute it, so the code under test is the code
// that ships.
//
// Each case asserts the END-TO-END outcome: the job-level `if` pre-filter
// (emulated below) AND the bash matcher. The bash alone accepts bodies the
// job never starts on (e.g. leading whitespace), so testing it in isolation
// would overstate what the workflow accepts.
//
// Run with: node --test tests/*.test.mjs

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const WORKFLOW_PATH = new URL(
  '../.github/workflows/pr-comment-deploy.yml',
  import.meta.url,
);

// Pull the `run: |` scalar of the step with `id: check` out of the workflow,
// by indentation. Throws if the step or its script can't be found, so a YAML
// restructure breaks these tests loudly instead of passing vacuously.
function extractCheckStepScript(yamlText) {
  const lines = yamlText.split('\n');
  const idLine = lines.findIndex((line) => /^\s*id: check\s*$/.test(line));
  if (idLine === -1) {
    throw new Error('step with `id: check` not found in pr-comment-deploy.yml');
  }
  const stepIndent = lines[idLine].match(/^\s*/)[0].length;

  let runLine = -1;
  for (let i = idLine + 1; i < lines.length; i++) {
    const indent = lines[i].match(/^\s*/)[0].length;
    if (lines[i].trim() === '' ) continue;
    if (indent < stepIndent) break; // left the step
    if (indent === stepIndent && /^run:\s*\|/.test(lines[i].trim())) {
      runLine = i;
      break;
    }
  }
  if (runLine === -1) {
    throw new Error('`run: |` not found in the `check` step');
  }

  const scriptLines = [];
  let scriptIndent = null;
  for (let i = runLine + 1; i < lines.length; i++) {
    if (lines[i].trim() === '') {
      scriptLines.push('');
      continue;
    }
    const indent = lines[i].match(/^\s*/)[0].length;
    if (scriptIndent === null) scriptIndent = indent;
    if (indent < scriptIndent) break; // left the block scalar
    scriptLines.push(lines[i].slice(scriptIndent));
  }

  const script = scriptLines.join('\n');
  if (!script.includes('should_deploy=')) {
    throw new Error('extracted script does not set should_deploy — extraction is broken');
  }
  return script;
}

// The job-level `if` pre-filter: startsWith(github.event.comment.body, '/deploy').
// Actions expressions compare strings case-insensitively.
function passesPreFilter(body) {
  return body.toLowerCase().startsWith('/deploy');
}

// Run the extracted step the way Actions does (bash -e), with the comment body
// in env, and return the should_deploy value written to GITHUB_OUTPUT.
function runCheckStep(script, body) {
  const dir = mkdtempSync(join(tmpdir(), 'pr-comment-deploy-test-'));
  try {
    const outputFile = join(dir, 'github_output');
    writeFileSync(outputFile, '');
    execFileSync('bash', ['-e', '-c', script], {
      env: {
        ...process.env,
        COMMENT_BODY: body,
        PR_NUMBER: '321',
        GITHUB_OUTPUT: outputFile,
      },
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    const match = readFileSync(outputFile, 'utf8').match(/^should_deploy=(.*)$/m);
    if (!match) {
      throw new Error('step did not write should_deploy to GITHUB_OUTPUT');
    }
    return match[1];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function wouldDeploy(script, body) {
  if (!passesPreFilter(body)) return false;
  return runCheckStep(script, body) === 'true';
}

const script = extractCheckStepScript(readFileSync(WORKFLOW_PATH, 'utf8'));

const cases = [
  // [description, body, expected end-to-end outcome]
  ['web UI body with trailing CRLF', '/deploy\r\n', true],
  ['bare command, no newline (CLI)', '/deploy', true],
  ['trailing LF only', '/deploy\n', true],
  ['command with argument', '/deploy staging', true],
  ['argument with trailing CRLF', '/deploy staging\r\n', true],
  ['multiple spaces before argument', '/deploy   staging', true],
  ['tab before argument', '/deploy\tstaging', true],
  ['trailing spaces', '/deploy   ', true],
  ['extra text on later lines', '/deploy\r\n\r\nplease', true],
  ['autocapitalized (mobile keyboard)', '/Deploy', true],
  ['all caps', '/DEPLOY', true],
  ['mixed case with argument', '/Deploy staging', true],
  ['leading spaces: job-level if on the raw body never starts', '   /deploy', false],
  ['blank first line before command', '\r\n/deploy', false],
  ['prefix collision: /deployment-notes', '/deployment-notes', false],
  ['prefix collision, mixed case', '/Deployment-notes', false],
  ['prefix collision: /deployx', '/deployx', false],
  ['command mentioned mid-sentence', 'run /deploy when ready', false],
  ['empty body', '', false],
];

for (const [description, body, expected] of cases) {
  test(`${description} -> ${expected}`, () => {
    assert.equal(wouldDeploy(script, body), expected);
  });
}
