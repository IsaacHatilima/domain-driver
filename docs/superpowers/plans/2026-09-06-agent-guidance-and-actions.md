# Agent Guidance, Custom Actions, and Path-Form Targets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every layer command take `<feature>/<Name>`, add `make:action` for bespoke operations driven by the same templates as the standard five, and add `init` plus a guarded postinstall that write agent guidance into the consuming project.

**Architecture:** A frozen `ActionSpec` becomes the single input to every controller, service, and repository template; the five standard actions are prebuilt specs whose rendered output must stay byte-identical, and a custom action is one more spec. `init` is a pure marker-replacement function wrapped in file I/O. The postinstall is a committed plain-JS shim that requires the built entry inside a try/catch and a pure guard function over the npm environment.

**Tech Stack:** TypeScript 5.9 (strict, commonjs, ES2020), Node 18+, commander 14, vitest 4 with v8 coverage.

**Spec:** `docs/superpowers/specs/2026-09-06-agent-guidance-and-actions-design.md` (builds on `docs/superpowers/specs/2026-09-06-stack-detection-design.md`)

## Global Constraints

- Target grammar: exactly one `/`; feature part matches `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`; name part matches `^[A-Za-z][A-Za-z0-9]*$`. Errors verbatim from spec 3.2.
- Action name matches `^[A-Za-z][A-Za-z0-9]*$`; rejection message `Action name "<value>" must be camelCase or PascalCase, for example findActiveUsers.`
- Action name is used without the entity in file and class names: `findActiveUsers` gives `FindActiveUsers.service.ts`, `FindActiveUsersService`, handler `findActiveUsersController`, path `/find-active-users`.
- `--returns` accepts `list` (default), `one`, `void`; error `Invalid --returns "<value>". Use list, one, or void.`
- Standard-action output is byte-identical to the current templates. Every existing template test and the per-stack integration tests must pass unchanged in their assertions (only call signatures in the tests change).
- Markers are exactly `<!-- domain-driver:start -->` and `<!-- domain-driver:end -->`. Content outside markers is never touched. `init` twice in a row reports `unchanged` for all three files.
- Postinstall never throws and never sets a non-zero exit. Guard order: `CI`, global, `INIT_CWD`, consumer `package.json`, self-install.
- Never overwrite an existing generated file; the standard `⚠️  Skipping "<file>" — already exists` warning applies.
- Immutability: exported objects readonly and frozen; functions return new values. Files under 400 lines, functions under 50 lines.
- Tests: vitest, temp directories, mock only console. Coverage stays at or above 80 percent on all four thresholds.
- Commit after every task with a conventional message. Do not push. Build stays green after every commit.

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/naming.ts` | add `upperFirst`, `toKebabCase` |
| `src/templates/actions.ts` | `ACTIONS`, `WRITE_ACTIONS`, `ActionSpec`, `HttpMethod`, `ReturnKind`, `RETURN_KINDS`, `actionCase`, `standardAction`, `standardActions`, `customAction` |
| `src/templates/signatures.ts` | `domainImports(ctx, fromFile, spec, entity)` only |
| `src/templates/controllers/shape.ts` | `schemaImport`, `serviceImport`, `controllerImports`, `callArgs`, all spec-driven |
| `src/templates/controllers/{express,fastify,hono,generic,nest,node}.ts` | controller templates taking `ActionSpec`; `node.ts` adds `renderNodeRouteLine` |
| `src/templates/controllers/next-route.ts` | unchanged output; calls spec-driven imports |
| `src/templates/controllers/next-action-route.ts` | single-handler route for a custom action |
| `src/templates/service.ts`, `frontend/client-repository.ts`, `backend/server-repository.ts` | spec-driven |
| `src/templates/shared/schema.ts`, `nest/dto.ts` | take a bare name |
| `src/commands/write.ts` | add `writeSpecFiles` |
| `src/commands/target.ts` | `parseTarget`, `parseFeatureTarget` |
| `src/commands/action.ts` | `makeAction`, `parseReturns` |
| `src/commands/feature.ts` | optional explicit entity |
| `src/init/markers.ts` | `START`, `END`, `applySection` |
| `src/init/content.ts` | `AGENTS_SECTION`, `SKILL_CONTENT` |
| `src/init/init.ts` | `runInit(root)` |
| `src/postinstall.ts` | `shouldRunPostinstall`, `readPackageName`, `run` |
| `scripts/postinstall.js` | committed shim, never fails |
| `src/index.ts` | target parsing, `make:action`, `init`, hook skip |

---

### Task 1: ActionSpec, standard specs, custom specs

**Files:**
- Modify: `src/utils/naming.ts`
- Modify: `src/templates/actions.ts`
- Test: `src/utils/__tests__/naming.test.ts` (extend)
- Test: `src/templates/__tests__/actions.test.ts`

**Interfaces:**
- Produces: `upperFirst(name)`, `toKebabCase(name)`; `HttpMethod`, `ReturnKind`, `RETURN_KINDS`, `ActionSpec`, `ActionCase`, `CustomActionOptions`, `actionCase(name)`, `standardAction(action, entity)`, `standardActions(entity)`, `customAction(entity, actionName, options)`. Nothing existing changes shape; `ACTIONS`, `Action`, `WRITE_ACTIONS`, `WriteAction` stay.

- [ ] **Step 1: Write the failing naming tests**

Append to `src/utils/__tests__/naming.test.ts` (add `upperFirst, toKebabCase` to the import):

```ts
describe('upperFirst', () => {
    it('uppercases the first character only', () => {
        expect(upperFirst('findActiveUsers')).toBe('FindActiveUsers');
        expect(upperFirst('')).toBe('');
    });
});

describe('toKebabCase', () => {
    it.each([
        ['FindActiveUsers', 'find-active-users'],
        ['findActiveUsers', 'find-active-users'],
        ['archiveUser', 'archive-user'],
        ['ExportCSV', 'export-csv'],
        ['ParseHTMLDoc', 'parse-html-doc'],
        ['List', 'list'],
    ])('converts %s to %s', (input, expected) => {
        expect(toKebabCase(input)).toBe(expected);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/utils/__tests__/naming.test.ts`
Expected: FAIL with "upperFirst is not a function" (or the import failing)

- [ ] **Step 3: Add the two helpers**

Append to `src/utils/naming.ts`:

```ts
export function upperFirst(name: string): string {
    return name.charAt(0).toUpperCase() + name.slice(1);
}

export function toKebabCase(name: string): string {
    return name
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
        .toLowerCase();
}
```

- [ ] **Step 4: Run the naming tests to verify they pass**

Run: `npx vitest run src/utils/__tests__/naming.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing action spec tests**

```ts
// src/templates/__tests__/actions.test.ts
import { describe, it, expect } from 'vitest';
import { actionCase, customAction, standardAction, standardActions, RETURN_KINDS } from '../actions';

describe('actionCase', () => {
    it('normalises camelCase and PascalCase', () => {
        expect(actionCase('findActiveUsers')).toEqual({
            pascal: 'FindActiveUsers',
            camel: 'findActiveUsers',
            slug: 'find-active-users',
        });
        expect(actionCase('FindActiveUsers').camel).toBe('findActiveUsers');
    });

    it.each(['find-active-users', 'find_active', 'find active', '1st', ''])('rejects %s', (name) => {
        expect(() => actionCase(name)).toThrow(
            `Action name "${name}" must be camelCase or PascalCase, for example findActiveUsers.`
        );
    });
});

describe('standardAction', () => {
    it('List', () => {
        expect(standardAction('List', 'Cat')).toEqual({
            name: 'ListCat',
            handler: 'listCatController',
            params: '',
            args: '',
            returns: 'Promise<Cat[]>',
            usesEntityType: true,
            schema: null,
            usesId: false,
            status: 200,
            method: 'get',
            path: '/',
            failure: 'Failed to fetch Cat list',
        });
    });

    it('Show', () => {
        expect(standardAction('Show', 'Cat')).toEqual({
            name: 'ShowCat',
            handler: 'showCatController',
            params: 'id: string',
            args: 'id',
            returns: 'Promise<Cat>',
            usesEntityType: true,
            schema: null,
            usesId: true,
            status: 200,
            method: 'get',
            path: '/:id',
            failure: 'Failed to fetch Cat',
        });
    });

    it('Create', () => {
        expect(standardAction('Create', 'Cat')).toEqual({
            name: 'CreateCat',
            handler: 'createCatController',
            params: 'data: CreateCat',
            args: 'data',
            returns: 'Promise<Cat>',
            usesEntityType: true,
            schema: 'CreateCat',
            usesId: false,
            status: 201,
            method: 'post',
            path: '/',
            failure: 'Failed to create Cat',
        });
    });

    it('Update', () => {
        expect(standardAction('Update', 'Cat')).toEqual({
            name: 'UpdateCat',
            handler: 'updateCatController',
            params: 'id: string, data: UpdateCat',
            args: 'id, data',
            returns: 'Promise<Cat>',
            usesEntityType: true,
            schema: 'UpdateCat',
            usesId: true,
            status: 200,
            method: 'put',
            path: '/:id',
            failure: 'Failed to update Cat',
        });
    });

    it('Delete', () => {
        expect(standardAction('Delete', 'Cat')).toEqual({
            name: 'DeleteCat',
            handler: 'deleteCatController',
            params: 'id: string',
            args: 'id',
            returns: 'Promise<void>',
            usesEntityType: false,
            schema: null,
            usesId: true,
            status: 204,
            method: 'delete',
            path: '/:id',
            failure: 'Failed to delete Cat',
        });
    });

    it('standardActions returns the five in order, frozen', () => {
        const specs = standardActions('Cat');
        expect(specs.map((spec) => spec.name)).toEqual(['ListCat', 'ShowCat', 'CreateCat', 'UpdateCat', 'DeleteCat']);
        expect(specs.every((spec) => Object.isFrozen(spec))).toBe(true);
    });
});

describe('customAction', () => {
    it('no input, list', () => {
        expect(customAction('User', 'findActiveUsers', { withInput: false, returns: 'list' })).toEqual({
            name: 'FindActiveUsers',
            handler: 'findActiveUsersController',
            params: '',
            args: '',
            returns: 'Promise<User[]>',
            usesEntityType: true,
            schema: null,
            usesId: false,
            status: 200,
            method: 'get',
            path: '/find-active-users',
            failure: 'Failed to findActiveUsers User',
        });
    });

    it('with input, one', () => {
        expect(customAction('User', 'archiveUser', { withInput: true, returns: 'one' })).toEqual({
            name: 'ArchiveUser',
            handler: 'archiveUserController',
            params: 'data: ArchiveUser',
            args: 'data',
            returns: 'Promise<User>',
            usesEntityType: true,
            schema: 'ArchiveUser',
            usesId: false,
            status: 200,
            method: 'post',
            path: '/archive-user',
            failure: 'Failed to archiveUser User',
        });
    });

    it('no input, void', () => {
        const spec = customAction('User', 'purgeUsers', { withInput: false, returns: 'void' });
        expect(spec.returns).toBe('Promise<void>');
        expect(spec.usesEntityType).toBe(false);
        expect(spec.status).toBe(204);
        expect(spec.method).toBe('get');
    });

    it('with input, void', () => {
        const spec = customAction('User', 'notifyUsers', { withInput: true, returns: 'void' });
        expect(spec.status).toBe(204);
        expect(spec.method).toBe('post');
        expect(spec.schema).toBe('NotifyUsers');
    });

    it('lists the return kinds', () => {
        expect(RETURN_KINDS).toEqual(['list', 'one', 'void']);
    });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run src/templates/__tests__/actions.test.ts`
Expected: FAIL with "actionCase is not a function" (or import errors)

- [ ] **Step 7: Rewrite actions.ts**

```ts
// src/templates/actions.ts
import { lowerFirst, toKebabCase, upperFirst } from '../utils/naming';

export const ACTIONS = ['List', 'Show', 'Create', 'Update', 'Delete'] as const;
export type Action = (typeof ACTIONS)[number];

export const WRITE_ACTIONS = ['Create', 'Update'] as const;
export type WriteAction = (typeof WRITE_ACTIONS)[number];

export type HttpMethod = 'get' | 'post' | 'put' | 'delete';

export const RETURN_KINDS = ['list', 'one', 'void'] as const;
export type ReturnKind = (typeof RETURN_KINDS)[number];

export interface ActionSpec {
    readonly name: string;
    readonly handler: string;
    readonly params: string;
    readonly args: string;
    readonly returns: string;
    readonly usesEntityType: boolean;
    readonly schema: string | null;
    readonly usesId: boolean;
    readonly status: number;
    readonly method: HttpMethod;
    readonly path: string;
    readonly failure: string;
}

export interface ActionCase {
    readonly pascal: string;
    readonly camel: string;
    readonly slug: string;
}

export interface CustomActionOptions {
    readonly withInput: boolean;
    readonly returns: ReturnKind;
}

const ACTION_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;

export function actionCase(name: string): ActionCase {
    if (!ACTION_NAME_PATTERN.test(name)) {
        throw new Error(`Action name "${name}" must be camelCase or PascalCase, for example findActiveUsers.`);
    }
    const pascal = upperFirst(name);
    return Object.freeze({ pascal, camel: lowerFirst(pascal), slug: toKebabCase(pascal) });
}

function freeze(spec: ActionSpec): ActionSpec {
    return Object.freeze(spec);
}

function returnType(kind: ReturnKind, entity: string): string {
    switch (kind) {
        case 'list':
            return `Promise<${entity}[]>`;
        case 'one':
            return `Promise<${entity}>`;
        case 'void':
            return 'Promise<void>';
    }
}

export function standardAction(action: Action, entity: string): ActionSpec {
    const name = `${action}${entity}`;
    const handler = `${lowerFirst(action)}${entity}Controller`;
    switch (action) {
        case 'List':
            return freeze({ name, handler, params: '', args: '', returns: `Promise<${entity}[]>`, usesEntityType: true, schema: null, usesId: false, status: 200, method: 'get', path: '/', failure: `Failed to fetch ${entity} list` });
        case 'Show':
            return freeze({ name, handler, params: 'id: string', args: 'id', returns: `Promise<${entity}>`, usesEntityType: true, schema: null, usesId: true, status: 200, method: 'get', path: '/:id', failure: `Failed to fetch ${entity}` });
        case 'Create':
            return freeze({ name, handler, params: `data: ${name}`, args: 'data', returns: `Promise<${entity}>`, usesEntityType: true, schema: name, usesId: false, status: 201, method: 'post', path: '/', failure: `Failed to create ${entity}` });
        case 'Update':
            return freeze({ name, handler, params: `id: string, data: ${name}`, args: 'id, data', returns: `Promise<${entity}>`, usesEntityType: true, schema: name, usesId: true, status: 200, method: 'put', path: '/:id', failure: `Failed to update ${entity}` });
        case 'Delete':
            return freeze({ name, handler, params: 'id: string', args: 'id', returns: 'Promise<void>', usesEntityType: false, schema: null, usesId: true, status: 204, method: 'delete', path: '/:id', failure: `Failed to delete ${entity}` });
    }
}

export function standardActions(entity: string): readonly ActionSpec[] {
    return ACTIONS.map((action) => standardAction(action, entity));
}

export function customAction(entity: string, actionName: string, options: CustomActionOptions): ActionSpec {
    const { pascal, camel, slug } = actionCase(actionName);
    return freeze({
        name: pascal,
        handler: `${camel}Controller`,
        params: options.withInput ? `data: ${pascal}` : '',
        args: options.withInput ? 'data' : '',
        returns: returnType(options.returns, entity),
        usesEntityType: options.returns !== 'void',
        schema: options.withInput ? pascal : null,
        usesId: false,
        status: options.returns === 'void' ? 204 : 200,
        method: options.withInput ? 'post' : 'get',
        path: `/${slug}`,
        failure: `Failed to ${camel} ${entity}`,
    });
}
```

- [ ] **Step 8: Run all tests and the build**

Run: `npx vitest run && npm run build`
Expected: PASS (existing suites untouched), build succeeds

- [ ] **Step 9: Commit**

```bash
git add src/utils/naming.ts src/utils/__tests__/naming.test.ts src/templates/actions.ts src/templates/__tests__/actions.test.ts
git commit -m "feat: add ActionSpec with standard and custom action specs"
```

---

### Task 2: Spec-driven data templates (service, repositories, schema, DTO)

**Files:**
- Modify: `src/templates/signatures.ts`, `src/templates/service.ts`, `src/templates/frontend/client-repository.ts`, `src/templates/backend/server-repository.ts`, `src/templates/shared/schema.ts`, `src/templates/nest/dto.ts`
- Modify: `src/commands/write.ts`, `src/commands/service.ts`, `src/commands/repository.ts`, `src/commands/schema.ts`
- Test: `src/templates/__tests__/signatures.test.ts`, `src/templates/__tests__/data-layers.test.ts`, `src/templates/__tests__/shared.test.ts`, `src/templates/__tests__/nest.test.ts` (DTO cases only)

**Interfaces:**
- Consumes: `ActionSpec`, `standardAction`, `standardActions` (Task 1).
- Produces: `domainImports(ctx, fromFile, spec, entity)`; `renderService(ctx, spec, entity, fromFile, side)`; `renderClientRepository(ctx, spec, entity, fromFile)`; `renderServerRepository(ctx, spec, entity, fromFile)`; `renderSchema(name, label)`; `renderDto(ctx, name, fromFile)`; `writeSpecFiles(dir, specs, suffix, render)`.
- Controller templates keep the old `Action` signatures until Task 3; they still import `actionSignature` and `controllerShape`, so those two functions stay exported from `signatures.ts` and `shape.ts` **until Task 3 removes them**.

- [ ] **Step 1: Update the test signatures (they must fail first)**

In `src/templates/__tests__/signatures.test.ts`, delete the `actionSignature` describe block, change the import to `import { domainImports } from '../signatures'; import { standardAction } from '../actions';`, and change each `domainImports(ctx, fromFile, 'Create', 'Cat')` to `domainImports(ctx, fromFile, standardAction('Create', 'Cat'), 'Cat')` (same for `'Delete'` and `'List'`). Assertions unchanged.

In `src/templates/__tests__/data-layers.test.ts`, add `import { standardAction } from '../actions';` and change every call: `renderService(ctx, 'Create', 'Cat', fromFile, 'client')` becomes `renderService(ctx, standardAction('Create', 'Cat'), 'Cat', fromFile, 'client')`; `renderClientRepository(ctx, 'Create', 'CoffeeType', fromFile)` becomes `renderClientRepository(ctx, standardAction('Create', 'CoffeeType'), 'CoffeeType', fromFile)`; `renderServerRepository(ctx, 'Create', 'Cat', fromFile)` becomes `renderServerRepository(ctx, standardAction('Create', 'Cat'), 'Cat', fromFile)`. Apply to every action used in the file. Assertions unchanged.

In `src/templates/__tests__/shared.test.ts`, change `renderSchema('Create', 'Cat')` to `renderSchema('CreateCat', 'create')` and `renderSchema('Update', 'Cat')` to `renderSchema('UpdateCat', 'update')`. Add one assertion to the Create case: `expect(content).toContain('// add create fields here');`.

In `src/templates/__tests__/nest.test.ts`, change `renderDto(ctx(), 'Create', 'CoffeeType', fromFile)` to `renderDto(ctx(), 'CreateCoffeeType', fromFile)`. Leave the controller and module cases untouched.

Add to `data-layers.test.ts` a custom-action block:

```ts
describe('custom action specs through the data templates', () => {
    it('client repository GETs the slug path and returns json', () => {
        const ctx = contextFor('react', 'users');
        const spec = customAction('User', 'findActiveUsers', { withInput: false, returns: 'list' });
        const fromFile = path.join(ctx.featureDir, 'repositories', 'FindActiveUsers.repository.ts');
        const content = renderClientRepository(ctx, spec, 'User', fromFile);
        expect(content).toContain("import { User } from '../types/User.types';");
        expect(content).toContain('export class FindActiveUsersRepository {');
        expect(content).toContain('async handle(): Promise<User[]> {');
        expect(content).toContain("const response = await fetch('/api/users/find-active-users');");
        expect(content).toContain("throw new Error('Failed to findActiveUsers User');");
        expect(content).toContain('return response.json();');
    });

    it('client repository POSTs a body and returns nothing for void', () => {
        const ctx = contextFor('react', 'users');
        const spec = customAction('User', 'notifyUsers', { withInput: true, returns: 'void' });
        const fromFile = path.join(ctx.featureDir, 'repositories', 'NotifyUsers.repository.ts');
        const content = renderClientRepository(ctx, spec, 'User', fromFile);
        expect(content).toContain("import { NotifyUsers } from '../schemas/NotifyUsers.schema';");
        expect(content).not.toContain('types/User.types');
        expect(content).toContain("const response = await fetch('/api/users/notify-users', {");
        expect(content).toContain("method: 'POST',");
        expect(content).toContain('body: JSON.stringify(data),');
        expect(content).not.toContain('return response.json()');
    });

    it('server repository and service use the action name without the entity', () => {
        const ctx = contextFor('nest', 'users');
        const spec = customAction('User', 'archiveUser', { withInput: true, returns: 'one' });
        const repo = renderServerRepository(ctx, spec, 'User', path.join(ctx.featureDir, 'repositories', 'ArchiveUser.repository.ts'));
        expect(repo).toContain('@Injectable()\nexport class ArchiveUserRepository {');
        expect(repo).toContain('async handle(data: ArchiveUser): Promise<User> {');
        const service = renderService(ctx, spec, 'User', path.join(ctx.featureDir, 'services', 'ArchiveUser.service.ts'), 'server');
        expect(service).toContain("import { ArchiveUserRepository } from '../repositories/ArchiveUser.repository';");
        expect(service).toContain('constructor(private readonly repository: ArchiveUserRepository) {}');
    });
});
```

(add `customAction` to the `../actions` import in that file).

- [ ] **Step 2: Run the affected tests to verify they fail**

Run: `npx vitest run src/templates/__tests__/signatures.test.ts src/templates/__tests__/data-layers.test.ts src/templates/__tests__/shared.test.ts src/templates/__tests__/nest.test.ts`
Expected: FAIL (type errors or wrong output because the templates still take `Action` strings)

- [ ] **Step 3: Rewrite signatures.ts (keep `actionSignature` for Task 3's consumers)**

```ts
// src/templates/signatures.ts
import { Action, ActionSpec, standardAction } from './actions';
import { RenderContext } from './context';

export interface ActionSignature {
    readonly params: string;
    readonly args: string;
    readonly returns: string;
    readonly usesEntityType: boolean;
    readonly usesSchema: boolean;
}

/** @deprecated removed in the controller refactor; use ActionSpec */
export function actionSignature(action: Action, entity: string): ActionSignature {
    const spec = standardAction(action, entity);
    return { params: spec.params, args: spec.args, returns: spec.returns, usesEntityType: spec.usesEntityType, usesSchema: spec.schema !== null };
}

export function domainImports(
    ctx: RenderContext,
    fromFile: string,
    spec: ActionSpec,
    entity: string
): readonly string[] {
    const lines: string[] = [];

    if (spec.usesEntityType) {
        const typePath = ctx.importLayer(fromFile, 'types', `${entity}.types`);
        lines.push(`import { ${entity} } from '${typePath}';`);
    }
    if (spec.schema !== null) {
        const schemaPath = ctx.importLayer(fromFile, 'schema', `${spec.schema}.schema`);
        lines.push(`import { ${spec.schema} } from '${schemaPath}';`);
    }
    return lines;
}
```

- [ ] **Step 4: Rewrite service.ts**

```ts
// src/templates/service.ts
import { Side } from '../stack/types';
import { ActionSpec } from './actions';
import { RenderContext } from './context';
import { domainImports } from './signatures';

const INJECTABLE_IMPORT = "import { Injectable } from '@nestjs/common';";

export function renderService(
    ctx: RenderContext,
    spec: ActionSpec,
    entity: string,
    fromFile: string,
    side: Side
): string {
    const repositoryClass = `${spec.name}Repository`;
    const serviceClass = `${spec.name}Service`;
    const repositoryLayer = side === 'client' ? 'clientRepository' : 'serverRepository';
    const repositoryPath = ctx.importLayer(fromFile, repositoryLayer, `${spec.name}.repository`);
    const injectable = side === 'server' && ctx.profile.name === 'nest';

    const imports = [
        ...(injectable ? [INJECTABLE_IMPORT] : []),
        ...domainImports(ctx, fromFile, spec, entity),
        `import { ${repositoryClass} } from '${repositoryPath}';`,
    ].join('\n');

    if (injectable) {
        return `${imports}

@Injectable()
export class ${serviceClass} {
  constructor(private readonly repository: ${repositoryClass}) {}

  async handle(${spec.params}): ${spec.returns} {
    return this.repository.handle(${spec.args});
  }
}
`;
    }

    return `${imports}

const repository = new ${repositoryClass}();

export class ${serviceClass} {
  async handle(${spec.params}): ${spec.returns} {
    return repository.handle(${spec.args});
  }
}
`;
}
```

- [ ] **Step 5: Rewrite the client repository as a spec-driven template**

```ts
// src/templates/frontend/client-repository.ts
import { ActionSpec } from '../actions';
import { RenderContext } from '../context';
import { domainImports } from '../signatures';

const JSON_HEADERS = "headers: { 'Content-Type': 'application/json' },";

function fetchUrl(spec: ActionSpec, base: string): string {
    if (spec.path === '/') return `'${base}'`;
    return `\`${base}${spec.path.replace(':id', '${id}')}\``;
}

function fetchCall(spec: ActionSpec, base: string): string {
    const url = fetchUrl(spec, base);
    if (spec.method === 'get') return url;
    const method = spec.method.toUpperCase();
    if (spec.schema === null) {
        return `${url}, {
      method: '${method}',
    }`;
    }
    return `${url}, {
      method: '${method}',
      ${JSON_HEADERS}
      body: JSON.stringify(data),
    }`;
}

export function renderClientRepository(
    ctx: RenderContext,
    spec: ActionSpec,
    entity: string,
    fromFile: string
): string {
    const imports = domainImports(ctx, fromFile, spec, entity).join('\n');
    const header = imports ? `${imports}\n\n` : '';
    const returnLine = spec.returns === 'Promise<void>' ? '' : '    return response.json();\n';

    return `${header}export class ${spec.name}Repository {
  async handle(${spec.params}): ${spec.returns} {
    const response = await fetch(${fetchCall(spec, `/api/${ctx.feature}`)});
    if (!response.ok) throw new Error('${spec.failure}');
${returnLine}  }
}
`;
}
```

Byte-identity check against the old template, action by action: List `fetch('/api/cat')`; Show `` fetch(`/api/cat/${id}`) ``; Create `fetch('/api/cat', {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify(data),\n    })`; Update the same with PUT and the id URL; Delete `` fetch(`/api/cat/${id}`, {\n      method: 'DELETE',\n    }) `` with no return line. These match the old switch cases exactly.

- [ ] **Step 6: Rewrite the server repository, schema, and DTO templates**

```ts
// src/templates/backend/server-repository.ts
import { ActionSpec } from '../actions';
import { RenderContext } from '../context';
import { domainImports } from '../signatures';

const INJECTABLE_IMPORT = "import { Injectable } from '@nestjs/common';";

export function renderServerRepository(
    ctx: RenderContext,
    spec: ActionSpec,
    entity: string,
    fromFile: string
): string {
    const cls = `${spec.name}Repository`;
    const injectable = ctx.profile.name === 'nest';
    const imports = [
        ...(injectable ? [INJECTABLE_IMPORT] : []),
        ...domainImports(ctx, fromFile, spec, entity),
    ].join('\n');
    const header = imports ? `${imports}\n\n` : '';
    const decorator = injectable ? '@Injectable()\n' : '';

    return `${header}${decorator}export class ${cls} {
  async handle(${spec.params}): ${spec.returns} {
    // TODO: implement with your ORM (Prisma, Drizzle, TypeORM, ...)
    throw new Error('${cls}.handle is not implemented');
  }
}
`;
}
```

```ts
// src/templates/shared/schema.ts
export function renderSchema(name: string, label: string): string {
    return `import { z } from 'zod';

export const ${name}Schema = z.object({
  // add ${label} fields here
});

export type ${name} = z.infer<typeof ${name}Schema>;
`;
}
```

```ts
// src/templates/nest/dto.ts
import { RenderContext } from '../context';

export function renderDto(ctx: RenderContext, name: string, fromFile: string): string {
    const schemaName = `${name}Schema`;
    const schemaPath = ctx.importLayer(fromFile, 'schema', `${name}.schema`);
    return `import { createZodDto } from 'nestjs-zod';
import { ${schemaName} } from '${schemaPath}';

export class ${name}Dto extends createZodDto(${schemaName}) {}
`;
}
```

- [ ] **Step 7: Add `writeSpecFiles` and update the three commands**

Append to `src/commands/write.ts` (add `ActionSpec` to the import from `../templates/actions`):

```ts
export function writeSpecFiles(
    dir: string,
    specs: readonly ActionSpec[],
    suffix: string,
    render: (spec: ActionSpec, filePath: string) => string
): void {
    for (const spec of specs) {
        const filePath = path.join(dir, `${spec.name}.${suffix}.ts`);
        writeIfAbsent(filePath, () => render(spec, filePath));
    }
}
```

```ts
// src/commands/service.ts
import { SideOption } from '../stack/types';
import { standardActions } from '../templates/actions';
import { renderService } from '../templates/service';
import { ensureLayerDir, requireFeature } from './resolve';
import { resolveSides, SERVICE_SIDES } from './sides';
import { writeSpecFiles } from './write';

export function makeService(feature: string, name: string, side: SideOption = 'both'): void {
    const ctx = requireFeature(feature);

    for (const current of resolveSides(ctx.profile, side, SERVICE_SIDES)) {
        const dir = ensureLayerDir(ctx, SERVICE_SIDES[current]);
        writeSpecFiles(dir, standardActions(name), 'service', (spec, filePath) =>
            renderService(ctx, spec, name, filePath, current)
        );
        console.log(`✅ Services (${current}) for "${name}" created at ${dir}`);
    }
}
```

```ts
// src/commands/repository.ts
import { SideOption } from '../stack/types';
import { standardActions } from '../templates/actions';
import { renderServerRepository } from '../templates/backend/server-repository';
import { renderClientRepository } from '../templates/frontend/client-repository';
import { ensureLayerDir, requireFeature } from './resolve';
import { REPOSITORY_SIDES, resolveSides } from './sides';
import { writeSpecFiles } from './write';

export function makeRepository(feature: string, name: string, side: SideOption = 'both'): void {
    const ctx = requireFeature(feature);

    for (const current of resolveSides(ctx.profile, side, REPOSITORY_SIDES)) {
        const dir = ensureLayerDir(ctx, REPOSITORY_SIDES[current]);
        const render = current === 'client' ? renderClientRepository : renderServerRepository;
        writeSpecFiles(dir, standardActions(name), 'repository', (spec, filePath) =>
            render(ctx, spec, name, filePath)
        );
        console.log(`✅ Repositories (${current}) for "${name}" created at ${dir}`);
    }
}
```

In `src/commands/schema.ts` change the two render calls only:

```ts
    writeActionFiles(schemaDir, name, 'schema', WRITE_ACTIONS, (action) =>
        renderSchema(`${action}${name}`, action.toLowerCase())
    );
```

```ts
    writeActionFiles(dtoDir, name, 'dto', WRITE_ACTIONS, (action, filePath) =>
        renderDto(ctx, `${action}${name}`, filePath)
    );
```

- [ ] **Step 8: Run the affected tests, then everything**

Run: `npx vitest run src/templates/__tests__/signatures.test.ts src/templates/__tests__/data-layers.test.ts src/templates/__tests__/shared.test.ts src/templates/__tests__/nest.test.ts`
Expected: PASS

Run: `npx vitest run && npm run build`
Expected: PASS. In particular `src/commands/__tests__/stacks.test.ts` (exact file trees and import walks) and `data-commands.test.ts` pass unchanged, proving the standard output did not move.

- [ ] **Step 9: Commit**

```bash
git add src/templates src/commands
git commit -m "refactor: drive service, repository, schema, and DTO templates from ActionSpec"
```

---

### Task 3: Spec-driven controller templates and the custom-action Next route

**Files:**
- Modify: `src/templates/controllers/shape.ts`, `express.ts`, `fastify.ts`, `hono.ts`, `generic.ts`, `nest.ts`, `node.ts`, `next-route.ts`
- Create: `src/templates/controllers/next-action-route.ts`
- Modify: `src/templates/signatures.ts` (remove `actionSignature`), `src/commands/controller.ts`
- Test: `src/templates/__tests__/node-controllers.test.ts`, `src/templates/__tests__/nest.test.ts`, `src/templates/__tests__/next-route.test.ts`, `src/templates/__tests__/signatures.test.ts` (drop the deprecated import if any)

**Interfaces:**
- Consumes: `ActionSpec`, `standardAction`, `standardActions`, `customAction`, `Action`, `HttpMethod` (Task 1); `domainImports` (Task 2); `lowerFirst`.
- Produces: `schemaImport(ctx, fromFile, schemaName: string)`, `serviceImport(ctx, fromFile, spec)`, `controllerImports(ctx, fromFile, entity)`, `callArgs(spec, idExpression, bodyExpression)`; `renderExpressController(ctx, spec, fromFile)`, `renderFastifyController(ctx, spec, fromFile)`, `renderHonoController(ctx, spec, fromFile)` (no entity parameter, they never used it), `renderGenericController(ctx, spec, entity, fromFile)`, `renderNestController(ctx, spec, entity, fromFile)`, `renderNodeController(ctx, spec, entity, fromFile)`, `renderNodeRoutes(ctx, entity, fromFile)` (unchanged), `renderNodeRouteLine(ctx, spec, entity): string | null`, `renderActionRoute(ctx, spec, fromFile)`. Routes templates keep their signatures.

- [ ] **Step 1: Update the controller tests to the spec API and add custom-action cases (they must fail first)**

In `src/templates/__tests__/node-controllers.test.ts`:

- Replace the imports of `controllerShape, handlerName` with `import { callArgs } from '../controllers/shape'; import { customAction, standardAction } from '../actions';`.
- Replace the whole `describe('controllerShape', ...)` block with:

```ts
describe('callArgs', () => {
    it('joins id and body expressions by what the spec uses', () => {
        expect(callArgs(standardAction('List', 'Cat'), 'ID', 'BODY')).toBe('');
        expect(callArgs(standardAction('Show', 'Cat'), 'ID', 'BODY')).toBe('ID');
        expect(callArgs(standardAction('Create', 'Cat'), 'ID', 'BODY')).toBe('BODY');
        expect(callArgs(standardAction('Update', 'Cat'), 'ID', 'BODY')).toBe('ID, BODY');
    });
});
```

- Every `renderExpressController(ctx(), 'Create', 'Cat', controllerFile(ctx(), 'Create'))` becomes `renderExpressController(ctx(), standardAction('Create', 'Cat'), controllerFile(ctx(), 'Create'))`; the same shape for Fastify and Hono (three arguments). `renderGenericController(ctx(), 'Create', 'Cat', file)` becomes `renderGenericController(ctx(), standardAction('Create', 'Cat'), 'Cat', file)`. `renderNodeController(express, 'List', 'Cat', file)` becomes `renderNodeController(express, standardAction('List', 'Cat'), 'Cat', file)`. All existing assertions stay exactly as they are.
- Append this block:

```ts
describe('custom action specs through the controller templates', () => {
    const findActive = customAction('User', 'findActiveUsers', { withInput: false, returns: 'list' });
    const archive = customAction('User', 'archiveUser', { withInput: true, returns: 'one' });
    const purge = customAction('User', 'purgeUsers', { withInput: false, returns: 'void' });

    it('express GET with no id and no body', () => {
        const ctx = contextFor('node', 'users', { httpFramework: 'express' });
        const content = renderExpressController(ctx, findActive, path.join(ctx.featureDir, 'controllers', 'FindActiveUsers.controller.ts'));
        expect(content).toContain("import { FindActiveUsersService } from '../services/FindActiveUsers.service';");
        expect(content).not.toContain('Schema');
        expect(content).toContain('export async function findActiveUsersController(_req: Request, res: Response, next: NextFunction): Promise<void> {');
        expect(content).toContain('res.status(200).json(await service.handle());');
    });

    it('express POST validates the body and responds 200', () => {
        const ctx = contextFor('node', 'users', { httpFramework: 'express' });
        const content = renderExpressController(ctx, archive, path.join(ctx.featureDir, 'controllers', 'ArchiveUser.controller.ts'));
        expect(content).toContain("import { ArchiveUserSchema } from '../schemas/ArchiveUser.schema';");
        expect(content).toContain('const parsed = ArchiveUserSchema.safeParse(req.body);');
        expect(content).toContain('res.status(200).json(await service.handle(parsed.data));');
    });

    it('hono void returns 204 with a plain Context', () => {
        const ctx = contextFor('node', 'users', { httpFramework: 'hono' });
        const content = renderHonoController(ctx, purge, path.join(ctx.featureDir, 'controllers', 'PurgeUsers.controller.ts'));
        expect(content).toContain('export async function purgeUsersController(c: Context): Promise<Response> {');
        expect(content).toContain('await service.handle();');
        expect(content).toContain('return c.body(null, 204);');
    });

    it('generic controller parses input for a custom action', () => {
        const ctx = contextFor('node', 'users');
        const content = renderGenericController(ctx, archive, 'User', path.join(ctx.featureDir, 'controllers', 'ArchiveUser.controller.ts'));
        expect(content).toContain('export class ArchiveUserController {');
        expect(content).toContain('async handle(input: unknown): Promise<User> {');
        expect(content).toContain('return service.handle(ArchiveUserSchema.parse(input));');
    });

    it('route lines per framework', () => {
        expect(renderNodeRouteLine(contextFor('node', 'users', { httpFramework: 'express' }), findActive, 'User')).toBe(
            "router.get('/find-active-users', findActiveUsersController);"
        );
        expect(renderNodeRouteLine(contextFor('node', 'users', { httpFramework: 'fastify' }), archive, 'User')).toBe(
            "app.post('/archive-user', archiveUserController);"
        );
        expect(renderNodeRouteLine(contextFor('node', 'users', { httpFramework: 'hono' }), purge, 'User')).toBe(
            "user.get('/purge-users', purgeUsersController);"
        );
        expect(renderNodeRouteLine(contextFor('node', 'users'), findActive, 'User')).toBeNull();
    });
});
```

(add `renderNodeRouteLine` to the `../controllers/node` import).

In `src/templates/__tests__/nest.test.ts`, add `import { customAction, standardAction } from '../actions';`, change every `renderNestController(ctx(), 'Create', 'CoffeeType', controllerFile('Create'))` to `renderNestController(ctx(), standardAction('Create', 'CoffeeType'), 'CoffeeType', controllerFile('Create'))` (all five), keep the assertions, and append:

```ts
describe('renderNestController for custom actions', () => {
    it('POST returning 200 sets HttpCode explicitly', () => {
        const spec = customAction('CoffeeType', 'archiveCoffeeType', { withInput: true, returns: 'one' });
        const content = renderNestController(ctx(), spec, 'CoffeeType', controllerFile('Archive'));
        expect(content).toContain("import { Body, Controller, HttpCode, Post } from '@nestjs/common';");
        expect(content).toContain("import { ArchiveCoffeeTypeDto } from '../dto/ArchiveCoffeeType.dto';");
        expect(content).toContain('export class ArchiveCoffeeTypeController {');
        expect(content).toContain("@Post('archive-coffee-type')\n  @HttpCode(200)");
        expect(content).toContain('handle(@Body() body: ArchiveCoffeeTypeDto): Promise<CoffeeType> {');
    });

    it('GET returning a list needs no HttpCode', () => {
        const spec = customAction('CoffeeType', 'findActive', { withInput: false, returns: 'list' });
        const content = renderNestController(ctx(), spec, 'CoffeeType', controllerFile('FindActive'));
        expect(content).toContain("import { Controller, Get } from '@nestjs/common';");
        expect(content).toContain("@Get('find-active')\n  handle(): Promise<CoffeeType[]> {");
    });

    it('GET returning void sets 204', () => {
        const spec = customAction('CoffeeType', 'purge', { withInput: false, returns: 'void' });
        const content = renderNestController(ctx(), spec, 'CoffeeType', controllerFile('Purge'));
        expect(content).toContain("@Get('purge')\n  @HttpCode(204)");
        expect(content).not.toContain('types/CoffeeType.types');
    });
});
```

In `src/templates/__tests__/next-route.test.ts`, add `import { renderActionRoute } from '../controllers/next-action-route'; import { customAction } from '../actions';` and append:

```ts
describe('renderActionRoute', () => {
    it('GET list', () => {
        const ctx = contextFor('next-fullstack', 'users');
        const spec = customAction('User', 'findActiveUsers', { withInput: false, returns: 'list' });
        const fromFile = path.join(apiRouteDir(ctx.stack, 'users'), 'find-active-users', 'route.ts');
        const content = renderActionRoute(ctx, spec, fromFile);
        expect(content).toContain("import { FindActiveUsersService } from '../../../users/server/services/FindActiveUsers.service';");
        expect(content).not.toContain('Schema');
        expect(content).toContain('export async function GET(): Promise<NextResponse> {');
        expect(content).toContain('return NextResponse.json(await service.handle());');
    });

    it('POST with input returning one', () => {
        const ctx = contextFor('next-fullstack', 'users');
        const spec = customAction('User', 'archiveUser', { withInput: true, returns: 'one' });
        const fromFile = path.join(apiRouteDir(ctx.stack, 'users'), 'archive-user', 'route.ts');
        const content = renderActionRoute(ctx, spec, fromFile);
        expect(content).toContain("import { ArchiveUserSchema } from '../../../users/schemas/ArchiveUser.schema';");
        expect(content).toContain('export async function POST(request: Request): Promise<NextResponse> {');
        expect(content).toContain('const parsed = ArchiveUserSchema.safeParse(await request.json());');
        expect(content).toContain('return NextResponse.json(await service.handle(parsed.data));');
    });

    it('void returns an empty 204', () => {
        const ctx = contextFor('next-fullstack', 'users');
        const spec = customAction('User', 'purgeUsers', { withInput: false, returns: 'void' });
        const fromFile = path.join(apiRouteDir(ctx.stack, 'users'), 'purge-users', 'route.ts');
        const content = renderActionRoute(ctx, spec, fromFile);
        expect(content).toContain('export async function GET(): Promise<Response> {');
        expect(content).toContain('await service.handle();');
        expect(content).toContain('return new Response(null, { status: 204 });');
    });
});
```

- [ ] **Step 2: Run the three test files to verify they fail**

Run: `npx vitest run src/templates/__tests__/node-controllers.test.ts src/templates/__tests__/nest.test.ts src/templates/__tests__/next-route.test.ts`
Expected: FAIL (type errors on the new call shapes; missing modules)

- [ ] **Step 3: Rewrite shape.ts**

```ts
// src/templates/controllers/shape.ts
import { ActionSpec, standardActions } from '../actions';
import { RenderContext } from '../context';

export function schemaImport(ctx: RenderContext, fromFile: string, schemaName: string): string {
    const schemaPath = ctx.importLayer(fromFile, 'schema', `${schemaName}.schema`);
    return `import { ${schemaName}Schema } from '${schemaPath}';`;
}

export function serviceImport(ctx: RenderContext, fromFile: string, spec: ActionSpec): string {
    const servicePath = ctx.importLayer(fromFile, 'serverService', `${spec.name}.service`);
    return `import { ${spec.name}Service } from '${servicePath}';`;
}

export function controllerImports(ctx: RenderContext, fromFile: string, entity: string): string {
    return standardActions(entity)
        .map((spec) => {
            const controllerPath = ctx.importLayer(fromFile, 'controller', `${spec.name}.controller`);
            return `import { ${spec.handler} } from '${controllerPath}';`;
        })
        .join('\n');
}

export function callArgs(spec: ActionSpec, idExpression: string, bodyExpression: string): string {
    return [spec.usesId ? idExpression : null, spec.schema !== null ? bodyExpression : null]
        .filter((arg): arg is string => arg !== null)
        .join(', ');
}
```

- [ ] **Step 4: Rewrite the Express, Fastify, and Hono templates**

```ts
// src/templates/controllers/express.ts
import { lowerFirst } from '../../utils/naming';
import { Action, ActionSpec, standardAction } from '../actions';
import { RenderContext } from '../context';
import { callArgs, controllerImports, schemaImport, serviceImport } from './shape';

export function renderExpressController(ctx: RenderContext, spec: ActionSpec, fromFile: string): string {
    const imports = [
        "import { NextFunction, Request, Response } from 'express';",
        ...(spec.schema !== null ? [schemaImport(ctx, fromFile, spec.schema)] : []),
        serviceImport(ctx, fromFile, spec),
    ].join('\n');
    const reqName = spec.schema !== null || spec.usesId ? 'req' : '_req';
    const requestType = spec.usesId ? 'Request<{ id: string }>' : 'Request';
    const validate =
        spec.schema !== null
            ? `  const parsed = ${spec.schema}Schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten() });
    return;
  }
`
            : '';
    const args = callArgs(spec, 'req.params.id', 'parsed.data');
    const respond =
        spec.status === 204
            ? `    await service.handle(${args});
    res.status(204).send();`
            : `    res.status(${spec.status}).json(await service.handle(${args}));`;

    return `${imports}

const service = new ${spec.name}Service();

export async function ${spec.handler}(${reqName}: ${requestType}, res: Response, next: NextFunction): Promise<void> {
${validate}  try {
${respond}
  } catch (error) {
    next(error);
  }
}
`;
}

export function renderExpressRoutes(ctx: RenderContext, entity: string, fromFile: string): string {
    const name = lowerFirst(entity);
    const handler = (action: Action): string => standardAction(action, entity).handler;
    return `import { Router } from 'express';
${controllerImports(ctx, fromFile, entity)}

const router = Router();

router.get('/', ${handler('List')});
router.get('/:id', ${handler('Show')});
router.post('/', ${handler('Create')});
router.put('/:id', ${handler('Update')});
router.delete('/:id', ${handler('Delete')});

export default router;

// app.use('/${ctx.feature}', ${name}Routes);
`;
}
```

```ts
// src/templates/controllers/fastify.ts
import { lowerFirst } from '../../utils/naming';
import { Action, ActionSpec, standardAction } from '../actions';
import { RenderContext } from '../context';
import { callArgs, controllerImports, schemaImport, serviceImport } from './shape';

export function renderFastifyController(ctx: RenderContext, spec: ActionSpec, fromFile: string): string {
    const imports = [
        "import { FastifyReply, FastifyRequest } from 'fastify';",
        ...(spec.schema !== null ? [schemaImport(ctx, fromFile, spec.schema)] : []),
        serviceImport(ctx, fromFile, spec),
    ].join('\n');
    const requestType = spec.usesId ? 'FastifyRequest<{ Params: { id: string } }>' : 'FastifyRequest';
    const requestName = spec.schema !== null || spec.usesId ? 'request' : '_request';
    const validate =
        spec.schema !== null
            ? `  const parsed = ${spec.schema}Schema.safeParse(request.body);
  if (!parsed.success) {
    reply.status(400).send({ errors: parsed.error.flatten() });
    return;
  }
`
            : '';
    const args = callArgs(spec, 'request.params.id', 'parsed.data');
    const respond =
        spec.status === 204
            ? `  await service.handle(${args});
  reply.status(204).send();`
            : `  reply.status(${spec.status}).send(await service.handle(${args}));`;

    return `${imports}

const service = new ${spec.name}Service();

export async function ${spec.handler}(${requestName}: ${requestType}, reply: FastifyReply): Promise<void> {
${validate}${respond}
}
`;
}

export function renderFastifyRoutes(ctx: RenderContext, entity: string, fromFile: string): string {
    const name = lowerFirst(entity);
    const handler = (action: Action): string => standardAction(action, entity).handler;
    return `import { FastifyInstance } from 'fastify';
${controllerImports(ctx, fromFile, entity)}

export async function ${name}Routes(app: FastifyInstance): Promise<void> {
  app.get('/', ${handler('List')});
  app.get('/:id', ${handler('Show')});
  app.post('/', ${handler('Create')});
  app.put('/:id', ${handler('Update')});
  app.delete('/:id', ${handler('Delete')});
}

// app.register(${name}Routes, { prefix: '/${ctx.feature}' });
`;
}
```

```ts
// src/templates/controllers/hono.ts
import { lowerFirst } from '../../utils/naming';
import { Action, ActionSpec, standardAction } from '../actions';
import { RenderContext } from '../context';
import { callArgs, controllerImports, schemaImport, serviceImport } from './shape';

export function renderHonoController(ctx: RenderContext, spec: ActionSpec, fromFile: string): string {
    const imports = [
        "import { Context } from 'hono';",
        ...(spec.schema !== null ? [schemaImport(ctx, fromFile, spec.schema)] : []),
        serviceImport(ctx, fromFile, spec),
    ].join('\n');
    const contextType = spec.usesId ? "Context<{}, '/:id'>" : 'Context';
    const validate =
        spec.schema !== null
            ? `  const parsed = ${spec.schema}Schema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ errors: parsed.error.flatten() }, 400);
`
            : '';
    const args = callArgs(spec, "c.req.param('id')", 'parsed.data');
    const respond =
        spec.status === 204
            ? `  await service.handle(${args});
  return c.body(null, 204);`
            : `  return c.json(await service.handle(${args}), ${spec.status});`;

    return `${imports}

const service = new ${spec.name}Service();

export async function ${spec.handler}(c: ${contextType}): Promise<Response> {
${validate}${respond}
}
`;
}

export function renderHonoRoutes(ctx: RenderContext, entity: string, fromFile: string): string {
    const name = lowerFirst(entity);
    const handler = (action: Action): string => standardAction(action, entity).handler;
    return `import { Hono } from 'hono';
${controllerImports(ctx, fromFile, entity)}

const ${name} = new Hono();

${name}.get('/', ${handler('List')});
${name}.get('/:id', ${handler('Show')});
${name}.post('/', ${handler('Create')});
${name}.put('/:id', ${handler('Update')});
${name}.delete('/:id', ${handler('Delete')});

export default ${name};

// app.route('/${ctx.feature}', ${name});
`;
}
```

- [ ] **Step 5: Rewrite the generic, Nest, and node dispatcher templates**

```ts
// src/templates/controllers/generic.ts
import { ActionSpec } from '../actions';
import { RenderContext } from '../context';
import { schemaImport, serviceImport } from './shape';

export function renderGenericController(
    ctx: RenderContext,
    spec: ActionSpec,
    entity: string,
    fromFile: string
): string {
    const typeImport = spec.usesEntityType
        ? [`import { ${entity} } from '${ctx.importLayer(fromFile, 'types', `${entity}.types`)}';`]
        : [];
    const imports = [
        ...typeImport,
        ...(spec.schema !== null ? [schemaImport(ctx, fromFile, spec.schema)] : []),
        serviceImport(ctx, fromFile, spec),
    ].join('\n');
    const params = [spec.usesId ? 'id: string' : null, spec.schema !== null ? 'input: unknown' : null]
        .filter((param): param is string => param !== null)
        .join(', ');
    const args = [spec.usesId ? 'id' : null, spec.schema !== null ? `${spec.schema}Schema.parse(input)` : null]
        .filter((arg): arg is string => arg !== null)
        .join(', ');

    return `${imports}

const service = new ${spec.name}Service();

export class ${spec.name}Controller {
  async handle(${params}): ${spec.returns} {
    return service.handle(${args});
  }
}
`;
}
```

```ts
// src/templates/controllers/nest.ts
import { ActionSpec, HttpMethod } from '../actions';
import { RenderContext } from '../context';
import { serviceImport } from './shape';

const METHOD_DECORATORS: Readonly<Record<HttpMethod, string>> = Object.freeze({
    get: 'Get',
    post: 'Post',
    put: 'Put',
    delete: 'Delete',
});

const NEST_DEFAULT_STATUS: Readonly<Record<HttpMethod, number>> = Object.freeze({
    get: 200,
    post: 201,
    put: 200,
    delete: 200,
});

interface NestRoute {
    readonly decorator: string;
    readonly commonImports: readonly string[];
}

function nestRoute(spec: ActionSpec): NestRoute {
    const decoratorName = METHOD_DECORATORS[spec.method];
    const routePath = spec.path === '/' ? '' : spec.path.slice(1);
    const route = `@${decoratorName}(${routePath ? `'${routePath}'` : ''})`;
    const needsHttpCode = spec.status !== NEST_DEFAULT_STATUS[spec.method];
    const decorator = needsHttpCode ? `${route}\n  @HttpCode(${spec.status})` : route;
    const commonImports = [
        'Controller',
        decoratorName,
        ...(spec.schema !== null ? ['Body'] : []),
        ...(spec.usesId ? ['Param'] : []),
        ...(needsHttpCode ? ['HttpCode'] : []),
    ].sort();
    return { decorator, commonImports };
}

export function renderNestController(
    ctx: RenderContext,
    spec: ActionSpec,
    entity: string,
    fromFile: string
): string {
    const route = nestRoute(spec);
    const dto = spec.schema !== null ? `${spec.schema}Dto` : null;

    const imports = [
        `import { ${route.commonImports.join(', ')} } from '@nestjs/common';`,
        ...(spec.usesEntityType
            ? [`import { ${entity} } from '${ctx.importLayer(fromFile, 'types', `${entity}.types`)}';`]
            : []),
        ...(dto !== null && spec.schema !== null
            ? [`import { ${dto} } from '${ctx.importLayer(fromFile, 'dto', `${spec.schema}.dto`)}';`]
            : []),
        serviceImport(ctx, fromFile, spec),
    ].join('\n');

    const params = [spec.usesId ? "@Param('id') id: string" : null, dto !== null ? `@Body() body: ${dto}` : null]
        .filter((param): param is string => param !== null)
        .join(', ');
    const args = [spec.usesId ? 'id' : null, dto !== null ? 'body' : null]
        .filter((arg): arg is string => arg !== null)
        .join(', ');

    return `${imports}

@Controller('${ctx.feature}')
export class ${spec.name}Controller {
  constructor(private readonly service: ${spec.name}Service) {}

  ${route.decorator}
  handle(${params}): ${spec.returns} {
    return this.service.handle(${args});
  }
}
`;
}
```

Byte-identity check for the standard five: List `@Get()` with `Controller, Get`; Show `@Get(':id')` with `Controller, Get, Param`; Create `@Post()` with `Body, Controller, Post` (201 is Nest's POST default, so no HttpCode); Update `@Put(':id')` with `Body, Controller, Param, Put`; Delete `@Delete(':id')\n  @HttpCode(204)` with `Controller, Delete, HttpCode, Param`. All match the old table.

```ts
// src/templates/controllers/node.ts
import { lowerFirst } from '../../utils/naming';
import { ActionSpec } from '../actions';
import { RenderContext } from '../context';
import { renderExpressController, renderExpressRoutes } from './express';
import { renderFastifyController, renderFastifyRoutes } from './fastify';
import { renderHonoController, renderHonoRoutes } from './hono';
import { renderGenericController } from './generic';

export function renderNodeController(
    ctx: RenderContext,
    spec: ActionSpec,
    entity: string,
    fromFile: string
): string {
    switch (ctx.stack.httpFramework) {
        case 'express':
            return renderExpressController(ctx, spec, fromFile);
        case 'fastify':
            return renderFastifyController(ctx, spec, fromFile);
        case 'hono':
            return renderHonoController(ctx, spec, fromFile);
        case null:
            return renderGenericController(ctx, spec, entity, fromFile);
    }
}

export function renderNodeRoutes(ctx: RenderContext, entity: string, fromFile: string): string | null {
    switch (ctx.stack.httpFramework) {
        case 'express':
            return renderExpressRoutes(ctx, entity, fromFile);
        case 'fastify':
            return renderFastifyRoutes(ctx, entity, fromFile);
        case 'hono':
            return renderHonoRoutes(ctx, entity, fromFile);
        case null:
            return null;
    }
}

export function renderNodeRouteLine(ctx: RenderContext, spec: ActionSpec, entity: string): string | null {
    switch (ctx.stack.httpFramework) {
        case 'express':
            return `router.${spec.method}('${spec.path}', ${spec.handler});`;
        case 'fastify':
            return `app.${spec.method}('${spec.path}', ${spec.handler});`;
        case 'hono':
            return `${lowerFirst(entity)}.${spec.method}('${spec.path}', ${spec.handler});`;
        case null:
            return null;
    }
}
```

- [ ] **Step 6: Update the Next route templates and add the action route**

In `src/templates/controllers/next-route.ts`, add `import { standardAction } from '../actions';` and replace the import helpers: `schemaImport(ctx, fromFile, 'Create', entity)` becomes `schemaImport(ctx, fromFile, \`Create${entity}\`)`; `serviceImport(ctx, fromFile, 'List', entity)` becomes `serviceImport(ctx, fromFile, standardAction('List', entity))`, and likewise for Create, Update, Show, Delete. Everything else in the file is unchanged.

```ts
// src/templates/controllers/next-action-route.ts
import { ActionSpec } from '../actions';
import { RenderContext } from '../context';
import { schemaImport, serviceImport } from './shape';

export function renderActionRoute(ctx: RenderContext, spec: ActionSpec, fromFile: string): string {
    const imports = [
        "import { NextResponse } from 'next/server';",
        ...(spec.schema !== null ? [schemaImport(ctx, fromFile, spec.schema)] : []),
        serviceImport(ctx, fromFile, spec),
    ].join('\n');
    const method = spec.method.toUpperCase();
    const requestParam = spec.schema !== null ? 'request: Request' : '';
    const validate =
        spec.schema !== null
            ? `  const parsed = ${spec.schema}Schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
`
            : '';
    const args = spec.schema !== null ? 'parsed.data' : '';

    if (spec.status === 204) {
        return `${imports}

const service = new ${spec.name}Service();

export async function ${method}(${requestParam}): Promise<Response> {
${validate}  await service.handle(${args});
  return new Response(null, { status: 204 });
}
`;
    }

    return `${imports}

const service = new ${spec.name}Service();

export async function ${method}(${requestParam}): Promise<NextResponse> {
${validate}  return NextResponse.json(await service.handle(${args}));
}
`;
}
```

- [ ] **Step 7: Remove `actionSignature` and update the controller command**

In `src/templates/signatures.ts` delete the `ActionSignature` interface, the `actionSignature` function, and the now-unused `Action` and `standardAction` imports, leaving only `domainImports`.

In `src/commands/controller.ts` replace the imports `ACTIONS` with `standardActions` and `writeActionFiles` with `writeSpecFiles`, and change the write call:

```ts
    writeSpecFiles(dir, standardActions(name), 'controller', (spec, filePath) =>
        render(ctx, spec, name, filePath)
    );
```

- [ ] **Step 8: Run the tests and the build**

Run: `npx vitest run src/templates/__tests__/node-controllers.test.ts src/templates/__tests__/nest.test.ts src/templates/__tests__/next-route.test.ts`
Expected: PASS

Run: `npx vitest run && npm run build`
Expected: PASS. `stacks.test.ts` and `controller.test.ts` pass unchanged, which is the byte-identity proof for the standard controllers.

- [ ] **Step 9: Commit**

```bash
git add src/templates src/commands
git commit -m "refactor: drive controller templates from ActionSpec and add custom-action Next route"
```

---

### Task 4: Path-form targets in the CLI

**Files:**
- Create: `src/commands/target.ts`
- Modify: `src/commands/feature.ts` (optional explicit entity), `src/index.ts`
- Test: `src/commands/__tests__/target.test.ts`, `src/commands/__tests__/feature.test.ts` (one new case)

**Interfaces:**
- Consumes: `validateFeatureName` (naming).
- Produces: `Target { feature; name }`, `FeatureTarget { feature; entity: string | null }`, `parseTarget(value)`, `parseFeatureTarget(value)`; `makeFeature(name, all = false, entityName?: string)`.

- [ ] **Step 1: Write the failing target tests**

```ts
// src/commands/__tests__/target.test.ts
import { describe, it, expect } from 'vitest';
import { parseFeatureTarget, parseTarget } from '../target';

describe('parseTarget', () => {
    it('splits feature and name', () => {
        expect(parseTarget('users/User')).toEqual({ feature: 'users', name: 'User' });
        expect(parseTarget('coffee-type/useCoffeeType')).toEqual({ feature: 'coffee-type', name: 'useCoffeeType' });
    });

    it.each(['users', 'users/User/extra', 'a/b/c'])('rejects %s', (value) => {
        expect(() => parseTarget(value)).toThrow(`Target "${value}" must be <feature>/<Name>, for example users/User.`);
    });

    it('rejects a bad feature part', () => {
        expect(() => parseTarget('Users/User')).toThrow('Feature name "Users" must be kebab-case, for example coffee-type.');
    });

    it.each(['users/', 'users/user-card', 'users/1User', 'users/User Card'])('rejects a bad name part in %s', (value) => {
        const name = value.slice(value.indexOf('/') + 1);
        expect(() => parseTarget(value)).toThrow(`Name "${name}" must be letters and digits only, for example User.`);
    });
});

describe('parseFeatureTarget', () => {
    it('accepts a bare feature', () => {
        expect(parseFeatureTarget('users')).toEqual({ feature: 'users', entity: null });
    });

    it('accepts feature/Entity', () => {
        expect(parseFeatureTarget('users/User')).toEqual({ feature: 'users', entity: 'User' });
    });

    it('rejects two slashes', () => {
        expect(() => parseFeatureTarget('a/b/c')).toThrow(
            'Target "a/b/c" must be <feature> or <feature>/<Entity>, for example users or users/User.'
        );
    });

    it('validates both parts', () => {
        expect(() => parseFeatureTarget('Users')).toThrow('must be kebab-case');
        expect(() => parseFeatureTarget('users/user')).not.toThrow();
        expect(() => parseFeatureTarget('users/')).toThrow('Name "" must be letters and digits only, for example User.');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/commands/__tests__/target.test.ts`
Expected: FAIL with "Failed to resolve import '../target'"

- [ ] **Step 3: Write target.ts**

```ts
// src/commands/target.ts
import { validateFeatureName } from '../utils/naming';

export interface Target {
    readonly feature: string;
    readonly name: string;
}

export interface FeatureTarget {
    readonly feature: string;
    readonly entity: string | null;
}

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;

function validateName(name: string): void {
    if (!NAME_PATTERN.test(name)) {
        throw new Error(`Name "${name}" must be letters and digits only, for example User.`);
    }
}

export function parseTarget(value: string): Target {
    const parts = value.split('/');
    if (parts.length !== 2) {
        throw new Error(`Target "${value}" must be <feature>/<Name>, for example users/User.`);
    }
    const [feature, name] = parts;
    validateFeatureName(feature);
    validateName(name);
    return Object.freeze({ feature, name });
}

export function parseFeatureTarget(value: string): FeatureTarget {
    const parts = value.split('/');
    if (parts.length > 2) {
        throw new Error(
            `Target "${value}" must be <feature> or <feature>/<Entity>, for example users or users/User.`
        );
    }
    const [feature, entity] = parts;
    validateFeatureName(feature);
    if (entity !== undefined) validateName(entity);
    return Object.freeze({ feature, entity: entity ?? null });
}
```

- [ ] **Step 4: Run the target tests to verify they pass**

Run: `npx vitest run src/commands/__tests__/target.test.ts`
Expected: PASS, 12 tests

- [ ] **Step 5: Give `makeFeature` an explicit entity, with a failing test first**

Add to `src/commands/__tests__/feature.test.ts` inside `describe('make:feature on node', ...)`:

```ts
    it('uses the explicit entity name with -a', async () => {
        writePackageJson({ express: '1' });
        mkdir('src');
        await makeFeature('users', true, 'User');
        expect(projectFileExists('src/features/users/types/User.types.ts')).toBe(true);
        expect(projectFileExists('src/features/users/services/ListUser.service.ts')).toBe(true);
        expect(projectFileExists('src/features/users/types/Users.types.ts')).toBe(false);
    });
```

Run: `npx vitest run src/commands/__tests__/feature.test.ts`
Expected: FAIL (the third argument is ignored, `Users.types.ts` is written)

In `src/commands/feature.ts` change the signature and the entity line:

```ts
export async function makeFeature(name: string, all: boolean = false, entityName?: string): Promise<void> {
    const ctx = resolveFeature(name);

    if (fileExists(ctx.featureDir)) {
        throw new Error(`Feature "${name}" already exists at ${ctx.featureDir}`);
    }

    const entity = entityName ?? toPascalCase(name);
```

Run: `npx vitest run src/commands/__tests__/feature.test.ts`
Expected: PASS

- [ ] **Step 6: Switch the CLI to targets**

Replace the command registrations in `src/index.ts` (keep the header, the `preAction` hook, `fail`, and `parseAsync` as they are; add `import { parseFeatureTarget, parseTarget } from './commands/target';`):

```ts
program
    .command('make:feature <target>')
    .description('Scaffold a feature folder for the detected stack (<feature> or <feature>/<Entity>)')
    .option('-a, --all', 'Scaffold all files inside each folder')
    .action(async (target: string, options: { all?: boolean }) => {
        const { feature, entity } = parseFeatureTarget(target);
        await makeFeature(feature, options.all ?? false, entity ?? undefined);
    });

program
    .command('make:component <target>')
    .description('Scaffold a component inside an existing feature (<feature>/<Name>)')
    .argument('[type]', 'Component type: client or server', 'client')
    .action((target: string, type: string) => {
        const { feature, name } = parseTarget(target);
        makeComponent(feature, name, parseComponentType(type));
    });

program
    .command('make:container <target>')
    .description('Scaffold a smart container component inside an existing feature (<feature>/<Name>)')
    .action((target: string) => {
        const { feature, name } = parseTarget(target);
        makeContainer(feature, name);
    });

program
    .command('make:hook <target>')
    .description('Scaffold a custom hook inside an existing feature (<feature>/<useName>)')
    .action((target: string) => {
        const { feature, name } = parseTarget(target);
        makeHook(feature, name);
    });

program
    .command('make:service <target>')
    .description('Scaffold single-responsibility service files inside an existing feature (<feature>/<Entity>)')
    .option('--side <side>', 'client, server, or both', 'both')
    .action((target: string, options: { side: string }) => {
        const { feature, name } = parseTarget(target);
        makeService(feature, name, parseSide(options.side));
        hintRegisterInModule(feature, ACTIONS.map((action) => `${action}${name}Service`));
    });

program
    .command('make:repository <target>')
    .description('Scaffold single-responsibility repository files inside an existing feature (<feature>/<Entity>)')
    .option('--side <side>', 'client, server, or both', 'both')
    .action((target: string, options: { side: string }) => {
        const { feature, name } = parseTarget(target);
        makeRepository(feature, name, parseSide(options.side));
        hintRegisterInModule(feature, ACTIONS.map((action) => `${action}${name}Repository`));
    });

program
    .command('make:controller <target>')
    .description('Scaffold single-responsibility controllers or route handlers inside an existing feature (<feature>/<Entity>)')
    .action((target: string) => {
        const { feature, name } = parseTarget(target);
        makeController(feature, name);
        hintRegisterInModule(feature, ACTIONS.map((action) => `${action}${name}Controller`));
    });

program
    .command('make:schema <target>')
    .description('Scaffold Zod schemas (and Nest DTOs) for create and update operations (<feature>/<Entity>)')
    .action((target: string) => {
        const { feature, name } = parseTarget(target);
        makeSchema(feature, name);
    });

program
    .command('make:types <target>')
    .description('Scaffold a types file inside an existing feature (<feature>/<Entity>)')
    .action((target: string) => {
        const { feature, name } = parseTarget(target);
        makeTypes(feature, name);
    });
```

- [ ] **Step 7: Build and smoke-test the binary**

```bash
npm run build
REPO="$(pwd)"
SMOKE="$(mktemp -d)"
cd "$SMOKE"
printf '{"name":"smoke","dependencies":{"express":"^5.0.0"}}' > package.json
mkdir src
node "$REPO/dist/index.js" make:feature users/User -a
ls src/features/users/types src/features/users/services
node "$REPO/dist/index.js" make:schema users; echo "exit=$?"
node "$REPO/dist/index.js" make:types Users/User; echo "exit=$?"
node "$REPO/dist/index.js" make:feature a/b/c; echo "exit=$?"
cd "$REPO"
```

Expected:
- `User.types.ts` in `types/`, `ListUser.service.ts` and four siblings in `services/`.
- `❌ Target "users" must be <feature>/<Name>, for example users/User.` and `exit=1`.
- `❌ Feature name "Users" must be kebab-case, for example coffee-type.` and `exit=1`.
- `❌ Target "a/b/c" must be <feature> or <feature>/<Entity>, for example users or users/User.` and `exit=1`.

- [ ] **Step 8: Run everything and commit**

Run: `npx vitest run && npm run build`
Expected: PASS

```bash
git add src/commands/target.ts src/commands/__tests__/target.test.ts src/commands/feature.ts src/commands/__tests__/feature.test.ts src/index.ts
git commit -m "feat: <feature>/<Name> targets on every command and an explicit entity for make:feature"
```

---

### Task 5: `make:action`

**Files:**
- Create: `src/commands/action.ts`
- Modify: `src/index.ts`
- Test: `src/commands/__tests__/action.test.ts`, `src/commands/__tests__/stacks.test.ts` (new describe block)

**Interfaces:**
- Consumes: `customAction`, `CustomActionOptions`, `RETURN_KINDS`, `ReturnKind`, `actionCase` (Task 1); every render function from Tasks 2 and 3; `renderNodeRouteLine`; `requireFeature`, `ensureLayerDir`, `writeIfAbsent`, `hintNestjsZod`, `hintRegisterInModule`; `layerDir`, `hasLayer`; `apiRouteDir`; `parseTarget`.
- Produces: `parseReturns(value): ReturnKind`, `makeAction(feature, entity, actionName, options)`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/commands/__tests__/action.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeAction, parseReturns } from '../action';
import { makeTypes } from '../types';
import {
    createTempProject,
    writePackageJson,
    mkdir,
    readProjectFile,
    projectFileExists,
    TempProject,
} from '../../__tests__/helpers/project';

let project: TempProject;

const logged = (): string[] => vi.mocked(console.log).mock.calls.map(([message]) => String(message));

beforeEach(() => {
    project = createTempProject('action');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    project.cleanup();
    vi.restoreAllMocks();
});

describe('parseReturns', () => {
    it('accepts the three kinds and rejects others', () => {
        expect(parseReturns('list')).toBe('list');
        expect(parseReturns('one')).toBe('one');
        expect(parseReturns('void')).toBe('void');
        expect(() => parseReturns('many')).toThrow('Invalid --returns "many". Use list, one, or void.');
    });
});

describe('make:action on node with express', () => {
    beforeEach(() => {
        writePackageJson({ express: '1' });
        mkdir('src/features/users');
    });

    it('writes service, repository, controller and prints the route line', () => {
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        expect(readProjectFile('src/features/users/services/FindActiveUsers.service.ts')).toContain('export class FindActiveUsersService {');
        expect(readProjectFile('src/features/users/repositories/FindActiveUsers.repository.ts')).toContain('is not implemented');
        expect(readProjectFile('src/features/users/controllers/FindActiveUsers.controller.ts')).toContain('export async function findActiveUsersController(_req: Request');
        expect(projectFileExists('src/features/users/schemas')).toBe(false);
        expect(logged()).toContain("ℹ️  Add to users.routes.ts: router.get('/find-active-users', findActiveUsersController);");
        expect(logged()).toContain('✅ Action "FindActiveUsers" scaffolded in "users"');
    });

    it('hints when the types file is missing and stays quiet when it exists', () => {
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        expect(logged()).toContain('ℹ️  types/User.types.ts not found. Run: domain-driver make:types users/User');
        vi.mocked(console.log).mockClear();
        makeTypes('users', 'User');
        makeAction('users', 'User', 'countUsers', { withInput: false, returns: 'one' });
        expect(logged().some((line) => line.includes('types/User.types.ts not found'))).toBe(false);
    });

    it('writes a schema with --with-input and a 204 controller for void', () => {
        makeAction('users', 'User', 'notifyUsers', { withInput: true, returns: 'void' });
        expect(readProjectFile('src/features/users/schemas/NotifyUsers.schema.ts')).toContain('export const NotifyUsersSchema');
        const controller = readProjectFile('src/features/users/controllers/NotifyUsers.controller.ts');
        expect(controller).toContain('const parsed = NotifyUsersSchema.safeParse(req.body);');
        expect(controller).toContain('res.status(204).send();');
        expect(readProjectFile('src/features/users/repositories/NotifyUsers.repository.ts')).toContain('async handle(data: NotifyUsers): Promise<void> {');
        expect(logged()).toContain("ℹ️  Add to users.routes.ts: router.post('/notify-users', notifyUsersController);");
    });

    it('skips existing files', () => {
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        expect(console.warn).toHaveBeenCalledWith('⚠️  Skipping "FindActiveUsers.service.ts" — already exists');
    });

    it('rejects a bad action name before writing', () => {
        expect(() => makeAction('users', 'User', 'find-active', { withInput: false, returns: 'list' })).toThrow(
            'Action name "find-active" must be camelCase or PascalCase, for example findActiveUsers.'
        );
        expect(projectFileExists('src/features/users/services')).toBe(false);
    });
});

describe('make:action on node without a framework', () => {
    it('writes a generic controller and no route hint', () => {
        writePackageJson({});
        mkdir('src/features/users');
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        expect(readProjectFile('src/features/users/controllers/FindActiveUsers.controller.ts')).toContain('export class FindActiveUsersController {');
        expect(logged().some((line) => line.includes('routes.ts'))).toBe(false);
    });
});

describe('make:action on nest', () => {
    it('writes injectable classes and a DTO with input', () => {
        writePackageJson({ '@nestjs/core': '1', 'nestjs-zod': '1' });
        mkdir('src/users');
        makeAction('users', 'User', 'archiveUser', { withInput: true, returns: 'one' });
        expect(readProjectFile('src/users/dto/ArchiveUser.dto.ts')).toContain('createZodDto(ArchiveUserSchema)');
        const controller = readProjectFile('src/users/controllers/ArchiveUser.controller.ts');
        expect(controller).toContain("@Post('archive-user')\n  @HttpCode(200)");
        expect(readProjectFile('src/users/services/ArchiveUser.service.ts')).toContain('@Injectable()');
    });
});

describe('make:action on next-fullstack', () => {
    it('writes both sides and a route handler at the slug', () => {
        writePackageJson({ next: '1' });
        mkdir('app/api');
        mkdir('app/users');
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        expect(projectFileExists('app/users/server/services/FindActiveUsers.service.ts')).toBe(true);
        expect(projectFileExists('app/users/server/repositories/FindActiveUsers.repository.ts')).toBe(true);
        expect(projectFileExists('app/users/client/services/FindActiveUsers.service.ts')).toBe(true);
        expect(readProjectFile('app/users/client/repositories/FindActiveUsers.repository.ts')).toContain("fetch('/api/users/find-active-users')");
        expect(readProjectFile('app/api/users/find-active-users/route.ts')).toContain('export async function GET(): Promise<NextResponse> {');
    });
});

describe('make:action on react', () => {
    it('writes the client side only', () => {
        writePackageJson({ react: '1' });
        mkdir('src/features/users');
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        expect(projectFileExists('src/features/users/services/FindActiveUsers.service.ts')).toBe(true);
        expect(readProjectFile('src/features/users/repositories/FindActiveUsers.repository.ts')).toContain("fetch('/api/users/find-active-users')");
        expect(projectFileExists('src/features/users/controllers')).toBe(false);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/commands/__tests__/action.test.ts`
Expected: FAIL with "Failed to resolve import '../action'"

- [ ] **Step 3: Write the command**

```ts
// src/commands/action.ts
import * as path from 'path';
import { hasLayer, layerDir } from '../stack/registry';
import { Side } from '../stack/types';
import { ActionSpec, customAction, CustomActionOptions, RETURN_KINDS, ReturnKind } from '../templates/actions';
import { renderServerRepository } from '../templates/backend/server-repository';
import { RenderContext } from '../templates/context';
import { renderNestController } from '../templates/controllers/nest';
import { renderActionRoute } from '../templates/controllers/next-action-route';
import { renderNodeController, renderNodeRouteLine } from '../templates/controllers/node';
import { renderClientRepository } from '../templates/frontend/client-repository';
import { renderDto } from '../templates/nest/dto';
import { renderService } from '../templates/service';
import { renderSchema } from '../templates/shared/schema';
import { fileExists, mkdirSafe } from '../utils/fs';
import { lowerFirst } from '../utils/naming';
import { apiRouteDir } from '../utils/paths';
import { hintNestjsZod } from './hints';
import { ensureLayerDir, requireFeature } from './resolve';
import { writeIfAbsent } from './write';

export function parseReturns(value: string): ReturnKind {
    if ((RETURN_KINDS as readonly string[]).includes(value)) return value as ReturnKind;
    throw new Error(`Invalid --returns "${value}". Use list, one, or void.`);
}

export function makeAction(
    feature: string,
    entity: string,
    actionName: string,
    options: CustomActionOptions
): void {
    const ctx = requireFeature(feature);
    const spec = customAction(entity, actionName, options);

    hintMissingTypes(ctx, entity);
    if (spec.schema !== null) writeInput(ctx, spec);
    if (hasLayer(ctx.profile, 'serverRepository')) writeSide(ctx, spec, entity, 'server');
    if (hasLayer(ctx.profile, 'controller')) writeController(ctx, spec, entity);
    if (hasLayer(ctx.profile, 'clientRepository')) writeSide(ctx, spec, entity, 'client');

    console.log(`✅ Action "${spec.name}" scaffolded in "${feature}"`);
}

function hintMissingTypes(ctx: RenderContext, entity: string): void {
    const typesFile = path.join(ctx.featureDir, layerDir(ctx.profile, 'types'), `${entity}.types.ts`);
    if (fileExists(typesFile)) return;
    console.log(`ℹ️  types/${entity}.types.ts not found. Run: domain-driver make:types ${ctx.feature}/${entity}`);
}

function writeInput(ctx: RenderContext, spec: ActionSpec): void {
    const schemaFile = path.join(ensureLayerDir(ctx, 'schema'), `${spec.name}.schema.ts`);
    writeIfAbsent(schemaFile, () => renderSchema(spec.name, lowerFirst(spec.name)));

    if (!hasLayer(ctx.profile, 'dto')) return;
    const dtoFile = path.join(ensureLayerDir(ctx, 'dto'), `${spec.name}.dto.ts`);
    writeIfAbsent(dtoFile, () => renderDto(ctx, spec.name, dtoFile));
    hintNestjsZod(ctx.stack);
}

function writeSide(ctx: RenderContext, spec: ActionSpec, entity: string, side: Side): void {
    const repositoryLayer = side === 'client' ? 'clientRepository' : 'serverRepository';
    const serviceLayer = side === 'client' ? 'clientService' : 'serverService';
    const renderRepository = side === 'client' ? renderClientRepository : renderServerRepository;

    const repositoryFile = path.join(ensureLayerDir(ctx, repositoryLayer), `${spec.name}.repository.ts`);
    writeIfAbsent(repositoryFile, () => renderRepository(ctx, spec, entity, repositoryFile));

    const serviceFile = path.join(ensureLayerDir(ctx, serviceLayer), `${spec.name}.service.ts`);
    writeIfAbsent(serviceFile, () => renderService(ctx, spec, entity, serviceFile, side));
}

function writeController(ctx: RenderContext, spec: ActionSpec, entity: string): void {
    if (ctx.profile.name === 'next-fullstack') {
        const routeDir = path.join(apiRouteDir(ctx.stack, ctx.feature), spec.path.slice(1));
        mkdirSafe(routeDir);
        const routeFile = path.join(routeDir, 'route.ts');
        writeIfAbsent(routeFile, () => renderActionRoute(ctx, spec, routeFile));
        return;
    }

    const controllerFile = path.join(ensureLayerDir(ctx, 'controller'), `${spec.name}.controller.ts`);
    const render = ctx.profile.name === 'nest' ? renderNestController : renderNodeController;
    writeIfAbsent(controllerFile, () => render(ctx, spec, entity, controllerFile));

    const line = ctx.profile.name === 'node' ? renderNodeRouteLine(ctx, spec, entity) : null;
    if (line !== null) console.log(`ℹ️  Add to ${ctx.feature}.routes.ts: ${line}`);
}
```

- [ ] **Step 4: Run the action tests to verify they pass**

Run: `npx vitest run src/commands/__tests__/action.test.ts`
Expected: PASS, 10 tests

- [ ] **Step 5: Wire the CLI**

Add to `src/index.ts` (imports: `makeAction, parseReturns` from `./commands/action`, `actionCase` from `./templates/actions`), after the `make:controller` block:

```ts
program
    .command('make:action <target> <action>')
    .description('Scaffold a bespoke action as its own service, repository, and controller (<feature>/<Entity> <actionName>)')
    .option('--with-input', 'The action takes a request body validated by a Zod schema', false)
    .option('--returns <kind>', 'list, one, or void', 'list')
    .action((target: string, action: string, options: { withInput: boolean; returns: string }) => {
        const { feature, name } = parseTarget(target);
        const returns = parseReturns(options.returns);
        makeAction(feature, name, action, { withInput: options.withInput, returns });
        const { pascal } = actionCase(action);
        hintRegisterInModule(feature, [`${pascal}Controller`, `${pascal}Service`, `${pascal}Repository`]);
    });
```

- [ ] **Step 6: Extend the per-stack integration tests**

Append to `src/commands/__tests__/stacks.test.ts` (add `import { makeAction } from '../action';`):

```ts
describe('make:action after make:feature -a per stack', () => {
    const scaffold = async (): Promise<void> => {
        await makeFeature('coffee-type', true, 'CoffeeType');
        makeAction('coffee-type', 'CoffeeType', 'findActiveCoffeeTypes', { withInput: false, returns: 'list' });
        makeAction('coffee-type', 'CoffeeType', 'archiveCoffeeType', { withInput: true, returns: 'one' });
    };

    it('node with express', async () => {
        writePackageJson({ express: '1' });
        mkdir('src');
        await scaffold();
        const files = listFiles('src/features');
        expect(files).toContain('coffee-type/controllers/FindActiveCoffeeTypes.controller.ts');
        expect(files).toContain('coffee-type/services/ArchiveCoffeeType.service.ts');
        expect(files).toContain('coffee-type/schemas/ArchiveCoffeeType.schema.ts');
        expect(files).not.toContain('coffee-type/schemas/FindActiveCoffeeTypes.schema.ts');
        assertImportsResolve('src/features', null);
    });

    it('nest', async () => {
        writePackageJson({ '@nestjs/core': '1', 'nestjs-zod': '1' });
        await scaffold();
        const files = listFiles('src');
        expect(files).toContain('coffee-type/dto/ArchiveCoffeeType.dto.ts');
        expect(files).toContain('coffee-type/controllers/FindActiveCoffeeTypes.controller.ts');
        assertImportsResolve('src', null);
    });

    it('next-fullstack', async () => {
        writePackageJson({ next: '1' });
        mkdir('app/api');
        await scaffold();
        const files = listFiles('app');
        expect(files).toContain('api/coffee-type/find-active-coffee-types/route.ts');
        expect(files).toContain('api/coffee-type/archive-coffee-type/route.ts');
        expect(files).toContain('coffee-type/client/repositories/FindActiveCoffeeTypes.repository.ts');
        expect(files).toContain('coffee-type/server/services/ArchiveCoffeeType.service.ts');
        assertImportsResolve('app', null);
    });

    it('react', async () => {
        writePackageJson({ react: '1' });
        mkdir('src');
        await scaffold();
        const files = listFiles('src/features');
        expect(files).toContain('coffee-type/services/FindActiveCoffeeTypes.service.ts');
        expect(files).toContain('coffee-type/repositories/ArchiveCoffeeType.repository.ts');
        expect(files.some((file) => file.includes('controllers/'))).toBe(false);
        assertImportsResolve('src/features', null);
    });
});
```

- [ ] **Step 7: Build and smoke-test**

```bash
npm run build
REPO="$(pwd)"
SMOKE="$(mktemp -d)"
cd "$SMOKE"
printf '{"name":"smoke","dependencies":{"@nestjs/core":"^11.0.0","nestjs-zod":"^4.0.0"}}' > package.json
mkdir src
node "$REPO/dist/index.js" make:feature users/User -a >/dev/null
node "$REPO/dist/index.js" make:action users/User archiveUser --with-input --returns one
ls src/users/controllers src/users/dto
node "$REPO/dist/index.js" make:action users/User bad-name; echo "exit=$?"
node "$REPO/dist/index.js" make:action users/User x --returns many; echo "exit=$?"
cd "$REPO"
```

Expected: `ArchiveUser.controller.ts` and `ArchiveUser.dto.ts` listed; the register hint `ℹ️  Register ArchiveUserController, ArchiveUserService, ArchiveUserRepository in users.module.ts`; `❌ Action name "bad-name" must be camelCase or PascalCase, for example findActiveUsers.` with `exit=1`; `❌ Invalid --returns "many". Use list, one, or void.` with `exit=1`.

- [ ] **Step 8: Run everything and commit**

Run: `npx vitest run && npm run build`
Expected: PASS

```bash
git add src/commands/action.ts src/commands/__tests__/action.test.ts src/commands/__tests__/stacks.test.ts src/index.ts
git commit -m "feat: make:action scaffolds bespoke operations as per-action files"
```

---

### Task 6: `init` command with marker-delimited guidance

**Files:**
- Modify: `src/utils/fs.ts` (add `readTextFile`)
- Create: `src/init/markers.ts`, `src/init/content.ts`, `src/init/init.ts`
- Modify: `src/index.ts` (`init` command, hook skip)
- Test: `src/init/__tests__/markers.test.ts`, `src/init/__tests__/init.test.ts`

**Interfaces:**
- Produces: `readTextFile(filePath): string | null`; `START`, `END`, `SectionStatus`, `SectionResult`, `applySection(existing, section)`; `AGENTS_SECTION`, `SKILL_CONTENT`; `InitResult { file; status }`, `runInit(root): readonly InitResult[]`.

- [ ] **Step 1: Write the failing marker tests**

```ts
// src/init/__tests__/markers.test.ts
import { describe, it, expect } from 'vitest';
import { applySection, END, START } from '../markers';

const section = `${START}\nhello\n${END}`;

describe('applySection', () => {
    it('creates the file content when nothing exists', () => {
        expect(applySection(null, section)).toEqual({ content: `${section}\n`, status: 'created' });
    });

    it('appends after a blank line when there are no markers', () => {
        expect(applySection('# Title\n', section)).toEqual({ content: `# Title\n\n${section}\n`, status: 'updated' });
    });

    it('adds the missing newline before appending', () => {
        expect(applySection('# Title', section)).toEqual({ content: `# Title\n\n${section}\n`, status: 'updated' });
    });

    it('replaces between markers and keeps everything else byte for byte', () => {
        const existing = `# Title\n\n${START}\nold\n${END}\n\n## Notes\nkeep me\n`;
        expect(applySection(existing, section)).toEqual({
            content: `# Title\n\n${section}\n\n## Notes\nkeep me\n`,
            status: 'updated',
        });
    });

    it('reports unchanged when the section is already current', () => {
        const existing = `intro\n${section}\noutro\n`;
        expect(applySection(existing, section)).toEqual({ content: existing, status: 'unchanged' });
    });

    it('appends when only one marker is present', () => {
        const existing = `${START}\nbroken\n`;
        expect(applySection(existing, section).content).toBe(`${existing}\n${section}\n`);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/init/__tests__/markers.test.ts`
Expected: FAIL with "Failed to resolve import '../markers'"

- [ ] **Step 3: Write markers.ts and readTextFile**

```ts
// src/init/markers.ts
export const START = '<!-- domain-driver:start -->';
export const END = '<!-- domain-driver:end -->';

export type SectionStatus = 'created' | 'updated' | 'unchanged';

export interface SectionResult {
    readonly content: string;
    readonly status: SectionStatus;
}

export function applySection(existing: string | null, section: string): SectionResult {
    if (existing === null) {
        return { content: `${section}\n`, status: 'created' };
    }

    const start = existing.indexOf(START);
    const end = existing.indexOf(END);

    if (start !== -1 && end !== -1 && end > start) {
        const before = existing.slice(0, start);
        const after = existing.slice(end + END.length);
        const content = `${before}${section}${after}`;
        return { content, status: content === existing ? 'unchanged' : 'updated' };
    }

    const separator = existing.endsWith('\n') ? '\n' : '\n\n';
    return { content: `${existing}${separator}${section}\n`, status: 'updated' };
}
```

Append to `src/utils/fs.ts`:

```ts
export function readTextFile(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
}
```

- [ ] **Step 4: Run the marker tests to verify they pass**

Run: `npx vitest run src/init/__tests__/markers.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Write the content module**

The text is the spec's sections 5.2 and 5.3 verbatim. Lines are stored in arrays so no backtick escaping is needed.

```ts
// src/init/content.ts
import { END, START } from './markers';

const AGENTS_LINES: readonly string[] = [
    START,
    '## Scaffolding with domain-driver',
    '',
    'This project uses [domain-driver](https://github.com/IsaacHatilima/domain-driver) to scaffold feature folders. Scaffold first, then fill in the generated files. Do not hand-write a layer the tool can generate.',
    '',
    '- New feature: `npx domain-driver make:feature <feature>/<Entity> -a`',
    '- One layer in an existing feature: `npx domain-driver make:<layer> <feature>/<Entity>` where layer is types, schema, repository, service, controller, component, container, or hook',
    '- Any operation that is not List, Show, Create, Update, or Delete: `npx domain-driver make:action <feature>/<Entity> <actionName>`. Add `--with-input` when it takes a request body and `--returns one|void` when it does not return a list.',
    '',
    'Rules the generated code follows, and that new code must keep:',
    '',
    '- One file per action per layer. `findActiveUsers` gets `FindActiveUsers.service.ts`, `FindActiveUsers.repository.ts`, and `FindActiveUsers.controller.ts`. It never goes inside `ShowUser.service.ts` or `ListUser.service.ts`.',
    '- The chain is controller or hook, then service, then repository. Business logic lives in services. Data access lives in repositories. Controllers validate input and call one service.',
    '- Feature folders are kebab-case (`coffee-type`). Entity, action, and class names are PascalCase (`CoffeeType`, `FindActiveUsers`).',
    '- Generated repositories throw until you wire them to your data source. Generated controllers on Node need a line in `<feature>.routes.ts`, and on Nest need registering in `<feature>.module.ts`; the tool prints the exact line.',
    '',
    'Full guidance: `.claude/skills/domain-driver/SKILL.md`. Re-run `npx domain-driver init` after upgrading domain-driver to refresh this section.',
    END,
];

const SKILL_LINES: readonly string[] = [
    '---',
    'name: domain-driver',
    'description: Scaffold domain-driven feature folders with the domain-driver CLI. Use when creating a feature, adding a layer (types, schema, repository, service, controller, component, container, hook) to an existing feature, or adding any operation beyond List, Show, Create, Update, and Delete.',
    '---',
    '',
    '# domain-driver',
    '',
    'Every feature lives in one folder, and every action in every layer is one file. Use the CLI to create files; write the logic inside them by hand.',
    '',
    '## Detect the stack',
    '',
    'The tool reads `package.json` and prints `Stack: <stack> (detected)` before every command. Stacks: `next-fullstack`, `next-frontend`, `react`, `node` (Express, Fastify, Hono, or none), `nest`. Override with `--stack <name>` if detection is wrong.',
    '',
    '## Commands',
    '',
    '| Task | Command |',
    '|---|---|',
    '| New feature with every layer | `npx domain-driver make:feature users/User -a` |',
    '| New feature, folders only | `npx domain-driver make:feature users` |',
    '| Entity interface | `npx domain-driver make:types users/User` |',
    '| Create and Update schemas (and Nest DTOs) | `npx domain-driver make:schema users/User` |',
    '| Five repositories | `npx domain-driver make:repository users/User` |',
    '| Five services | `npx domain-driver make:service users/User` |',
    '| Five controllers or Next route handlers | `npx domain-driver make:controller users/User` |',
    '| A bespoke operation | `npx domain-driver make:action users/User findActiveUsers` |',
    '| Bespoke operation with a request body | `npx domain-driver make:action users/User archiveUser --with-input --returns one` |',
    '| Component, container, hook | `npx domain-driver make:component users/UserCard`, `make:container users/UserContainer`, `make:hook users/useUser` |',
    '| Refresh this guidance | `npx domain-driver init` |',
    '',
    'On `next-fullstack`, `make:service` and `make:repository` take `--side client|server|both` (default both).',
    '',
    '## Rules',
    '',
    '1. **Scaffold before writing.** If a file the tool can generate does not exist yet, generate it. Do not create `services/FindActiveUsers.service.ts` by hand.',
    '2. **One action, one file, every layer.** A new operation is a `make:action`, never a new method on an existing action class and never a branch inside Show or List.',
    '3. **Keep the chain.** Controller or hook calls one service. Service calls one repository. Repositories do data access only.',
    '4. **Names.** Feature folders kebab-case. Entities, actions, and classes PascalCase. Action names include their noun: `archiveUser`, `findActiveUsers`.',
    '5. **Do not widen the standard five.** List returns all, Show returns one by id, Create takes the create schema, Update takes id and the update schema, Delete takes id. Anything else is a bespoke action.',
    '6. **Finish what the tool leaves open.** Fill the `TODO` in each repository. Add the printed line to `<feature>.routes.ts` on Node or register the printed classes in `<feature>.module.ts` on Nest. Add fields to the Zod schemas.',
    '',
    '## Layout by stack',
    '',
    '- Next.js: `app/<feature>` or `src/app/<feature>`; route handlers under `app/api/<feature>`.',
    '- React and Node: `src/features/<feature>` or `features/<feature>`.',
    '- Nest: `src/<feature>` with a `<feature>.module.ts`.',
];

export const AGENTS_SECTION: string = AGENTS_LINES.join('\n');
export const SKILL_CONTENT: string = `${SKILL_LINES.join('\n')}\n`;
```

- [ ] **Step 6: Write the failing init tests**

```ts
// src/init/__tests__/init.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { runInit } from '../init';
import { AGENTS_SECTION, SKILL_CONTENT } from '../content';
import { END, START } from '../markers';
import { createTempProject, readProjectFile, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('init');
});

afterEach(() => project.cleanup());

describe('runInit', () => {
    it('creates all three files in an empty project', () => {
        expect(runInit(process.cwd())).toEqual([
            { file: 'AGENTS.md', status: 'created' },
            { file: 'CLAUDE.md', status: 'created' },
            { file: '.claude/skills/domain-driver/SKILL.md', status: 'created' },
        ]);
        expect(readProjectFile('AGENTS.md')).toBe(`${AGENTS_SECTION}\n`);
        expect(readProjectFile('CLAUDE.md')).toBe(`${AGENTS_SECTION}\n`);
        expect(readProjectFile('.claude/skills/domain-driver/SKILL.md')).toBe(SKILL_CONTENT);
    });

    it('is idempotent', () => {
        runInit(process.cwd());
        const before = readProjectFile('AGENTS.md');
        expect(runInit(process.cwd()).map((result) => result.status)).toEqual(['unchanged', 'unchanged', 'unchanged']);
        expect(readProjectFile('AGENTS.md')).toBe(before);
    });

    it('appends to an existing file and preserves hand edits outside the markers', () => {
        fs.writeFileSync(path.join(process.cwd(), 'AGENTS.md'), '# My rules\n\nBe kind.\n');
        expect(runInit(process.cwd())[0]).toEqual({ file: 'AGENTS.md', status: 'updated' });
        expect(readProjectFile('AGENTS.md')).toBe(`# My rules\n\nBe kind.\n\n${AGENTS_SECTION}\n`);
    });

    it('refreshes a stale section in place', () => {
        fs.writeFileSync(
            path.join(process.cwd(), 'CLAUDE.md'),
            `top\n${START}\nold guidance\n${END}\nbottom\n`
        );
        expect(runInit(process.cwd())[1]).toEqual({ file: 'CLAUDE.md', status: 'updated' });
        expect(readProjectFile('CLAUDE.md')).toBe(`top\n${AGENTS_SECTION}\nbottom\n`);
    });

    it('overwrites a modified skill file', () => {
        runInit(process.cwd());
        fs.writeFileSync(path.join(process.cwd(), '.claude/skills/domain-driver/SKILL.md'), 'edited\n');
        expect(runInit(process.cwd())[2]).toEqual({ file: '.claude/skills/domain-driver/SKILL.md', status: 'updated' });
        expect(readProjectFile('.claude/skills/domain-driver/SKILL.md')).toBe(SKILL_CONTENT);
    });

    it('works with a root that is not the cwd', () => {
        const other = path.join(process.cwd(), 'elsewhere');
        fs.mkdirSync(other);
        runInit(other);
        expect(fs.existsSync(path.join(other, 'AGENTS.md'))).toBe(true);
        expect(fs.existsSync(path.join(process.cwd(), 'AGENTS.md'))).toBe(false);
    });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx vitest run src/init/__tests__/init.test.ts`
Expected: FAIL with "Failed to resolve import '../init'"

- [ ] **Step 8: Write init.ts**

```ts
// src/init/init.ts
import * as path from 'path';
import { mkdirSafe, readTextFile, writeFileSafe } from '../utils/fs';
import { AGENTS_SECTION, SKILL_CONTENT } from './content';
import { applySection, SectionStatus } from './markers';

export interface InitResult {
    readonly file: string;
    readonly status: SectionStatus;
}

const SKILL_FILE = '.claude/skills/domain-driver/SKILL.md';

export function runInit(root: string): readonly InitResult[] {
    return [writeSection(root, 'AGENTS.md'), writeSection(root, 'CLAUDE.md'), writeSkill(root)];
}

function writeSection(root: string, file: string): InitResult {
    const filePath = path.join(root, file);
    const result = applySection(readTextFile(filePath), AGENTS_SECTION);
    if (result.status !== 'unchanged') writeFileSafe(filePath, result.content);
    return Object.freeze({ file, status: result.status });
}

function writeSkill(root: string): InitResult {
    const filePath = path.join(root, SKILL_FILE);
    const existing = readTextFile(filePath);
    if (existing === SKILL_CONTENT) return Object.freeze({ file: SKILL_FILE, status: 'unchanged' });

    mkdirSafe(path.dirname(filePath));
    writeFileSafe(filePath, SKILL_CONTENT);
    return Object.freeze({ file: SKILL_FILE, status: existing === null ? 'created' : 'updated' });
}
```

- [ ] **Step 9: Run the init tests to verify they pass**

Run: `npx vitest run src/init/__tests__/init.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 10: Wire the CLI and skip detection for init**

In `src/index.ts`, add `import { runInit } from './init/init'; import { SectionStatus } from './init/markers';`, replace the hook, and add the command:

```ts
program.hook('preAction', (_thisCommand, actionCommand) => {
    if (actionCommand.name() === 'init') return;
    const { stack } = program.opts<{ stack?: string }>();
    console.log(describeStack(detectStack(stack)));
});
```

```ts
const INIT_ICONS: Readonly<Record<SectionStatus, string>> = Object.freeze({
    created: '✅',
    updated: '✅',
    unchanged: 'ℹ️ ',
});

program
    .command('init')
    .description('Write agent guidance into this project: AGENTS.md, CLAUDE.md, and .claude/skills/domain-driver/SKILL.md')
    .action(() => {
        for (const result of runInit(process.cwd())) {
            console.log(`${INIT_ICONS[result.status]} ${result.file} ${result.status}`);
        }
    });
```

- [ ] **Step 11: Build and smoke-test**

```bash
npm run build
REPO="$(pwd)"
SMOKE="$(mktemp -d)"
cd "$SMOKE"
node "$REPO/dist/index.js" init
node "$REPO/dist/index.js" init
head -3 AGENTS.md
head -2 .claude/skills/domain-driver/SKILL.md
cd "$REPO"
```

Expected: first run prints three `✅ ... created` lines and no `Stack:` line (there is no package.json and it still works); second run prints three `ℹ️  ... unchanged` lines; `AGENTS.md` starts with the start marker; `SKILL.md` starts with the frontmatter.

- [ ] **Step 12: Run everything and commit**

Run: `npx vitest run && npm run build`
Expected: PASS

```bash
git add src/init src/utils/fs.ts src/index.ts
git commit -m "feat: init writes marker-delimited agent guidance and a Claude Code skill"
```

---

### Task 7: Guarded postinstall

**Files:**
- Create: `src/postinstall.ts`, `scripts/postinstall.js`
- Modify: `package.json` (`postinstall` script, `files` allow-list)
- Test: `src/__tests__/postinstall.test.ts`

**Interfaces:**
- Consumes: `runInit`, `InitResult` (Task 6).
- Produces: `SkipReason`, `PostinstallDecision`, `PackageNameReader`, `shouldRunPostinstall(env, readPackageName)`, `readPackageName(root)`, `run(init?, env?)`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/__tests__/postinstall.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readPackageName, run, shouldRunPostinstall } from '../postinstall';
import { createTempProject, writePackageJson } from './helpers/project';

const consumer = (): string | null => 'my-app';

afterEach(() => vi.restoreAllMocks());

describe('shouldRunPostinstall', () => {
    it('skips on CI', () => {
        expect(shouldRunPostinstall({ CI: 'true', INIT_CWD: '/p' }, consumer)).toEqual({ run: false, reason: 'ci' });
        expect(shouldRunPostinstall({ CI: '1', INIT_CWD: '/p' }, consumer)).toEqual({ run: false, reason: 'ci' });
    });

    it.each(['', '0', 'false'])('treats CI=%s as not CI', (value) => {
        expect(shouldRunPostinstall({ CI: value, INIT_CWD: '/p' }, consumer)).toEqual({ run: true, root: '/p' });
    });

    it('skips global installs', () => {
        expect(shouldRunPostinstall({ npm_config_global: 'true', INIT_CWD: '/p' }, consumer)).toEqual({ run: false, reason: 'global' });
    });

    it('skips without INIT_CWD', () => {
        expect(shouldRunPostinstall({}, consumer)).toEqual({ run: false, reason: 'no-init-cwd' });
    });

    it('skips when the consumer has no package.json', () => {
        expect(shouldRunPostinstall({ INIT_CWD: '/p' }, () => null)).toEqual({ run: false, reason: 'no-consumer-package' });
    });

    it('skips when domain-driver installs itself', () => {
        expect(shouldRunPostinstall({ INIT_CWD: '/p' }, () => 'domain-driver')).toEqual({ run: false, reason: 'self-install' });
    });

    it('runs for a local consumer install', () => {
        expect(shouldRunPostinstall({ INIT_CWD: '/p' }, consumer)).toEqual({ run: true, root: '/p' });
    });
});

describe('readPackageName', () => {
    it('reads the name, returns an empty string when unnamed, null when missing', () => {
        const project = createTempProject('postinstall');
        try {
            expect(readPackageName(process.cwd())).toBeNull();
            writePackageJson({});
            expect(readPackageName(process.cwd())).toBe('fixture');
        } finally {
            project.cleanup();
        }
    });
});

describe('run', () => {
    it('calls init with the consumer root and prints one line per file', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const init = vi.fn(() => [{ file: 'AGENTS.md', status: 'created' as const }]);
        run(init, { INIT_CWD: '/consumer' }, () => 'my-app');
        expect(init).toHaveBeenCalledWith('/consumer');
        expect(log).toHaveBeenCalledWith('domain-driver: AGENTS.md created');
    });

    it('does nothing when skipped', () => {
        const init = vi.fn(() => []);
        run(init, { CI: '1', INIT_CWD: '/consumer' }, () => 'my-app');
        expect(init).not.toHaveBeenCalled();
    });

    it('never throws', () => {
        const init = vi.fn(() => {
            throw new Error('disk full');
        });
        expect(() => run(init, { INIT_CWD: '/consumer' }, () => 'my-app')).not.toThrow();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/postinstall.test.ts`
Expected: FAIL with "Failed to resolve import '../postinstall'"

- [ ] **Step 3: Write postinstall.ts and the shim**

```ts
// src/postinstall.ts
import * as fs from 'fs';
import * as path from 'path';
import { InitResult, runInit } from './init/init';

export type SkipReason = 'ci' | 'global' | 'no-init-cwd' | 'no-consumer-package' | 'self-install';

export type PostinstallDecision =
    | { readonly run: true; readonly root: string }
    | { readonly run: false; readonly reason: SkipReason };

export type PackageNameReader = (root: string) => string | null;
export type InitRunner = (root: string) => readonly InitResult[];

const NOT_CI = new Set(['', '0', 'false']);

export function shouldRunPostinstall(env: NodeJS.ProcessEnv, readName: PackageNameReader): PostinstallDecision {
    if (env.CI !== undefined && !NOT_CI.has(env.CI)) return { run: false, reason: 'ci' };
    if (env.npm_config_global === 'true') return { run: false, reason: 'global' };

    const root = env.INIT_CWD;
    if (!root) return { run: false, reason: 'no-init-cwd' };

    const name = readName(root);
    if (name === null) return { run: false, reason: 'no-consumer-package' };
    if (name === 'domain-driver') return { run: false, reason: 'self-install' };

    return { run: true, root };
}

export function readPackageName(root: string): string | null {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
        const name = (parsed as { name?: unknown }).name;
        return typeof name === 'string' ? name : '';
    } catch {
        return null;
    }
}

export function run(
    init: InitRunner = runInit,
    env: NodeJS.ProcessEnv = process.env,
    readName: PackageNameReader = readPackageName
): void {
    try {
        const decision = shouldRunPostinstall(env, readName);
        if (!decision.run) return;
        for (const result of init(decision.root)) {
            console.log(`domain-driver: ${result.file} ${result.status}`);
        }
    } catch {
        // A postinstall must never fail an install.
    }
}
```

```js
// scripts/postinstall.js
// Runs after `npm install` in a consuming project. Never fails the install:
// dist/ may be absent on a fresh clone, and init may throw for any reason.
try {
    require('../dist/postinstall.js').run();
} catch (_error) {
    // intentionally silent
}
```

- [ ] **Step 4: Update package.json**

Add the script and the allow-list (everything else unchanged):

```json
  "files": [
    "dist",
    "scripts/postinstall.js"
  ],
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "postinstall": "node ./scripts/postinstall.js"
  },
```

`README.md`, `package.json`, and `LICENSE` are always included by npm; `.claude/settings.local.json` and `.github/` stop shipping.

- [ ] **Step 5: Run the unit tests**

Run: `npx vitest run src/__tests__/postinstall.test.ts`
Expected: PASS, 11 tests

- [ ] **Step 6: Smoke-test the real install path with a packed tarball**

```bash
npm run build
REPO="$(pwd)"
PACK="$(mktemp -d)"
npm pack --silent --pack-destination "$PACK"
TGZ="$(ls "$PACK"/domain-driver-*.tgz)"
tar -tzf "$TGZ" | sort

LOCAL="$(mktemp -d)"; cd "$LOCAL"
printf '{"name":"consumer","version":"1.0.0"}' > package.json
npm install --silent "$TGZ"
ls AGENTS.md CLAUDE.md .claude/skills/domain-driver/SKILL.md

CI_DIR="$(mktemp -d)"; cd "$CI_DIR"
printf '{"name":"consumer","version":"1.0.0"}' > package.json
CI=1 npm install --silent "$TGZ"
ls AGENTS.md 2>&1

cd "$REPO"
npm install --silent
git status --short
```

Expected:
- The tarball lists `package/dist/...`, `package/scripts/postinstall.js`, `package/package.json`, `package/README.md`, and nothing under `.claude` or `.github`.
- The local consumer has all three guidance files after install.
- The `CI=1` consumer prints `ls: AGENTS.md: No such file or directory`.
- Reinstalling in the repo itself (self-install) writes nothing; `git status --short` shows only the intended changes for this task (no stray `AGENTS.md` in the repo root).

- [ ] **Step 7: Run everything and commit**

Run: `npx vitest run && npm run build`
Expected: PASS

```bash
git add src/postinstall.ts src/__tests__/postinstall.test.ts scripts/postinstall.js package.json package-lock.json
git commit -m "feat: guarded postinstall runs init for local, non-CI installs"
```

---

### Task 8: README, package description, coverage

**Files:**
- Modify: `README.md`, `package.json` (description only)

- [ ] **Step 1: Update the package description**

In `package.json` set `"description": "CLI scaffolding tool for domain-driven feature folders in Next.js, React, Node, and NestJS projects, with per-action files, bespoke actions, and agent guidance"`.

- [ ] **Step 2: Rewrite the README command sections**

Replace the README from the `## Commands` heading down to (not including) `## Philosophy` with:

````markdown
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
| `node` | service, repository, controller for the detected framework, plus the line to add to `<feature>.routes.ts` printed |
| `nest` | injectable service and repository, `@Controller` class, DTO with input, plus the classes to register printed |
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

**On install.** A local `npm install domain-driver` in a project runs `init` automatically. It does nothing when `CI` is set, for global installs, when there is no `package.json` in the installing project, or when domain-driver installs itself. Opt out with `npm install --ignore-scripts`, or delete the marked section afterwards.

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
````

Also update the roadmap: mark `- [x] Bespoke actions with make:action` and `- [x] Agent guidance with init and a guarded postinstall`, keep the unchecked items.

- [ ] **Step 3: Run coverage and the full check**

Run: `npm run build && npm test && npm run test:coverage`
Expected: PASS with every threshold met. If a threshold fails, the report names the file; add a focused test for the uncovered branch in that file's existing suite.

- [ ] **Step 4: Commit**

```bash
git add README.md package.json
git commit -m "docs: README for targets, make:action, and init; package description"
```

---

## Self-review notes

- Spec 3: Task 4. Spec 4.1 to 4.4: Tasks 1 and 5. Spec 4.5: Tasks 1 to 3 (the byte-identity guarantee is enforced by leaving every existing assertion and the per-stack integration trees untouched). Spec 5: Task 6. Spec 6: Task 7. Spec 7: Tasks 4, 5, 6. Spec 8: file structure table. Spec 10: target parsing (Task 4), action specs (Task 1), template regression (Tasks 2, 3 via unchanged assertions), custom action templates (Tasks 2, 3), make:action integration (Task 5), init (Task 6), postinstall guard and packed-tarball smoke test (Task 7), CLI smoke tests (Tasks 4, 5, 6).
- One deviation from the spec's layout: `signatures.ts` survives with only `domainImports` rather than merging into `actions.ts`, keeping template import paths stable. `shape.ts` keeps its name for the same reason.
- Type consistency: every template takes `(ctx, spec, [entity,] fromFile)`; Express, Fastify, and Hono drop the unused `entity`; `node.ts` and `nest.ts` keep it. `writeSpecFiles` mirrors `writeActionFiles` with `spec.name` as the file base. `makeFeature`'s third parameter is optional so the four existing call sites in tests keep compiling.
- The spec lists `src/commands/init.ts` as a thin wrapper; the plan wires `runInit` straight into `src/index.ts` because the wrapper would hold only the icon table. `src/init/init.ts` is the tested unit either way.
