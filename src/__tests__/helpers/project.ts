import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resetStackCache } from '../../stack/detect';
import { resetAliasCache } from '../../utils/alias';
import { resetHints } from '../../commands/hints';

export interface TempProject {
    readonly dir: string;
    readonly cleanup: () => void;
}

export function resetCaches(): void {
    resetStackCache();
    resetAliasCache();
    resetHints();
}

export function createTempProject(prefix: string): TempProject {
    const originalCwd = process.cwd();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `dd-${prefix}-`));
    process.chdir(dir);
    resetCaches();
    return Object.freeze({
        dir,
        cleanup: () => {
            process.chdir(originalCwd);
            resetCaches();
            fs.rmSync(dir, { recursive: true, force: true });
        },
    });
}

export function writePackageJson(
    dependencies: Record<string, string>,
    devDependencies: Record<string, string> = {}
): void {
    const content = JSON.stringify(
        { name: 'fixture', version: '0.0.0', dependencies, devDependencies },
        null,
        2
    );
    fs.writeFileSync(path.join(process.cwd(), 'package.json'), content);
}

export function writeTsconfig(paths: Record<string, string[]>): void {
    fs.writeFileSync(
        path.join(process.cwd(), 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { paths } }, null, 2)
    );
}

export function mkdir(relative: string): void {
    fs.mkdirSync(path.join(process.cwd(), relative), { recursive: true });
}

export function readProjectFile(relative: string): string {
    return fs.readFileSync(path.join(process.cwd(), relative), 'utf-8');
}

export function projectFileExists(relative: string): boolean {
    return fs.existsSync(path.join(process.cwd(), relative));
}

export function listFiles(relativeRoot: string): string[] {
    const root = path.join(process.cwd(), relativeRoot);
    const walk = (dir: string): string[] =>
        fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) return walk(full);
            return [path.relative(root, full).split(path.sep).join('/')];
        });
    return walk(root).sort();
}
