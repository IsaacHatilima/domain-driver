import * as path from 'path';

export type InstallMode = 'local' | 'global' | 'npx' | 'unknown';

export interface InstallInfo {
    readonly mode: InstallMode;
    readonly root: string | null;
}

type ReadFile = (filePath: string) => string;

const MAX_ANCESTORS = 6;

export function detectInstallMode(binPath: string, readFile: ReadFile): InstallInfo {
    const segments = binPath.split(path.sep);
    const index = findInstallIndex(segments);
    if (index === null) return Object.freeze({ mode: 'global', root: null });
    // npx unpacks into <cache>/_npx/<hash>/node_modules/domain-driver, so _npx sits three segments before the package.
    if (segments[index - 3] === '_npx') return Object.freeze({ mode: 'npx', root: null });

    const installRoot = rootFrom(segments, index);
    const projectRoot = findProjectRoot(installRoot, readFile);
    if (projectRoot !== null) return Object.freeze({ mode: 'local', root: projectRoot });
    return hasPackageJson(installRoot, readFile)
        ? Object.freeze({ mode: 'unknown', root: installRoot })
        : Object.freeze({ mode: 'global', root: null });
}

function findInstallIndex(segments: readonly string[]): number | null {
    for (let index = segments.length - 1; index > 0; index -= 1) {
        if (segments[index - 1] === 'node_modules' && segments[index] === 'domain-driver') return index;
    }
    return null;
}

function rootFrom(segments: readonly string[], index: number): string {
    const root = segments.slice(0, index - 1).join(path.sep);
    return root === '' ? path.sep : root;
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

function hasPackageJson(root: string, readFile: ReadFile): boolean {
    try {
        readFile(path.join(root, 'package.json'));
        return true;
    } catch {
        return false;
    }
}
