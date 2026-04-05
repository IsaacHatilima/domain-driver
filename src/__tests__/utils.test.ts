import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { toPascalCase, detectAlias, resolveImport, resetAliasCache } from '../utils';

describe('toPascalCase', () => {
    it('converts kebab-case to PascalCase', () => {
        expect(toPascalCase('coffee-type')).toBe('CoffeeType');
    });

    it('handles single word', () => {
        expect(toPascalCase('user')).toBe('User');
    });

    it('handles multiple hyphens', () => {
        expect(toPascalCase('my-long-feature-name')).toBe('MyLongFeatureName');
    });
});

describe('detectAlias', () => {
    let testDir: string;
    let originalCwd: string;

    beforeEach(() => {
        originalCwd = process.cwd();
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-alias-'));
        process.chdir(testDir);
        resetAliasCache();
    });

    afterEach(() => {
        process.chdir(originalCwd);
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('returns null alias when no tsconfig exists', () => {
        const result = detectAlias();
        expect(result.alias).toBeNull();
    });

    it('detects @/ alias mapping to ./app/*', () => {
        fs.writeFileSync(
            path.join(testDir, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: {
                    paths: { '@/*': ['./app/*'] },
                },
            })
        );
        const result = detectAlias();
        expect(result.alias).toBe('@/');
    });

    it('detects @/ alias mapping to ./src/*', () => {
        fs.writeFileSync(
            path.join(testDir, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: {
                    paths: { '@/*': ['./src/*'] },
                },
            })
        );
        const result = detectAlias();
        expect(result.alias).toBe('@/');
    });

    it('detects custom alias like ~/*', () => {
        fs.writeFileSync(
            path.join(testDir, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: {
                    paths: { '~/*': ['./app/*'] },
                },
            })
        );
        const result = detectAlias();
        expect(result.alias).toBe('~/');
    });

    it('returns null when paths has no matching pattern', () => {
        fs.writeFileSync(
            path.join(testDir, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: {
                    paths: { '@components/*': ['./components/*'] },
                },
            })
        );
        const result = detectAlias();
        expect(result.alias).toBeNull();
    });
});

describe('resolveImport', () => {
    let testDir: string;
    let originalCwd: string;

    beforeEach(() => {
        originalCwd = process.cwd();
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-resolve-'));
        process.chdir(testDir);
        resetAliasCache();
    });

    afterEach(() => {
        process.chdir(originalCwd);
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('uses relative path when no alias', () => {
        const result = resolveImport('coffee-type', 'hooks/useCoffeeType');
        expect(result).toBe('../hooks/useCoffeeType');
    });

    it('uses alias path when @/ alias exists', () => {
        fs.writeFileSync(
            path.join(testDir, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: {
                    paths: { '@/*': ['./app/*'] },
                },
            })
        );
        const result = resolveImport('coffee-type', 'hooks/useCoffeeType');
        expect(result).toBe('@/app/coffee-type/hooks/useCoffeeType');
    });
});
