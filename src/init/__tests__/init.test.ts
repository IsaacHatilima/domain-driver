import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { FACTORY_LABEL, factoryNotice, runInit } from '../init';
import { AGENTS_SECTION, SKILL_CONTENT } from '../content';
import { readFactoryFiles } from '../factory';
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
            { file: '.claude/skills/domain-driver/SKILL.md', status: 'created' },
            { file: FACTORY_LABEL, status: 'created' },
        ]);
        expect(readProjectFile('AGENTS.md')).toBe(`${AGENTS_SECTION}\n`);
        expect(readProjectFile('CLAUDE.md')).toBe(`${AGENTS_SECTION}\n`);
        expect(readProjectFile('.claude/skills/domain-driver/SKILL.md')).toBe(SKILL_CONTENT);
        for (const file of readFactoryFiles()) {
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
            'unchanged',
        ]);
        expect(readProjectFile('AGENTS.md')).toBe(before);
    });

    it('restores a modified factory file and reports the factory as updated', () => {
        runInit(process.cwd());
        fs.writeFileSync(path.join(process.cwd(), '.codex/agents/builder.toml'), 'edited\n');
        expect(runInit(process.cwd())[3]).toEqual({ file: FACTORY_LABEL, status: 'updated' });
        const builder = readFactoryFiles().find((file) => file.file === '.codex/agents/builder.toml');
        expect(readProjectFile('.codex/agents/builder.toml')).toBe(builder?.content);
    });

    it('leaves other agents in the project alone', () => {
        fs.mkdirSync(path.join(process.cwd(), '.claude/agents'), { recursive: true });
        fs.writeFileSync(path.join(process.cwd(), '.claude/agents/mine.md'), 'my agent\n');
        runInit(process.cwd());
        expect(readProjectFile('.claude/agents/mine.md')).toBe('my agent\n');
        expect(projectFileExists('.claude/agents/builder.md')).toBe(true);
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
        fs.writeFileSync(path.join(process.cwd(), '.claude/skills/domain-driver/SKILL.md'), 'edited\n');
        expect(runInit(process.cwd())[2]).toEqual({ file: '.claude/skills/domain-driver/SKILL.md', status: 'updated' });
        expect(readProjectFile('.claude/skills/domain-driver/SKILL.md')).toBe(SKILL_CONTENT);
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
        expect(notice).toContain('Added the /domain-factory skill ($domain-factory in Codex)');
        expect(notice).toContain(`${readFactoryFiles().filter((file) => file.file.startsWith('.codex/agents/')).length} agents`);
        expect(notice).toContain('It only runs when you start it.');
        expect(notice).toContain('https://github.com/IsaacHatilima/domain-driver/tree/master/factory');
    });

    it('stays quiet once the factory is already installed', () => {
        runInit(process.cwd());
        expect(factoryNotice(runInit(process.cwd()))).toEqual([]);
    });

    it('stays quiet when the factory is only refreshed', () => {
        expect(factoryNotice([{ file: FACTORY_LABEL, status: 'updated' }])).toEqual([]);
    });
});
