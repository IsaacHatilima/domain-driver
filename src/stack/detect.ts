import * as fs from 'fs';
import * as path from 'path';
import { isDirectory } from '../utils/fs';
import {
    DetectedStack,
    HttpFramework,
    HTTP_FRAMEWORKS,
    StackName,
    STACK_NAMES,
    isStackName,
} from './types';

const API_DIRS = ['app/api', 'src/app/api', 'pages/api', 'src/pages/api'] as const;

interface PackageJson {
    readonly dependencies?: Record<string, string>;
    readonly devDependencies?: Record<string, string>;
}

let cached: DetectedStack | undefined;

export function resetStackCache(): void {
    cached = undefined;
}

export function detectStack(override?: string): DetectedStack {
    if (cached) return cached;

    const cwd = process.cwd();
    const overridden = override !== undefined;
    const deps = readDependencies(cwd, overridden);
    const stack = overridden ? parseOverride(override) : inferStack(cwd, deps);

    const result: DetectedStack = Object.freeze({
        stack,
        source: overridden ? 'override' : 'detected',
        httpFramework: stack === 'node' ? detectHttpFramework(deps) : null,
        featureRoot: resolveFeatureRoot(cwd, stack),
        hasNestjsZod: deps.has('nestjs-zod'),
    });

    cached = result;
    return result;
}

export function describeStack(stack: DetectedStack): string {
    const base = `Stack: ${stack.stack} (${stack.source})`;
    if (stack.stack !== 'node') return base;
    return `${base}, http: ${stack.httpFramework ?? 'none'}`;
}

function readDependencies(cwd: string, optional: boolean): ReadonlySet<string> {
    const pkgPath = path.join(cwd, 'package.json');

    if (!fs.existsSync(pkgPath)) {
        if (optional) return new Set();
        throw new Error(
            `No package.json found in ${cwd}. Run domain-driver from your project root, or pass --stack <name>.`
        );
    }

    const pkg = parsePackageJson(pkgPath);
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
    if (deps.has('next')) return hasApiDir(cwd) ? 'next-fullstack' : 'next-frontend';
    if (deps.has('react')) return 'react';
    return 'node';
}

function hasApiDir(cwd: string): boolean {
    return API_DIRS.some((dir) => isDirectory(path.join(cwd, dir)));
}

function detectHttpFramework(deps: ReadonlySet<string>): HttpFramework | null {
    return HTTP_FRAMEWORKS.find((name) => deps.has(name)) ?? null;
}

function resolveFeatureRoot(cwd: string, stack: StackName): string {
    switch (stack) {
        case 'next-fullstack':
        case 'next-frontend':
            return isDirectory(path.join(cwd, 'src', 'app')) ? 'src/app' : 'app';
        case 'react':
        case 'node':
            return isDirectory(path.join(cwd, 'src')) ? 'src/features' : 'features';
        case 'nest':
            return 'src';
    }
}
