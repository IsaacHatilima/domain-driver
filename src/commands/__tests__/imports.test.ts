import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { makeFeature } from '../feature';
import { resetAliasCache } from '../../utils';

let testDir: string;
let originalCwd: string;

function readFile(relativePath: string): string {
    return fs.readFileSync(path.join(testDir, 'app', relativePath), 'utf-8');
}

function cleanup(): void {
    process.chdir(originalCwd);
    resetAliasCache();
    if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
}

describe('inter-layer imports (no alias)', () => {
    beforeEach(async () => {
        originalCwd = process.cwd();
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-imports-'));
        process.chdir(testDir);
        resetAliasCache();
        await makeFeature('coffee-type', true);
    });
    afterEach(cleanup);

    it('types file is created with interface', () => {
        const content = readFile('coffee-type/types/CoffeeType.types.ts');
        expect(content).toContain('export interface CoffeeType');
        expect(content).toContain('id: string');
    });

    it('container imports hook and component with relative paths', () => {
        const content = readFile('coffee-type/containers/CoffeeTypeContainer.tsx');
        expect(content).toContain("from '../hooks/useCoffeeType'");
        expect(content).toContain("from '../components/client/CoffeeType'");
    });

    it('hook imports type, services, and schemas with relative paths', () => {
        const content = readFile('coffee-type/hooks/useCoffeeType.ts');
        expect(content).toContain("import { CoffeeType } from '../types/CoffeeType.types'");
        expect(content).toContain("from '../services/ListCoffeeType.service'");
        expect(content).toContain("from '../schemas/CreateCoffeeType.schema'");
    });

    it('services import type and repositories with relative paths', () => {
        const content = readFile('coffee-type/services/CreateCoffeeType.service.ts');
        expect(content).toContain("import { CoffeeType } from '../types/CoffeeType.types'");
        expect(content).toContain("from '../repositories/CreateCoffeeType.repository'");
    });

    it('repositories import type and schema types', () => {
        const create = readFile('coffee-type/repositories/CreateCoffeeType.repository.ts');
        expect(create).toContain("import { CoffeeType } from '../types/CoffeeType.types'");
        expect(create).toContain("from '../schemas/CreateCoffeeType.schema'");

        const list = readFile('coffee-type/repositories/ListCoffeeType.repository.ts');
        expect(list).toContain("import { CoffeeType } from '../types/CoffeeType.types'");
    });

    it('delete repository has no schema import but has type import', () => {
        const del = readFile('coffee-type/repositories/DeleteCoffeeType.repository.ts');
        expect(del).not.toContain('import');
    });
});

describe('inter-layer imports (with @/ alias)', () => {
    beforeEach(async () => {
        originalCwd = process.cwd();
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-alias-imports-'));
        process.chdir(testDir);
        resetAliasCache();

        fs.writeFileSync(
            path.join(testDir, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: {
                    paths: { '@/*': ['./app/*'] },
                },
            })
        );

        await makeFeature('coffee-type', true);
    });
    afterEach(cleanup);

    it('container imports use @/ alias', () => {
        const content = readFile('coffee-type/containers/CoffeeTypeContainer.tsx');
        expect(content).toContain("from '@/app/coffee-type/hooks/useCoffeeType'");
        expect(content).toContain("from '@/app/coffee-type/components/client/CoffeeType'");
    });

    it('hook imports use @/ alias', () => {
        const content = readFile('coffee-type/hooks/useCoffeeType.ts');
        expect(content).toContain("from '@/app/coffee-type/types/CoffeeType.types'");
        expect(content).toContain("from '@/app/coffee-type/services/ListCoffeeType.service'");
    });

    it('services import repositories with @/ alias', () => {
        const content = readFile('coffee-type/services/CreateCoffeeType.service.ts');
        expect(content).toContain("from '@/app/coffee-type/types/CoffeeType.types'");
        expect(content).toContain("from '@/app/coffee-type/repositories/CreateCoffeeType.repository'");
    });

    it('page imports container with @/ alias', () => {
        const content = readFile('coffee-type/page.tsx');
        expect(content).toContain("from '@/app/coffee-type/containers/CoffeeTypeContainer'");
    });
});
