<p align="center">
  <img src="https://raw.githubusercontent.com/IsaacHatilima/domain-driver/master/docs/assets/logo.png" alt="domain-driver logo" width="160">
</p>

<p align="center">
  <a href="https://github.com/IsaacHatilima/domain-driver/actions/workflows/tests.yml"><img src="https://img.shields.io/github/actions/workflow/status/IsaacHatilima/domain-driver/tests.yml?branch=master&label=Tests&logo=github" alt="Tests"></a>
  <a href="https://www.npmjs.com/package/domain-driver"><img src="https://img.shields.io/npm/v/domain-driver?label=stable&color=e8692c" alt="Stable version"></a>
  <a href="https://www.npmjs.com/package/domain-driver"><img src="https://img.shields.io/npm/d18m/domain-driver?label=downloads&color=dfb317" alt="Downloads"></a>
  <a href="https://github.com/IsaacHatilima/domain-driver/blob/master/package.json"><img src="https://img.shields.io/npm/l/domain-driver?label=license&color=97ca00" alt="License"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/domain-driver?label=node&color=007ec6" alt="Node version"></a>
</p>

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
Stack: next-fullstack (detected), root: src/app
```

| Stack | Detected when | Features live in |
|---|---|---|
| `nest` | `@nestjs/core` is a dependency | `src/features/<feature>` if `src/features` exists, otherwise `src/<feature>` |
| `tanstack-start` | `@tanstack/react-start` is a dependency | `src/routes/<feature>` or `routes/<feature>` |
| `next-fullstack` | `next` is a dependency and the app has a server side: `app/api`, `src/app/api`, `pages/api` or `src/pages/api` exists, a database client is a dependency (`drizzle-orm`, `@prisma/client`, `prisma`, `pg`, `postgres`, `mysql2`, `better-sqlite3`, `@libsql/client`, `kysely`, `mongoose`), or an `app/**/server/` folder exists | `app/<feature>` or `src/app/<feature>` |
| `next-frontend` | `next` is a dependency, with none of those | `app/<feature>` or `src/app/<feature>` |
| `react` | `react` is a dependency, `next` is not | `src/features/<feature>` or `features/<feature>` |
| `node` | none of the above | `src/features/<feature>` or `features/<feature>` |

For `node`, the tool also picks up Express, Fastify, or Hono and shapes the controllers accordingly. With none of them present it generates framework-agnostic controller classes.

A Next app that reads and writes through Server Actions usually has no `app/api` folder, which is why a database client or a feature's `server/` folder is enough to make it `next-fullstack`.

Override detection with `--stack`:

```bash
domain-driver --stack nest make:feature cat -a
```

### Choosing where features live

The "Features live in" column is a convention, not a rule. Two overrides take precedence over it, in this order.

`--root` wins over everything, and suits one-off scaffolding:

```bash
domain-driver --root src/modules make:feature billing/Billing -a
```

For a project you work in daily, set it once in `package.json` instead of retyping the flag on every command:

```json
{
  "domainDriver": {
    "featureRoot": "src/modules"
  }
}
```

Either way the stack line tells you which one won, so you can see where files will land before they land:

```
Stack: nest (detected), root: src/modules (package.json)
```

The root must be a relative path inside the project. An absolute path or one containing `..` is rejected rather than quietly normalised.

---

## What each stack generates

| Layer | next-fullstack | next-frontend | react | node | nest | tanstack-start |
|---|---|---|---|---|---|---|
| entry file (`page.tsx`; `index.tsx` on tanstack-start) | yes | yes | | | | yes |
| components | client + server | client + server | flat | | | flat |
| containers | async Server Component (client with `--route`) | yes | yes | | | yes |
| hooks | only with `--route` | yes | yes | | | yes (Query hooks) |
| services + repositories (database stubs) | `server/` | | | yes | yes | `-server/` |
| controllers | Server Actions for the writes (`server/actions/*.action.ts`); `app/api/<feature>/` route handlers with `--route` | | | five files + routes file | five files | server functions (`-server/functions/*.fn.ts`) |
| module | | | | | yes | |
| DTOs (`nestjs-zod`) | | | | | yes | |
| schemas (Zod), types | yes | yes | yes | yes | yes | yes |

Every layer that has actions gets one file per action: `List`, `Show`, `Create`, `Update`, `Delete`. Saving a cat means `CreateCat.controller.ts`, `CreateCat.service.ts`, `CreateCat.repository.ts`, `CreateCat.schema.ts`, and, on stacks with a hook layer, `CreateCat.hook.ts` exporting `useCreateCat`. On `next-fullstack` it means `CreateCat.action.ts` in place of the controller and the hook; see [Next.js full-stack: Server Actions](#nextjs-full-stack-server-actions).

The record itself is described once, by the entity schema `schemas/Cat.schema.ts` (`CatSchema`: `id`, `createdAt`, `updatedAt`, and a comment where its fields go). `types/Cat.types.ts` infers the type from it, `export type Cat = z.infer<typeof CatSchema>`, and hooks parse every response with it, so there is no interface to keep in step with the API by hand.

---

## Commands

Every layer command takes one target, `<feature>/<Name>`: the feature folder on the left, the name used inside the files on the right. `users/User` reads as "User inside users".

A layer command creates the folders it writes into, the feature's own folder included, so a folder that only shares types needs no `make:feature` first:

```bash
domain-driver --root src/projects make:types shared/Project
```

```
✅ Feature folder "shared" created at /app/src/projects/shared
```

The folder is created at the first write, so a command that refuses before writing leaves nothing behind. On Nest, `make:controller`, `make:service`, `make:repository` and `make:action` are the exception: their classes only work once the feature's module provides them, and `make:feature` is what writes that module and registers it. When the feature does not exist they name the command to run first, with the same `--root` and `--stack`:

```
❌ Feature "list-projects" does not exist, and make:action registers its classes in the feature's module, which make:feature writes and registers. Run first: domain-driver --root src/projects make:feature list-projects
```

### `make:feature`

```bash
domain-driver make:feature users            # folders + .gitkeep, plus page.tsx (Next), index.tsx (TanStack Start), or the module (Nest)
domain-driver make:feature users/User -a    # every layer for the detected stack, entity User
```

On `next-fullstack`, `--route` scaffolds route handlers and fetch hooks instead of Server Actions; see [Next.js full-stack: Server Actions](#nextjs-full-stack-server-actions).

Feature names must be kebab-case. Without `/Entity`, the entity is the PascalCase feature name (`users` becomes `Users`). On Nest the module is named after the feature folder whatever the entity, like its file: `make:feature create-project/Project` writes `CreateProjectModule` in `create-project.module.ts`, so features that share an entity never share a module name.

The `.gitkeep` in a layer folder only keeps the empty folder in git. The first time any command writes a file into that folder, the `.gitkeep` is deleted, so it never ends up committed beside real code. Folders nothing has been written into keep theirs.

### `make:action`

```bash
domain-driver make:action users/User findActiveUsers
domain-driver make:action users/User inviteUser --with-input --returns one
domain-driver make:action users/User archiveUser --on-record --method patch --returns one
domain-driver make:action users/User renameUser --on-record --method put --with-input --returns one
domain-driver make:action projects/Project listProject --with-input --method get --returns list
```

Scaffolds a bespoke operation as its own files, so it never lands inside `ShowUser` or `ListUser`. The action name is used as-is for file and class names: `FindActiveUsers.service.ts`, `FindActiveUsersService`, handler `findActiveUsersController`, route `/find-active-users`. Include the noun in the name (`archiveUser`, not `archive`).

| Option | Effect |
|---|---|
| `--with-input` | writes `InviteUser.schema.ts` (and the Nest DTO), the service takes `data`, the controller validates the body; on a `get` the input is the query string instead, see [A read that takes query input](#a-read-that-takes-query-input) |
| `--returns list` | `Promise<User[]>` (default) |
| `--returns one` | `Promise<User>` |
| `--returns void` | `Promise<void>`, controller responds 204 |
| `--method <get\|post\|put\|patch\|delete>` | the HTTP method; defaults to `post` with `--with-input` and `get` without. A `get` with `--with-input` reads its input from the query string |
| `--on-record` | the action works on one record: route `/:id/<slug>`, and `id` passes through the controller, service, repository and hook, as it does for Show, Update and Delete |
| `--route` | `next-fullstack` only: a route handler and fetch hook instead of a Server Action, for callers outside the app such as webhooks or a mobile client |

Without `--method` and `--on-record` an action behaves as it always has. With them, an archive or a delete of one record is what it says: `make:action projects/Project archiveProject --on-record --method patch --returns one` gives Nest `@Patch(':id/archive-project')` with `@Param('id') id: string`, the service and repository `handle(id: string): Promise<Project>`, and on the client a mutation hook, `archiveProject(id)`, that sends `PATCH /api/projects/${id}/archive-project` when called.

The hook is a query, fetching on mount, only for a `get` that returns data. Any other method, or a `get` that returns void, is a mutation hook you call from an event handler.

An action answers 200, 204 when it returns void, and 201 when it is a `post` whose name starts with `create` and returns data, like the standard Create. On Nest that means no `@HttpCode` for a create (its `@Post` default is already 201) and `@HttpCode(200)` for any other `post`.

When the feature is the action itself, as in projects that keep one feature per flow (`create-project` holding `createProject`), the route is not repeated: the action answers at the feature's own route, `@Controller('create-project')` with `@Post()`, rather than `/create-project/create-project`. With `--on-record` it answers at `/:id` there. On Nest, a flow inside an area routes under the area instead; see [Routes in an area](#routes-in-an-area).

| Stack | Files written |
|---|---|
| `node` | service, repository, controller for the detected framework, plus the line to add to `<feature>.routes.ts` printed (above the `/:id` routes for a `/<slug>` route, which `/:id` would otherwise swallow) |
| `nest` | injectable service and repository, `@Controller` class, DTO with input, all registered in `<feature>.module.ts`, with the controller ahead of `Show<Entity>Controller` when the module has one |
| `next-fullstack` | server service and repository; a write (any method but `get`) also gets `server/actions/<Name>.action.ts`, and a read gets nothing more, since a Server Component calls its service. A read with `--with-input` also gets `containers/<Name>Container.tsx`, which parses the page's `searchParams`. With `--route`: a hook that fetches the endpoint and `app/api/<feature>/<slug>/route.ts` (`app/api/<feature>/[id]/<slug>/route.ts` with `--on-record`) instead |
| `next-frontend`, `react` | only a hook that fetches `/api/<feature>/<slug>` (and the schema with `--with-input`); the service and repository live behind that API, outside the project |
| `tanstack-start` | server service and repository, a hook that calls the server function directly, and a server function (`<Name>.fn.ts`) in place of a route handler |

`domain-driver make:action --help` prints the same per-stack list.

#### A read that takes query input

A `get` has no body, so `--method get --with-input` takes its input from the query string, as a paginated list does with `limit` and a cursor:

```bash
domain-driver --root src/projects make:action list-projects/Project listProject --with-input --method get --returns list
```

The input is called `query` in every layer, and the service and repository take it parsed: `handle(query: ListProject): Promise<Project[]>`.

| Stack | How the query arrives |
|---|---|
| `nest` | `@Get()` with `@Query() query: ListProjectDto`, the same `createZodDto` DTO a body uses, so `ZodValidationPipe` validates it |
| `node` | Express validates `req.query`, Fastify `request.query`, Hono `c.req.query()`; the framework-agnostic controller takes `query: unknown` and parses it |
| `react`, `next-frontend`, `next-fullstack --route` | the hook sends the input as search params, `/api/<feature>/<slug>?limit=10`, with no body: each defined value as a string, an array as repeated keys, undefined values left out. The query hook takes the input as an argument and refetches when one of its values changes; the route handler validates `new URL(request.url).searchParams` |
| `next-fullstack` | `containers/ListProjectContainer.tsx`, an async Server Component that takes the page's `searchParams` prop (a Promise in Next 16), parses it with `ListProjectSchema`, and passes the result to the service. An invalid query string renders a message rather than throwing. Render it from the page: `<ListProjectContainer searchParams={searchParams} />` |
| `tanstack-start` | a GET server function with the schema as its validator; the query hook passes the input as `data` and keys the cache on it |

Query values arrive as strings, so the generated schema says so and how to read the rest. It adds no fields:

```ts
export const ListProjectSchema = z.object({
  // add listProject fields here
  // They are read from the query string, so every value arrives as a string:
  // use z.coerce.number() for a number, and z.stringbool() for a boolean
  // (z.coerce.boolean() turns any non-empty string, "false" included, into true).
});
```

A key sent more than once reaches the schema as an array on every server stack, and a key sent once as a string, so a list field that may carry one value accepts both, for example `z.union([z.string(), z.array(z.string())])`.

On `tanstack-start` the server function carries the input with its types, so the schema there has no such note. Without `--method`, `--with-input` is still a `post` with a body.

### `make:controller`

```bash
domain-driver make:controller users/User
```

Node: five controllers plus `<feature>.routes.ts` for Express, Fastify, or Hono. Nest: five single-action controllers. Next.js fullstack: the three write actions, `server/actions/CreateUser.action.ts`, `UpdateUser.action.ts` and `DeleteUser.action.ts`; with `--route`, `app/api/<feature>/route.ts` and `app/api/<feature>/[id]/route.ts` instead. TanStack Start: five server functions (`<Name>.fn.ts`, built with `createServerFn`) under `-server/functions/`. Not available on frontend-only stacks (`next-frontend`, `react`).

### `make:service` and `make:repository`

```bash
domain-driver make:service users/User
domain-driver make:repository users/User
```

Both generate the server side only, because that is the only side there is. They are unavailable on `next-frontend` and `react`, whose API lives outside the project.

### `make:schema`

```bash
domain-driver make:schema users/User
```

Writes the entity schema `User.schema.ts` (when it does not exist yet), `CreateUser.schema.ts` and `UpdateUser.schema.ts`. On Nest it also writes the Create and Update DTO classes, derived with `createZodDto` from `nestjs-zod`. The entity schema gets no DTO: it describes what the API returns, not a request body.

### `make:types`, `make:component`, `make:container`, `make:hook`

```bash
domain-driver make:types users/User
domain-driver make:component users/UserCard [client|server]
domain-driver make:container users/UserContainer
domain-driver make:hook users/User
```

`make:types` writes `User.types.ts` as `export type User = z.infer<typeof UserSchema>`, and writes the entity schema `schemas/User.schema.ts` first when it does not exist. When a command generates code that imports either file and one is missing, it prints the `make:types` line to run.

Component, container, and hook commands fail with a clear message on backend stacks, and `server` components are rejected on React.

`make:container users/UserContainer` lists `User` records through `useListUser` and renders each through the `User` component. It only imports what exists: when `hooks/ListUser.hook.ts` is missing, as it is for a name that is not an entity such as `UserDetailContainer`, the container calls no hook and the command prints the hooks the feature does have, to call from it. When the component is missing, each record renders its `id` and the command prints the `make:component` line.

On `next-fullstack` the container is an async Server Component that reads through `server/services/ListUser.service.ts` instead, unless the feature has the List hook because it is served by route handlers. The same rules apply: no List service means a container that calls no service, and a hint naming the services there are.

On `next-fullstack`, `make:hook` is for a feature served by route handlers: when `app/api/<feature>/route.ts` does not exist it prints the `make:controller <feature>/<Entity> --route` line, because the hooks would fetch an endpoint that is not there.

`make:hook` writes one file per action instead of a combined hook: `ListUser.hook.ts`, `ShowUser.hook.ts`, `CreateUser.hook.ts`, `UpdateUser.hook.ts`, `DeleteUser.hook.ts`, each exporting one hook (`useListUser`, `useShowUser`, `useCreateUser`, `useUpdateUser`, `useDeleteUser`). There is no combined `useUser.ts`. Every hook that reads a record back parses it with the entity schema, `UserSchema.parse(...)` for one and `z.array(UserSchema).parse(...)` for a list, instead of casting the response. On `react`, `next-frontend`, and `next-fullstack` these hold plain React state. A query hook keeps one result tagged with the request that produced it and derives `loading` and `error` from that tag, so its effect sets state only in the request's callbacks and passes eslint-plugin-react-hooks 7 (`react-hooks/set-state-in-effect`); a changed id or `refetch()` aborts the previous request and reads as loading at once. On `tanstack-start` they are TanStack Query hooks backed by a generated `<feature>.keys.ts` cache-key module. Generating hooks on this profile prints a one-time reminder to install `@tanstack/react-query`, since TanStack Start does not bundle it.

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

### Generated imports

Generated type references use `import type`, including under Vite's `verbatimModuleSyntax`. In Node ESM projects using NodeNext/Node16 resolution, local imports use runtime `.js` extensions; CommonJS and bundler projects retain their existing import style. Nest DTOs and injected classes remain runtime imports.

### Formatting with your Prettier

The templates are written in one style: single quotes, semicolons, two-space indents. When your project has Prettier and a Prettier config, every file a command writes or changes is then formatted with that Prettier and that config, so it lands in your style and a diff shows only what is new. That includes the Nest modules it registers classes into.

- Prettier is borrowed from your project, never bundled: the version in your `node_modules`, with the config `prettier --check` would use (`.prettierrc`, `prettier.config.*` or the `prettier` key in `package.json`, its `overrides`, and `.editorconfig`). Plugins named in the config, such as `prettier-plugin-tailwindcss`, load as they do for Prettier itself, which resolves them from the working directory, so run commands from the project root.
- A file matched by `.prettierignore` in the project root stays as generated.
- Only the files this command wrote or changed are formatted. A file it skipped because it already exists, and the rest of your project, are left alone.
- Without Prettier in the project, or without a Prettier config, files are written exactly as before.
- A file that cannot be formatted, for example because a plugin in the config is not installed, keeps its generated content. The command still succeeds and prints one line per such file:

```
⚠️  Did not format src/features/projects/hooks/ArchiveProject.hook.ts (Cannot find package 'prettier-plugin-tailwindcss' imported from /app/noop.js); kept it as generated
```

Pass `--no-format` to any `make:*` command to keep the template style:

```bash
domain-driver make:feature projects/Project -a --no-format
```

---

## Next.js full-stack: Server Actions

On `next-fullstack` the app's own pages read in Server Components and write through Server Actions. There is no API between a page and its service, so no route handler and no fetch hook are generated.

```
app/projects/
├── page.tsx                     renders the container
├── containers/
│   └── ProjectContainer.tsx     async Server Component: List service -> client component
├── components/client/
│   └── Project.tsx
├── server/
│   ├── actions/                 CreateProject, UpdateProject, DeleteProject (.action.ts)
│   ├── services/                (five files)
│   └── repositories/            (five files, database-agnostic stubs)
├── schemas/
└── types/
```

**Reads** (List, Show, a custom GET) get the service and the repository. The container is an async Server Component: it awaits `connection()` so the page renders per request, calls `service.handle()`, and passes the records to the client component. Without `connection()`, `next build` would prerender the page and run the repository at build time. A custom GET with `--with-input` also gets its own container, which parses the page's `searchParams` and hands them to the service; see [A read that takes query input](#a-read-that-takes-query-input).

**Writes** (Create, Update, Delete, any custom action whose method is not `get`) get `server/actions/<Action><Entity>.action.ts`, one action per file. Each starts with `'use server'` and exports one `<action><Entity>Action(previous, formData)` for `useActionState`, returning a typed state, `idle`, `invalid` with field errors, or `saved`. It validates the form with the feature's schema (`safeParse`), returns a failed validation as state, calls the service's `handle()`, then `revalidatePath` on the feature's page. On one record (`Update`, `Delete`, `--on-record`) the id comes from the form's `id` field and is validated with the entity schema's own `id`.

**Every action fails closed** until it checks the caller, the way a repository throws until it reaches a database. The CLI cannot know your session helper, so each action starts with `await requireCaller();`, which throws, and the command prints the files to change:

```
ℹ️  Server Actions fail closed until they check the caller. In app/projects/server/actions/ArchiveProject.action.ts, replace "await requireCaller();" with your session check (for example: const { user } = await requireSession();) and delete requireCaller().
```

**`--route`** keeps the route handler and fetch hook, for callers outside the app such as webhooks or a mobile client. It works on `make:feature`, `make:action` and `make:controller`, and changes nothing on other stacks.

```bash
domain-driver make:feature projects/Project -a
domain-driver make:action projects/Project archiveProject --on-record --method post --returns one
domain-driver make:action projects/Project projectWebhook --with-input --route
```

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
│   ├── CoffeeType.schema.ts          the entity schema the type is inferred from
│   ├── CreateCoffeeType.schema.ts
│   └── UpdateCoffeeType.schema.ts
└── types/
    └── CoffeeType.types.ts           export type CoffeeType = z.infer<typeof CoffeeTypeSchema>
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
├── -hooks/                      coffee-type.keys.ts, plus five hook files that call the server functions
├── -server/
│   ├── functions/               (five *.fn.ts files, built with createServerFn)
│   ├── services/                (five files)
│   └── repositories/            (five files, database-agnostic stubs)
├── -schemas/
│   ├── CoffeeType.schema.ts
│   ├── CreateCoffeeType.schema.ts
│   └── UpdateCoffeeType.schema.ts
└── -types/
    └── CoffeeType.types.ts
```

Every layer directory carries a `-` prefix so TanStack Router excludes it from routing. The controller layer is server functions — `<Name>.fn.ts` built with `createServerFn` — and the hooks import and call them directly, so there is no `fetch` and no `Response.json`. Hooks are TanStack Query, backed by the generated `coffee-type.keys.ts`. Generating hooks on this profile prints a one-time reminder to install `@tanstack/react-query`, since TanStack Start does not bundle it.

---

## Nest module registration

On NestJS, generated classes are wired into the module files that have to know about them. `make:feature` adds the feature module to your root module, and `make:controller`, `make:service`, `make:repository` and `make:action` add their classes to `<feature>.module.ts`.

```
✅ Registered AssetsModule in src/app.module.ts
```

When the feature root is itself a module's folder, that module comes first: `--root src/billing make:feature invoices` registers `InvoicesModule` in `src/billing/billing.module.ts` when that file exists. Projects that group features into areas scaffold each one straight into its area this way.

### Routes in an area

A feature whose root has that area module routes under the area: every controller is `@Controller('<area>')`, so every route starts `/<area>`. How the rest reads depends on the area.

When the area is the entity's own resource, its folder named after the entity singular or plural (`projects` for `Project`), routes are RESTful on the area and the flow's slug is dropped. The verb is the action's name minus the entity:

| Action | Route |
|---|---|
| List, `listProjects` | `@Get()` |
| Show, `showProject --on-record` | `@Get(':id')` |
| Create, `createProject` | `@Post()` (201) |
| Update | `@Patch(':id')`; a bespoke update keeps its `--method` |
| Delete, `deleteProject --on-record --method delete` | `@Delete(':id')` |
| `archiveProject --on-record --method post` | `@Post(':id/archive')` |
| `findActiveProjects` | `@Get('find-active')` |

So the profile area's `updateProfile --with-input --method patch` answers `PATCH /profile`, not `/profile/update-profile`.

Any other area puts the flow's slug in the method decorator: `--root src/auth make:feature login`, then `make:action login/Session login --with-input --method post`, gives `@Controller('auth')` with `@Post('login')`. A flow on one record answers at `:id/<flow-slug>`, and a feature that is not a flow keeps its own routes below its slug (`sessions`, `sessions/:id`).

The command prints the route each controller answers:

```
ℹ️  ArchiveProjectController answers POST /projects/:id/archive
```

Nest matches routes in the order modules are registered, so a literal GET such as `GET /projects/find-active` also prints which module has to come first when another flow answers `GET /projects/:id`. Without an area module nothing changes: a flow feature routes at its own root, as in 0.10.

The edit is made through the TypeScript compiler API, borrowed from your own project rather than bundled, and applied as a text insertion at AST-computed positions. Your comments and import order survive untouched — only the two inserted lines are new. When the project has Prettier and a Prettier config, the edited module is then formatted with it like every file the command wrote; see [Formatting with your Prettier](#formatting-with-your-prettier). With `--no-format`, or without Prettier, the rest of the file keeps its formatting too. Registering the same class twice does nothing.

A bespoke action's controller is inserted **before** `Show<Entity>Controller` rather than appended, because Nest matches routes in declaration order and a custom `GET /actives` would otherwise be swallowed by `GET /:id`. A module without a Show controller, such as a feature that is one action, simply gets it appended, and the printed by-hand lines only name `Show<Entity>Controller` when the module has it.

### When it does not edit

If the root module cannot be found, TypeScript cannot be resolved, the file has no `@Module` decorator, or the edited result would not parse, nothing is written and the lines are printed for you to paste:

```
ℹ️  Did not edit src/app.module.ts (no @Module decorator with an object argument was found). Add by hand:
     import { AssetsModule } from './features/assets/assets.module';
     imports: [ ..., AssetsModule ]
```

The command still succeeds, because the files it generated were still generated.

### Turning it off, and pointing it somewhere else

```bash
domain-driver --no-auto-register make:feature assets/Asset -a
```

```json
{
  "domainDriver": {
    "autoRegister": false,
    "rootModule": "src/core/root.module.ts"
  }
}
```

`autoRegister: false` restores the old behaviour, where nothing but newly generated files is ever written. `rootModule` names the root module for projects where `src/app.module.ts` and `app.module.ts` are both wrong.

---

## Philosophy

Everything for a feature lives in one folder, and every file does one thing.

- **repositories** — data access only. Client-side repositories call your API (on TanStack Start, the server function directly); server-side repositories call your database.
- **services** — business logic, one class per action.
- **controllers** — HTTP in, service call, HTTP out, one file per action (server functions on TanStack Start; Server Actions for the writes on Next.js full-stack).
- **hooks** — state and side effects, one hook per action, calls services (TanStack Query on TanStack Start, plain React state elsewhere).
- **containers** — wire hooks into UI, or on Next.js full-stack read through a service in a Server Component.
- **components** — presentational UI.
- **schemas** — Zod: the entity schema that responses are parsed with, and validation for create and update; the update body never carries the id, it comes from the path.
- **types** — the entity type, inferred from the entity schema with `z.infer`.

Server-side repositories throw a clear not-implemented error until you wire your ORM. Compiling code that fails loudly beats a fake store that looks like it works.

---

## Updating

Every command checks the registry at most once a day and, when a newer release exists, prints one line after its output:

```
ℹ️  domain-driver 0.3.0 is available (you have 0.2.0). Run: domain-driver update
```

```bash
domain-driver update            # detects how it was installed and runs your package manager
domain-driver update --dry-run  # show the command it would run
domain-driver update --check    # only report whether a newer version exists
```

Local installs use the package manager the project uses (npm, pnpm, yarn, or bun, from the `packageManager` field or the lockfile). Global installs use `npm install -g`. Running through `npx` needs no update: `npx domain-driver@latest` always fetches the newest.

In a workspace, `update` selects the invoking package when its local executable resolves to the running binary. A frontend sharing pnpm's virtual store with the root is updated in `frontend`, using the workspace package manager. After installation, the updater reads the installed version before reporting success. If constraints or release-age policies retain an older version, it reports the actual version and fails.

The check is skipped in CI (any `CI` value other than empty, `0`, or `false`), when output is not a terminal, when `DOMAIN_DRIVER_NO_UPDATE_CHECK` is set (same value rule), or when `NO_UPDATE_NOTIFIER` is set to anything.

The cache lives in `~/.cache/domain-driver` (or `$XDG_CACHE_HOME/domain-driver`); `DOMAIN_DRIVER_CACHE_DIR` overrides it.

---

## Upgrading from 0.11.x

0.12.0 adds to what the CLI accepts and changes no file it generated before. Generated files that already exist are never overwritten.

- **A `get` can take input.** `make:action --method get --with-input` used to fail with "A GET action cannot take a request body"; it now reads the input from the query string on every stack. See [A read that takes query input](#a-read-that-takes-query-input). Without `--method`, `--with-input` is still a `post`, so existing commands generate what they did. A controller you rewrote by hand from `@Post()` + `@HttpCode(200)` + `@Body()` to `@Get()` + `@Query()` matches what is now generated.
- **Layer commands create the feature's folder.** `make:types`, `make:schema`, `make:component`, `make:container`, `make:hook`, and on stacks without modules `make:service`, `make:repository`, `make:controller` and `make:action`, no longer fail with "Feature "shared" does not exist" when the folder is missing; they create it. On Nest the four commands that register classes still need the feature, and the command they print now keeps `--root` and `--stack`, which the old `make:feature` line dropped.

## Upgrading from 0.10.x

0.11.0 changes what new scaffolding looks like on `next-fullstack`, in Nest areas, and in projects that use Prettier. Generated files that already exist are never overwritten.

- **next-fullstack writes through Server Actions.** `make:feature -a`, `make:action` and `make:controller` no longer write `app/api/**/route.ts` or fetch hooks. A write gets `server/actions/<Action><Entity>.action.ts`, which throws until you replace its `await requireCaller();` line with your session check; a read gets only its service and repository, and the container is an async Server Component that calls the List service. Pass `--route` for the old output. Features scaffolded earlier keep their route handlers and hooks, and `make:container` keeps writing a client container in a feature that has the List hook.
- **next-fullstack is detected without `app/api`.** A `next` app with a database client dependency, or with an `app/**/server/` folder, is now `next-fullstack` rather than `next-frontend`. Pass `--stack next-frontend` to keep the old detection.
- **Nest flows route under their area.** In a feature root with an area module (`src/projects/projects.module.ts`), controllers are `@Controller('<area>')`: `createProject` answers `POST /projects` rather than `POST /create-project`, and `login` answers `POST /auth/login`. See [Routes in an area](#routes-in-an-area). A Nest Update on the area's own resource is `@Patch(':id')`. Projects without an area module are unaffected.
- **Generated files are formatted with your Prettier.** In a project with Prettier and a Prettier config, the files a command writes or changes, including the Nest modules it registers into, are formatted with that config afterwards, so they no longer show up rewritten line by line in your formatter's diff. Files in `.prettierignore` are skipped, and a file that fails to format is kept as generated with a warning. Pass `--no-format` for the old output. Projects without Prettier, or without a config, are unaffected. See [Formatting with your Prettier](#formatting-with-your-prettier).

## Upgrading from 0.9.x

0.10.0 changes what new scaffolding looks like. Generated files that already exist are never overwritten, so code you have already scaffolded stays as it is.

- **Types are inferred.** `make:types` and `make:schema` write an entity schema, `schemas/<Entity>.schema.ts`, and `types/<Entity>.types.ts` is now `export type <Entity> = z.infer<typeof <Entity>Schema>` instead of an interface. Generated hooks import the entity schema and parse responses with it. A feature scaffolded before 0.10 has the interface and no entity schema, so a hook added to it now would import a file that is not there; the command says so and prints `make:types <feature>/<Entity>`, which adds the schema and leaves your types file alone. Move the interface's fields into the schema and replace the interface with the `z.infer` line when you are ready.
- **`make:action --method` and `--on-record`.** Without them an action is generated as before, with one exception: a `post` whose name starts with `create` and returns data now answers 201 instead of 200, matching the standard Create.
- **A feature that is its action** no longer repeats its name in the route: `make:action create-project/Project createProject` in a `create-project` feature routes at `/create-project`, not `/create-project/create-project`. Check clients written against the doubled path.
- **`.gitkeep` files** are removed from a layer folder once a command writes into it. Ones committed by earlier versions stay until you delete them.
- **`make:container`** no longer imports a hook or component that does not exist; see `make:container` above.
- **Nest feature modules are named after their folder.** `make:feature create-project/Project` now writes `CreateProjectModule`, not `ProjectModule`, matching `make:feature create-project` and the file name. Modules that already exist keep their names.
- **Hooks encode the id** in the URLs they fetch, `${encodeURIComponent(id)}`, so an id containing `/`, `?` or `#` cannot reach a different route.
- **Path aliases are found in the default Next tsconfig.** Alias detection used to give up on a tsconfig that has both `"@/*"` and `"**/*.ts"` (or a `$schema` URL) and fall back to relative imports; generated imports now use the alias there.
- **Bespoke action errors** read from the action name, `Failed to archive project`, instead of `Failed to archiveProject Project`. The standard five keep theirs.

## Upgrading from 0.8.x

domain-driver is now only a scaffolding CLI. The `init` command, the install-time postinstall that ran it, and the bundled agent library are gone, and `update` no longer refreshes guidance after installing. Running `domain-driver init` now fails as an unknown command.

Nothing is removed from your project. Files that earlier versions wrote stay where they are and keep working, but domain-driver no longer updates them:

- the section between `<!-- domain-driver:start -->` and `<!-- domain-driver:end -->` in `AGENTS.md` and `CLAUDE.md`
- skills in `.agents/skills/` (`catalog.md`, `factory`, and group-prefixed folders such as `javascript-domain-driver` and `nest-actions`) and their links in `.claude/skills/`
- the factory agents in `.claude/agents/` and `.codex/agents/`: `approver`, `builder`, `documenter`, `reviewer-code`, `reviewer-security`, `reviewer-ui`, `reviewer-ux`, and `spec-writer`

Delete the ones you don't want. The marked section points at `.agents/skills/javascript-domain-driver/SKILL.md`, so remove the two together. The skills and the factory are maintained in [IsaacHatilima/skills](https://github.com/IsaacHatilima/skills); copy newer versions from there.

---

## Upgrading from 0.4.x

On NestJS, scaffolding now **edits two files it did not create**: your root module and each feature's module. Every earlier version only ever created files. The edit is surgical and verified — see [Nest module registration](#nest-module-registration) for what it does and when it refuses — but if you want the old write-only guarantee back:

```json
{ "domainDriver": { "autoRegister": false } }
```

Nothing changes for any other stack.

---

## Upgrading from 0.4.0

Two changes affect existing projects.

On NestJS, a project that already has a `src/features` directory now scaffolds into it instead of directly into `src`. If you keep features in `src` you are unaffected, since the behaviour is opt-in by that directory existing. To pin either choice explicitly, set `domainDriver.featureRoot` in `package.json`.

The entity half of a `<feature>/<Entity>` target must now be PascalCase. `make:schema users/user` previously produced `Listuser.service.ts` exporting `ListuserService`; it now fails with a message telling you to pass `User`.

---

## Upgrading from 0.3.x

Hooks are now one file per action — `<Action><Entity>.hook.ts` exporting `use<Action><Entity>` (`useListCat`, `useCreateCat`, ...) — instead of a single combined `use<Entity>.ts`, which is no longer generated. `make:hook` now takes `<feature>/<Entity>`, not `<feature>/use<Entity>`. `make:action` writes a matching hook alongside the service and repository on any stack that has a hook layer.

domain-driver never overwrites a generated file that already exists, so this only changes new scaffolding: a `use<Entity>.ts` written by an older version is left alone and keeps working. New features and new actions get the per-action hooks; wire them together in the container, since they no longer share state:

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
- [x] TanStack Start stack, with server functions and per-action query hooks
- [x] Per-action hooks on every stack that has them, replacing the single combined hook
- [x] Server Actions and Server Component reads on Next.js full-stack
- [x] Nest routes under the area prefix
- [x] Generated files formatted with the project's own Prettier
- [x] GET actions that take their input from the query string
- [ ] Config file — override stack and feature root per project
- [ ] Configurable API base URL for the fetch in generated hooks
- [ ] ORM-aware server repositories

---

## License

MIT
