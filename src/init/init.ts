import * as path from 'path';
import { mkdirSafe, readTextFile, writeFileSafe } from '../utils/fs';
import { AGENTS_SECTION, SKILL_CONTENT } from './content';
import { applySection, SectionStatus } from './markers';

export interface InitResult {
    readonly file: string;
    readonly status: SectionStatus;
}

const SKILL_FILE = '.claude/skills/domain-driver/SKILL.md';

export function runInit(root: string): readonly InitResult[] {
    return [writeSection(root, 'AGENTS.md'), writeSection(root, 'CLAUDE.md'), writeSkill(root)];
}

function writeSection(root: string, file: string): InitResult {
    const filePath = path.join(root, file);
    const result = applySection(readTextFile(filePath), AGENTS_SECTION);
    if (result.status !== 'unchanged') writeFileSafe(filePath, result.content);
    return Object.freeze({ file, status: result.status });
}

function writeSkill(root: string): InitResult {
    const filePath = path.join(root, SKILL_FILE);
    const existing = readTextFile(filePath);
    if (existing === SKILL_CONTENT) return Object.freeze({ file: SKILL_FILE, status: 'unchanged' });

    mkdirSafe(path.dirname(filePath));
    writeFileSafe(filePath, SKILL_CONTENT);
    return Object.freeze({ file: SKILL_FILE, status: existing === null ? 'created' : 'updated' });
}

export const INIT_ICONS: Readonly<Record<SectionStatus, string>> = Object.freeze({
    created: '✅',
    updated: '✅',
    unchanged: 'ℹ️ ',
});
