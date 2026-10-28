---
name: nest-architecture
description: "Use when adding a NestJS feature or module, deciding where code belongs, sharing providers between modules, fixing \"Nest can't resolve dependencies\" or circular-import errors, decoupling side effects with events, or setting up config validation, logging, or shutdown."
---

# Architecture

Applies to: `src/**/*.module.ts`, `src/main.ts`, `src/config/**`, `src/common/**`. Project guidance (`AGENTS.md`, `CLAUDE.md`) and existing conventions win over these defaults.

## Layout

Features follow domain-driver: `src/features/<feature>/` when `src/features` exists, otherwise `src/<feature>/`, unless `package.json` sets `domainDriver.featureRoot`. A kebab-case feature folder holds `<feature>.module.ts` and one file per action in each layer:

| Folder | Holds | Skill |
|---|---|---|
| `controllers/` | `CreateProject.controller.ts`: route, guards, one action call | `controllers` |
| `schemas/`, `dto/` | Zod input schemas and their `createZodDto` classes | `dtos` |
| `services/` | `CreateProject.service.ts`: the action | `actions` |
| `repositories/` | `CreateProject.repository.ts`: Prisma queries | `database` |
| `types/` | Response schemas, types, and mappers | `dtos` |

The flow is controller → validated DTO → action → repositories → output DTO → envelope (see `api-responses`). Jobs and scripts call the same actions.

- Scaffold with `npx domain-driver make:feature <feature>/<Entity> -a` or `make:action <feature>/<Entity> <actionName>`. Don't hand-write a layer it generates; it also registers the module, controllers, and providers.
- Infrastructure lives in `src/database`, `src/config`, `src/common`, and `src/security`. Code several features share goes in a `shared/` module.

## Modules and providers

- List a provider in exactly one module's `providers`; listing it twice creates two instances. Other modules import that module, which exports only what they use. Reserve `@Global()` for config and database.
- Inject through the constructor with `private readonly`. Providers are singletons, so keep no per-request state in fields, and pass the actor as a parameter rather than using `Scope.REQUEST`.
- Inject config and interfaces through a `Symbol` token with `@Inject(TOKEN)`. Tests replace it with `overrideProvider`, never a `NODE_ENV` branch.
- Break a module cycle by moving the shared part into a third module or turning one direction into an event. `forwardRef` is a last resort.
- Use `@nestjs/event-emitter` for side effects the trigger shouldn't import, such as audit entries, and emit after the transaction commits. `@OnEvent` handlers swallow errors by default, so work that must succeed or retry is a direct call or a job (see `jobs`).

In "Nest can't resolve dependencies of X (?, …)", the `?` marks the missing parameter: provide or export it, or match `@Inject(TOKEN)` to `provide`. An `undefined` there usually means a circular import through a barrel `index.ts`.

## Config, logging, and shutdown

- Validate the environment at boot with a Zod schema (`ConfigModule.forRoot({ validate })`), so a missing or invalid variable stops startup. Inject the typed result; application code never reads `process.env`.
- Log through Nest's `Logger` with a class context, never `console.log`. Log ids, never tokens, passwords, request bodies, or personal data.
- Call `app.enableShutdownHooks()` in `main.ts`, and close Prisma, Redis, and workers in `onModuleDestroy` or `onApplicationShutdown`. Lifecycle hooks `await` their work.
- Put helmet, CORS, and proxy trust in one function that `main.ts` and the e2e tests both call (see `security`, `tests`).

Adapted in part from [nestjs-best-practices](https://github.com/IsaacHatilima/agent-nestjs-skills/tree/main/skills/nestjs-best-practices) (MIT).
