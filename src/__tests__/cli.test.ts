import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CliDeps, createProgram } from '../cli';
import { UpdateDeps } from '../commands/update';
import { FetchLike } from '../update/registry';
import { createTempProject, mkdir, projectFileExists, writePackageJson, TempProject } from './helpers/project';

const NOTICE = 'ℹ️  domain-driver 9.9.9 is available (you have 0.3.0). Run: domain-driver update';
const STACK_LINE = 'Stack: node (detected), http: express';

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

    it('init skips stack detection but still gets the notice', async () => {
        writePackageJson({ express: '1' });
        await run(cliDeps(), ['init']);
        expect(lines).toEqual([NOTICE]);
        expect(projectFileExists('AGENTS.md')).toBe(true);
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
            spawn: () => {
                throw new Error('--dry-run must not spawn');
            },
            execPath: '/usr/bin/node',
            log: (line) => updateLines.push(line),
            writeCache: false,
        };
        await run(cliDeps({ updateDeps: () => updateDeps }), ['update', '--dry-run']);
        expect(updateLines).toEqual([`Would run: npm install domain-driver@latest in ${root}`]);
        expect(lines).toEqual([]);
    });
});
