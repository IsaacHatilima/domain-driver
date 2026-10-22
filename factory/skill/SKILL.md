---
name: domain-factory
description: Run the domain-driver feature factory. Use only when the user explicitly invokes it (/domain-factory in Claude Code, $domain-factory in Codex) with a feature request, or with approve <job-id> or rework <job-id> <note>. The session that runs it orchestrates one job through spec, build, review, documentation and approval.
disable-model-invocation: true
---

# domain-factory

You orchestrate one job. You set it up, start each agent, verify what that agent left behind, and move the job on. You never write code, specs, reviews, documentation or decisions: agents do that, each in its own files. You write `job.json`, plus `rework-<k>.md` from a rework note and `decision.md` when review rounds run out.

The request is the text the user typed after the skill name.

## The loop

```
request → spec-writer → builder → [security, code, ux, ui] → documenter → approver → merge
                           ▲                  │                                │
                           └── any CHANGES ───┘          ESCALATE → needs-human ┘
```

| Stage | Agent | Writes |
|---|---|---|
| spec | `spec-writer` | `spec.md` |
| build | `builder` | commits on `factory/<job-id>`, `build.md` |
| review | `reviewer-security`, `reviewer-code`, `reviewer-ux`, `reviewer-ui` | `round-<N>/review-<lens>.md` |
| document | `documenter` | one commit with `Documentation/<Entity>.md` and `Documentation/index.md` |
| approve | `approver` | `decision.md` |

A run gets at most three review rounds: its first, then two more after CHANGES.

## Starting agents

Each agent is defined for both tools, and its model is set in its file. Never pick a model yourself.

- **Claude Code:** `.claude/agents/<name>.md`. Start it with the Agent tool and `subagent_type: <name>`. Start several in one message to run them in parallel.
- **Codex:** `.codex/agents/<name>.toml`. Spawn a subagent with the custom agent `<name>`. Spawn several together to run them in parallel, and wait for all of them.

If your tool cannot start subagents, stop and tell the user. The factory depends on separate agents checking each other's work, and one session playing every role defeats that.

Agents take their context from files, never from this conversation. Every prompt is these lines, plus the extra lines each stage lists:

```
Job: <job-id>
Job folder: <repo>/.factory/jobs/<job-id>
Worktree: <worktree>
Branch: factory/<job-id>
Base: <base>
```

Start a fresh agent every time, the builder included. A builder in a later round learns the history from `build.md` and the review files.

## Names and paths

- `<repo>`: the main checkout, `git rev-parse --show-toplevel`. You stay here. It belongs to the user and may be dirty or on another branch; only Merge touches it.
- `<base>`: the branch jobs start from and merge into. Use the remote's default branch (`git symbolic-ref --short refs/remotes/origin/HEAD`, without the `origin/` prefix). With no remote, use `main` if it exists, otherwise `master`.
- `<job-id>`: three digits and a short kebab-case slug, such as `004-post-comments`.
- `<worktree>`: `<parent of repo>/<repo folder name>-factory/<job-id>`, a checkout of `factory/<job-id>`. It sits beside the repo rather than inside it, so the project's test runners, linters and editors never see a second copy of the code.
- `<n>`: the job number without leading zeros. Agents that run the app get a port so parallel jobs never collide: builder `7100 + 10n`, `reviewer-ux` `7101 + 10n`, `reviewer-ui` `7102 + 10n`.

```
<repo>/.factory/jobs/<job-id>/
  job.json          you
  spec.md           spec-writer
  build.md          builder
  round-<N>/        review-security.md, review-code.md, review-ux.md, review-ui.md
  rework-<k>.md     you, from a rework note
  decision.md       approver, or you when rounds run out
```

### job.json

```json
{
  "id": "004-post-comments",
  "request": "add post comment feature, ...",
  "base": "main",
  "branch": "factory/004-post-comments",
  "worktree": "/Users/you/code/blog-factory/004-post-comments",
  "stage": "review",
  "round": 1,
  "reviews": { "security": "pending", "code": "PASS", "ux": "PASS", "ui": "pending" },
  "doc": null
}
```

- `stage`: `spec`, `build`, `review`, `document`, `approve`, `merged` or `needs-human`.
- `reviews`: the current round only. Each is `pending`, `PASS` or `CHANGES`.
- `doc`: the documentation status, `Shipped` or `Not shipped`, once the documenter has run.
- Rewrite the whole file on every change.

## Verify every agent

Agents are told to stay in their lane; you check that they did. Before starting an agent, record `git rev-parse HEAD` in the worktree. When it finishes, run the check for its role in the worktree. If a check fails, set `stage: "needs-human"`, stop, and tell the user exactly what failed.

| After | Check |
|---|---|
| builder | `git branch --show-current` prints `factory/<job-id>`; `git status --porcelain` prints nothing; `git diff --name-only <recorded>..HEAD -- Documentation/` prints nothing |
| each reviewer, the approver | `git rev-parse HEAD` is still the recorded commit; `git status --porcelain` prints nothing |
| documenter | `git diff --name-only <recorded>..HEAD` lists only paths under `Documentation/`; `git status --porcelain` prints nothing |

For the four reviewers, record once before the round and check once after all four have finished.

## /domain-factory <request>

In Codex every command starts with `$domain-factory` instead.

### Setup

1. Keep job state out of git without touching tracked files: `git check-ignore -q .factory/ || echo '.factory/' >> "$(git rev-parse --git-path info/exclude)"`.
2. Work out `<base>` and confirm the branch exists.
3. Create the job. Run `mkdir -p .factory/jobs`, then take the next number after the highest existing job folder (`001` if there is none) and a two-to-four-word slug of the request. Claim it with `mkdir .factory/jobs/<job-id>`, without `-p`. If that fails, another session took the number, so try the next one. Write `job.json` with `stage: "spec"`, `round: 0`, every review `pending` and `doc: null`.
4. Create the worktree: `git worktree add -b factory/<job-id> <worktree> <base>`. In the worktree, run the setup `AGENTS.md` gives for a fresh checkout, such as installing dependencies.

If any of this fails, set `needs-human` and tell the user what failed. When the failure is your tool refusing to write outside the project, say how to allow it. In Claude Code, add `<parent of repo>/<repo folder name>-factory` with `/add-dir` or `permissions.additionalDirectories`. In Codex, run with full access or allow git with a rule, because the default sandbox keeps `.git` read-only.

### Spec

Start `spec-writer` with the extra line `Request: <the request, verbatim>`. When it finishes, check that `spec.md` exists and has `## Acceptance criteria` and `## Documentation` sections.

### Build round N

Set `stage: "build"` and start `builder` with `Round: N` and `Port: <port>`. From the second round of a run, add `Reviews: <job folder>/round-<N-1>`. For a rework, add `Rework: <job folder>/rework-<k>.md`. Verify, then read the first line of `build.md`:

- `STATUS: READY`: run review round N.
- `STATUS: BLOCKED`: Document with `Outcome: not shipped, the builder is blocked`, then Needs human.

### Review round N

1. Set `stage: "review"`, `round: N` and every review to `pending`. Create `round-<N>/`.
2. Start all four reviewers at once, each with `Round: N`. Add `Port: <port>` for `reviewer-ux` and `reviewer-ui`.
3. As each reviewer finishes, read the first line of its file and write the verdict into `job.json`. The round ends only when all four files exist. If an agent ends without writing its file, or its first line is not `VERDICT: PASS` or `VERDICT: CHANGES`, stop and tell the user. Never start a builder while a reviewer is still running.
4. Verify, then decide:
   - All PASS: Document with `Outcome: reviews passed`, then Approve.
   - Any CHANGES before the run's third round: build round N+1.
   - Any CHANGES in the run's third round: Document with `Outcome: not shipped, review rounds ran out`. Then write `decision.md` yourself: `ESCALATE`, a blank line, and `Review rounds ran out. Still CHANGES in round-<N> from: <lenses>.` Then Needs human.

### Document

Set `stage: "document"` and start `documenter` with the `Outcome:` line. Verify. Then read the title line of the page named under `## Documentation` in `spec.md`, and record its status, `Shipped` or `Not shipped`, in `doc`.

### Approve

Set `stage: "approve"` and start `approver` with `Final round: N`. Verify, then read the first line of `decision.md`:

- `APPROVE`: Merge.
- `ESCALATE`: Needs human.

### Merge

The merge happens in the main checkout, which must be on `<base>` with `git status --porcelain` printing nothing. `.factory/` is excluded, so job files do not count. If the checkout is busy, set `needs-human` and tell the user the job is approved and waiting: `/domain-factory approve <job-id>` finishes it once the checkout is clean. Otherwise:

```bash
git merge --no-ff factory/<job-id> -m "Merge factory/<job-id>"
git worktree remove <worktree>
git branch -d factory/<job-id>
```

Set `stage: "merged"`. If the merge fails, run `git merge --abort`, set `needs-human`, and say why. If removing the worktree fails, the job is still merged; pass on what git printed. Never push.

### Needs human

Set `stage: "needs-human"` and keep the branch and worktree. Tell the user the job id, the worktree path and the documentation status, and quote `decision.md` or the `## Blocked` section of `build.md`.

## /domain-factory approve <job-id>

The job must be in `needs-human`. If its documentation says `Not shipped`, tell the user that merging puts that page on `<base>` as it stands, and continue only if they confirm. Then Merge.

## /domain-factory rework <job-id> <note>

The job must be in `needs-human`.

1. Write the note, verbatim, to `rework-<k>.md`, with the next unused `k`.
2. Run Build round N+1, where N is the job's last round, with the `Rework:` line. This starts a new run with the same budget as a new job: its first round plus two more.
3. Carry on exactly as for a new job, through documentation and approval.

## Reporting

Post one short line per transition, for example:

`004-post-comments: round 1, security CHANGES, code/ux/ui PASS → builder round 2`

When the job ends, say whether it merged or needs a person, and why.
