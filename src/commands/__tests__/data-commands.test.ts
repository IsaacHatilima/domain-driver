import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeService } from '../service';
import { makeRepository } from '../repository';
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

describe('on next-frontend', () => {
    beforeEach(() => {
        writePackageJson({ next: '1' });
        mkdir('app/cat');
    });

    it('make:service refuses: the stack has no service layer', () => {
        expect(() => makeService('cat', 'Cat')).toThrow(
            `make:service is not available for the next-frontend stack.`
        );
        expect(projectFileExists('app/cat/services')).toBe(false);
        expect(projectFileExists('app/cat/server/services')).toBe(false);
    });

    it('make:repository refuses: the stack has no repository layer', () => {
        expect(() => makeRepository('cat', 'Cat')).toThrow(
            `make:repository is not available for the next-frontend stack.`
        );
        expect(projectFileExists('app/cat/repositories')).toBe(false);
        expect(projectFileExists('app/cat/server/repositories')).toBe(false);
    });
});

describe('on react', () => {
    beforeEach(() => {
        writePackageJson({ react: '1' });
        mkdir('src/features/cat');
    });

    it('make:service refuses: the stack has no service layer', () => {
        expect(() => makeService('cat', 'Cat')).toThrow(
            `make:service is not available for the react stack.`
        );
        expect(projectFileExists('src/features/cat/services')).toBe(false);
    });

    it('make:repository refuses: the stack has no repository layer', () => {
        expect(() => makeRepository('cat', 'Cat')).toThrow(
            `make:repository is not available for the react stack.`
        );
        expect(projectFileExists('src/features/cat/repositories')).toBe(false);
    });
});

describe('on next-fullstack', () => {
    beforeEach(() => {
        writePackageJson({ next: '1' });
        mkdir('app/api');
        mkdir('app/cat');
    });

    it('make:service writes the server side only', () => {
        makeService('cat', 'Cat');
        expect(listFiles('app/cat/server/services')).toEqual(ACTION_FILES('Cat', 'service'));
        expect(projectFileExists('app/cat/client')).toBe(false);
        expect(projectFileExists('app/cat/client/services')).toBe(false);
        expect(readProjectFile('app/cat/server/services/CreateCat.service.ts')).toContain(
            "from '../repositories/CreateCat.repository'"
        );
        expect(readProjectFile('app/cat/server/services/CreateCat.service.ts')).toContain(
            "from '../../types/Cat.types'"
        );
    });

    it('make:repository writes the server stub only', () => {
        makeRepository('cat', 'Cat');
        expect(listFiles('app/cat/server/repositories')).toEqual(ACTION_FILES('Cat', 'repository'));
        expect(projectFileExists('app/cat/client')).toBe(false);
        expect(projectFileExists('app/cat/client/repositories')).toBe(false);
        expect(readProjectFile('app/cat/server/repositories/ListCat.repository.ts')).toContain('is not implemented');
    });

    it('make:service skips existing files without throwing', () => {
        makeService('cat', 'Cat');
        vi.mocked(console.log).mockClear();
        expect(() => makeService('cat', 'Cat')).not.toThrow();
        expect(console.warn).toHaveBeenCalledWith('⚠️  Skipping "ListCat.service.ts" — already exists');
        const logged = vi.mocked(console.log).mock.calls.map(([message]) => String(message));
        expect(logged.some((line) => line.includes('✅'))).toBe(false);
    });

    it('make:repository does not print the created line again on a re-run', () => {
        makeRepository('cat', 'Cat');
        vi.mocked(console.log).mockClear();
        makeRepository('cat', 'Cat');
        expect(console.warn).toHaveBeenCalledWith('⚠️  Skipping "ListCat.repository.ts" — already exists');
        const logged = vi.mocked(console.log).mock.calls.map(([message]) => String(message));
        expect(logged.some((line) => line.includes('✅'))).toBe(false);
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

    it('writes no client folder alongside the server layers', () => {
        makeService('cat', 'Cat');
        makeRepository('cat', 'Cat');
        expect(projectFileExists('src/features/cat/client')).toBe(false);
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
