import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { formatNotice } from '../update/check';
import { detectInstallMode, InstallInfo } from '../update/install-mode';
import { detectPackageManager, updateCommand, UpdateCommand } from '../update/package-manager';
import { FetchLike, fetchLatestVersion, nodeFetch } from '../update/registry';
import { currentVersion, isNewer } from '../update/version';
import { cacheDir, writeCache as persistCache } from '../update/cache';

export interface UpdateOptions {
    readonly dryRun: boolean;
    readonly check: boolean;
}

export interface SpawnResult {
    readonly status: number | null;
    readonly error?: Error;
}

export interface UpdateDeps {
    readonly env: NodeJS.ProcessEnv;
    readonly homedir: string;
    readonly now: () => number;
    readonly fetchImpl: FetchLike;
    readonly current: string;
    readonly binPath: string;
    readonly cwd: string;
    readonly readFile: (filePath: string) => string;
    readonly exists: (filePath: string) => boolean;
    readonly spawn: (command: string, args: readonly string[], cwd: string) => SpawnResult;
    readonly execPath: string;
    readonly log: (line: string) => void;
    readonly writeCache: boolean;
}

const NPX_MESSAGE =
    'Nothing to update: you are running domain-driver through npx, which fetches the requested version each time. Use: npx domain-driver@latest <command>';

const REFRESH_FAILED = 'ℹ️  Guidance refresh failed; run: domain-driver init';

function safeRealpath(target: string): string {
    try {
        return fs.realpathSync(target);
    } catch {
        return target;
    }
}

export function defaultUpdateDeps(): UpdateDeps {
    return {
        env: process.env,
        homedir: os.homedir(),
        now: Date.now,
        fetchImpl: nodeFetch,
        current: currentVersion(),
        binPath: safeRealpath(process.argv[1] ?? ''),
        cwd: process.cwd(),
        readFile: (filePath) => fs.readFileSync(filePath, 'utf-8'),
        exists: (filePath) => fs.existsSync(filePath),
        spawn: (command, args, cwd) => {
            const result = spawnSync(command, [...args], { stdio: 'inherit', cwd, shell: process.platform === 'win32' });
            return { status: result.status, error: result.error };
        },
        execPath: process.execPath,
        log: (line) => console.log(line),
        writeCache: true,
    };
}

export async function runUpdate(options: UpdateOptions, deps: UpdateDeps): Promise<void> {
    const install = detectInstallMode(deps.binPath, deps.readFile);
    if (install.mode === 'npx') {
        deps.log(NPX_MESSAGE);
        return;
    }

    const command = commandFor(install, deps);
    if (options.dryRun) {
        deps.log(install.root === null ? `Would run: ${command.display}` : `Would run: ${command.display} in ${install.root}`);
        return;
    }

    const latest = await freshLatest(deps);
    if (latest !== null && !isNewer(latest, deps.current)) {
        deps.log(`domain-driver ${deps.current} is already the latest version.`);
        return;
    }
    if (options.check) {
        deps.log(latest === null ? 'Could not reach the registry to check for updates.' : formatNotice(latest, deps.current));
        return;
    }
    if (latest === null) deps.log('Could not reach the registry; updating to @latest anyway.');

    runInstall(command, install, deps);
    deps.log(`✅ domain-driver updated to ${latest ?? '@latest'}`);
    refreshGuidance(install, deps);
}

function commandFor(install: InstallInfo, deps: UpdateDeps): UpdateCommand {
    if (install.mode === 'local' && install.root !== null) {
        return updateCommand('local', detectPackageManager(install.root, { readFile: deps.readFile, exists: deps.exists }));
    }
    return updateCommand('global', 'npm');
}

async function freshLatest(deps: UpdateDeps): Promise<string | null> {
    const latest = await fetchLatestVersion(deps.fetchImpl);
    if (deps.writeCache) {
        persistCache(cacheDir(deps.env, deps.homedir), { latest, checkedAt: new Date(deps.now()).toISOString() });
    }
    return latest;
}

function runInstall(command: UpdateCommand, install: InstallInfo, deps: UpdateDeps): void {
    const cwd = install.root ?? deps.cwd;
    const result = deps.spawn(command.command, command.args, cwd);
    if (result.error === undefined && result.status === 0) return;

    const code = result.status ?? 'error';
    const sudo = install.mode === 'global' ? ' (you may need sudo)' : '';
    throw new Error(`Update failed (exit ${code}). Run it yourself: ${command.display}${sudo}`);
}

// The freshly installed package is run in a new process: this one already has the old modules loaded.
function refreshGuidance(install: InstallInfo, deps: UpdateDeps): void {
    const root = install.mode === 'local' ? install.root : deps.exists(path.join(deps.cwd, 'package.json')) ? deps.cwd : null;
    if (root === null) return;
    const result = deps.spawn(deps.execPath, [installedEntry(install, root, deps), 'init'], root);
    if (result.error !== undefined || result.status !== 0) deps.log(REFRESH_FAILED);
}

function installedEntry(install: InstallInfo, root: string, deps: UpdateDeps): string {
    if (install.mode !== 'local') return deps.binPath;
    const entry = path.join(root, 'node_modules', 'domain-driver', 'dist', 'index.js');
    return deps.exists(entry) ? entry : deps.binPath;
}
