import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CACHE_FILE, CACHE_TTL_MS, cacheDir, isFresh, readCache, writeCache } from '../cache';

let dir: string;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-cache-'));
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('cacheDir', () => {
    it('prefers DOMAIN_DRIVER_CACHE_DIR, then XDG_CACHE_HOME, then ~/.cache', () => {
        expect(cacheDir({ DOMAIN_DRIVER_CACHE_DIR: '/explicit', XDG_CACHE_HOME: '/xdg' }, '/home/u')).toBe('/explicit');
        expect(cacheDir({ XDG_CACHE_HOME: '/xdg' }, '/home/u')).toBe(path.join('/xdg', 'domain-driver'));
        expect(cacheDir({}, '/home/u')).toBe(path.join('/home/u', '.cache', 'domain-driver'));
    });
});

describe('readCache and writeCache', () => {
    it('round-trips a cache entry and creates the directory', () => {
        const nested = path.join(dir, 'a', 'b');
        writeCache(nested, { latest: '0.3.0', checkedAt: '2026-09-06T00:00:00.000Z' });
        expect(readCache(nested)).toEqual({ latest: '0.3.0', checkedAt: '2026-09-06T00:00:00.000Z' });
    });

    it('accepts a null latest', () => {
        writeCache(dir, { latest: null, checkedAt: '2026-09-06T00:00:00.000Z' });
        expect(readCache(dir)?.latest).toBeNull();
    });

    it('returns null when absent, malformed, or invalid', () => {
        expect(readCache(dir)).toBeNull();
        fs.writeFileSync(path.join(dir, CACHE_FILE), '{ nope');
        expect(readCache(dir)).toBeNull();
        fs.writeFileSync(path.join(dir, CACHE_FILE), JSON.stringify({ latest: 3, checkedAt: 'x' }));
        expect(readCache(dir)).toBeNull();
    });

    it('ignores write failures', () => {
        const file = path.join(dir, 'file');
        fs.writeFileSync(file, '');
        expect(() => writeCache(path.join(file, 'child'), { latest: null, checkedAt: 'x' })).not.toThrow();
    });
});

describe('isFresh', () => {
    const at = Date.parse('2026-09-06T12:00:00.000Z');
    it('is fresh within the TTL and stale after it', () => {
        const entry = { latest: '0.3.0', checkedAt: '2026-09-06T12:00:00.000Z' };
        expect(isFresh(entry, at + 1000)).toBe(true);
        expect(isFresh(entry, at + CACHE_TTL_MS - 1)).toBe(true);
        expect(isFresh(entry, at + CACHE_TTL_MS)).toBe(false);
    });
});
