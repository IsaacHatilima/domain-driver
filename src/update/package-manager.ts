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
