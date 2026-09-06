import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { runInit } from '../init';
import { AGENTS_SECTION, SKILL_CONTENT } from '../content';
import { END, START } from '../markers';
import { createTempProject, readProjectFile, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('init');
});

afterEach(() => project.cleanup());

describe('runInit', () => {
    it('creates all three files in an empty project', () => {
        expect(runInit(process.cwd())).toEqual([
            { file: 'AGENTS.md', status: 'created' },
            { file: 'CLAUDE.md', status: 'created' },
            { file: '.claude/skills/domain-driver/SKILL.md', status: 'created' },
        ]);
        expect(readProjectFile('AGENTS.md')).toBe(`${AGENTS_SECTION}\n`);
        expect(readProjectFile('CLAUDE.md')).toBe(`${AGENTS_SECTION}\n`);
        expect(readProjectFile('.claude/skills/domain-driver/SKILL.md')).toBe(SKILL_CONTENT);
    });

    it('is idempotent', () => {
        runInit(process.cwd());
        const before = readProjectFile('AGENTS.md');
        expect(runInit(process.cwd()).map((result) => result.status)).toEqual(['unchanged', 'unchanged', 'unchanged']);
        expect(readProjectFile('AGENTS.md')).toBe(before);
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
