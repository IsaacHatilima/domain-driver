# domain-factory

A feature factory for projects that use domain-driver. You describe a feature in one sentence, and a team of agents writes the spec, scaffolds it with domain-driver, builds it on its own branch, reviews it from four angles, documents it, and either merges it or hands it to you.

```
/domain-factory add post comment feature, the user and post owner should be able to delete or archive the comment and others can only like and reply to it
```

It runs in Claude Code and in Codex. In Codex the command is `$domain-factory`.

> **Status:** these are the source files only. `init` does not install them yet, they are not in the published package, and no job has run end to end.

## The loop

```
request → spec-writer → builder → [security, code, ux, ui] → documenter → approver → merge
                           ▲                  │                                │
                           └── any CHANGES ───┘          ESCALATE → needs-human ┘
```

- The session that runs the skill is the orchestrator. It creates the job, starts each agent, checks what each agent left behind, and never writes code.
- Agents take their context from files, and each writes only its own files. Reviews start with `VERDICT: PASS` or `VERDICT: CHANGES`; `decision.md` starts with `APPROVE` or `ESCALATE`.
- The four reviewers run in parallel, and a round ends when all four have written their file. Any CHANGES sends a fresh builder back in, at most twice.
- The documenter runs whether or not the job shipped, so a blocked job still leaves a page saying why.
- Every job works in its own git worktree on a `factory/<job-id>` branch, beside the repository, so several jobs can run at once from separate sessions.

Commands, in Claude Code (use `$domain-factory` in Codex):

```
/domain-factory <request>               run a new job
/domain-factory approve <job-id>        merge a job that is waiting for you
/domain-factory rework <job-id> <note>  send a waiting job back to the builder with your note
```

## Agents

| Agent | Claude Code | Codex | Writes |
|---|---|---|---|
| spec-writer | opus, high | gpt-6-astra, high | `spec.md` |
| builder | opus, high | gpt-6-sol, high | commits on `factory/<job-id>`, `build.md` |
| reviewer-security | opus, high | gpt-6-astra, high | `round-<N>/review-security.md` |
| reviewer-code | sonnet, high | gpt-6-sol, high | `round-<N>/review-code.md` |
| reviewer-ux | sonnet, medium | gpt-6-luna, medium | `round-<N>/review-ux.md` |
| reviewer-ui | sonnet, medium | gpt-6-luna, medium | `round-<N>/review-ui.md` |
| documenter | sonnet, high | gpt-6-sol, high | `Documentation/<Entity>.md`, `Documentation/index.md` |
| approver | opus, high | gpt-6-astra, high | `decision.md` |

Each agent's reasoning effort is set explicitly for both tools. Without it, an agent would run at whatever effort the session that started it uses.

## This folder

```
factory/
  skill/SKILL.md            the orchestrator, the same file for both tools
  skill/agents/openai.yaml  Codex metadata: never start the skill implicitly
  agents/<name>.md          one file per agent: frontmatter for both tools, then the instructions
```

Each agent is written once. Once `init` installs the factory, it will render each one for each tool:

| Source | Claude Code | Codex |
|---|---|---|
| `skill/SKILL.md` | `.claude/skills/domain-factory/SKILL.md` | `.agents/skills/domain-factory/SKILL.md`, plus `agents/openai.yaml` |
| `agents/<name>.md` | `.claude/agents/<name>.md` with `name`, `description`, `tools`, `model`, `effort` | `.codex/agents/<name>.toml` with `name`, `description`, `model`, `model_reasoning_effort`, `developer_instructions` |

Agent frontmatter keys: `name`, `description`, `claude-model`, `claude-tools`, `claude-effort`, `codex-model`, `codex-reasoning-effort`. Everything below the frontmatter is the instructions, copied unchanged into both outputs, so the two tools can never drift apart.

## What it writes into a project

- `.factory/jobs/<job-id>/`: job state (`job.json`, `spec.md`, `build.md`, the review rounds, `decision.md`). It is runtime state only. The orchestrator lists `.factory/` in `.git/info/exclude`, so it is never committed and `.gitignore` is never touched.
- `../<repo>-factory/<job-id>/`: the job's worktree, removed after a merge.
- `Documentation/<Entity>.md` and `Documentation/index.md`: committed on the job branch, so they reach the base branch only when the job merges.

## Security

- The security reviewer runs on the strongest model and goes through the spec's Permissions table one action at a time, from entry point to service to repository. A missing check, or one that lives only in the client, always blocks the round.
- Only the builder changes code, and only the documenter changes `Documentation/`. Those are instructions to the agents, and the orchestrator verifies them after every agent: a reviewer or approver that leaves a commit or a changed file stops the job, and so does a documentation commit that touches anything outside `Documentation/`.
- The approver escalates anything that changes who may do what, migrations, new dependencies, CI or deploy changes, and product decisions the spec had to assume. A feature that restricts any action by identity always ends with a person.
- The skill never starts on its own: Claude Code sees `disable-model-invocation: true` and Codex sees `allow_implicit_invocation: false`.
- Nothing is ever pushed.

## What a project needs

- An `AGENTS.md` (or `CLAUDE.md`) that says how to set up a fresh checkout, start the dev server on a given port, and run tests, type-check, build and lint. The agents carry nothing project-specific.
- Permission for agents to run git and the project's commands unattended, and to write to the worktree folder beside the repository.
  - Claude Code: add `../<repo>-factory` with `/add-dir` or `permissions.additionalDirectories`, and allow git and the project's commands.
  - Codex: the default `workspace-write` sandbox keeps `.git` read-only, so every commit would stop for approval. Run with full access, or allow git with a rule.
- The `agent-browser` CLI, if the project has pages. The builder and the UX and UI reviewers use it.

## Credit

The loop is modelled on the software factory in [zazencodes-season-3](https://github.com/zazencodes/zazencodes-season-3/tree/main/src/software-factory-claude-code). The files here are written for domain-driver and do not copy its text.
