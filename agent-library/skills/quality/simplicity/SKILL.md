---
name: quality-simplicity
description: "Use when writing, refactoring, or reviewing code that should be easy for the next developer to read, especially code written under time pressure, code that grew defensive checks or options nobody asked for, or code with nested conditionals, pass-through methods, or comments that no longer match."
---

# Simplicity

Applies to: any code you add or change. Project guidance (`AGENTS.md`, `CLAUDE.md`, linters) wins over these defaults, and the stack skills decide where code lives.

Simple code does what the task needs, in steps a reader can follow once. Simplifying never changes behaviour: same inputs, same outputs, same errors.

## Rules

- **Build what was asked.** Add an option, input format, or configuration only when the spec or real data needs it. When correctness forces one (a CSV name can contain a comma), add it and say why in your report.
- **Trust the types.** Validate at the system boundary: request input, files, external APIs. Inside, don't re-check what the signature already guarantees: no `typeof` on a typed parameter, no `?? []` on a non-nullable value, no `instanceof` on a typed argument.
- **One idea per expression.** Use early returns, `match`/`switch`, or a lookup table instead of nested ternaries. Split a chain that does several things into named steps. Prefer plain string and array calls over a regex with a callback when both work.
- **No layers that only forward.** A method that just calls another method, an unused parameter, and dead code all go.
- **Keep structure that earns its place.** Don't merge separate concerns to save lines, or inline a helper that names a real step. Fewer lines is not the goal.
- **Names say what things are.** Use `$invoice`, not `$i`; `pendingInvites`, not `data2`. Short names are fine for indexes and tiny lambdas.
- **Comments explain why.** Delete comments that restate the code. Fix or delete any comment the code contradicts. Never reference temporary states ("for now", "new version").

## Example

```php
// Before: three conditions nested in one expression
'status' => $i->paid_at ? 'Paid' : ($i->due_at < now() ? ($i->reminded_at ? 'Overdue (reminded)' : 'Overdue') : 'Open'),

// After: one condition per line, each answer readable on its own
'status' => match (true) {
    $invoice->paid_at !== null => 'Paid',
    $invoice->due_at->isPast() && $invoice->reminded_at !== null => 'Overdue (reminded)',
    $invoice->due_at->isPast() => 'Overdue',
    default => 'Open',
},
```

## Before you finish

Re-read your own diff once, as a stranger would. For each change, ask whether a shorter or plainer version does exactly the same thing. If so, use it, then re-run the checks you already ran. Simplify only the code you changed.

## Reviewing

Complexity that the change introduces, and that has a simpler version with the same behaviour, is a finding: a nested ternary, a pass-through method, an unused parameter, an option or generality nothing uses yet, a check the types already rule out, or a misleading comment. Matters of taste go under notes.

Adapted from [code-simplifier](https://github.com/anthropics/claude-plugins-official/tree/ea0a38e1d671aa18a30431c9160e31193dc9860b/plugins/code-simplifier) and [comment-analyzer](https://github.com/anthropics/claude-plugins-official/blob/ea0a38e1d671aa18a30431c9160e31193dc9860b/plugins/pr-review-toolkit/agents/comment-analyzer.md) (Apache-2.0).
