import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CliDeps, createProgram } from '../cli';
import { UpdateDeps } from '../commands/update';
import { FetchLike } from '../update/registry';
import { createTempProject, mkdir, projectFileExists, writePackageJson, TempProject } from './helpers/project';

const NOTICE = 'ℹ️  domain-driver 9.9.9 is available (you have 0.3.0). Run: domain-driver update';
const STACK_LINE = 'Stack: node (detected), http: express, root: src/features';

let project: TempProject;
let cacheDir: string;
let lines: string[];

const registry: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({ latest: '9.9.9' }) });

function cliDeps(overrides: Partial<CliDeps> = {}): CliDeps {
    return {
        env: { DOMAIN_DRIVER_CACHE_DIR: cacheDir },
        isTTY: true,
        homedir: '/nope',
        now: Date.now,
        fetchImpl: registry,
        current: '0.3.0',
        updateDeps: () => {
            throw new Error('update is not wired in this test');
        },
        log: (line) => lines.push(line),
        ...overrides,
    };
}

/** A subcommand's full help, including text added after the options. */
function fullHelp(name: string): string {
    const command = createProgram(cliDeps()).commands.find((candidate) => candidate.name() === name);
    if (command === undefined) throw new Error(`no ${name} command`);
    let out = '';
    command.configureOutput({ writeOut: (text) => (out += text) });
    command.outputHelp();
    return out;
}

async function run(deps: CliDeps, argv: readonly string[]): Promise<void> {
    const program = createProgram(deps).exitOverride();
    await program.parseAsync(['node', 'domain-driver', ...argv]);
}

beforeEach(() => {
    project = createTempProject('cli');
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-cli-cache-'));
    lines = [];
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
    project.cleanup();
    fs.rmSync(cacheDir, { recursive: true, force: true });
    vi.restoreAllMocks();
});

describe('createProgram', () => {
    it('prints the stack first, scaffolds, and prints the notice last', async () => {
        writePackageJson({ express: '1' });
        mkdir('src/features/cat');
        await run(cliDeps(), ['make:types', 'cat/Cat']);
        expect(lines[0]).toBe(STACK_LINE);
        expect(lines[lines.length - 1]).toBe(NOTICE);
        expect(projectFileExists('src/features/cat/types/Cat.types.ts')).toBe(true);
    });

    it('skips the notice when stdout is not a terminal', async () => {
        writePackageJson({ express: '1' });
        mkdir('src/features/cat');
        await run(cliDeps({ isTTY: false }), ['make:types', 'cat/Cat']);
        expect(lines).toEqual([STACK_LINE]);
        expect(projectFileExists('src/features/cat/types/Cat.types.ts')).toBe(true);
    });

    it('skips the notice in CI', async () => {
        writePackageJson({ express: '1' });
        mkdir('src/features/cat');
        await run(cliDeps({ env: { DOMAIN_DRIVER_CACHE_DIR: cacheDir, CI: '1' } }), ['make:types', 'cat/Cat']);
        expect(lines).toEqual([STACK_LINE]);
    });

    it('make:action passes --method and --on-record through', async () => {
        writePackageJson({ react: '1' });
        mkdir('src/features/projects');
        await run(cliDeps({ isTTY: false }), [
            'make:action',
            'projects/Project',
            'archiveProject',
            '--on-record',
            '--method',
            'patch',
            '--returns',
            'one',
        ]);
        const hook = fs.readFileSync(path.join(project.dir, 'src/features/projects/hooks/ArchiveProject.hook.ts'), 'utf-8');
        expect(hook).toContain('const archiveProject = useCallback(async (id: string) => {');
        expect(hook).toContain("method: 'PATCH',");
    });

    it('make:action takes --with-input on a get and reads the input from the query string', async () => {
        writePackageJson({ react: '1' });
        mkdir('src/features/projects');
        await run(cliDeps({ isTTY: false }), [
            'make:action',
            'projects/Project',
            'listProject',
            '--with-input',
            '--method',
            'get',
            '--returns',
            'list',
        ]);
        const hook = fs.readFileSync(path.join(project.dir, 'src/features/projects/hooks/ListProject.hook.ts'), 'utf-8');
        expect(hook).toContain('export function useListProject(query: ListProject) {');
        expect(hook).toContain('new URLSearchParams()');
    });

    it('make:action help says a get takes its input from the query string', () => {
        const help = fullHelp('make:action').replace(/\s+/g, ' ');
        expect(help).toContain('the query string with --method get');
        expect(help).not.toContain('A GET cannot');
    });

    it('make:action rejects an unknown --method', async () => {
        writePackageJson({ react: '1' });
        mkdir('src/features/projects');
        await expect(
            run(cliDeps({ isTTY: false }), ['make:action', 'projects/Project', 'archiveProject', '--method', 'fetch'])
        ).rejects.toThrow('Invalid --method "fetch". Use get, post, put, patch, or delete.');
        expect(projectFileExists('src/features/projects/hooks')).toBe(false);
    });

    it('make:action help says which files each stack gets, not a service pair everywhere', () => {
        const help = fullHelp('make:action');
        expect(help).not.toContain('as its own service, repository, and controller');
        expect(help).toContain('--method <method>');
        expect(help).toContain('--on-record');
        expect(help).toMatch(/react, next-frontend +hook only/);
        expect(help).toMatch(/nest +service, repository, controller/);
        expect(help).toMatch(/tanstack-start +hook, service, repository, server function/);
        expect(help).toMatch(/next-fullstack +service, repository; a write also gets server\/actions\/<Name>\.action\.ts/);
        expect(help).toContain('--route');
        expect(help).not.toContain('next-fullstack         hook, service, repository, route handler');
    });

    it('make:feature and make:controller take --route', () => {
        expect(fullHelp('make:feature')).toContain('--route');
        expect(fullHelp('make:controller')).toContain('--route');
        expect(fullHelp('make:controller').replace(/\s+/g, ' ')).toContain('Server Actions');
    });

    it('make:action passes --route through on next-fullstack', async () => {
        writePackageJson({ next: '1', 'drizzle-orm': '1' });
        mkdir('app/projects');
        await run(cliDeps({ isTTY: false }), ['make:action', 'projects/Project', 'archiveProject', '--on-record', '--method', 'post']);
        expect(projectFileExists('app/projects/server/actions/ArchiveProject.action.ts')).toBe(true);
        await run(cliDeps({ isTTY: false }), ['make:action', 'projects/Project', 'restoreProject', '--on-record', '--method', 'post', '--route']);
        expect(projectFileExists('app/api/projects/[id]/restore-project/route.ts')).toBe(true);
        expect(projectFileExists('app/projects/server/actions/RestoreProject.action.ts')).toBe(false);
    });

    it('make:feature passes --route through on next-fullstack', async () => {
        writePackageJson({ next: '1', 'drizzle-orm': '1' });
        mkdir('app');
        await run(cliDeps({ isTTY: false }), ['make:feature', 'projects/Project', '-a', '--route']);
        expect(projectFileExists('app/api/projects/route.ts')).toBe(true);
        expect(projectFileExists('app/projects/server/actions')).toBe(false);
    });

    it('layer help names the stacks a layer exists on', () => {
        // Commander wraps descriptions at the terminal width, so compare the words, not the lines.
        const helpFor = (name: string): string => fullHelp(name).replace(/\s+/g, ' ');
        expect(helpFor('make:service')).toContain('node, nest, next-fullstack, tanstack-start');
        expect(helpFor('make:repository')).toContain('node, nest, next-fullstack, tanstack-start');
        expect(helpFor('make:controller')).toContain('not on react or next-frontend');
        expect(helpFor('make:hook')).toContain('react, next-frontend, next-fullstack, tanstack-start');
        expect(helpFor('make:schema')).toContain('entity schema');
        expect(helpFor('make:types')).toContain('z.infer');
    });

    it('has no init command and writes no agent files', async () => {
        writePackageJson({ express: '1' });
        const program = createProgram(cliDeps()).exitOverride().configureOutput({ writeErr: () => undefined });
        await expect(program.parseAsync(['node', 'domain-driver', 'init'])).rejects.toMatchObject({
            code: 'commander.unknownCommand',
        });
        expect(lines).toEqual([]);
        for (const file of ['AGENTS.md', 'CLAUDE.md', '.agents', '.claude', '.codex']) {
            expect(projectFileExists(file)).toBe(false);
        }
    });

    it('update --dry-run prints the command with no stack line and no notice', async () => {
        writePackageJson({ express: '1' });
        const updateLines: string[] = [];
        const root = project.dir;
        const files: Record<string, string> = {
            [path.join(root, 'package.json')]: JSON.stringify({ devDependencies: { 'domain-driver': '^0.3.0' } }),
        };
        const updateDeps: UpdateDeps = {
            env: { DOMAIN_DRIVER_CACHE_DIR: cacheDir },
            homedir: '/nope',
            now: Date.now,
            fetchImpl: registry,
            current: '0.3.0',
            binPath: path.join(root, 'node_modules', 'domain-driver', 'dist', 'index.js'),
            cwd: root,
            readFile: (filePath) => {
                const key = Object.keys(files).find((candidate) => path.resolve(candidate) === path.resolve(filePath));
                if (key === undefined) throw new Error(`ENOENT ${filePath}`);
                return files[key];
            },
            exists: (filePath) => Object.keys(files).some((candidate) => path.resolve(candidate) === path.resolve(filePath)),
            realpath: file => path.resolve(file),
            spawn: () => {
                throw new Error('--dry-run must not spawn');
            },
            log: (line) => updateLines.push(line),
        };
        await run(cliDeps({ updateDeps: () => updateDeps }), ['update', '--dry-run']);
        expect(updateLines).toEqual([`Would run: npm install domain-driver@latest in ${root}`]);
        expect(lines).toEqual([]);
    });
});
