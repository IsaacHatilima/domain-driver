# domain-driver 🚀

A CLI scaffolding tool for domain-driven feature folders. Like Laravel's `php artisan make`, but for Next.js, React, Node, and NestJS projects. It detects your stack and generates only the layers that stack needs, one file per action.

---

## Installation

```bash
npm install -g domain-driver
```

Or use without installing:

```bash
npx domain-driver make:feature <name>
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

| Layer | next-fullstack | next-frontend | react | node | nest |
|---|---|---|---|---|---|
| `page.tsx` | yes | yes | | | |
| components | client + server | client + server | flat | | |
| containers, hooks | yes | yes | yes | | |
| client services + repositories (fetch) | `client/` | top level | top level | | |
| server services + repositories (database stubs) | `server/` | | | yes | yes |
| controllers | `app/api/<feature>/` route handlers | | | five files + routes file | five files |
| module | | | | | yes |
| DTOs (`nestjs-zod`) | | | | | yes |
| schemas (Zod), types | yes | yes | yes | yes | yes |

Every layer that has actions gets one file per action: `List`, `Show`, `Create`, `Update`, `Delete`. Saving a cat means `CreateCat.controller.ts`, `CreateCat.service.ts`, `CreateCat.repository.ts`, and `CreateCat.schema.ts`.

---

## Commands

Every layer command takes one target, `<feature>/<Name>`: the feature folder on the left, the name used inside the files on the right. `users/User` reads as "User inside users".

### `make:feature`

```bash
domain-driver make:feature users            # folders + .gitkeep, plus page.tsx (Next) or the module (Nest)
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
| `--with-input` | writes `FindActiveUsers.schema.ts` (and the Nest DTO), the service takes `data`, the controller is a `POST` with body validation |
| `--returns list` | `Promise<User[]>` (default) |
| `--returns one` | `Promise<User>` |
| `--returns void` | `Promise<void>`, controller responds 204 |

| Stack | Files written |
|---|---|
| `node` | service, repository, controller for the detected framework, plus the line to add above the `/:id` routes in `<feature>.routes.ts` printed |
| `nest` | injectable service and repository, `@Controller` class, DTO with input, plus the classes to register printed, with the controller listed before `Show<Entity>Controller` |
| `next-fullstack` | server service and repository, client service and repository, `app/api/<feature>/<slug>/route.ts` |
| `next-frontend`, `react` | client service and repository calling `/api/<feature>/<slug>` |

### `make:controller`

```bash
domain-driver make:controller users/User
```

Node: five controllers plus `<feature>.routes.ts` for Express, Fastify, or Hono. Nest: five single-action controllers. Next.js fullstack: `app/api/<feature>/route.ts` and `app/api/<feature>/[id]/route.ts`. Not available on frontend-only stacks.

### `make:service` and `make:repository`

```bash
domain-driver make:service users/User [--side client|server|both]
domain-driver make:repository users/User [--side client|server|both]
```

`--side` matters on `next-fullstack`, where both sides exist. Default is `both`.

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
domain-driver make:hook users/useUser
```

Component, container, and hook commands fail with a clear message on backend stacks, and `server` components are rejected on React.

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

## Philosophy

Everything for a feature lives in one folder, and every file does one thing.

- **repositories** — data access only. Client-side repositories call your API; server-side repositories call your database.
- **services** — business logic, one class per action.
- **controllers** — HTTP in, service call, HTTP out, one file per action.
- **hooks** — React state and side effects, calls services.
- **containers** — wire hooks into UI.
- **components** — presentational UI.
- **schemas** — Zod validation for create and update; the update body never carries the id, it comes from the path.
- **types** — the entity interface.

Server-side repositories throw a clear not-implemented error until you wire your ORM. Compiling code that fails loudly beats a fake store that looks like it works.

---

## Upgrading from 0.1.0

Every layer command now takes a single `<feature>/<Name>` target instead of separate feature and name arguments, for example `make:schema users User` becomes `make:schema users/User`. `make:feature users -a` still works and names the entity `Users`; write `users/User` if you want a different entity name.

---

## Requirements

- Node.js 18+

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

---

## Roadmap

- [x] Stack detection for Next.js, React, Node, and NestJS
- [x] `make:controller` with Express, Fastify, Hono, Nest, and Next route handlers
- [x] Per-action files in every layer
- [x] Bespoke actions with make:action
- [x] Agent guidance with init and a guarded postinstall
- [ ] Config file — override stack and feature root per project
- [ ] Configurable API base URL for client repositories
- [ ] ORM-aware server repositories

---

## License

MIT
