import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { applyRegistrations } from '../registration';
import { createTempProject, TempProject } from '../../__tests__/helpers/project';

const REPO = path.resolve(__dirname, '../../..');

const MODULE_SOURCE = `import { Module } from '@nestjs/common';
import { AuthModule } from './features/auth/auth.module';

@Module({
  imports: [
    // keep infrastructure first
    AuthModule,
  ],
})
export class AppModule {}
`;

let project: TempProject;
let logged: string[];

/** Node resolves typescript from the project being scaffolded, so a fixture needs one too. */
function linkTypeScript(): void {
    const modules = path.join(process.cwd(), 'node_modules');
    fs.mkdirSync(modules, { recursive: true });
    fs.symlinkSync(path.join(REPO, 'node_modules', 'typescript'), path.join(modules, 'typescript'), 'dir');
}

function writeModule(source = MODULE_SOURCE): string {
    const target = path.join(process.cwd(), 'app.module.ts');
    fs.writeFileSync(target, source);
    return target;
}

function entry(identifier = 'AssetsModule'): { identifier: string; definedIn: string; property: 'imports' } {
    return {
        identifier,
        definedIn: path.join(process.cwd(), 'features', 'assets', 'assets.module.ts'),
        property: 'imports',
    };
}

beforeEach(() => {
    project = createTempProject('registration');
    logged = [];
    vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
        logged.push(String(line));
    });
});

afterEach(() => {
    project.cleanup();
    vi.restoreAllMocks();
});

describe('applyRegistrations', () => {
    it('writes the edit and reports what it registered', () => {
        linkTypeScript();
        const moduleFile = writeModule();
        applyRegistrations(moduleFile, [entry()], true);

        const written = fs.readFileSync(moduleFile, 'utf-8');
        expect(written).toContain('    AuthModule,\n    AssetsModule,');
        expect(written).toContain('// keep infrastructure first');
        expect(logged.join('\n')).toContain('✅ Registered AssetsModule in app.module.ts');
    });

    it('changes nothing and explains when registration is off', () => {
        linkTypeScript();
        const moduleFile = writeModule();
        applyRegistrations(moduleFile, [entry()], false);

        expect(fs.readFileSync(moduleFile, 'utf-8')).toBe(MODULE_SOURCE);
        expect(logged.join('\n')).toContain('automatic registration is off');
        expect(logged.join('\n')).toContain('imports: [ ..., AssetsModule ]');
    });

    it('changes nothing and explains when typescript cannot be resolved', () => {
        const moduleFile = writeModule();
        applyRegistrations(moduleFile, [entry()], true);

        expect(fs.readFileSync(moduleFile, 'utf-8')).toBe(MODULE_SOURCE);
        expect(logged.join('\n')).toContain('typescript could not be resolved');
    });

    it('changes nothing and explains when the file has no Module decorator', () => {
        linkTypeScript();
        const moduleFile = writeModule('export class AppModule {}\n');
        applyRegistrations(moduleFile, [entry()], true);

        expect(fs.readFileSync(moduleFile, 'utf-8')).toBe('export class AppModule {}\n');
        expect(logged.join('\n')).toContain('no @Module decorator');
    });

    it('says nothing and rewrites nothing when everything is already registered', () => {
        linkTypeScript();
        const moduleFile = writeModule();
        applyRegistrations(moduleFile, [entry('AuthModule')], true);

        expect(fs.readFileSync(moduleFile, 'utf-8')).toBe(MODULE_SOURCE);
        expect(logged).toHaveLength(0);
    });

    it('does nothing at all with no entries', () => {
        linkTypeScript();
        const moduleFile = writeModule();
        applyRegistrations(moduleFile, [], true);
        expect(fs.readFileSync(moduleFile, 'utf-8')).toBe(MODULE_SOURCE);
        expect(logged).toHaveLength(0);
    });
});
