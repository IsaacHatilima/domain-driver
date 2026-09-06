# Stack detection and multi-framework scaffolding

**Date:** 2026-09-06
**Status:** Draft for review
**Scope:** domain-driver 0.2.0

## 1. Goal

domain-driver currently scaffolds a fixed Next.js feature layout. This change makes it detect the project's stack and generate only the layers that stack needs, with file shapes that fit the framework. Five stacks are supported in this release: `next-fullstack`, `next-frontend`, `react`, `node`, and `nest`.

The tool's identity stays the same across every stack: one feature folder per domain, and one file per action per layer. Saving a cat produces `CreateCat.controller.ts`, `CreateCat.service.ts`, `CreateCat.repository.ts`, and `CreateCat.schema.ts` in any stack that has those layers.

## 2. Non-goals

- Remix, TanStack Start, Vue, Svelte, Angular, or any stack beyond the five above.
- ORM-aware repositories. Server repositories are database-agnostic stubs.
- A config file. `--stack` is the only override in this release.
- Editing existing user files, including auto-registering classes in a Nest module.
- Configurable base URLs for the frontend fetch repositories. They keep today's `/api/<feature>` literal.
- Monorepo workspace detection. The tool reads the `package.json` in the current directory only.

## 3. Detection

### 3.1 Inputs

`detectStack(override?: string)` runs once per process from `process.cwd()`. It reads `package.json`, merges the keys of `dependencies` and `devDependencies`, and checks a small set of directories.

### 3.2 Rules

Rules apply in priority order. The first match wins.

| Priority | Signal | Stack |
|---|---|---|
| 1 | `@nestjs/core` present | `nest` |
| 2 | `next` present and an api directory exists | `next-fullstack` |
| 3 | `next` present, no api directory | `next-frontend` |
| 4 | `react` present, `next` absent | `react` |
| 5 | none of the above | `node` |

An api directory is any of `app/api`, `src/app/api`, `pages/api`, or `src/pages/api`.

Nest is checked first because Nest projects also list `express` or `fastify`.

### 3.3 Secondary detection

These run regardless of whether the stack came from a rule or from `--stack`.

- **HTTP framework** (`node` only). The first of `express`, `fastify`, `hono` found in the dependency set, else `null`.
- **Feature root.** The directory features live in, relative to the project root:
  - `next-fullstack`, `next-frontend`: `src/app` if that directory exists, else `app`.
  - `react`, `node`: `src/features` if `src` exists, else `features`.
  - `nest`: `src`.
- **nestjs-zod** (`nest` only). Whether `nestjs-zod` is in the dependency set. Used only to decide whether to print an install hint.

### 3.4 Result

```ts
type StackName = 'next-fullstack' | 'next-frontend' | 'react' | 'node' | 'nest';
type HttpFramework = 'express' | 'fastify' | 'hono';

interface DetectedStack {
  readonly stack: StackName;
  readonly source: 'detected' | 'override';
  readonly httpFramework: HttpFramework | null;
  readonly featureRoot: string;
  readonly hasNestjsZod: boolean;
}
```

The object is frozen. The result is cached at module level, with `resetStackCache()` exported for tests, mirroring the existing alias cache.

### 3.5 Override and visibility

- A global `--stack <name>` option on the CLI sets `stack` and marks `source` as `override`. Secondary detection still runs from disk.
- When `--stack` is given, a missing `package.json` is not an error. Secondary detection treats the dependency set as empty.
- Every command prints exactly one line before writing any file: `Stack: next-fullstack (detected)` or `Stack: node (override)`. For `node` the line appends the framework: `Stack: node (detected), http: express` or `http: none`.

### 3.6 Errors

| Condition | Message |
|---|---|
| No `package.json` and no `--stack` | `No package.json found in <cwd>. Run domain-driver from your project root, or pass --stack <name>.` |
| `package.json` is not valid JSON | `Could not parse package.json: <parser message>` |
| Unknown `--stack` value | `Unknown stack "<value>". Valid stacks: next-fullstack, next-frontend, react, node, nest.` |

## 4. Profiles

Each stack has one profile module under `src/stack/profiles/`. A profile declares the folders `make:feature` creates, the entry file, the layers the stack supports, and which template renders each layer. Commands consult the profile through a registry and never branch on the stack name themselves.

### 4.1 Feature root and entry file

| Stack | Feature folder | Entry file created without `-a` |
|---|---|---|
| `next-fullstack` | `<featureRoot>/<feature>` | `page.tsx` |
| `next-frontend` | `<featureRoot>/<feature>` | `page.tsx` |
| `react` | `<featureRoot>/<feature>` | none |
| `node` | `<featureRoot>/<feature>` | none |
| `nest` | `<featureRoot>/<feature>` | `<feature>.module.ts` with empty `controllers` and `providers` |

The Nest module is the feature's registration point, the same role `page.tsx` plays under Next.

### 4.2 Folders created by `make:feature`

Relative to the feature folder. Without `-a`, each gets a `.gitkeep`.

| Stack | Folders |
|---|---|
| `next-fullstack` | `components/client`, `components/server`, `containers`, `hooks`, `client/services`, `client/repositories`, `server/services`, `server/repositories`, `schemas`, `types` |
| `next-frontend` | `components/client`, `components/server`, `containers`, `hooks`, `services`, `repositories`, `schemas`, `types` |
| `react` | `components`, `containers`, `hooks`, `services`, `repositories`, `schemas`, `types` |
| `node` | `controllers`, `services`, `repositories`, `schemas`, `types` |
| `nest` | `controllers`, `services`, `repositories`, `schemas`, `dto`, `types` |

For `next-fullstack`, the API route folders `<featureRoot>/api/<feature>` and `<featureRoot>/api/<feature>/[id]` are created only by `-a` or `make:controller`, not by a bare `make:feature`.

### 4.3 Layer matrix

| Layer | next-fullstack | next-frontend | react | node | nest |
|---|---|---|---|---|---|
| page | yes | yes | no | no | no |
| component | `components/client`, `components/server` | same | `components`, no directive | no | no |
| container | yes | yes | yes, no directive | no | no |
| hook | yes | yes | yes, no directive | no | no |
| client service | `client/services` | `services` | `services` | no | no |
| client repository | `client/repositories` | `repositories` | `repositories` | no | no |
| server service | `server/services` | no | no | `services` | `services` |
| server repository | `server/repositories` | no | no | `repositories` | `repositories` |
| controller | route handlers under `<featureRoot>/api/<feature>` | no | no | `controllers` + routes file | `controllers` |
| module | no | no | no | no | `<feature>.module.ts` |
| dto | no | no | no | no | `dto` |
| schema | `schemas` | `schemas` | `schemas` | `schemas` | `schemas` |
| types | `types` | `types` | `types` | `types` | `types` |

### 4.4 What `-a` generates

In order, so that console output reads top-down through the layers:

- `next-fullstack`: types, schemas, server repositories, server services, route handlers, client repositories, client services, hook, client component, container, page.
- `next-frontend`: types, schemas, repositories, services, hook, client component, container, page.
- `react`: types, schemas, repositories, services, hook, component, container.
- `node`: types, schemas, repositories, services, controllers, routes file (when a framework was detected).
- `nest`: types, schemas, DTOs, repositories, services, controllers, module populated with every controller and provider.

## 5. Naming

### 5.1 Inputs

- The feature name is the `<name>` argument of `make:feature` and the `<feature>` argument of every other command, expected in kebab-case. It must match `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`. Anything else fails with `Feature name "<name>" must be kebab-case, for example coffee-type.`
- The entity name is the PascalCase form of the feature name, `coffee-type` becomes `CoffeeType`. Commands that take an explicit `<name>` use it as given, as today.

### 5.2 Files

Actions are `List`, `Show`, `Create`, `Update`, `Delete`. Schemas and DTOs exist only for `Create` and `Update`.

| Layer | File | Exported symbol |
|---|---|---|
| service | `<Action><Entity>.service.ts` | `class <Action><Entity>Service` |
| repository | `<Action><Entity>.repository.ts` | `class <Action><Entity>Repository` |
| controller, Express/Fastify/Hono | `<Action><Entity>.controller.ts` | `function <action><Entity>Controller` |
| controller, generic Node | `<Action><Entity>.controller.ts` | `class <Action><Entity>Controller` |
| controller, Nest | `<Action><Entity>.controller.ts` | `class <Action><Entity>Controller` |
| schema | `<Action><Entity>.schema.ts` | `<Action><Entity>Schema` and type `<Action><Entity>` |
| dto | `<Action><Entity>.dto.ts` | `class <Action><Entity>Dto` |
| types | `<Entity>.types.ts` | `interface <Entity>` |
| hook | `use<Entity>.ts` | `function use<Entity>` |
| container | `<Entity>Container.tsx` | default export |
| component | `<Entity>.tsx` | default export |
| routes | `<feature>.routes.ts` | see 6.5 |
| module | `<feature>.module.ts` | `class <Entity>Module` |
| Next route handlers | `route.ts` | `GET`, `POST`, `PUT`, `DELETE` |

## 6. Templates

Templates live in `src/templates/`, one small module per template, grouped by `frontend/`, `backend/`, `controllers/`, `nest/`, and `shared/`. Each exports a pure function from a render context to a string. A render context carries the feature name, entity name, the detected stack, and an import resolver bound to the file being written.

### 6.1 Frontend layers

- `page.tsx`, container, hook, client service, and client repository keep their current content for the Next profiles.
- The `react` profile omits `'use client'` from components, containers, and hooks, and writes components to `components/` instead of `components/client/`.
- The `next-fullstack` profile writes client services and repositories under `client/`. The hook imports from `client/services`. Content is otherwise identical to `next-frontend`.

### 6.2 Shared layers

- Types: unchanged.
- Schemas: the Update schema no longer includes `id`. Every controller reads the id from the path, and the update service and repository already take it as a separate argument.

### 6.3 Server services

Same shape as today's service, one class with one `handle` method delegating to its repository.

Under Nest the class is decorated `@Injectable()` and receives its repository through the constructor:

```ts
@Injectable()
export class CreateCatService {
  constructor(private readonly repository: CreateCatRepository) {}

  async handle(data: CreateCat): Promise<Cat> {
    return this.repository.handle(data);
  }
}
```

### 6.4 Server repositories

Database-agnostic. Each `handle` carries a comment marking where the ORM call goes and throws so that an unwired repository fails loudly:

```ts
export class CreateCatRepository {
  async handle(data: CreateCat): Promise<Cat> {
    // TODO: persist with your ORM (Prisma, Drizzle, TypeORM, ...)
    throw new Error('CreateCatRepository.handle is not implemented');
  }
}
```

Under Nest the class is decorated `@Injectable()`.

### 6.5 Controllers

Every controller with a body validates it with the feature's schema via `safeParse` and returns 400 with `error.flatten()` on failure. Status codes: List 200, Show 200, Create 201, Update 200, Delete 204. Thrown errors are forwarded to the framework's error path: `next(err)` in Express, a rethrow that Fastify and Hono route to their error handlers, and a plain propagation in Next route handlers, which yields a 500.

**Express.** Handlers take `(req: Request, res: Response, next: NextFunction)`. Errors go to `next(err)`. The routes file:

```ts
const router = Router();
router.get('/', listCatController);
router.get('/:id', showCatController);
router.post('/', createCatController);
router.put('/:id', updateCatController);
router.delete('/:id', deleteCatController);
export default router; // app.use('/cat', catRoutes)
```

**Fastify.** Handlers take `(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply)`. The routes file exports `async function catRoutes(app: FastifyInstance)` registering the five handlers, mounted with `app.register(catRoutes, { prefix: '/cat' })`.

**Hono.** Handlers take `(c: Context)`. The routes file builds `new Hono()`, registers the five handlers, and exports it for `app.route('/cat', cat)`.

**Generic Node.** No framework detected. Each controller is a class whose `handle(input: unknown)` validates and calls the service. No routes file. The CLI prints `No HTTP framework detected, generating framework-agnostic controllers.`

**Nest.** One class per action, all decorated `@Controller('<feature>')`, one decorated method each:

```ts
@Controller('cat')
export class CreateCatController {
  constructor(private readonly service: CreateCatService) {}

  @Post()
  handle(@Body() body: CreateCatDto): Promise<Cat> {
    return this.service.handle(body);
  }
}
```

Nest merges controllers sharing a prefix into one route table. Validation is delegated to the global `ZodValidationPipe` from `nestjs-zod`, see 6.6.

**Next.js route handlers.** The App Router fixes file layout, so this is the one stack where the per-action split stops at the function level. `<featureRoot>/api/<feature>/route.ts` exports `GET` (list) and `POST` (create). `<featureRoot>/api/<feature>/[id]/route.ts` exports `GET` (show), `PUT` (update), and `DELETE`. Handlers use the async params signature required by Next 15 and later:

```ts
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json(await showService.handle(id));
}
```

Route handlers import from `server/services`.

### 6.6 Nest DTOs and module

DTOs derive from the schema so there is one definition of each shape:

```ts
export class CreateCatDto extends createZodDto(CreateCatSchema) {}
```

Generated for Create and Update only. Whenever a Nest DTO is written and `hasNestjsZod` is false, the CLI prints once:

```
nestjs-zod is not installed. Run: npm install nestjs-zod
Then register the pipe in AppModule: { provide: APP_PIPE, useClass: ZodValidationPipe }
```

The module registers all five controllers and all ten providers when generated by `-a`. A bare `make:feature` writes it with empty arrays. Single-layer Nest commands print `Register <ClassName> in <feature>.module.ts` and never edit the module.

### 6.7 Import resolution

The current resolver assumes every file sits one folder below the feature root, which is wrong for `client/` and `server/`. It is replaced by:

```ts
resolveImport(fromFile: string, toFile: string): string
```

Both arguments are absolute paths. The result drops the extension. If a tsconfig path alias covers `toFile`, the alias form is returned, for example `@/app/cat/server/services/CreateCat.service`. Otherwise a correct relative path is computed with `path.relative` and prefixed with `./` when needed.

Alias detection is generalised. For each `paths` key ending in `/*`, the first target of the form `./<dir>/*` or `./*` yields `{ prefix, root }`. The first such entry wins. This replaces the current hardcoded `app` and `src` checks.

## 7. CLI surface

- Global option `--stack <name>`, validated per 3.6.
- `make:feature <name> [-a]`. Creates the profile's folders and entry file. With `-a`, generates the layers listed in 4.4.
- `make:component <feature> <name> [type]`. On `react`, `type` other than `client` fails with `The react stack has no server components.`
- `make:container`, `make:hook`, `make:schema`, `make:types`. Unchanged signatures. `make:schema` on `nest` also writes the DTOs.
- `make:service <feature> <name> [--side client|server|both]` and `make:repository` with the same option. Default `both`. On `next-fullstack`, `both` writes both sides. On every other stack, `both` resolves to the stack's only side, and naming the other side fails with `The <stack> stack has no <side>-side services.`
- New `make:controller <feature> <name>`. On `node` and `nest`, writes the five controllers and, for `node` with a framework, the routes file. On `next-fullstack`, writes the two route files. On `next-frontend` and `react`, fails.
- Any single-layer command on a stack whose profile lacks that layer fails with `make:<layer> is not available for the <stack> stack. Available: <list>.`
- Existing files are skipped with the current warning, never overwritten.

Package metadata: version `0.2.0`, description `CLI scaffolding tool for domain-driven feature folders in Next.js, React, Node, and NestJS projects`. The README is rewritten to document detection, the five stacks, the layer matrix, and the new commands.

## 8. Code layout

```
src/
  index.ts                         commander wiring only
  stack/
    types.ts                       StackName, HttpFramework, DetectedStack, Layer, StackProfile
    detect.ts                      detectStack, resetStackCache
    registry.ts                    getProfile(stack)
    profiles/
      next-fullstack.ts
      next-frontend.ts
      react.ts
      node.ts
      nest.ts
  templates/
    context.ts                     RenderContext type and factory
    frontend/                      page, component, container, hook, client-service, client-repository
    backend/                       server-service, server-repository
    controllers/                   express, fastify, hono, generic, next-route, nest
    nest/                          module, dto
    shared/                        schema, types
  commands/                        one thin file per command
  utils/
    fs.ts                          writeFileSafe, mkdirSafe, fileExists
    naming.ts                      toPascalCase, toCamelCase, validateFeatureName
    alias.ts                       detectAlias, resetAliasCache
    imports.ts                     resolveImport
```

Every file stays under a few hundred lines. All exported data structures are readonly and every function returns new values rather than mutating inputs.

## 9. Error handling

- Detection errors per 3.6.
- Name validation per 5.1.
- Layer availability and side errors per 7.
- File-system failures keep the current wrapped messages from `writeFileSafe` and `mkdirSafe`.
- `index.ts` keeps the current pattern: catch, print `❌ <message>`, exit 1.

## 10. Testing

Tests use vitest with temporary directories and `process.chdir`, matching the existing suites. Each temp project gets a fixture `package.json` written by a helper, `writePackageJson(deps: Record<string, string>)`, plus any directories the case needs.

- **Detector.** One case per rule, priority of Nest over Next and Next over React, each api directory variant, `src/app` versus `app`, `src` presence for React and Node, HTTP framework detection order, `hasNestjsZod`, the override path with and without `package.json`, missing `package.json`, malformed JSON, and unknown stack name.
- **Alias and imports.** Alias root variants (`./src/*`, `./app/*`, `./*`), relative fallback, and depth-two paths such as `client/repositories` importing `types`.
- **Naming.** Valid and invalid feature names.
- **Profiles.** Each profile's folder list and layer set match this document.
- **Per-stack integration.** For each of the five stacks, run `make:feature -a` in a fixture project and assert the exact file tree. Then parse every `import ... from '<path>'` in every generated file and assert the target exists on disk, resolving aliases through the fixture tsconfig. This extends the existing import test to all stacks. `node` runs once per framework plus generic.
- **Command availability.** `make:hook` on `node`, `make:controller` on `react`, `--side server` on `react`, and `server` component type on `react` each throw the specified message.
- **Existing suites.** Updated to write a `next` fixture so they run under `next-frontend`, and to expect the Update schema without `id`.

Coverage target: 80 percent, per the project's testing rules.

## 11. Follow-ups deliberately left out

- `domain-driver.config.json` for persistent stack and feature-root overrides.
- Configurable API base URL for the frontend repositories.
- ORM-aware server repositories, for example Prisma or Drizzle detection.
- Further stacks: Remix, TanStack Start, Hono as a full-stack target.
- Monorepo workspace detection.
