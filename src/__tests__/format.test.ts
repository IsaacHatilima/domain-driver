import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CliDeps, createProgram } from '../cli';
import { createTempProject, mkdir, readProjectFile, writePackageJson, TempProject } from './helpers/project';
import {
    installBrokenPrettier,
    installFakePrettier,
    STARTER_STYLE,
    writePrettierConfig,
    writePrettierIgnore,
} from './helpers/prettier';

const REPO = path.resolve(__dirname, '../..');
const HOOK = 'src/features/projects/hooks/ArchiveProject.hook.ts';
const ARCHIVE = ['make:action', 'projects/Project', 'archiveProject', '--on-record', '--method', 'post', '--returns', 'one'];

let project: TempProject;

function cliDeps(): CliDeps {
    return {
        env: { CI: '1' },
        isTTY: false,
        homedir: '/nope',
        now: Date.now,
        fetchImpl: async () => {
            throw new Error('no network in tests');
        },
        current: '0.11.0',
        updateDeps: () => {
            throw new Error('update is not wired in this test');
        },
        log: () => undefined,
    };
}

async function run(argv: readonly string[]): Promise<void> {
    await createProgram(cliDeps()).exitOverride().parseAsync(['node', 'domain-driver', ...argv]);
}

const warnings = (): string[] => vi.mocked(console.warn).mock.calls.map(([message]) => String(message));

/** The template's own style: single quotes and semicolons. */
function expectUnformatted(source: string): void {
    expect(source).toContain("import { useState, useCallback } from 'react';");
    expect(source).toContain("method: 'POST',");
}

function expectStarterStyle(source: string): void {
    expect(source).toContain('import { useState, useCallback } from "react"\n');
    expect(source).toContain('method: "POST",');
    expect(source).not.toMatch(/;$/m);
}

function reactProject(): void {
    writePackageJson({ react: '1' });
    mkdir('src/features/projects');
}

beforeEach(() => {
    project = createTempProject('format');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    project.cleanup();
    vi.restoreAllMocks();
});

describe('formatting with the project Prettier', () => {
    it('formats a written file with the project config', async () => {
        reactProject();
        installFakePrettier();
        writePrettierConfig(STARTER_STYLE);

        await run(ARCHIVE);

        expectStarterStyle(readProjectFile(HOOK));
        expect(warnings()).toEqual([]);
    });

    it('formats every file make:feature -a writes', async () => {
        writePackageJson({ react: '1' });
        mkdir('src/features');
        installFakePrettier();
        writePrettierConfig(STARTER_STYLE);

        await run(['make:feature', 'projects/Project', '-a']);

        for (const file of ['hooks/ListProject.hook.ts', 'schemas/Project.schema.ts', 'types/Project.types.ts']) {
            expect(readProjectFile(`src/features/projects/${file}`)).not.toMatch(/;$/m);
        }
    });

    it('leaves the output as generated when the project has no prettier', async () => {
        reactProject();
        writePrettierConfig(STARTER_STYLE);

        await run(ARCHIVE);

        expectUnformatted(readProjectFile(HOOK));
        expect(warnings()).toEqual([]);
    });

    it('leaves the output as generated when the project has prettier but no config', async () => {
        reactProject();
        installFakePrettier();

        await run(ARCHIVE);

        expectUnformatted(readProjectFile(HOOK));
        expect(warnings()).toEqual([]);
    });

    it('leaves a file .prettierignore lists unformatted', async () => {
        reactProject();
        installFakePrettier();
        writePrettierConfig(STARTER_STYLE);
        writePrettierIgnore(['src/features/projects/hooks/']);

        await run(ARCHIVE);

        expectUnformatted(readProjectFile(HOOK));
        expect(warnings()).toEqual([]);
    });

    it('keeps the file and warns once, naming it, when a plugin fails to load', async () => {
        reactProject();
        installFakePrettier();
        writePrettierConfig({ ...STARTER_STYLE, plugins: ['prettier-plugin-missing'] });

        await expect(run(ARCHIVE)).resolves.toBeUndefined();

        expectUnformatted(readProjectFile(HOOK));
        const shown = warnings();
        expect(shown).toHaveLength(1);
        expect(shown[0]).toContain(HOOK);
        expect(shown[0]).toContain("Cannot find module 'prettier-plugin-missing'");
        expect(shown[0]).not.toContain('\n');
    });

    it('keeps the files and warns when the installed prettier is not usable', async () => {
        reactProject();
        installBrokenPrettier();
        writePrettierConfig(STARTER_STYLE);

        await run(ARCHIVE);

        expectUnformatted(readProjectFile(HOOK));
        const shown = warnings();
        expect(shown).toHaveLength(1);
        expect(shown[0]).toContain(HOOK);
        expect(shown[0]).toContain('prettier');
    });

    it('skips formatting with --no-format', async () => {
        reactProject();
        installFakePrettier();
        writePrettierConfig(STARTER_STYLE);

        await run([...ARCHIVE, '--no-format']);

        expectUnformatted(readProjectFile(HOOK));
    });

    it('formats only files the command wrote, not files already there or skipped', async () => {
        reactProject();
        installFakePrettier();
        writePrettierConfig(STARTER_STYLE);
        const untouched = "export const kept = 'as written';\n";
        mkdir('src/features/projects/hooks');
        fs.writeFileSync(path.join(project.dir, 'src/features/projects/hooks/Other.hook.ts'), untouched);
        fs.writeFileSync(path.join(project.dir, HOOK), untouched);

        await run(ARCHIVE);

        expect(readProjectFile('src/features/projects/hooks/Other.hook.ts')).toBe(untouched);
        expect(readProjectFile(HOOK)).toBe(untouched);
    });

    it('offers --no-format on the commands that write files, and not on update', () => {
        const program = createProgram(cliDeps());
        const writers = program.commands.filter((command) => command.name().startsWith('make:'));
        expect(writers.length).toBeGreaterThan(0);
        for (const command of writers) {
            expect(command.options.map((option) => option.long), command.name()).toContain('--no-format');
        }
        const update = program.commands.find((command) => command.name() === 'update');
        expect(update?.options.map((option) => option.long)).not.toContain('--no-format');
    });
});

describe('formatting the Nest modules a command registers into', () => {
    const MODULE = (name: string): string =>
        `import { Module } from '@nestjs/common';\n\n@Module({\n  imports: [],\n})\nexport class ${name}Module {}\n`;

    beforeEach(() => {
        writePackageJson({ '@nestjs/core': '1', 'nestjs-zod': '1' }, {}, { domainDriver: { featureRoot: 'src/projects' } });
        mkdir('node_modules');
        fs.symlinkSync(path.join(REPO, 'node_modules', 'typescript'), path.join(project.dir, 'node_modules/typescript'), 'dir');
        mkdir('src/projects');
        fs.writeFileSync(path.join(project.dir, 'src/app.module.ts'), MODULE('App'));
        fs.writeFileSync(path.join(project.dir, 'src/projects/projects.module.ts'), MODULE('Projects'));
        installFakePrettier();
        writePrettierConfig({ semi: false });
    });

    it('formats the area and flow modules it edits, and leaves the root module it did not', async () => {
        await run(['make:feature', 'create-project']);
        await run(['make:action', 'create-project/Project', 'createProject', '--with-input', '--method', 'post', '--returns', 'one']);

        const area = readProjectFile('src/projects/projects.module.ts');
        expect(area).toContain("import { CreateProjectModule } from './create-project/create-project.module'\n");
        expect(area).not.toMatch(/;$/m);

        const flow = readProjectFile('src/projects/create-project/create-project.module.ts');
        expect(flow).toContain('CreateProjectController');
        expect(flow).not.toMatch(/;$/m);

        expect(readProjectFile('src/app.module.ts')).toBe(MODULE('App'));
    });
});
