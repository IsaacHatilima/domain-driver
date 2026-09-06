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
