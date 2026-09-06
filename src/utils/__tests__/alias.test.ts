import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { detectAlias, resetAliasCache } from '../alias';
import { createTempProject, writeTsconfig, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('alias');
});

afterEach(() => project.cleanup());

describe('detectAlias', () => {
    it('returns null without a tsconfig', () => {
        expect(detectAlias()).toBeNull();
    });

    it('maps @/* to the project root', () => {
        writeTsconfig({ '@/*': ['./*'] });
        expect(detectAlias()).toEqual({ prefix: '@/', root: '.' });
    });

    it('maps @/* to src', () => {
        writeTsconfig({ '@/*': ['./src/*'] });
        expect(detectAlias()).toEqual({ prefix: '@/', root: 'src' });
    });

    it('maps a custom prefix to app', () => {
        writeTsconfig({ '~/*': ['./app/*'] });
        expect(detectAlias()).toEqual({ prefix: '~/', root: 'app' });
    });

    it('accepts targets without the leading ./', () => {
        writeTsconfig({ '@/*': ['src/*'] });
        expect(detectAlias()).toEqual({ prefix: '@/', root: 'src' });
    });

    it('accepts nested roots', () => {
        writeTsconfig({ '@/*': ['./src/app/*'] });
        expect(detectAlias()).toEqual({ prefix: '@/', root: 'src/app' });
    });

    it('takes the first wildcard entry', () => {
        writeTsconfig({ '@components/*': ['./components/*'], '@/*': ['./*'] });
        expect(detectAlias()).toEqual({ prefix: '@components/', root: 'components' });
    });

    it('ignores keys without a wildcard', () => {
        writeTsconfig({ '@config': ['./config.ts'] });
        expect(detectAlias()).toBeNull();
    });

    it('tolerates comments in tsconfig', () => {
        fs.writeFileSync(
            'tsconfig.json',
            '{\n  // comment\n  "compilerOptions": { /* block */ "paths": { "@/*": ["./*"] } }\n}'
        );
        expect(detectAlias()).toEqual({ prefix: '@/', root: '.' });
    });

    it('returns null on malformed tsconfig', () => {
        fs.writeFileSync('tsconfig.json', '{ nope');
        expect(detectAlias()).toBeNull();
    });

    it('caches until reset', () => {
        expect(detectAlias()).toBeNull();
        writeTsconfig({ '@/*': ['./*'] });
        expect(detectAlias()).toBeNull();
        resetAliasCache();
        expect(detectAlias()).toEqual({ prefix: '@/', root: '.' });
    });
});
