# EdSights Org .github

Shared, platform-owned CI building blocks (reusable workflows, composite actions, and scripts) consumed by other EdSights repos. This file covers the PostHog flag check vocabulary.

## Language

**Flag registry**:
The single place in a repo where every PostHog flag key the code reads is declared. Each repo has exactly one, in either the Go or UI format.
_Avoid_: Flag list, flag enum, flag constants

**Flag key**:
The kebab-case string that identifies a flag in PostHog, as defined by D-012. Final once saved in PostHog.
_Avoid_: Flag name, flag ID

**Added key**:
A flag key present in a PR's head registry but absent from its base registry. These are the keys the flag check must find in PostHog.
_Avoid_: New flag, new key

**Unreadable registry**:
A registry whose source the extractor cannot confidently parse, including one whose anchor (the UI start line or the Go `FlagKey` type) cannot be found. It is an error, never the same as a registry with no keys.
_Avoid_: Missing registry, broken registry

**Empty registry**:
A registry that is found and parses cleanly but declares no keys, such as a repo that has retired its last flag. This reads as no keys.
_Avoid_: Unreadable registry (that one is an error)

**Empty source**:
A zero-length or whitespace-only registry source, meaning the file did not exist at the base commit. This alone reads as no keys.
_Avoid_: Blank registry
