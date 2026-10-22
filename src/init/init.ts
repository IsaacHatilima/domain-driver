import * as path from 'path';
import { mkdirSafe, readTextFile, writeFileSafe } from '../utils/fs';
import { AGENTS_SECTION, SKILL_CONTENT } from './content';
import { FactoryFile, readFactoryFiles } from './factory';
import { applySection, SectionStatus } from './markers';

export interface InitResult {
    readonly file: string;
    readonly status: SectionStatus;
}

const SKILL_FILE = '.claude/skills/domain-driver/SKILL.md';

/** The factory installs many files; init reports them as one line under this label. */
export const FACTORY_LABEL = 'domain-factory skill and agents';

const FACTORY_DOCS = 'https://github.com/IsaacHatilima/domain-driver/tree/master/factory';

export function runInit(root: string): readonly InitResult[] {
    return [writeSection(root, 'AGENTS.md'), writeSection(root, 'CLAUDE.md'), writeSkill(root), writeFactory(root)];
}

function writeSection(root: string, file: string): InitResult {
    const filePath = path.join(root, file);
    const result = applySection(readTextFile(filePath), AGENTS_SECTION);
    if (result.status !== 'unchanged') writeFileSafe(filePath, result.content);
    return Object.freeze({ file, status: result.status });
}

function writeSkill(root: string): InitResult {
    return Object.freeze({ file: SKILL_FILE, status: writeOwnedFile(root, SKILL_FILE, SKILL_CONTENT) });
}

/**
 * Writes every factory file the tool owns. Other files in `.claude/agents` and
 * `.codex/agents` belong to the project and are never touched.
 */
function writeFactory(root: string): InitResult {
    const statuses = readFactoryFiles().map((file: FactoryFile) => writeOwnedFile(root, file.file, file.content));
    return Object.freeze({ file: FACTORY_LABEL, status: combine(statuses) });
}

function writeOwnedFile(root: string, file: string, content: string): SectionStatus {
    const filePath = path.join(root, file);
    const existing = readTextFile(filePath);
    if (existing === content) return 'unchanged';

    mkdirSafe(path.dirname(filePath));
    writeFileSafe(filePath, content);
    return existing === null ? 'created' : 'updated';
}

function combine(statuses: readonly SectionStatus[]): SectionStatus {
    if (statuses.every((status) => status === 'unchanged')) return 'unchanged';
    if (statuses.every((status) => status === 'created')) return 'created';
    return 'updated';
}

/**
 * Tells the user what the factory is the first time init adds it to a project,
 * because it brings a new skill and agent files they did not ask for by name.
 */
export function factoryNotice(results: readonly InitResult[]): readonly string[] {
    const added = results.some((result) => result.file === FACTORY_LABEL && result.status === 'created');
    if (!added) return [];
    const agents = readFactoryFiles().filter((file) => file.file.startsWith('.codex/agents/')).length;
    return [
        `ℹ️  Added the /domain-factory skill ($domain-factory in Codex) and its ${agents} agents to this project.`,
        '   It takes a feature request through spec, build, review, documentation and approval, each step its own agent.',
        '   It only runs when you start it. Read what it needs first:',
        `   ${FACTORY_DOCS}`,
    ];
}

export const INIT_ICONS: Readonly<Record<SectionStatus, string>> = Object.freeze({
    created: '✅',
    updated: '✅',
    unchanged: 'ℹ️ ',
});
