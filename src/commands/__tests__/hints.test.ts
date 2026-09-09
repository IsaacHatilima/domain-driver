import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { hintReactQuery, hintRegisterInModule } from '../hints';
import { getProfile } from '../../stack/registry';
import { createTempProject, writePackageJson, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

const logged = (): string[] => vi.mocked(console.log).mock.calls.map(([message]) => String(message));

beforeEach(() => {
    project = createTempProject('hints');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
    project.cleanup();
    vi.restoreAllMocks();
});

describe('hintRegisterInModule', () => {
    it('prints the class list with no note on a nest fixture', () => {
        writePackageJson({ '@nestjs/core': '1' });
        hintRegisterInModule('cat', ['ListCatController', 'ListCatService']);
        expect(logged()).toContain('ℹ️  Register ListCatController, ListCatService in cat.module.ts');
    });

    it('appends the note in parentheses on a nest fixture', () => {
        writePackageJson({ '@nestjs/core': '1' });
        hintRegisterInModule(
            'cat',
            ['ArchiveCatController', 'ArchiveCatService', 'ArchiveCatRepository'],
            'list ArchiveCatController before ShowCatController in controllers'
        );
        expect(logged()).toContain(
            'ℹ️  Register ArchiveCatController, ArchiveCatService, ArchiveCatRepository in cat.module.ts ' +
                '(list ArchiveCatController before ShowCatController in controllers)'
        );
    });

    it('stays silent on a non-nest fixture, with or without a note', () => {
        writePackageJson({ next: '1' });
        hintRegisterInModule('cat', ['ListCatController']);
        hintRegisterInModule('cat', ['ArchiveCatController'], 'list ArchiveCatController before ShowCatController in controllers');
        expect(logged()).toEqual([]);
    });
});

describe('hintReactQuery', () => {
    it('hints once on the tanstack-start profile', () => {
        const profile = getProfile('tanstack-start');
        hintReactQuery(profile);
        hintReactQuery(profile);
        expect(logged()).toContain('ℹ️  Hooks use TanStack Query. Install it: npm install @tanstack/react-query');
        expect(logged().filter((line) => line.includes('TanStack Query'))).toHaveLength(1);
        expect(logged()).toContain('   Then wrap your app in a QueryClientProvider.');
    });

    it('stays silent on a profile without query hooks', () => {
        hintReactQuery(getProfile('react'));
        expect(logged()).toEqual([]);
    });
});
