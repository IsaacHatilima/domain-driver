import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { makeFeature } from '../feature';
import { makeComponent } from '../component';
import { makeContainer } from '../container';
import { makeHook } from '../hook';
import { makeService } from '../service';
import { makeRepository } from '../repository';
import { makeSchema } from '../schema';
import { resetAliasCache } from '../../utils';

let testDir: string;
let originalCwd: string;

function cleanup(): void {
    process.chdir(originalCwd);
    resetAliasCache();
    if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
}

describe('individual commands on existing feature', () => {
    beforeEach(async () => {
        originalCwd = process.cwd();
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-individual-'));
        process.chdir(testDir);
        resetAliasCache();
        await makeFeature('test-feature', false);
    });
    afterEach(cleanup);

    it('make:component creates client component by default', () => {
        makeComponent('test-feature', 'MyButton', 'client');
        const content = fs.readFileSync(
            path.join(testDir, 'app/test-feature/components/client/MyButton.tsx'),
            'utf-8'
        );
        expect(content).toContain("'use client'");
        expect(content).toContain('export default function MyButton');
        expect(content).toContain('interface MyButtonProps');
    });

    it('make:component creates server component', () => {
        makeComponent('test-feature', 'DataTable', 'server');
        const content = fs.readFileSync(
            path.join(testDir, 'app/test-feature/components/server/DataTable.tsx'),
            'utf-8'
        );
        expect(content).not.toContain("'use client'");
        expect(content).toContain('export default function DataTable');
    });

    it('make:component throws if component already exists', () => {
        makeComponent('test-feature', 'MyButton', 'client');
        expect(() => makeComponent('test-feature', 'MyButton', 'client')).toThrow('already exists');
    });

    it('make:container creates container', () => {
        makeContainer('test-feature', 'TestContainer');
        const content = fs.readFileSync(
            path.join(testDir, 'app/test-feature/containers/TestContainer.tsx'),
            'utf-8'
        );
        expect(content).toContain("'use client'");
        expect(content).toContain('export default function TestContainer');
    });

    it('make:hook creates hook file', () => {
        makeHook('test-feature', 'useTest');
        const content = fs.readFileSync(
            path.join(testDir, 'app/test-feature/hooks/useTest.ts'),
            'utf-8'
        );
        expect(content).toContain('export function useTest');
        expect(content).toContain('useState');
    });

    it('make:service creates 5 service files', () => {
        makeService('test-feature', 'TestEntity');
        const base = path.join(testDir, 'app/test-feature/services');
        expect(fs.existsSync(path.join(base, 'ListTestEntity.service.ts'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'ShowTestEntity.service.ts'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'CreateTestEntity.service.ts'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'UpdateTestEntity.service.ts'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'DeleteTestEntity.service.ts'))).toBe(true);
    });

    it('make:service skips existing files', () => {
        makeService('test-feature', 'TestEntity');
        expect(() => makeService('test-feature', 'TestEntity')).not.toThrow();
    });

    it('make:repository creates 5 repository files', () => {
        makeRepository('test-feature', 'TestEntity');
        const base = path.join(testDir, 'app/test-feature/repositories');
        expect(fs.existsSync(path.join(base, 'ListTestEntity.repository.ts'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'ShowTestEntity.repository.ts'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'CreateTestEntity.repository.ts'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'UpdateTestEntity.repository.ts'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'DeleteTestEntity.repository.ts'))).toBe(true);
    });

    it('make:repository generates proper fetch calls', () => {
        makeRepository('test-feature', 'TestEntity');
        const content = fs.readFileSync(
            path.join(testDir, 'app/test-feature/repositories/CreateTestEntity.repository.ts'),
            'utf-8'
        );
        expect(content).toContain("fetch('/api/test-feature'");
        expect(content).toContain("method: 'POST'");
        expect(content).toContain("'Content-Type': 'application/json'");
    });

    it('make:schema creates Create and Update schemas', () => {
        makeSchema('test-feature', 'TestEntity');
        const base = path.join(testDir, 'app/test-feature/schemas');

        const create = fs.readFileSync(path.join(base, 'CreateTestEntity.schema.ts'), 'utf-8');
        expect(create).toContain("import { z } from 'zod'");
        expect(create).toContain('CreateTestEntity');

        const update = fs.readFileSync(path.join(base, 'UpdateTestEntity.schema.ts'), 'utf-8');
        expect(update).toContain('id: z.string()');
    });

    it('throws when feature does not exist', () => {
        expect(() => makeComponent('nonexistent', 'Foo', 'client')).toThrow('does not exist');
        expect(() => makeHook('nonexistent', 'useFoo')).toThrow('does not exist');
        expect(() => makeService('nonexistent', 'Foo')).toThrow('does not exist');
        expect(() => makeRepository('nonexistent', 'Foo')).toThrow('does not exist');
        expect(() => makeSchema('nonexistent', 'Foo')).toThrow('does not exist');
        expect(() => makeContainer('nonexistent', 'FooContainer')).toThrow('does not exist');
    });
});
