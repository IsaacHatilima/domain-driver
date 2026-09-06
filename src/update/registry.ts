export const DIST_TAGS_URL = 'https://registry.npmjs.org/-/package/domain-driver/dist-tags';
export const FETCH_TIMEOUT_MS = 1500;

export interface FetchResponseLike {
    readonly ok: boolean;
    readonly status: number;
    json(): Promise<unknown>;
}

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<FetchResponseLike>;

export async function fetchLatestVersion(
    fetchImpl: FetchLike = fetch,
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
