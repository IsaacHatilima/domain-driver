import { cacheDir, isFresh, readCache, writeCache } from './cache';
import { FetchLike, fetchLatestVersion } from './registry';
import { isNewer } from './version';

export interface CheckDeps {
    readonly env: NodeJS.ProcessEnv;
    readonly homedir: string;
    readonly now: () => number;
    readonly fetchImpl: FetchLike;
    readonly current: string;
    readonly force?: boolean;
}

const UNSET_VALUES = new Set(['', '0', 'false']);

function isSet(value: string | undefined): boolean {
    return value !== undefined && !UNSET_VALUES.has(value);
}

export function shouldCheck(env: NodeJS.ProcessEnv, isTTY: boolean, commandName: string): boolean {
    if (isSet(env.CI)) return false;
    if (isSet(env.DOMAIN_DRIVER_NO_UPDATE_CHECK)) return false;
    if (env.NO_UPDATE_NOTIFIER !== undefined) return false;
    if (!isTTY) return false;
    return commandName !== 'update';
}

export function formatNotice(latest: string, current: string): string {
    return `ℹ️  domain-driver ${latest} is available (you have ${current}). Run: domain-driver update`;
}

export async function latestVersion(deps: CheckDeps): Promise<string | null> {
    const dir = cacheDir(deps.env, deps.homedir);
    const cached = readCache(dir);
    if (!deps.force && cached !== null && isFresh(cached, deps.now())) return cached.latest;

    const latest = await fetchLatestVersion(deps.fetchImpl);
    writeCache(dir, { latest, checkedAt: new Date(deps.now()).toISOString() });
    return latest;
}

export async function checkForUpdate(deps: CheckDeps): Promise<string | null> {
    try {
        const latest = await latestVersion(deps);
        if (latest !== null && isNewer(latest, deps.current)) return formatNotice(latest, deps.current);
        return null;
    } catch {
        return null;
    }
}
