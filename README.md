# domain-driver 🚀

A CLI scaffolding tool for domain-driven feature folders. Like Laravel's `php artisan make`, but for Next.js, React, Node, NestJS, and TanStack Start projects. It detects your stack and generates only the layers that stack needs, one file per action.

---

## Installation

```bash
npm install -g domain-driver
```

Or use without installing:

```bash
npx domain-driver make:feature <feature>[/<Entity>]
```

---

## Stack detection

Every command reads your `package.json` once and prints the stack it found before writing anything:

```
Stack: next-fullstack (detected)
```

| Stack | Detected when | Features live in |
|---|---|---|
| `nest` | `@nestjs/core` is a dependency | `src/<feature>` |
| `tanstack-start` | `@tanstack/react-start` is a dependency | `src/routes/<feature>` or `routes/<feature>` |
| `next-fullstack` | `next` is a dependency and `app/api`, `src/app/api`, `pages/api`, or `src/pages/api` exists | `app/<feature>` or `src/app/<feature>` |
| `next-frontend` | `next` is a dependency, no api directory | `app/<feature>` or `src/app/<feature>` |
| `react` | `react` is a dependency, `next` is not | `src/features/<feature>` or `features/<feature>` |
| `node` | none of the above | `src/features/<feature>` or `features/<feature>` |

For `node`, the tool also picks up Express, Fastify, or Hono and shapes the controllers accordingly. With none of them present it generates framework-agnostic controller classes.

Override detection with `--stack`:

```bash
domain-driver --stack nest make:feature cat -a
```

---

## What each stack generates

| Layer | next-fullstack | next-frontend | react | node | nest | tanstack-start |
|---|---|---|---|---|---|---|
| entry file (`page.tsx`; `index.tsx` on tanstack-start) | yes | yes | | | | yes |
| components | client + server | client + server | flat | | | flat |
| containers, hooks | yes | yes | yes | | | yes (Query hooks) |
| client services + repositories | `client/` (fetch) | top level (fetch) | top level (fetch) | | | `-client/` (calls server functions, no fetch) |
| server services + repositories (database stubs) | `server/` | | | yes | yes | `-server/` |
| controllers | `app/api/<feature>/` route handlers | | | five files + routes file | five files | server functions (`-server/functions/*.fn.ts`) |
| module | | | | | yes | |
| DTOs (`nestjs-zod`) | | | | | yes | |
| schemas (Zod), types | yes | yes | yes | yes | yes | yes |

Every layer that has actions gets one file per action: `List`, `Show`, `Create`, `Update`, `Delete`. Saving a cat means `CreateCat.controller.ts`, `CreateCat.service.ts`, `CreateCat.repository.ts`, `CreateCat.schema.ts`, and, on stacks with a hook layer, `CreateCat.hook.ts` exporting `useCreateCat`.

---

## Commands

Every layer command takes one target, `<feature>/<Name>`: the feature folder on the left, the name used inside the files on the right. `users/User` reads as "User inside users".

### `make:feature`

```bash
domain-driver make:feature users            # folders + .gitkeep, plus page.tsx (Next), index.tsx (TanStack Start), or the module (Nest)
domain-driver make:feature users/User -a    # every layer for the detected stack, entity User
```

Feature names must be kebab-case. Without `/Entity`, the entity is the PascalCase feature name (`users` becomes `Users`).

### `make:action`

```bash
domain-driver make:action users/User findActiveUsers
domain-driver make:action users/User archiveUser --with-input --returns one
```

Scaffolds a bespoke operation as its own files, so it never lands inside `ShowUser` or `ListUser`. The action name is used as-is for file and class names: `FindActiveUsers.service.ts`, `FindActiveUsersService`, handler `findActiveUsersController`, route `/find-active-users`. Include the noun in the name (`archiveUser`, not `archive`).

| Option | Effect |
|---|---|
| `--with-input` | writes `ArchiveUser.schema.ts` (and the Nest DTO), the service takes `data`, the controller is a `POST` with body validation |
| `--returns list` | `Promise<User[]>` (default) |
| `--returns one` | `Promise<User>` |
| `--returns void` | `Promise<void>`, controller responds 204 |

| Stack | Files written |
|---|---|
| `node` | service, repository, controller for the detected framework, plus the line to add above the `/:id` routes in `<feature>.routes.ts` printed |
| `nest` | injectable service and repository, `@Controller` class, DTO with input, plus the classes to register printed, with the controller listed before `Show<Entity>Controller` |
| `next-fullstack` | server service and repository, client service and repository, a hook, `app/api/<feature>/<slug>/route.ts` |
| `next-frontend`, `react` | client service and repository calling `/api/<feature>/<slug>`, and a hook |
| `tanstack-start` | server service and repository, client service and repository, a hook, and a server function (`<Name>.fn.ts`) in place of a route handler |

### `make:controller`

```bash
domain-driver make:controller users/User
```

Node: five controllers plus `<feature>.routes.ts` for Express, Fastify, or Hono. Nest: five single-action controllers. Next.js fullstack: `app/api/<feature>/route.ts` and `app/api/<feature>/[id]/route.ts`. TanStack Start: five server functions (`<Name>.fn.ts`, built with `createServerFn`) under `-server/functions/`. Not available on frontend-only stacks (`next-frontend`, `react`).

### `make:service` and `make:repository`

```bash
domain-driver make:service users/User [--side client|server|both]
domain-driver make:repository users/User [--side client|server|both]
```

`--side` matters on `next-fullstack` and `tanstack-start`, where both sides exist. Default is `both`.

### `make:schema`

```bash
domain-driver make:schema users/User
```

Writes `CreateUser.schema.ts` and `UpdateUser.schema.ts`. On Nest it also writes the matching DTO classes derived with `createZodDto` from `nestjs-zod`.

### `make:types`, `make:component`, `make:container`, `make:hook`

```bash
domain-driver make:types users/User
domain-driver make:component users/UserCard [client|server]
domain-driver make:container users/UserContainer
domain-driver make:hook users/User
```

Component, container, and hook commands fail with a clear message on backend stacks, and `server` components are rejected on React.

`make:hook` writes one file per action instead of a combined hook: `ListUser.hook.ts`, `ShowUser.hook.ts`, `CreateUser.hook.ts`, `UpdateUser.hook.ts`, `DeleteUser.hook.ts`, each exporting one hook (`useListUser`, `useShowUser`, `useCreateUser`, `useUpdateUser`, `useDeleteUser`). There is no combined `useUser.ts`. On `react`, `next-frontend`, and `next-fullstack` these hold plain React state; on `tanstack-start` they are TanStack Query hooks backed by a generated `<feature>.keys.ts` cache-key module. Generating hooks on this profile prints a one-time reminder to install `@tanstack/react-query`, since TanStack Start does not bundle it.

Because the five hooks no longer share state, containers wire them together. On `react`, `next-frontend`, and `next-fullstack`, where hooks hold plain state:

```tsx
const { data, loading, error, refetch } = useListCat();
const { createCat } = useCreateCat({ onSuccess: refetch });
```

On `tanstack-start`, `useListCat()` returns the `useQuery` result (`data`, `isPending`, `error`, ...) and `useCreateCat()` returns the `useMutation` result (`mutate`, `mutateAsync`, `isPending`, ...) directly — there is no `createCat` property and no `onSuccess` option; the hook invalidates the query cache internally on success:

```tsx
const { data, isPending, error } = useListCat();
const { mutate: createCat } = useCreateCat();
```

### `init`

```bash
domain-driver init
```

Writes agent guidance into the current project so coding agents scaffold with domain-driver instead of hand-writing layers:

- `AGENTS.md` and `CLAUDE.md` get a section between `<!-- domain-driver:start -->` and `<!-- domain-driver:end -->`. Existing content outside the markers is never touched; the section is created, refreshed in place, or left alone.
- `.claude/skills/domain-driver/SKILL.md` is a Claude Code skill owned by the tool.

Running `init` twice reports `unchanged`. Re-run it after upgrading domain-driver.

**On install.** A local `npm install domain-driver` in a project runs `init` automatically. It does nothing when `CI` is set, for global installs, when there is no `package.json` in the installing project, or when domain-driver installs itself. Files are written to the directory you ran npm install from, which in a workspace is the repository root. Opt out with `npm install --ignore-scripts`, or delete the marked section afterwards.

---

## Example: `make:feature coffee-type -a` on Node with Express

```
src/features/coffee-type/
├── coffee-type.routes.ts
├── controllers/
│   ├── ListCoffeeType.controller.ts
│   ├── ShowCoffeeType.controller.ts
│   ├── CreateCoffeeType.controller.ts
│   ├── UpdateCoffeeType.controller.ts
│   └── DeleteCoffeeType.controller.ts
├── services/            (five files)
├── repositories/        (five files, database-agnostic stubs)
├── schemas/
│   ├── CreateCoffeeType.schema.ts
│   └── UpdateCoffeeType.schema.ts
└── types/
    └── CoffeeType.types.ts
```

Mount the routes with `app.use('/coffee-type', coffeeTypeRoutes)`. Then `make:action coffee-type/CoffeeType findActive` adds `FindActive.controller.ts`, `FindActive.service.ts`, `FindActive.repository.ts`, and prints `router.get('/find-active', findActiveController);` for the routes file.

## Example: `make:feature coffee-type -a` on NestJS

```
src/coffee-type/
├── coffee-type.module.ts          registers 5 controllers and 10 providers
├── controllers/                   five @Controller('coffee-type') classes
├── services/                      five @Injectable() services
├── repositories/                  five @Injectable() repositories
├── dto/
│   ├── CreateCoffeeType.dto.ts
│   └── UpdateCoffeeType.dto.ts
├── schemas/
└── types/
```

Install `nestjs-zod` and register `ZodValidationPipe` as `APP_PIPE` once in your `AppModule`. The tool prints this hint when the package is missing.

---

## Example: `make:feature coffee-type -a` on TanStack Start

```
src/routes/coffee-type/
├── index.tsx                    createFileRoute route — the entry, not page.tsx
├── -components/
│   └── CoffeeType.tsx
├── -containers/
│   └── CoffeeTypeContainer.tsx
├── -hooks/                      coffee-type.keys.ts, plus five hook files (one per action)
├── -client/
│   ├── services/                (five files)
│   └── repositories/            (five files, call the server functions directly)
├── -server/
│   ├── functions/               (five *.fn.ts files, built with createServerFn)
│   ├── services/                (five files)
│   └── repositories/            (five files, database-agnostic stubs)
├── -schemas/
│   ├── CreateCoffeeType.schema.ts
│   └── UpdateCoffeeType.schema.ts
└── -types/
    └── CoffeeType.types.ts
```

Every layer directory carries a `-` prefix so TanStack Router excludes it from routing. The controller layer is server functions — `<Name>.fn.ts` built with `createServerFn` — and client repositories import and call them directly, so there is no `fetch` and no `Response.json`. Hooks are TanStack Query, backed by the generated `coffee-type.keys.ts`. Generating hooks on this profile prints a one-time reminder to install `@tanstack/react-query`, since TanStack Start does not bundle it.

---

## Philosophy

Everything for a feature lives in one folder, and every file does one thing.

- **repositories** — data access only. Client-side repositories call your API (on TanStack Start, the server function directly); server-side repositories call your database.
- **services** — business logic, one class per action.
- **controllers** — HTTP in, service call, HTTP out, one file per action (server functions on TanStack Start).
- **hooks** — state and side effects, one hook per action, calls services (TanStack Query on TanStack Start, plain React state elsewhere).
- **containers** — wire hooks into UI.
- **components** — presentational UI.
- **schemas** — Zod validation for create and update; the update body never carries the id, it comes from the path.
- **types** — the entity interface.

Server-side repositories throw a clear not-implemented error until you wire your ORM. Compiling code that fails loudly beats a fake store that looks like it works.

---

## Updating

Every command checks the registry at most once a day and, when a newer release exists, prints one line after its output:

```
ℹ️  domain-driver 0.3.0 is available (you have 0.2.0). Run: domain-driver update
```

```bash
domain-driver update            # detects how it was installed, runs your package manager, refreshes the guidance
domain-driver update --dry-run  # show the command it would run
domain-driver update --check    # only report whether a newer version exists
```

Local installs use the package manager the project uses (npm, pnpm, yarn, or bun, from the `packageManager` field or the lockfile). Global installs use `npm install -g`. Running through `npx` needs no update: `npx domain-driver@latest` always fetches the newest.

The check is skipped in CI (any `CI` value other than empty, `0`, or `false`), when output is not a terminal, when `DOMAIN_DRIVER_NO_UPDATE_CHECK` is set (same value rule), or when `NO_UPDATE_NOTIFIER` is set to anything.

The cache lives in `~/.cache/domain-driver` (or `$XDG_CACHE_HOME/domain-driver`); `DOMAIN_DRIVER_CACHE_DIR` overrides it.

---

## Upgrading from 0.3.x

Hooks are now one file per action — `<Action><Entity>.hook.ts` exporting `use<Action><Entity>` (`useListCat`, `useCreateCat`, ...) — instead of a single combined `use<Entity>.ts`, which is no longer generated. `make:hook` now takes `<feature>/<Entity>`, not `<feature>/use<Entity>`. `make:action` writes a matching hook alongside the service and repository on any stack that has a hook layer.

domain-driver never overwrites a file that already exists, so this only changes new scaffolding: a `use<Entity>.ts` written by an older version is left alone and keeps working. New features and new actions get the per-action hooks; wire them together in the container, since they no longer share state:

```tsx
const { data, loading, error, refetch } = useListCat();
const { createCat } = useCreateCat({ onSuccess: refetch });
```

This release also adds a sixth stack, `tanstack-start`, detected from `@tanstack/react-start` — see the TanStack Start example above.

## Upgrading from 0.1.0

Every layer command now takes a single `<feature>/<Name>` target instead of separate feature and name arguments, for example `make:schema users User` becomes `make:schema users/User`. `make:feature users -a` still works and names the entity `Users`; write `users/User` if you want a different entity name.

---

## Requirements

- Node.js 20+

---

## Local Development

```bash
git clone https://github.com/IsaacHatilima/domain-driver
cd domain-driver
npm install
npm run build
npm link
npm test
npm run test:coverage
```

`npm run typecheck:tanstack-fixture` compiles a generated TanStack Start feature against the real `@tanstack/react-start` and `@tanstack/react-query` packages to catch drift between the templates and the real APIs. It is network-dependent and slow, so it is not part of `npm test` — run it locally after touching the `tanstack-start` profile or its templates.

---

## Roadmap

- [x] Stack detection for Next.js, React, Node, and NestJS
- [x] `make:controller` with Express, Fastify, Hono, Nest, and Next route handlers
- [x] Per-action files in every layer
- [x] Bespoke actions with make:action
- [x] Agent guidance with init and a guarded postinstall
- [x] TanStack Start stack, with server functions and per-action query hooks
- [x] Per-action hooks on every stack that has them, replacing the single combined hook
- [ ] Config file — override stack and feature root per project
- [ ] Configurable API base URL for client repositories
- [ ] ORM-aware server repositories

---

## License

MIT
