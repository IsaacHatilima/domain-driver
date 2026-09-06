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
        vi.mocked(console.log).mockClear();
        expect(() => makeService('cat', 'Cat')).not.toThrow();
        expect(console.warn).toHaveBeenCalledWith('⚠️  Skipping "ListCat.service.ts" — already exists');
        const logged = vi.mocked(console.log).mock.calls.map(([message]) => String(message));
        expect(logged.some((line) => line.includes('✅'))).toBe(false);
    });

    it('make:repository writes fetch repositories', () => {
        makeRepository('cat', 'Cat');
        expect(listFiles('app/cat/repositories')).toEqual(ACTION_FILES('Cat', 'repository'));
        expect(readProjectFile('app/cat/repositories/CreateCat.repository.ts')).toContain("fetch('/api/cat'");
    });

    it('make:repository does not print the created line again on a re-run', () => {
        makeRepository('cat', 'Cat');
        vi.mocked(console.log).mockClear();
        makeRepository('cat', 'Cat');
        const logged = vi.mocked(console.log).mock.calls.map(([message]) => String(message));
        expect(logged.some((line) => line.includes('✅'))).toBe(false);
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
