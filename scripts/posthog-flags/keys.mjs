// Reads the flag keys out of a repo's flag registry. Pure and dependency-free.
// Fails closed: a registry it can't read throws, it never reads as "no keys".

// D-012: lowercase kebab-case.
const FLAG_KEY = /^[a-z0-9-]+$/;
const UI_START = /^export const postHogFeatureFlagTypes\s*=\s*\{/m;
// One `Name FlagKey = "key"` declaration, inside a const block or after `const`.
const GO_ENTRY = /^[ \t]*(?:const[ \t]+)?[A-Za-z_]\w*[ \t]+FlagKey[ \t]*=[ \t]*"([^"]*)"[ \t]*$/;
const GO_TYPE = /^[ \t]*type[ \t]+FlagKey\b/m;
// Any line that assigns a value to a FlagKey, whether or not it is a valid literal.
const GO_FLAGKEY_ASSIGNMENT = /\bFlagKey[ \t]*=/;
// A bare-identifier name and a plain single- or double-quoted literal, nothing else.
const UI_ENTRY = /^\s*[A-Za-z_$][\w$]*\s*:\s*(?:'([^']*)'|"([^"]*)")\s*$/;

// Comments go first, from the whole source, before anything is located.
// `//` counts only at a line start or after whitespace (so `http://` survives);
// a block comment becomes a space so the tokens around it don't fuse.
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/.*$/gm, '$1');
}

function extractUiKeys(rawSource) {
  const source = stripComments(rawSource);
  const start = UI_START.exec(source);
  if (!start) {
    throw new Error('UI registry start `export const postHogFeatureFlagTypes = {` not found');
  }
  const body = source.slice(start.index + start[0].length);
  const end = body.indexOf('};');
  if (end === -1) {
    throw new Error('UI registry does not close with "};"');
  }
  const keys = [];
  for (const entry of body.slice(0, end).split(',')) {
    if (entry.trim() === '') continue;
    const match = UI_ENTRY.exec(entry);
    if (!match) {
      throw new Error(`UI registry entry is not a "name: 'literal'" entry: ${entry.trim()}`);
    }
    keys.push(match[1] ?? match[2]);
  }
  return keys;
}

function extractGoKeys(rawSource) {
  const source = stripComments(rawSource);
  const keys = [];
  for (const line of source.split(/\r?\n/)) {
    if (!GO_FLAGKEY_ASSIGNMENT.test(line)) continue;
    const match = GO_ENTRY.exec(line);
    if (!match) {
      throw new Error(`Go registry entry is not a \`Name FlagKey = "key"\` literal: ${line.trim()}`);
    }
    keys.push(match[1]);
  }
  // Like the UI start line, `type FlagKey` anchors the registry: found with no
  // entries it is empty, but with neither it is unreadable (renamed, or not a registry).
  if (keys.length === 0 && !GO_TYPE.test(source)) {
    throw new Error('Go registry has neither `type FlagKey` nor any `Name FlagKey = "key"` declarations');
  }
  return keys;
}

const PARSERS = { ui: extractUiKeys, go: extractGoKeys };

export function extractKeys(format, source) {
  if (!Object.hasOwn(PARSERS, format)) {
    throw new Error(`Unknown registry format ${JSON.stringify(format)}`);
  }
  if (typeof source !== 'string') {
    throw new Error('Registry source must be a string');
  }
  // Only a truly empty source (no file at the base commit) reads as "no keys".
  // A non-empty source with no registry in it is unreadable, and throws.
  if (source.trim() === '') return [];
  const keys = PARSERS[format](source);
  for (const key of keys) {
    if (!FLAG_KEY.test(key)) {
      throw new Error(`Flag key ${JSON.stringify(key)} violates D-012 (${FLAG_KEY})`);
    }
  }
  return keys;
}

// Head keys missing from base, de-duplicated, in head order.
export function addedKeys(base, head) {
  const inBase = new Set(base);
  return [...new Set(head.filter((key) => !inBase.has(key)))];
}
