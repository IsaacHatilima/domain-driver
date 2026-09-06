import * as fs from 'fs';
import * as path from 'path';

export interface AliasConfig {
    readonly prefix: string;
    readonly root: string;
}

interface TsConfig {
    readonly compilerOptions?: {
        readonly paths?: Record<string, string[]>;
    };
}

const WILDCARD_TARGET = /^(?:\.\/)?(.*?)\/?\*$/;

let cached: AliasConfig | null | undefined;

export function resetAliasCache(): void {
    cached = undefined;
}

export function detectAlias(): AliasConfig | null {
    if (cached !== undefined) return cached;
    cached = readAlias(path.join(process.cwd(), 'tsconfig.json'));
    return cached;
}

function readAlias(tsconfigPath: string): AliasConfig | null {
    if (!fs.existsSync(tsconfigPath)) return null;

    try {
        const raw = fs.readFileSync(tsconfigPath, 'utf-8');
        const stripped = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        const tsconfig = JSON.parse(stripped) as TsConfig;
        return findWildcardAlias(tsconfig.compilerOptions?.paths ?? {});
    } catch {
        return null;
    }
}

function findWildcardAlias(paths: Record<string, string[]>): AliasConfig | null {
    for (const [key, targets] of Object.entries(paths)) {
        if (!key.endsWith('/*')) continue;
        const root = targets.map(aliasRoot).find((candidate) => candidate !== null);
        if (root !== undefined && root !== null) {
            return Object.freeze({ prefix: key.slice(0, -1), root });
        }
    }
    return null;
}

function aliasRoot(target: string): string | null {
    const match = WILDCARD_TARGET.exec(target);
    if (!match) return null;
    return match[1] === '' ? '.' : match[1];
}
