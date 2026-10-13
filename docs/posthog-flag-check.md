# Runbook: PostHog flag check fails because the service-account key was rejected

> The `PostHog flag check / check` failure says the service-account key was revoked or expired. Re-running will not help. This runbook rotates the key.

- **Severity:** Low. Blocks merging PRs that add a flag key in `edsights-backend` and `edsights-ui`. No production impact.
- **Triggers:** The `PostHog flag check / check` failure on a PR, or a failed `audit` run of the `PostHog flags` workflow. <!-- TODO: confirm against the merged workflow -->
- **Reversible:** partial — see [Rollback](#rollback). Revoking the old key (step 4) cannot be undone.
- **Last validated:** not yet validated. The workflow and check script this runbook describes had not landed when it was written.
- **Last edited:** 2026-10-13
- **Owner:** `@edsights/platform`
- **Origin:** D-020 "The CI read key" (engineering-standards PR #24) sends operators here for key rotation. Written from the PLAT-219 phase 1 plan, Task 14 Step 6. The check has not failed on a rejected key yet. This runbook is written to close a stakeholder commitment, not in response to an incident.

## Symptoms

- A PR in `edsights-backend` or `edsights-ui` fails `PostHog flag check / check`. <!-- TODO: confirm against the merged workflow -->
- The failing step's log ends with this text (the PostHog error message comes first): <!-- TODO: confirm against the merged workflow -->

  ```
  ::error::<PostHog error message>. The service-account key was revoked or expired - ask platform to rotate it (D-020). Re-running will not help.
  ```

- Or the `audit` job of the `PostHog flags` workflow fails with the same text. <!-- TODO: confirm against the merged workflow -->

The check only reads PostHog when a PR adds a flag key (or in an `audit` run). A PR that adds no key passes without using the read key, so a revoked key stays hidden until the next PR that adds one.

### Not this — try instead

- **`PostHog unreachable, re-run this check`:** PostHog was unavailable. Re-run the check. Nothing to rotate.
- **`Flag "<key>" does not exist in the <project> PostHog project`:** the key is missing from one project. Create it there (production inactive), then re-run. See D-020 "How to apply".
- **`POSTHOG_FLAG_PROJECTS (org variable) and POSTHOG_FLAGS_READ_KEY (posthog-flag-check environment secret) must be configured`:** a setting is missing, not rejected. Ask `@edsights/platform` to check the org variable and the environment secret. <!-- TODO: confirm against the merged workflow -->

## Background

`@edsights/platform` owns the key. Its record (owner, rotation date) is PLAT-576. This runbook holds none of that record's contents.

The key is a read-only PostHog personal API key for a service account. It has the `feature_flag:read` scope only and is limited to the staging and production PostHog projects. The check uses it to confirm that every flag key in a repo's registry exists in both projects. The project IDs come from the `POSTHOG_FLAG_PROJECTS` org variable. <!-- TODO: confirm against the merged workflow -->

The key is the `POSTHOG_FLAGS_READ_KEY` secret of the `posthog-flag-check` environment in each repo. <!-- TODO: confirm against the merged workflow --> That environment only allows runs on `main`. A PR-authored workflow therefore cannot read the key, and a manual run from any other branch is refused.

## Prerequisites

- Membership of `@edsights/platform`. Access to the service account is limited to platform; PLAT-576 holds the details.
- Admin access to `edsights-backend` and `edsights-ui`, enough to edit environment secrets and run workflows.
- `gh` CLI, authenticated for `edsights`. Optional: every `gh` step also has a UI route (Settings → Environments, Actions → Run workflow).

## Resolve

Rotate in this order. The old key stays valid until step 4, so a failed step 2 or 3 can be backed out.

### 1. Create a new key as the service account

Sign in to PostHog as the service account. Create a new personal API key:

- Scope: `feature_flag:read` only.
- Projects: the staging and production projects only.
- Expiry: set one if PostHog offers it, and record the date in PLAT-576.

Copy the key when PostHog shows it. PostHog shows it once. Do not paste it into a PR, issue or chat.

Success: PostHog lists the new key next to the old one, with exactly the scope and the two projects above.

If you see something different: if PostHog won't offer `feature_flag:read` or the project restriction, stop and go to [Escalate](#escalate).

### 2. Replace the secret in both repos

Run once for each repo. `gh` prompts for the value, so the key stays out of your shell history.

```
$ gh secret set POSTHOG_FLAGS_READ_KEY --env posthog-flag-check --repo edsights/edsights-backend
$ gh secret set POSTHOG_FLAGS_READ_KEY --env posthog-flag-check --repo edsights/edsights-ui
```

<!-- TODO: confirm against the merged workflow: environment and secret names -->

Success: each command reports that the secret was set, with no error. Do not skip a repo. A stale key in one repo breaks that repo's check later.

If you see something different: a 404 or a permission error means you lack admin on that repo, or the environment doesn't exist. Go to [Escalate](#escalate).

### 3. Run the audit in each repo

Run the `audit` job of the `PostHog flags` workflow from `main` in each repo. <!-- TODO: confirm against the merged workflow: workflow name, file name, job name -->

```
$ gh workflow run posthog-flags.yml --repo edsights/edsights-backend --ref main
$ gh workflow run posthog-flags.yml --repo edsights/edsights-ui --ref main
```

<!-- TODO: confirm against the merged workflow: file name posthog-flags.yml -->

Watch each run: `gh run watch --repo edsights/edsights-backend` (and `edsights-ui`). The same run can be started from Actions → PostHog flags → Run workflow, on `main`.

Success: both runs finish green. The check's log shows `checking N key(s): ...`, or `registry is empty`. <!-- TODO: confirm against the merged workflow -->

If you see something different: if either run still fails with the "key was revoked or expired" text, the secret in that repo wasn't replaced or the new key is wrong. Repeat step 2 for that repo, or recreate the key (step 1). Both repos must pass before step 4.

### 4. Revoke the old key in PostHog

Only after both audits pass. In PostHog, as the service account, delete or revoke the old key and leave the new one.

Success: PostHog lists only the new key.

## Verify the fix landed

- Both `audit` runs from step 3 are green on `main`.
- Re-run a failed `PostHog flag check / check` on a PR that had hit the error. It now passes, or fails only for a genuine missing flag key. <!-- TODO: confirm against the merged workflow -->
- PLAT-576 shows the new key's rotation date.

## Escalate

1. **If step 1 or 2 can't be done (PostHog won't offer the scope or project restriction, or you lack admin on a repo):** ask `@edsights/platform` by mentioning the team on the PR or in PLAT-576.
2. **If the audit still fails with the key-rejected text after the new key is in both repos and confirmed in step 1:** stop and ask `@edsights/platform` (mention on PLAT-576). Don't revoke the old key.

## Rollback

Before step 4, the old key is still valid. If you still have its value, run step 2 again with it and re-run step 3.

The old key's value isn't recorded anywhere in this runbook, and after step 4 it can't be restored. If the new key is bad, repeat from step 1.

## Live links

- `edsights-backend` Actions → `PostHog flags`: https://github.com/edsights/edsights-backend/actions <!-- TODO: confirm against the merged workflow -->
- `edsights-ui` Actions → `PostHog flags`: https://github.com/edsights/edsights-ui/actions <!-- TODO: confirm against the merged workflow -->
- Environments: Settings → Environments → `posthog-flag-check` in each repo.

## Background and related

- D-020 (engineering-standards), "The CI read key" and "How to apply".
- PLAT-576: ownership and rotation record for the key.
- PLAT-219: PostHog feature flags, phase 1.

## Change history

- **2026-10-13** — Chase Southard: created from the PLAT-219 phase 1 plan (Task 14 Step 6), to close the reference in D-020 "The CI read key". Names marked TODO come from the plan, not from merged code. [validated: no — the workflow and check script had not landed]
