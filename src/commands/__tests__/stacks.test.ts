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
