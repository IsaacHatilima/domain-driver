import { createRequire } from 'module';
import * as path from 'path';

export type PrettierOptions = Readonly<Record<string, unknown>>;

export interface FileInfo {
    readonly ignored: boolean;
    readonly inferredParser: string | null;
}

/**
 * The part of Prettier's API formatting uses. Prettier 3's CommonJS entry makes every call async;
 * Prettier 2's `format` is sync. Awaiting each call covers both.
 */
export interface PrettierApi {
    resolveConfigFile(filePath: string): Promise<string | null>;
    resolveConfig(filePath: string, options?: PrettierOptions): Promise<PrettierOptions | null>;
    getFileInfo(filePath: string, options?: PrettierOptions): Promise<FileInfo>;
    format(source: string, options: PrettierOptions): string | Promise<string>;
}

export type PrettierLoader = (cwd: string) => PrettierApi | null;

const API: readonly (keyof PrettierApi)[] = ['resolveConfigFile', 'resolveConfig', 'getFileInfo', 'format'];

/**
 * Borrows the project's own Prettier, resolved from its package.json, so files come out in the
 * version and style the project checks against. domain-driver ships none.
 *
 * Returns null when the project has no Prettier, which is not an error: the files stay as
 * generated. Throws when one resolves but cannot be used, which the caller reports.
 */
export function loadPrettier(cwd: string): PrettierApi | null {
    const projectRequire = createRequire(path.join(cwd, 'package.json'));
    let resolved: string;
    try {
        resolved = projectRequire.resolve('prettier');
    } catch {
        return null;
    }
    const candidate: unknown = projectRequire(resolved);
    if (!isPrettier(candidate)) {
        throw new Error(`the prettier at ${resolved} does not export ${API.join(', ')}`);
    }
    return candidate;
}

function isPrettier(candidate: unknown): candidate is PrettierApi {
    if (typeof candidate !== 'object' || candidate === null) return false;
    const api = candidate as Record<string, unknown>;
    return API.every((name) => typeof api[name] === 'function');
}
