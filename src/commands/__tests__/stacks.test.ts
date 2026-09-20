// src/commands/__tests__/stacks.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { makeAction } from '../action';
import { makeFeature } from '../feature';
import { AliasConfig } from '../../utils/alias';
import {
    createTempProject,
    writePackageJson,
    writeTsconfig,
    mkdir,
    listFiles,
    projectFileExists,
    readProjectFile,
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
                ...perAction('coffee-type/hooks', 'hook'),
                'coffee-type/page.tsx',
                ...writeActions('coffee-type/schemas', 'schema'),
                'coffee-type/types/CoffeeType.types.ts',
            ].sort()
        );
        // The service and the repository live behind an API this stack does not own,
        // so the stack has no such layer at all -- not even an empty folder for one.
        expect(projectFileExists('app/coffee-type/services')).toBe(false);
        expect(projectFileExists('app/coffee-type/repositories')).toBe(false);
        // The hook is what calls the API now, in place of the deleted client repository.
        const hook = readProjectFile('app/coffee-type/hooks/ListCoffeeType.hook.ts');
        expect(hook).toContain("const response = await fetch('/api/coffee-type');");
        expect(hook).toContain("if (!response.ok) throw new Error('Failed to fetch CoffeeType list');");
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
                'coffee-type/components/client/CoffeeType.tsx',
                'coffee-type/containers/CoffeeTypeContainer.tsx',
                ...perAction('coffee-type/hooks', 'hook'),
                'coffee-type/page.tsx',
                ...writeActions('coffee-type/schemas', 'schema'),
                ...perAction('coffee-type/server/repositories', 'repository'),
                ...perAction('coffee-type/server/services', 'service'),
                'coffee-type/types/CoffeeType.types.ts',
            ].sort()
        );
        // page -> hook -> API -> service -> repository. There is no client-side half.
        expect(projectFileExists('app/coffee-type/client')).toBe(false);
        const query = readProjectFile('app/coffee-type/hooks/ListCoffeeType.hook.ts');
        expect(query).toContain("const response = await fetch('/api/coffee-type');");
        // Deliberately absent: it makes Next's TS plugin reject the onSuccess callback (TS71007).
        expect(query).not.toContain("'use client'");
        const mutation = readProjectFile('app/coffee-type/hooks/CreateCoffeeType.hook.ts');
        expect(mutation).toContain("const response = await fetch('/api/coffee-type', {");
        expect(mutation).toContain("method: 'POST',");
        expect(mutation).toContain("headers: { 'Content-Type': 'application/json' },");
        expect(mutation).toContain('body: JSON.stringify(data),');
        expect(mutation).not.toContain("'use client'");
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
                ...perAction('coffee-type/hooks', 'hook'),
                ...writeActions('coffee-type/schemas', 'schema'),
                'coffee-type/types/CoffeeType.types.ts',
            ].sort()
        );
        // No server side in this stack, so no service and no repository layer at all.
        expect(projectFileExists('src/features/coffee-type/services')).toBe(false);
        expect(projectFileExists('src/features/coffee-type/repositories')).toBe(false);
        const hook = readProjectFile('src/features/coffee-type/hooks/ListCoffeeType.hook.ts');
        expect(hook).toContain("const response = await fetch('/api/coffee-type');");
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

    it('tanstack-start', async () => {
        writePackageJson({ '@tanstack/react-start': '1' });
        await makeFeature('coffee-type', true);
        expect(listFiles('src/routes')).toEqual(
            [
                'coffee-type/-components/CoffeeType.tsx',
                'coffee-type/-containers/CoffeeTypeContainer.tsx',
                'coffee-type/-hooks/coffee-type.keys.ts',
                ...perAction('coffee-type/-hooks', 'hook'),
                ...writeActions('coffee-type/-schemas', 'schema'),
                ...perAction('coffee-type/-server/functions', 'fn'),
                ...perAction('coffee-type/-server/repositories', 'repository'),
                ...perAction('coffee-type/-server/services', 'service'),
                'coffee-type/-types/CoffeeType.types.ts',
                'coffee-type/index.tsx',
            ].sort()
        );
        // The server function is the API boundary here, so there is no client half.
        expect(projectFileExists('src/routes/coffee-type/-client')).toBe(false);
        // The hook calls the generated server function directly, with no Service in between.
        const hook = readProjectFile('src/routes/coffee-type/-hooks/ListCoffeeType.hook.ts');
        expect(hook).toContain("import { listCoffeeType } from '../-server/functions/ListCoffeeType.fn';");
        expect(hook).toContain('queryFn: (): Promise<CoffeeType[]> => listCoffeeType(),');
        expect(hook).not.toContain('Service');
        assertImportsResolve('src/routes', null);
    });
});

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
        expect(files).toContain('coffee-type/hooks/FindActiveCoffeeTypes.hook.ts');
        expect(files).toContain('coffee-type/server/repositories/ArchiveCoffeeType.repository.ts');
        expect(files).toContain('coffee-type/server/services/ArchiveCoffeeType.service.ts');
        expect(files.some((file) => file.startsWith('coffee-type/client/'))).toBe(false);
        // The hook fetches the action's own route; the old client repository did this.
        expect(readProjectFile('app/coffee-type/hooks/FindActiveCoffeeTypes.hook.ts')).toContain(
            "const response = await fetch('/api/coffee-type/find-active-coffee-types');"
        );
        assertImportsResolve('app', null);
    });

    it('react', async () => {
        writePackageJson({ react: '1' });
        mkdir('src');
        await scaffold();
        const files = listFiles('src/features');
        expect(files).toContain('coffee-type/hooks/FindActiveCoffeeTypes.hook.ts');
        expect(files).toContain('coffee-type/hooks/ArchiveCoffeeType.hook.ts');
        expect(files).toContain('coffee-type/schemas/ArchiveCoffeeType.schema.ts');
        expect(files).not.toContain('coffee-type/schemas/FindActiveCoffeeTypes.schema.ts');
        expect(files.some((file) => file.includes('controllers/'))).toBe(false);
        // A plain React app has no server side: an action adds a hook, not a service pair.
        expect(files.some((file) => file.includes('services/'))).toBe(false);
        expect(files.some((file) => file.includes('repositories/'))).toBe(false);
        expect(readProjectFile('src/features/coffee-type/hooks/ArchiveCoffeeType.hook.ts')).toContain(
            "const response = await fetch('/api/coffee-type/archive-coffee-type', {"
        );
        assertImportsResolve('src/features', null);
    });

    it('tanstack-start', async () => {
        writePackageJson({ '@tanstack/react-start': '1' });
        await scaffold();
        const files = listFiles('src/routes');
        expect(files).toContain('coffee-type/-server/functions/FindActiveCoffeeTypes.fn.ts');
        expect(files).toContain('coffee-type/-server/functions/ArchiveCoffeeType.fn.ts');
        expect(files).toContain('coffee-type/-server/repositories/ArchiveCoffeeType.repository.ts');
        expect(files).toContain('coffee-type/-hooks/FindActiveCoffeeTypes.hook.ts');
        expect(files).toContain('coffee-type/-schemas/ArchiveCoffeeType.schema.ts');
        expect(files).not.toContain('coffee-type/-schemas/FindActiveCoffeeTypes.schema.ts');
        expect(files.some((file) => file.startsWith('coffee-type/-client/'))).toBe(false);
        // The hook calls the server function the action generated, in place of a client repository.
        expect(readProjectFile('src/routes/coffee-type/-hooks/ArchiveCoffeeType.hook.ts')).toContain(
            "import { archiveCoffeeType } from '../-server/functions/ArchiveCoffeeType.fn';"
        );
        assertImportsResolve('src/routes', null);
    });
});
