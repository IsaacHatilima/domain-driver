import * as fs from 'fs';
import * as path from 'path';

export interface UpdateCache {
    readonly latest: string | null;
    readonly checkedAt: string;
}

export const CACHE_FILE = 'update-check.json';
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function cacheDir(env: NodeJS.ProcessEnv, homedir: string): string {
    if (env.DOMAIN_DRIVER_CACHE_DIR) return env.DOMAIN_DRIVER_CACHE_DIR;
    if (env.XDG_CACHE_HOME) return path.join(env.XDG_CACHE_HOME, 'domain-driver');
    return path.join(homedir, '.cache', 'domain-driver');
}

function isCache(value: unknown): value is UpdateCache {
    if (typeof value !== 'object' || value === null) return false;
    const { latest, checkedAt } = value as { latest?: unknown; checkedAt?: unknown };
    const latestOk = latest === null || typeof latest === 'string';
    const checkedOk = typeof checkedAt === 'string' && !Number.isNaN(Date.parse(checkedAt));
    return latestOk && checkedOk;
}

export function readCache(dir: string): UpdateCache | null {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(path.join(dir, CACHE_FILE), 'utf-8'));
        return isCache(parsed) ? Object.freeze({ latest: parsed.latest, checkedAt: parsed.checkedAt }) : null;
    } catch {
        return null;
    }
}

export function writeCache(dir: string, cache: UpdateCache): void {
    try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, CACHE_FILE), JSON.stringify(cache));
    } catch {
        // The cache is advisory; never fail a command over it.
    }
}

export function isFresh(cache: UpdateCache, now: number, ttlMs: number = CACHE_TTL_MS): boolean {
    return now - Date.parse(cache.checkedAt) < ttlMs;
}
