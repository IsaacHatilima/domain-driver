import * as http from 'http';
import * as https from 'https';

export const DIST_TAGS_URL = 'https://registry.npmjs.org/-/package/domain-driver/dist-tags';
export const FETCH_TIMEOUT_MS = 1500;

export interface FetchResponseLike {
    readonly ok: boolean;
    readonly status: number;
    json(): Promise<unknown>;
}

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<FetchResponseLike>;

export const nodeFetch: FetchLike = (url, init) =>
    new Promise<FetchResponseLike>((resolve, reject) => {
        const client = url.startsWith('https:') ? https : http;
        const request = client.get(url, { signal: init?.signal, headers: { accept: 'application/json' } }, (response) => {
            let body = '';
            response.setEncoding('utf-8');
            response.on('data', (chunk: string) => {
                body += chunk;
            });
            response.on('end', () => {
                const status = response.statusCode ?? 0;
                resolve({ ok: status >= 200 && status < 300, status, json: async () => JSON.parse(body) as unknown });
            });
            response.on('error', reject);
        });
        request.on('socket', (socket) => socket.unref());
        request.on('error', reject);
    });

export async function fetchLatestVersion(
    fetchImpl: FetchLike = nodeFetch,
    timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetchImpl(DIST_TAGS_URL, { signal: controller.signal });
        if (!response.ok) return null;
        const body: unknown = await response.json();
        const latest = (body as { latest?: unknown } | null)?.latest;
        return typeof latest === 'string' ? latest : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}
