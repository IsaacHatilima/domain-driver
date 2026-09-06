import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runUpdate, UpdateDeps, SpawnResult } from '../update';
import { FetchLike } from '../../update/registry';

const ROOT = path.resolve(path.sep, 'work', 'app');
const LOCAL_BIN = path.join(ROOT, 'node_modules', 'domain-driver', 'dist', 'index.js');
const GLOBAL_BIN = path.resolve(path.sep, 'usr', 'local', 'lib', 'node_modules', 'domain-driver', 'dist', 'index.js');
const NPX_BIN = path.resolve(path.sep, 'home', 'u', '.npm', '_npx', 'x', 'node_modules', 'domain-driver', 'dist', 'index.js');
const NODE = path.resolve(path.sep, 'usr', 'bin', 'node');

const registry = (latest: string | null): FetchLike => async () =>
    latest === null
        ? { ok: false, status: 500, json: async () => null }
        : { ok: true, status: 200, json: async () => ({ latest }) };

interface Harness {
    readonly deps: UpdateDeps;
    readonly lines: string[];
    readonly spawned: { command: string; args: readonly string[]; cwd: string }[];
}

function harness(overrides: Partial<UpdateDeps> = {}, spawnResults: readonly SpawnResult[] = [{ status: 0 }]): Harness {
    const lines: string[] = [];
    const spawned: Harness['spawned'] = [];
    const queue = [...spawnResults];
    const files: Record<string, string> = {
        [path.join(ROOT, 'package.json')]: JSON.stringify({ devDependencies: { 'domain-driver': '^0.2.0' } }),
        [path.join(ROOT, 'pnpm-lock.yaml')]: '',
        [LOCAL_BIN]: '',
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
            return queue.shift() ?? { status: 0 };
        },
        execPath: NODE,
        log: (line) => lines.push(line),
        writeCache: false,
        ...overrides,
    };
    return { deps, lines, spawned };
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

    it('refuses to guess in a hoisted workspace and exits non-zero', async () => {
        const workspaceRoot = path.resolve(path.sep, 'work', 'monorepo');
        const bin = path.join(workspaceRoot, 'node_modules', 'domain-driver', 'dist', 'index.js');
        const message =
            `Could not tell how domain-driver was installed: ${path.join(workspaceRoot, 'package.json')} exists but does not depend on domain-driver ` +
            '(this happens in hoisted workspaces). Run the update yourself in the package that depends on it, ' +
            'for example: npm install domain-driver@latest -w <workspace>';
        const readWorkspace = (filePath: string): string => {
            if (path.resolve(filePath) === path.resolve(path.join(workspaceRoot, 'package.json'))) {
                return JSON.stringify({ workspaces: ['packages/*'] });
            }
            throw new Error(`ENOENT ${filePath}`);
        };
        for (const options of [{ dryRun: false, check: false }, { dryRun: true, check: false }, { dryRun: false, check: true }]) {
            const h = harness({ binPath: bin, readFile: readWorkspace });
            await expect(runUpdate(options, h.deps)).rejects.toThrow(message);
            expect(h.lines).toEqual([message]);
            expect(h.spawned).toEqual([]);
        }
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

    it('runs the package manager in the project root and refreshes guidance from the new install', async () => {
        const h = harness();
        await runUpdate({ dryRun: false, check: false }, h.deps);
        expect(h.spawned).toEqual([
            { command: 'pnpm', args: ['update', 'domain-driver@latest'], cwd: ROOT },
            { command: NODE, args: [LOCAL_BIN, 'init'], cwd: ROOT },
        ]);
        expect(h.lines).toEqual(['✅ domain-driver updated to 0.3.0']);
    });

    it('reports a failed guidance refresh without failing the update', async () => {
        const h = harness({}, [{ status: 0 }, { status: 1 }]);
        await runUpdate({ dryRun: false, check: false }, h.deps);
        expect(h.spawned).toHaveLength(2);
        expect(h.lines).toEqual(['✅ domain-driver updated to 0.3.0', 'ℹ️  Guidance refresh failed; run: domain-driver init']);
    });

    it('continues to @latest when the registry is unreachable', async () => {
        const h = harness({ fetchImpl: registry(null) });
        await runUpdate({ dryRun: false, check: false }, h.deps);
        expect(h.lines[0]).toBe('Could not reach the registry; updating to @latest anyway.');
        expect(h.lines).toContain('✅ domain-driver updated to @latest');
        expect(h.spawned).toHaveLength(2);
    });

    it('global uses npm -g, hints sudo on failure, and inits only when cwd has a package.json', async () => {
        const failing = harness({ binPath: GLOBAL_BIN, cwd: path.resolve(path.sep, 'elsewhere') }, [{ status: 243 }]);
        await expect(runUpdate({ dryRun: false, check: false }, failing.deps)).rejects.toThrow(
            'Update failed (exit 243). Run it yourself: npm install -g domain-driver@latest (you may need sudo)'
        );
        const ok = harness({ binPath: GLOBAL_BIN, cwd: ROOT });
        await runUpdate({ dryRun: false, check: false }, ok.deps);
        expect(ok.spawned[0]).toEqual({ command: 'npm', args: ['install', '-g', 'domain-driver@latest'], cwd: ROOT });
        expect(ok.spawned[1]).toEqual({ command: NODE, args: [GLOBAL_BIN, 'init'], cwd: ROOT });
        const noProject = harness({ binPath: GLOBAL_BIN, cwd: path.resolve(path.sep, 'elsewhere') });
        await runUpdate({ dryRun: false, check: false }, noProject.deps);
        expect(noProject.spawned).toHaveLength(1);
    });

    it('local failure has no sudo hint and reports a spawn error', async () => {
        const h = harness({}, [{ status: null, error: new Error('spawn pnpm ENOENT') }]);
        await expect(runUpdate({ dryRun: false, check: false }, h.deps)).rejects.toThrow(
            'Update failed (exit error). Run it yourself: pnpm update domain-driver@latest'
        );
    });
});
