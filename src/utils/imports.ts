import * as path from 'path';
import { detectAlias } from './alias';

export function resolveImport(fromFile: string, toFile: string): string {
    const target = stripExtension(toFile);
    const aliased = aliasImport(target);
    if (aliased !== null) return aliased;

    const relative = toPosix(path.relative(path.dirname(fromFile), target));
    return relative.startsWith('.') ? relative : `./${relative}`;
}

function aliasImport(target: string): string | null {
    const alias = detectAlias();
    if (!alias) return null;

    const rootAbs = path.resolve(process.cwd(), alias.root);
    const relative = path.relative(rootAbs, target);
    const inside = relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
    return inside ? `${alias.prefix}${toPosix(relative)}` : null;
}

function stripExtension(file: string): string {
    return file.replace(/\.tsx?$/, '');
}

function toPosix(target: string): string {
    return target.split(path.sep).join('/');
}
