import { describe, it, expect } from 'vitest';
import { DIST_TAGS_URL, fetchLatestVersion, FetchLike } from '../registry';

const respond = (status: number, body: unknown): FetchLike => async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

describe('fetchLatestVersion', () => {
    it('returns latest from dist-tags', async () => {
        let requested = '';
        const fetchImpl: FetchLike = async (url) => {
            requested = url;
            return { ok: true, status: 200, json: async () => ({ latest: '0.3.0' }) };
        };
        expect(await fetchLatestVersion(fetchImpl)).toBe('0.3.0');
        expect(requested).toBe(DIST_TAGS_URL);
    });

    it('returns null when latest is missing or not a string', async () => {
        expect(await fetchLatestVersion(respond(200, {}))).toBeNull();
        expect(await fetchLatestVersion(respond(200, { latest: 3 }))).toBeNull();
        expect(await fetchLatestVersion(respond(200, null))).toBeNull();
    });

    it('returns null on a non-2xx response', async () => {
        expect(await fetchLatestVersion(respond(404, { latest: '0.3.0' }))).toBeNull();
    });

    it('returns null when fetch throws', async () => {
        const failing: FetchLike = async () => { throw new Error('offline'); };
        expect(await fetchLatestVersion(failing)).toBeNull();
    });

    it('aborts after the timeout', async () => {
        const hanging: FetchLike = (_url, init) =>
            new Promise((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
            });
        expect(await fetchLatestVersion(hanging, 20)).toBeNull();
    });
});
