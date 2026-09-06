import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runUpdate, UpdateDeps, SpawnResult } from '../update';
import { FetchLike } from '../../update/registry';

const ROOT = path.resolve(path.sep, 'work', 'app');
const LOCAL_BIN = path.join(ROOT, 'node_modules', 'domain-driver', 'dist', 'index.js');
const GLOBAL_BIN = path.resolve(path.sep, 'usr', 'local', 'lib', 'node_modules', 'domain-driver', 'dist', 'index.js');
const NPX_BIN = path.resolve(path.sep, 'home', 'u', '.npm', '_npx', 'x', 'node_modules', 'domain-driver', 'dist', 'index.js');

const registry = (latest: string | null): FetchLike => async () =>
    latest === null
        ? { ok: false, status: 500, json: async () => null }
        : { ok: true, status: 200, json: async () => ({ latest }) };

interface Harness {
    readonly deps: UpdateDeps;
    readonly lines: string[];
    readonly spawned: { command: string; args: readonly string[]; cwd: string }[];
    readonly inits: string[];
}

function harness(overrides: Partial<UpdateDeps> = {}, spawnResult: SpawnResult = { status: 0 }): Harness {
    const lines: string[] = [];
    const spawned: Harness['spawned'] = [];
    const inits: string[] = [];
    const files: Record<string, string> = {
        [path.join(ROOT, 'package.json')]: JSON.stringify({ devDependencies: { 'domain-driver': '^0.2.0' } }),
        [path.join(ROOT, 'pnpm-lock.yaml')]: '',
    };
    const deps: UpdateDeps = {
        env: { DOMAIN_DRIVER_CACHE_DIR: path.join(ROOT, '.cache') },
        homedir: '/nope',
        now: () => Date.parse('2026-09-06T12:00:00.000Z'),
        fetchImpl: registry('0.3.0'),
        current: '0.2.0',
        binPath: LOCAL_BIN,
        cwd: ROOT,
        readFile: (filePath) => {
            const key = Object.keys(files).find((candidate) => path.resolve(candidate) === path.resolve(filePath));
            if (key === undefined) throw new Error(`ENOENT ${filePath}`);
            return files[key];
        },
        exists: (filePath) => Object.keys(files).some((candidate) => path.resolve(candidate) === path.resolve(filePath)),
        spawn: (command, args, cwd) => {
            spawned.push({ command, args, cwd });
            return spawnResult;
        },
        init: (root) => {
            inits.push(root);
            return [{ file: 'AGENTS.md', status: 'updated' }];
        },
        log: (line) => lines.push(line),
        writeCache: false,
        ...overrides,
    };
    return { deps, lines, spawned, inits };
}

describe('runUpdate', () => {
    it('explains npx and does nothing else', async () => {
        const h = harness({ binPath: NPX_BIN });
        await runUpdate({ dryRun: false, check: false }, h.deps);
        expect(h.lines).toEqual([
            'Nothing to update: you are running domain-driver through npx, which fetches the requested version each time. Use: npx domain-driver@latest <command>',
        ]);
        expect(h.spawned).toEqual([]);
    });

    it('stops when already on the latest version', async () => {
        const h = harness({ fetchImpl: registry('0.2.0') });
        await runUpdate({ dryRun: false, check: false }, h.deps);
        expect(h.lines).toEqual(['domain-driver 0.2.0 is already the latest version.']);
        expect(h.spawned).toEqual([]);
    });

    it('--check prints the notice without installing', async () => {
        const h = harness();
        await runUpdate({ dryRun: false, check: true }, h.deps);
        expect(h.lines).toEqual(['ℹ️  domain-driver 0.3.0 is available (you have 0.2.0). Run: domain-driver update']);
        expect(h.spawned).toEqual([]);
    });

    it('--check reports an unreachable registry', async () => {
        const h = harness({ fetchImpl: registry(null) });
        await runUpdate({ dryRun: false, check: true }, h.deps);
        expect(h.lines).toEqual(['Could not reach the registry to check for updates.']);
    });

    it('--dry-run prints the command and skips the registry', async () => {
        let fetched = 0;
        const counting: FetchLike = async () => { fetched += 1; return { ok: true, status: 200, json: async () => ({ latest: '0.3.0' }) }; };
        const h = harness({ fetchImpl: counting });
        await runUpdate({ dryRun: true, check: false }, h.deps);
        expect(h.lines).toEqual([`Would run: pnpm update domain-driver@latest in ${ROOT}`]);
        expect(fetched).toBe(0);
        expect(h.spawned).toEqual([]);
    });

    it('runs the package manager in the project root and refreshes guidance', async () => {
        const h = harness();
        await runUpdate({ dryRun: false, check: false }, h.deps);
        expect(h.spawned).toEqual([{ command: 'pnpm', args: ['update', 'domain-driver@latest'], cwd: ROOT }]);
        expect(h.inits).toEqual([ROOT]);
        expect(h.lines).toEqual(['✅ domain-driver updated to 0.3.0', '✅ AGENTS.md updated']);
    });

    it('continues to @latest when the registry is unreachable', async () => {
        const h = harness({ fetchImpl: registry(null) });
        await runUpdate({ dryRun: false, check: false }, h.deps);
        expect(h.lines[0]).toBe('Could not reach the registry; updating to @latest anyway.');
        expect(h.lines).toContain('✅ domain-driver updated to @latest');
        expect(h.spawned).toHaveLength(1);
    });

    it('global uses npm -g, hints sudo on failure, and inits only when cwd has a package.json', async () => {
        const failing = harness({ binPath: GLOBAL_BIN, cwd: path.resolve(path.sep, 'elsewhere') }, { status: 243 });
        await expect(runUpdate({ dryRun: false, check: false }, failing.deps)).rejects.toThrow(
            'Update failed (exit 243). Run it yourself: npm install -g domain-driver@latest (you may need sudo)'
        );
        const ok = harness({ binPath: GLOBAL_BIN, cwd: ROOT });
        await runUpdate({ dryRun: false, check: false }, ok.deps);
        expect(ok.spawned[0]).toEqual({ command: 'npm', args: ['install', '-g', 'domain-driver@latest'], cwd: ROOT });
        expect(ok.inits).toEqual([ROOT]);
        const noProject = harness({ binPath: GLOBAL_BIN, cwd: path.resolve(path.sep, 'elsewhere') });
        await runUpdate({ dryRun: false, check: false }, noProject.deps);
        expect(noProject.inits).toEqual([]);
    });

    it('local failure has no sudo hint and reports a spawn error', async () => {
        const h = harness({}, { status: null, error: new Error('spawn pnpm ENOENT') });
        await expect(runUpdate({ dryRun: false, check: false }, h.deps)).rejects.toThrow(
            'Update failed (exit error). Run it yourself: pnpm update domain-driver@latest'
        );
    });
});
