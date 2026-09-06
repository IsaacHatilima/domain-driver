import { describe, it, expect, afterEach } from 'vitest';
import * as http from 'http';
import { AddressInfo } from 'net';
import { DIST_TAGS_URL, fetchLatestVersion, FetchLike, nodeFetch } from '../registry';

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

describe('nodeFetch', () => {
    const servers: http.Server[] = [];
    const sockets: import('net').Socket[] = [];

    const start = async (handler: http.RequestListener): Promise<number> => {
        const server = http.createServer(handler);
        servers.push(server);
        server.on('connection', (socket) => sockets.push(socket));
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        return (server.address() as AddressInfo).port;
    };

    // fetchLatestVersion always requests DIST_TAGS_URL, so the local port is substituted here.
    const against = (port: number): FetchLike => (_url, init) => nodeFetch(`http://127.0.0.1:${port}/`, init);

    afterEach(async () => {
        for (const socket of sockets) socket.destroy();
        sockets.length = 0;
        await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
        servers.length = 0;
    });

    it('reads latest from a real http response', async () => {
        const port = await start((_request, response) => {
            response.writeHead(200, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ latest: '0.3.0' }));
        });
        expect(await fetchLatestVersion(against(port))).toBe('0.3.0');
    });

    it('gives up quickly when the server never responds', async () => {
        const port = await start(() => {
            // Accept the connection and never answer.
        });
        const started = Date.now();
        expect(await fetchLatestVersion(against(port), 50)).toBeNull();
        expect(Date.now() - started).toBeLessThan(1000);
    });

    it('returns null on a 500 response', async () => {
        const port = await start((_request, response) => {
            response.writeHead(500);
            response.end('boom');
        });
        expect(await fetchLatestVersion(against(port))).toBeNull();
    });

    it('returns null when the body is not JSON', async () => {
        const port = await start((_request, response) => {
            response.writeHead(200, { 'content-type': 'application/json' });
            response.end('not json');
        });
        expect(await fetchLatestVersion(against(port))).toBeNull();
    });
});
