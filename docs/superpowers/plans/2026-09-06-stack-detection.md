# Stack Detection and Multi-Framework Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make domain-driver detect the project's stack (`next-fullstack`, `next-frontend`, `react`, `node`, `nest`) and generate only the layers that stack needs, with per-action files in every layer.

**Architecture:** A detector reads `package.json` once and returns a frozen `DetectedStack`. A registry maps each stack name to a `StackProfile` declaring folders, layers, and layer directories. Templates are pure functions from a `RenderContext` to a string. Commands are thin: resolve the feature, assert the layer exists in the profile, pick the template, write the file.

**Tech Stack:** TypeScript 5.9 (strict, commonjs, ES2020), Node 18+, commander 14, vitest 4.

**Spec:** `docs/superpowers/specs/2026-09-06-stack-detection-design.md`

## Global Constraints

- Stack names are exactly `next-fullstack`, `next-frontend`, `react`, `node`, `nest`.
- Actions are exactly `List`, `Show`, `Create`, `Update`, `Delete`. Schemas and DTOs exist only for `Create` and `Update`.
- File naming: `<Action><Entity>.<layer>.ts`; types `<Entity>.types.ts`; hook `use<Entity>.ts`; container `<Entity>Container.tsx`; component `<Entity>.tsx`; routes `<feature>.routes.ts`; module `<feature>.module.ts`; Next route handlers `route.ts`.
- Feature names must match `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`.
- Never overwrite an existing file. Service, repository, schema, DTO, types, controller, and route files warn `⚠️  Skipping "<file>" — already exists` and continue. Component, container, and hook throw `... already exists at <path>` as today.
- Never edit an existing user file. Nest single-layer commands print a register hint instead.
- Immutability: every exported object is `readonly` and frozen with `Object.freeze`; functions return new values.
- Files stay under 400 lines; functions under 50 lines; no nesting deeper than 4.
- Error messages are copied verbatim from the spec (sections 3.6, 5.1, 6.5, 6.6, 7).
- Tests: vitest, temporary directories, `process.chdir`, caches reset between tests. Coverage target 80 percent.
- Commit after every task with a conventional commit message. Do not push.
- Build must stay green (`npm run build`) after every task.

## File Structure

| File | Responsibility |
|---|---|
| `src/stack/types.ts` | `StackName`, `HttpFramework`, `DetectedStack`, `Layer`, `Side`, `SideOption`, `StackProfile`, `isStackName` |
| `src/stack/detect.ts` | `detectStack`, `resetStackCache`, `describeStack` |
| `src/stack/profiles/*.ts` | One frozen `StackProfile` per stack |
| `src/stack/registry.ts` | `getProfile`, `hasLayer`, `layerDir`, `componentDir`, `availableCommands`, `assertLayer` |
| `src/utils/naming.ts` | `toPascalCase`, `lowerFirst`, `validateFeatureName` |
| `src/utils/fs.ts` | `writeFileSafe`, `mkdirSafe`, `fileExists`, `isDirectory` |
| `src/utils/alias.ts` | `detectAlias`, `resetAliasCache` |
| `src/utils/imports.ts` | `resolveImport(fromFile, toFile)` |
| `src/utils/paths.ts` | `featureDir`, `apiRouteDir` |
| `src/templates/actions.ts` | `ACTIONS`, `WRITE_ACTIONS`, `Action`, `WriteAction` |
| `src/templates/signatures.ts` | `actionSignature`, `domainImports` |
| `src/templates/context.ts` | `RenderContext`, `createContext` |
| `src/templates/shared/{types,schema}.ts` | Types and Zod schema templates |
| `src/templates/frontend/{page,component,container,hook,client-repository}.ts` | Frontend templates |
| `src/templates/service.ts` | Service template for both sides (one template, `side` parameter) |
| `src/templates/backend/server-repository.ts` | Database-agnostic repository stub |
| `src/templates/controllers/{shape,express,fastify,hono,generic,node,next-route,nest}.ts` | Controller and routes templates |
| `src/templates/nest/{dto,module}.ts` | Nest DTO and module templates |
| `src/commands/resolve.ts` | `resolveFeature`, `requireFeature`, `ensureLayerDir` |
| `src/commands/write.ts` | `writeIfAbsent`, `writeActionFiles` |
| `src/commands/sides.ts` | `parseSide`, `resolveSides`, `SERVICE_SIDES`, `REPOSITORY_SIDES` |
| `src/commands/hints.ts` | `hintNestjsZod`, `hintRegisterInModule`, `resetHints` |
| `src/commands/{feature,component,container,hook,service,repository,schema,types,controller}.ts` | One thin command each |
| `src/index.ts` | Commander wiring, `--stack`, `Stack:` line, single error handler |
| `src/__tests__/helpers/project.ts` | Temp project, fixture writers, file listing |
| `src/__tests__/helpers/context.ts` | `contextFor(stack, feature)` for template tests |

`src/utils.ts` (old) stays until Task 18 so the old commands keep compiling while the new ones are built alongside. TypeScript and vitest both resolve `../utils` to `../utils.ts` before `../utils/index.ts`, so the old file and the new directory coexist.

---

### Task 1: Stack types and naming utilities

**Files:**
- Create: `src/stack/types.ts`
- Create: `src/utils/naming.ts`
- Test: `src/utils/__tests__/naming.test.ts`
- Test: `src/stack/__tests__/types.test.ts`

**Interfaces:**
- Produces: everything in `src/stack/types.ts` (below), `toPascalCase(name: string): string`, `lowerFirst(name: string): string`, `validateFeatureName(name: string): void`.

- [ ] **Step 1: Write the failing naming tests**

```ts
// src/utils/__tests__/naming.test.ts
import { describe, it, expect } from 'vitest';
import { toPascalCase, lowerFirst, validateFeatureName } from '../naming';

describe('toPascalCase', () => {
    it('converts kebab-case to PascalCase', () => {
        expect(toPascalCase('coffee-type')).toBe('CoffeeType');
    });

    it('handles a single word', () => {
        expect(toPascalCase('user')).toBe('User');
    });

    it('handles multiple hyphens', () => {
        expect(toPascalCase('my-long-feature-name')).toBe('MyLongFeatureName');
    });
});

describe('lowerFirst', () => {
    it('lowercases the first character only', () => {
        expect(lowerFirst('CreateCat')).toBe('createCat');
    });

    it('returns an empty string unchanged', () => {
        expect(lowerFirst('')).toBe('');
    });
});

describe('validateFeatureName', () => {
    it.each(['cat', 'coffee-type', 'a1', 'v2-api'])('accepts %s', (name) => {
        expect(() => validateFeatureName(name)).not.toThrow();
    });

    it.each(['Cat', 'coffee_type', '-cat', 'cat-', 'coffee--type', 'coffee type', ''])(
        'rejects %s',
        (name) => {
            expect(() => validateFeatureName(name)).toThrow(
                `Feature name "${name}" must be kebab-case, for example coffee-type.`
            );
        }
    );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/utils/__tests__/naming.test.ts`
Expected: FAIL with "Failed to resolve import '../naming'"

- [ ] **Step 3: Write the naming module**

```ts
// src/utils/naming.ts
const FEATURE_NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function toPascalCase(name: string): string {
    return name
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

export function lowerFirst(name: string): string {
    return name.charAt(0).toLowerCase() + name.slice(1);
}

export function validateFeatureName(name: string): void {
    if (!FEATURE_NAME_PATTERN.test(name)) {
        throw new Error(`Feature name "${name}" must be kebab-case, for example coffee-type.`);
    }
}
```

- [ ] **Step 4: Run the naming tests to verify they pass**

Run: `npx vitest run src/utils/__tests__/naming.test.ts`
Expected: PASS, 12 tests

- [ ] **Step 5: Write the failing types test**

```ts
// src/stack/__tests__/types.test.ts
import { describe, it, expect } from 'vitest';
import { STACK_NAMES, HTTP_FRAMEWORKS, LAYERS, isStackName } from '../types';

describe('stack types', () => {
    it('lists the five stacks in priority order', () => {
        expect(STACK_NAMES).toEqual(['next-fullstack', 'next-frontend', 'react', 'node', 'nest']);
    });

    it('lists http frameworks in detection order', () => {
        expect(HTTP_FRAMEWORKS).toEqual(['express', 'fastify', 'hono']);
    });

    it('lists every layer', () => {
        expect(LAYERS).toHaveLength(13);
        expect(LAYERS).toContain('clientRepository');
        expect(LAYERS).toContain('module');
    });

    it('isStackName guards unknown values', () => {
        expect(isStackName('nest')).toBe(true);
        expect(isStackName('remix')).toBe(false);
    });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run src/stack/__tests__/types.test.ts`
Expected: FAIL with "Failed to resolve import '../types'"

- [ ] **Step 7: Write the types module**

```ts
// src/stack/types.ts
export const STACK_NAMES = ['next-fullstack', 'next-frontend', 'react', 'node', 'nest'] as const;
export type StackName = (typeof STACK_NAMES)[number];

export const HTTP_FRAMEWORKS = ['express', 'fastify', 'hono'] as const;
export type HttpFramework = (typeof HTTP_FRAMEWORKS)[number];

export type StackSource = 'detected' | 'override';

export interface DetectedStack {
    readonly stack: StackName;
    readonly source: StackSource;
    readonly httpFramework: HttpFramework | null;
    readonly featureRoot: string;
    readonly hasNestjsZod: boolean;
}

export const LAYERS = [
    'page',
    'component',
    'container',
    'hook',
    'clientService',
    'clientRepository',
    'serverService',
    'serverRepository',
    'controller',
    'module',
    'dto',
    'schema',
    'types',
] as const;
export type Layer = (typeof LAYERS)[number];

export type Side = 'client' | 'server';
export type SideOption = Side | 'both';

export interface StackProfile {
    readonly name: StackName;
    readonly folders: readonly string[];
    readonly layers: readonly Layer[];
    readonly layerDirs: Readonly<Partial<Record<Layer, string>>>;
    readonly clientDirective: boolean;
    readonly serverComponents: boolean;
}

export function isStackName(value: string): value is StackName {
    return (STACK_NAMES as readonly string[]).includes(value);
}
```

- [ ] **Step 8: Run all tests and the build**

Run: `npx vitest run && npm run build`
Expected: all tests PASS (old suites plus the 16 new ones), build succeeds

- [ ] **Step 9: Commit**

```bash
git add src/stack/types.ts src/stack/__tests__/types.test.ts src/utils/naming.ts src/utils/__tests__/naming.test.ts
git commit -m "feat: add stack types and naming utilities"
```

---

### Task 2: Stack detector

**Files:**
- Create: `src/stack/detect.ts`
- Create: `src/__tests__/helpers/project.ts`
- Test: `src/stack/__tests__/detect.test.ts`

**Interfaces:**
- Consumes: `DetectedStack`, `StackName`, `STACK_NAMES`, `HTTP_FRAMEWORKS`, `isStackName` from Task 1.
- Produces: `detectStack(override?: string): DetectedStack`, `resetStackCache(): void`, `describeStack(stack: DetectedStack): string`. Test helpers `createTempProject(prefix): TempProject`, `resetCaches()`, `writePackageJson(deps, devDeps?)`, `writeTsconfig(paths)`, `mkdir(relative)`, `readProjectFile(relative)`, `projectFileExists(relative)`, `listFiles(relativeRoot)`.

- [ ] **Step 1: Write the test helper**

```ts
// src/__tests__/helpers/project.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resetStackCache } from '../../stack/detect';

export interface TempProject {
    readonly dir: string;
    readonly cleanup: () => void;
}

export function resetCaches(): void {
    resetStackCache();
}

export function createTempProject(prefix: string): TempProject {
    const originalCwd = process.cwd();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `dd-${prefix}-`));
    process.chdir(dir);
    resetCaches();
    return Object.freeze({
        dir,
        cleanup: () => {
            process.chdir(originalCwd);
            resetCaches();
            fs.rmSync(dir, { recursive: true, force: true });
        },
    });
}

export function writePackageJson(
    dependencies: Record<string, string>,
    devDependencies: Record<string, string> = {}
): void {
    const content = JSON.stringify(
        { name: 'fixture', version: '0.0.0', dependencies, devDependencies },
        null,
        2
    );
    fs.writeFileSync(path.join(process.cwd(), 'package.json'), content);
}

export function writeTsconfig(paths: Record<string, string[]>): void {
    fs.writeFileSync(
        path.join(process.cwd(), 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { paths } }, null, 2)
    );
}

export function mkdir(relative: string): void {
    fs.mkdirSync(path.join(process.cwd(), relative), { recursive: true });
}

export function readProjectFile(relative: string): string {
    return fs.readFileSync(path.join(process.cwd(), relative), 'utf-8');
}

export function projectFileExists(relative: string): boolean {
    return fs.existsSync(path.join(process.cwd(), relative));
}

export function listFiles(relativeRoot: string): string[] {
    const root = path.join(process.cwd(), relativeRoot);
    const walk = (dir: string): string[] =>
        fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) return walk(full);
            return [path.relative(root, full).split(path.sep).join('/')];
        });
    return walk(root).sort();
}
```

- [ ] **Step 2: Write the failing detector tests**

```ts
// src/stack/__tests__/detect.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { detectStack, describeStack, resetStackCache } from '../detect';
import { createTempProject, writePackageJson, mkdir, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('detect');
});

afterEach(() => project.cleanup());

describe('detectStack rules', () => {
    it('detects nest before next and express', () => {
        writePackageJson({ '@nestjs/core': '1', next: '1', express: '1' });
        expect(detectStack().stack).toBe('nest');
    });

    it.each(['app/api', 'src/app/api', 'pages/api', 'src/pages/api'])(
        'detects next-fullstack when %s exists',
        (dir) => {
            writePackageJson({ next: '1', react: '1' });
            mkdir(dir);
            expect(detectStack().stack).toBe('next-fullstack');
        }
    );

    it('detects next-frontend when no api directory exists', () => {
        writePackageJson({ next: '1', react: '1' });
        expect(detectStack().stack).toBe('next-frontend');
    });

    it('detects react when react is present and next is absent', () => {
        writePackageJson({ react: '1' });
        expect(detectStack().stack).toBe('react');
    });

    it('detects node when nothing matches', () => {
        writePackageJson({ express: '1' });
        expect(detectStack().stack).toBe('node');
    });

    it('reads devDependencies too', () => {
        writePackageJson({}, { next: '1' });
        expect(detectStack().stack).toBe('next-frontend');
    });

    it('marks the source as detected', () => {
        writePackageJson({});
        expect(detectStack().source).toBe('detected');
    });
});

describe('secondary detection', () => {
    it.each([
        [{ express: '1' }, 'express'],
        [{ fastify: '1' }, 'fastify'],
        [{ hono: '1' }, 'hono'],
        [{ fastify: '1', express: '1' }, 'express'],
        [{}, null],
    ])('records the http framework for %o as %s', (deps, expected) => {
        writePackageJson(deps);
        expect(detectStack().httpFramework).toBe(expected);
    });

    it('leaves the http framework null on non-node stacks', () => {
        writePackageJson({ next: '1', express: '1' });
        expect(detectStack().httpFramework).toBeNull();
    });

    it('uses src/app for next when it exists', () => {
        writePackageJson({ next: '1' });
        mkdir('src/app');
        expect(detectStack().featureRoot).toBe('src/app');
    });

    it('uses app for next otherwise', () => {
        writePackageJson({ next: '1' });
        expect(detectStack().featureRoot).toBe('app');
    });

    it.each(['react', 'express'])('uses src/features for %s when src exists', (dep) => {
        writePackageJson({ [dep]: '1' });
        mkdir('src');
        expect(detectStack().featureRoot).toBe('src/features');
    });

    it('uses features for react without src', () => {
        writePackageJson({ react: '1' });
        expect(detectStack().featureRoot).toBe('features');
    });

    it('uses src for nest', () => {
        writePackageJson({ '@nestjs/core': '1' });
        expect(detectStack().featureRoot).toBe('src');
    });

    it('records nestjs-zod presence', () => {
        writePackageJson({ '@nestjs/core': '1', 'nestjs-zod': '1' });
        expect(detectStack().hasNestjsZod).toBe(true);
    });

    it('records nestjs-zod absence', () => {
        writePackageJson({ '@nestjs/core': '1' });
        expect(detectStack().hasNestjsZod).toBe(false);
    });
});

describe('override', () => {
    it('sets the stack and marks the source', () => {
        writePackageJson({ next: '1' });
        const result = detectStack('node');
        expect(result.stack).toBe('node');
        expect(result.source).toBe('override');
    });

    it('works without a package.json', () => {
        expect(detectStack('react').stack).toBe('react');
    });

    it('still detects the http framework from disk', () => {
        writePackageJson({ hono: '1' });
        expect(detectStack('node').httpFramework).toBe('hono');
    });

    it('rejects an unknown stack name', () => {
        writePackageJson({});
        expect(() => detectStack('remix')).toThrow(
            'Unknown stack "remix". Valid stacks: next-fullstack, next-frontend, react, node, nest.'
        );
    });
});

describe('errors', () => {
    it('fails without a package.json', () => {
        expect(() => detectStack()).toThrow(
            `No package.json found in ${process.cwd()}. Run domain-driver from your project root, or pass --stack <name>.`
        );
    });

    it('fails on malformed package.json', () => {
        fs.writeFileSync('package.json', '{ not json');
        expect(() => detectStack()).toThrow(/^Could not parse package\.json: /);
    });
});

describe('cache', () => {
    it('returns the same frozen object on repeated calls', () => {
        writePackageJson({ react: '1' });
        const first = detectStack();
        expect(detectStack()).toBe(first);
        expect(Object.isFrozen(first)).toBe(true);
    });

    it('re-detects after reset', () => {
        writePackageJson({ react: '1' });
        detectStack();
        writePackageJson({ next: '1' });
        resetStackCache();
        expect(detectStack().stack).toBe('next-frontend');
    });
});

describe('describeStack', () => {
    it('describes a non-node stack', () => {
        writePackageJson({ next: '1' });
        expect(describeStack(detectStack())).toBe('Stack: next-frontend (detected)');
    });

    it('describes node with its framework', () => {
        writePackageJson({ fastify: '1' });
        expect(describeStack(detectStack())).toBe('Stack: node (detected), http: fastify');
    });

    it('describes node without a framework under override', () => {
        expect(describeStack(detectStack('node'))).toBe('Stack: node (override), http: none');
    });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/stack/__tests__/detect.test.ts`
Expected: FAIL with "Failed to resolve import '../detect'"

- [ ] **Step 4: Write the detector**

```ts
// src/stack/detect.ts
import * as fs from 'fs';
import * as path from 'path';
import {
    DetectedStack,
    HttpFramework,
    HTTP_FRAMEWORKS,
    StackName,
    STACK_NAMES,
    isStackName,
} from './types';

const API_DIRS = ['app/api', 'src/app/api', 'pages/api', 'src/pages/api'] as const;

interface PackageJson {
    readonly dependencies?: Record<string, string>;
    readonly devDependencies?: Record<string, string>;
}

let cached: DetectedStack | undefined;

export function resetStackCache(): void {
    cached = undefined;
}

export function detectStack(override?: string): DetectedStack {
    if (cached) return cached;

    const cwd = process.cwd();
    const overridden = override !== undefined;
    const deps = readDependencies(cwd, overridden);
    const stack = overridden ? parseOverride(override) : inferStack(cwd, deps);

    const result: DetectedStack = Object.freeze({
        stack,
        source: overridden ? 'override' : 'detected',
        httpFramework: stack === 'node' ? detectHttpFramework(deps) : null,
        featureRoot: resolveFeatureRoot(cwd, stack),
        hasNestjsZod: deps.has('nestjs-zod'),
    });

    cached = result;
    return result;
}

export function describeStack(stack: DetectedStack): string {
    const base = `Stack: ${stack.stack} (${stack.source})`;
    if (stack.stack !== 'node') return base;
    return `${base}, http: ${stack.httpFramework ?? 'none'}`;
}

function readDependencies(cwd: string, optional: boolean): ReadonlySet<string> {
    const pkgPath = path.join(cwd, 'package.json');

    if (!fs.existsSync(pkgPath)) {
        if (optional) return new Set();
        throw new Error(
            `No package.json found in ${cwd}. Run domain-driver from your project root, or pass --stack <name>.`
        );
    }

    const pkg = parsePackageJson(pkgPath);
    return new Set([
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.devDependencies ?? {}),
    ]);
}

function parsePackageJson(pkgPath: string): PackageJson {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return (parsed ?? {}) as PackageJson;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Could not parse package.json: ${message}`);
    }
}

function parseOverride(value: string): StackName {
    if (isStackName(value)) return value;
    throw new Error(`Unknown stack "${value}". Valid stacks: ${STACK_NAMES.join(', ')}.`);
}

function inferStack(cwd: string, deps: ReadonlySet<string>): StackName {
    if (deps.has('@nestjs/core')) return 'nest';
    if (deps.has('next')) return hasApiDir(cwd) ? 'next-fullstack' : 'next-frontend';
    if (deps.has('react')) return 'react';
    return 'node';
}

function hasApiDir(cwd: string): boolean {
    return API_DIRS.some((dir) => isDirectory(path.join(cwd, dir)));
}

function detectHttpFramework(deps: ReadonlySet<string>): HttpFramework | null {
    return HTTP_FRAMEWORKS.find((name) => deps.has(name)) ?? null;
}

function resolveFeatureRoot(cwd: string, stack: StackName): string {
    switch (stack) {
        case 'next-fullstack':
        case 'next-frontend':
            return isDirectory(path.join(cwd, 'src', 'app')) ? 'src/app' : 'app';
        case 'react':
        case 'node':
            return isDirectory(path.join(cwd, 'src')) ? 'src/features' : 'features';
        case 'nest':
            return 'src';
    }
}

function isDirectory(target: string): boolean {
    return fs.existsSync(target) && fs.statSync(target).isDirectory();
}
```

- [ ] **Step 5: Run the detector tests to verify they pass**

Run: `npx vitest run src/stack/__tests__/detect.test.ts`
Expected: PASS, 35 tests

- [ ] **Step 6: Run all tests and the build**

Run: `npx vitest run && npm run build`
Expected: PASS, build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/stack/detect.ts src/stack/__tests__/detect.test.ts src/__tests__/helpers/project.ts
git commit -m "feat: add stack detector with override and secondary detection"
```

---

### Task 3: Profiles and registry

**Files:**
- Create: `src/stack/profiles/next-fullstack.ts`, `src/stack/profiles/next-frontend.ts`, `src/stack/profiles/react.ts`, `src/stack/profiles/node.ts`, `src/stack/profiles/nest.ts`
- Create: `src/stack/registry.ts`
- Test: `src/stack/__tests__/registry.test.ts`

**Interfaces:**
- Consumes: `StackProfile`, `StackName`, `Layer` from Task 1.
- Produces: `getProfile(stack: StackName): StackProfile`, `hasLayer(profile, layer): boolean`, `layerDir(profile, layer): string`, `componentDir(profile, type: 'client' | 'server'): string`, `availableCommands(profile): readonly string[]`, `assertLayer(profile, layer, command: string): void`.

- [ ] **Step 1: Write the failing registry tests**

```ts
// src/stack/__tests__/registry.test.ts
import { describe, it, expect } from 'vitest';
import { getProfile, hasLayer, layerDir, componentDir, availableCommands, assertLayer } from '../registry';
import { STACK_NAMES } from '../types';

describe('profiles', () => {
    it.each(STACK_NAMES)('%s profile is frozen and named', (name) => {
        const profile = getProfile(name);
        expect(profile.name).toBe(name);
        expect(Object.isFrozen(profile)).toBe(true);
    });

    it('next-fullstack declares split client and server folders', () => {
        expect(getProfile('next-fullstack').folders).toEqual([
            'components/client',
            'components/server',
            'containers',
            'hooks',
            'client/services',
            'client/repositories',
            'server/services',
            'server/repositories',
            'schemas',
            'types',
        ]);
    });

    it('next-frontend keeps the current layout', () => {
        expect(getProfile('next-frontend').folders).toEqual([
            'components/client',
            'components/server',
            'containers',
            'hooks',
            'services',
            'repositories',
            'schemas',
            'types',
        ]);
    });

    it('react flattens components and has no page', () => {
        const profile = getProfile('react');
        expect(profile.folders).toEqual([
            'components',
            'containers',
            'hooks',
            'services',
            'repositories',
            'schemas',
            'types',
        ]);
        expect(hasLayer(profile, 'page')).toBe(false);
        expect(profile.clientDirective).toBe(false);
        expect(profile.serverComponents).toBe(false);
    });

    it('node has backend layers only', () => {
        const profile = getProfile('node');
        expect(profile.folders).toEqual(['controllers', 'services', 'repositories', 'schemas', 'types']);
        expect(profile.layers).toEqual(['serverService', 'serverRepository', 'controller', 'schema', 'types']);
    });

    it('nest adds dto and module layers', () => {
        const profile = getProfile('nest');
        expect(profile.folders).toEqual(['controllers', 'services', 'repositories', 'schemas', 'dto', 'types']);
        expect(hasLayer(profile, 'module')).toBe(true);
        expect(hasLayer(profile, 'dto')).toBe(true);
        expect(hasLayer(profile, 'hook')).toBe(false);
    });

    it('next profiles emit the client directive and have server components', () => {
        for (const name of ['next-fullstack', 'next-frontend'] as const) {
            expect(getProfile(name).clientDirective).toBe(true);
            expect(getProfile(name).serverComponents).toBe(true);
        }
    });
});

describe('layerDir', () => {
    it('maps fullstack client and server layers to their subfolders', () => {
        const profile = getProfile('next-fullstack');
        expect(layerDir(profile, 'clientService')).toBe('client/services');
        expect(layerDir(profile, 'serverRepository')).toBe('server/repositories');
    });

    it('maps node layers to top-level folders', () => {
        expect(layerDir(getProfile('node'), 'controller')).toBe('controllers');
    });

    it('throws for a layer the profile lacks', () => {
        expect(() => layerDir(getProfile('node'), 'hook')).toThrow(
            'Layer "hook" has no directory in the node profile.'
        );
    });
});

describe('componentDir', () => {
    it('splits by type when the stack has server components', () => {
        expect(componentDir(getProfile('next-frontend'), 'server')).toBe('components/server');
        expect(componentDir(getProfile('next-frontend'), 'client')).toBe('components/client');
    });

    it('flattens for react', () => {
        expect(componentDir(getProfile('react'), 'client')).toBe('components');
    });
});

describe('assertLayer', () => {
    it('passes when the layer exists', () => {
        expect(() => assertLayer(getProfile('react'), 'hook', 'make:hook')).not.toThrow();
    });

    it('lists available commands when the layer is missing', () => {
        expect(() => assertLayer(getProfile('node'), 'hook', 'make:hook')).toThrow(
            'make:hook is not available for the node stack. Available: make:service, make:repository, make:controller, make:schema, make:types.'
        );
    });

    it('availableCommands de-duplicates service and repository sides', () => {
        expect(availableCommands(getProfile('next-fullstack'))).toEqual([
            'make:component',
            'make:container',
            'make:hook',
            'make:service',
            'make:repository',
            'make:controller',
            'make:schema',
            'make:types',
        ]);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/stack/__tests__/registry.test.ts`
Expected: FAIL with "Failed to resolve import '../registry'"

- [ ] **Step 3: Write the five profiles**

```ts
// src/stack/profiles/next-fullstack.ts
import { StackProfile } from '../types';

export const nextFullstack: StackProfile = Object.freeze({
    name: 'next-fullstack',
    folders: [
        'components/client',
        'components/server',
        'containers',
        'hooks',
        'client/services',
        'client/repositories',
        'server/services',
        'server/repositories',
        'schemas',
        'types',
    ],
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
    ],
    layerDirs: {
        component: 'components',
        container: 'containers',
        hook: 'hooks',
        clientService: 'client/services',
        clientRepository: 'client/repositories',
        serverService: 'server/services',
        serverRepository: 'server/repositories',
        schema: 'schemas',
        types: 'types',
    },
    clientDirective: true,
    serverComponents: true,
});
```

```ts
// src/stack/profiles/next-frontend.ts
import { StackProfile } from '../types';

export const nextFrontend: StackProfile = Object.freeze({
    name: 'next-frontend',
    folders: [
        'components/client',
        'components/server',
        'containers',
        'hooks',
        'services',
        'repositories',
        'schemas',
        'types',
    ],
    layers: ['page', 'component', 'container', 'hook', 'clientService', 'clientRepository', 'schema', 'types'],
    layerDirs: {
        component: 'components',
        container: 'containers',
        hook: 'hooks',
        clientService: 'services',
        clientRepository: 'repositories',
        schema: 'schemas',
        types: 'types',
    },
    clientDirective: true,
    serverComponents: true,
});
```

```ts
// src/stack/profiles/react.ts
import { StackProfile } from '../types';

export const react: StackProfile = Object.freeze({
    name: 'react',
    folders: ['components', 'containers', 'hooks', 'services', 'repositories', 'schemas', 'types'],
    layers: ['component', 'container', 'hook', 'clientService', 'clientRepository', 'schema', 'types'],
    layerDirs: {
        component: 'components',
        container: 'containers',
        hook: 'hooks',
        clientService: 'services',
        clientRepository: 'repositories',
        schema: 'schemas',
        types: 'types',
    },
    clientDirective: false,
    serverComponents: false,
});
```

```ts
// src/stack/profiles/node.ts
import { StackProfile } from '../types';

export const node: StackProfile = Object.freeze({
    name: 'node',
    folders: ['controllers', 'services', 'repositories', 'schemas', 'types'],
    layers: ['serverService', 'serverRepository', 'controller', 'schema', 'types'],
    layerDirs: {
        serverService: 'services',
        serverRepository: 'repositories',
        controller: 'controllers',
        schema: 'schemas',
        types: 'types',
    },
    clientDirective: false,
    serverComponents: false,
});
```

```ts
// src/stack/profiles/nest.ts
import { StackProfile } from '../types';

export const nest: StackProfile = Object.freeze({
    name: 'nest',
    folders: ['controllers', 'services', 'repositories', 'schemas', 'dto', 'types'],
    layers: ['serverService', 'serverRepository', 'controller', 'module', 'dto', 'schema', 'types'],
    layerDirs: {
        serverService: 'services',
        serverRepository: 'repositories',
        controller: 'controllers',
        dto: 'dto',
        schema: 'schemas',
        types: 'types',
    },
    clientDirective: false,
    serverComponents: false,
});
```

- [ ] **Step 4: Write the registry**

```ts
// src/stack/registry.ts
import { Layer, StackName, StackProfile } from './types';
import { nextFullstack } from './profiles/next-fullstack';
import { nextFrontend } from './profiles/next-frontend';
import { react } from './profiles/react';
import { node } from './profiles/node';
import { nest } from './profiles/nest';

const PROFILES: Readonly<Record<StackName, StackProfile>> = Object.freeze({
    'next-fullstack': nextFullstack,
    'next-frontend': nextFrontend,
    react,
    node,
    nest,
});

const LAYER_COMMANDS: Readonly<Partial<Record<Layer, string>>> = Object.freeze({
    component: 'make:component',
    container: 'make:container',
    hook: 'make:hook',
    clientService: 'make:service',
    serverService: 'make:service',
    clientRepository: 'make:repository',
    serverRepository: 'make:repository',
    controller: 'make:controller',
    schema: 'make:schema',
    dto: 'make:schema',
    types: 'make:types',
});

export function getProfile(stack: StackName): StackProfile {
    return PROFILES[stack];
}

export function hasLayer(profile: StackProfile, layer: Layer): boolean {
    return profile.layers.includes(layer);
}

export function layerDir(profile: StackProfile, layer: Layer): string {
    const dir = profile.layerDirs[layer];
    if (dir === undefined) {
        throw new Error(`Layer "${layer}" has no directory in the ${profile.name} profile.`);
    }
    return dir;
}

export function componentDir(profile: StackProfile, type: 'client' | 'server'): string {
    return profile.serverComponents ? `components/${type}` : 'components';
}

export function availableCommands(profile: StackProfile): readonly string[] {
    const commands = profile.layers
        .map((layer) => LAYER_COMMANDS[layer])
        .filter((command): command is string => command !== undefined);
    return [...new Set(commands)];
}

export function assertLayer(profile: StackProfile, layer: Layer, command: string): void {
    if (hasLayer(profile, layer)) return;
    throw new Error(
        `${command} is not available for the ${profile.name} stack. Available: ${availableCommands(profile).join(', ')}.`
    );
}
```

- [ ] **Step 5: Run the registry tests to verify they pass**

Run: `npx vitest run src/stack/__tests__/registry.test.ts`
Expected: PASS, 17 tests

- [ ] **Step 6: Run all tests and the build**

Run: `npx vitest run && npm run build`
Expected: PASS, build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/stack/profiles src/stack/registry.ts src/stack/__tests__/registry.test.ts
git commit -m "feat: add stack profiles and layer registry"
```

---

### Task 4: File-system, alias, import, and path utilities

**Files:**
- Create: `src/utils/fs.ts`, `src/utils/alias.ts`, `src/utils/imports.ts`, `src/utils/paths.ts`
- Modify: `src/__tests__/helpers/project.ts` (add alias reset)
- Delete: `src/__tests__/utils.test.ts`
- Test: `src/utils/__tests__/alias.test.ts`, `src/utils/__tests__/imports.test.ts`, `src/utils/__tests__/paths.test.ts`

**Interfaces:**
- Consumes: `DetectedStack` from Task 1.
- Produces: `writeFileSafe(filePath, content)`, `mkdirSafe(dirPath)`, `fileExists(filePath): boolean`, `isDirectory(target): boolean`; `AliasConfig { prefix, root }`, `detectAlias(): AliasConfig | null`, `resetAliasCache()`; `resolveImport(fromFile: string, toFile: string): string`; `featureDir(stack, feature): string`, `apiRouteDir(stack, feature): string`.

Behaviour change to note: with `@/* -> ./app/*`, the old resolver produced `@/app/coffee-type/...`, which resolves to `./app/app/coffee-type` and is wrong. The new resolver produces `@/coffee-type/...`. The old test that asserted the wrong output is deleted in this task.

- [ ] **Step 1: Delete the old utils test**

```bash
git rm src/__tests__/utils.test.ts
```

- [ ] **Step 2: Write the fs module (no new behaviour, moved from `src/utils.ts`)**

```ts
// src/utils/fs.ts
import * as fs from 'fs';

export function writeFileSafe(filePath: string, content: string): void {
    try {
        fs.writeFileSync(filePath, content);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to write ${filePath}: ${message}`);
    }
}

export function mkdirSafe(dirPath: string): void {
    try {
        fs.mkdirSync(dirPath, { recursive: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to create directory ${dirPath}: ${message}`);
    }
}

export function fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
}

export function isDirectory(target: string): boolean {
    return fs.existsSync(target) && fs.statSync(target).isDirectory();
}
```

- [ ] **Step 3: Write the failing alias tests**

```ts
// src/utils/__tests__/alias.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { detectAlias, resetAliasCache } from '../alias';
import { createTempProject, writeTsconfig, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('alias');
});

afterEach(() => project.cleanup());

describe('detectAlias', () => {
    it('returns null without a tsconfig', () => {
        expect(detectAlias()).toBeNull();
    });

    it('maps @/* to the project root', () => {
        writeTsconfig({ '@/*': ['./*'] });
        expect(detectAlias()).toEqual({ prefix: '@/', root: '.' });
    });

    it('maps @/* to src', () => {
        writeTsconfig({ '@/*': ['./src/*'] });
        expect(detectAlias()).toEqual({ prefix: '@/', root: 'src' });
    });

    it('maps a custom prefix to app', () => {
        writeTsconfig({ '~/*': ['./app/*'] });
        expect(detectAlias()).toEqual({ prefix: '~/', root: 'app' });
    });

    it('accepts targets without the leading ./', () => {
        writeTsconfig({ '@/*': ['src/*'] });
        expect(detectAlias()).toEqual({ prefix: '@/', root: 'src' });
    });

    it('accepts nested roots', () => {
        writeTsconfig({ '@/*': ['./src/app/*'] });
        expect(detectAlias()).toEqual({ prefix: '@/', root: 'src/app' });
    });

    it('takes the first wildcard entry', () => {
        writeTsconfig({ '@components/*': ['./components/*'], '@/*': ['./*'] });
        expect(detectAlias()).toEqual({ prefix: '@components/', root: 'components' });
    });

    it('ignores keys without a wildcard', () => {
        writeTsconfig({ '@config': ['./config.ts'] });
        expect(detectAlias()).toBeNull();
    });

    it('tolerates comments in tsconfig', () => {
        fs.writeFileSync(
            'tsconfig.json',
            '{\n  // comment\n  "compilerOptions": { /* block */ "paths": { "@/*": ["./*"] } }\n}'
        );
        expect(detectAlias()).toEqual({ prefix: '@/', root: '.' });
    });

    it('returns null on malformed tsconfig', () => {
        fs.writeFileSync('tsconfig.json', '{ nope');
        expect(detectAlias()).toBeNull();
    });

    it('caches until reset', () => {
        expect(detectAlias()).toBeNull();
        writeTsconfig({ '@/*': ['./*'] });
        expect(detectAlias()).toBeNull();
        resetAliasCache();
        expect(detectAlias()).toEqual({ prefix: '@/', root: '.' });
    });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run src/utils/__tests__/alias.test.ts`
Expected: FAIL with "Failed to resolve import '../alias'"

- [ ] **Step 5: Write the alias module**

```ts
// src/utils/alias.ts
import * as fs from 'fs';
import * as path from 'path';

export interface AliasConfig {
    readonly prefix: string;
    readonly root: string;
}

interface TsConfig {
    readonly compilerOptions?: {
        readonly paths?: Record<string, string[]>;
    };
}

const WILDCARD_TARGET = /^(?:\.\/)?(.*?)\/?\*$/;

let cached: AliasConfig | null | undefined;

export function resetAliasCache(): void {
    cached = undefined;
}

export function detectAlias(): AliasConfig | null {
    if (cached !== undefined) return cached;
    cached = readAlias(path.join(process.cwd(), 'tsconfig.json'));
    return cached;
}

function readAlias(tsconfigPath: string): AliasConfig | null {
    if (!fs.existsSync(tsconfigPath)) return null;

    try {
        const raw = fs.readFileSync(tsconfigPath, 'utf-8');
        const stripped = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        const tsconfig = JSON.parse(stripped) as TsConfig;
        return findWildcardAlias(tsconfig.compilerOptions?.paths ?? {});
    } catch {
        return null;
    }
}

function findWildcardAlias(paths: Record<string, string[]>): AliasConfig | null {
    for (const [key, targets] of Object.entries(paths)) {
        if (!key.endsWith('/*')) continue;
        const root = targets.map(aliasRoot).find((candidate) => candidate !== null);
        if (root !== undefined && root !== null) {
            return Object.freeze({ prefix: key.slice(0, -1), root });
        }
    }
    return null;
}

function aliasRoot(target: string): string | null {
    const match = WILDCARD_TARGET.exec(target);
    if (!match) return null;
    return match[1] === '' ? '.' : match[1];
}
```

- [ ] **Step 6: Run the alias tests to verify they pass**

Run: `npx vitest run src/utils/__tests__/alias.test.ts`
Expected: PASS, 11 tests

- [ ] **Step 7: Write the failing import resolver tests**

```ts
// src/utils/__tests__/imports.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { resolveImport } from '../imports';
import { createTempProject, writeTsconfig, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

const abs = (relative: string): string => path.join(process.cwd(), relative);

beforeEach(() => {
    project = createTempProject('imports');
});

afterEach(() => project.cleanup());

describe('resolveImport without alias', () => {
    it('resolves a sibling folder', () => {
        expect(resolveImport(abs('app/cat/hooks/useCat.ts'), abs('app/cat/types/Cat.types.ts'))).toBe(
            '../types/Cat.types'
        );
    });

    it('resolves the same folder with ./', () => {
        expect(
            resolveImport(abs('app/cat/page.tsx'), abs('app/cat/containers/CatContainer.tsx'))
        ).toBe('./containers/CatContainer');
    });

    it('resolves two levels deep', () => {
        expect(
            resolveImport(
                abs('app/cat/client/repositories/CreateCat.repository.ts'),
                abs('app/cat/types/Cat.types.ts')
            )
        ).toBe('../../types/Cat.types');
    });

    it('resolves from a Next api route into the feature', () => {
        expect(
            resolveImport(
                abs('app/api/cat/[id]/route.ts'),
                abs('app/cat/server/services/ShowCat.service.ts')
            )
        ).toBe('../../../cat/server/services/ShowCat.service');
    });

    it('strips .tsx', () => {
        expect(resolveImport(abs('a/x.ts'), abs('a/Y.tsx'))).toBe('./Y');
    });
});

describe('resolveImport with alias', () => {
    it('uses the alias when the root is the project', () => {
        writeTsconfig({ '@/*': ['./*'] });
        expect(resolveImport(abs('app/cat/hooks/useCat.ts'), abs('app/cat/types/Cat.types.ts'))).toBe(
            '@/app/cat/types/Cat.types'
        );
    });

    it('drops the aliased root segment', () => {
        writeTsconfig({ '@/*': ['./app/*'] });
        expect(resolveImport(abs('app/cat/hooks/useCat.ts'), abs('app/cat/types/Cat.types.ts'))).toBe(
            '@/cat/types/Cat.types'
        );
    });

    it('handles src roots', () => {
        writeTsconfig({ '@/*': ['./src/*'] });
        expect(
            resolveImport(abs('src/app/cat/hooks/useCat.ts'), abs('src/app/cat/types/Cat.types.ts'))
        ).toBe('@/app/cat/types/Cat.types');
    });

    it('falls back to relative when the target is outside the alias root', () => {
        writeTsconfig({ '@components/*': ['./components/*'] });
        expect(resolveImport(abs('app/cat/hooks/useCat.ts'), abs('app/cat/types/Cat.types.ts'))).toBe(
            '../types/Cat.types'
        );
    });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npx vitest run src/utils/__tests__/imports.test.ts`
Expected: FAIL with "Failed to resolve import '../imports'"

- [ ] **Step 9: Write the import resolver**

```ts
// src/utils/imports.ts
import * as path from 'path';
import { detectAlias } from './alias';

export function resolveImport(fromFile: string, toFile: string): string {
    const target = stripExtension(toFile);
    const aliased = aliasImport(target);
    if (aliased !== null) return aliased;

    const relative = toPosix(path.relative(path.dirname(fromFile), target));
    return relative.startsWith('.') ? relative : `./${relative}`;
}

function aliasImport(target: string): string | null {
    const alias = detectAlias();
    if (!alias) return null;

    const rootAbs = path.resolve(process.cwd(), alias.root);
    const relative = path.relative(rootAbs, target);
    const inside = relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
    return inside ? `${alias.prefix}${toPosix(relative)}` : null;
}

function stripExtension(file: string): string {
    return file.replace(/\.tsx?$/, '');
}

function toPosix(target: string): string {
    return target.split(path.sep).join('/');
}
```

- [ ] **Step 10: Run the import tests to verify they pass**

Run: `npx vitest run src/utils/__tests__/imports.test.ts`
Expected: PASS, 9 tests

- [ ] **Step 11: Write the failing paths test**

```ts
// src/utils/__tests__/paths.test.ts
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { featureDir, apiRouteDir } from '../paths';
import { DetectedStack } from '../../stack/types';

const stack: DetectedStack = Object.freeze({
    stack: 'next-fullstack',
    source: 'detected',
    httpFramework: null,
    featureRoot: 'src/app',
    hasNestjsZod: false,
});

describe('paths', () => {
    it('featureDir joins cwd, feature root, and feature', () => {
        expect(featureDir(stack, 'cat')).toBe(path.join(process.cwd(), 'src/app', 'cat'));
    });

    it('apiRouteDir joins cwd, feature root, api, and feature', () => {
        expect(apiRouteDir(stack, 'cat')).toBe(path.join(process.cwd(), 'src/app', 'api', 'cat'));
    });
});
```

- [ ] **Step 12: Write the paths module**

```ts
// src/utils/paths.ts
import * as path from 'path';
import { DetectedStack } from '../stack/types';

export function featureDir(stack: DetectedStack, feature: string): string {
    return path.join(process.cwd(), stack.featureRoot, feature);
}

export function apiRouteDir(stack: DetectedStack, feature: string): string {
    return path.join(process.cwd(), stack.featureRoot, 'api', feature);
}
```

- [ ] **Step 13: Add the alias reset to the test helper**

In `src/__tests__/helpers/project.ts`, add the import and extend `resetCaches`:

```ts
import { resetStackCache } from '../../stack/detect';
import { resetAliasCache } from '../../utils/alias';

export function resetCaches(): void {
    resetStackCache();
    resetAliasCache();
}
```

- [ ] **Step 14: Run all tests and the build**

Run: `npx vitest run && npm run build`
Expected: PASS, build succeeds. The old `feature`, `imports`, and `individual` suites still pass because they use the old `src/utils.ts`.

- [ ] **Step 15: Commit**

```bash
git add -A src
git commit -m "feat: add fs, alias, import resolver, and path utilities"
```

---

### Task 5: Render context, actions, signatures, and shared templates

**Files:**
- Create: `src/templates/actions.ts`, `src/templates/signatures.ts`, `src/templates/context.ts`, `src/templates/shared/types.ts`, `src/templates/shared/schema.ts`
- Create: `src/__tests__/helpers/context.ts`
- Test: `src/templates/__tests__/shared.test.ts`, `src/templates/__tests__/signatures.test.ts`

**Interfaces:**
- Consumes: `DetectedStack`, `StackProfile`, `Layer` (Task 1); `getProfile`, `layerDir` (Task 3); `resolveImport`, `featureDir` (Task 4).
- Produces:
  - `ACTIONS: readonly ['List','Show','Create','Update','Delete']`, `WRITE_ACTIONS: readonly ['Create','Update']`, types `Action`, `WriteAction`.
  - `ActionSignature { params, args, returns, usesEntityType, usesSchema }`, `actionSignature(action, entity)`, `domainImports(ctx, fromFile, action, entity): readonly string[]`.
  - `RenderContext { feature, stack, profile, featureDir, importFrom(fromFile, featureRelativePath), importLayer(fromFile, layer, fileName) }`, `createContext(feature, stack, profile)`.
  - `renderTypes(entity)`, `renderSchema(action: WriteAction, entity)`.
  - Test helper `contextFor(stack: StackName, feature: string, extra?: Partial<DetectedStack>): RenderContext`.

- [ ] **Step 1: Write actions and context (no logic worth a failing test on their own; they are exercised by the tests below)**

```ts
// src/templates/actions.ts
export const ACTIONS = ['List', 'Show', 'Create', 'Update', 'Delete'] as const;
export type Action = (typeof ACTIONS)[number];

export const WRITE_ACTIONS = ['Create', 'Update'] as const;
export type WriteAction = (typeof WRITE_ACTIONS)[number];
```

```ts
// src/templates/context.ts
import * as path from 'path';
import { DetectedStack, Layer, StackProfile } from '../stack/types';
import { layerDir } from '../stack/registry';
import { resolveImport } from '../utils/imports';
import { featureDir } from '../utils/paths';

export interface RenderContext {
    readonly feature: string;
    readonly stack: DetectedStack;
    readonly profile: StackProfile;
    readonly featureDir: string;
    readonly importFrom: (fromFile: string, featureRelativePath: string) => string;
    readonly importLayer: (fromFile: string, layer: Layer, fileName: string) => string;
}

export function createContext(feature: string, stack: DetectedStack, profile: StackProfile): RenderContext {
    const dir = featureDir(stack, feature);
    const importFrom = (fromFile: string, relative: string): string =>
        resolveImport(fromFile, path.join(dir, relative));

    return Object.freeze({
        feature,
        stack,
        profile,
        featureDir: dir,
        importFrom,
        importLayer: (fromFile: string, layer: Layer, fileName: string): string =>
            importFrom(fromFile, `${layerDir(profile, layer)}/${fileName}`),
    });
}
```

```ts
// src/__tests__/helpers/context.ts
import { DetectedStack, StackName } from '../../stack/types';
import { getProfile } from '../../stack/registry';
import { createContext, RenderContext } from '../../templates/context';

const DEFAULT_ROOTS: Readonly<Record<StackName, string>> = Object.freeze({
    'next-fullstack': 'app',
    'next-frontend': 'app',
    react: 'src/features',
    node: 'src/features',
    nest: 'src',
});

export function contextFor(
    stack: StackName,
    feature: string,
    extra: Partial<DetectedStack> = {}
): RenderContext {
    const detected: DetectedStack = Object.freeze({
        stack,
        source: 'detected',
        httpFramework: null,
        featureRoot: DEFAULT_ROOTS[stack],
        hasNestjsZod: false,
        ...extra,
    });
    return createContext(feature, detected, getProfile(stack));
}
```

- [ ] **Step 2: Write the failing signature tests**

```ts
// src/templates/__tests__/signatures.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { actionSignature, domainImports } from '../signatures';
import { contextFor } from '../../__tests__/helpers/context';
import { createTempProject, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('signatures');
});

afterEach(() => project.cleanup());

describe('actionSignature', () => {
    it('List takes nothing and returns an array', () => {
        expect(actionSignature('List', 'Cat')).toEqual({
            params: '',
            args: '',
            returns: 'Promise<Cat[]>',
            usesEntityType: true,
            usesSchema: false,
        });
    });

    it('Update takes id and data', () => {
        expect(actionSignature('Update', 'Cat')).toEqual({
            params: 'id: string, data: UpdateCat',
            args: 'id, data',
            returns: 'Promise<Cat>',
            usesEntityType: true,
            usesSchema: true,
        });
    });

    it('Delete returns void and uses no entity type', () => {
        expect(actionSignature('Delete', 'Cat')).toEqual({
            params: 'id: string',
            args: 'id',
            returns: 'Promise<void>',
            usesEntityType: false,
            usesSchema: false,
        });
    });
});

describe('domainImports', () => {
    it('imports type and schema for Create from a top-level layer', () => {
        const ctx = contextFor('next-frontend', 'cat');
        const fromFile = path.join(ctx.featureDir, 'services', 'CreateCat.service.ts');
        expect(domainImports(ctx, fromFile, 'Create', 'Cat')).toEqual([
            "import { Cat } from '../types/Cat.types';",
            "import { CreateCat } from '../schemas/CreateCat.schema';",
        ]);
    });

    it('imports nothing for Delete', () => {
        const ctx = contextFor('next-frontend', 'cat');
        const fromFile = path.join(ctx.featureDir, 'services', 'DeleteCat.service.ts');
        expect(domainImports(ctx, fromFile, 'Delete', 'Cat')).toEqual([]);
    });

    it('walks up two levels from fullstack client layers', () => {
        const ctx = contextFor('next-fullstack', 'cat');
        const fromFile = path.join(ctx.featureDir, 'client', 'services', 'ListCat.service.ts');
        expect(domainImports(ctx, fromFile, 'List', 'Cat')).toEqual([
            "import { Cat } from '../../types/Cat.types';",
        ]);
    });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/templates/__tests__/signatures.test.ts`
Expected: FAIL with "Failed to resolve import '../signatures'"

- [ ] **Step 4: Write the signatures module**

```ts
// src/templates/signatures.ts
import { Action } from './actions';
import { RenderContext } from './context';

export interface ActionSignature {
    readonly params: string;
    readonly args: string;
    readonly returns: string;
    readonly usesEntityType: boolean;
    readonly usesSchema: boolean;
}

export function actionSignature(action: Action, entity: string): ActionSignature {
    switch (action) {
        case 'List':
            return { params: '', args: '', returns: `Promise<${entity}[]>`, usesEntityType: true, usesSchema: false };
        case 'Show':
            return { params: 'id: string', args: 'id', returns: `Promise<${entity}>`, usesEntityType: true, usesSchema: false };
        case 'Create':
            return { params: `data: Create${entity}`, args: 'data', returns: `Promise<${entity}>`, usesEntityType: true, usesSchema: true };
        case 'Update':
            return { params: `id: string, data: Update${entity}`, args: 'id, data', returns: `Promise<${entity}>`, usesEntityType: true, usesSchema: true };
        case 'Delete':
            return { params: 'id: string', args: 'id', returns: 'Promise<void>', usesEntityType: false, usesSchema: false };
    }
}

export function domainImports(
    ctx: RenderContext,
    fromFile: string,
    action: Action,
    entity: string
): readonly string[] {
    const signature = actionSignature(action, entity);
    const lines: string[] = [];

    if (signature.usesEntityType) {
        const typePath = ctx.importLayer(fromFile, 'types', `${entity}.types`);
        lines.push(`import { ${entity} } from '${typePath}';`);
    }
    if (signature.usesSchema) {
        const schemaPath = ctx.importLayer(fromFile, 'schema', `${action}${entity}.schema`);
        lines.push(`import { ${action}${entity} } from '${schemaPath}';`);
    }
    return lines;
}
```

- [ ] **Step 5: Run the signature tests to verify they pass**

Run: `npx vitest run src/templates/__tests__/signatures.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 6: Write the failing shared template tests**

```ts
// src/templates/__tests__/shared.test.ts
import { describe, it, expect } from 'vitest';
import { renderTypes } from '../shared/types';
import { renderSchema } from '../shared/schema';

describe('renderTypes', () => {
    it('renders an interface with id and timestamps', () => {
        const content = renderTypes('Cat');
        expect(content).toContain('export interface Cat {');
        expect(content).toContain('id: string;');
        expect(content).toContain('createdAt: string;');
    });
});

describe('renderSchema', () => {
    it('renders the Create schema and inferred type', () => {
        const content = renderSchema('Create', 'Cat');
        expect(content).toContain("import { z } from 'zod';");
        expect(content).toContain('export const CreateCatSchema = z.object({');
        expect(content).toContain('export type CreateCat = z.infer<typeof CreateCatSchema>;');
    });

    it('renders the Update schema without an id field', () => {
        const content = renderSchema('Update', 'Cat');
        expect(content).toContain('export const UpdateCatSchema = z.object({');
        expect(content).not.toContain('id: z.string()');
    });
});
```

- [ ] **Step 7: Write the shared templates**

```ts
// src/templates/shared/types.ts
export function renderTypes(entity: string): string {
    return `export interface ${entity} {
  id: string;
  // add ${entity} fields here
  createdAt: string;
  updatedAt: string;
}
`;
}
```

```ts
// src/templates/shared/schema.ts
import { WriteAction } from '../actions';

export function renderSchema(action: WriteAction, entity: string): string {
    const name = `${action}${entity}`;
    return `import { z } from 'zod';

export const ${name}Schema = z.object({
  // add ${action.toLowerCase()} fields here
});

export type ${name} = z.infer<typeof ${name}Schema>;
`;
}
```

- [ ] **Step 8: Run all tests and the build**

Run: `npx vitest run && npm run build`
Expected: PASS, build succeeds

- [ ] **Step 9: Commit**

```bash
git add src/templates src/__tests__/helpers/context.ts
git commit -m "feat: add render context, action signatures, and shared templates"
```

---

### Task 6: Frontend templates (page, component, container, hook)

**Files:**
- Create: `src/templates/frontend/page.ts`, `src/templates/frontend/component.ts`, `src/templates/frontend/container.ts`, `src/templates/frontend/hook.ts`
- Test: `src/templates/__tests__/frontend.test.ts`

**Interfaces:**
- Consumes: `RenderContext`, `contextFor` (Task 5); `componentDir` (Task 3).
- Produces: `renderPage(ctx, entity, fromFile, withContainer: boolean)`, `renderComponent(name, directive: boolean)`, `renderContainer(ctx, containerName, entity, fromFile)`, `renderHook(ctx, hookName, entity, fromFile)`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/templates/__tests__/frontend.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { renderPage } from '../frontend/page';
import { renderComponent } from '../frontend/component';
import { renderContainer } from '../frontend/container';
import { renderHook } from '../frontend/hook';
import { contextFor } from '../../__tests__/helpers/context';
import { createTempProject, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('frontend-templates');
});

afterEach(() => project.cleanup());

describe('renderPage', () => {
    it('renders a plain page without container', () => {
        const ctx = contextFor('next-frontend', 'coffee-type');
        const content = renderPage(ctx, 'CoffeeType', path.join(ctx.featureDir, 'page.tsx'), false);
        expect(content).toContain('export default function CoffeeTypePage()');
        expect(content).toContain('<h1>CoffeeType</h1>');
        expect(content).not.toContain('import');
    });

    it('imports and renders the container when requested', () => {
        const ctx = contextFor('next-frontend', 'coffee-type');
        const content = renderPage(ctx, 'CoffeeType', path.join(ctx.featureDir, 'page.tsx'), true);
        expect(content).toContain("import CoffeeTypeContainer from './containers/CoffeeTypeContainer';");
        expect(content).toContain('<CoffeeTypeContainer />');
    });
});

describe('renderComponent', () => {
    it('adds the client directive when asked', () => {
        const content = renderComponent('Cat', true);
        expect(content.startsWith("'use client';")).toBe(true);
        expect(content).toContain('interface CatProps');
        expect(content).toContain('export default function Cat({ id }: CatProps)');
    });

    it('omits the directive otherwise', () => {
        expect(renderComponent('Cat', false)).not.toContain("'use client'");
    });
});

describe('renderContainer', () => {
    it('uses the directive and split component dir on next', () => {
        const ctx = contextFor('next-frontend', 'cat');
        const fromFile = path.join(ctx.featureDir, 'containers', 'CatContainer.tsx');
        const content = renderContainer(ctx, 'CatContainer', 'Cat', fromFile);
        expect(content.startsWith("'use client';")).toBe(true);
        expect(content).toContain("import { useCat } from '../hooks/useCat';");
        expect(content).toContain("import Cat from '../components/client/Cat';");
        expect(content).toContain('export default function CatContainer()');
    });

    it('drops the directive and uses the flat component dir on react', () => {
        const ctx = contextFor('react', 'cat');
        const fromFile = path.join(ctx.featureDir, 'containers', 'CatContainer.tsx');
        const content = renderContainer(ctx, 'CatContainer', 'Cat', fromFile);
        expect(content).not.toContain("'use client'");
        expect(content).toContain("import Cat from '../components/Cat';");
    });
});

describe('renderHook', () => {
    it('imports type, services, and schemas on next-frontend', () => {
        const ctx = contextFor('next-frontend', 'cat');
        const fromFile = path.join(ctx.featureDir, 'hooks', 'useCat.ts');
        const content = renderHook(ctx, 'useCat', 'Cat', fromFile);
        expect(content.startsWith("'use client';")).toBe(true);
        expect(content).toContain("import { Cat } from '../types/Cat.types';");
        expect(content).toContain("import { ListCatService } from '../services/ListCat.service';");
        expect(content).toContain("import { UpdateCat } from '../schemas/UpdateCat.schema';");
        expect(content).toContain('export function useCat()');
        expect(content).toContain('return { items, selected, loading, error, fetchAll, fetchOne, create, update, remove };');
    });

    it('imports client services under fullstack', () => {
        const ctx = contextFor('next-fullstack', 'cat');
        const fromFile = path.join(ctx.featureDir, 'hooks', 'useCat.ts');
        const content = renderHook(ctx, 'useCat', 'Cat', fromFile);
        expect(content).toContain("from '../client/services/CreateCat.service';");
    });

    it('drops the directive on react', () => {
        const ctx = contextFor('react', 'cat');
        const fromFile = path.join(ctx.featureDir, 'hooks', 'useCat.ts');
        expect(renderHook(ctx, 'useCat', 'Cat', fromFile)).not.toContain("'use client'");
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/templates/__tests__/frontend.test.ts`
Expected: FAIL with "Failed to resolve import '../frontend/page'"

- [ ] **Step 3: Write the four templates**

```ts
// src/templates/frontend/page.ts
import { RenderContext } from '../context';

export function renderPage(
    ctx: RenderContext,
    entity: string,
    fromFile: string,
    withContainer: boolean
): string {
    if (!withContainer) {
        return `export default function ${entity}Page() {
  return (
    <div>
      <h1>${entity}</h1>
    </div>
  );
}
`;
    }

    const containerPath = ctx.importLayer(fromFile, 'container', `${entity}Container`);
    return `import ${entity}Container from '${containerPath}';

export default function ${entity}Page() {
  return (
    <div>
      <${entity}Container />
    </div>
  );
}
`;
}
```

```ts
// src/templates/frontend/component.ts
export function renderComponent(name: string, directive: boolean): string {
    const header = directive ? "'use client';\n\n" : '';

    return `${header}interface ${name}Props {
  id: string;
}

export default function ${name}({ id }: ${name}Props) {
  return (
    <div>
      <h1>${name}</h1>
    </div>
  );
}
`;
}
```

```ts
// src/templates/frontend/container.ts
import { componentDir } from '../../stack/registry';
import { RenderContext } from '../context';

export function renderContainer(
    ctx: RenderContext,
    containerName: string,
    entity: string,
    fromFile: string
): string {
    const header = ctx.profile.clientDirective ? "'use client';\n\n" : '';
    const hookName = `use${entity}`;
    const hookPath = ctx.importLayer(fromFile, 'hook', hookName);
    const componentPath = ctx.importFrom(fromFile, `${componentDir(ctx.profile, 'client')}/${entity}`);

    return `${header}import { ${hookName} } from '${hookPath}';
import ${entity} from '${componentPath}';

export default function ${containerName}() {
  const { items, loading, error } = ${hookName}();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {items.map((item) => (
        <${entity} key={item.id} {...item} />
      ))}
    </div>
  );
}
`;
}
```

```ts
// src/templates/frontend/hook.ts
import { ACTIONS } from '../actions';
import { RenderContext } from '../context';

function serviceImports(ctx: RenderContext, fromFile: string, entity: string): string {
    return ACTIONS.map((action) => {
        const servicePath = ctx.importLayer(fromFile, 'clientService', `${action}${entity}.service`);
        return `import { ${action}${entity}Service } from '${servicePath}';`;
    }).join('\n');
}

function serviceInstances(entity: string): string {
    return ACTIONS.map(
        (action) => `const ${action.toLowerCase()}Service = new ${action}${entity}Service();`
    ).join('\n');
}

export function renderHook(ctx: RenderContext, hookName: string, entity: string, fromFile: string): string {
    const header = ctx.profile.clientDirective ? "'use client';\n\n" : '';
    const typePath = ctx.importLayer(fromFile, 'types', `${entity}.types`);
    const createPath = ctx.importLayer(fromFile, 'schema', `Create${entity}.schema`);
    const updatePath = ctx.importLayer(fromFile, 'schema', `Update${entity}.schema`);

    return `${header}import { useState, useEffect, useCallback } from 'react';
import { ${entity} } from '${typePath}';
${serviceImports(ctx, fromFile, entity)}
import { Create${entity} } from '${createPath}';
import { Update${entity} } from '${updatePath}';

${serviceInstances(entity)}

export function ${hookName}() {
  const [items, setItems] = useState<${entity}[]>([]);
  const [selected, setSelected] = useState<${entity} | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listService.handle();
      setItems(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOne = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await showService.handle(id);
      setSelected(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (data: Create${entity}) => {
    setLoading(true);
    setError(null);
    try {
      const created = await createService.handle(data);
      setItems((prev) => [...prev, created]);
      return created;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(async (id: string, data: Update${entity}) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await updateService.handle(id, data);
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      return updated;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await deleteService.handle(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { items, selected, loading, error, fetchAll, fetchOne, create, update, remove };
}
`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/templates/__tests__/frontend.test.ts`
Expected: PASS, 9 tests

- [ ] **Step 5: Run all tests and the build, then commit**

Run: `npx vitest run && npm run build`
Expected: PASS

```bash
git add src/templates/frontend src/templates/__tests__/frontend.test.ts
git commit -m "feat: add frontend templates with stack-aware directives and paths"
```

---

### Task 7: Service and repository templates

**Files:**
- Create: `src/templates/service.ts`, `src/templates/frontend/client-repository.ts`, `src/templates/backend/server-repository.ts`
- Test: `src/templates/__tests__/data-layers.test.ts`

**Interfaces:**
- Consumes: `actionSignature`, `domainImports`, `RenderContext`, `Action` (Task 5); `Side` (Task 1).
- Produces: `renderService(ctx, action, entity, fromFile, side: Side)`, `renderClientRepository(ctx, action, entity, fromFile)`, `renderServerRepository(ctx, action, entity, fromFile)`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/templates/__tests__/data-layers.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { renderService } from '../service';
import { renderClientRepository } from '../frontend/client-repository';
import { renderServerRepository } from '../backend/server-repository';
import { contextFor } from '../../__tests__/helpers/context';
import { createTempProject, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('data-templates');
});

afterEach(() => project.cleanup());

describe('renderService', () => {
    it('renders a client service on next-frontend', () => {
        const ctx = contextFor('next-frontend', 'cat');
        const fromFile = path.join(ctx.featureDir, 'services', 'CreateCat.service.ts');
        const content = renderService(ctx, 'Create', 'Cat', fromFile, 'client');
        expect(content).toContain("import { Cat } from '../types/Cat.types';");
        expect(content).toContain("import { CreateCat } from '../schemas/CreateCat.schema';");
        expect(content).toContain("import { CreateCatRepository } from '../repositories/CreateCat.repository';");
        expect(content).toContain('const repository = new CreateCatRepository();');
        expect(content).toContain('export class CreateCatService {');
        expect(content).toContain('async handle(data: CreateCat): Promise<Cat> {');
        expect(content).toContain('return repository.handle(data);');
    });

    it('points fullstack client services at client repositories', () => {
        const ctx = contextFor('next-fullstack', 'cat');
        const fromFile = path.join(ctx.featureDir, 'client', 'services', 'ListCat.service.ts');
        const content = renderService(ctx, 'List', 'Cat', fromFile, 'client');
        expect(content).toContain("from '../repositories/ListCat.repository';");
        expect(content).toContain("from '../../types/Cat.types';");
    });

    it('points fullstack server services at server repositories', () => {
        const ctx = contextFor('next-fullstack', 'cat');
        const fromFile = path.join(ctx.featureDir, 'server', 'services', 'ShowCat.service.ts');
        const content = renderService(ctx, 'Show', 'Cat', fromFile, 'server');
        expect(content).toContain("from '../repositories/ShowCat.repository';");
        expect(content).not.toContain('@Injectable');
    });

    it('renders an injectable service with constructor injection on nest', () => {
        const ctx = contextFor('nest', 'cat');
        const fromFile = path.join(ctx.featureDir, 'services', 'UpdateCat.service.ts');
        const content = renderService(ctx, 'Update', 'Cat', fromFile, 'server');
        expect(content).toContain("import { Injectable } from '@nestjs/common';");
        expect(content).toContain('@Injectable()\nexport class UpdateCatService {');
        expect(content).toContain('constructor(private readonly repository: UpdateCatRepository) {}');
        expect(content).toContain('return this.repository.handle(id, data);');
        expect(content).not.toContain('new UpdateCatRepository()');
    });

    it('Delete imports only the repository', () => {
        const ctx = contextFor('node', 'cat');
        const fromFile = path.join(ctx.featureDir, 'services', 'DeleteCat.service.ts');
        const content = renderService(ctx, 'Delete', 'Cat', fromFile, 'server');
        expect(content).not.toContain('types/Cat.types');
        expect(content).toContain('async handle(id: string): Promise<void> {');
    });
});

describe('renderClientRepository', () => {
    it('fetches the feature api path', () => {
        const ctx = contextFor('next-frontend', 'coffee-type');
        const fromFile = path.join(ctx.featureDir, 'repositories', 'CreateCoffeeType.repository.ts');
        const content = renderClientRepository(ctx, 'Create', 'CoffeeType', fromFile);
        expect(content).toContain("fetch('/api/coffee-type'");
        expect(content).toContain("method: 'POST'");
        expect(content).toContain("'Content-Type': 'application/json'");
        expect(content).toContain("import { CreateCoffeeType } from '../schemas/CreateCoffeeType.schema';");
    });

    it('Delete has no imports', () => {
        const ctx = contextFor('react', 'cat');
        const fromFile = path.join(ctx.featureDir, 'repositories', 'DeleteCat.repository.ts');
        const content = renderClientRepository(ctx, 'Delete', 'Cat', fromFile);
        expect(content).not.toContain('import');
        expect(content).toContain("method: 'DELETE'");
    });

    it('Show interpolates the id', () => {
        const ctx = contextFor('react', 'cat');
        const fromFile = path.join(ctx.featureDir, 'repositories', 'ShowCat.repository.ts');
        expect(renderClientRepository(ctx, 'Show', 'Cat', fromFile)).toContain('fetch(`/api/cat/${id}`)');
    });
});

describe('renderServerRepository', () => {
    it('renders a not-implemented stub on node', () => {
        const ctx = contextFor('node', 'cat');
        const fromFile = path.join(ctx.featureDir, 'repositories', 'CreateCat.repository.ts');
        const content = renderServerRepository(ctx, 'Create', 'Cat', fromFile);
        expect(content).toContain("import { Cat } from '../types/Cat.types';");
        expect(content).toContain('export class CreateCatRepository {');
        expect(content).toContain('// TODO: implement with your ORM (Prisma, Drizzle, TypeORM, ...)');
        expect(content).toContain("throw new Error('CreateCatRepository.handle is not implemented');");
        expect(content).not.toContain('@Injectable');
    });

    it('is injectable on nest', () => {
        const ctx = contextFor('nest', 'cat');
        const fromFile = path.join(ctx.featureDir, 'repositories', 'ListCat.repository.ts');
        const content = renderServerRepository(ctx, 'List', 'Cat', fromFile);
        expect(content).toContain("import { Injectable } from '@nestjs/common';");
        expect(content).toContain('@Injectable()\nexport class ListCatRepository {');
    });

    it('Delete has no domain imports', () => {
        const ctx = contextFor('node', 'cat');
        const fromFile = path.join(ctx.featureDir, 'repositories', 'DeleteCat.repository.ts');
        const content = renderServerRepository(ctx, 'Delete', 'Cat', fromFile);
        expect(content.startsWith('export class DeleteCatRepository {')).toBe(true);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/templates/__tests__/data-layers.test.ts`
Expected: FAIL with "Failed to resolve import '../service'"

- [ ] **Step 3: Write the service template**

```ts
// src/templates/service.ts
import { Side } from '../stack/types';
import { Action } from './actions';
import { RenderContext } from './context';
import { actionSignature, domainImports } from './signatures';

const INJECTABLE_IMPORT = "import { Injectable } from '@nestjs/common';";

export function renderService(
    ctx: RenderContext,
    action: Action,
    entity: string,
    fromFile: string,
    side: Side
): string {
    const signature = actionSignature(action, entity);
    const repositoryClass = `${action}${entity}Repository`;
    const serviceClass = `${action}${entity}Service`;
    const repositoryLayer = side === 'client' ? 'clientRepository' : 'serverRepository';
    const repositoryPath = ctx.importLayer(fromFile, repositoryLayer, `${action}${entity}.repository`);
    const injectable = side === 'server' && ctx.profile.name === 'nest';

    const imports = [
        ...(injectable ? [INJECTABLE_IMPORT] : []),
        ...domainImports(ctx, fromFile, action, entity),
        `import { ${repositoryClass} } from '${repositoryPath}';`,
    ].join('\n');

    if (injectable) {
        return `${imports}

@Injectable()
export class ${serviceClass} {
  constructor(private readonly repository: ${repositoryClass}) {}

  async handle(${signature.params}): ${signature.returns} {
    return this.repository.handle(${signature.args});
  }
}
`;
    }

    return `${imports}

const repository = new ${repositoryClass}();

export class ${serviceClass} {
  async handle(${signature.params}): ${signature.returns} {
    return repository.handle(${signature.args});
  }
}
`;
}
```

- [ ] **Step 4: Write the client repository template**

```ts
// src/templates/frontend/client-repository.ts
import { Action } from '../actions';
import { RenderContext } from '../context';
import { domainImports } from '../signatures';

function body(action: Action, entity: string, url: string): string {
    const cls = `${action}${entity}Repository`;
    switch (action) {
        case 'List':
            return `export class ${cls} {
  async handle(): Promise<${entity}[]> {
    const response = await fetch('${url}');
    if (!response.ok) throw new Error('Failed to fetch ${entity} list');
    return response.json();
  }
}
`;
        case 'Show':
            return `export class ${cls} {
  async handle(id: string): Promise<${entity}> {
    const response = await fetch(\`${url}/\${id}\`);
    if (!response.ok) throw new Error('Failed to fetch ${entity}');
    return response.json();
  }
}
`;
        case 'Create':
            return `export class ${cls} {
  async handle(data: Create${entity}): Promise<${entity}> {
    const response = await fetch('${url}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create ${entity}');
    return response.json();
  }
}
`;
        case 'Update':
            return `export class ${cls} {
  async handle(id: string, data: Update${entity}): Promise<${entity}> {
    const response = await fetch(\`${url}/\${id}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update ${entity}');
    return response.json();
  }
}
`;
        case 'Delete':
            return `export class ${cls} {
  async handle(id: string): Promise<void> {
    const response = await fetch(\`${url}/\${id}\`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete ${entity}');
  }
}
`;
    }
}

export function renderClientRepository(
    ctx: RenderContext,
    action: Action,
    entity: string,
    fromFile: string
): string {
    const imports = domainImports(ctx, fromFile, action, entity).join('\n');
    const header = imports ? `${imports}\n\n` : '';
    return `${header}${body(action, entity, `/api/${ctx.feature}`)}`;
}
```

- [ ] **Step 5: Write the server repository template**

```ts
// src/templates/backend/server-repository.ts
import { Action } from '../actions';
import { RenderContext } from '../context';
import { actionSignature, domainImports } from '../signatures';

const INJECTABLE_IMPORT = "import { Injectable } from '@nestjs/common';";

export function renderServerRepository(
    ctx: RenderContext,
    action: Action,
    entity: string,
    fromFile: string
): string {
    const signature = actionSignature(action, entity);
    const cls = `${action}${entity}Repository`;
    const injectable = ctx.profile.name === 'nest';
    const imports = [
        ...(injectable ? [INJECTABLE_IMPORT] : []),
        ...domainImports(ctx, fromFile, action, entity),
    ].join('\n');
    const header = imports ? `${imports}\n\n` : '';
    const decorator = injectable ? '@Injectable()\n' : '';

    return `${header}${decorator}export class ${cls} {
  async handle(${signature.params}): ${signature.returns} {
    // TODO: implement with your ORM (Prisma, Drizzle, TypeORM, ...)
    throw new Error('${cls}.handle is not implemented');
  }
}
`;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/templates/__tests__/data-layers.test.ts`
Expected: PASS, 11 tests

- [ ] **Step 7: Run all tests and the build, then commit**

Run: `npx vitest run && npm run build`
Expected: PASS

```bash
git add src/templates
git commit -m "feat: add service and repository templates for client and server sides"
```

---

### Task 8: Node controller templates (Express, Fastify, Hono, generic)

**Files:**
- Create: `src/templates/controllers/shape.ts`, `src/templates/controllers/express.ts`, `src/templates/controllers/fastify.ts`, `src/templates/controllers/hono.ts`, `src/templates/controllers/generic.ts`, `src/templates/controllers/node.ts`
- Test: `src/templates/__tests__/node-controllers.test.ts`

**Interfaces:**
- Consumes: `RenderContext`, `Action`, `ACTIONS`, `actionSignature` (Task 5); `lowerFirst` (Task 1).
- Produces: `ControllerShape { status, usesBody, usesId }`, `controllerShape(action)`, `handlerName(action, entity)`; `renderExpressController(ctx, action, entity, fromFile)`, `renderExpressRoutes(ctx, entity, fromFile)`; same pairs for `Fastify` and `Hono`; `renderGenericController(ctx, action, entity, fromFile)`; `renderNodeController(ctx, action, entity, fromFile)`, `renderNodeRoutes(ctx, entity, fromFile): string | null`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/templates/__tests__/node-controllers.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { controllerShape, handlerName } from '../controllers/shape';
import { renderExpressController, renderExpressRoutes } from '../controllers/express';
import { renderFastifyController, renderFastifyRoutes } from '../controllers/fastify';
import { renderHonoController, renderHonoRoutes } from '../controllers/hono';
import { renderGenericController } from '../controllers/generic';
import { renderNodeController, renderNodeRoutes } from '../controllers/node';
import { contextFor } from '../../__tests__/helpers/context';
import { createTempProject, TempProject } from '../../__tests__/helpers/project';
import { RenderContext } from '../context';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('node-controllers');
});

afterEach(() => project.cleanup());

const controllerFile = (ctx: RenderContext, action: string): string =>
    path.join(ctx.featureDir, 'controllers', `${action}Cat.controller.ts`);
const routesFile = (ctx: RenderContext): string => path.join(ctx.featureDir, 'cat.routes.ts');

describe('controllerShape', () => {
    it('maps actions to status and inputs', () => {
        expect(controllerShape('List')).toEqual({ status: 200, usesBody: false, usesId: false });
        expect(controllerShape('Create')).toEqual({ status: 201, usesBody: true, usesId: false });
        expect(controllerShape('Update')).toEqual({ status: 200, usesBody: true, usesId: true });
        expect(controllerShape('Delete')).toEqual({ status: 204, usesBody: false, usesId: true });
    });

    it('names handlers in camelCase', () => {
        expect(handlerName('Create', 'CoffeeType')).toBe('createCoffeeTypeController');
    });
});

describe('express', () => {
    const ctx = () => contextFor('node', 'cat', { httpFramework: 'express' });

    it('validates the body and responds 201 on create', () => {
        const content = renderExpressController(ctx(), 'Create', 'Cat', controllerFile(ctx(), 'Create'));
        expect(content).toContain("import { NextFunction, Request, Response } from 'express';");
        expect(content).toContain("import { CreateCatSchema } from '../schemas/CreateCat.schema';");
        expect(content).toContain("import { CreateCatService } from '../services/CreateCat.service';");
        expect(content).toContain('export async function createCatController(req: Request, res: Response, next: NextFunction): Promise<void> {');
        expect(content).toContain('const parsed = CreateCatSchema.safeParse(req.body);');
        expect(content).toContain('res.status(400).json({ errors: parsed.error.flatten() });');
        expect(content).toContain('res.status(201).json(await service.handle(parsed.data));');
        expect(content).toContain('next(error);');
    });

    it('uses the id on update and delete', () => {
        const update = renderExpressController(ctx(), 'Update', 'Cat', controllerFile(ctx(), 'Update'));
        expect(update).toContain('service.handle(req.params.id, parsed.data)');
        const del = renderExpressController(ctx(), 'Delete', 'Cat', controllerFile(ctx(), 'Delete'));
        expect(del).toContain('await service.handle(req.params.id);');
        expect(del).toContain('res.status(204).send();');
        expect(del).not.toContain('Schema');
    });

    it('prefixes the unused request on list', () => {
        const content = renderExpressController(ctx(), 'List', 'Cat', controllerFile(ctx(), 'List'));
        expect(content).toContain('listCatController(_req: Request, res: Response, next: NextFunction)');
    });

    it('renders a router with five routes', () => {
        const content = renderExpressRoutes(ctx(), 'Cat', routesFile(ctx()));
        expect(content).toContain("import { Router } from 'express';");
        expect(content).toContain("import { listCatController } from './controllers/ListCat.controller';");
        expect(content).toContain("router.get('/', listCatController);");
        expect(content).toContain("router.get('/:id', showCatController);");
        expect(content).toContain("router.post('/', createCatController);");
        expect(content).toContain("router.put('/:id', updateCatController);");
        expect(content).toContain("router.delete('/:id', deleteCatController);");
        expect(content).toContain('export default router;');
        expect(content).toContain("// app.use('/cat', catRoutes);");
    });
});

describe('fastify', () => {
    const ctx = () => contextFor('node', 'cat', { httpFramework: 'fastify' });

    it('types params on show', () => {
        const content = renderFastifyController(ctx(), 'Show', 'Cat', controllerFile(ctx(), 'Show'));
        expect(content).toContain("import { FastifyReply, FastifyRequest } from 'fastify';");
        expect(content).toContain('request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply');
        expect(content).toContain('reply.status(200).send(await service.handle(request.params.id));');
    });

    it('validates the body on create', () => {
        const content = renderFastifyController(ctx(), 'Create', 'Cat', controllerFile(ctx(), 'Create'));
        expect(content).toContain('const parsed = CreateCatSchema.safeParse(request.body);');
        expect(content).toContain('reply.status(400).send({ errors: parsed.error.flatten() });');
        expect(content).toContain('reply.status(201).send(await service.handle(parsed.data));');
    });

    it('renders a plugin', () => {
        const content = renderFastifyRoutes(ctx(), 'Cat', routesFile(ctx()));
        expect(content).toContain("import { FastifyInstance } from 'fastify';");
        expect(content).toContain('export async function catRoutes(app: FastifyInstance): Promise<void> {');
        expect(content).toContain("app.delete('/:id', deleteCatController);");
        expect(content).toContain("// app.register(catRoutes, { prefix: '/cat' });");
    });
});

describe('hono', () => {
    const ctx = () => contextFor('node', 'cat', { httpFramework: 'hono' });

    it('reads params and json from the context', () => {
        const content = renderHonoController(ctx(), 'Update', 'Cat', controllerFile(ctx(), 'Update'));
        expect(content).toContain("import { Context } from 'hono';");
        expect(content).toContain('export async function updateCatController(c: Context): Promise<Response> {');
        expect(content).toContain('const parsed = UpdateCatSchema.safeParse(await c.req.json());');
        expect(content).toContain("return c.json({ errors: parsed.error.flatten() }, 400);");
        expect(content).toContain("return c.json(await service.handle(c.req.param('id'), parsed.data), 200);");
    });

    it('returns an empty 204 on delete', () => {
        const content = renderHonoController(ctx(), 'Delete', 'Cat', controllerFile(ctx(), 'Delete'));
        expect(content).toContain("await service.handle(c.req.param('id'));");
        expect(content).toContain('return c.body(null, 204);');
    });

    it('renders a Hono app', () => {
        const content = renderHonoRoutes(ctx(), 'Cat', routesFile(ctx()));
        expect(content).toContain("import { Hono } from 'hono';");
        expect(content).toContain('const cat = new Hono();');
        expect(content).toContain("cat.post('/', createCatController);");
        expect(content).toContain('export default cat;');
        expect(content).toContain("// app.route('/cat', cat);");
    });
});

describe('generic', () => {
    const ctx = () => contextFor('node', 'cat');

    it('renders a class that parses input', () => {
        const content = renderGenericController(ctx(), 'Create', 'Cat', controllerFile(ctx(), 'Create'));
        expect(content).toContain("import { Cat } from '../types/Cat.types';");
        expect(content).toContain('export class CreateCatController {');
        expect(content).toContain('async handle(input: unknown): Promise<Cat> {');
        expect(content).toContain('return service.handle(CreateCatSchema.parse(input));');
    });

    it('takes id and input on update', () => {
        const content = renderGenericController(ctx(), 'Update', 'Cat', controllerFile(ctx(), 'Update'));
        expect(content).toContain('async handle(id: string, input: unknown): Promise<Cat> {');
        expect(content).toContain('return service.handle(id, UpdateCatSchema.parse(input));');
    });

    it('list takes nothing', () => {
        const content = renderGenericController(ctx(), 'List', 'Cat', controllerFile(ctx(), 'List'));
        expect(content).toContain('async handle(): Promise<Cat[]> {');
        expect(content).toContain('return service.handle();');
    });
});

describe('node dispatcher', () => {
    it('picks the template by framework', () => {
        const express = contextFor('node', 'cat', { httpFramework: 'express' });
        expect(renderNodeController(express, 'List', 'Cat', controllerFile(express, 'List'))).toContain("from 'express'");
        const hono = contextFor('node', 'cat', { httpFramework: 'hono' });
        expect(renderNodeRoutes(hono, 'Cat', routesFile(hono))).toContain("from 'hono'");
    });

    it('falls back to generic with no routes', () => {
        const ctx = contextFor('node', 'cat');
        expect(renderNodeController(ctx, 'List', 'Cat', controllerFile(ctx, 'List'))).toContain('export class ListCatController');
        expect(renderNodeRoutes(ctx, 'Cat', routesFile(ctx))).toBeNull();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/templates/__tests__/node-controllers.test.ts`
Expected: FAIL with "Failed to resolve import '../controllers/shape'"

- [ ] **Step 3: Write the shape module**

```ts
// src/templates/controllers/shape.ts
import { lowerFirst } from '../../utils/naming';
import { Action, ACTIONS } from '../actions';
import { RenderContext } from '../context';

export interface ControllerShape {
    readonly status: number;
    readonly usesBody: boolean;
    readonly usesId: boolean;
}

export function controllerShape(action: Action): ControllerShape {
    switch (action) {
        case 'List':
            return { status: 200, usesBody: false, usesId: false };
        case 'Show':
            return { status: 200, usesBody: false, usesId: true };
        case 'Create':
            return { status: 201, usesBody: true, usesId: false };
        case 'Update':
            return { status: 200, usesBody: true, usesId: true };
        case 'Delete':
            return { status: 204, usesBody: false, usesId: true };
    }
}

export function handlerName(action: Action, entity: string): string {
    return `${lowerFirst(action)}${entity}Controller`;
}

export function schemaImport(ctx: RenderContext, fromFile: string, action: Action, entity: string): string {
    const schemaPath = ctx.importLayer(fromFile, 'schema', `${action}${entity}.schema`);
    return `import { ${action}${entity}Schema } from '${schemaPath}';`;
}

export function serviceImport(ctx: RenderContext, fromFile: string, action: Action, entity: string): string {
    const servicePath = ctx.importLayer(fromFile, 'serverService', `${action}${entity}.service`);
    return `import { ${action}${entity}Service } from '${servicePath}';`;
}

export function controllerImports(ctx: RenderContext, fromFile: string, entity: string): string {
    return ACTIONS
        .map((action) => {
            const name = handlerName(action, entity);
            const controllerPath = ctx.importLayer(fromFile, 'controller', `${action}${entity}.controller`);
            return `import { ${name} } from '${controllerPath}';`;
        })
        .join('\n');
}

export function callArgs(shape: ControllerShape, idExpression: string, bodyExpression: string): string {
    return [shape.usesId ? idExpression : null, shape.usesBody ? bodyExpression : null]
        .filter((arg): arg is string => arg !== null)
        .join(', ');
}
```

- [ ] **Step 4: Write the Express template**

```ts
// src/templates/controllers/express.ts
import { lowerFirst } from '../../utils/naming';
import { Action } from '../actions';
import { RenderContext } from '../context';
import { callArgs, controllerImports, controllerShape, handlerName, schemaImport, serviceImport } from './shape';

export function renderExpressController(
    ctx: RenderContext,
    action: Action,
    entity: string,
    fromFile: string
): string {
    const shape = controllerShape(action);
    const imports = [
        "import { NextFunction, Request, Response } from 'express';",
        ...(shape.usesBody ? [schemaImport(ctx, fromFile, action, entity)] : []),
        serviceImport(ctx, fromFile, action, entity),
    ].join('\n');
    const reqName = shape.usesBody || shape.usesId ? 'req' : '_req';
    const validate = shape.usesBody
        ? `  const parsed = ${action}${entity}Schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten() });
    return;
  }
`
        : '';
    const args = callArgs(shape, 'req.params.id', 'parsed.data');
    const respond =
        shape.status === 204
            ? `    await service.handle(${args});
    res.status(204).send();`
            : `    res.status(${shape.status}).json(await service.handle(${args}));`;

    return `${imports}

const service = new ${action}${entity}Service();

export async function ${handlerName(action, entity)}(${reqName}: Request, res: Response, next: NextFunction): Promise<void> {
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
    return `import { Router } from 'express';
${controllerImports(ctx, fromFile, entity)}

const router = Router();

router.get('/', ${handlerName('List', entity)});
router.get('/:id', ${handlerName('Show', entity)});
router.post('/', ${handlerName('Create', entity)});
router.put('/:id', ${handlerName('Update', entity)});
router.delete('/:id', ${handlerName('Delete', entity)});

export default router;

// app.use('/${ctx.feature}', ${name}Routes);
`;
}
```

- [ ] **Step 5: Write the Fastify template**

```ts
// src/templates/controllers/fastify.ts
import { lowerFirst } from '../../utils/naming';
import { Action } from '../actions';
import { RenderContext } from '../context';
import { callArgs, controllerImports, controllerShape, handlerName, schemaImport, serviceImport } from './shape';

export function renderFastifyController(
    ctx: RenderContext,
    action: Action,
    entity: string,
    fromFile: string
): string {
    const shape = controllerShape(action);
    const imports = [
        "import { FastifyReply, FastifyRequest } from 'fastify';",
        ...(shape.usesBody ? [schemaImport(ctx, fromFile, action, entity)] : []),
        serviceImport(ctx, fromFile, action, entity),
    ].join('\n');
    const requestType = shape.usesId ? 'FastifyRequest<{ Params: { id: string } }>' : 'FastifyRequest';
    const requestName = shape.usesBody || shape.usesId ? 'request' : '_request';
    const validate = shape.usesBody
        ? `  const parsed = ${action}${entity}Schema.safeParse(request.body);
  if (!parsed.success) {
    reply.status(400).send({ errors: parsed.error.flatten() });
    return;
  }
`
        : '';
    const args = callArgs(shape, 'request.params.id', 'parsed.data');
    const respond =
        shape.status === 204
            ? `  await service.handle(${args});
  reply.status(204).send();`
            : `  reply.status(${shape.status}).send(await service.handle(${args}));`;

    return `${imports}

const service = new ${action}${entity}Service();

export async function ${handlerName(action, entity)}(${requestName}: ${requestType}, reply: FastifyReply): Promise<void> {
${validate}${respond}
}
`;
}

export function renderFastifyRoutes(ctx: RenderContext, entity: string, fromFile: string): string {
    const name = lowerFirst(entity);
    return `import { FastifyInstance } from 'fastify';
${controllerImports(ctx, fromFile, entity)}

export async function ${name}Routes(app: FastifyInstance): Promise<void> {
  app.get('/', ${handlerName('List', entity)});
  app.get('/:id', ${handlerName('Show', entity)});
  app.post('/', ${handlerName('Create', entity)});
  app.put('/:id', ${handlerName('Update', entity)});
  app.delete('/:id', ${handlerName('Delete', entity)});
}

// app.register(${name}Routes, { prefix: '/${ctx.feature}' });
`;
}
```

- [ ] **Step 6: Write the Hono template**

```ts
// src/templates/controllers/hono.ts
import { lowerFirst } from '../../utils/naming';
import { Action } from '../actions';
import { RenderContext } from '../context';
import { callArgs, controllerImports, controllerShape, handlerName, schemaImport, serviceImport } from './shape';

export function renderHonoController(
    ctx: RenderContext,
    action: Action,
    entity: string,
    fromFile: string
): string {
    const shape = controllerShape(action);
    const imports = [
        "import { Context } from 'hono';",
        ...(shape.usesBody ? [schemaImport(ctx, fromFile, action, entity)] : []),
        serviceImport(ctx, fromFile, action, entity),
    ].join('\n');
    const validate = shape.usesBody
        ? `  const parsed = ${action}${entity}Schema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ errors: parsed.error.flatten() }, 400);
`
        : '';
    const args = callArgs(shape, "c.req.param('id')", 'parsed.data');
    const respond =
        shape.status === 204
            ? `  await service.handle(${args});
  return c.body(null, 204);`
            : `  return c.json(await service.handle(${args}), ${shape.status});`;

    return `${imports}

const service = new ${action}${entity}Service();

export async function ${handlerName(action, entity)}(c: Context): Promise<Response> {
${validate}${respond}
}
`;
}

export function renderHonoRoutes(ctx: RenderContext, entity: string, fromFile: string): string {
    const name = lowerFirst(entity);
    return `import { Hono } from 'hono';
${controllerImports(ctx, fromFile, entity)}

const ${name} = new Hono();

${name}.get('/', ${handlerName('List', entity)});
${name}.get('/:id', ${handlerName('Show', entity)});
${name}.post('/', ${handlerName('Create', entity)});
${name}.put('/:id', ${handlerName('Update', entity)});
${name}.delete('/:id', ${handlerName('Delete', entity)});

export default ${name};

// app.route('/${ctx.feature}', ${name});
`;
}
```

- [ ] **Step 7: Write the generic template and the dispatcher**

```ts
// src/templates/controllers/generic.ts
import { Action } from '../actions';
import { RenderContext } from '../context';
import { actionSignature } from '../signatures';
import { controllerShape, schemaImport, serviceImport } from './shape';

export function renderGenericController(
    ctx: RenderContext,
    action: Action,
    entity: string,
    fromFile: string
): string {
    const shape = controllerShape(action);
    const signature = actionSignature(action, entity);
    const typeImport = signature.usesEntityType
        ? [`import { ${entity} } from '${ctx.importLayer(fromFile, 'types', `${entity}.types`)}';`]
        : [];
    const imports = [
        ...typeImport,
        ...(shape.usesBody ? [schemaImport(ctx, fromFile, action, entity)] : []),
        serviceImport(ctx, fromFile, action, entity),
    ].join('\n');
    const params = [shape.usesId ? 'id: string' : null, shape.usesBody ? 'input: unknown' : null]
        .filter((param): param is string => param !== null)
        .join(', ');
    const args = [shape.usesId ? 'id' : null, shape.usesBody ? `${action}${entity}Schema.parse(input)` : null]
        .filter((arg): arg is string => arg !== null)
        .join(', ');

    return `${imports}

const service = new ${action}${entity}Service();

export class ${action}${entity}Controller {
  async handle(${params}): ${signature.returns} {
    return service.handle(${args});
  }
}
`;
}
```

```ts
// src/templates/controllers/node.ts
import { Action } from '../actions';
import { RenderContext } from '../context';
import { renderExpressController, renderExpressRoutes } from './express';
import { renderFastifyController, renderFastifyRoutes } from './fastify';
import { renderHonoController, renderHonoRoutes } from './hono';
import { renderGenericController } from './generic';

export function renderNodeController(
    ctx: RenderContext,
    action: Action,
    entity: string,
    fromFile: string
): string {
    switch (ctx.stack.httpFramework) {
        case 'express':
            return renderExpressController(ctx, action, entity, fromFile);
        case 'fastify':
            return renderFastifyController(ctx, action, entity, fromFile);
        case 'hono':
            return renderHonoController(ctx, action, entity, fromFile);
        case null:
            return renderGenericController(ctx, action, entity, fromFile);
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
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/templates/__tests__/node-controllers.test.ts`
Expected: PASS, 17 tests

- [ ] **Step 9: Run all tests and the build, then commit**

Run: `npx vitest run && npm run build`
Expected: PASS

```bash
git add src/templates/controllers src/templates/__tests__/node-controllers.test.ts
git commit -m "feat: add express, fastify, hono, and generic controller templates"
```

---

### Task 9: Next.js route handler templates

**Files:**
- Create: `src/templates/controllers/next-route.ts`
- Test: `src/templates/__tests__/next-route.test.ts`

**Interfaces:**
- Consumes: `RenderContext` (Task 5), `apiRouteDir` (Task 4).
- Produces: `renderCollectionRoute(ctx, entity, fromFile)`, `renderItemRoute(ctx, entity, fromFile)`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/templates/__tests__/next-route.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { renderCollectionRoute, renderItemRoute } from '../controllers/next-route';
import { apiRouteDir } from '../../utils/paths';
import { contextFor } from '../../__tests__/helpers/context';
import { createTempProject, writeTsconfig, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('next-route');
});

afterEach(() => project.cleanup());

describe('renderCollectionRoute', () => {
    it('exports GET and POST calling the server services', () => {
        const ctx = contextFor('next-fullstack', 'cat');
        const fromFile = path.join(apiRouteDir(ctx.stack, 'cat'), 'route.ts');
        const content = renderCollectionRoute(ctx, 'Cat', fromFile);
        expect(content).toContain("import { NextResponse } from 'next/server';");
        expect(content).toContain("import { CreateCatSchema } from '../../cat/schemas/CreateCat.schema';");
        expect(content).toContain("import { ListCatService } from '../../cat/server/services/ListCat.service';");
        expect(content).toContain("import { CreateCatService } from '../../cat/server/services/CreateCat.service';");
        expect(content).toContain('export async function GET(): Promise<NextResponse> {');
        expect(content).toContain('return NextResponse.json(await listService.handle());');
        expect(content).toContain('export async function POST(request: Request): Promise<NextResponse> {');
        expect(content).toContain('const parsed = CreateCatSchema.safeParse(await request.json());');
        expect(content).toContain('return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });');
        expect(content).toContain('return NextResponse.json(await createService.handle(parsed.data), { status: 201 });');
    });

    it('uses the alias when configured', () => {
        writeTsconfig({ '@/*': ['./*'] });
        const ctx = contextFor('next-fullstack', 'cat');
        const fromFile = path.join(apiRouteDir(ctx.stack, 'cat'), 'route.ts');
        expect(renderCollectionRoute(ctx, 'Cat', fromFile)).toContain("from '@/app/cat/server/services/ListCat.service';");
    });
});

describe('renderItemRoute', () => {
    it('exports GET, PUT, and DELETE with async params', () => {
        const ctx = contextFor('next-fullstack', 'cat');
        const fromFile = path.join(apiRouteDir(ctx.stack, 'cat'), '[id]', 'route.ts');
        const content = renderItemRoute(ctx, 'Cat', fromFile);
        expect(content).toContain("import { UpdateCatSchema } from '../../../cat/schemas/UpdateCat.schema';");
        expect(content).toContain("import { ShowCatService } from '../../../cat/server/services/ShowCat.service';");
        expect(content).toContain('type RouteContext = { params: Promise<{ id: string }> };');
        expect(content).toContain('export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {');
        expect(content).toContain('const { id } = await params;');
        expect(content).toContain('return NextResponse.json(await showService.handle(id));');
        expect(content).toContain('export async function PUT(request: Request, { params }: RouteContext): Promise<NextResponse> {');
        expect(content).toContain('return NextResponse.json(await updateService.handle(id, parsed.data));');
        expect(content).toContain('export async function DELETE(_request: Request, { params }: RouteContext): Promise<Response> {');
        expect(content).toContain('await deleteService.handle(id);');
        expect(content).toContain('return new Response(null, { status: 204 });');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/templates/__tests__/next-route.test.ts`
Expected: FAIL with "Failed to resolve import '../controllers/next-route'"

- [ ] **Step 3: Write the template**

```ts
// src/templates/controllers/next-route.ts
import { RenderContext } from '../context';
import { schemaImport, serviceImport } from './shape';

export function renderCollectionRoute(ctx: RenderContext, entity: string, fromFile: string): string {
    return `import { NextResponse } from 'next/server';
${schemaImport(ctx, fromFile, 'Create', entity)}
${serviceImport(ctx, fromFile, 'List', entity)}
${serviceImport(ctx, fromFile, 'Create', entity)}

const listService = new List${entity}Service();
const createService = new Create${entity}Service();

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(await listService.handle());
}

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = Create${entity}Schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json(await createService.handle(parsed.data), { status: 201 });
}
`;
}

export function renderItemRoute(ctx: RenderContext, entity: string, fromFile: string): string {
    return `import { NextResponse } from 'next/server';
${schemaImport(ctx, fromFile, 'Update', entity)}
${serviceImport(ctx, fromFile, 'Show', entity)}
${serviceImport(ctx, fromFile, 'Update', entity)}
${serviceImport(ctx, fromFile, 'Delete', entity)}

const showService = new Show${entity}Service();
const updateService = new Update${entity}Service();
const deleteService = new Delete${entity}Service();

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const { id } = await params;
  return NextResponse.json(await showService.handle(id));
}

export async function PUT(request: Request, { params }: RouteContext): Promise<NextResponse> {
  const { id } = await params;
  const parsed = Update${entity}Schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json(await updateService.handle(id, parsed.data));
}

export async function DELETE(_request: Request, { params }: RouteContext): Promise<Response> {
  const { id } = await params;
  await deleteService.handle(id);
  return new Response(null, { status: 204 });
}
`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/templates/__tests__/next-route.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Run all tests and the build, then commit**

Run: `npx vitest run && npm run build`
Expected: PASS

```bash
git add src/templates/controllers/next-route.ts src/templates/__tests__/next-route.test.ts
git commit -m "feat: add Next.js route handler templates"
```

---

### Task 10: Nest controller, DTO, and module templates

**Files:**
- Create: `src/templates/controllers/nest.ts`, `src/templates/nest/dto.ts`, `src/templates/nest/module.ts`
- Test: `src/templates/__tests__/nest.test.ts`

**Interfaces:**
- Consumes: `RenderContext`, `ACTIONS`, `WriteAction`, `actionSignature` (Task 5); `controllerShape` (Task 8); `toPascalCase` (Task 1).
- Produces: `renderNestController(ctx, action, entity, fromFile)`, `renderDto(ctx, action: WriteAction, entity, fromFile)`, `renderModule(ctx, entity, fromFile, populated: boolean)`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/templates/__tests__/nest.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { renderNestController } from '../controllers/nest';
import { renderDto } from '../nest/dto';
import { renderModule } from '../nest/module';
import { contextFor } from '../../__tests__/helpers/context';
import { createTempProject, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('nest-templates');
});

afterEach(() => project.cleanup());

const ctx = () => contextFor('nest', 'coffee-type');
const controllerFile = (action: string): string =>
    path.join(ctx().featureDir, 'controllers', `${action}CoffeeType.controller.ts`);

describe('renderNestController', () => {
    it('renders a single-action Post controller with a DTO body', () => {
        const content = renderNestController(ctx(), 'Create', 'CoffeeType', controllerFile('Create'));
        expect(content).toContain("import { Body, Controller, Post } from '@nestjs/common';");
        expect(content).toContain("import { CoffeeType } from '../types/CoffeeType.types';");
        expect(content).toContain("import { CreateCoffeeTypeDto } from '../dto/CreateCoffeeType.dto';");
        expect(content).toContain("import { CreateCoffeeTypeService } from '../services/CreateCoffeeType.service';");
        expect(content).toContain("@Controller('coffee-type')");
        expect(content).toContain('export class CreateCoffeeTypeController {');
        expect(content).toContain('constructor(private readonly service: CreateCoffeeTypeService) {}');
        expect(content).toContain('@Post()');
        expect(content).toContain('handle(@Body() body: CreateCoffeeTypeDto): Promise<CoffeeType> {');
        expect(content).toContain('return this.service.handle(body);');
    });

    it('renders Get with a param on show', () => {
        const content = renderNestController(ctx(), 'Show', 'CoffeeType', controllerFile('Show'));
        expect(content).toContain("import { Controller, Get, Param } from '@nestjs/common';");
        expect(content).toContain("@Get(':id')");
        expect(content).toContain("handle(@Param('id') id: string): Promise<CoffeeType> {");
        expect(content).not.toContain('Dto');
    });

    it('renders list without params', () => {
        const content = renderNestController(ctx(), 'List', 'CoffeeType', controllerFile('List'));
        expect(content).toContain("import { Controller, Get } from '@nestjs/common';");
        expect(content).toContain('@Get()');
        expect(content).toContain('handle(): Promise<CoffeeType[]> {');
    });

    it('renders Put with param and body on update', () => {
        const content = renderNestController(ctx(), 'Update', 'CoffeeType', controllerFile('Update'));
        expect(content).toContain("import { Body, Controller, Param, Put } from '@nestjs/common';");
        expect(content).toContain("@Put(':id')");
        expect(content).toContain("handle(@Param('id') id: string, @Body() body: UpdateCoffeeTypeDto): Promise<CoffeeType> {");
        expect(content).toContain('return this.service.handle(id, body);');
    });

    it('renders Delete with a 204', () => {
        const content = renderNestController(ctx(), 'Delete', 'CoffeeType', controllerFile('Delete'));
        expect(content).toContain("import { Controller, Delete, HttpCode, Param } from '@nestjs/common';");
        expect(content).toContain("@Delete(':id')");
        expect(content).toContain('@HttpCode(204)');
        expect(content).toContain("handle(@Param('id') id: string): Promise<void> {");
        expect(content).not.toContain('types/CoffeeType.types');
    });
});

describe('renderDto', () => {
    it('derives the class from the schema', () => {
        const fromFile = path.join(ctx().featureDir, 'dto', 'CreateCoffeeType.dto.ts');
        const content = renderDto(ctx(), 'Create', 'CoffeeType', fromFile);
        expect(content).toBe(`import { createZodDto } from 'nestjs-zod';
import { CreateCoffeeTypeSchema } from '../schemas/CreateCoffeeType.schema';

export class CreateCoffeeTypeDto extends createZodDto(CreateCoffeeTypeSchema) {}
`);
    });
});

describe('renderModule', () => {
    const moduleFile = (): string => path.join(ctx().featureDir, 'coffee-type.module.ts');

    it('renders an empty module', () => {
        const content = renderModule(ctx(), 'CoffeeType', moduleFile(), false);
        expect(content).toBe(`import { Module } from '@nestjs/common';

@Module({
  controllers: [],
  providers: [],
})
export class CoffeeTypeModule {}
`);
    });

    it('registers five controllers and ten providers when populated', () => {
        const content = renderModule(ctx(), 'CoffeeType', moduleFile(), true);
        expect(content).toContain("import { ListCoffeeTypeController } from './controllers/ListCoffeeType.controller';");
        expect(content).toContain("import { DeleteCoffeeTypeService } from './services/DeleteCoffeeType.service';");
        expect(content).toContain("import { UpdateCoffeeTypeRepository } from './repositories/UpdateCoffeeType.repository';");
        expect(content).toContain(
            '  controllers: [\n    ListCoffeeTypeController,\n    ShowCoffeeTypeController,\n    CreateCoffeeTypeController,\n    UpdateCoffeeTypeController,\n    DeleteCoffeeTypeController,\n  ],'
        );
        expect(content).toContain('    ListCoffeeTypeService,\n');
        expect(content).toContain('    DeleteCoffeeTypeRepository,\n  ],');
        expect(content).toContain('export class CoffeeTypeModule {}');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/templates/__tests__/nest.test.ts`
Expected: FAIL with "Failed to resolve import '../controllers/nest'"

- [ ] **Step 3: Write the Nest controller template**

```ts
// src/templates/controllers/nest.ts
import { Action } from '../actions';
import { RenderContext } from '../context';
import { actionSignature } from '../signatures';
import { controllerShape, serviceImport } from './shape';

interface NestRoute {
    readonly decorator: string;
    readonly commonImports: readonly string[];
}

function nestRoute(action: Action): NestRoute {
    switch (action) {
        case 'List':
            return { decorator: '@Get()', commonImports: ['Controller', 'Get'] };
        case 'Show':
            return { decorator: "@Get(':id')", commonImports: ['Controller', 'Get', 'Param'] };
        case 'Create':
            return { decorator: '@Post()', commonImports: ['Body', 'Controller', 'Post'] };
        case 'Update':
            return { decorator: "@Put(':id')", commonImports: ['Body', 'Controller', 'Param', 'Put'] };
        case 'Delete':
            return { decorator: "@Delete(':id')\n  @HttpCode(204)", commonImports: ['Controller', 'Delete', 'HttpCode', 'Param'] };
    }
}

export function renderNestController(
    ctx: RenderContext,
    action: Action,
    entity: string,
    fromFile: string
): string {
    const shape = controllerShape(action);
    const signature = actionSignature(action, entity);
    const route = nestRoute(action);
    const dto = `${action}${entity}Dto`;

    const imports = [
        `import { ${route.commonImports.join(', ')} } from '@nestjs/common';`,
        ...(signature.usesEntityType
            ? [`import { ${entity} } from '${ctx.importLayer(fromFile, 'types', `${entity}.types`)}';`]
            : []),
        ...(shape.usesBody ? [`import { ${dto} } from '${ctx.importLayer(fromFile, 'dto', `${action}${entity}.dto`)}';`] : []),
        serviceImport(ctx, fromFile, action, entity),
    ].join('\n');

    const params = [shape.usesId ? "@Param('id') id: string" : null, shape.usesBody ? `@Body() body: ${dto}` : null]
        .filter((param): param is string => param !== null)
        .join(', ');
    const args = [shape.usesId ? 'id' : null, shape.usesBody ? 'body' : null]
        .filter((arg): arg is string => arg !== null)
        .join(', ');

    return `${imports}

@Controller('${ctx.feature}')
export class ${action}${entity}Controller {
  constructor(private readonly service: ${action}${entity}Service) {}

  ${route.decorator}
  handle(${params}): ${signature.returns} {
    return this.service.handle(${args});
  }
}
`;
}
```

- [ ] **Step 4: Write the DTO and module templates**

```ts
// src/templates/nest/dto.ts
import { WriteAction } from '../actions';
import { RenderContext } from '../context';

export function renderDto(ctx: RenderContext, action: WriteAction, entity: string, fromFile: string): string {
    const schemaName = `${action}${entity}Schema`;
    const schemaPath = ctx.importLayer(fromFile, 'schema', `${action}${entity}.schema`);
    return `import { createZodDto } from 'nestjs-zod';
import { ${schemaName} } from '${schemaPath}';

export class ${action}${entity}Dto extends createZodDto(${schemaName}) {}
`;
}
```

```ts
// src/templates/nest/module.ts
import { Layer } from '../../stack/types';
import { ACTIONS } from '../actions';
import { RenderContext } from '../context';

function classNames(entity: string, suffix: string): readonly string[] {
    return ACTIONS.map((action) => `${action}${entity}${suffix}`);
}

function importLines(ctx: RenderContext, fromFile: string, entity: string, layer: Layer, suffix: string): string {
    return ACTIONS.map((action) => {
        const name = `${action}${entity}${suffix}`;
        const target = ctx.importLayer(fromFile, layer, `${action}${entity}.${suffix.toLowerCase()}`);
        return `import { ${name} } from '${target}';`;
    }).join('\n');
}

function list(names: readonly string[]): string {
    if (names.length === 0) return '[]';
    return `[\n${names.map((name) => `    ${name},`).join('\n')}\n  ]`;
}

export function renderModule(ctx: RenderContext, entity: string, fromFile: string, populated: boolean): string {
    const controllers = populated ? classNames(entity, 'Controller') : [];
    const providers = populated ? [...classNames(entity, 'Service'), ...classNames(entity, 'Repository')] : [];
    const imports = [
        "import { Module } from '@nestjs/common';",
        ...(populated
            ? [
                  importLines(ctx, fromFile, entity, 'controller', 'Controller'),
                  importLines(ctx, fromFile, entity, 'serverService', 'Service'),
                  importLines(ctx, fromFile, entity, 'serverRepository', 'Repository'),
              ]
            : []),
    ].join('\n');

    return `${imports}

@Module({
  controllers: ${list(controllers)},
  providers: ${list(providers)},
})
export class ${entity}Module {}
`;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/templates/__tests__/nest.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 6: Run all tests and the build, then commit**

Run: `npx vitest run && npm run build`
Expected: PASS

```bash
git add src/templates/controllers/nest.ts src/templates/nest src/templates/__tests__/nest.test.ts
git commit -m "feat: add Nest controller, DTO, and module templates"
```

---

### Task 11: Command plumbing, `make:types`, and `make:schema`

**Files:**
- Create: `src/commands/resolve.ts`, `src/commands/write.ts`, `src/commands/hints.ts`
- Modify: `src/commands/types.ts`, `src/commands/schema.ts` (full rewrite)
- Modify: `src/__tests__/helpers/project.ts` (add hints reset)
- Delete: `src/commands/__tests__/feature.test.ts`, `src/commands/__tests__/imports.test.ts`, `src/commands/__tests__/individual.test.ts`
- Test: `src/commands/__tests__/types-schema.test.ts`

The old command tests are deleted here because from this task on the rewritten commands read the stack from a fixture `package.json`, which the old suites never write. Replacement suites arrive with each rewritten command (Tasks 11 to 16). The old `src/commands/feature.ts` keeps compiling against the new `makeTypes` and `makeSchema` because their signatures are unchanged.

**Interfaces:**
- Consumes: `detectStack` (Task 2); `getProfile`, `layerDir`, `hasLayer`, `assertLayer` (Task 3); `createContext`, `RenderContext`, `ACTIONS`, `WRITE_ACTIONS` (Task 5); `renderTypes`, `renderSchema` (Task 5); `renderDto` (Task 10); fs and naming utils.
- Produces: `resolveFeature(feature): RenderContext`, `requireFeature(feature): RenderContext`, `ensureLayerDir(ctx, layer): string`; `writeIfAbsent(filePath, render): boolean`, `writeActionFiles<A extends Action>(dir, entity, suffix, actions: readonly A[], render: (action: A, filePath: string) => string): void`; `hintNestjsZod(stack)`, `hintRegisterInModule(feature, classNames)`, `resetHints()`; `makeTypes(feature, name)`, `makeSchema(feature, name)`.

- [ ] **Step 1: Delete the old command tests**

```bash
git rm src/commands/__tests__/feature.test.ts src/commands/__tests__/imports.test.ts src/commands/__tests__/individual.test.ts
```

- [ ] **Step 2: Write the plumbing modules**

```ts
// src/commands/resolve.ts
import * as path from 'path';
import { detectStack } from '../stack/detect';
import { getProfile, layerDir } from '../stack/registry';
import { Layer } from '../stack/types';
import { createContext, RenderContext } from '../templates/context';
import { fileExists, mkdirSafe } from '../utils/fs';
import { validateFeatureName } from '../utils/naming';

export function resolveFeature(feature: string): RenderContext {
    validateFeatureName(feature);
    const stack = detectStack();
    return createContext(feature, stack, getProfile(stack.stack));
}

export function requireFeature(feature: string): RenderContext {
    const ctx = resolveFeature(feature);
    if (!fileExists(ctx.featureDir)) {
        throw new Error(`Feature "${feature}" does not exist. Run: domain-driver make:feature ${feature}`);
    }
    return ctx;
}

export function ensureLayerDir(ctx: RenderContext, layer: Layer): string {
    const dir = path.join(ctx.featureDir, layerDir(ctx.profile, layer));
    mkdirSafe(dir);
    return dir;
}
```

```ts
// src/commands/write.ts
import * as path from 'path';
import { Action } from '../templates/actions';
import { fileExists, writeFileSafe } from '../utils/fs';

export function writeIfAbsent(filePath: string, render: () => string): boolean {
    if (fileExists(filePath)) {
        console.warn(`⚠️  Skipping "${path.basename(filePath)}" — already exists`);
        return false;
    }
    writeFileSafe(filePath, render());
    return true;
}

export function writeActionFiles<A extends Action>(
    dir: string,
    entity: string,
    suffix: string,
    actions: readonly A[],
    render: (action: A, filePath: string) => string
): void {
    for (const action of actions) {
        const filePath = path.join(dir, `${action}${entity}.${suffix}.ts`);
        writeIfAbsent(filePath, () => render(action, filePath));
    }
}
```

```ts
// src/commands/hints.ts
import { detectStack } from '../stack/detect';
import { DetectedStack } from '../stack/types';

let nestjsZodHinted = false;

export function resetHints(): void {
    nestjsZodHinted = false;
}

export function hintNestjsZod(stack: DetectedStack): void {
    if (stack.stack !== 'nest' || stack.hasNestjsZod || nestjsZodHinted) return;
    nestjsZodHinted = true;
    console.log('ℹ️  nestjs-zod is not installed. Run: npm install nestjs-zod');
    console.log('   Then register the pipe in AppModule: { provide: APP_PIPE, useClass: ZodValidationPipe }');
}

export function hintRegisterInModule(feature: string, classNames: readonly string[]): void {
    if (detectStack().stack !== 'nest') return;
    console.log(`ℹ️  Register ${classNames.join(', ')} in ${feature}.module.ts`);
}
```

Add the hints reset to `src/__tests__/helpers/project.ts`:

```ts
import { resetStackCache } from '../../stack/detect';
import { resetAliasCache } from '../../utils/alias';
import { resetHints } from '../../commands/hints';

export function resetCaches(): void {
    resetStackCache();
    resetAliasCache();
    resetHints();
}
```

- [ ] **Step 3: Write the failing command tests**

```ts
// src/commands/__tests__/types-schema.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTypes } from '../types';
import { makeSchema } from '../schema';
import {
    createTempProject,
    writePackageJson,
    mkdir,
    readProjectFile,
    projectFileExists,
    TempProject,
} from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('types-schema');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    project.cleanup();
    vi.restoreAllMocks();
});

describe('make:types', () => {
    it('writes the types file into the feature', () => {
        writePackageJson({ next: '1' });
        mkdir('app/cat');
        makeTypes('cat', 'Cat');
        expect(readProjectFile('app/cat/types/Cat.types.ts')).toContain('export interface Cat');
    });

    it('skips an existing file with a warning', () => {
        writePackageJson({ next: '1' });
        mkdir('app/cat');
        makeTypes('cat', 'Cat');
        makeTypes('cat', 'Cat');
        expect(console.warn).toHaveBeenCalledWith('⚠️  Skipping "Cat.types.ts" — already exists');
    });

    it('throws when the feature does not exist', () => {
        writePackageJson({ next: '1' });
        expect(() => makeTypes('cat', 'Cat')).toThrow(
            'Feature "cat" does not exist. Run: domain-driver make:feature cat'
        );
    });

    it('rejects an invalid feature name', () => {
        writePackageJson({ next: '1' });
        expect(() => makeTypes('Cat', 'Cat')).toThrow(
            'Feature name "Cat" must be kebab-case, for example coffee-type.'
        );
    });

    it('uses the stack feature root', () => {
        writePackageJson({ '@nestjs/core': '1' });
        mkdir('src/cat');
        makeTypes('cat', 'Cat');
        expect(projectFileExists('src/cat/types/Cat.types.ts')).toBe(true);
    });
});

describe('make:schema', () => {
    it('writes Create and Update schemas and no DTOs on react', () => {
        writePackageJson({ react: '1' });
        mkdir('src/features/cat');
        makeSchema('cat', 'Cat');
        expect(readProjectFile('src/features/cat/schemas/CreateCat.schema.ts')).toContain('CreateCatSchema');
        expect(readProjectFile('src/features/cat/schemas/UpdateCat.schema.ts')).not.toContain('id: z.string()');
        expect(projectFileExists('src/features/cat/dto')).toBe(false);
    });

    it('writes DTOs on nest and hints once when nestjs-zod is missing', () => {
        writePackageJson({ '@nestjs/core': '1' });
        mkdir('src/cat');
        makeSchema('cat', 'Cat');
        makeSchema('cat', 'Cat');
        expect(readProjectFile('src/cat/dto/CreateCat.dto.ts')).toContain('createZodDto(CreateCatSchema)');
        expect(readProjectFile('src/cat/dto/UpdateCat.dto.ts')).toContain('class UpdateCatDto');
        const logged = vi.mocked(console.log).mock.calls.map(([message]) => String(message));
        expect(logged.filter((line) => line.includes('nestjs-zod is not installed'))).toHaveLength(1);
        expect(logged.some((line) => line.includes('{ provide: APP_PIPE, useClass: ZodValidationPipe }'))).toBe(true);
    });

    it('does not hint when nestjs-zod is installed', () => {
        writePackageJson({ '@nestjs/core': '1', 'nestjs-zod': '1' });
        mkdir('src/cat');
        makeSchema('cat', 'Cat');
        const logged = vi.mocked(console.log).mock.calls.map(([message]) => String(message));
        expect(logged.some((line) => line.includes('nestjs-zod'))).toBe(false);
    });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run src/commands/__tests__/types-schema.test.ts`
Expected: FAIL. `makeTypes` still uses the old `ensureFeatureExists`, so "uses the stack feature root" and the nest DTO cases fail.

- [ ] **Step 5: Rewrite the two commands**

```ts
// src/commands/types.ts
import * as path from 'path';
import { assertLayer } from '../stack/registry';
import { renderTypes } from '../templates/shared/types';
import { ensureLayerDir, requireFeature } from './resolve';
import { writeIfAbsent } from './write';

export function makeTypes(feature: string, name: string): void {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'types', 'make:types');

    const filePath = path.join(ensureLayerDir(ctx, 'types'), `${name}.types.ts`);
    if (writeIfAbsent(filePath, () => renderTypes(name))) {
        console.log(`✅ Types for "${name}" created at ${filePath}`);
    }
}
```

```ts
// src/commands/schema.ts
import { assertLayer, hasLayer } from '../stack/registry';
import { WRITE_ACTIONS } from '../templates/actions';
import { RenderContext } from '../templates/context';
import { renderDto } from '../templates/nest/dto';
import { renderSchema } from '../templates/shared/schema';
import { hintNestjsZod } from './hints';
import { ensureLayerDir, requireFeature } from './resolve';
import { writeActionFiles } from './write';

export function makeSchema(feature: string, name: string): void {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'schema', 'make:schema');

    const schemaDir = ensureLayerDir(ctx, 'schema');
    writeActionFiles(schemaDir, name, 'schema', WRITE_ACTIONS, (action) => renderSchema(action, name));
    console.log(`✅ Schemas for "${name}" created at ${schemaDir}`);

    if (hasLayer(ctx.profile, 'dto')) writeDtos(ctx, name);
}

function writeDtos(ctx: RenderContext, name: string): void {
    const dtoDir = ensureLayerDir(ctx, 'dto');
    writeActionFiles(dtoDir, name, 'dto', WRITE_ACTIONS, (action, filePath) =>
        renderDto(ctx, action, name, filePath)
    );
    hintNestjsZod(ctx.stack);
    console.log(`✅ DTOs for "${name}" created at ${dtoDir}`);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/commands/__tests__/types-schema.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 7: Run all tests and the build, then commit**

Run: `npx vitest run && npm run build`
Expected: PASS (old command suites are gone; everything else green), build succeeds

```bash
git add -A src/commands src/__tests__/helpers/project.ts
git commit -m "feat: stack-aware make:types and make:schema with Nest DTOs"
```

---

### Task 12: Component, container, and hook commands

**Files:**
- Modify: `src/commands/component.ts`, `src/commands/container.ts`, `src/commands/hook.ts` (full rewrite)
- Test: `src/commands/__tests__/frontend-commands.test.ts`

**Interfaces:**
- Consumes: `requireFeature`, `ensureLayerDir` (Task 11); `assertLayer`, `componentDir` (Task 3); `renderComponent`, `renderContainer`, `renderHook` (Task 6).
- Produces: `ComponentType`, `parseComponentType(value: string | undefined): ComponentType`, `makeComponent(feature, name, type?)`, `makeContainer(feature, name, pascalName?)`, `makeHook(feature, name, pascalName?)`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/commands/__tests__/frontend-commands.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeComponent, parseComponentType } from '../component';
import { makeContainer } from '../container';
import { makeHook } from '../hook';
import {
    createTempProject,
    writePackageJson,
    mkdir,
    readProjectFile,
    TempProject,
} from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('frontend-commands');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
    project.cleanup();
    vi.restoreAllMocks();
});

describe('on next-frontend', () => {
    beforeEach(() => {
        writePackageJson({ next: '1' });
        mkdir('app/cat');
    });

    it('make:component writes a client component by default', () => {
        makeComponent('cat', 'MyButton');
        const content = readProjectFile('app/cat/components/client/MyButton.tsx');
        expect(content).toContain("'use client'");
        expect(content).toContain('export default function MyButton');
    });

    it('make:component writes a server component without the directive', () => {
        makeComponent('cat', 'DataTable', 'server');
        expect(readProjectFile('app/cat/components/server/DataTable.tsx')).not.toContain("'use client'");
    });

    it('make:component throws when the file exists', () => {
        makeComponent('cat', 'MyButton');
        expect(() => makeComponent('cat', 'MyButton')).toThrow('already exists');
    });

    it('make:container writes a container with the directive', () => {
        makeContainer('cat', 'CatContainer');
        const content = readProjectFile('app/cat/containers/CatContainer.tsx');
        expect(content).toContain("'use client'");
        expect(content).toContain("from '../hooks/useCat'");
        expect(content).toContain("from '../components/client/Cat'");
    });

    it('make:hook writes a hook with the directive', () => {
        makeHook('cat', 'useCat');
        const content = readProjectFile('app/cat/hooks/useCat.ts');
        expect(content).toContain("'use client'");
        expect(content).toContain('export function useCat()');
        expect(content).toContain("from '../services/ListCat.service'");
    });

    it('make:hook throws when the file exists', () => {
        makeHook('cat', 'useCat');
        expect(() => makeHook('cat', 'useCat')).toThrow('already exists');
    });
});

describe('on react', () => {
    beforeEach(() => {
        writePackageJson({ react: '1' });
        mkdir('src/features/cat');
    });

    it('make:component writes into the flat components folder without a directive', () => {
        makeComponent('cat', 'Cat');
        expect(readProjectFile('src/features/cat/components/Cat.tsx')).not.toContain("'use client'");
    });

    it('make:component rejects the server type', () => {
        expect(() => makeComponent('cat', 'Cat', 'server')).toThrow('The react stack has no server components.');
    });

    it('make:container imports the flat component path', () => {
        makeContainer('cat', 'CatContainer');
        const content = readProjectFile('src/features/cat/containers/CatContainer.tsx');
        expect(content).not.toContain("'use client'");
        expect(content).toContain("from '../components/Cat'");
    });
});

describe('on node', () => {
    beforeEach(() => {
        writePackageJson({ express: '1' });
        mkdir('src/features/cat');
    });

    it('make:hook is not available', () => {
        expect(() => makeHook('cat', 'useCat')).toThrow(
            'make:hook is not available for the node stack. Available: make:service, make:repository, make:controller, make:schema, make:types.'
        );
    });

    it('make:component and make:container are not available', () => {
        expect(() => makeComponent('cat', 'Cat')).toThrow('make:component is not available for the node stack');
        expect(() => makeContainer('cat', 'CatContainer')).toThrow('make:container is not available for the node stack');
    });
});

describe('parseComponentType', () => {
    it('defaults anything but server to client', () => {
        expect(parseComponentType('server')).toBe('server');
        expect(parseComponentType('client')).toBe('client');
        expect(parseComponentType(undefined)).toBe('client');
        expect(parseComponentType('other')).toBe('client');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/commands/__tests__/frontend-commands.test.ts`
Expected: FAIL with "parseComponentType is not a function" and path mismatches on react

- [ ] **Step 3: Rewrite the three commands**

```ts
// src/commands/component.ts
import * as path from 'path';
import { assertLayer, componentDir } from '../stack/registry';
import { renderComponent } from '../templates/frontend/component';
import { fileExists, mkdirSafe, writeFileSafe } from '../utils/fs';
import { requireFeature } from './resolve';

export type ComponentType = 'client' | 'server';

export function parseComponentType(value: string | undefined): ComponentType {
    return value === 'server' ? 'server' : 'client';
}

export function makeComponent(feature: string, name: string, type: ComponentType = 'client'): void {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'component', 'make:component');

    if (type === 'server' && !ctx.profile.serverComponents) {
        throw new Error(`The ${ctx.profile.name} stack has no server components.`);
    }

    const dir = path.join(ctx.featureDir, componentDir(ctx.profile, type));
    mkdirSafe(dir);
    const filePath = path.join(dir, `${name}.tsx`);

    if (fileExists(filePath)) {
        throw new Error(`Component "${name}" already exists at ${filePath}`);
    }

    const directive = type === 'client' && ctx.profile.clientDirective;
    writeFileSafe(filePath, renderComponent(name, directive));
    console.log(`✅ Component "${name}" created at ${filePath}`);
}
```

```ts
// src/commands/container.ts
import * as path from 'path';
import { assertLayer } from '../stack/registry';
import { renderContainer } from '../templates/frontend/container';
import { fileExists, writeFileSafe } from '../utils/fs';
import { ensureLayerDir, requireFeature } from './resolve';

export function makeContainer(feature: string, name: string, pascalName?: string): void {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'container', 'make:container');

    const filePath = path.join(ensureLayerDir(ctx, 'container'), `${name}.tsx`);
    if (fileExists(filePath)) {
        throw new Error(`Container "${name}" already exists at ${filePath}`);
    }

    const entity = pascalName ?? name.replace(/Container$/, '');
    writeFileSafe(filePath, renderContainer(ctx, name, entity, filePath));
    console.log(`✅ Container "${name}" created at ${filePath}`);
}
```

```ts
// src/commands/hook.ts
import * as path from 'path';
import { assertLayer } from '../stack/registry';
import { renderHook } from '../templates/frontend/hook';
import { fileExists, writeFileSafe } from '../utils/fs';
import { ensureLayerDir, requireFeature } from './resolve';

export function makeHook(feature: string, name: string, pascalName?: string): void {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'hook', 'make:hook');

    const filePath = path.join(ensureLayerDir(ctx, 'hook'), `${name}.ts`);
    if (fileExists(filePath)) {
        throw new Error(`Hook "${name}" already exists at ${filePath}`);
    }

    const entity = pascalName ?? name.replace(/^use/, '');
    writeFileSafe(filePath, renderHook(ctx, name, entity, filePath));
    console.log(`✅ Hook "${name}" created at ${filePath}`);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/commands/__tests__/frontend-commands.test.ts`
Expected: PASS, 12 tests

- [ ] **Step 5: Run all tests and the build, then commit**

Run: `npx vitest run && npm run build`
Expected: PASS

```bash
git add src/commands
git commit -m "feat: stack-aware make:component, make:container, and make:hook"
```

---

### Task 13: Service and repository commands with `--side`

**Files:**
- Create: `src/commands/sides.ts`
- Modify: `src/commands/service.ts`, `src/commands/repository.ts` (full rewrite)
- Test: `src/commands/__tests__/data-commands.test.ts`

**Interfaces:**
- Consumes: `Side`, `SideOption`, `Layer`, `StackProfile` (Task 1); `hasLayer`, `assertLayer` (Task 3); `renderService`, `renderClientRepository`, `renderServerRepository` (Task 7); `requireFeature`, `ensureLayerDir`, `writeActionFiles` (Task 11).
- Produces: `SideSpec { client: Layer; server: Layer; command: string; noun: string }`, `SERVICE_SIDES`, `REPOSITORY_SIDES`, `parseSide(value: string): SideOption`, `resolveSides(profile, option, spec): readonly Side[]`; `makeService(feature, name, side?: SideOption)`, `makeRepository(feature, name, side?: SideOption)`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/commands/__tests__/data-commands.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeService } from '../service';
import { makeRepository } from '../repository';
import { parseSide } from '../sides';
import {
    createTempProject,
    writePackageJson,
    mkdir,
    readProjectFile,
    projectFileExists,
    listFiles,
    TempProject,
} from '../../__tests__/helpers/project';

let project: TempProject;

const ACTION_FILES = (entity: string, suffix: string): string[] =>
    ['List', 'Show', 'Create', 'Update', 'Delete'].map((action) => `${action}${entity}.${suffix}.ts`).sort();

beforeEach(() => {
    project = createTempProject('data-commands');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    project.cleanup();
    vi.restoreAllMocks();
});

describe('parseSide', () => {
    it('accepts the three values and rejects others', () => {
        expect(parseSide('client')).toBe('client');
        expect(parseSide('server')).toBe('server');
        expect(parseSide('both')).toBe('both');
        expect(() => parseSide('left')).toThrow('Invalid --side "left". Use client, server, or both.');
    });
});

describe('on next-frontend', () => {
    beforeEach(() => {
        writePackageJson({ next: '1' });
        mkdir('app/cat');
    });

    it('make:service writes five client services at the top level', () => {
        makeService('cat', 'Cat');
        expect(listFiles('app/cat/services')).toEqual(ACTION_FILES('Cat', 'service'));
        expect(readProjectFile('app/cat/services/CreateCat.service.ts')).toContain(
            "from '../repositories/CreateCat.repository'"
        );
    });

    it('make:service skips existing files without throwing', () => {
        makeService('cat', 'Cat');
        expect(() => makeService('cat', 'Cat')).not.toThrow();
        expect(console.warn).toHaveBeenCalledWith('⚠️  Skipping "ListCat.service.ts" — already exists');
    });

    it('make:repository writes fetch repositories', () => {
        makeRepository('cat', 'Cat');
        expect(listFiles('app/cat/repositories')).toEqual(ACTION_FILES('Cat', 'repository'));
        expect(readProjectFile('app/cat/repositories/CreateCat.repository.ts')).toContain("fetch('/api/cat'");
    });

    it('rejects the server side', () => {
        expect(() => makeService('cat', 'Cat', 'server')).toThrow(
            'The next-frontend stack has no server-side services.'
        );
        expect(() => makeRepository('cat', 'Cat', 'server')).toThrow(
            'The next-frontend stack has no server-side repositories.'
        );
    });
});

describe('on next-fullstack', () => {
    beforeEach(() => {
        writePackageJson({ next: '1' });
        mkdir('app/api');
        mkdir('app/cat');
    });

    it('make:service writes both sides by default', () => {
        makeService('cat', 'Cat');
        expect(listFiles('app/cat/client/services')).toEqual(ACTION_FILES('Cat', 'service'));
        expect(listFiles('app/cat/server/services')).toEqual(ACTION_FILES('Cat', 'service'));
        expect(readProjectFile('app/cat/server/services/CreateCat.service.ts')).toContain(
            "from '../repositories/CreateCat.repository'"
        );
        expect(readProjectFile('app/cat/server/services/CreateCat.service.ts')).toContain(
            "from '../../types/Cat.types'"
        );
    });

    it('make:repository --side server writes only the stub side', () => {
        makeRepository('cat', 'Cat', 'server');
        expect(projectFileExists('app/cat/client/repositories')).toBe(false);
        expect(readProjectFile('app/cat/server/repositories/ListCat.repository.ts')).toContain('is not implemented');
    });

    it('make:repository --side client writes only the fetch side', () => {
        makeRepository('cat', 'Cat', 'client');
        expect(projectFileExists('app/cat/server/repositories')).toBe(false);
        expect(readProjectFile('app/cat/client/repositories/ListCat.repository.ts')).toContain("fetch('/api/cat')");
    });
});

describe('on node', () => {
    beforeEach(() => {
        writePackageJson({ express: '1' });
        mkdir('src/features/cat');
    });

    it('writes server services and stub repositories at the top level', () => {
        makeService('cat', 'Cat');
        makeRepository('cat', 'Cat');
        expect(listFiles('src/features/cat/services')).toEqual(ACTION_FILES('Cat', 'service'));
        expect(readProjectFile('src/features/cat/services/ListCat.service.ts')).toContain('const repository = new ListCatRepository();');
        expect(readProjectFile('src/features/cat/repositories/ListCat.repository.ts')).toContain('is not implemented');
    });

    it('rejects the client side', () => {
        expect(() => makeService('cat', 'Cat', 'client')).toThrow('The node stack has no client-side services.');
    });
});

describe('on nest', () => {
    beforeEach(() => {
        writePackageJson({ '@nestjs/core': '1' });
        mkdir('src/cat');
    });

    it('writes injectable services and repositories', () => {
        makeService('cat', 'Cat');
        makeRepository('cat', 'Cat');
        expect(readProjectFile('src/cat/services/CreateCat.service.ts')).toContain('@Injectable()');
        expect(readProjectFile('src/cat/repositories/CreateCat.repository.ts')).toContain('@Injectable()');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/commands/__tests__/data-commands.test.ts`
Expected: FAIL with "Failed to resolve import '../sides'"

- [ ] **Step 3: Write the sides module**

```ts
// src/commands/sides.ts
import { assertLayer, hasLayer } from '../stack/registry';
import { Layer, Side, SideOption, StackProfile } from '../stack/types';

export interface SideSpec {
    readonly client: Layer;
    readonly server: Layer;
    readonly command: string;
    readonly noun: string;
}

export const SERVICE_SIDES: SideSpec = Object.freeze({
    client: 'clientService',
    server: 'serverService',
    command: 'make:service',
    noun: 'services',
});

export const REPOSITORY_SIDES: SideSpec = Object.freeze({
    client: 'clientRepository',
    server: 'serverRepository',
    command: 'make:repository',
    noun: 'repositories',
});

const SIDES = ['client', 'server'] as const;

export function parseSide(value: string): SideOption {
    if (value === 'client' || value === 'server' || value === 'both') return value;
    throw new Error(`Invalid --side "${value}". Use client, server, or both.`);
}

export function resolveSides(profile: StackProfile, option: SideOption, spec: SideSpec): readonly Side[] {
    const available = SIDES.filter((side) => hasLayer(profile, spec[side]));
    if (available.length === 0) assertLayer(profile, spec.server, spec.command);
    if (option === 'both') return available;
    if (available.includes(option)) return [option];
    throw new Error(`The ${profile.name} stack has no ${option}-side ${spec.noun}.`);
}
```

- [ ] **Step 4: Rewrite the two commands**

```ts
// src/commands/service.ts
import { SideOption } from '../stack/types';
import { ACTIONS } from '../templates/actions';
import { renderService } from '../templates/service';
import { ensureLayerDir, requireFeature } from './resolve';
import { resolveSides, SERVICE_SIDES } from './sides';
import { writeActionFiles } from './write';

export function makeService(feature: string, name: string, side: SideOption = 'both'): void {
    const ctx = requireFeature(feature);

    for (const current of resolveSides(ctx.profile, side, SERVICE_SIDES)) {
        const dir = ensureLayerDir(ctx, SERVICE_SIDES[current]);
        writeActionFiles(dir, name, 'service', ACTIONS, (action, filePath) =>
            renderService(ctx, action, name, filePath, current)
        );
        console.log(`✅ Services (${current}) for "${name}" created at ${dir}`);
    }
}
```

```ts
// src/commands/repository.ts
import { SideOption } from '../stack/types';
import { ACTIONS } from '../templates/actions';
import { renderServerRepository } from '../templates/backend/server-repository';
import { renderClientRepository } from '../templates/frontend/client-repository';
import { ensureLayerDir, requireFeature } from './resolve';
import { REPOSITORY_SIDES, resolveSides } from './sides';
import { writeActionFiles } from './write';

export function makeRepository(feature: string, name: string, side: SideOption = 'both'): void {
    const ctx = requireFeature(feature);

    for (const current of resolveSides(ctx.profile, side, REPOSITORY_SIDES)) {
        const dir = ensureLayerDir(ctx, REPOSITORY_SIDES[current]);
        const render = current === 'client' ? renderClientRepository : renderServerRepository;
        writeActionFiles(dir, name, 'repository', ACTIONS, (action, filePath) =>
            render(ctx, action, name, filePath)
        );
        console.log(`✅ Repositories (${current}) for "${name}" created at ${dir}`);
    }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/commands/__tests__/data-commands.test.ts`
Expected: PASS, 11 tests

- [ ] **Step 6: Run all tests and the build, then commit**

Run: `npx vitest run && npm run build`
Expected: PASS

```bash
git add src/commands
git commit -m "feat: side-aware make:service and make:repository"
```

---

### Task 14: Controller command

**Files:**
- Create: `src/commands/controller.ts`
- Test: `src/commands/__tests__/controller.test.ts`

**Interfaces:**
- Consumes: `renderNodeController`, `renderNodeRoutes` (Task 8); `renderCollectionRoute`, `renderItemRoute` (Task 9); `renderNestController` (Task 10); `apiRouteDir` (Task 4); `requireFeature`, `ensureLayerDir`, `writeActionFiles`, `writeIfAbsent` (Task 11).
- Produces: `makeController(feature, name)`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/commands/__tests__/controller.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeController } from '../controller';
import {
    createTempProject,
    writePackageJson,
    mkdir,
    readProjectFile,
    projectFileExists,
    listFiles,
    TempProject,
} from '../../__tests__/helpers/project';

let project: TempProject;

const CONTROLLER_FILES = ['List', 'Show', 'Create', 'Update', 'Delete']
    .map((action) => `${action}Cat.controller.ts`)
    .sort();

beforeEach(() => {
    project = createTempProject('controller');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
    project.cleanup();
    vi.restoreAllMocks();
});

describe('on node', () => {
    it.each([
        ['express', "from 'express'"],
        ['fastify', "from 'fastify'"],
        ['hono', "from 'hono'"],
    ])('writes five %s controllers and a routes file', (framework, marker) => {
        writePackageJson({ [framework]: '1' });
        mkdir('src/features/cat');
        makeController('cat', 'Cat');
        expect(listFiles('src/features/cat/controllers')).toEqual(CONTROLLER_FILES);
        expect(readProjectFile('src/features/cat/controllers/CreateCat.controller.ts')).toContain(marker);
        expect(readProjectFile('src/features/cat/cat.routes.ts')).toContain(marker);
    });

    it('falls back to generic controllers with an info line and no routes file', () => {
        writePackageJson({});
        mkdir('src/features/cat');
        makeController('cat', 'Cat');
        expect(readProjectFile('src/features/cat/controllers/CreateCat.controller.ts')).toContain(
            'export class CreateCatController'
        );
        expect(projectFileExists('src/features/cat/cat.routes.ts')).toBe(false);
        expect(console.log).toHaveBeenCalledWith(
            'ℹ️  No HTTP framework detected, generating framework-agnostic controllers.'
        );
    });
});

describe('on nest', () => {
    it('writes five decorated controllers', () => {
        writePackageJson({ '@nestjs/core': '1' });
        mkdir('src/cat');
        makeController('cat', 'Cat');
        expect(listFiles('src/cat/controllers')).toEqual(CONTROLLER_FILES);
        expect(readProjectFile('src/cat/controllers/ShowCat.controller.ts')).toContain("@Controller('cat')");
        expect(projectFileExists('src/cat/cat.routes.ts')).toBe(false);
    });
});

describe('on next-fullstack', () => {
    it('writes the collection and item route handlers', () => {
        writePackageJson({ next: '1' });
        mkdir('app/api');
        mkdir('app/cat');
        makeController('cat', 'Cat');
        expect(readProjectFile('app/api/cat/route.ts')).toContain('export async function POST');
        expect(readProjectFile('app/api/cat/[id]/route.ts')).toContain('export async function DELETE');
        expect(projectFileExists('app/cat/controllers')).toBe(false);
    });

    it('skips existing route files', () => {
        writePackageJson({ next: '1' });
        mkdir('app/api');
        mkdir('app/cat');
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        makeController('cat', 'Cat');
        makeController('cat', 'Cat');
        expect(warn).toHaveBeenCalledWith('⚠️  Skipping "route.ts" — already exists');
    });
});

describe('on frontend-only stacks', () => {
    it.each([
        [{ next: '1' }, 'app/cat', 'next-frontend'],
        [{ react: '1' }, 'src/features/cat', 'react'],
    ])('rejects %o', (deps, featurePath, stack) => {
        writePackageJson(deps);
        mkdir(featurePath);
        expect(() => makeController('cat', 'Cat')).toThrow(
            `make:controller is not available for the ${stack} stack.`
        );
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/commands/__tests__/controller.test.ts`
Expected: FAIL with "Failed to resolve import '../controller'"

- [ ] **Step 3: Write the command**

```ts
// src/commands/controller.ts
import * as path from 'path';
import { assertLayer } from '../stack/registry';
import { ACTIONS } from '../templates/actions';
import { RenderContext } from '../templates/context';
import { renderNestController } from '../templates/controllers/nest';
import { renderCollectionRoute, renderItemRoute } from '../templates/controllers/next-route';
import { renderNodeController, renderNodeRoutes } from '../templates/controllers/node';
import { mkdirSafe } from '../utils/fs';
import { apiRouteDir } from '../utils/paths';
import { ensureLayerDir, requireFeature } from './resolve';
import { writeActionFiles, writeIfAbsent } from './write';

export function makeController(feature: string, name: string): void {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'controller', 'make:controller');

    if (ctx.profile.name === 'next-fullstack') {
        writeNextRoutes(ctx, name);
        return;
    }

    const dir = ensureLayerDir(ctx, 'controller');
    const render = ctx.profile.name === 'nest' ? renderNestController : renderNodeController;
    writeActionFiles(dir, name, 'controller', ACTIONS, (action, filePath) =>
        render(ctx, action, name, filePath)
    );
    console.log(`✅ Controllers for "${name}" created at ${dir}`);

    if (ctx.profile.name === 'node') writeNodeRoutes(ctx, name);
}

function writeNodeRoutes(ctx: RenderContext, name: string): void {
    const filePath = path.join(ctx.featureDir, `${ctx.feature}.routes.ts`);
    const content = renderNodeRoutes(ctx, name, filePath);

    if (content === null) {
        console.log('ℹ️  No HTTP framework detected, generating framework-agnostic controllers.');
        return;
    }
    if (writeIfAbsent(filePath, () => content)) {
        console.log(`✅ Routes for "${name}" created at ${filePath}`);
    }
}

function writeNextRoutes(ctx: RenderContext, name: string): void {
    const collectionDir = apiRouteDir(ctx.stack, ctx.feature);
    const itemDir = path.join(collectionDir, '[id]');
    mkdirSafe(itemDir);

    const collectionFile = path.join(collectionDir, 'route.ts');
    const itemFile = path.join(itemDir, 'route.ts');
    writeIfAbsent(collectionFile, () => renderCollectionRoute(ctx, name, collectionFile));
    writeIfAbsent(itemFile, () => renderItemRoute(ctx, name, itemFile));
    console.log(`✅ Route handlers for "${name}" created at ${collectionDir}`);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/commands/__tests__/controller.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Run all tests and the build, then commit**

Run: `npx vitest run && npm run build`
Expected: PASS

```bash
git add src/commands/controller.ts src/commands/__tests__/controller.test.ts
git commit -m "feat: add make:controller for node, nest, and next route handlers"
```

---

### Task 15: Feature command

**Files:**
- Modify: `src/commands/feature.ts` (full rewrite)
- Test: `src/commands/__tests__/feature.test.ts`

**Interfaces:**
- Consumes: `resolveFeature` (Task 11); `hasLayer` (Task 3); `renderPage` (Task 6); `renderModule` (Task 10); every `make*` command from Tasks 11 to 14; `toPascalCase` (Task 1).
- Produces: `makeFeature(name, all?: boolean): Promise<void>` (signature unchanged).

- [ ] **Step 1: Write the failing tests**

```ts
// src/commands/__tests__/feature.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeFeature } from '../feature';
import {
    createTempProject,
    writePackageJson,
    mkdir,
    readProjectFile,
    projectFileExists,
    listFiles,
    TempProject,
} from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('feature');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
    project.cleanup();
    vi.restoreAllMocks();
});

describe('make:feature on next-frontend', () => {
    beforeEach(() => writePackageJson({ next: '1' }));

    it('creates the profile folders with .gitkeep and a plain page', async () => {
        await makeFeature('test-feature');
        expect(listFiles('app/test-feature')).toEqual([
            'components/client/.gitkeep',
            'components/server/.gitkeep',
            'containers/.gitkeep',
            'hooks/.gitkeep',
            'page.tsx',
            'repositories/.gitkeep',
            'schemas/.gitkeep',
            'services/.gitkeep',
            'types/.gitkeep',
        ]);
        const page = readProjectFile('app/test-feature/page.tsx');
        expect(page).toContain('export default function TestFeaturePage()');
        expect(page).not.toContain('import');
    });

    it('throws if the feature already exists', async () => {
        await makeFeature('test-feature');
        await expect(makeFeature('test-feature')).rejects.toThrow('already exists');
    });

    it('rejects an invalid name before touching disk', async () => {
        await expect(makeFeature('TestFeature')).rejects.toThrow('must be kebab-case');
        expect(projectFileExists('app')).toBe(false);
    });

    it('scaffolds every layer with -a and no .gitkeep files', async () => {
        await makeFeature('coffee-type', true);
        const files = listFiles('app/coffee-type');
        expect(files.some((file) => file.endsWith('.gitkeep'))).toBe(false);
        expect(files).toContain('components/client/CoffeeType.tsx');
        expect(files).toContain('containers/CoffeeTypeContainer.tsx');
        expect(files).toContain('hooks/useCoffeeType.ts');
        expect(files).toContain('services/ListCoffeeType.service.ts');
        expect(files).toContain('repositories/DeleteCoffeeType.repository.ts');
        expect(files).toContain('schemas/UpdateCoffeeType.schema.ts');
        expect(files).toContain('types/CoffeeType.types.ts');
        expect(readProjectFile('app/coffee-type/page.tsx')).toContain(
            "import CoffeeTypeContainer from './containers/CoffeeTypeContainer';"
        );
    });

    it('uses src/app when present', async () => {
        mkdir('src/app');
        await makeFeature('cat');
        expect(projectFileExists('src/app/cat/page.tsx')).toBe(true);
    });
});

describe('make:feature on react', () => {
    it('creates flat folders and no entry file', async () => {
        writePackageJson({ react: '1' });
        mkdir('src');
        await makeFeature('cat');
        expect(listFiles('src/features/cat')).toEqual([
            'components/.gitkeep',
            'containers/.gitkeep',
            'hooks/.gitkeep',
            'repositories/.gitkeep',
            'schemas/.gitkeep',
            'services/.gitkeep',
            'types/.gitkeep',
        ]);
    });
});

describe('make:feature on nest', () => {
    beforeEach(() => writePackageJson({ '@nestjs/core': '1', 'nestjs-zod': '1' }));

    it('creates an empty module without -a', async () => {
        await makeFeature('coffee-type');
        const module = readProjectFile('src/coffee-type/coffee-type.module.ts');
        expect(module).toContain('controllers: [],');
        expect(module).toContain('providers: [],');
        expect(module).toContain('export class CoffeeTypeModule {}');
    });

    it('creates a populated module with -a', async () => {
        await makeFeature('coffee-type', true);
        const module = readProjectFile('src/coffee-type/coffee-type.module.ts');
        expect(module).toContain('ListCoffeeTypeController,');
        expect(module).toContain('DeleteCoffeeTypeRepository,');
        expect(projectFileExists('src/coffee-type/dto/CreateCoffeeType.dto.ts')).toBe(true);
    });
});

describe('make:feature on node', () => {
    it('writes the routes file with -a when a framework is present', async () => {
        writePackageJson({ fastify: '1' });
        mkdir('src');
        await makeFeature('cat', true);
        expect(projectFileExists('src/features/cat/cat.routes.ts')).toBe(true);
        expect(projectFileExists('src/features/cat/controllers/ListCat.controller.ts')).toBe(true);
        expect(projectFileExists('src/features/cat/hooks')).toBe(false);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/commands/__tests__/feature.test.ts`
Expected: FAIL. The old `makeFeature` writes to `app/` regardless of stack and never writes a module.

- [ ] **Step 3: Rewrite the command**

```ts
// src/commands/feature.ts
import * as path from 'path';
import { hasLayer } from '../stack/registry';
import { RenderContext } from '../templates/context';
import { renderPage } from '../templates/frontend/page';
import { renderModule } from '../templates/nest/module';
import { fileExists, mkdirSafe, writeFileSafe } from '../utils/fs';
import { toPascalCase } from '../utils/naming';
import { makeComponent } from './component';
import { makeContainer } from './container';
import { makeController } from './controller';
import { makeHook } from './hook';
import { makeRepository } from './repository';
import { resolveFeature } from './resolve';
import { makeSchema } from './schema';
import { makeService } from './service';
import { makeTypes } from './types';

export async function makeFeature(name: string, all: boolean = false): Promise<void> {
    const ctx = resolveFeature(name);

    if (fileExists(ctx.featureDir)) {
        throw new Error(`Feature "${name}" already exists at ${ctx.featureDir}`);
    }

    const entity = toPascalCase(name);
    createFolders(ctx, all);
    console.log(`✅ Feature "${name}" scaffolded at ${ctx.featureDir}`);

    if (all) scaffoldLayers(ctx, entity);
    writeEntryFile(ctx, entity, all);

    if (all) console.log(`✅ All files scaffolded for "${name}"`);
}

function createFolders(ctx: RenderContext, all: boolean): void {
    for (const folder of ctx.profile.folders) {
        const dir = path.join(ctx.featureDir, folder);
        mkdirSafe(dir);
        if (!all) writeFileSafe(path.join(dir, '.gitkeep'), '');
    }
}

function scaffoldLayers(ctx: RenderContext, entity: string): void {
    const { feature, profile } = ctx;
    if (hasLayer(profile, 'types')) makeTypes(feature, entity);
    if (hasLayer(profile, 'schema')) makeSchema(feature, entity);
    if (hasLayer(profile, 'serverRepository')) makeRepository(feature, entity, 'server');
    if (hasLayer(profile, 'serverService')) makeService(feature, entity, 'server');
    if (hasLayer(profile, 'controller')) makeController(feature, entity);
    if (hasLayer(profile, 'clientRepository')) makeRepository(feature, entity, 'client');
    if (hasLayer(profile, 'clientService')) makeService(feature, entity, 'client');
    if (hasLayer(profile, 'hook')) makeHook(feature, `use${entity}`, entity);
    if (hasLayer(profile, 'component')) makeComponent(feature, entity, 'client');
    if (hasLayer(profile, 'container')) makeContainer(feature, `${entity}Container`, entity);
}

function writeEntryFile(ctx: RenderContext, entity: string, all: boolean): void {
    if (hasLayer(ctx.profile, 'page')) {
        const filePath = path.join(ctx.featureDir, 'page.tsx');
        writeFileSafe(filePath, renderPage(ctx, entity, filePath, all));
    }
    if (hasLayer(ctx.profile, 'module')) {
        const filePath = path.join(ctx.featureDir, `${ctx.feature}.module.ts`);
        writeFileSafe(filePath, renderModule(ctx, entity, filePath, all));
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/commands/__tests__/feature.test.ts`
Expected: PASS, 9 tests

- [ ] **Step 5: Run all tests and the build, then commit**

Run: `npx vitest run && npm run build`
Expected: PASS

```bash
git add src/commands/feature.ts src/commands/__tests__/feature.test.ts
git commit -m "feat: profile-driven make:feature with per-stack entry files"
```

---

### Task 16: Per-stack integration tests with import resolution

**Files:**
- Test: `src/commands/__tests__/stacks.test.ts`

**Interfaces:**
- Consumes: `makeFeature` (Task 15), helpers (Task 2), `AliasConfig` (Task 4).

This task adds tests only. Every generated import in every stack must resolve to a file on disk.

- [ ] **Step 1: Write the integration tests**

```ts
// src/commands/__tests__/stacks.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { makeFeature } from '../feature';
import { AliasConfig } from '../../utils/alias';
import {
    createTempProject,
    writePackageJson,
    writeTsconfig,
    mkdir,
    listFiles,
    TempProject,
} from '../../__tests__/helpers/project';

let project: TempProject;

const ACTIONS = ['List', 'Show', 'Create', 'Update', 'Delete'];
const perAction = (dir: string, suffix: string): string[] =>
    ACTIONS.map((action) => `${dir}/${action}CoffeeType.${suffix}.ts`);
const writeActions = (dir: string, suffix: string): string[] =>
    ['Create', 'Update'].map((action) => `${dir}/${action}CoffeeType.${suffix}.ts`);

function assertImportsResolve(relativeRoot: string, alias: AliasConfig | null): void {
    for (const file of listFiles(relativeRoot)) {
        const absolute = path.join(process.cwd(), relativeRoot, file);
        const content = fs.readFileSync(absolute, 'utf-8');
        for (const match of content.matchAll(/from '([^']+)'/g)) {
            const target = resolveTarget(absolute, match[1], alias);
            if (target === null) continue;
            const exists = fs.existsSync(`${target}.ts`) || fs.existsSync(`${target}.tsx`);
            expect(exists, `${file} imports missing ${match[1]}`).toBe(true);
        }
    }
}

function resolveTarget(fromFile: string, specifier: string, alias: AliasConfig | null): string | null {
    if (specifier.startsWith('.')) return path.resolve(path.dirname(fromFile), specifier);
    if (alias && specifier.startsWith(alias.prefix)) {
        return path.resolve(process.cwd(), alias.root, specifier.slice(alias.prefix.length));
    }
    return null;
}

beforeEach(() => {
    project = createTempProject('stacks');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
    project.cleanup();
    vi.restoreAllMocks();
});

describe('make:feature -a per stack', () => {
    it('next-frontend', async () => {
        writePackageJson({ next: '1' });
        await makeFeature('coffee-type', true);
        expect(listFiles('app')).toEqual(
            [
                'coffee-type/components/client/CoffeeType.tsx',
                'coffee-type/containers/CoffeeTypeContainer.tsx',
                'coffee-type/hooks/useCoffeeType.ts',
                'coffee-type/page.tsx',
                ...perAction('coffee-type/repositories', 'repository'),
                ...writeActions('coffee-type/schemas', 'schema'),
                ...perAction('coffee-type/services', 'service'),
                'coffee-type/types/CoffeeType.types.ts',
            ].sort()
        );
        assertImportsResolve('app', null);
    });

    it('next-fullstack with relative imports', async () => {
        writePackageJson({ next: '1' });
        mkdir('app/api');
        await makeFeature('coffee-type', true);
        expect(listFiles('app')).toEqual(
            [
                'api/coffee-type/[id]/route.ts',
                'api/coffee-type/route.ts',
                ...perAction('coffee-type/client/repositories', 'repository'),
                ...perAction('coffee-type/client/services', 'service'),
                'coffee-type/components/client/CoffeeType.tsx',
                'coffee-type/containers/CoffeeTypeContainer.tsx',
                'coffee-type/hooks/useCoffeeType.ts',
                'coffee-type/page.tsx',
                ...writeActions('coffee-type/schemas', 'schema'),
                ...perAction('coffee-type/server/repositories', 'repository'),
                ...perAction('coffee-type/server/services', 'service'),
                'coffee-type/types/CoffeeType.types.ts',
            ].sort()
        );
        assertImportsResolve('app', null);
    });

    it('next-fullstack with a root alias under src/app', async () => {
        writePackageJson({ next: '1' });
        writeTsconfig({ '@/*': ['./src/*'] });
        mkdir('src/app/api');
        await makeFeature('coffee-type', true);
        const route = fs.readFileSync(path.join(process.cwd(), 'src/app/api/coffee-type/route.ts'), 'utf-8');
        expect(route).toContain("from '@/app/coffee-type/server/services/ListCoffeeType.service'");
        assertImportsResolve('src/app', { prefix: '@/', root: 'src' });
    });

    it('react', async () => {
        writePackageJson({ react: '1' });
        mkdir('src');
        await makeFeature('coffee-type', true);
        expect(listFiles('src/features')).toEqual(
            [
                'coffee-type/components/CoffeeType.tsx',
                'coffee-type/containers/CoffeeTypeContainer.tsx',
                'coffee-type/hooks/useCoffeeType.ts',
                ...perAction('coffee-type/repositories', 'repository'),
                ...writeActions('coffee-type/schemas', 'schema'),
                ...perAction('coffee-type/services', 'service'),
                'coffee-type/types/CoffeeType.types.ts',
            ].sort()
        );
        assertImportsResolve('src/features', null);
    });

    it.each(['express', 'fastify', 'hono'])('node with %s', async (framework) => {
        writePackageJson({ [framework]: '1' });
        mkdir('src');
        await makeFeature('coffee-type', true);
        expect(listFiles('src/features')).toEqual(
            [
                'coffee-type/coffee-type.routes.ts',
                ...perAction('coffee-type/controllers', 'controller'),
                ...perAction('coffee-type/repositories', 'repository'),
                ...writeActions('coffee-type/schemas', 'schema'),
                ...perAction('coffee-type/services', 'service'),
                'coffee-type/types/CoffeeType.types.ts',
            ].sort()
        );
        assertImportsResolve('src/features', null);
    });

    it('node without a framework', async () => {
        writePackageJson({});
        await makeFeature('coffee-type', true);
        const files = listFiles('features');
        expect(files).not.toContain('coffee-type/coffee-type.routes.ts');
        expect(files).toContain('coffee-type/controllers/CreateCoffeeType.controller.ts');
        assertImportsResolve('features', null);
    });

    it('nest', async () => {
        writePackageJson({ '@nestjs/core': '1', 'nestjs-zod': '1' });
        await makeFeature('coffee-type', true);
        expect(listFiles('src')).toEqual(
            [
                'coffee-type/coffee-type.module.ts',
                ...perAction('coffee-type/controllers', 'controller'),
                ...writeActions('coffee-type/dto', 'dto'),
                ...perAction('coffee-type/repositories', 'repository'),
                ...writeActions('coffee-type/schemas', 'schema'),
                ...perAction('coffee-type/services', 'service'),
                'coffee-type/types/CoffeeType.types.ts',
            ].sort()
        );
        assertImportsResolve('src', null);
    });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/commands/__tests__/stacks.test.ts`
Expected: PASS, 9 tests. If an import check fails, the message names the file and the missing specifier; fix the template, not the test.

- [ ] **Step 3: Run all tests and commit**

Run: `npx vitest run`
Expected: PASS

```bash
git add src/commands/__tests__/stacks.test.ts
git commit -m "test: per-stack file trees and import resolution"
```

---

### Task 17: CLI wiring

**Files:**
- Modify: `src/index.ts` (full rewrite)

**Interfaces:**
- Consumes: every command; `parseSide` (Task 13); `parseComponentType` (Task 12); `hintRegisterInModule` (Task 11); `detectStack`, `describeStack` (Task 2); `STACK_NAMES` (Task 1); `ACTIONS` (Task 5).
- Produces: the `domain-driver` binary with a global `--stack`, a `Stack:` line before every command, `make:controller`, and `--side` on `make:service` and `make:repository`.

`index.ts` is excluded from unit coverage (it is process wiring) and verified by the smoke test below.

- [ ] **Step 1: Rewrite the entry point**

```ts
#!/usr/bin/env node
// src/index.ts
import { Command } from 'commander';
import { makeComponent, parseComponentType } from './commands/component';
import { makeContainer } from './commands/container';
import { makeController } from './commands/controller';
import { makeFeature } from './commands/feature';
import { hintRegisterInModule } from './commands/hints';
import { makeHook } from './commands/hook';
import { makeRepository } from './commands/repository';
import { makeSchema } from './commands/schema';
import { makeService } from './commands/service';
import { parseSide } from './commands/sides';
import { makeTypes } from './commands/types';
import { describeStack, detectStack } from './stack/detect';
import { STACK_NAMES } from './stack/types';
import { ACTIONS } from './templates/actions';

const program = new Command();

program
    .name('domain-driver')
    .description('CLI scaffolding tool for domain-driven feature folders in Next.js, React, Node, and NestJS projects')
    .version('0.2.0')
    .option('--stack <name>', `Override stack detection (${STACK_NAMES.join(', ')})`);

program.hook('preAction', () => {
    const { stack } = program.opts<{ stack?: string }>();
    console.log(describeStack(detectStack(stack)));
});

program
    .command('make:feature <name>')
    .description('Scaffold a feature folder for the detected stack')
    .option('-a, --all', 'Scaffold all files inside each folder')
    .action(async (name: string, options: { all?: boolean }) => {
        await makeFeature(name, options.all ?? false);
    });

program
    .command('make:component <feature> <name>')
    .description('Scaffold a component inside an existing feature')
    .argument('[type]', 'Component type: client or server', 'client')
    .action((feature: string, name: string, type: string) => {
        makeComponent(feature, name, parseComponentType(type));
    });

program
    .command('make:container <feature> <name>')
    .description('Scaffold a smart container component inside an existing feature')
    .action((feature: string, name: string) => {
        makeContainer(feature, name);
    });

program
    .command('make:hook <feature> <name>')
    .description('Scaffold a custom hook inside an existing feature')
    .action((feature: string, name: string) => {
        makeHook(feature, name);
    });

program
    .command('make:service <feature> <name>')
    .description('Scaffold single-responsibility service files inside an existing feature')
    .option('--side <side>', 'client, server, or both', 'both')
    .action((feature: string, name: string, options: { side: string }) => {
        makeService(feature, name, parseSide(options.side));
        hintRegisterInModule(feature, ACTIONS.map((action) => `${action}${name}Service`));
    });

program
    .command('make:repository <feature> <name>')
    .description('Scaffold single-responsibility repository files inside an existing feature')
    .option('--side <side>', 'client, server, or both', 'both')
    .action((feature: string, name: string, options: { side: string }) => {
        makeRepository(feature, name, parseSide(options.side));
        hintRegisterInModule(feature, ACTIONS.map((action) => `${action}${name}Repository`));
    });

program
    .command('make:controller <feature> <name>')
    .description('Scaffold single-responsibility controllers or route handlers inside an existing feature')
    .action((feature: string, name: string) => {
        makeController(feature, name);
        hintRegisterInModule(feature, ACTIONS.map((action) => `${action}${name}Controller`));
    });

program
    .command('make:schema <feature> <name>')
    .description('Scaffold Zod schemas (and Nest DTOs) for create and update operations')
    .action((feature: string, name: string) => {
        makeSchema(feature, name);
    });

program
    .command('make:types <feature> <name>')
    .description('Scaffold a types file inside an existing feature')
    .action((feature: string, name: string) => {
        makeTypes(feature, name);
    });

function fail(error: unknown): never {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ ${message}`);
    process.exit(1);
}

program.parseAsync().catch(fail);
```

- [ ] **Step 2: Build and run the smoke test**

```bash
npm run build
REPO="$(pwd)"
SMOKE="$(mktemp -d)"
cd "$SMOKE"
printf '{"name":"smoke","dependencies":{"express":"^5.0.0"}}' > package.json
node "$REPO/dist/index.js" make:feature cat -a
find . -type f -not -name package.json | sort
node "$REPO/dist/index.js" make:hook cat; echo "exit=$?"
node "$REPO/dist/index.js" --stack nest make:feature dog
node "$REPO/dist/index.js" --stack remix make:feature bird; echo "exit=$?"
node "$REPO/dist/index.js" --help
cd "$REPO"
```

Expected:
- First command prints `Stack: node (detected), http: express`, then ✅ lines for the feature, types, schemas, repositories (server), services (server), controllers, and routes.
- `find` lists `./features/cat/cat.routes.ts`, five controllers, five services, five repositories, two schemas, and one types file. No `src/` because the smoke project has none.
- `make:hook cat` prints `❌ make:hook is not available for the node stack. Available: make:service, make:repository, make:controller, make:schema, make:types.` and `exit=1`.
- The Nest override prints `Stack: nest (override)` and creates `src/dog/dog.module.ts`.
- The bad override prints `❌ Unknown stack "remix". Valid stacks: next-fullstack, next-frontend, react, node, nest.` and `exit=1`.
- `--help` lists `--stack <name>` and `make:controller`.

- [ ] **Step 3: Run all tests and commit**

Run: `npx vitest run && npm run build`
Expected: PASS

```bash
git add src/index.ts
git commit -m "feat: --stack override, stack line, make:controller, and --side in the CLI"
```

---

### Task 18: Remove the old utils, package metadata, coverage, README

**Files:**
- Delete: `src/utils.ts`
- Modify: `package.json`, `vitest.config.ts`, `README.md`

- [ ] **Step 1: Delete the old utils module and confirm nothing imports it**

```bash
git rm src/utils.ts
grep -rn "from '../utils'" src || echo "no old imports"
npm run build
```

Expected: `no old imports`, build succeeds.

- [ ] **Step 2: Update package.json**

Replace the file with:

```json
{
  "name": "domain-driver",
  "version": "0.2.0",
  "description": "CLI scaffolding tool for domain-driven feature folders in Next.js, React, Node, and NestJS projects",
  "main": "index.js",
  "bin": {
    "domain-driver": "./dist/index.js"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/IsaacHatilima/domain-driver"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  },
  "keywords": [
    "cli",
    "scaffolding",
    "domain-driven",
    "nextjs",
    "react",
    "nestjs",
    "node",
    "express",
    "fastify",
    "hono"
  ],
  "author": "Isaac Hatilima",
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^25.4.0",
    "@vitest/coverage-v8": "^4.1.2",
    "typescript": "^5.9.3",
    "vitest": "^4.1.2"
  },
  "dependencies": {
    "commander": "^14.0.3"
  }
}
```

Then install the new dev dependency:

```bash
npm install
```

- [ ] **Step 3: Add coverage thresholds to vitest**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/__tests__/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/**/__tests__/**', 'src/index.ts'],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80,
            },
        },
    },
});
```

- [ ] **Step 4: Run coverage**

Run: `npm run test:coverage`
Expected: PASS with every threshold met. If a threshold fails, the report names the file; add a test for the uncovered branch in that file's existing suite.

- [ ] **Step 5: Rewrite the README**

Replace `README.md` with:

````markdown
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
````

- [ ] **Step 6: Run everything and commit**

Run: `npm run build && npm test && npm run test:coverage`
Expected: PASS, thresholds met

```bash
git add package.json package-lock.json vitest.config.ts README.md
git add -A src
git commit -m "chore: release 0.2.0 metadata, coverage thresholds, and README for multi-stack support"
```

---

## Self-review notes

- Spec 3.1 to 3.6: Task 2. Spec 4.1 to 4.4: Tasks 3 and 15. Spec 5: Tasks 1 and 11. Spec 6.1 to 6.7: Tasks 4 to 10. Spec 7: Tasks 11 to 14 and 17. Spec 8: file structure table. Spec 9: error messages appear verbatim in Tasks 2, 3, 11, 12, 13, 14. Spec 10: every test bullet has a suite: detector (Task 2), alias and imports (Task 4), naming (Task 1), profiles (Task 3), per-stack integration (Task 16), command availability (Tasks 12 to 14), existing suites replaced (Tasks 11, 15).
- The spec's "frontend/client-service" and "backend/server-service" templates are implemented as one `src/templates/service.ts` with a `side` parameter, since the only difference is the repository layer imported. Everything else in spec section 8 maps one to one.
