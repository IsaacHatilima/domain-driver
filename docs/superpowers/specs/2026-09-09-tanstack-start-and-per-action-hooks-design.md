# TanStack Start profile and per-action hooks — design

**Date:** 2026-09-09
**Status:** awaiting spec review

## Goal

Add a `tanstack-start` stack profile whose controller layer is server functions, and split the hook layer into one file per action on every profile that has hooks.

## Scope

In scope:

- A `tanstack-start` profile detected from `@tanstack/react-start`
- Server functions as that profile's controller layer
- Client repositories that call server functions instead of `fetch`
- Per-action hooks on `react`, `next-frontend`, `next-fullstack` and `tanstack-start`
- TanStack Query hooks on `tanstack-start` only
- A generated route file for the page layer on `tanstack-start`

Out of scope, with the reason:

- Vue and Nuxt. Deferred until there is a real project to scaffold; nothing here makes them harder later.
- Moving `react` and Next onto TanStack Query. The Query renderer built here is profile-selected, so adding detection later is one branch, not a rewrite.
- TanStack Router without Start. Those projects detect as `react` today and continue to.
- Server routes (`createFileRoute` with `server.handlers`). Server functions cover every scaffolded action. Revisit if a public HTTP surface is ever needed.

## Verified facts

Checked 2026-09-09 against the published packages, not from memory.

| Fact | Value | How confirmed |
|---|---|---|
| `@tanstack/react-start` | 1.168.50, `engines.node >= 22.12.0` | `npm view` |
| Start depends on Query | No. Not a dependency and not a peer dependency. | package.json of the tarball |
| Server function API | `createServerFn`, `useServerFn` from `@tanstack/react-start` | `dist/esm/index.d.ts` exports |
| Definition shape | `createServerFn({ method: 'POST' }).validator(Schema).handler(async ({ data }) => …)`, GET by default | official docs |
| Route files | `src/routes`, `createFileRoute('/path')({ … })` from `@tanstack/react-router`, `$id` params, `.` nests | official docs |
| Colocation | a `-` prefix excludes a file or directory from routing | official docs |
| `@tanstack/react-query` | 5.102.8 | `npm view` |
| `zod` | 4.6.0, accepted bare by `.validator()` | Task 8 fixture type-check, 2026-09-09 |

Server functions accept **GET and POST only**. The `ActionSpec` methods `put` and `delete` therefore collapse to POST on this profile.

---

## 1. Per-action hooks

### What exists today

`renderHook` emits a single `use<Entity>.ts` of roughly 100 lines holding all five operations over shared `items` state. It is the only layer that never moved to one file per action. It exists on `react`, `next-frontend` and `next-fullstack`; `node` and `nest` have no hook layer and should not gain one, since neither has a client runtime.

### What replaces it

One file per action, named like every other layer:

```
-hooks/ListCat.hook.ts     exports useListCat
-hooks/ShowCat.hook.ts     exports useShowCat
-hooks/CreateCat.hook.ts   exports useCreateCat
-hooks/UpdateCat.hook.ts   exports useUpdateCat
-hooks/DeleteCat.hook.ts   exports useDeleteCat
```

The file is `<spec.name>.hook.ts` and the exported symbol is `use<spec.name>`. React requires the `use` prefix on the function, not the filename, so the filename stays consistent with `ListCat.service.ts` and `ListCat.repository.ts`.

### Query-shaped or mutation-shaped

The rule is `spec.method === 'get' && spec.usesEntityType`.

**Correction (final review, 2026-09-10):** this section originally gave the rule as `spec.method === 'get'` alone. That is wrong: a custom action declared `--returns void` (e.g. `make:action cat/Cat purgeCats --returns void`) is also a GET — `customAction` forces GET whenever there is no input, independent of return kind — but it has no payload worth polling for and must not auto-fire on mount the way a real query does. `spec.usesEntityType` is false exactly when the action returns void, so requiring it too routes that one case to the mutation branch, where it renders as a callable async action instead. Without this, both hook renderers (`hook.ts` and `query-hook.ts`) generated a query-shaped hook — `useState<void | null>` plus a `useEffect` that fired the action on every mount — for what should have been a plain callable mutation.

It classifies every standard action correctly and all custom-action forms:

| Action | method | usesEntityType | Shape |
|---|---|---|---|
| List | get | true | query, no argument |
| Show | get, `usesId` | true | query, takes `id` |
| Create | post | true | mutation |
| Update | put | true | mutation |
| Delete | delete | false | mutation |
| custom without input | get | true | query, no argument |
| custom without input, `--returns void` | get | false | mutation, no argument |
| custom with input | post | true or false | mutation |

### Plain renderer (react, next-frontend, next-fullstack)

Query-shaped, no id — `ListCat.hook.ts`:

```tsx
export function useListCat() {
  const [data, setData] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await service.handle());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Cat list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
```

The client service is instantiated once at module scope, as the current hook template already does. Initial `data` is `[]` when `spec.returns` is a list and `null` when it is one. A query-shaped hook with `usesId` takes `id: string`, depends on it in `useCallback`, and returns the same four fields.

Mutation-shaped — `UpdateCat.hook.ts`:

```tsx
export function useUpdateCat(options: { onSuccess?: (result: Cat) => void } = {}) {
  const { onSuccess } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateCat = useCallback(async (id: string, data: UpdateCat) => {
    setLoading(true);
    setError(null);
    try {
      const result = await service.handle(id, data);
      onSuccess?.(result);
      return result;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update Cat');
      return null;
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return { updateCat, loading, error };
}
```

The callable is `lowerFirst(spec.name)`. Its parameters are `spec.params` and it forwards `spec.args`. When `spec.usesEntityType` is false the action returns void, so `onSuccess` is `() => void` and the callback takes no argument.

**Implementation trap:** destructure `onSuccess` out of `options` and depend on `[onSuccess]`. Depending on `[options]` re-creates the callback on every render, because the default `{}` is a fresh object each time.

### Coordination

Splitting the hook removes the shared `items` array, so a create no longer updates a list rendered by a different hook. That coordination moves to the container, which is where it belongs:

```tsx
const { data, loading, error, refetch } = useListCat();
const { createCat } = useCreateCat({ onSuccess: refetch });
```

The generated container is where this stops being optional. `renderContainer` today imports `use<Entity>` and destructures `{ items, loading, error }`, and neither that hook nor that field survives the split, so the container renderer changes on all four profiles. It imports the list hook only:

- plain profiles: `const { data, loading, error } = useListCat();`
- `tanstack-start`: `const { data, isPending, error } = useListCat();`, rendering `(data ?? [])` because Query leaves `data` undefined until the first fetch resolves

Mutation wiring is deliberately not generated. A container that called create, update and delete would be dead code in most features. The `onSuccess` option exists so the developer wires it in one line, and the README documents that pattern.

### Query renderer (tanstack-start only)

A keys module is generated alongside the hooks, so the cache key is not a string literal repeated across five files. For feature `coffee-type` the file is `-hooks/coffee-type.keys.ts`:

```ts
export const coffeeTypeKeys = {
  all: ['coffee-type'] as const,
  detail: (id: string) => ['coffee-type', id] as const,
};
```

The constant is `lowerFirst(toPascalCase(feature)) + 'Keys'`. Query hooks return the `useQuery` and `useMutation` results directly rather than repackaging them, so callers keep the full API:

```tsx
export function useListCat() {
  return useQuery({ queryKey: catKeys.all, queryFn: () => service.handle() });
}

export function useCreateCat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCat) => service.handle(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catKeys.all }),
  });
}
```

Show uses `catKeys.detail(id)`. Update and Delete invalidate both `catKeys.all` and `catKeys.detail(id)`.

**Custom-action cache key — correction (final review, 2026-09-10):** this section originally did not say what key a custom GET action gets, and the implementation defaulted to `spec.usesId ? catKeys.detail(id) : catKeys.all`. That is wrong: List is also `usesId: false`, so every custom GET action (e.g. `FindActiveCats`) collapsed onto the exact same key as `useListCat` — `catKeys.all`. TanStack Query treats an identical key as the same cache entry, so whichever hook's observer mounted last silently won the `queryFn` for both, with no error. The key is a three-way rule, not two-way:

- `spec.usesId` → `catKeys.detail(id)`
- else `spec.path === '/'` (this is List) → `catKeys.all`
- else (a custom action) → `[...catKeys.all, spec.name]`, e.g. `[...catKeys.all, 'FindActiveCats']`

The spread is deliberate, not a stray stylistic choice: TanStack Query invalidates by key *prefix*, so a Create mutation's existing `invalidateQueries({ queryKey: catKeys.all })` still invalidates a custom list for free. Flattening this to a bare `['cat', 'FindActiveCats']` would opt the custom query out of that prefix invalidation.

Because Start does not ship Query, generating these prints an install hint following the existing `hintNestjsZod` precedent:

```
ℹ️  Hooks use TanStack Query. Install it: npm install @tanstack/react-query
ℹ️  Wrap your app in a QueryClientProvider if you have not already.
```

---

## 2. The tanstack-start profile

**Detection.** `@tanstack/react-start` in dependencies or devDependencies selects `tanstack-start`. In `inferStack` the check goes after `@nestjs/core` and before `next` and `react`, since every Start project also has React.

**Feature root.** `src/routes` when that directory exists, `routes` when only that exists, otherwise `src/routes`. Unlike the Next profiles this prefers the `src` form, because `src/routes` is the TanStack convention.

**Profile:**

```ts
export const tanstackStart: StackProfile = Object.freeze({
    name: 'tanstack-start',
    folders: [
        '-components',
        '-containers',
        '-hooks',
        '-client/services',
        '-client/repositories',
        '-server/functions',
        '-server/services',
        '-server/repositories',
        '-schemas',
        '-types',
    ] as const,
    layers: [
        'page', 'component', 'container', 'hook',
        'clientService', 'clientRepository',
        'serverService', 'serverRepository',
        'controller', 'schema', 'types',
    ] as const,
    layerDirs: {
        component: '-components',
        container: '-containers',
        hook: '-hooks',
        clientService: '-client/services',
        clientRepository: '-client/repositories',
        serverService: '-server/services',
        serverRepository: '-server/repositories',
        controller: '-server/functions',
        schema: '-schemas',
        types: '-types',
    },
    clientDirective: false,
    serverComponents: false,
});
```

Every layer directory carries the `-` prefix so TanStack Router does not treat these files as routes. Components are a single directory rather than the Next client/server split, because this profile has no React Server Components.

A `cat` feature therefore produces `src/routes/cat/index.tsx` plus those ten directories.

---

## 3. Server functions as the controller layer

One file per action in `-server/functions/`, named `<spec.name>.fn.ts`, exporting `lowerFirst(spec.name)`.

Method: `spec.method === 'get'` emits `createServerFn({ method: 'GET' })`, everything else emits `{ method: 'POST' }`.

Validator and handler, driven by `spec.schema` and `spec.usesId`:

| Case | Actions | Validator | Handler body |
|---|---|---|---|
| no schema, no id | List, custom get | omitted | `service.handle()` |
| no schema, id | Show, Delete | `z.string()` | `service.handle(data)` |
| schema, no id | Create, custom post | `<Name>Schema` | `service.handle(data)` |
| schema, id | Update | `z.object({ id: z.string(), data: <Name>Schema })` | `service.handle(data.id, data.data)` |

`Create` in full:

```ts
import { createServerFn } from '@tanstack/react-start';
import { CreateCatSchema } from '../../-schemas/CreateCat.schema';
import { CreateCatService } from '../services/CreateCat.service';

const createCatService = new CreateCatService();

export const createCat = createServerFn({ method: 'POST' })
  .validator(CreateCatSchema)
  .handler(async ({ data }) => createCatService.handle(data));
```

The generated schema module already exports `<Name>Schema` and the inferred type `<Name>`, so no new schema output is needed. `z` is imported only in the two cases that need it.

---

## 4. Client repository calls the server function

On this profile `renderClientRepository` is replaced by a renderer that imports the server function and calls it. `fetch`, headers, `response.ok` and `response.json()` all disappear.

```ts
import { UpdateCat } from '../../-schemas/UpdateCat.schema';
import { Cat } from '../../-types/Cat.types';
import { updateCat } from '../../-server/functions/UpdateCat.fn';

export class UpdateCatRepository {
  async handle(id: string, data: UpdateCat): Promise<Cat> {
    return updateCat({ data: { id, data } });
  }
}
```

Call convention by case: no argument for the no-schema-no-id case, `({ data: id })` when only an id, `({ data })` when only a schema, and `({ data: { id, data } })` for Update. Importing a server function into client code is how Start is meant to work; its plugin rewrites the call into an RPC.

---

## 5. Route file for the page layer

`src/routes/cat/index.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import CatContainer from './-containers/CatContainer';

export const Route = createFileRoute('/cat/')({
  component: CatPage,
});

function CatPage() {
  return <CatContainer />;
}
```

The route id for an index file is `/<feature>/` with the trailing slash. `renderContainer` emits a default export, so the import is a default import. Only the index route is generated; a `$id.tsx` detail route is left to the developer.

`writeEntryFile` in `feature.ts` hardcodes both the filename `page.tsx` and `renderPage`. Both become profile-derived: the Next profiles keep `page.tsx` and `renderPage`, and `tanstack-start` gets `index.tsx` and a new `renderRouteFile`.

---

## 6. Command surface

- `make:hook <feature>/<Entity>` writes one file per standard action instead of a single `use<Entity>.ts`. Its signature becomes `makeHook(feature, entity)`, matching `makeService` and `makeRepository`, and it uses `writeSpecFiles`, which skips existing files with a warning rather than throwing.
- `make:action <feature>/<Entity> <name>` additionally writes a hook on any profile that has the hook layer. Without it a custom action has no way to be called from the UI.
- `make:feature <feature>/<Entity> -a` is unchanged in shape; `scaffoldLayers` already gates on `hasLayer(profile, 'hook')`. Its call site currently passes a hook name built as "use" plus the entity, and becomes `makeHook(feature, entity)`.
- `renderContainer` and `writeEntryFile` change as described in sections 1 and 5.
- `writeController` in `action.ts` gains a `tanstack-start` branch. That function is now a chain of `profile.name ===` comparisons; convert it to a lookup keyed by profile name while adding the third case.

## 7. Documentation

- README: the stack table, a TanStack Start section, the per-action hook change, and an Upgrading note covering the hook split.
- `src/init/content.ts`: the AGENTS and SKILL text lists the supported stacks and must gain `tanstack-start`, plus a line saying hooks are one file per action.

## 8. Testing

- Unit tests per renderer: the plain hook in both shapes, the Query hook in both shapes, the keys module, the server function across all four validator cases, and the Start client repository across all four call conventions.
- The existing per-stack integration test walks every generated import to a real file. Extend it to `tanstack-start`.
- **Correction (Task 8, 2026-09-09):** this bullet originally claimed the repo already had a fixture type-check for Express, Fastify, Hono and Nest that this task would extend. It did not — no such harness existed anywhere in the repository outside an earlier session's scratchpad, which was never committed. Task 8 created the first one from scratch, deliberately scoped to `tanstack-start` only: `scripts/typecheck-tanstack-fixture.js` (`npm run typecheck:tanstack-fixture`), on-demand and not wired into `npm test` or CI. A fixture spanning all six stacks in CI is separately tracked follow-up work, not part of this plan. It compiles a generated `cat` feature against real, pinned `@tanstack/react-start` (1.168.50), `@tanstack/react-router` (1.170.33), `@tanstack/react-query` (5.102.8), `zod` (4.6.0), `react` and `react-dom` (19.3.0) under `strict`. Result: the generated code compiled outright — see the Risks section for the one non-defect wrinkle the fixture surfaced (route-file typing needs the project's own route-tree codegen).
- Coverage threshold stays at 80.

## 9. Breaking changes

Splitting hooks changes generated output for every existing frontend profile. `use<Entity>.ts` is no longer produced, and `make:hook` takes an entity rather than a hook name. Existing generated files are never touched, so this affects new scaffolding only. Version 0.4.0, with a README upgrade note.

## 10. Risks

- **Resolved (Task 8, 2026-09-09):** the server-function typings were confirmed from the package's own exports, but the `.validator()` generic behaviour was read from docs, not verified. The fixture (`npm run typecheck:tanstack-fixture`) now proves it: a bare Zod schema passed to `.validator()` compiles exactly as documented in section 3 above, against the real `@tanstack/react-start` 1.168.50 and `zod` 4.6.0 — no `(d) => Schema.parse(d)` wrapper needed. The fixture also confirmed `data` inside `.handler()` is narrowed to the schema's inferred type, not widened to `any`; a deliberately broken field reference in the Update case's `data.data` (renamed to a name that does not exist) was caught by `tsc` as `TS2339`, confirming the check has teeth.
- **New finding (Task 8, 2026-09-09), not a defect:** a generated route file (section 5) only type-checks inside a project where `FileRoutesByPath` has been augmented by TanStack Router's own file-route codegen. That interface is empty (`export interface FileRoutesByPath {}`) until something merges into it, and a real project gets that merge from `routeTree.gen.ts`, which the framework's Vite plugin regenerates on every `dev`/`build`. domain-driver scaffolds a feature, not the app shell (see Scope), so it never produces a root route or a route tree — the same way it does not produce `vite.config.ts`. A bare `tsc --noEmit` over a freshly generated feature therefore fails on `createFileRoute('/cat/')` with `TS2345: Argument of type '"/cat/"' is not assignable to parameter of type 'undefined'` regardless of what the renderer emits. The fixture resolves this the way a real project would: it writes a minimal `src/routes/__root.tsx` and runs `@tanstack/router-cli`'s `tsr generate` before type-checking. Anyone hand-verifying a generated route file locally needs the same two things. This also incidentally confirmed the `-` prefix convention (section 2) works as intended: `tsr generate` correctly ignored every `-server`, `-client`, `-hooks`, `-components`, `-containers`, `-schemas` and `-types` directory and produced exactly one route, `/cat/`, matching what `renderRoute` emits.
- `@tanstack/react-start` requires Node 22.12 in the consuming project. That binds users of the profile, not domain-driver, whose own floor stays at 20. (The fixture asserts this itself before running, so it fails fast with a clear message on an older Node rather than a confusing install or codegen error.)
- Start's plugin must be able to see through the `-server/functions` import chain. If it cannot, the client repository indirection is the thing that breaks, and the fallback is for the hook to call the server function directly. Not exercised by the fixture, which only compiles the slice — it does not run Start's bundler plugin or a dev server.
