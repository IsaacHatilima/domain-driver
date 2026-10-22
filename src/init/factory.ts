import * as fs from 'fs';
import * as path from 'path';

/**
 * The factory sources shipped in the package. Resolved from this file, so it is the
 * same relative hop from `src/init` under test and from `dist/init` once installed.
 */
export const FACTORY_ROOT: string = path.resolve(__dirname, '..', '..', 'factory');

export interface AgentSource {
    readonly name: string;
    readonly description: string;
    readonly claudeModel: string;
    readonly claudeTools: string;
    readonly claudeEffort: string;
    readonly codexModel: string;
    readonly codexEffort: string;
    readonly body: string;
}

export interface FactoryFile {
    /** Path relative to the project root, with forward slashes. */
    readonly file: string;
    readonly content: string;
}

const KEYS = {
    name: 'name',
    description: 'description',
    'claude-model': 'claudeModel',
    'claude-tools': 'claudeTools',
    'claude-effort': 'claudeEffort',
    'codex-model': 'codexModel',
    'codex-reasoning-effort': 'codexEffort',
} as const satisfies Record<string, keyof AgentSource>;

type SourceKey = keyof typeof KEYS;

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/;
const TOML_LITERAL_END = "'''";

export function parseAgentSource(text: string, label: string): AgentSource {
    const match = FRONTMATTER.exec(text.replace(/\r\n/g, '\n'));
    if (match === null) throw new Error(`${label}: no frontmatter`);
    const fields = parseFields(match[1], label);
    const missing = (Object.keys(KEYS) as SourceKey[]).find((key) => !fields.get(key));
    if (missing !== undefined) throw new Error(`${label}: missing ${missing}`);

    const value = (key: SourceKey): string => fields.get(key) as string;
    return Object.freeze({
        name: value('name'),
        description: value('description'),
        claudeModel: value('claude-model'),
        claudeTools: value('claude-tools'),
        claudeEffort: value('claude-effort'),
        codexModel: value('codex-model'),
        codexEffort: value('codex-reasoning-effort'),
        body: match[2],
    });
}

function parseFields(frontmatter: string, label: string): ReadonlyMap<string, string> {
    const entries = frontmatter.split('\n').map((line): readonly [string, string] => {
        const separator = line.indexOf(': ');
        if (separator === -1) throw new Error(`${label}: cannot read frontmatter line "${line}"`);
        const key = line.slice(0, separator);
        if (!Object.prototype.hasOwnProperty.call(KEYS, key)) throw new Error(`${label}: unknown key ${key}`);
        return [key, line.slice(separator + 2).trim()];
    });
    return new Map(entries);
}

export function renderClaudeAgent(agent: AgentSource): string {
    return [
        '---',
        `name: ${agent.name}`,
        `description: ${agent.description}`,
        `tools: ${agent.claudeTools}`,
        `model: ${agent.claudeModel}`,
        `effort: ${agent.claudeEffort}`,
        '---',
        '',
        agent.body,
    ].join('\n');
}

export function renderCodexAgent(agent: AgentSource): string {
    if (agent.body.includes(TOML_LITERAL_END)) {
        throw new Error(`${agent.name}: the instructions contain ''' and cannot be a TOML literal string`);
    }
    return [
        `name = ${tomlString(agent.name)}`,
        `description = ${tomlString(agent.description)}`,
        `model = ${tomlString(agent.codexModel)}`,
        `model_reasoning_effort = ${tomlString(agent.codexEffort)}`,
        `developer_instructions = ${TOML_LITERAL_END}`,
        `${agent.body}${TOML_LITERAL_END}`,
        '',
    ].join('\n');
}

/** A TOML basic string. JSON's escapes (\", \\, \n, \uXXXX) are all valid TOML escapes. */
function tomlString(value: string): string {
    return JSON.stringify(value);
}

/**
 * Every file the factory installs into a project: its skill for Claude Code and Codex,
 * the Codex skill metadata, and each agent rendered for both tools.
 */
export function readFactoryFiles(root: string = FACTORY_ROOT): readonly FactoryFile[] {
    const skill = readSource(path.join(root, 'skill', 'SKILL.md'));
    const codexMetadata = readSource(path.join(root, 'skill', 'agents', 'openai.yaml'));
    const agents = readAgents(path.join(root, 'agents'));

    return Object.freeze([
        { file: '.claude/skills/domain-factory/SKILL.md', content: skill },
        { file: '.agents/skills/domain-factory/SKILL.md', content: skill },
        { file: '.agents/skills/domain-factory/agents/openai.yaml', content: codexMetadata },
        ...agents.map((agent) => ({ file: `.claude/agents/${agent.name}.md`, content: renderClaudeAgent(agent) })),
        ...agents.map((agent) => ({ file: `.codex/agents/${agent.name}.toml`, content: renderCodexAgent(agent) })),
    ]);
}

function readAgents(dir: string): readonly AgentSource[] {
    return fs
        .readdirSync(dir)
        .filter((file) => file.endsWith('.md'))
        .sort()
        .map((file) => {
            const agent = parseAgentSource(readSource(path.join(dir, file)), file);
            if (`${agent.name}.md` !== file) {
                throw new Error(`${file}: name ${agent.name} does not match the file name`);
            }
            return agent;
        });
}

function readSource(filePath: string): string {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Cannot read the domain-factory source ${filePath}: ${message}`);
    }
}
