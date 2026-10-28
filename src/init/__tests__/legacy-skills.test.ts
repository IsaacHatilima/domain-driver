import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { gunzipSync } from 'zlib';
import { FACTORY_LABEL, runInit } from '../init';
import { createTempProject, TempProject } from '../../__tests__/helpers/project';

const legacy: Readonly<Record<string, string>> = JSON.parse(gunzipSync(
    fs.readFileSync(path.join(__dirname, 'fixtures/legacy-0.8.0.json.gz'))
).toString('utf8'));

let project: TempProject;
beforeEach(() => { project = createTempProject('legacy-skills'); });
afterEach(() => project.cleanup());

function write(relative: string, contents: string): void {
    fs.mkdirSync(path.dirname(relative), { recursive: true });
    fs.writeFileSync(relative, contents);
}

function seed(): void {
    for (const [relative, contents] of Object.entries(legacy)) write(relative, contents);
}

describe('retirement of published 0.8.0 skills', () => {
    it('removes the old names, installs the current names, and preserves other tools', () => {
        seed();
        write('.agents/skills/another-tool/SKILL.md', 'Project skill.');
        write('.claude/agents/another-tool.md', 'Project agent.');
        runInit(process.cwd());
        for (const relative of Object.keys(legacy)) expect(fs.existsSync(relative)).toBe(false);
        for (const relative of ['.agents/skills/domain-factory', '.claude/skills/domain-factory', '.claude/skills/domain-driver']) {
            expect(fs.existsSync(relative)).toBe(false);
        }
        expect(fs.existsSync('.agents/skills/factory/SKILL.md')).toBe(true);
        expect(fs.existsSync('.agents/skills/javascript-domain-driver/SKILL.md')).toBe(true);
        expect(fs.lstatSync('.claude/skills/factory').isSymbolicLink()).toBe(true);
        expect(fs.readFileSync('.agents/skills/another-tool/SKILL.md', 'utf8')).toBe('Project skill.');
        expect(fs.readFileSync('.claude/agents/another-tool.md', 'utf8')).toBe('Project agent.');
        expect(runInit(process.cwd()).every(result => result.status === 'unchanged')).toBe(true);
    });

    it('cleans a mixed 0.8.0/0.8.2 installation without replacing current links', () => {
        runInit(process.cwd());
        const inode = fs.lstatSync('.claude/skills/factory').ino;
        seed();
        expect(runInit(process.cwd())[2]).toEqual({ file: FACTORY_LABEL, status: 'updated' });
        expect(fs.lstatSync('.claude/skills/factory').ino).toBe(inode);
        expect(fs.existsSync('.agents/skills/domain-factory')).toBe(false);
        expect(runInit(process.cwd()).every(result => result.status === 'unchanged')).toBe(true);
    });

    it('preserves edited old instructions and all other old files before any project writes', () => {
        seed();
        write('.claude/skills/domain-driver/SKILL.md', 'Local instructions.');
        expect(() => runInit(process.cwd())).toThrow('locally modified or unowned legacy file preserved');
        expect(fs.readFileSync('.claude/skills/domain-driver/SKILL.md', 'utf8')).toBe('Local instructions.');
        expect(fs.readFileSync('.agents/skills/domain-factory/SKILL.md', 'utf8')).toBe(legacy['.agents/skills/domain-factory/SKILL.md']);
        expect(fs.existsSync('AGENTS.md')).toBe(false);
        expect(fs.existsSync('.agents/skills/factory')).toBe(false);
    });

    it('preserves additional unowned files inside an old skill', () => {
        seed();
        write('.agents/skills/domain-factory/project-notes.md', 'Keep my notes.');
        expect(() => runInit(process.cwd())).toThrow('locally modified or unowned legacy file preserved');
        expect(fs.readFileSync('.agents/skills/domain-factory/project-notes.md', 'utf8')).toBe('Keep my notes.');
        expect(fs.existsSync('AGENTS.md')).toBe(false);
    });

    it('rejects symlinked legacy directories without changing their target', () => {
        fs.mkdirSync('outside');
        fs.mkdirSync('.claude/skills', { recursive: true });
        fs.symlinkSync(path.join(process.cwd(), 'outside'), '.claude/skills/domain-driver');
        expect(() => runInit(process.cwd())).toThrow('Refusing symlink');
        expect(fs.readdirSync('outside')).toEqual([]);
        expect(fs.existsSync('AGENTS.md')).toBe(false);
    });

    it('retires a partially removed legacy installation', () => {
        seed();
        fs.unlinkSync('.agents/skills/domain-factory/agents/openai.yaml');
        runInit(process.cwd());
        expect(fs.existsSync('.agents/skills/domain-factory')).toBe(false);
        expect(fs.existsSync('.claude/skills/domain-driver')).toBe(false);
    });
});
