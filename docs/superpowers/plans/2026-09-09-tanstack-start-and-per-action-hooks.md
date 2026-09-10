# TanStack Start profile and per-action hooks — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `tanstack-start` stack profile whose controller layer is server functions, and split the hook layer into one file per action on every profile that has hooks.

**Architecture:** A sixth `StackProfile` joins the existing registry, so detection, layer gating and directory resolution need no structural change. The hook layer moves from one `use<Entity>.ts` to one `<Action><Entity>.hook.ts` per action, driven by the same frozen `ActionSpec` every other layer already uses. A new `queryHooks` profile flag selects between a plain React renderer and a TanStack Query renderer, so pointing the React and Next profiles at Query later is a one-line change.

**Tech Stack:** TypeScript 5.9 (strict, commonjs, ES2020), Node 20+, commander 14, vitest 4 with v8 coverage. No new runtime dependencies for domain-driver itself.

**Spec:** `docs/superpowers/specs/2026-09-09-tanstack-start-and-per-action-hooks-design.md`

## Global Constraints

- domain-driver's own `engines.node` stays `>=20`. Do not raise it. `@tanstack/react-start` requires Node 22.12 in the *consuming* project only.
- Server functions accept **GET and POST only**. `spec.method === 'get'` emits `{ method: 'GET' }`; `post`, `put` and `delete` all emit `{ method: 'POST' }`.
- Every layer directory on the `tanstack-start` profile starts with `-`, so TanStack Router excludes it from routing.
- Hook files are named `<spec.name>.hook.ts` and export `use<spec.name>`. Never name the file `use…`.
- Plain query hooks return exactly `{ data, loading, error, refetch }`. Plain mutation hooks return exactly `{ <lowerFirst(spec.name)>, loading, error }`.
- Query hooks return the `useQuery` / `useMutation` result unmodified.
- Mutation hook options must destructure `onSuccess` and depend on `[onSuccess]`. Depending on `[options]` is a defect: the default `{}` is a fresh object every render.
- Generated code imports `createServerFn` from `@tanstack/react-start`, `createFileRoute` from `@tanstack/react-router`, and `useQuery` / `useMutation` / `useQueryClient` from `@tanstack/react-query`.
- Never overwrite an existing generated file. Use `writeIfAbsent` / `writeSpecFiles`, which warn and skip.
- Coverage thresholds stay at 80. Run `npm test` before every commit.
- Commit messages follow `<type>: <description>` and end with the `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` trailer.

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `src/stack/profiles/tanstack-start.ts` | the profile object |
| `src/templates/frontend/query-hook.ts` | Query hook renderer |
| `src/templates/frontend/query-keys.ts` | cache key module renderer |
| `src/templates/controllers/server-fn.ts` | server function renderer |
| `src/templates/frontend/server-fn-repository.ts` | client repository that calls a server function |
| `src/templates/frontend/route.ts` | TanStack route file renderer |
| `src/templates/__tests__/query-hooks.test.ts` | tests for the two files above |
| `src/templates/__tests__/server-fn.test.ts` | tests for the server function renderer |

**Modify:** `src/stack/types.ts`, `src/stack/detect.ts`, `src/stack/registry.ts`, the five existing profile files (new flag), `src/templates/frontend/hook.ts` (rewritten), `src/templates/frontend/container.ts`, `src/commands/hook.ts`, `src/commands/feature.ts`, `src/commands/controller.ts`, `src/commands/repository.ts`, `src/commands/action.ts`, `src/commands/hints.ts`, `src/cli.ts`, `src/__tests__/helpers/context.ts`, `README.md`, `src/init/content.ts`, `package.json`.

---

### Task 1: The tanstack-start profile and detection

**Files:**
- Create: `src/stack/profiles/tanstack-start.ts`
- Modify: `src/stack/types.ts`, `src/stack/registry.ts`, `src/stack/detect.ts`
- Modify: `src/__tests__/helpers/context.ts` (DEFAULT_ROOTS)
- Modify: the five existing profiles in `src/stack/profiles/` (add `queryHooks: false`)
- Test: `src/stack/__tests__/detect.test.ts`, `src/stack/__tests__/registry.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `StackName` gains `'tanstack-start'`; `StackProfile` gains `readonly queryHooks: boolean`; `tanstackStart: StackProfile` exported from `src/stack/profiles/tanstack-start.ts`.

- [ ] **Step 1: Write the failing detection tests**

Add to `src/stack/__tests__/detect.test.ts`. That file already calls `createTempProject('detect')` in `beforeEach`, so use its existing `writePackageJson` and `mkdir` helpers, which take a flat dependency map and a project-relative directory:

```ts
it('detects tanstack-start from @tanstack/react-start', () => {
    writePackageJson({ '@tanstack/react-start': '1', react: '1' });
    expect(detectStack().stack).toBe('tanstack-start');
});

it('prefers tanstack-start over react and next', () => {
    writePackageJson({ '@tanstack/react-start': '1', react: '1', next: '1' });
    expect(detectStack().stack).toBe('tanstack-start');
});

it('roots a tanstack-start feature at src/routes when it exists', () => {
    writePackageJson({ '@tanstack/react-start': '1' });
    mkdir('src/routes');
    expect(detectStack().featureRoot).toBe('src/routes');
});

it('falls back to routes when only that directory exists', () => {
    writePackageJson({ '@tanstack/react-start': '1' });
    mkdir('routes');
    expect(detectStack().featureRoot).toBe('routes');
});

it('defaults a bare tanstack-start project to src/routes', () => {
    writePackageJson({ '@tanstack/react-start': '1' });
    expect(detectStack().featureRoot).toBe('src/routes');
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/stack/__tests__/detect.test.ts`
Expected: FAIL, because `'tanstack-start'` is not a valid `StackName`.

- [ ] **Step 3: Add the flag to StackProfile and the name to StackName**

In `src/stack/types.ts`:

```ts
export const STACK_NAMES = ['next-fullstack', 'next-frontend', 'react', 'node', 'nest', 'tanstack-start'] as const;
```

Add to the `StackProfile` interface, after `serverComponents`:

```ts
    readonly queryHooks: boolean;
```

Then add `queryHooks: false,` to each of the five existing profile objects. TypeScript will point at every one that is missing it.

- [ ] **Step 4: Create the profile**

`src/stack/profiles/tanstack-start.ts`:

```ts
import { StackProfile } from '../types';

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
        'page',
        'component',
        'container',
        'hook',
        'clientService',
        'clientRepository',
        'serverService',
        'serverRepository',
        'controller',
        'schema',
        'types',
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
    queryHooks: true,
});
```

- [ ] **Step 5: Register it and detect it**

In `src/stack/registry.ts`, import `tanstackStart` and add `'tanstack-start': tanstackStart,` to `PROFILES`.

In `src/stack/detect.ts`, add the check to `inferStack` between Nest and Next:

```ts
function inferStack(cwd: string, deps: ReadonlySet<string>): StackName {
    if (deps.has('@nestjs/core')) return 'nest';
    if (deps.has('@tanstack/react-start')) return 'tanstack-start';
    if (deps.has('next')) return hasApiDir(cwd) ? 'next-fullstack' : 'next-frontend';
    if (deps.has('react')) return 'react';
    return 'node';
}
```

And add the case to `resolveFeatureRoot`, which must prefer the `src` form unlike the Next branch:

```ts
        case 'tanstack-start':
            if (isDirectory(path.join(cwd, 'src', 'routes'))) return 'src/routes';
            return isDirectory(path.join(cwd, 'routes')) ? 'routes' : 'src/routes';
```

In `src/__tests__/helpers/context.ts`, add `'tanstack-start': 'src/routes',` to `DEFAULT_ROOTS`.

- [ ] **Step 6: Derive componentDir from the profile**

`componentDir` in `src/stack/registry.ts` hardcodes the string `'components'` and ignores `layerDirs.component`. On this profile that would write components to `src/routes/<feature>/components/` with no dash, and TanStack Router would treat every one of them as a route. Both `makeComponent` and `renderContainer` call it. Replace it with:

```ts
export function componentDir(profile: StackProfile, type: 'client' | 'server'): string {
    const base = layerDir(profile, 'component');
    return profile.serverComponents ? `${base}/${type}` : base;
}
```

This is behaviour-preserving for the five existing profiles: the Next profiles still return `components/client` and `components/server`, react still returns `components`. Add a test in `src/stack/__tests__/registry.test.ts` asserting `componentDir(tanstackStart, 'client')` is `-components` and that the Next profiles are unchanged.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS. The `registry.test.ts` assertions that enumerate stacks may need the new name added.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: add the tanstack-start stack profile and its detection"
```

---

### Task 2: Per-action hooks on the existing frontend profiles

**Files:**
- Modify: `src/templates/frontend/hook.ts` (complete rewrite), `src/templates/frontend/container.ts`
- Modify: `src/commands/hook.ts`, `src/commands/feature.ts`, `src/cli.ts`
- Test: `src/templates/__tests__/frontend.test.ts`, `src/commands/__tests__/frontend-commands.test.ts`

**Interfaces:**
- Consumes: `queryHooks` from Task 1 (not read yet, but the field exists).
- Produces: `renderHook(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string` and `makeHook(feature: string, entity: string): boolean`. Task 3 branches on the same call site; Task 7 calls `makeHook` for a single custom spec.

- [ ] **Step 1: Write the failing renderer tests**

Replace the `renderHook` describe block in `src/templates/__tests__/frontend.test.ts`:

```ts
describe('renderHook', () => {
    it('renders a list query hook that fetches on mount', () => {
        const ctx = contextFor('react', 'cat');
        const spec = standardAction('List', 'Cat');
        const file = path.join(ctx.featureDir, 'hooks/ListCat.hook.ts');
        const content = renderHook(ctx, spec, 'Cat', file);

        expect(content).toContain('export function useListCat()');
        expect(content).toContain('const [data, setData] = useState<Cat[]>([]);');
        expect(content).toContain('setData(await service.handle());');
        expect(content).toContain('}, []);');
        expect(content).toContain('void refetch();');
        expect(content).toContain('return { data, loading, error, refetch };');
    });

    it('renders a detail query hook keyed on the id', () => {
        const ctx = contextFor('react', 'cat');
        const content = renderHook(ctx, standardAction('Show', 'Cat'), 'Cat', path.join(ctx.featureDir, 'hooks/ShowCat.hook.ts'));

        expect(content).toContain('export function useShowCat(id: string)');
        expect(content).toContain('const [data, setData] = useState<Cat | null>(null);');
        expect(content).toContain('setData(await service.handle(id));');
        expect(content).toContain('}, [id]);');
    });

    it('renders a mutation hook with a destructured onSuccess', () => {
        const ctx = contextFor('react', 'cat');
        const content = renderHook(ctx, standardAction('Update', 'Cat'), 'Cat', path.join(ctx.featureDir, 'hooks/UpdateCat.hook.ts'));

        expect(content).toContain('export function useUpdateCat(options: { onSuccess?: (result: Cat) => void } = {})');
        expect(content).toContain('const { onSuccess } = options;');
        expect(content).toContain('const updateCat = useCallback(async (id: string, data: UpdateCat) => {');
        expect(content).toContain('const result = await service.handle(id, data);');
        expect(content).toContain('onSuccess?.(result);');
        expect(content).toContain('}, [onSuccess]);');
        expect(content).toContain('return { updateCat, loading, error };');
        expect(content).not.toContain('[options]');
    });

    it('renders a void mutation hook without a result argument', () => {
        const ctx = contextFor('react', 'cat');
        const content = renderHook(ctx, standardAction('Delete', 'Cat'), 'Cat', path.join(ctx.featureDir, 'hooks/DeleteCat.hook.ts'));

        expect(content).toContain('options: { onSuccess?: () => void } = {}');
        expect(content).toContain('onSuccess?.();');
        expect(content).not.toContain('const result =');
    });

    it('adds the client directive on Next', () => {
        const ctx = contextFor('next-frontend', 'cat');
        const content = renderHook(ctx, standardAction('List', 'Cat'), 'Cat', path.join(ctx.featureDir, 'hooks/ListCat.hook.ts'));
        expect(content.startsWith("'use client';")).toBe(true);
    });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/templates/__tests__/frontend.test.ts`
Expected: FAIL on the `renderHook` signature.

- [ ] **Step 3: Rewrite the renderer**

Replace the whole of `src/templates/frontend/hook.ts`:

```ts
import { lowerFirst } from '../../utils/naming';
import { ActionSpec } from '../actions';
import { RenderContext } from '../context';
import { domainImports } from '../signatures';

function payloadType(spec: ActionSpec): string {
    return spec.returns.replace(/^Promise<(.*)>$/, '$1');
}

function header(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string, hooks: string): string {
    const directive = ctx.profile.clientDirective ? "'use client';\n\n" : '';
    const servicePath = ctx.importLayer(fromFile, 'clientService', `${spec.name}.service`);
    const domain = domainImports(ctx, fromFile, spec, entity);

    return `${directive}import { ${hooks} } from 'react';
${domain.join('\n')}${domain.length > 0 ? '\n' : ''}import { ${spec.name}Service } from '${servicePath}';

const service = new ${spec.name}Service();
`;
}

function renderQuery(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string {
    const type = payloadType(spec);
    const isList = type.endsWith('[]');
    const stateType = isList ? type : `${type} | null`;
    const initial = isList ? '[]' : 'null';
    const deps = spec.usesId ? '[id]' : '[]';

    return `${header(ctx, spec, entity, fromFile, 'useState, useEffect, useCallback')}
export function use${spec.name}(${spec.params}) {
  const [data, setData] = useState<${stateType}>(${initial});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await service.handle(${spec.args}));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '${spec.failure}');
    } finally {
      setLoading(false);
    }
  }, ${deps});

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
`;
}

function renderMutation(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string {
    const callable = lowerFirst(spec.name);
    const returnsValue = spec.usesEntityType;
    const type = payloadType(spec);
    const callbackType = returnsValue ? `(result: ${type}) => void` : '() => void';
    const body = returnsValue
        ? `      const result = await service.handle(${spec.args});
      onSuccess?.(result);
      return result;`
        : `      await service.handle(${spec.args});
      onSuccess?.();`;
    const failure = returnsValue
        ? `      setError(err instanceof Error ? err.message : '${spec.failure}');
      return null;`
        : `      setError(err instanceof Error ? err.message : '${spec.failure}');`;

    return `${header(ctx, spec, entity, fromFile, 'useState, useCallback')}
export function use${spec.name}(options: { onSuccess?: ${callbackType} } = {}) {
  const { onSuccess } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ${callable} = useCallback(async (${spec.params}) => {
    setLoading(true);
    setError(null);
    try {
${body}
    } catch (err: unknown) {
${failure}
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return { ${callable}, loading, error };
}
`;
}

export function renderHook(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string {
    return spec.method === 'get'
        ? renderQuery(ctx, spec, entity, fromFile)
        : renderMutation(ctx, spec, entity, fromFile);
}
```

- [ ] **Step 4: Run the renderer tests**

Run: `npx vitest run src/templates/__tests__/frontend.test.ts`
Expected: the `renderHook` block PASSES. `renderContainer` tests still fail; Step 6 fixes those.

- [ ] **Step 5: Rewrite the hook command**

Replace `src/commands/hook.ts`:

```ts
import { assertLayer } from '../stack/registry';
import { standardActions } from '../templates/actions';
import { renderHook } from '../templates/frontend/hook';
import { ensureLayerDir, requireFeature } from './resolve';
import { writeSpecFiles } from './write';

export function makeHook(feature: string, entity: string): boolean {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'hook', 'make:hook');

    const dir = ensureLayerDir(ctx, 'hook');
    const written = writeSpecFiles(dir, standardActions(entity), 'hook', (spec, filePath) =>
        renderHook(ctx, spec, entity, filePath)
    );
    if (written > 0) console.log(`✅ Hooks for "${entity}" created at ${dir}`);
    return written > 0;
}
```

In `src/commands/feature.ts`, change the `scaffoldLayers` line to:

```ts
    if (hasLayer(profile, 'hook')) makeHook(feature, entity);
```

In `src/cli.ts`, update the `make:hook` command description and keep `parseTarget`:

```ts
    program
        .command('make:hook <target>')
        .description('Scaffold single-responsibility hook files inside an existing feature (<feature>/<Entity>)')
        .action((target: string) => {
            const { feature, name } = parseTarget(target);
            makeHook(feature, name);
        });
```

- [ ] **Step 6: Update the container renderer**

In `src/templates/frontend/container.ts`, the hook import and destructuring change. Replace the body of `renderContainer` with:

```ts
    const header = ctx.profile.clientDirective ? "'use client';\n\n" : '';
    const hookName = `useList${entity}`;
    const hookPath = ctx.importLayer(fromFile, 'hook', `List${entity}.hook`);
    const componentPath = ctx.importFrom(fromFile, `${componentDir(ctx.profile, 'client')}/${entity}`);
    const query = ctx.profile.queryHooks;
    const loadingField = query ? 'isPending' : 'loading';
    const errorExpression = query ? '{error.message}' : '{error}';
    const items = query ? '(data ?? [])' : 'data';

    return `${header}import { ${hookName} } from '${hookPath}';
import ${entity} from '${componentPath}';

export default function ${containerName}() {
  const { data, ${loadingField}, error } = ${hookName}();

  if (${loadingField}) return <div>Loading...</div>;
  if (error) return <div>Error: ${errorExpression}</div>;

  return (
    <div>
      {${items}.map((item) => (
        <${entity} key={item.id} {...item} />
      ))}
    </div>
  );
}
`;
```

Update the `renderContainer` tests in `src/templates/__tests__/frontend.test.ts` to expect `useListCat` and `List Cat.hook` paths, and add one asserting the `tanstack-start` variant uses `isPending`, `error.message` and `(data ?? [])`.

- [ ] **Step 7: Update the command tests**

In `src/commands/__tests__/frontend-commands.test.ts`, `make:hook` now writes five files. Assert `hooks/ListCat.hook.ts` … `hooks/DeleteCat.hook.ts` exist and that `useCat.ts` does not.

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: split the hook layer into one file per action"
```

---

### Task 3: Query hooks and the keys module for tanstack-start

**Files:**
- Create: `src/templates/frontend/query-hook.ts`, `src/templates/frontend/query-keys.ts`, `src/templates/__tests__/query-hooks.test.ts`
- Modify: `src/commands/hook.ts`, `src/commands/hints.ts`
- Test: `src/commands/__tests__/hints.test.ts`

**Interfaces:**
- Consumes: `queryHooks` (Task 1), `makeHook` (Task 2).
- Produces: `renderQueryHook(ctx, spec, entity, fromFile): string`, `renderQueryKeys(feature: string): string`, `hintReactQuery(profile: StackProfile): void`.

- [ ] **Step 1: Write the failing tests**

`src/templates/__tests__/query-hooks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { renderQueryHook } from '../frontend/query-hook';
import { renderQueryKeys } from '../frontend/query-keys';
import { standardAction } from '../actions';
import { contextFor } from '../../__tests__/helpers/context';

describe('renderQueryKeys', () => {
    it('camelCases the constant and keeps the kebab key', () => {
        const content = renderQueryKeys('coffee-type');
        expect(content).toContain('export const coffeeTypeKeys = {');
        expect(content).toContain("all: ['coffee-type'] as const,");
        expect(content).toContain("detail: (id: string) => ['coffee-type', id] as const,");
    });
});

describe('renderQueryHook', () => {
    const ctx = contextFor('tanstack-start', 'cat');
    const file = (name: string) => path.join(ctx.featureDir, `-hooks/${name}.hook.ts`);

    it('renders a list query against the all key', () => {
        const content = renderQueryHook(ctx, standardAction('List', 'Cat'), 'Cat', file('ListCat'));
        expect(content).toContain("import { useQuery } from '@tanstack/react-query';");
        expect(content).toContain('queryKey: catKeys.all,');
        expect(content).toContain('queryFn: (): Promise<Cat[]> => service.handle(),');
        expect(content).not.toContain('useMutation');
    });

    it('renders a detail query against the detail key', () => {
        const content = renderQueryHook(ctx, standardAction('Show', 'Cat'), 'Cat', file('ShowCat'));
        expect(content).toContain('export function useShowCat(id: string)');
        expect(content).toContain('queryKey: catKeys.detail(id),');
    });

    it('renders a create mutation that invalidates the list', () => {
        const content = renderQueryHook(ctx, standardAction('Create', 'Cat'), 'Cat', file('CreateCat'));
        expect(content).toContain("import { useMutation, useQueryClient } from '@tanstack/react-query';");
        expect(content).toContain('mutationFn: (data: CreateCat): Promise<Cat> => service.handle(data),');
        expect(content).toContain('void queryClient.invalidateQueries({ queryKey: catKeys.all });');
    });

    it('wraps a two-argument mutation in one object and invalidates both keys', () => {
        const content = renderQueryHook(ctx, standardAction('Update', 'Cat'), 'Cat', file('UpdateCat'));
        expect(content).toContain('mutationFn: ({ id, data }: { id: string; data: UpdateCat }): Promise<Cat> => service.handle(id, data),');
        expect(content).toContain('onSuccess: (_result, { id }) => {');
        expect(content).toContain('void queryClient.invalidateQueries({ queryKey: catKeys.detail(id) });');
    });

    it('passes the id straight through for a delete mutation', () => {
        const content = renderQueryHook(ctx, standardAction('Delete', 'Cat'), 'Cat', file('DeleteCat'));
        expect(content).toContain('mutationFn: (id: string): Promise<void> => service.handle(id),');
        expect(content).toContain('onSuccess: (_result, id) => {');
    });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/templates/__tests__/query-hooks.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write the keys renderer**

`src/templates/frontend/query-keys.ts`:

```ts
import { lowerFirst, toPascalCase } from '../../utils/naming';

export function keysConstant(feature: string): string {
    return `${lowerFirst(toPascalCase(feature))}Keys`;
}

export function renderQueryKeys(feature: string): string {
    return `export const ${keysConstant(feature)} = {
  all: ['${feature}'] as const,
  detail: (id: string) => ['${feature}', id] as const,
};
`;
}
```

- [ ] **Step 4: Write the Query hook renderer**

`src/templates/frontend/query-hook.ts`:

```ts
import { ActionSpec } from '../actions';
import { RenderContext } from '../context';
import { domainImports } from '../signatures';
import { keysConstant } from './query-keys';

function payloadType(spec: ActionSpec): string {
    return spec.returns.replace(/^Promise<(.*)>$/, '$1');
}

function preamble(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string, imported: string): string {
    const servicePath = ctx.importLayer(fromFile, 'clientService', `${spec.name}.service`);
    const keysPath = ctx.importLayer(fromFile, 'hook', `${ctx.feature}.keys`);
    const domain = domainImports(ctx, fromFile, spec, entity);

    return `import { ${imported} } from '@tanstack/react-query';
${domain.join('\n')}${domain.length > 0 ? '\n' : ''}import { ${spec.name}Service } from '${servicePath}';
import { ${keysConstant(ctx.feature)} } from '${keysPath}';

const service = new ${spec.name}Service();
`;
}

function renderQuery(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string {
    const key = spec.usesId ? `${keysConstant(ctx.feature)}.detail(id)` : `${keysConstant(ctx.feature)}.all`;

    return `${preamble(ctx, spec, entity, fromFile, 'useQuery')}
export function use${spec.name}(${spec.params}) {
  return useQuery({
    queryKey: ${key},
    queryFn: (): ${spec.returns} => service.handle(${spec.args}),
  });
}
`;
}

function mutationInput(spec: ActionSpec): { readonly signature: string; readonly call: string; readonly idFrom: string | null } {
    if (spec.usesId && spec.schema !== null) {
        return {
            signature: `({ id, data }: { id: string; data: ${spec.schema} })`,
            call: 'id, data',
            idFrom: '{ id }',
        };
    }
    if (spec.usesId) return { signature: '(id: string)', call: 'id', idFrom: 'id' };
    if (spec.schema !== null) return { signature: `(data: ${spec.schema})`, call: 'data', idFrom: null };
    return { signature: '()', call: '', idFrom: null };
}

function renderMutation(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string {
    const keys = keysConstant(ctx.feature);
    const { signature, call, idFrom } = mutationInput(spec);
    const args = idFrom === null ? '()' : `(_result, ${idFrom})`;
    const detail =
        idFrom === null
            ? ''
            : `\n      void queryClient.invalidateQueries({ queryKey: ${keys}.detail(id) });`;

    return `${preamble(ctx, spec, entity, fromFile, 'useMutation, useQueryClient')}
export function use${spec.name}() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ${signature}: ${spec.returns} => service.handle(${call}),
    onSuccess: ${args} => {
      void queryClient.invalidateQueries({ queryKey: ${keys}.all });${detail}
    },
  });
}
`;
}

export function renderQueryHook(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string {
    return spec.method === 'get'
        ? renderQuery(ctx, spec, entity, fromFile)
        : renderMutation(ctx, spec, entity, fromFile);
}
```

- [ ] **Step 5: Run the renderer tests**

Run: `npx vitest run src/templates/__tests__/query-hooks.test.ts`
Expected: PASS. Adjust whitespace in the renderer, never in the assertions, if a string comparison is off by formatting.

- [ ] **Step 6: Branch the hook command and add the hint**

In `src/commands/hints.ts`:

```ts
let reactQueryHinted = false;

export function hintReactQuery(profile: StackProfile): void {
    if (!profile.queryHooks || reactQueryHinted) return;
    reactQueryHinted = true;
    console.log('ℹ️  Hooks use TanStack Query. Install it: npm install @tanstack/react-query');
    console.log('   Then wrap your app in a QueryClientProvider.');
}
```

Add `reactQueryHinted = false;` to `resetHints`.

In `src/commands/hook.ts`, select the renderer and write the keys module first:

```ts
    const dir = ensureLayerDir(ctx, 'hook');
    if (ctx.profile.queryHooks) {
        writeIfAbsent(path.join(dir, `${ctx.feature}.keys.ts`), () => renderQueryKeys(ctx.feature));
    }
    const render = ctx.profile.queryHooks ? renderQueryHook : renderHook;
    const written = writeSpecFiles(dir, standardActions(entity), 'hook', (spec, filePath) =>
        render(ctx, spec, entity, filePath)
    );
    if (written > 0) {
        console.log(`✅ Hooks for "${entity}" created at ${dir}`);
        hintReactQuery(ctx.profile);
    }
    return written > 0;
```

- [ ] **Step 7: Run the full suite and commit**

Run: `npm test`

```bash
git add -A && git commit -m "feat: TanStack Query hooks and a cache key module for tanstack-start"
```

---

### Task 4: Server functions as the controller layer

**Files:**
- Create: `src/templates/controllers/server-fn.ts`, `src/templates/__tests__/server-fn.test.ts`
- Modify: `src/commands/controller.ts`, `src/commands/action.ts`
- Test: `src/commands/__tests__/controller.test.ts`

**Interfaces:**
- Consumes: the profile from Task 1.
- Produces: `renderServerFn(ctx, spec, entity, fromFile): string`. Task 5's repository imports the symbol it exports, which is `lowerFirst(spec.name)`.

- [ ] **Step 1: Write the failing tests**

`src/templates/__tests__/server-fn.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { renderServerFn } from '../controllers/server-fn';
import { standardAction, customAction } from '../actions';
import { contextFor } from '../../__tests__/helpers/context';

const ctx = contextFor('tanstack-start', 'cat');
const file = (name: string) => path.join(ctx.featureDir, `-server/functions/${name}.fn.ts`);

describe('renderServerFn', () => {
    it('omits the validator when there is no input', () => {
        const content = renderServerFn(ctx, standardAction('List', 'Cat'), 'Cat', file('ListCat'));
        expect(content).toContain("import { createServerFn } from '@tanstack/react-start';");
        expect(content).toContain("export const listCat = createServerFn({ method: 'GET' })");
        expect(content).toContain('.handler(async () => service.handle());');
        expect(content).not.toContain('.validator(');
        expect(content).not.toContain("from 'zod'");
    });

    it('validates a bare id with z.string', () => {
        const content = renderServerFn(ctx, standardAction('Show', 'Cat'), 'Cat', file('ShowCat'));
        expect(content).toContain("import { z } from 'zod';");
        expect(content).toContain('.validator(z.string())');
        expect(content).toContain('.handler(async ({ data }) => service.handle(data));');
    });

    it('validates a create with the generated schema', () => {
        const content = renderServerFn(ctx, standardAction('Create', 'Cat'), 'Cat', file('CreateCat'));
        expect(content).toContain("export const createCat = createServerFn({ method: 'POST' })");
        expect(content).toContain('.validator(CreateCatSchema)');
        expect(content).toContain('CreateCatSchema }');
    });

    it('wraps id and payload for an update and downgrades PUT to POST', () => {
        const content = renderServerFn(ctx, standardAction('Update', 'Cat'), 'Cat', file('UpdateCat'));
        expect(content).toContain("createServerFn({ method: 'POST' })");
        expect(content).toContain('.validator(z.object({ id: z.string(), data: UpdateCatSchema }))');
        expect(content).toContain('.handler(async ({ data }) => service.handle(data.id, data.data));');
    });

    it('downgrades DELETE to POST', () => {
        const content = renderServerFn(ctx, standardAction('Delete', 'Cat'), 'Cat', file('DeleteCat'));
        expect(content).toContain("createServerFn({ method: 'POST' })");
    });

    it('handles a custom GET action with no input', () => {
        const spec = customAction('Cat', 'findActiveCats', { withInput: false, returns: 'list' });
        const content = renderServerFn(ctx, spec, 'Cat', file('FindActiveCats'));
        expect(content).toContain("export const findActiveCats = createServerFn({ method: 'GET' })");
        expect(content).not.toContain('.validator(');
    });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/templates/__tests__/server-fn.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the renderer**

`src/templates/controllers/server-fn.ts`:

```ts
import { lowerFirst } from '../../utils/naming';
import { ActionSpec } from '../actions';
import { RenderContext } from '../context';

interface Input {
    readonly validator: string | null;
    readonly call: string;
    readonly handlerArg: string;
    readonly needsZod: boolean;
}

function inputFor(spec: ActionSpec): Input {
    if (spec.schema !== null && spec.usesId) {
        return {
            validator: `z.object({ id: z.string(), data: ${spec.schema}Schema })`,
            call: 'data.id, data.data',
            handlerArg: '{ data }',
            needsZod: true,
        };
    }
    if (spec.schema !== null) {
        return { validator: `${spec.schema}Schema`, call: 'data', handlerArg: '{ data }', needsZod: false };
    }
    if (spec.usesId) {
        return { validator: 'z.string()', call: 'data', handlerArg: '{ data }', needsZod: true };
    }
    return { validator: null, call: '', handlerArg: '', needsZod: false };
}

export function renderServerFn(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string {
    const { validator, call, handlerArg, needsZod } = inputFor(spec);
    const method = spec.method === 'get' ? 'GET' : 'POST';
    const servicePath = ctx.importLayer(fromFile, 'serverService', `${spec.name}.service`);

    const imports = ["import { createServerFn } from '@tanstack/react-start';"];
    if (needsZod) imports.push("import { z } from 'zod';");
    if (spec.schema !== null) {
        const schemaPath = ctx.importLayer(fromFile, 'schema', `${spec.schema}.schema`);
        imports.push(`import { ${spec.schema}Schema } from '${schemaPath}';`);
    }
    imports.push(`import { ${spec.name}Service } from '${servicePath}';`);

    const validatorLine = validator === null ? '' : `\n  .validator(${validator})`;

    return `${imports.join('\n')}

const service = new ${spec.name}Service();

export const ${lowerFirst(spec.name)} = createServerFn({ method: '${method}' })${validatorLine}
  .handler(async (${handlerArg}) => service.handle(${call}));
`;
}
```

- [ ] **Step 4: Run the renderer tests**

Run: `npx vitest run src/templates/__tests__/server-fn.test.ts`
Expected: PASS.

- [ ] **Step 5: Replace the controller branching with a lookup**

In `src/commands/controller.ts`, `makeController` currently branches with two `profile.name ===` comparisons and a third is being added. Replace them with a renderer lookup:

```ts
const RENDERERS: Readonly<Partial<Record<StackName, ControllerRenderer>>> = Object.freeze({
    nest: renderNestController,
    node: renderNodeController,
    'tanstack-start': renderServerFn,
});
```

where `ControllerRenderer` is `(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string) => string`. `next-fullstack` keeps its early return to `writeNextRoutes`. The file suffix also varies, so pass it alongside: `tanstack-start` writes `.fn.ts`, everything else `.controller.ts`. The success line for `tanstack-start` reads `✅ Server functions for "<Entity>" created at <dir>`.

Apply the same lookup inside `writeController` in `src/commands/action.ts`, which has the identical chain.

- [ ] **Step 6: Add command tests**

In `src/commands/__tests__/controller.test.ts`, add a `tanstack-start` case asserting `-server/functions/ListCat.fn.ts` through `DeleteCat.fn.ts` exist and that no `.controller.ts` file was written.

- [ ] **Step 7: Run the full suite and commit**

Run: `npm test`

```bash
git add -A && git commit -m "feat: generate server functions as the tanstack-start controller layer"
```

---

### Task 5: The client repository calls the server function

**Files:**
- Create: `src/templates/frontend/server-fn-repository.ts`
- Modify: `src/commands/repository.ts`
- Test: `src/templates/__tests__/data-layers.test.ts`

**Interfaces:**
- Consumes: `renderServerFn`'s exported symbol name from Task 4, which is `lowerFirst(spec.name)`.
- Produces: `renderServerFnRepository(ctx, spec, entity, fromFile): string`.

- [ ] **Step 1: Write the failing tests**

Add to `src/templates/__tests__/data-layers.test.ts`:

```ts
describe('renderServerFnRepository', () => {
    const ctx = contextFor('tanstack-start', 'cat');
    const file = (name: string) => path.join(ctx.featureDir, `-client/repositories/${name}.repository.ts`);

    it('calls a no-argument server function', () => {
        const content = renderServerFnRepository(ctx, standardAction('List', 'Cat'), 'Cat', file('ListCat'));
        expect(content).toContain("import { listCat } from '../../-server/functions/ListCat.fn';");
        expect(content).toContain('return listCat();');
        expect(content).not.toContain('fetch(');
    });

    it('passes a bare id as data', () => {
        const content = renderServerFnRepository(ctx, standardAction('Show', 'Cat'), 'Cat', file('ShowCat'));
        expect(content).toContain('return showCat({ data: id });');
    });

    it('passes a payload as data', () => {
        const content = renderServerFnRepository(ctx, standardAction('Create', 'Cat'), 'Cat', file('CreateCat'));
        expect(content).toContain('return createCat({ data });');
    });

    it('wraps id and payload together', () => {
        const content = renderServerFnRepository(ctx, standardAction('Update', 'Cat'), 'Cat', file('UpdateCat'));
        expect(content).toContain('return updateCat({ data: { id, data } });');
    });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/templates/__tests__/data-layers.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the renderer**

`src/templates/frontend/server-fn-repository.ts`:

```ts
import { lowerFirst } from '../../utils/naming';
import { ActionSpec } from '../actions';
import { RenderContext } from '../context';
import { domainImports } from '../signatures';

function callArgument(spec: ActionSpec): string {
    if (spec.usesId && spec.schema !== null) return '({ data: { id, data } })';
    if (spec.usesId) return '({ data: id })';
    if (spec.schema !== null) return '({ data })';
    return '()';
}

export function renderServerFnRepository(
    ctx: RenderContext,
    spec: ActionSpec,
    entity: string,
    fromFile: string
): string {
    const fnName = lowerFirst(spec.name);
    const fnPath = ctx.importLayer(fromFile, 'controller', `${spec.name}.fn`);
    const imports = [...domainImports(ctx, fromFile, spec, entity), `import { ${fnName} } from '${fnPath}';`];

    return `${imports.join('\n')}

export class ${spec.name}Repository {
  async handle(${spec.params}): ${spec.returns} {
    return ${fnName}${callArgument(spec)};
  }
}
`;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/templates/__tests__/data-layers.test.ts`
Expected: PASS.

- [ ] **Step 5: Select the renderer in the repository command**

In `src/commands/repository.ts`, the client renderer becomes profile-dependent:

Select on the profile name, not on `queryHooks`. The two coincide today but mean different things: `queryHooks` is about the hook renderer, while this choice is about whether a server function exists to call.

```ts
function clientRenderer(ctx: RenderContext): SpecRenderer {
    return ctx.profile.name === 'tanstack-start' ? renderServerFnRepository : renderClientRepository;
}
```

Use it in `makeRepository`:

```ts
        const render = current === 'client' ? clientRenderer(ctx) : renderServerRepository;
```

Apply the same helper in `writeSide` in `src/commands/action.ts`, which makes the identical choice.

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test`

```bash
git add -A && git commit -m "feat: tanstack-start client repositories call server functions directly"
```

---

### Task 6: The route file and a profile-aware entry file

**Files:**
- Create: `src/templates/frontend/route.ts`
- Modify: `src/commands/feature.ts`
- Test: `src/templates/__tests__/frontend.test.ts`, `src/commands/__tests__/feature.test.ts`

**Interfaces:**
- Consumes: `renderContainer`'s default export from Task 2.
- Produces: `renderRoute(ctx, entity, fromFile, withContainer): string`, matching `renderPage`'s parameter order.

- [ ] **Step 1: Write the failing tests**

```ts
describe('renderRoute', () => {
    it('renders a bare route without a container', () => {
        const ctx = contextFor('tanstack-start', 'coffee-type');
        const content = renderRoute(ctx, 'CoffeeType', path.join(ctx.featureDir, 'index.tsx'), false);
        expect(content).toContain("import { createFileRoute } from '@tanstack/react-router';");
        expect(content).toContain("export const Route = createFileRoute('/coffee-type/')({");
        expect(content).toContain('component: CoffeeTypePage,');
        expect(content).toContain('<h1>CoffeeType</h1>');
    });

    it('imports the container as a default import when asked', () => {
        const ctx = contextFor('tanstack-start', 'cat');
        const content = renderRoute(ctx, 'Cat', path.join(ctx.featureDir, 'index.tsx'), true);
        expect(content).toContain("import CatContainer from './-containers/CatContainer';");
        expect(content).toContain('<CatContainer />');
    });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/templates/__tests__/frontend.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the renderer**

`src/templates/frontend/route.ts`:

```ts
import { RenderContext } from '../context';

export function renderRoute(
    ctx: RenderContext,
    entity: string,
    fromFile: string,
    withContainer: boolean
): string {
    const head = `import { createFileRoute } from '@tanstack/react-router';`;
    const routeBlock = `export const Route = createFileRoute('/${ctx.feature}/')({
  component: ${entity}Page,
});`;

    if (!withContainer) {
        return `${head}

${routeBlock}

function ${entity}Page() {
  return (
    <div>
      <h1>${entity}</h1>
    </div>
  );
}
`;
    }

    const containerPath = ctx.importLayer(fromFile, 'container', `${entity}Container`);
    return `${head}
import ${entity}Container from '${containerPath}';

${routeBlock}

function ${entity}Page() {
  return <${entity}Container />;
}
`;
}
```

- [ ] **Step 4: Make the entry file profile-aware**

In `src/commands/feature.ts`, `writeEntryFile` hardcodes `page.tsx` and `renderPage`. Replace the `page` branch with:

```ts
    if (hasLayer(ctx.profile, 'page')) {
        const isRoute = ctx.profile.name === 'tanstack-start';
        const filePath = path.join(ctx.featureDir, isRoute ? 'index.tsx' : 'page.tsx');
        const content = isRoute
            ? renderRoute(ctx, entity, filePath, all)
            : renderPage(ctx, entity, filePath, all);
        writeFileSafe(filePath, content);
    }
```

- [ ] **Step 5: Add a feature command test**

In `src/commands/__tests__/feature.test.ts`, assert that `make:feature cat/Cat -a` on `tanstack-start` writes `src/routes/cat/index.tsx` and no `page.tsx`.

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test`

```bash
git add -A && git commit -m "feat: generate a TanStack route file as the tanstack-start entry point"
```

---

### Task 7: make:action writes a hook

**Files:**
- Modify: `src/commands/action.ts`
- Test: `src/commands/__tests__/action.test.ts`

**Interfaces:**
- Consumes: `renderHook` (Task 2) and `renderQueryHook` (Task 3), both `(ctx, spec, entity, fromFile)`.
- Produces: nothing new.

- [ ] **Step 1: Write the failing tests**

```ts
it('writes a hook for a custom action on react', () => {
    // scaffold the feature on react, then:
    makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
    const content = readProjectFile('src/features/users/hooks/FindActiveUsers.hook.ts');
    expect(content).toContain('export function useFindActiveUsers()');
    expect(content).toContain('return { data, loading, error, refetch };');
});

it('writes a Query hook for a custom action on tanstack-start', () => {
    makeAction('users', 'User', 'notifyUsers', { withInput: true, returns: 'void' });
    const content = readProjectFile('src/routes/users/-hooks/NotifyUsers.hook.ts');
    expect(content).toContain('useMutation');
});

it('writes no hook on a stack without the layer', () => {
    // node profile
    makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
    expect(projectFileExists('src/features/users/hooks/FindActiveUsers.hook.ts')).toBe(false);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/commands/__tests__/action.test.ts`
Expected: FAIL, the hook file is not written.

- [ ] **Step 3: Write the hook inside makeAction**

Add to `makeAction`, after the client side is written:

```ts
    if (hasLayer(ctx.profile, 'hook')) wroteAny = writeHook(ctx, spec, entity) || wroteAny;
```

```ts
function writeHook(ctx: RenderContext, spec: ActionSpec, entity: string): boolean {
    const dir = ensureLayerDir(ctx, 'hook');
    const render = ctx.profile.queryHooks ? renderQueryHook : renderHook;
    if (ctx.profile.queryHooks) {
        writeIfAbsent(path.join(dir, `${ctx.feature}.keys.ts`), () => renderQueryKeys(ctx.feature));
    }
    const filePath = path.join(dir, `${spec.name}.hook.ts`);
    const wrote = writeIfAbsent(filePath, () => render(ctx, spec, entity, filePath));
    if (wrote) hintReactQuery(ctx.profile);
    return wrote;
}
```

A custom action never has `usesId`, so the query variant takes no argument and the mutation variant takes only the payload.

- [ ] **Step 4: Run the full suite and commit**

Run: `npm test`

```bash
git add -A && git commit -m "feat: make:action scaffolds a hook on profiles that have the layer"
```

---

### Task 8: Integration coverage for tanstack-start

**Files:**
- Modify: `src/commands/__tests__/stacks.test.ts`
- Modify: the fixture type-check script used for the other frameworks

**Interfaces:**
- Consumes: everything from Tasks 1 through 7.
- Produces: nothing new.

- [ ] **Step 1: Extend the per-stack integration test**

`src/commands/__tests__/stacks.test.ts` already scaffolds a full feature per stack and walks every generated import to a real file on disk. Add `tanstack-start`. The walk must resolve, among others, `-client/repositories/ListCat.repository.ts` → `-server/functions/ListCat.fn.ts`, and `-hooks/ListCat.hook.ts` → both `-client/services/ListCat.service.ts` and `-hooks/cat.keys.ts`.

- [ ] **Step 2: Run it and fix any broken import path**

Run: `npx vitest run src/commands/__tests__/stacks.test.ts`
Expected: PASS. A failure here means a `ctx.importLayer` call in one of the new renderers names the wrong layer, which is the single most likely defect in this plan.

- [ ] **Step 3: Add the framework type-check fixture**

Extend the existing fixture type-check so a generated `tanstack-start` feature compiles under `strict` against real `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/react-query` and `zod`. This is the only step that can catch `.validator()` generics or the `createFileRoute` signature drifting from what the spec recorded on 2026-09-09. Pin the versions in the fixture's package.json.

Expected first run: this may genuinely fail. If `.validator(z.string())` does not typecheck for a bare id, fall back to `.validator((id: string) => id)` and record the change in the spec's section 3 table before adapting the renderer and its tests.

- [ ] **Step 4: Run everything and commit**

Run: `npm run test:coverage`
Expected: PASS with coverage at or above 80.

```bash
git add -A && git commit -m "test: integration and type-check coverage for the tanstack-start profile"
```

---

### Task 9: Documentation and version

**Files:**
- Modify: `README.md`, `src/init/content.ts`, `package.json`
- Test: `src/init/__tests__/init.test.ts`

**Interfaces:**
- Consumes: the finished behaviour of every earlier task.
- Produces: version 0.4.0.

- [ ] **Step 1: Update the agent guidance**

`src/init/content.ts` holds `AGENTS_SECTION` and `SKILL_CONTENT` as line arrays. Add `tanstack-start` wherever stacks are listed, and add a line stating that hooks are one file per action named `<Action><Entity>.hook.ts`. Update the assertions in `src/init/__tests__/init.test.ts` that count or match those lines.

- [ ] **Step 2: Update the README**

Add `tanstack-start` to the stack table with its detection key and feature root. Add a TanStack Start section showing the generated tree. Document the per-action hook change and the container wiring pattern:

```tsx
const { data, loading, error, refetch } = useListCat();
const { createCat } = useCreateCat({ onSuccess: refetch });
```

Extend the Upgrading section: `use<Entity>.ts` is no longer generated, `make:hook` now takes `<feature>/<Entity>`, and existing generated files are untouched.

- [ ] **Step 3: Bump the version**

```bash
npm version 0.4.0 --no-git-tag-version --ignore-scripts
```

- [ ] **Step 4: Run everything and commit**

Run: `npm test && npm run build`

```bash
git add -A && git commit -m "docs: document the tanstack-start profile and per-action hooks; 0.4.0"
```

---

## Notes for the executor

- Task 1 must land before anything else. Tasks 4, 5 and 6 are independent of each other once Task 1 is in.
- Task 8's type-check is the only step that verifies the generated code against the real TanStack packages. If it disagrees with the spec, the spec is what is wrong; amend it and say so in the ledger.
- Merging to master publishes. Do not bump the version anywhere except Task 9.
