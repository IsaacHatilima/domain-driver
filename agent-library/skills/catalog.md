# Installed skill catalog

Generated from IsaacHatilima/skills. Only the skills delivered to this consumer are listed.

## Resolve skill files

A skill id is its grouped source path. Installed skills have one shared copy in `.agents/skills/`, with group-prefixed folders such as `laravel-actions/SKILL.md`. Claude and Laravel Boost discover these same files through relative links in their native skill directories. Codex reads `.agents/skills/` directly; it does not need `.codex/skills/`.

1. Prefer the target worktree's `.agents/skills/`.
2. Then use the supplied library roots in their stated order: a grouped canonical path, or the group-prefixed folder in a flat root.

Read the selected file and record its absolute path. Library roots outside the target worktree are read-only. Missing required skills block the relevant stage; missing unused groups do not. Project guidance takes precedence. Skills do not expand write ownership or authorize external effects.

## Available skills

| Skill id | Canonical path | Use when |
|---|---|---|
| frontend/app-shell | `frontend/app-shell/SKILL.md` | Use when building or reviewing the frame around signed-in screens (sidebar, header, page layout, the route after login), especially when the sidebar and body clash, the header scrolls away or crowds, a collapsed sidebar hides its options, pages repeat their title, or the shell lacks mobile, loading, or error states. |
| frontend/data-display | `frontend/data-display/SKILL.md` | Use when designing, building, or reviewing how records and metrics are shown (data tables, lists, activity or audit logs, timelines, KPI tiles, summary charts), especially when a table looks generic, numbers don't line up, status is plain text, history is buried in a table, or every section sits in the same card. |
| frontend/overlays | `frontend/overlays/SKILL.md` | Use when adding, choosing, or reviewing a dialog, modal, drawer, sheet, popover, dropdown menu, tooltip, toast, or confirmation, especially when it's unclear what opens it or whether it needs a URL, or when overlays stack, lose focus, close by accident, drop unsaved work, blur the page, or break on mobile. |
| javascript/domain-driver | `javascript/domain-driver/SKILL.md` | Scaffold domain-driven feature folders with the domain-driver CLI. Use when creating a feature, adding a layer (types, schema, repository, service, controller, component, container, hook) to an existing feature, or adding any operation beyond List, Show, Create, Update, and Delete. |
| nest/actions | `nest/actions/SKILL.md` | Use when creating, refactoring, or reviewing a NestJS action or service that performs one business operation, or deciding its typed input, actor, transaction, side effects, or return value. |
| nest/api-responses | `nest/api-responses/SKILL.md` | Use when adding or changing a NestJS JSON response shape, the success envelope or its interceptor, the exception filter, error codes, paginated list output, or how validation, auth, rate-limit, Prisma, and unexpected errors reach the client. |
| nest/architecture | `nest/architecture/SKILL.md` | Use when adding a NestJS feature or module, deciding where code belongs, sharing providers between modules, fixing "Nest can't resolve dependencies" or circular-import errors, decoupling side effects with events, or setting up config validation, logging, or shutdown. |
| nest/controllers | `nest/controllers/SKILL.md` | Use when adding or changing a NestJS controller or route, wiring a DTO, pipe, or guard to an endpoint, choosing an HTTP method or status code, or reading the authenticated actor in a handler. |
| nest/database | `nest/database/SKILL.md` | Use when writing NestJS persistence code with Prisma: setting up PrismaService, adding models or relations to schema.prisma, writing repository queries, fixing N+1 queries or over-fetching, wrapping writes in a transaction, or paginating a list. |
| nest/dtos | `nest/dtos/SKILL.md` | Use when creating or changing a NestJS request DTO, Zod input schema, query or path validation, or partial-update contract, or when deciding what an endpoint returns and how a Prisma result becomes that response. |
| nest/jobs | `nest/jobs/SKILL.md` | Use when adding or reviewing NestJS background work with BullMQ, such as mail, exports, imports, webhooks, or third-party calls, scheduling recurring jobs, or when a request is slow because it does work the client doesn't need to wait for. |
| nest/migrations | `nest/migrations/SKILL.md` | Use when adding or changing a Prisma model, table, column, index, relation, or constraint in a NestJS app, writing a backfill, or running migrations locally, in CI, or in production. |
| nest/security | `nest/security/SKILL.md` | Use when adding or reviewing NestJS authentication or permission guards, public routes, ownership or tenant scoping, rate limits, CORS or helmet, JWT or refresh-token handling, password hashing, or how secrets reach the app. |
| nest/tests | `nest/tests/SKILL.md` | Use when writing, choosing, or running tests for a NestJS application, including unit tests for actions and schemas, e2e tests against an isolated Prisma test database, provider overrides, or deciding which tests a change needs. |
| next/actions | `next/actions/SKILL.md` | Use when adding, changing, or reviewing a Next.js Server Action, a form or button that submits to one, or the revalidation, redirect, or returned state after it. |
| quality/review | `quality/review/SKILL.md` | Use when reviewing a diff, branch, or pull request and deciding what blocks the merge, especially when findings mix real bugs with pre-existing problems, style preferences, or claims about code outside the diff. |
| quality/security-review | `quality/security-review/SKILL.md` | Use when reviewing a diff, branch, or pull request for security problems, such as authorization, injection, redirects, secrets, sensitive data in logs, or limits that a failure could bypass, and deciding which ones block the merge. |
| quality/simplicity | `quality/simplicity/SKILL.md` | Use when writing, refactoring, or reviewing code that should be easy for the next developer to read, especially code written under time pressure, code that grew defensive checks or options nobody asked for, or code with nested conditionals, pass-through methods, or comments that no longer match. |
| tanstack-start/actions | `tanstack-start/actions/SKILL.md` | Use when adding, changing, or reviewing a TanStack Start server function, its validator or auth middleware, or the hook or loader that calls it and refreshes data afterwards. |
