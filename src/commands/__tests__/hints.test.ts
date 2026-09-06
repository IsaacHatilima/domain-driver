import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { hintRegisterInModule } from '../hints';
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
