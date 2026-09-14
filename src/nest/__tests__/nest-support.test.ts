import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { loadTypeScript } from '../typescript';
import { findRootModule } from '../root-module';
import { createTempProject, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('nest-support');
});

afterEach(() => project.cleanup());

function touch(relative: string): void {
    const target = path.join(process.cwd(), relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, '');
}

describe('loadTypeScript', () => {
    it('loads the real typescript from a project that has one', () => {
        expect(loadTypeScript(__dirname)).not.toBeNull();
    });

    it('returns null when it cannot be resolved', () => {
        const missing = () => {
            throw new Error('Cannot find module');
        };
        expect(loadTypeScript(process.cwd(), missing)).toBeNull();
    });

    it('returns null when what resolves is not the typescript api', () => {
        expect(loadTypeScript(process.cwd(), () => 'anywhere', () => ({ nope: true }))).toBeNull();
    });
});

describe('findRootModule', () => {
    it('prefers src/app.module.ts', () => {
        touch('src/app.module.ts');
        touch('app.module.ts');
        expect(findRootModule(process.cwd(), 'src/features', null)).toBe(
            path.join(process.cwd(), 'src/app.module.ts')
        );
    });

    it('falls back to a root-level app.module.ts', () => {
        touch('app.module.ts');
        expect(findRootModule(process.cwd(), 'features', null)).toBe(path.join(process.cwd(), 'app.module.ts'));
    });

    it('looks beside the feature root', () => {
        touch('packages/api/app.module.ts');
        expect(findRootModule(process.cwd(), 'packages/api/features', null)).toBe(
            path.join(process.cwd(), 'packages/api/app.module.ts')
        );
    });

    it('uses the configured path when given', () => {
        touch('src/core/root.module.ts');
        touch('src/app.module.ts');
        expect(findRootModule(process.cwd(), 'src/features', 'src/core/root.module.ts')).toBe(
            path.join(process.cwd(), 'src/core/root.module.ts')
        );
    });

    it('returns null when the configured path does not exist', () => {
        expect(findRootModule(process.cwd(), 'src/features', 'src/nope.ts')).toBeNull();
    });

    it('returns null when nothing is found', () => {
        expect(findRootModule(process.cwd(), 'src/features', null)).toBeNull();
    });
});
