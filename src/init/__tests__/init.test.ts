import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { FACTORY_LABEL, factoryNotice, runInit } from '../init';
import { AGENTS_SECTION } from '../content';
import { readLibraryFiles } from '../library';
import { END, START } from '../markers';
import { createTempProject, projectFileExists, readProjectFile, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('init');
});

afterEach(() => project.cleanup());

describe('runInit', () => {
    it('creates the guidance, the skill and the factory in an empty project', () => {
        expect(runInit(process.cwd())).toEqual([
            { file: 'AGENTS.md', status: 'created' },
            { file: 'CLAUDE.md', status: 'created' },
            { file: FACTORY_LABEL, status: 'created' },
        ]);
        expect(readProjectFile('AGENTS.md')).toBe(`${AGENTS_SECTION}\n`);
        expect(readProjectFile('CLAUDE.md')).toBe(`${AGENTS_SECTION}\n`);
        expect(readProjectFile('.claude/skills/javascript-domain-driver/SKILL.md')).toContain('name: javascript-domain-driver');
        for (const file of readLibraryFiles()) {
            expect(readProjectFile(file.file)).toBe(file.content);
        }
    });

    it('is idempotent', () => {
        runInit(process.cwd());
        const before = readProjectFile('AGENTS.md');
        expect(runInit(process.cwd()).map((result) => result.status)).toEqual([
            'unchanged',
            'unchanged',
            'unchanged',
        ]);
        expect(readProjectFile('AGENTS.md')).toBe(before);
    });

    it('restores a modified factory file and reports the factory as updated', () => {
        runInit(process.cwd());
        fs.writeFileSync(path.join(process.cwd(), '.codex/agents/builder.toml'), 'edited\n');
        expect(runInit(process.cwd())[2]).toEqual({ file: FACTORY_LABEL, status: 'updated' });
        const builder = readLibraryFiles().find((file) => file.file === '.codex/agents/builder.toml');
        expect(readProjectFile('.codex/agents/builder.toml')).toBe(builder?.content);
    });

    it('leaves other agents in the project alone', () => {
        fs.mkdirSync(path.join(process.cwd(), '.claude/agents'), { recursive: true });
        fs.writeFileSync(path.join(process.cwd(), '.claude/agents/mine.md'), 'my agent\n');
        runInit(process.cwd());
        expect(readProjectFile('.claude/agents/mine.md')).toBe('my agent\n');
        expect(projectFileExists('.claude/agents/builder.md')).toBe(true);
    });

    it('refuses symlinked skill destinations before writing project files', () => {
        fs.mkdirSync(path.join(process.cwd(), 'outside'));
        fs.mkdirSync(path.join(process.cwd(), '.agents'));
        fs.symlinkSync(path.join(process.cwd(), 'outside'), path.join(process.cwd(), '.agents/skills'));
        expect(() => runInit(process.cwd())).toThrow('Refusing symlink');
        expect(projectFileExists('AGENTS.md')).toBe(false);
        expect(fs.readdirSync(path.join(process.cwd(), 'outside'))).toEqual([]);
    });

    it('appends to an existing file and preserves hand edits outside the markers', () => {
        fs.writeFileSync(path.join(process.cwd(), 'AGENTS.md'), '# My rules\n\nBe kind.\n');
        expect(runInit(process.cwd())[0]).toEqual({ file: 'AGENTS.md', status: 'updated' });
        expect(readProjectFile('AGENTS.md')).toBe(`# My rules\n\nBe kind.\n\n${AGENTS_SECTION}\n`);
    });

    it('refreshes a stale section in place', () => {
        fs.writeFileSync(
            path.join(process.cwd(), 'CLAUDE.md'),
            `top\n${START}\nold guidance\n${END}\nbottom\n`
        );
        expect(runInit(process.cwd())[1]).toEqual({ file: 'CLAUDE.md', status: 'updated' });
        expect(readProjectFile('CLAUDE.md')).toBe(`top\n${AGENTS_SECTION}\nbottom\n`);
    });

    it('overwrites a modified skill file', () => {
        runInit(process.cwd());
        fs.writeFileSync(path.join(process.cwd(), '.claude/skills/javascript-domain-driver/SKILL.md'), 'edited\n');
        expect(runInit(process.cwd())[2]).toEqual({ file: FACTORY_LABEL, status: 'updated' });
        expect(readProjectFile('.claude/skills/javascript-domain-driver/SKILL.md')).toContain('name: javascript-domain-driver');
    });

    it('works with a root that is not the cwd', () => {
        const other = path.join(process.cwd(), 'elsewhere');
        fs.mkdirSync(other);
        runInit(other);
        expect(fs.existsSync(path.join(other, 'AGENTS.md'))).toBe(true);
        expect(fs.existsSync(path.join(process.cwd(), 'AGENTS.md'))).toBe(false);
    });
});

describe('factoryNotice', () => {
    it('tells the user what the factory is the first time it is added', () => {
        const notice = factoryNotice(runInit(process.cwd())).join('\n');
        expect(notice).toContain('Added the /factory skill ($factory in Codex)');
        expect(notice).toContain(`${readLibraryFiles().filter((file) => file.file.startsWith('.codex/agents/')).length} agents`);
        expect(notice).toContain('It only runs when you start it.');
        expect(notice).toContain('https://github.com/IsaacHatilima/skills/tree/main/agents/factory');
    });

    it('stays quiet once the factory is already installed', () => {
        runInit(process.cwd());
        expect(factoryNotice(runInit(process.cwd()))).toEqual([]);
    });

    it('stays quiet when the factory is only refreshed', () => {
        expect(factoryNotice([{ file: FACTORY_LABEL, status: 'updated' }])).toEqual([]);
    });
});
