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

### `make:feature`

```bash
domain-driver make:feature <name>       # folders + .gitkeep, plus page.tsx (Next) or the module (Nest)
domain-driver make:feature <name> -a    # every layer for the detected stack
```

Feature names must be kebab-case, for example `coffee-type`.

### `make:controller`

```bash
domain-driver make:controller <feature> <Entity>
```

Node: five controllers plus `<feature>.routes.ts` for Express, Fastify, or Hono. Nest: five single-action controllers. Next.js fullstack: `app/api/<feature>/route.ts` and `app/api/<feature>/[id]/route.ts`. Not available on frontend-only stacks.

### `make:service` and `make:repository`

```bash
domain-driver make:service <feature> <Entity> [--side client|server|both]
domain-driver make:repository <feature> <Entity> [--side client|server|both]
```

`--side` matters on `next-fullstack`, where both sides exist. Default is `both`.

### `make:schema`

```bash
domain-driver make:schema <feature> <Entity>
```

Writes `Create<Entity>.schema.ts` and `Update<Entity>.schema.ts`. On Nest it also writes the matching DTO classes derived with `createZodDto` from `nestjs-zod`.

### `make:types`, `make:component`, `make:container`, `make:hook`

```bash
domain-driver make:types <feature> <Entity>
domain-driver make:component <feature> <Name> [client|server]
domain-driver make:container <feature> <Name>
domain-driver make:hook <feature> <useName>
```

Frontend commands fail with a clear message on backend stacks, and `server` components are rejected on React.

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

Mount the routes with `app.use('/coffee-type', coffeeTypeRoutes)`.

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
- [ ] Config file — override stack and feature root per project
- [ ] Configurable API base URL for client repositories
- [ ] ORM-aware server repositories

---

## License

MIT
