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

    it('selects the invoking frontend when pnpm shares its executable with the workspace root', () => {
        const root = P('work', 'monorepo');
        const frontend = path.join(root, 'frontend');
        const bin = path.join(root, 'node_modules', '.pnpm', 'domain-driver@0.8.0', 'node_modules', 'domain-driver', 'dist', 'index.js');
        const read = files({
            [path.join(root, 'package.json')]: { devDependencies: { 'domain-driver': '0.8.0' } },
            [path.join(frontend, 'package.json')]: { devDependencies: { 'domain-driver': '0.8.0' } },
        });
        const realpath = (file: string): string => file === path.join(frontend, 'node_modules', 'domain-driver', 'dist', 'index.js') ? bin : file;
        expect(detectInstallMode(bin, read, { cwd: path.join(frontend, 'src'), realpath })).toEqual({ mode: 'local', root: frontend });
    });

    it('does not select a project dependency when the running executable is global', () => {
        const root = P('work', 'app');
        const bin = P('usr', 'local', 'lib', 'node_modules', 'domain-driver', 'dist', 'index.js');
        const read = files({ [path.join(root, 'package.json')]: { devDependencies: { 'domain-driver': '0.8.0' } } });
        expect(detectInstallMode(bin, read, { cwd: root, realpath: file => file })).toEqual({ mode: 'global', root: null });
    });

    it('is global when the install root has no package.json', () => {
        const bin = P('usr', 'local', 'lib', 'node_modules', 'domain-driver', 'dist', 'index.js');
        expect(detectInstallMode(bin, files({}))).toEqual({ mode: 'global', root: null });
    });

    it('is unknown with the root for a hoisted workspace root without the dependency', () => {
        const root = P('work', 'monorepo');
        const bin = path.join(root, 'node_modules', 'domain-driver', 'dist', 'index.js');
        const read = files({ [path.join(root, 'package.json')]: { workspaces: ['packages/*'] } });
        expect(detectInstallMode(bin, read)).toEqual({ mode: 'unknown', root });
    });

    // Only <cache>/_npx/<hash>/node_modules/domain-driver is npx: _npx anywhere else in the path is not.
    it('is not npx when a directory named _npx sits elsewhere in the path', () => {
        const root = P('work', '_npx', 'projects', 'app');
        const bin = path.join(root, 'node_modules', 'domain-driver', 'dist', 'index.js');
        const read = files({ [path.join(root, 'package.json')]: { dependencies: { 'domain-driver': '0.3.0' } } });
        expect(detectInstallMode(bin, read)).toEqual({ mode: 'local', root });
    });

    it('is global when there is no node_modules segment at all', () => {
        expect(detectInstallMode(P('repo', 'dist', 'index.js'), files({}))).toEqual({ mode: 'global', root: null });
    });
});
