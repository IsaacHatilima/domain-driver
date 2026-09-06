import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { detectInstallMode } from '../install-mode';

const files = (map: Record<string, unknown>) => (filePath: string): string => {
    const key = Object.keys(map).find((candidate) => path.resolve(candidate) === path.resolve(filePath));
    if (key === undefined) throw new Error(`ENOENT ${filePath}`);
    return JSON.stringify(map[key]);
};

const P = (...parts: string[]): string => path.resolve(path.sep, ...parts);

describe('detectInstallMode', () => {
    it('detects npx from the _npx cache path', () => {
        const bin = P('Users', 'me', '.npm', '_npx', 'abc123', 'node_modules', 'domain-driver', 'dist', 'index.js');
        expect(detectInstallMode(bin, files({}))).toEqual({ mode: 'npx', root: null });
    });

    it('detects a local npm install from the project package.json', () => {
        const root = P('work', 'app');
        const bin = path.join(root, 'node_modules', 'domain-driver', 'dist', 'index.js');
        const read = files({ [path.join(root, 'package.json')]: { devDependencies: { 'domain-driver': '^0.2.0' } } });
        expect(detectInstallMode(bin, read)).toEqual({ mode: 'local', root });
    });

    it('walks up through a pnpm store layout to the project root', () => {
        const root = P('work', 'app');
        const bin = path.join(root, 'node_modules', '.pnpm', 'domain-driver@0.2.0', 'node_modules', 'domain-driver', 'dist', 'index.js');
        const read = files({ [path.join(root, 'package.json')]: { dependencies: { 'domain-driver': '0.2.0' } } });
        expect(detectInstallMode(bin, read)).toEqual({ mode: 'local', root });
    });

    it('is global when the install root has no package.json', () => {
        const bin = P('usr', 'local', 'lib', 'node_modules', 'domain-driver', 'dist', 'index.js');
        expect(detectInstallMode(bin, files({}))).toEqual({ mode: 'global', root: null });
    });

    it('is global when the nearest package.json does not depend on domain-driver', () => {
        const root = P('work', 'app');
        const bin = path.join(root, 'node_modules', 'domain-driver', 'dist', 'index.js');
        const read = files({ [path.join(root, 'package.json')]: { dependencies: { react: '19' } } });
        expect(detectInstallMode(bin, read)).toEqual({ mode: 'global', root: null });
    });

    it('is global when there is no node_modules segment at all', () => {
        expect(detectInstallMode(P('repo', 'dist', 'index.js'), files({}))).toEqual({ mode: 'global', root: null });
    });
});
