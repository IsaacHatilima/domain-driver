import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { makeAction } from '../action';
import { makeController } from '../controller';
import { makeFeature } from '../feature';
import { registerClasses, registerCustomAction, registerFeatureModule, standardActionNames } from '../register';
import { requireFeature } from '../resolve';
import { createTempProject, writePackageJson, TempProject } from '../../__tests__/helpers/project';

const REPO = path.resolve(__dirname, '../../..');

const APP_MODULE = `import { Module } from '@nestjs/common';

@Module({
  imports: [],
})
export class AppModule {}
`;

let project: TempProject;

function linkTypeScript(): void {
    const modules = path.join(process.cwd(), 'node_modules');
    fs.mkdirSync(modules, { recursive: true });
    fs.symlinkSync(path.join(REPO, 'node_modules', 'typescript'), path.join(modules, 'typescript'), 'dir');
}

function read(relative: string): string {
    return fs.readFileSync(path.join(process.cwd(), relative), 'utf-8');
}

beforeEach(() => {
    project = createTempProject('command-register');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
    project.cleanup();
    vi.restoreAllMocks();
});

async function nestProject(): Promise<void> {
    writePackageJson({ '@nestjs/core': '1' });
    linkTypeScript();
    fs.mkdirSync(path.join(process.cwd(), 'src'), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), 'src', 'app.module.ts'), APP_MODULE);
}

describe('nest registration commands', () => {
    it('registers the feature module in the root module when the feature is created', async () => {
        await nestProject();
        await makeFeature('assets', false, 'Asset');

        const root = read('src/app.module.ts');
        expect(root).toContain("import { AssetsModule } from './assets/assets.module';");
        expect(root).toContain('imports: [\n    AssetsModule,\n  ],');
    });

    it('gives flow features of one entity distinct module names, and registers each', async () => {
        await nestProject();
        await makeFeature('create-project', false, 'Project');
        await makeFeature('archive-project', true, 'Project');

        expect(read('src/create-project/create-project.module.ts')).toContain('export class CreateProjectModule {}');
        expect(read('src/archive-project/archive-project.module.ts')).toContain('export class ArchiveProjectModule {}');
        const root = read('src/app.module.ts');
        expect(root).toContain("import { CreateProjectModule } from './create-project/create-project.module';");
        expect(root).toContain("import { ArchiveProjectModule } from './archive-project/archive-project.module';");
        expect(root).toContain('imports: [\n    CreateProjectModule,\n    ArchiveProjectModule,\n  ],');
        expect(root).not.toContain('ProjectModule,\n    ProjectModule');
    });

    it('registers generated controllers in the feature module', async () => {
        await nestProject();
        await makeFeature('assets', false, 'Asset');
        makeController('assets', 'Asset');
        registerClasses(requireFeature('assets'), 'controller', standardActionNames('Asset'));

        const feature = read('src/assets/assets.module.ts');
        expect(feature).toContain('ListAssetController');
        expect(feature).toContain("import { ListAssetController } from './controllers/ListAsset.controller';");
    });

    it('places a bespoke action controller ahead of the show controller', async () => {
        await nestProject();
        await makeFeature('assets', true, 'Asset');
        makeAction('assets', 'Asset', 'findActiveAssets', { withInput: false, returns: 'list' });
        registerCustomAction(requireFeature('assets'), 'FindActiveAssets', 'Asset');

        const feature = read('src/assets/assets.module.ts');
        const custom = feature.indexOf('FindActiveAssetsController');
        const show = feature.indexOf('ShowAssetController,');
        expect(custom).toBeGreaterThan(-1);
        expect(custom).toBeLessThan(show);
    });

    it('prints a hint without Show<Entity>Controller for a feature that is the action itself', async () => {
        writePackageJson({ '@nestjs/core': '1' }, {}, { domainDriver: { autoRegister: false } });
        await makeFeature('archive-project', false, 'ArchiveProject');
        const logged: string[] = [];
        vi.mocked(console.log).mockImplementation((line: unknown) => {
            logged.push(String(line));
        });
        makeAction('archive-project', 'Project', 'archiveProject', { withInput: false, returns: 'one', method: 'patch', onRecord: true });
        registerCustomAction(requireFeature('archive-project'), 'ArchiveProject', 'Project');

        const hint = logged.join('\n');
        expect(hint).toContain('controllers: [ ..., ArchiveProjectController ]');
        expect(hint).toContain('providers: [ ..., ArchiveProjectService, ArchiveProjectRepository ]');
        expect(hint).not.toContain('ShowProjectController');
    });

    it('names the folder-named module when there is no root module to register it in', async () => {
        writePackageJson({ '@nestjs/core': '1' });
        linkTypeScript();
        const logged: string[] = [];
        vi.mocked(console.log).mockImplementation((line: unknown) => {
            logged.push(String(line));
        });
        await makeFeature('create-project', false, 'Project');
        expect(logged.join('\n')).toContain('No root module found, so CreateProjectModule was not registered.');
    });

        it('says so rather than going silent when the feature module is missing', async () => {
        await nestProject();
        await makeFeature('assets', false, 'Asset');
        makeController('assets', 'Asset');
        fs.rmSync(path.join(process.cwd(), 'src', 'assets', 'assets.module.ts'));

        const logged: string[] = [];
        vi.mocked(console.log).mockImplementation((line: unknown) => {
            logged.push(String(line));
        });
        registerClasses(requireFeature('assets'), 'controller', standardActionNames('Asset'));
        expect(logged.join('\n')).toContain('the module file does not exist');
    });

    it('does nothing on a stack that has no modules', async () => {
        writePackageJson({ react: '1' });
        linkTypeScript();
        await makeFeature('assets', false, 'Asset');
        const ctx = requireFeature('assets');

        expect(() => registerFeatureModule(ctx)).not.toThrow();
        expect(() => registerClasses(ctx, 'controller', ['ListAsset'])).not.toThrow();
        expect(fs.existsSync(path.join(process.cwd(), 'src', 'app.module.ts'))).toBe(false);
    });
});
