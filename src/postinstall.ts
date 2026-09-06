import * as fs from 'fs';
import * as path from 'path';
import { InitResult, runInit } from './init/init';

export type SkipReason = 'ci' | 'global' | 'no-init-cwd' | 'no-consumer-package' | 'self-install';

export type PostinstallDecision =
    | { readonly run: true; readonly root: string }
    | { readonly run: false; readonly reason: SkipReason };

export type PackageNameReader = (root: string) => string | null;
export type InitRunner = (root: string) => readonly InitResult[];

const NOT_CI = new Set(['', '0', 'false']);

export function shouldRunPostinstall(env: NodeJS.ProcessEnv, readName: PackageNameReader): PostinstallDecision {
    if (env.CI !== undefined && !NOT_CI.has(env.CI)) return { run: false, reason: 'ci' };
    if (env.npm_config_global === 'true') return { run: false, reason: 'global' };

    const root = env.INIT_CWD;
    if (!root) return { run: false, reason: 'no-init-cwd' };

    const name = readName(root);
    if (name === null) return { run: false, reason: 'no-consumer-package' };
    if (name === 'domain-driver') return { run: false, reason: 'self-install' };

    return { run: true, root };
}

export function readPackageName(root: string): string | null {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
        const name = (parsed as { name?: unknown }).name;
        return typeof name === 'string' ? name : '';
    } catch {
        return null;
    }
}

export function run(
    init: InitRunner = runInit,
    env: NodeJS.ProcessEnv = process.env,
    readName: PackageNameReader = readPackageName
): void {
    try {
        const decision = shouldRunPostinstall(env, readName);
        if (!decision.run) return;
        for (const result of init(decision.root)) {
            console.log(`domain-driver: ${result.file} ${result.status}`);
        }
    } catch {
        // A postinstall must never fail an install.
    }
}
