import * as fs from 'fs';
import * as path from 'path';
import { loadTypeScript } from '../nest/typescript';
import { detectAlias } from './alias';

export function resolveImport(fromFile: string, toFile: string): string {
    const target = stripExtension(toFile);
    if (nodeEsm(fromFile)) {
        const runtimeTarget = target.endsWith('.js') ? target : `${target}.js`;
        const relative = toPosix(path.relative(path.dirname(fromFile), runtimeTarget));
        return relative.startsWith('.') ? relative : `./${relative}`;
    }
    const aliased = aliasImport(target);
    if (aliased !== null) return aliased;

    const relative = toPosix(path.relative(path.dirname(fromFile), target));
    return relative.startsWith('.') ? relative : `./${relative}`;
}

/** Node ESM needs runtime extensions; bundlers continue using project aliases. */
function nodeEsm(fromFile: string): boolean {
    const ts = loadTypeScript(process.cwd());
    if (ts === null) return false;
    const configPath = ts.findConfigFile(path.dirname(fromFile), ts.sys.fileExists);
    if (configPath === undefined) return false;
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    if (config.error) return false;
    const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
    const nodeResolution = options.moduleResolution === ts.ModuleResolutionKind.Node16 || options.moduleResolution === ts.ModuleResolutionKind.NodeNext;
    const nodeModule = options.module === ts.ModuleKind.Node16 || options.module === ts.ModuleKind.NodeNext;
    if (!nodeResolution && !nodeModule) return false;
    let directory = path.dirname(fromFile);
    while (true) {
        const manifest = path.join(directory, 'package.json');
        if (fs.existsSync(manifest)) {
            const pkg: unknown = JSON.parse(fs.readFileSync(manifest, 'utf8'));
            return pkg !== null && typeof pkg === 'object' && 'type' in pkg && pkg.type === 'module';
        }
        const parent = path.dirname(directory);
        if (parent === directory) return false;
        directory = parent;
    }
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
