import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { makeFeature } from '../feature';
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

describe('make:feature', () => {
    beforeEach(() => {
        originalCwd = process.cwd();
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-feature-'));
        process.chdir(testDir);
        resetAliasCache();
    });
    afterEach(cleanup);

    it('creates feature directories with .gitkeep files', async () => {
        await makeFeature('test-feature', false);

        const base = path.join(testDir, 'app', 'test-feature');
        expect(fs.existsSync(base)).toBe(true);
        expect(fs.existsSync(path.join(base, 'components/client/.gitkeep'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'components/server/.gitkeep'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'containers/.gitkeep'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'hooks/.gitkeep'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'services/.gitkeep'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'repositories/.gitkeep'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'schemas/.gitkeep'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'types/.gitkeep'))).toBe(true);
    });

    it('creates page.tsx with PascalCase component name', async () => {
        await makeFeature('test-feature', false);

        const page = fs.readFileSync(path.join(testDir, 'app/test-feature/page.tsx'), 'utf-8');
        expect(page).toContain('TestFeaturePage');
        expect(page).toContain('export default function');
    });

    it('throws if feature already exists', async () => {
        await makeFeature('test-feature', false);
        await expect(makeFeature('test-feature', false)).rejects.toThrow('already exists');
    });

    it('scaffolds all files with -a flag', async () => {
        await makeFeature('coffee-type', true);

        const base = path.join(testDir, 'app', 'coffee-type');

        // No .gitkeep files when -a is used
        expect(fs.existsSync(path.join(base, 'components/client/.gitkeep'))).toBe(false);

        // All files created with correct names
        expect(fs.existsSync(path.join(base, 'page.tsx'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'components/client/CoffeeType.tsx'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'containers/CoffeeTypeContainer.tsx'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'hooks/useCoffeeType.ts'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'schemas/CreateCoffeeType.schema.ts'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'schemas/UpdateCoffeeType.schema.ts'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'services/ListCoffeeType.service.ts'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'services/CreateCoffeeType.service.ts'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'repositories/ListCoffeeType.repository.ts'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'repositories/CreateCoffeeType.repository.ts'))).toBe(true);
        expect(fs.existsSync(path.join(base, 'types/CoffeeType.types.ts'))).toBe(true);
    });

    it('page imports container when -a flag is used', async () => {
        await makeFeature('coffee-type', true);

        const page = fs.readFileSync(path.join(testDir, 'app/coffee-type/page.tsx'), 'utf-8');
        expect(page).toContain("import CoffeeTypeContainer from './containers/CoffeeTypeContainer'");
        expect(page).toContain('<CoffeeTypeContainer />');
    });
});
