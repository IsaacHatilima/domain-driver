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
        expect(files).toContain('hooks/ListCoffeeType.hook.ts');
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

    it('uses the explicit entity name with -a', async () => {
        writePackageJson({ express: '1' });
        mkdir('src');
        await makeFeature('users', true, 'User');
        expect(projectFileExists('src/features/users/types/User.types.ts')).toBe(true);
        expect(projectFileExists('src/features/users/services/ListUser.service.ts')).toBe(true);
        expect(projectFileExists('src/features/users/types/Users.types.ts')).toBe(false);
    });
});
