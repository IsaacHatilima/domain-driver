---
name: quality-review
description: "Use when reviewing a diff, branch, or pull request and deciding what blocks the merge, especially when findings mix real bugs with pre-existing problems, style preferences, or claims about code outside the diff."
---

# Review

Applies to: reviewing any change. The invoking workflow sets the report format; this skill decides what goes in it. Use `simplicity` for complexity and the stack skills for conventions.

A review is useful when every finding is real, caused by this change, and fixable from what it says.

## What blocks

| Put under Findings | Put under Notes |
|---|---|
| A bug the change introduces: wrong result, crash, data loss, broken contract | Problems that exist on the base branch too |
| A spec requirement or acceptance criterion the change misses | Taste: naming or layout with no rule behind it |
| A broken rule from project guidance or a selected skill | Optional improvements and follow-ups |
| Introduced complexity with a simpler equivalent (`simplicity`) | Questions you couldn't settle from the code |
| A swallowed error: an empty catch, a catch that returns a default, a fallback that hides a failure | |
| A missing test for a behaviour the change adds, named by the bug it would catch | |

A new path from changed code into an old problem is a finding. Sending user input to an existing unsafe query is one.

## Verify before you report

- Read the code behind every claim. If the claim depends on lines the diff doesn't show, such as imports, callers, or a sibling handler, open the file. If you can't, write it as a question under Notes.
- Name the trigger: the input, state, or caller that makes the problem happen. If you can't name one, it isn't a finding.
- Run the project's linters, type checker, and tests on the changed scope, then report the failing command. Don't hand-list what a tool would report.
- One finding per root cause. Each says where (`path:line`), what triggers it, the impact, and the fix.

## Tests

Judge tests by behaviour, not coverage percentage. For each changed behaviour, ask which test fails if it breaks. Check allowed and refused callers, error paths, and boundary values. Flag tests that assert implementation details, or tests that were weakened, skipped, or deleted to pass.

Adapted from [code-review](https://github.com/anthropics/claude-plugins-official/tree/ea0a38e1d671aa18a30431c9160e31193dc9860b/plugins/code-review) and the [pr-review-toolkit](https://github.com/anthropics/claude-plugins-official/tree/ea0a38e1d671aa18a30431c9160e31193dc9860b/plugins/pr-review-toolkit) reviewers (Apache-2.0).
