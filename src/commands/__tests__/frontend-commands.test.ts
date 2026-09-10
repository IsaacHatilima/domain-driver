import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeComponent, parseComponentType } from '../component';
import { makeContainer } from '../container';
import { makeHook } from '../hook';
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
    project = createTempProject('frontend-commands');
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
        expect(content).toContain("from '../hooks/ListCat.hook'");
        expect(content).toContain("from '../components/client/Cat'");
    });

    it('make:hook writes five hooks with the directive', () => {
        makeHook('cat', 'Cat');
        for (const action of ['List', 'Show', 'Create', 'Update', 'Delete']) {
            expect(projectFileExists(`app/cat/hooks/${action}Cat.hook.ts`)).toBe(true);
        }
        expect(projectFileExists('app/cat/hooks/useCat.ts')).toBe(false);

        const content = readProjectFile('app/cat/hooks/ListCat.hook.ts');
        expect(content).toContain("'use client'");
        expect(content).toContain('export function useListCat()');
        expect(content).toContain("from '../services/ListCat.service'");
    });

    it('make:hook skips existing files without throwing', () => {
        makeHook('cat', 'Cat');
        vi.mocked(console.log).mockClear();
        expect(() => makeHook('cat', 'Cat')).not.toThrow();
        expect(console.warn).toHaveBeenCalledWith('⚠️  Skipping "ListCat.hook.ts" — already exists');
        const logged = vi.mocked(console.log).mock.calls.map(([message]) => String(message));
        expect(logged.some((line) => line.includes('✅'))).toBe(false);
    });

    it('make:hook rejects an old-style hook name instead of generating garbage', () => {
        expect(() => makeHook('cat', 'useCat')).toThrow(
            'make:hook now takes the entity, not the hook name — try make:hook cat/Cat.'
        );
        expect(projectFileExists('app/cat/hooks')).toBe(false);
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
        expect(() => makeHook('cat', 'Cat')).toThrow(
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
