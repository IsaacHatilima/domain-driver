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
