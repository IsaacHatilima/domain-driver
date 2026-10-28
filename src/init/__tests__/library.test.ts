import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LIBRARY_ROOT, readLibraryFiles } from '../library';

let temporary: string | undefined;
afterEach(() => {
    if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
    temporary = undefined;
});

function fixture(files: Record<string, string>): string {
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-library-'));
    fs.writeFileSync(path.join(temporary, 'catalog.json'), JSON.stringify({ schema: 1, items: [{ name: 'demo', files }] }));
    fs.writeFileSync(path.join(temporary, 'source.md'), 'instructions\n');
    return temporary;
}

describe('the delivered library', () => {
    it('installs factory, matching catalogs, stack skills, and eight agents for each host', () => {
        const files = readLibraryFiles();
        const byPath = new Map(files.map(file => [file.file, file.content]));
        expect(byPath.get('.agents/skills/factory/SKILL.md')).toContain('disable-model-invocation: true');
        expect(byPath.get('.agents/skills/factory/AGENT.md')).toContain('# factory');
        expect(byPath.get('.agents/skills/factory/references/skills.md')).toBeTruthy();
        expect(byPath.get('.agents/skills/factory/agents/openai.yaml')).toContain('allow_implicit_invocation: false');
        for (const group of ['nest', 'next', 'tanstack-start']) {
            expect(byPath.get(`.agents/skills/${group}-actions/SKILL.md`)).toContain(`name: ${group}-actions`);
        }
        expect(byPath.get('.agents/skills/javascript-domain-driver/SKILL.md')).toBeTruthy();
        expect(files.filter(file => file.file.startsWith('.claude/agents/'))).toHaveLength(8);
        expect(files.filter(file => file.file.startsWith('.codex/agents/'))).toHaveLength(8);
        expect(files.some(file => file.file.includes('laravel-'))).toBe(false);
        expect(byPath.get('.agents/skills/catalog.md')).not.toContain('| laravel/');
    });

    it('includes every referenced source in the published package', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(LIBRARY_ROOT, '../package.json'), 'utf8'));
        expect(pkg.files).toContain('agent-library');
        expect(readLibraryFiles().length).toBeGreaterThan(100);
    });
});

describe('invalid library deliveries', () => {
    it('rejects writes outside the native agent and skill directories', () => {
        expect(() => readLibraryFiles(fixture({ 'package.json': 'source.md' }))).toThrow('Unsafe library destination');
    });

    it('rejects source traversal and symlinks', () => {
        const root = fixture({ '.agents/skills/demo/SKILL.md': '../outside.md' });
        expect(() => readLibraryFiles(root)).toThrow('Unsafe library source');
        fs.writeFileSync(path.join(root, 'catalog.json'), JSON.stringify({ schema: 1, items: [{ name: 'demo', files: { '.agents/skills/demo/SKILL.md': 'linked.md' } }] }));
        fs.symlinkSync(path.join(root, 'source.md'), path.join(root, 'linked.md'));
        expect(() => readLibraryFiles(root)).toThrow('Symlink in library source');
    });

    it('rejects duplicate destination ownership', () => {
        const root = fixture({ '.agents/skills/demo/SKILL.md': 'source.md' });
        const catalog = JSON.parse(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'));
        catalog.items.push({ name: 'other', files: { '.agents/skills/demo/SKILL.md': 'source.md' } });
        fs.writeFileSync(path.join(root, 'catalog.json'), JSON.stringify(catalog));
        expect(() => readLibraryFiles(root)).toThrow('Duplicate library destination');
    });
});
