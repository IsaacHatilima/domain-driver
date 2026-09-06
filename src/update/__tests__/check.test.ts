import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { checkForUpdate, formatNotice, latestVersion, shouldCheck, CheckDeps } from '../check';
import { readCache, writeCache } from '../cache';
import { FetchLike } from '../registry';

let dir: string;
const NOW = Date.parse('2026-09-06T12:00:00.000Z');

const fetchWith = (latest: unknown, calls: { count: number }): FetchLike => async () => {
    calls.count += 1;
    return { ok: true, status: 200, json: async () => ({ latest }) };
};

const deps = (fetchImpl: FetchLike, extra: Partial<CheckDeps> = {}): CheckDeps => ({
    env: { DOMAIN_DRIVER_CACHE_DIR: dir },
    homedir: '/nope',
    now: () => NOW,
    fetchImpl,
    current: '0.2.0',
    ...extra,
});

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-check-'));
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('shouldCheck', () => {
    it('runs in the default case', () => {
        expect(shouldCheck({}, true, 'make:feature')).toBe(true);
    });

    it.each([
        [{ CI: 'true' }, 'CI'],
        [{ CI: '1' }, 'CI=1'],
        [{ DOMAIN_DRIVER_NO_UPDATE_CHECK: '1' }, 'opt-out'],
        [{ NO_UPDATE_NOTIFIER: '' }, 'NO_UPDATE_NOTIFIER'],
    ])('skips for %o (%s)', (env) => {
        expect(shouldCheck(env, true, 'make:feature')).toBe(false);
    });

    it.each(['', '0', 'false'])('treats CI=%s and opt-out=%s as unset', (value) => {
        expect(shouldCheck({ CI: value, DOMAIN_DRIVER_NO_UPDATE_CHECK: value }, true, 'init')).toBe(true);
    });

    it('skips without a TTY and for the update command', () => {
        expect(shouldCheck({}, false, 'make:feature')).toBe(false);
        expect(shouldCheck({}, true, 'update')).toBe(false);
    });
});

describe('formatNotice', () => {
    it('matches the spec text exactly', () => {
        expect(formatNotice('0.3.0', '0.2.0')).toBe(
            'ℹ️  domain-driver 0.3.0 is available (you have 0.2.0). Run: domain-driver update'
        );
    });
});

describe('latestVersion', () => {
    it('fetches when there is no cache and writes it', async () => {
        const calls = { count: 0 };
        expect(await latestVersion(deps(fetchWith('0.3.0', calls)))).toBe('0.3.0');
        expect(calls.count).toBe(1);
        expect(readCache(dir)).toEqual({ latest: '0.3.0', checkedAt: new Date(NOW).toISOString() });
    });

    it('uses a fresh cache without fetching', async () => {
        writeCache(dir, { latest: '0.9.0', checkedAt: new Date(NOW - 1000).toISOString() });
        const calls = { count: 0 };
        expect(await latestVersion(deps(fetchWith('0.3.0', calls)))).toBe('0.9.0');
        expect(calls.count).toBe(0);
    });

    it('refetches when the cache is stale', async () => {
        writeCache(dir, { latest: '0.9.0', checkedAt: new Date(NOW - 25 * 60 * 60 * 1000).toISOString() });
        const calls = { count: 0 };
        expect(await latestVersion(deps(fetchWith('0.3.0', calls)))).toBe('0.3.0');
        expect(calls.count).toBe(1);
    });

    it('ignores a fresh cache when forced', async () => {
        writeCache(dir, { latest: '0.9.0', checkedAt: new Date(NOW).toISOString() });
        const calls = { count: 0 };
        expect(await latestVersion(deps(fetchWith('0.3.0', calls), { force: true }))).toBe('0.3.0');
        expect(calls.count).toBe(1);
    });

    it('caches a failed fetch as null', async () => {
        const failing: FetchLike = async () => { throw new Error('offline'); };
        expect(await latestVersion(deps(failing))).toBeNull();
        expect(readCache(dir)?.latest).toBeNull();
    });
});

describe('checkForUpdate', () => {
    it('returns the notice when newer', async () => {
        expect(await checkForUpdate(deps(fetchWith('0.3.0', { count: 0 })))).toBe(formatNotice('0.3.0', '0.2.0'));
    });

    it('returns null when equal, older, unknown, or malformed', async () => {
        expect(await checkForUpdate(deps(fetchWith('0.2.0', { count: 0 })))).toBeNull();
        expect(await checkForUpdate(deps(fetchWith('0.1.0', { count: 0 })))).toBeNull();
        expect(await checkForUpdate(deps(fetchWith(null, { count: 0 })))).toBeNull();
        expect(await checkForUpdate(deps(fetchWith('0.3.0-beta.1', { count: 0 })))).toBeNull();
    });

    it('never throws', async () => {
        const exploding: FetchLike = () => { throw new Error('sync boom'); };
        await expect(checkForUpdate(deps(exploding))).resolves.toBeNull();
    });
});
