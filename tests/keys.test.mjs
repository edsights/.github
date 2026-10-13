// Tests for scripts/posthog-flags/keys.mjs, the flag-registry reader behind the
// PostHog flag check. The module fails closed: a registry it can't read throws,
// it never reads as "no keys".
//
// Run with: node --test tests/*.test.mjs

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addedKeys, extractKeys } from '../scripts/posthog-flags/keys.mjs';

test('ui: reads the keys of a registry shaped like the real edsights-ui one', () => {
  const source = `
/**
 * PostHog flag keys, each defined once.
 */
export const postHogFeatureFlagTypes = {
    atlasHome: 'atlas-home'
};
`;
  assert.deepEqual(extractKeys('ui', source), ['atlas-home']);
});

test('ui: a } or , inside a comment does not end or split the registry', () => {
  const source = `
export const postHogFeatureFlagTypes = {
    // retired: a, b };
    atlasHome: 'atlas-home', // trailing, comma };
    /* block, with }; inside */ otherFlag: 'other-key'
};
`;
  assert.deepEqual(extractKeys('ui', source), ['atlas-home', 'other-key']);
});

test('ui: throws when the registry does not close with };', () => {
  const source = `
export const postHogFeatureFlagTypes = {
    atlasHome: 'atlas-home'
}
`;
  assert.throws(() => extractKeys('ui', source), /does not close with "};"/);
});

test('ui: throws on an entry that references a const instead of a literal', () => {
  const source = `
export const postHogFeatureFlagTypes = {
    atlasHome: ATLAS_HOME_KEY
};
`;
  assert.throws(() => extractKeys('ui', source), /not a "name: 'literal'" entry/);
});

const UNREADABLE_UI_REGISTRIES = {
  'a template literal': `
export const postHogFeatureFlagTypes = {
    atlasHome: \`atlas-home\`
};
`,
  'a spread': `
export const postHogFeatureFlagTypes = {
    ...otherFlags,
    atlasHome: 'atlas-home'
};
`,
  'an Object.freeze wrapper': `
export const postHogFeatureFlagTypes = Object.freeze({
    atlasHome: 'atlas-home'
});
`,
  'an as const suffix': `
export const postHogFeatureFlagTypes = {
    atlasHome: 'atlas-home'
} as const;
`,
};

for (const [shape, source] of Object.entries(UNREADABLE_UI_REGISTRIES)) {
  test(`ui: throws on ${shape}`, () => {
    assert.throws(() => extractKeys('ui', source), /^Error: UI registry/);
  });
}

test('ui: reads the single-line form', () => {
  const source = `export const postHogFeatureFlagTypes = { a: 'atlas-home', b: "other-key" };`;
  assert.deepEqual(extractKeys('ui', source), ['atlas-home', 'other-key']);
});

for (const badKey of ['Atlas-Home', 'atlas_home', 'atlas home', 'ATLAS_HOME', '']) {
  test(`ui: throws on a key that violates D-012: ${JSON.stringify(badKey)}`, () => {
    const source = `export const postHogFeatureFlagTypes = { a: '${badKey}' };`;
    assert.throws(() => extractKeys('ui', source), /violates D-012/);
  });
}

test('ui: an empty or whitespace-only source (no file at base) reads as no keys', () => {
  assert.deepEqual(extractKeys('ui', ''), []);
  assert.deepEqual(extractKeys('ui', '  \n\t\n'), []);
});

test('ui: a non-empty source with no registry throws, even if only comments remain', () => {
  assert.throws(() => extractKeys('ui', `export const other = 1;\n`), /^Error: UI registry/);
  assert.throws(() => extractKeys('ui', `// registry removed\n/* gone */\n`), /^Error: UI registry/);
});

test('go: reads Name FlagKey = "key" lines from a const block', () => {
  const source = `package flags

// FlagKey names a PostHog feature flag.
type FlagKey string

const (
	// SSOBuildGate hides the whole SSO surface while off.
	SSOBuildGate FlagKey = "sso-build-gate"
	AtlasHome    FlagKey = "atlas-home"
)
`;
  assert.deepEqual(extractKeys('go', source), ['sso-build-gate', 'atlas-home']);
});

test('go: reads a standalone const declaration', () => {
  const source = `package flags\n\nconst AtlasHome FlagKey = "atlas-home"\n`;
  assert.deepEqual(extractKeys('go', source), ['atlas-home']);
});

test('go: comments are stripped first, so a commented-out declaration is not read', () => {
  const source = `package flags

const (
	AtlasHome FlagKey = "atlas-home" // retired: Old FlagKey = "old-key"
	// Gone FlagKey = "gone-key"
	/*
	Blocked FlagKey = "blocked-key"
	*/
	Other FlagKey = "other-key"
)
`;
  assert.deepEqual(extractKeys('go', source), ['atlas-home', 'other-key']);
});

test('go: a key that violates D-012 throws', () => {
  const source = `package flags\nconst Foo FlagKey = "Foo_Bar"\n`;
  assert.throws(() => extractKeys('go', source), /violates D-012/);
});

test('go: an empty or whitespace-only source reads as no keys', () => {
  assert.deepEqual(extractKeys('go', ''), []);
  assert.deepEqual(extractKeys('go', '\n \n'), []);
});

const UNREADABLE_GO_REGISTRIES = {
  'a const reference': `package flags\nconst (\n\tFoo FlagKey = fooConst\n)\n`,
  'a concatenation': `package flags\nconst (\n\tFoo FlagKey = "a" + "b"\n)\n`,
  'a raw string': 'package flags\nconst (\n\tFoo FlagKey = `foo`\n)\n',
  'a trailing expression': `package flags\nconst (\n\tFoo FlagKey = "foo" + suffix\n)\n`,
  'an implicit value (iota-style)': `package flags\nconst (\n\tFoo FlagKey = iota\n)\n`,
  'a source with no FlagKey declarations': `package flags\n\nconst Other = "sso-build-gate"\n`,
  'a source where the type was renamed': `package flags\n\nconst (\n\tFoo FlagID = "foo"\n)\n`,
};

for (const [shape, source] of Object.entries(UNREADABLE_GO_REGISTRIES)) {
  test(`go: throws on ${shape}`, () => {
    assert.throws(() => extractKeys('go', source), /^Error: Go registry/);
  });
}

test('throws on an unknown format or a non-string source', () => {
  assert.throws(() => extractKeys('rust', ''), /unknown registry format/i);
  assert.throws(() => extractKeys(undefined, ''), /unknown registry format/i);
  assert.throws(() => extractKeys('ui', undefined), /source must be a string/i);
  assert.throws(() => extractKeys('ui', null), /source must be a string/i);
});

test('ui: ignores a decoy registry start inside a block comment', () => {
  // The decoy sits at a line start, so only stripping comments first hides it.
  const source = `
/*
export const postHogFeatureFlagTypes = {
    decoy: 'not-a-real-key'
};
*/
export const postHogFeatureFlagTypes = {
    atlasHome: 'atlas-home'
};
`;
  assert.deepEqual(extractKeys('ui', source), ['atlas-home']);
});

test('addedKeys: returns head keys missing from base, in head order', () => {
  assert.deepEqual(addedKeys(['a', 'b'], ['z', 'a', 'y', 'b', 'x']), ['z', 'y', 'x']);
});

test('addedKeys: de-duplicates, keeping the first occurrence in head order', () => {
  assert.deepEqual(addedKeys(['a'], ['n', 'a', 'n', 'm', 'm']), ['n', 'm']);
});

test('addedKeys: an empty base (no registry at base) makes every head key added', () => {
  assert.deepEqual(addedKeys([], ['a', 'b']), ['a', 'b']);
  assert.deepEqual(addedKeys(['a'], []), []);
});

test('go and ui: a CRLF source reads the same as an LF one', () => {
  const go = 'package flags\r\n\r\nconst (\r\n\tAtlasHome FlagKey = "atlas-home" // note\r\n)\r\n';
  assert.deepEqual(extractKeys('go', go), ['atlas-home']);
  const ui = "export const postHogFeatureFlagTypes = {\r\n    atlasHome: 'atlas-home'\r\n};\r\n";
  assert.deepEqual(extractKeys('ui', ui), ['atlas-home']);
});

test('ui: a registry that is found but declares no keys reads as no keys', () => {
  assert.deepEqual(extractKeys('ui', `export const postHogFeatureFlagTypes = {};\n`), []);
  const allRetired = `export const postHogFeatureFlagTypes = {\n    // atlasHome: 'atlas-home', retired\n};\n`;
  assert.deepEqual(extractKeys('ui', allRetired), []);
});

test('go: a registry that declares type FlagKey but no keys reads as no keys', () => {
  assert.deepEqual(extractKeys('go', `package flags\n\ntype FlagKey string\n`), []);
  const allRetired = `package flags\n\ntype FlagKey string\n\nconst (\n\t// Old FlagKey = "old-key", retired\n)\n`;
  assert.deepEqual(extractKeys('go', allRetired), []);
});
