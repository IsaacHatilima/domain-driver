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

describe('make:feature with a relocated feature root', () => {
    beforeEach(() => {
        // next-fullstack: an app/api directory is what selects that profile.
        writePackageJson({ next: '1' }, {}, { domainDriver: { featureRoot: 'app/auth' } });
        mkdir('app/api');
    });

    it('moves the feature but leaves its route handlers under app/api', async () => {
        await makeFeature('billing', true);

        // The feature follows the configured root.
        expect(projectFileExists('app/auth/billing/page.tsx')).toBe(true);
        expect(projectFileExists('app/auth/billing/server/services/ListBilling.service.ts')).toBe(true);

        // Regression guard: the handlers used to follow it too, landing at
        // app/auth/api/billing. Next serves anything under app/ by its path, so those
        // answered /auth/api/billing while the generated hook fetched /api/billing.
        expect(projectFileExists('app/api/billing/route.ts')).toBe(true);
        expect(projectFileExists('app/api/billing/[id]/route.ts')).toBe(true);
        expect(projectFileExists('app/auth/api')).toBe(false);
        expect(projectFileExists('app/auth/billing/api')).toBe(false);
    });

    it('generates a hook whose url matches where the handler was written', async () => {
        await makeFeature('billing', true);

        expect(readProjectFile('app/auth/billing/hooks/ListBilling.hook.ts')).toContain(
            "fetch('/api/billing')"
        );
        expect(projectFileExists('app/api/billing/route.ts')).toBe(true);
    });
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
            'schemas/.gitkeep',
            'types/.gitkeep',
        ]);
        const page = readProjectFile('app/test-feature/page.tsx');
        expect(page).toContain('export default function TestFeaturePage()');
        expect(page).not.toContain('import');
    });

    it('creates no service or repository folder: they live behind the API', async () => {
        await makeFeature('test-feature');
        expect(projectFileExists('app/test-feature/services')).toBe(false);
        expect(projectFileExists('app/test-feature/repositories')).toBe(false);
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
        expect(files).toContain('hooks/ListCoffeeType.hook.ts');
        expect(files).toContain('hooks/DeleteCoffeeType.hook.ts');
        expect(files).toContain('schemas/UpdateCoffeeType.schema.ts');
        expect(files).toContain('types/CoffeeType.types.ts');
        expect(readProjectFile('app/coffee-type/page.tsx')).toContain(
            "import CoffeeTypeContainer from './containers/CoffeeTypeContainer';"
        );
    });

    it('scaffolds no service or repository file with -a', async () => {
        await makeFeature('coffee-type', true);
        const files = listFiles('app/coffee-type');
        expect(files.some((file) => file.includes('.service.') || file.includes('.repository.'))).toBe(
            false
        );
        expect(
            files.some((file) => file.startsWith('services/') || file.startsWith('repositories/'))
        ).toBe(false);
    });

    it('gives the hook the fetch that the client service used to make', async () => {
        await makeFeature('coffee-type', true);
        const hook = readProjectFile('app/coffee-type/hooks/ListCoffeeType.hook.ts');
        expect(hook).toContain("const response = await fetch('/api/coffee-type');");
        expect(hook).toContain("if (!response.ok) throw new Error('Failed to fetch CoffeeType list');");
        expect(hook).toContain('setData((await response.json()) as CoffeeType[]);');
        expect(hook).not.toContain('Service');
        expect(hook).not.toContain("'use client'");
    });

    it('gives the mutation hook the POST that the client repository used to make', async () => {
        await makeFeature('coffee-type', true);
        const hook = readProjectFile('app/coffee-type/hooks/CreateCoffeeType.hook.ts');
        expect(hook).toContain("const response = await fetch('/api/coffee-type', {");
        expect(hook).toContain("method: 'POST',");
        expect(hook).toContain("headers: { 'Content-Type': 'application/json' },");
        expect(hook).toContain('body: JSON.stringify(data),');
        expect(hook).toContain('const result = (await response.json()) as CoffeeType;');
        expect(hook).toContain('onSuccess?.(result);');
        expect(hook).not.toContain('Service');
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
            'schemas/.gitkeep',
            'types/.gitkeep',
        ]);
        expect(projectFileExists('src/features/cat/services')).toBe(false);
        expect(projectFileExists('src/features/cat/repositories')).toBe(false);
    });

    it('scaffolds hooks that fetch the API and no service or repository with -a', async () => {
        writePackageJson({ react: '1' });
        mkdir('src');
        await makeFeature('cat', true, 'Cat');
        const files = listFiles('src/features/cat');
        expect(files).toContain('hooks/ListCat.hook.ts');
        expect(files.some((file) => file.includes('.service.') || file.includes('.repository.'))).toBe(
            false
        );
        expect(readProjectFile('src/features/cat/hooks/ListCat.hook.ts')).toContain(
            "const response = await fetch('/api/cat');"
        );
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

    it('uses the explicit entity name with -a', async () => {
        writePackageJson({ express: '1' });
        mkdir('src');
        await makeFeature('users', true, 'User');
        expect(projectFileExists('src/features/users/types/User.types.ts')).toBe(true);
        expect(projectFileExists('src/features/users/services/ListUser.service.ts')).toBe(true);
        expect(projectFileExists('src/features/users/types/Users.types.ts')).toBe(false);
    });
});

describe('make:feature on tanstack-start', () => {
    beforeEach(() => writePackageJson({ '@tanstack/react-start': '1', react: '1' }));

    it('writes a route file with -a and no page.tsx', async () => {
        await makeFeature('cat', true, 'Cat');
        expect(projectFileExists('src/routes/cat/index.tsx')).toBe(true);
        expect(projectFileExists('src/routes/cat/page.tsx')).toBe(false);
        expect(readProjectFile('src/routes/cat/index.tsx')).toContain(
            "import CatContainer from './-containers/CatContainer';"
        );
    });

    it('keeps the server layers and creates no client ones with -a', async () => {
        await makeFeature('cat', true, 'Cat');
        const files = listFiles('src/routes/cat');
        expect(files).toContain('-server/services/ListCat.service.ts');
        expect(files).toContain('-server/repositories/ListCat.repository.ts');
        expect(files).toContain('-server/functions/ListCat.fn.ts');
        expect(files.some((file) => file.startsWith('-client/'))).toBe(false);
        expect(projectFileExists('src/routes/cat/-client')).toBe(false);
    });

    it('gives the query hook the server function the client service used to wrap', async () => {
        await makeFeature('cat', true, 'Cat');
        const hook = readProjectFile('src/routes/cat/-hooks/ListCat.hook.ts');
        expect(hook).toContain("import { listCat } from '../-server/functions/ListCat.fn';");
        expect(hook).toContain('queryFn: (): Promise<Cat[]> => listCat(),');
        expect(hook).not.toContain('Service');
    });
});
