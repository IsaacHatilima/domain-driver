# Update Command and Version Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Print a one-line notice when a newer domain-driver exists, and give users `domain-driver update`, which detects how the tool was installed and which package manager the project uses, runs the upgrade, and refreshes the agent guidance.

**Architecture:** Small pure modules under `src/update/` (version parsing, registry fetch with timeout, a 24-hour file cache, the check itself, install-mode detection, package-manager detection) composed by `src/commands/update.ts` through an injectable dependency object, so everything is unit-tested without network or package managers. The CLI starts the check in `preAction` and prints the notice in `postAction`.

**Tech Stack:** TypeScript 5.9 (strict, commonjs, ES2020), Node 18+ (global `fetch`, `AbortController`), commander 14, vitest 4. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-06-update-and-version-check-design.md`

## Global Constraints

- Notice text verbatim: `ℹ️  domain-driver <latest> is available (you have <current>). Run: domain-driver update`.
- The check never throws, never prints on failure, and never delays a command by more than the 1500 ms fetch timeout. Failures are cached as `latest: null` so an offline machine pays the timeout at most once per 24 hours.
- Skip rules: `CI` set and not `''`/`'0'`/`'false'`; `DOMAIN_DRIVER_NO_UPDATE_CHECK` set and not one of those; `NO_UPDATE_NOTIFIER` set at all; stdout not a TTY; the command is `update`.
- Cache directory precedence: `DOMAIN_DRIVER_CACHE_DIR`, then `XDG_CACHE_HOME/domain-driver`, then `~/.cache/domain-driver`. File name `update-check.json`.
- `isNewer` compares `major.minor.patch` only; anything else returns false.
- Install-mode rules: a path containing a `_npx` segment is `npx`; otherwise find the last `node_modules/domain-driver` segment, and the first of that directory's parent and its ancestors (up to six levels) whose `package.json` lists `domain-driver` in `dependencies` or `devDependencies` is the local root; no match means `global`.
- Update commands verbatim from spec 5.3. Global always uses npm.
- `--dry-run` prints `Would run: <command>` (plus ` in <root>` for local) and performs no network request. `--check` forces a registry check and prints the notice or `domain-driver <current> is already the latest version.` or `Could not reach the registry to check for updates.` and never installs.
- Version comes from `package.json` at runtime; the literal in `index.ts` is removed. Version bumps to `0.3.0`.
- Immutability; files under 400 lines; functions under 50 lines; mock only console, fetch, and spawn in tests; coverage thresholds stay at 80. Commit after each task; do not push.

## File Structure

| File | Responsibility |
|---|---|
| `src/update/version.ts` | `currentVersion(readFile?)`, `parseVersion`, `isNewer` |
| `src/update/registry.ts` | `FetchLike`, `DIST_TAGS_URL`, `fetchLatestVersion(fetchImpl?, timeoutMs?)` |
| `src/update/cache.ts` | `UpdateCache`, `CACHE_FILE`, `CACHE_TTL_MS`, `cacheDir`, `readCache`, `writeCache`, `isFresh` |
| `src/update/check.ts` | `CheckDeps`, `shouldCheck`, `formatNotice`, `latestVersion`, `checkForUpdate` |
| `src/update/install-mode.ts` | `InstallMode`, `InstallInfo`, `detectInstallMode(binPath, readFile)` |
| `src/update/package-manager.ts` | `PackageManager`, `FsLike`, `detectPackageManager`, `UpdateCommand`, `updateCommand` |
| `src/init/init.ts` | additionally exports `INIT_ICONS` (moved from `index.ts`) |
| `src/commands/update.ts` | `UpdateOptions`, `UpdateDeps`, `SpawnResult`, `defaultUpdateDeps`, `runUpdate` |
| `src/index.ts` | `.version(currentVersion())`, hooks, `update` command |

---

### Task 1: Version source and comparison

**Files:**
- Create: `src/update/version.ts`
- Modify: `src/index.ts` (use `currentVersion()`)
- Test: `src/update/__tests__/version.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/update/__tests__/version.test.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { currentVersion, isNewer, parseVersion } from '../version';

describe('currentVersion', () => {
    it('reads the version from the package root package.json', () => {
        const expected = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf-8')).version;
        expect(currentVersion()).toBe(expected);
    });

    it('falls back to 0.0.0 when the file cannot be read', () => {
        expect(currentVersion(() => { throw new Error('nope'); })).toBe('0.0.0');
    });

    it('falls back to 0.0.0 when version is not a string', () => {
        expect(currentVersion(() => JSON.stringify({ version: 3 }))).toBe('0.0.0');
    });
});

describe('parseVersion', () => {
    it('parses major.minor.patch', () => {
        expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
        expect(parseVersion(' 0.2.0 ')).toEqual([0, 2, 0]);
    });

    it.each(['1.2', '1.2.3-beta.1', 'v1.2.3', '', 'latest'])('returns null for %s', (value) => {
        expect(parseVersion(value)).toBeNull();
    });
});

describe('isNewer', () => {
    it.each([
        ['0.3.0', '0.2.0', true],
        ['1.0.0', '0.9.9', true],
        ['0.2.1', '0.2.0', true],
        ['0.2.0', '0.2.0', false],
        ['0.1.9', '0.2.0', false],
        ['0.3.0-beta.1', '0.2.0', false],
        ['', '0.2.0', false],
        ['0.3.0', 'garbage', false],
    ])('isNewer(%s, %s) is %s', (latest, current, expected) => {
        expect(isNewer(latest, current)).toBe(expected);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/update/__tests__/version.test.ts`
Expected: FAIL, cannot find module `../version`

- [ ] **Step 3: Write version.ts**

```ts
// src/update/version.ts
import * as fs from 'fs';
import * as path from 'path';

const FALLBACK_VERSION = '0.0.0';
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

type ReadFile = (filePath: string) => string;

const readUtf8: ReadFile = (filePath) => fs.readFileSync(filePath, 'utf-8');

export function currentVersion(readFile: ReadFile = readUtf8): string {
    try {
        const parsed: unknown = JSON.parse(readFile(path.join(__dirname, '..', '..', 'package.json')));
        const version = (parsed as { version?: unknown }).version;
        return typeof version === 'string' ? version : FALLBACK_VERSION;
    } catch {
        return FALLBACK_VERSION;
    }
}

export function parseVersion(value: string): readonly [number, number, number] | null {
    const match = VERSION_PATTERN.exec(value.trim());
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isNewer(latest: string, current: string): boolean {
    const next = parseVersion(latest);
    const now = parseVersion(current);
    if (next === null || now === null) return false;
    for (let index = 0; index < 3; index += 1) {
        if (next[index] !== now[index]) return next[index] > now[index];
    }
    return false;
}
```

- [ ] **Step 4: Use it in the CLI**

In `src/index.ts` add `import { currentVersion } from './update/version';` and replace `.version('0.2.0')` with `.version(currentVersion())`.

- [ ] **Step 5: Run tests, build, and commit**

Run: `npx vitest run src/update/__tests__/version.test.ts && npx vitest run && npm run build`
Expected: PASS

```bash
git add src/update/version.ts src/update/__tests__/version.test.ts src/index.ts
git commit -m "feat: read the CLI version from package.json and add a version comparator"
```

---

### Task 2: Registry fetch and cache

**Files:**
- Create: `src/update/registry.ts`, `src/update/cache.ts`
- Test: `src/update/__tests__/registry.test.ts`, `src/update/__tests__/cache.test.ts`

- [ ] **Step 1: Write the failing registry tests**

```ts
// src/update/__tests__/registry.test.ts
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
```

- [ ] **Step 2: Write the failing cache tests**

```ts
// src/update/__tests__/cache.test.ts
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
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npx vitest run src/update/__tests__/registry.test.ts src/update/__tests__/cache.test.ts`
Expected: FAIL, modules not found

- [ ] **Step 4: Write registry.ts and cache.ts**

```ts
// src/update/registry.ts
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
```

```ts
// src/update/cache.ts
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
```

- [ ] **Step 5: Run tests, build, and commit**

Run: `npx vitest run src/update && npm run build`
Expected: PASS

```bash
git add src/update
git commit -m "feat: registry dist-tags fetch with timeout and a 24h update-check cache"
```

---

### Task 3: The check

**Files:**
- Create: `src/update/check.ts`
- Test: `src/update/__tests__/check.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/update/__tests__/check.test.ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/update/__tests__/check.test.ts`
Expected: FAIL, cannot find module `../check`

- [ ] **Step 3: Write check.ts**

```ts
// src/update/check.ts
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
```

- [ ] **Step 4: Run tests, build, and commit**

Run: `npx vitest run src/update && npm run build`
Expected: PASS

```bash
git add src/update/check.ts src/update/__tests__/check.test.ts
git commit -m "feat: cached update check with skip rules and the notice text"
```

---

### Task 4: Install mode and package manager detection

**Files:**
- Create: `src/update/install-mode.ts`, `src/update/package-manager.ts`
- Modify: spec section 5.1 (ancestor walk for pnpm layouts)
- Test: `src/update/__tests__/install-mode.test.ts`, `src/update/__tests__/package-manager.test.ts`

- [ ] **Step 1: Write the failing install-mode tests**

```ts
// src/update/__tests__/install-mode.test.ts
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { detectInstallMode } from '../install-mode';

const files = (map: Record<string, unknown>) => (filePath: string): string => {
    const key = Object.keys(map).find((candidate) => path.resolve(candidate) === path.resolve(filePath));
    if (key === undefined) throw new Error(`ENOENT ${filePath}`);
    return JSON.stringify(map[key]);
};

const P = (...parts: string[]): string => path.resolve(path.sep, ...parts);

describe('detectInstallMode', () => {
    it('detects npx from the _npx cache path', () => {
        const bin = P('Users', 'me', '.npm', '_npx', 'abc123', 'node_modules', 'domain-driver', 'dist', 'index.js');
        expect(detectInstallMode(bin, files({}))).toEqual({ mode: 'npx', root: null });
    });

    it('detects a local npm install from the project package.json', () => {
        const root = P('work', 'app');
        const bin = path.join(root, 'node_modules', 'domain-driver', 'dist', 'index.js');
        const read = files({ [path.join(root, 'package.json')]: { devDependencies: { 'domain-driver': '^0.2.0' } } });
        expect(detectInstallMode(bin, read)).toEqual({ mode: 'local', root });
    });

    it('walks up through a pnpm store layout to the project root', () => {
        const root = P('work', 'app');
        const bin = path.join(root, 'node_modules', '.pnpm', 'domain-driver@0.2.0', 'node_modules', 'domain-driver', 'dist', 'index.js');
        const read = files({ [path.join(root, 'package.json')]: { dependencies: { 'domain-driver': '0.2.0' } } });
        expect(detectInstallMode(bin, read)).toEqual({ mode: 'local', root });
    });

    it('is global when the install root has no package.json', () => {
        const bin = P('usr', 'local', 'lib', 'node_modules', 'domain-driver', 'dist', 'index.js');
        expect(detectInstallMode(bin, files({}))).toEqual({ mode: 'global', root: null });
    });

    it('is global when the nearest package.json does not depend on domain-driver', () => {
        const root = P('work', 'app');
        const bin = path.join(root, 'node_modules', 'domain-driver', 'dist', 'index.js');
        const read = files({ [path.join(root, 'package.json')]: { dependencies: { react: '19' } } });
        expect(detectInstallMode(bin, read)).toEqual({ mode: 'global', root: null });
    });

    it('is global when there is no node_modules segment at all', () => {
        expect(detectInstallMode(P('repo', 'dist', 'index.js'), files({}))).toEqual({ mode: 'global', root: null });
    });
});
```

- [ ] **Step 2: Write the failing package-manager tests**

```ts
// src/update/__tests__/package-manager.test.ts
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { detectPackageManager, updateCommand, FsLike } from '../package-manager';

const ROOT = path.resolve(path.sep, 'work', 'app');

const fsWith = (present: Record<string, string>): FsLike => ({
    exists: (filePath) => Object.prototype.hasOwnProperty.call(present, path.basename(filePath)),
    readFile: (filePath) => {
        const name = path.basename(filePath);
        if (!(name in present)) throw new Error(`ENOENT ${filePath}`);
        return present[name];
    },
});

describe('detectPackageManager', () => {
    it('defaults to npm with no lockfile', () => {
        expect(detectPackageManager(ROOT, fsWith({ 'package.json': '{}' }))).toBe('npm');
    });

    it.each([
        [{ 'package-lock.json': '' }, 'npm'],
        [{ 'pnpm-lock.yaml': '' }, 'pnpm'],
        [{ 'bun.lock': '' }, 'bun'],
        [{ 'bun.lockb': '' }, 'bun'],
        [{ 'yarn.lock': '# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.\n# yarn lockfile v1\n' }, 'yarn-classic'],
        [{ 'yarn.lock': '__metadata:\n  version: 8\n' }, 'yarn-berry'],
    ])('detects %o as %s', (lockfiles, expected) => {
        expect(detectPackageManager(ROOT, fsWith({ 'package.json': '{}', ...lockfiles }))).toBe(expected);
    });

    it('prefers pnpm over a stray yarn.lock when both exist', () => {
        expect(detectPackageManager(ROOT, fsWith({ 'package.json': '{}', 'pnpm-lock.yaml': '', 'yarn.lock': '' }))).toBe('pnpm');
    });

    it('lets the packageManager field win', () => {
        expect(detectPackageManager(ROOT, fsWith({ 'package.json': JSON.stringify({ packageManager: 'pnpm@9.1.0' }), 'package-lock.json': '' }))).toBe('pnpm');
        expect(detectPackageManager(ROOT, fsWith({ 'package.json': JSON.stringify({ packageManager: 'yarn@1.22.22' }) }))).toBe('yarn-classic');
        expect(detectPackageManager(ROOT, fsWith({ 'package.json': JSON.stringify({ packageManager: 'yarn@4.5.0' }) }))).toBe('yarn-berry');
        expect(detectPackageManager(ROOT, fsWith({ 'package.json': JSON.stringify({ packageManager: 'bun@1.1.0' }) }))).toBe('bun');
    });

    it('falls back to lockfiles when packageManager names something unknown', () => {
        expect(detectPackageManager(ROOT, fsWith({ 'package.json': JSON.stringify({ packageManager: 'deno@2' }), 'pnpm-lock.yaml': '' }))).toBe('pnpm');
    });
});

describe('updateCommand', () => {
    it.each([
        ['npm', 'npm install domain-driver@latest'],
        ['pnpm', 'pnpm update domain-driver@latest'],
        ['yarn-classic', 'yarn upgrade domain-driver@latest'],
        ['yarn-berry', 'yarn up domain-driver@latest'],
        ['bun', 'bun update domain-driver@latest'],
    ] as const)('local %s runs %s', (manager, display) => {
        const command = updateCommand('local', manager);
        expect(command.display).toBe(display);
        expect([command.command, ...command.args].join(' ')).toBe(display);
        expect(Object.isFrozen(command)).toBe(true);
    });

    it('global always uses npm -g', () => {
        expect(updateCommand('global', 'pnpm').display).toBe('npm install -g domain-driver@latest');
    });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npx vitest run src/update/__tests__/install-mode.test.ts src/update/__tests__/package-manager.test.ts`
Expected: FAIL, modules not found

- [ ] **Step 4: Write install-mode.ts**

```ts
// src/update/install-mode.ts
import * as path from 'path';

export type InstallMode = 'local' | 'global' | 'npx';

export interface InstallInfo {
    readonly mode: InstallMode;
    readonly root: string | null;
}

type ReadFile = (filePath: string) => string;

const MAX_ANCESTORS = 6;

export function detectInstallMode(binPath: string, readFile: ReadFile): InstallInfo {
    const segments = binPath.split(path.sep);
    if (segments.includes('_npx')) return Object.freeze({ mode: 'npx', root: null });

    const installRoot = findInstallRoot(segments);
    if (installRoot === null) return Object.freeze({ mode: 'global', root: null });

    const projectRoot = findProjectRoot(installRoot, readFile);
    return projectRoot === null
        ? Object.freeze({ mode: 'global', root: null })
        : Object.freeze({ mode: 'local', root: projectRoot });
}

function findInstallRoot(segments: readonly string[]): string | null {
    for (let index = segments.length - 1; index > 0; index -= 1) {
        if (segments[index - 1] === 'node_modules' && segments[index] === 'domain-driver') {
            const root = segments.slice(0, index - 1).join(path.sep);
            return root === '' ? path.sep : root;
        }
    }
    return null;
}

function findProjectRoot(start: string, readFile: ReadFile): string | null {
    let current = start;
    for (let level = 0; level <= MAX_ANCESTORS; level += 1) {
        if (dependsOnDomainDriver(current, readFile)) return current;
        const parent = path.dirname(current);
        if (parent === current) return null;
        current = parent;
    }
    return null;
}

function dependsOnDomainDriver(root: string, readFile: ReadFile): boolean {
    try {
        const parsed: unknown = JSON.parse(readFile(path.join(root, 'package.json')));
        const pkg = (parsed ?? {}) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
        return 'domain-driver' in (pkg.dependencies ?? {}) || 'domain-driver' in (pkg.devDependencies ?? {});
    } catch {
        return false;
    }
}
```

- [ ] **Step 5: Write package-manager.ts**

```ts
// src/update/package-manager.ts
import * as path from 'path';
import { InstallMode } from './install-mode';

export type PackageManager = 'npm' | 'pnpm' | 'yarn-classic' | 'yarn-berry' | 'bun';

export interface FsLike {
    readonly readFile: (filePath: string) => string;
    readonly exists: (filePath: string) => boolean;
}

export interface UpdateCommand {
    readonly command: string;
    readonly args: readonly string[];
    readonly display: string;
}

const PACKAGE = 'domain-driver@latest';

export function detectPackageManager(root: string, fsLike: FsLike): PackageManager {
    const declared = declaredManager(root, fsLike);
    if (declared !== null) return declared;

    const has = (name: string): boolean => fsLike.exists(path.join(root, name));
    if (has('bun.lock') || has('bun.lockb')) return 'bun';
    if (has('pnpm-lock.yaml')) return 'pnpm';
    if (has('yarn.lock')) return yarnFlavourFromLock(root, fsLike);
    return 'npm';
}

function declaredManager(root: string, fsLike: FsLike): PackageManager | null {
    try {
        const parsed: unknown = JSON.parse(fsLike.readFile(path.join(root, 'package.json')));
        const declared = (parsed as { packageManager?: unknown } | null)?.packageManager;
        if (typeof declared !== 'string') return null;
        const [name, version = ''] = declared.split('@');
        if (name === 'npm' || name === 'pnpm' || name === 'bun') return name;
        if (name !== 'yarn') return null;
        if (version === '') return yarnFlavourFromLock(root, fsLike);
        return version.startsWith('1.') || version === '1' ? 'yarn-classic' : 'yarn-berry';
    } catch {
        return null;
    }
}

function yarnFlavourFromLock(root: string, fsLike: FsLike): PackageManager {
    try {
        const header = fsLike.readFile(path.join(root, 'yarn.lock')).split('\n').slice(0, 3).join('\n');
        return header.includes('yarn lockfile v1') ? 'yarn-classic' : 'yarn-berry';
    } catch {
        return 'yarn-berry';
    }
}

function build(command: string, ...args: string[]): UpdateCommand {
    return Object.freeze({ command, args: Object.freeze(args), display: [command, ...args].join(' ') });
}

export function updateCommand(mode: Exclude<InstallMode, 'npx'>, manager: PackageManager): UpdateCommand {
    if (mode === 'global') return build('npm', 'install', '-g', PACKAGE);
    switch (manager) {
        case 'npm':
            return build('npm', 'install', PACKAGE);
        case 'pnpm':
            return build('pnpm', 'update', PACKAGE);
        case 'yarn-classic':
            return build('yarn', 'upgrade', PACKAGE);
        case 'yarn-berry':
            return build('yarn', 'up', PACKAGE);
        case 'bun':
            return build('bun', 'update', PACKAGE);
    }
}
```

- [ ] **Step 6: Amend spec 5.1 for the ancestor walk**

In `docs/superpowers/specs/2026-09-06-update-and-version-check-design.md`, replace the second table row's condition `The install root has a package.json whose dependencies or devDependencies names domain-driver` with `The install root, or one of its ancestors up to six levels up (pnpm stores the real package under node_modules/.pnpm/…), has a package.json whose dependencies or devDependencies names domain-driver`, and its Root cell with `that directory`.

- [ ] **Step 7: Run tests, build, and commit**

Run: `npx vitest run src/update && npm run build`
Expected: PASS

```bash
git add src/update docs/superpowers/specs/2026-09-06-update-and-version-check-design.md
git commit -m "feat: detect install mode and package manager for domain-driver update"
```

---

### Task 5: The `update` command

**Files:**
- Modify: `src/init/init.ts` (export `INIT_ICONS`), `src/index.ts` (import it instead of defining it)
- Create: `src/commands/update.ts`
- Modify: spec section 5.4 (`--dry-run` skips the registry check)
- Test: `src/commands/__tests__/update.test.ts`

- [ ] **Step 1: Move the icon table**

Append to `src/init/init.ts`:

```ts
export const INIT_ICONS: Readonly<Record<SectionStatus, string>> = Object.freeze({
    created: '✅',
    updated: '✅',
    unchanged: 'ℹ️ ',
});
```

(`SectionStatus` is already imported there.) In `src/index.ts` delete the local `INIT_ICONS` constant and import it from `./init/init` alongside `runInit`. Run `npx vitest run && npm run build` to confirm nothing moved.

- [ ] **Step 2: Write the failing tests**

```ts
// src/commands/__tests__/update.test.ts
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runUpdate, UpdateDeps, SpawnResult } from '../update';
import { FetchLike } from '../../update/registry';

const ROOT = path.resolve(path.sep, 'work', 'app');
const LOCAL_BIN = path.join(ROOT, 'node_modules', 'domain-driver', 'dist', 'index.js');
const GLOBAL_BIN = path.resolve(path.sep, 'usr', 'local', 'lib', 'node_modules', 'domain-driver', 'dist', 'index.js');
const NPX_BIN = path.resolve(path.sep, 'home', 'u', '.npm', '_npx', 'x', 'node_modules', 'domain-driver', 'dist', 'index.js');

const registry = (latest: string | null): FetchLike => async () =>
    latest === null
        ? { ok: false, status: 500, json: async () => null }
        : { ok: true, status: 200, json: async () => ({ latest }) };

interface Harness {
    readonly deps: UpdateDeps;
    readonly lines: string[];
    readonly spawned: { command: string; args: readonly string[]; cwd: string }[];
    readonly inits: string[];
}

function harness(overrides: Partial<UpdateDeps> = {}, spawnResult: SpawnResult = { status: 0 }): Harness {
    const lines: string[] = [];
    const spawned: Harness['spawned'] = [];
    const inits: string[] = [];
    const files: Record<string, string> = {
        [path.join(ROOT, 'package.json')]: JSON.stringify({ devDependencies: { 'domain-driver': '^0.2.0' } }),
        [path.join(ROOT, 'pnpm-lock.yaml')]: '',
    };
    const deps: UpdateDeps = {
        env: { DOMAIN_DRIVER_CACHE_DIR: path.join(ROOT, '.cache') },
        homedir: '/nope',
        now: () => Date.parse('2026-09-06T12:00:00.000Z'),
        fetchImpl: registry('0.3.0'),
        current: '0.2.0',
        binPath: LOCAL_BIN,
        cwd: ROOT,
        readFile: (filePath) => {
            const key = Object.keys(files).find((candidate) => path.resolve(candidate) === path.resolve(filePath));
            if (key === undefined) throw new Error(`ENOENT ${filePath}`);
            return files[key];
        },
        exists: (filePath) => Object.keys(files).some((candidate) => path.resolve(candidate) === path.resolve(filePath)),
        spawn: (command, args, cwd) => {
            spawned.push({ command, args, cwd });
            return spawnResult;
        },
        init: (root) => {
            inits.push(root);
            return [{ file: 'AGENTS.md', status: 'updated' }];
        },
        log: (line) => lines.push(line),
        writeCache: false,
        ...overrides,
    };
    return { deps, lines, spawned, inits };
}

describe('runUpdate', () => {
    it('explains npx and does nothing else', async () => {
        const h = harness({ binPath: NPX_BIN });
        await runUpdate({ dryRun: false, check: false }, h.deps);
        expect(h.lines).toEqual([
            'Nothing to update: you are running domain-driver through npx, which fetches the requested version each time. Use: npx domain-driver@latest <command>',
        ]);
        expect(h.spawned).toEqual([]);
    });

    it('stops when already on the latest version', async () => {
        const h = harness({ fetchImpl: registry('0.2.0') });
        await runUpdate({ dryRun: false, check: false }, h.deps);
        expect(h.lines).toEqual(['domain-driver 0.2.0 is already the latest version.']);
        expect(h.spawned).toEqual([]);
    });

    it('--check prints the notice without installing', async () => {
        const h = harness();
        await runUpdate({ dryRun: false, check: true }, h.deps);
        expect(h.lines).toEqual(['ℹ️  domain-driver 0.3.0 is available (you have 0.2.0). Run: domain-driver update']);
        expect(h.spawned).toEqual([]);
    });

    it('--check reports an unreachable registry', async () => {
        const h = harness({ fetchImpl: registry(null) });
        await runUpdate({ dryRun: false, check: true }, h.deps);
        expect(h.lines).toEqual(['Could not reach the registry to check for updates.']);
    });

    it('--dry-run prints the command and skips the registry', async () => {
        let fetched = 0;
        const counting: FetchLike = async () => { fetched += 1; return { ok: true, status: 200, json: async () => ({ latest: '0.3.0' }) }; };
        const h = harness({ fetchImpl: counting });
        await runUpdate({ dryRun: true, check: false }, h.deps);
        expect(h.lines).toEqual([`Would run: pnpm update domain-driver@latest in ${ROOT}`]);
        expect(fetched).toBe(0);
        expect(h.spawned).toEqual([]);
    });

    it('runs the package manager in the project root and refreshes guidance', async () => {
        const h = harness();
        await runUpdate({ dryRun: false, check: false }, h.deps);
        expect(h.spawned).toEqual([{ command: 'pnpm', args: ['update', 'domain-driver@latest'], cwd: ROOT }]);
        expect(h.inits).toEqual([ROOT]);
        expect(h.lines).toEqual(['✅ domain-driver updated to 0.3.0', '✅ AGENTS.md updated']);
    });

    it('continues to @latest when the registry is unreachable', async () => {
        const h = harness({ fetchImpl: registry(null) });
        await runUpdate({ dryRun: false, check: false }, h.deps);
        expect(h.lines[0]).toBe('Could not reach the registry; updating to @latest anyway.');
        expect(h.lines).toContain('✅ domain-driver updated to @latest');
        expect(h.spawned).toHaveLength(1);
    });

    it('global uses npm -g, hints sudo on failure, and inits only when cwd has a package.json', async () => {
        const failing = harness({ binPath: GLOBAL_BIN, cwd: path.resolve(path.sep, 'elsewhere') }, { status: 243 });
        await expect(runUpdate({ dryRun: false, check: false }, failing.deps)).rejects.toThrow(
            'Update failed (exit 243). Run it yourself: npm install -g domain-driver@latest (you may need sudo)'
        );
        const ok = harness({ binPath: GLOBAL_BIN, cwd: ROOT });
        await runUpdate({ dryRun: false, check: false }, ok.deps);
        expect(ok.spawned[0]).toEqual({ command: 'npm', args: ['install', '-g', 'domain-driver@latest'], cwd: ROOT });
        expect(ok.inits).toEqual([ROOT]);
        const noProject = harness({ binPath: GLOBAL_BIN, cwd: path.resolve(path.sep, 'elsewhere') });
        await runUpdate({ dryRun: false, check: false }, noProject.deps);
        expect(noProject.inits).toEqual([]);
    });

    it('local failure has no sudo hint and reports a spawn error', async () => {
        const h = harness({}, { status: null, error: new Error('spawn pnpm ENOENT') });
        await expect(runUpdate({ dryRun: false, check: false }, h.deps)).rejects.toThrow(
            'Update failed (exit error). Run it yourself: pnpm update domain-driver@latest'
        );
    });
});
```

Note the `writeCache: false` dependency: `runUpdate` must not write the real cache when tests pass a fake filesystem, so `UpdateDeps` carries a `writeCache` flag that defaults to `true` in production. In tests it is `false` and `latestVersion` is called with `force: true`, which reads nothing when the flag is off.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/commands/__tests__/update.test.ts`
Expected: FAIL, cannot find module `../update`

- [ ] **Step 4: Write the command**

```ts
// src/commands/update.ts
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { INIT_ICONS, InitResult, runInit } from '../init/init';
import { formatNotice } from '../update/check';
import { detectInstallMode, InstallInfo } from '../update/install-mode';
import { detectPackageManager, updateCommand, UpdateCommand } from '../update/package-manager';
import { FetchLike, fetchLatestVersion } from '../update/registry';
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
    readonly init: (root: string) => readonly InitResult[];
    readonly log: (line: string) => void;
    readonly writeCache: boolean;
}

const NPX_MESSAGE =
    'Nothing to update: you are running domain-driver through npx, which fetches the requested version each time. Use: npx domain-driver@latest <command>';

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
        fetchImpl: fetch,
        current: currentVersion(),
        binPath: safeRealpath(process.argv[1] ?? ''),
        cwd: process.cwd(),
        readFile: (filePath) => fs.readFileSync(filePath, 'utf-8'),
        exists: (filePath) => fs.existsSync(filePath),
        spawn: (command, args, cwd) => {
            const result = spawnSync(command, [...args], { stdio: 'inherit', cwd, shell: process.platform === 'win32' });
            return { status: result.status, error: result.error };
        },
        init: runInit,
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

function refreshGuidance(install: InstallInfo, deps: UpdateDeps): void {
    const root = install.mode === 'local' ? install.root : deps.exists(path.join(deps.cwd, 'package.json')) ? deps.cwd : null;
    if (root === null) return;
    for (const result of deps.init(root)) {
        deps.log(`${INIT_ICONS[result.status]} ${result.file} ${result.status}`);
    }
}
```

`freshLatest` calls `fetchLatestVersion` directly rather than `latestVersion(...force)` so tests with a fake filesystem never touch the real cache directory; the cache write is behind the `writeCache` flag.

- [ ] **Step 5: Amend spec 5.4**

In the spec, reorder 5.4 so `--dry-run` is step 2 and states that it performs no registry request: `With --dry-run: print Would run: <command> (and in <root> for local) and exit 0 without contacting the registry.` The registry check becomes step 3, `--check` step 4, the install step 5.

- [ ] **Step 6: Run tests, build, and commit**

Run: `npx vitest run src/commands/__tests__/update.test.ts && npx vitest run && npm run build`
Expected: PASS, 10 update tests

```bash
git add src/commands/update.ts src/commands/__tests__/update.test.ts src/init/init.ts src/index.ts docs/superpowers/specs/2026-09-06-update-and-version-check-design.md
git commit -m "feat: domain-driver update runs the project's package manager and refreshes guidance"
```

---

### Task 6: CLI wiring, README, version bump, smoke tests

**Files:**
- Modify: `src/index.ts`, `README.md`, `package.json` (version `0.3.0`)

- [ ] **Step 1: Wire the hooks and the command**

In `src/index.ts`:

```ts
import * as os from 'os';
import { runUpdate, defaultUpdateDeps } from './commands/update';
import { checkForUpdate, shouldCheck } from './update/check';
import { currentVersion } from './update/version';
```

Replace the existing `preAction` hook and add a `postAction` hook and the command:

```ts
const SKIP_DETECTION = new Set(['init', 'update']);
let pendingNotice: Promise<string | null> = Promise.resolve(null);

program.hook('preAction', (_thisCommand, actionCommand) => {
    const name = actionCommand.name();
    if (shouldCheck(process.env, process.stdout.isTTY === true, name)) {
        pendingNotice = checkForUpdate({
            env: process.env,
            homedir: os.homedir(),
            now: Date.now,
            fetchImpl: fetch,
            current: currentVersion(),
        });
    }
    if (SKIP_DETECTION.has(name)) return;
    const { stack } = program.opts<{ stack?: string }>();
    console.log(describeStack(detectStack(stack)));
});

program.hook('postAction', async () => {
    const notice = await pendingNotice;
    if (notice !== null) console.log(notice);
});

program
    .command('update')
    .description('Update domain-driver with your package manager, then refresh the agent guidance')
    .option('--dry-run', 'Print the command without running it', false)
    .option('--check', 'Only report whether a newer version exists', false)
    .action(async (options: { dryRun: boolean; check: boolean }) => {
        await runUpdate(options, defaultUpdateDeps());
    });
```

`pendingNotice` is the one piece of mutable module state in the CLI; it exists so the network round trip overlaps the command's work.

- [ ] **Step 2: Bump the version**

In `package.json` set `"version": "0.3.0"`.

- [ ] **Step 3: README**

Add a section `## Updating` immediately before `## Upgrading from 0.1.0`:

````markdown
## Updating

Every command checks the registry at most once a day and, when a newer release exists, prints one line after its output:

```
ℹ️  domain-driver 0.3.0 is available (you have 0.2.0). Run: domain-driver update
```

```bash
domain-driver update            # detects how it was installed, runs your package manager, refreshes the guidance
domain-driver update --dry-run  # show the command it would run
domain-driver update --check    # only report whether a newer version exists
```

Local installs use the package manager the project uses (npm, pnpm, yarn, or bun, from the `packageManager` field or the lockfile). Global installs use `npm install -g`. Running through `npx` needs no update: `npx domain-driver@latest` always fetches the newest.

The check is skipped in CI, when output is not a terminal, or when `DOMAIN_DRIVER_NO_UPDATE_CHECK=1`. The cache lives in `~/.cache/domain-driver` (or `$XDG_CACHE_HOME/domain-driver`).
````

- [ ] **Step 4: Build and smoke-test**

```bash
npm run build
REPO="$(pwd)"
CACHE="$(mktemp -d)"
PROJ="$(mktemp -d)"
cd "$PROJ" && printf '{"name":"smoke","dependencies":{"express":"^5.0.0"}}' > package.json && mkdir src

# 1. Notice appears after the command output when the cache says a newer version exists (fake a TTY with script).
printf '{"latest":"9.9.9","checkedAt":"%s"}' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$CACHE/update-check.json"
DOMAIN_DRIVER_CACHE_DIR="$CACHE" script -q /dev/null node "$REPO/dist/index.js" make:feature cat/Cat | tail -3

# 2. No notice under CI.
CI=1 DOMAIN_DRIVER_CACHE_DIR="$CACHE" script -q /dev/null node "$REPO/dist/index.js" make:types cat/Cat | grep -c "is available" || echo "no notice under CI"

# 3. Version comes from package.json.
node "$REPO/dist/index.js" --version

# 4. update from a real local install: pack, install, dry-run, check.
PACK="$(mktemp -d)"; (cd "$REPO" && npm pack --silent --pack-destination "$PACK")
npm install --silent "$PACK"/domain-driver-*.tgz
./node_modules/.bin/domain-driver update --dry-run
./node_modules/.bin/domain-driver update --check
./node_modules/.bin/domain-driver update
cd "$REPO"
```

Expected:
1. The `make:feature` output ends with `ℹ️  domain-driver 9.9.9 is available (you have 0.3.0). Run: domain-driver update`, after the ✅ lines.
2. `no notice under CI`.
3. `0.3.0`.
4. `Would run: npm install domain-driver@latest in <PROJ>`; then, because 0.3.0 is newer than the registry's 0.2.0, `domain-driver 0.3.0 is already the latest version.` for both `--check` and the plain `update`, with nothing installed.

- [ ] **Step 5: Run everything and commit**

Run: `npx vitest run && npm run build && npm run test:coverage`
Expected: PASS, thresholds met

```bash
git add src/index.ts README.md package.json package-lock.json
git commit -m "feat: version-check notice and update command in the CLI; 0.3.0"
```

---

## Self-review notes

- Spec 3: Task 1. Spec 4.1, 4.2: Task 2. Spec 4.3, 4.5: Task 3. Spec 4.4, 6: Task 6. Spec 5.1, 5.2, 5.3: Task 4. Spec 5.4, 5.5: Task 5. Spec 8: every bullet has a suite in Tasks 1 to 5 plus the smoke test in Task 6.
- Two spec amendments are made inside the plan where the implementation forced them: the ancestor walk for pnpm layouts (Task 4) and `--dry-run` skipping the registry (Task 5).
- Type consistency: `FetchLike` is defined once in `registry.ts` and imported by `check.ts`, `update.ts`, and tests. `InstallInfo.root` is `string | null` and every consumer handles the null. `UpdateDeps.writeCache` exists so the command tests never touch the real cache directory.
