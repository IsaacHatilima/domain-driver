import * as fs from 'fs';
import * as path from 'path';

export function toPascalCase(name: string): string {
    return name
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

export function featureBasePath(feature: string): string {
    return path.join(process.cwd(), 'app', feature);
}

export function ensureFeatureExists(feature: string, subdir: string): string {
    const base = path.join(featureBasePath(feature), subdir);

    if (!fs.existsSync(base)) {
        throw new Error(
            `Feature "${feature}" does not exist. Run: domain-driver make:feature ${feature}`
        );
    }

    return base;
}

export function writeFileSafe(filePath: string, content: string): void {
    try {
        fs.writeFileSync(filePath, content);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to write ${filePath}: ${message}`);
    }
}

export function mkdirSafe(dirPath: string): void {
    try {
        fs.mkdirSync(dirPath, { recursive: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to create directory ${dirPath}: ${message}`);
    }
}

export function fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
}

interface AliasConfig {
    alias: string | null;
    appDir: string;
}

let cachedAlias: AliasConfig | undefined;

export function detectAlias(): AliasConfig {
    if (cachedAlias) return cachedAlias;

    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');

    if (!fs.existsSync(tsconfigPath)) {
        cachedAlias = { alias: null, appDir: 'app' };
        return cachedAlias;
    }

    try {
        const raw = fs.readFileSync(tsconfigPath, 'utf-8');
        const stripped = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        const tsconfig = JSON.parse(stripped);
        const paths = tsconfig?.compilerOptions?.paths;

        if (paths) {
            for (const [key, values] of Object.entries(paths)) {
                const targets = values as string[];
                const hasAppMapping = targets.some(
                    (v) => v === './app/*' || v === 'app/*' || v === './src/app/*' || v === 'src/app/*'
                );
                if (hasAppMapping && key.endsWith('/*')) {
                    const prefix = key.slice(0, -1);
                    const appDir = targets[0].replace('/*', '').replace('./', '');
                    cachedAlias = { alias: prefix, appDir };
                    return cachedAlias;
                }

                const hasSrcMapping = targets.some(
                    (v) => v === './src/*' || v === 'src/*' || v === './*'
                );
                if (hasSrcMapping && key.endsWith('/*')) {
                    const prefix = key.slice(0, -1);
                    cachedAlias = { alias: prefix, appDir: 'app' };
                    return cachedAlias;
                }
            }
        }
    } catch {
        // tsconfig parse failed, fall back to relative imports
    }

    cachedAlias = { alias: null, appDir: 'app' };
    return cachedAlias;
}

export function resetAliasCache(): void {
    cachedAlias = undefined;
}

export function resolveImport(fromFeature: string, relativePath: string, fromRoot: boolean = false): string {
    const { alias } = detectAlias();

    if (alias) {
        return `${alias}app/${fromFeature}/${relativePath}`;
    }

    return fromRoot ? `./${relativePath}` : `../${relativePath}`;
}
