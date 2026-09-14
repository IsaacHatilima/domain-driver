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
        expect(root).toContain("import { AssetModule } from './assets/assets.module';");
        expect(root).toContain('imports: [\n    AssetModule,\n  ],');
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

        expect(() => registerFeatureModule(ctx, 'Asset')).not.toThrow();
        expect(() => registerClasses(ctx, 'controller', ['ListAsset'])).not.toThrow();
        expect(fs.existsSync(path.join(process.cwd(), 'src', 'app.module.ts'))).toBe(false);
    });
});
