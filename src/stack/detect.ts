import * as fs from 'fs';
import * as path from 'path';
import { isDirectory } from '../utils/fs';
import {
    DetectedStack,
    HttpFramework,
    HTTP_FRAMEWORKS,
    RootSource,
    StackName,
    STACK_NAMES,
    isStackName,
} from './types';

const API_DIRS = ['app/api', 'src/app/api', 'pages/api', 'src/pages/api'] as const;

const APP_DIRS = ['app', 'src/app'] as const;

/**
 * Packages that only make sense on a server: a Next app that depends on one reads and writes data
 * itself, through Server Components and Server Actions, even when it has no `app/api` folder.
 */
const SERVER_DATA_DEPENDENCIES = [
    'drizzle-orm',
    '@prisma/client',
    'prisma',
    'pg',
    'postgres',
    'mysql2',
    'better-sqlite3',
    '@libsql/client',
    'kysely',
    'mongoose',
] as const;

const SERVER_FOLDER = 'server';

interface PackageJson {
    readonly dependencies?: Record<string, string>;
    readonly devDependencies?: Record<string, string>;
    readonly domainDriver?: {
        readonly featureRoot?: unknown;
        readonly rootModule?: unknown;
        readonly autoRegister?: unknown;
    };
}

const ROOT_LABELS: Readonly<Record<RootSource, string>> = Object.freeze({
    detected: '',
    flag: ' (--root)',
    config: ' (package.json)',
});

let cached: DetectedStack | undefined;

export function resetStackCache(): void {
    cached = undefined;
}

export interface DetectOptions {
    readonly stack?: string;
    readonly root?: string;
    readonly autoRegister?: boolean;
}

export function detectStack(options: DetectOptions = {}): DetectedStack {
    if (cached) return cached;

    const cwd = process.cwd();
    const override = options.stack;
    const overridden = override !== undefined;
    const pkg = readPackageJson(cwd, overridden);
    const deps = dependencyNames(pkg);
    const stack = overridden ? parseOverride(override) : inferStack(cwd, deps);
    const root = resolveRoot(cwd, stack, pkg, options.root);

    const result: DetectedStack = Object.freeze({
        stack,
        source: overridden ? 'override' : 'detected',
        httpFramework: stack === 'node' ? detectHttpFramework(deps) : null,
        featureRoot: root.featureRoot,
        featureRootSource: root.source,
        apiRoot: apiRoot(cwd),
        hasNestjsZod: deps.has('nestjs-zod'),
        rootModule: configuredRootModule(pkg),
        autoRegister: options.autoRegister ?? configuredAutoRegister(pkg),
    });

    cached = result;
    return result;
}

export function describeStack(stack: DetectedStack): string {
    const base = `Stack: ${stack.stack} (${stack.source})`;
    const http = stack.stack === 'node' ? `, http: ${stack.httpFramework ?? 'none'}` : '';
    return `${base}${http}, root: ${stack.featureRoot}${ROOT_LABELS[stack.featureRootSource]}`;
}

function readPackageJson(cwd: string, optional: boolean): PackageJson {
    const pkgPath = path.join(cwd, 'package.json');

    if (!fs.existsSync(pkgPath)) {
        if (optional) return {};
        throw new Error(
            `No package.json found in ${cwd}. Run domain-driver from your project root, or pass --stack <name>.`
        );
    }
    return parsePackageJson(pkgPath);
}

function dependencyNames(pkg: PackageJson): ReadonlySet<string> {
    return new Set([
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.devDependencies ?? {}),
    ]);
}

function parsePackageJson(pkgPath: string): PackageJson {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return (parsed ?? {}) as PackageJson;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Could not parse package.json: ${message}`);
    }
}

function parseOverride(value: string): StackName {
    if (isStackName(value)) return value;
    throw new Error(`Unknown stack "${value}". Valid stacks: ${STACK_NAMES.join(', ')}.`);
}

function inferStack(cwd: string, deps: ReadonlySet<string>): StackName {
    if (deps.has('@nestjs/core')) return 'nest';
    if (deps.has('@tanstack/react-start')) return 'tanstack-start';
    if (deps.has('next')) return isFullstackNext(cwd, deps) ? 'next-fullstack' : 'next-frontend';
    if (deps.has('react')) return 'react';
    return 'node';
}

/**
 * A Next app owns a server side when it has route handlers, depends on a database client, or keeps
 * server code in a feature's `server/` folder. A Server Actions app often has only the last two.
 */
function isFullstackNext(cwd: string, deps: ReadonlySet<string>): boolean {
    return (
        hasApiDir(cwd) ||
        SERVER_DATA_DEPENDENCIES.some((name) => deps.has(name)) ||
        APP_DIRS.some((dir) => containsServerFolder(path.join(cwd, dir)))
    );
}

/** Whether `dir` or any folder below it holds a folder named `server`. Symlinks are not followed. */
function containsServerFolder(dir: string): boolean {
    if (!isDirectory(dir)) return false;
    const folders = fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    return folders.some(
        (entry) => entry.name === SERVER_FOLDER || containsServerFolder(path.join(dir, entry.name))
    );
}

/**
 * The app directory's own `api` folder. Route handlers live here whatever the
 * feature root is, because Next derives their URL from this path.
 */
function apiRoot(cwd: string): string {
    return isDirectory(path.join(cwd, 'src', 'app')) ? 'src/app/api' : 'app/api';
}

function hasApiDir(cwd: string): boolean {
    return API_DIRS.some((dir) => isDirectory(path.join(cwd, dir)));
}

function detectHttpFramework(deps: ReadonlySet<string>): HttpFramework | null {
    return HTTP_FRAMEWORKS.find((name) => deps.has(name)) ?? null;
}

interface ResolvedRoot {
    readonly featureRoot: string;
    readonly source: RootSource;
}

function resolveRoot(
    cwd: string,
    stack: StackName,
    pkg: PackageJson,
    flag: string | undefined
): ResolvedRoot {
    if (flag !== undefined) {
        return { featureRoot: validateRoot(flag, '--root'), source: 'flag' };
    }
    const configured = configuredRoot(pkg);
    if (configured !== null) {
        return { featureRoot: configured, source: 'config' };
    }
    return { featureRoot: conventionalRoot(cwd, stack), source: 'detected' };
}

function configuredRootModule(pkg: PackageJson): string | null {
    const value = pkg.domainDriver?.rootModule;
    if (value === undefined) return null;
    if (typeof value !== 'string') {
        throw new Error(
            'package.json "domainDriver.rootModule" must be a string, for example "src/app.module.ts".'
        );
    }
    return validateRoot(value, 'package.json');
}

function configuredAutoRegister(pkg: PackageJson): boolean {
    const value = pkg.domainDriver?.autoRegister;
    if (value === undefined) return true;
    if (typeof value !== 'boolean') {
        throw new Error('package.json "domainDriver.autoRegister" must be true or false.');
    }
    return value;
}

function configuredRoot(pkg: PackageJson): string | null {
    const value = pkg.domainDriver?.featureRoot;
    if (value === undefined) return null;
    if (typeof value !== 'string') {
        throw new Error(
            'package.json "domainDriver.featureRoot" must be a string, for example "src/features".'
        );
    }
    return validateRoot(value, 'package.json');
}

/**
 * The root becomes a filesystem path under the project, so an absolute path or any
 * `..` segment would write outside it. Both are rejected rather than normalised away.
 */
function validateRoot(value: string, source: string): string {
    const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '');
    const escapes = normalized === '' || path.isAbsolute(value) || normalized.split('/').includes('..');
    if (escapes) {
        throw new Error(
            `Feature root "${value}" from ${source} must be a relative path inside the project, for example src/features.`
        );
    }
    return normalized;
}

function conventionalRoot(cwd: string, stack: StackName): string {
    switch (stack) {
        case 'next-fullstack':
        case 'next-frontend':
            return isDirectory(path.join(cwd, 'src', 'app')) ? 'src/app' : 'app';
        case 'react':
        case 'node':
            return isDirectory(path.join(cwd, 'src')) ? 'src/features' : 'features';
        case 'nest':
            return isDirectory(path.join(cwd, 'src', 'features')) ? 'src/features' : 'src';
        case 'tanstack-start':
            if (isDirectory(path.join(cwd, 'src', 'routes'))) return 'src/routes';
            return isDirectory(path.join(cwd, 'routes')) ? 'routes' : 'src/routes';
    }
}
