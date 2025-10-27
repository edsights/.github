## Summary
> Briefly explain **why** this change exists and **what** it does.

## Related Work
> Link related Notion issues or PRs.

## Scope
> Summarize if any changes are out of scope for this PR (as defined by the Linear issue).

## Implementation Notes
> Mention any key design decisions, tradeoffs, or alternatives considered.

## Tests & Evidence
- [ ] Have you reviewed if tests need to be added/modified? If not, why?
- [ ] Have you confirmed this change in a deployed environment? If not, why?

## Risk & Rollout
- [ ] Have you requested a copilot review?
- [ ] Do these code changes use a feature flag? If not, why?
- [ ] Have you considered if documentation needs to be updated? (README, CLAUDE, Notion, etc.)
- [ ] Is a DB migration required? If so, have you linked the migration PR?
- [ ] Environment variables added/modified/necessary?

### Briefly explain the worst scenario that could happen from this pull request and your rollback plan.
> Explain here.

## Reviewer quick guide
### Gate checks:
- CI green
- Scope clear
- Linting/tests pass
- PR template completed
- PR size reasonable (XS/S/M/L)
### High level scan:
- Read title/summary, screenshots, migration notes.
- Confirm scope is tight and risk is declared (DB? feature flag?).
- Skim the file list to spot surprises (renames, vendor files, huge diffs).
- Rollout plan clear (flags/canary)? Observability added (metrics/logs)?
- Migration steps & rollback documented? Ownership tagged?
- If medium/high risk, require a second reviewer or a QA step.
### Design and behavior:
- Do we agree with approach? Alternatives considered? Coupling ok?
- Interfaces/contracts stable? Backward compatibility noted?
- Security, privacy, performance implications acknowledged?
### Code details:
- Read commit-by-commit or dependency-first (e.g., types/interfaces → impl → tests).
- Check invariants, error handling, logging, edge cases, and test adequacy.
- Suggest concrete, small changes (“nit/optional/blocking” tags).
