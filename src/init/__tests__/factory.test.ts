import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FACTORY_ROOT, parseAgentSource, readFactoryFiles, renderClaudeAgent, renderCodexAgent } from '../factory';

const SOURCE = [
    '---',
    'name: reviewer-demo',
    'description: Reviews a demo branch and writes "review.md".',
    'claude-model: sonnet',
    'claude-tools: Read, Grep, Write',
    'claude-effort: medium',
    'codex-model: gpt-6-luna',
    'codex-reasoning-effort: medium',
    '---',
    '',
    'You review one demo.',
    '',
    '## Write',
    'One file.',
    '',
].join('\n');

describe('parseAgentSource', () => {
    it('reads every key and keeps the body', () => {
        expect(parseAgentSource(SOURCE, 'reviewer-demo.md')).toEqual({
            name: 'reviewer-demo',
            description: 'Reviews a demo branch and writes "review.md".',
            claudeModel: 'sonnet',
            claudeTools: 'Read, Grep, Write',
            claudeEffort: 'medium',
            codexModel: 'gpt-6-luna',
            codexEffort: 'medium',
            body: 'You review one demo.\n\n## Write\nOne file.\n',
        });
    });

    it('names the file and the key when a key is missing', () => {
        const source = SOURCE.replace('claude-effort: medium\n', '');
        expect(() => parseAgentSource(source, 'reviewer-demo.md')).toThrow('reviewer-demo.md: missing claude-effort');
    });

    it('rejects an unknown key, so a typo cannot silently drop a setting', () => {
        const source = SOURCE.replace('claude-effort: medium', 'claude-efort: medium');
        expect(() => parseAgentSource(source, 'reviewer-demo.md')).toThrow('reviewer-demo.md: unknown key claude-efort');
    });

    it('reads a source checked out with Windows line endings', () => {
        expect(parseAgentSource(SOURCE.replace(/\n/g, '\r\n'), 'reviewer-demo.md')).toEqual(
            parseAgentSource(SOURCE, 'reviewer-demo.md')
        );
    });

    it('rejects a file without frontmatter', () => {
        expect(() => parseAgentSource('You review.\n', 'x.md')).toThrow('x.md: no frontmatter');
    });
});

describe('renderClaudeAgent', () => {
    it('writes the Claude Code subagent format', () => {
        expect(renderClaudeAgent(parseAgentSource(SOURCE, 'reviewer-demo.md'))).toBe(
            [
                '---',
                'name: reviewer-demo',
                'description: Reviews a demo branch and writes "review.md".',
                'tools: Read, Grep, Write',
                'model: sonnet',
                'effort: medium',
                '---',
                '',
                'You review one demo.',
                '',
                '## Write',
                'One file.',
                '',
            ].join('\n')
        );
    });
});

describe('renderCodexAgent', () => {
    it('writes the Codex custom agent format with the body as a literal string', () => {
        expect(renderCodexAgent(parseAgentSource(SOURCE, 'reviewer-demo.md'))).toBe(
            [
                'name = "reviewer-demo"',
                'description = "Reviews a demo branch and writes \\"review.md\\"."',
                'model = "gpt-6-luna"',
                'model_reasoning_effort = "medium"',
                "developer_instructions = '''",
                'You review one demo.',
                '',
                '## Write',
                'One file.',
                "'''",
                '',
            ].join('\n')
        );
    });

    it('refuses instructions that would end the literal string early', () => {
        const source = SOURCE.replace('One file.', "Write '''three quotes'''.");
        expect(() => renderCodexAgent(parseAgentSource(source, 'reviewer-demo.md'))).toThrow(
            "reviewer-demo: the instructions contain ''' and cannot be a TOML literal string"
        );
    });
});

describe('readFactoryFiles', () => {
    const files = readFactoryFiles();
    const byPath = new Map(files.map((file) => [file.file, file.content]));
    const agentNames = fs
        .readdirSync(path.join(FACTORY_ROOT, 'agents'))
        .filter((file) => file.endsWith('.md'))
        .map((file) => file.slice(0, -'.md'.length))
        .sort();

    it('installs the same skill for Claude Code and Codex, plus the Codex metadata', () => {
        const skill = fs.readFileSync(path.join(FACTORY_ROOT, 'skill', 'SKILL.md'), 'utf-8');
        expect(byPath.get('.claude/skills/domain-factory/SKILL.md')).toBe(skill);
        expect(byPath.get('.agents/skills/domain-factory/SKILL.md')).toBe(skill);
        expect(byPath.get('.agents/skills/domain-factory/agents/openai.yaml')).toContain(
            'allow_implicit_invocation: false'
        );
    });

    it('never lets Claude Code start the skill on its own', () => {
        expect(byPath.get('.claude/skills/domain-factory/SKILL.md')).toContain('disable-model-invocation: true');
    });

    it('renders every agent for both tools', () => {
        expect(agentNames.length).toBeGreaterThan(0);
        for (const name of agentNames) {
            expect(byPath.get(`.claude/agents/${name}.md`)).toMatch(new RegExp(`^---\\nname: ${name}\\n`));
            expect(byPath.get(`.codex/agents/${name}.toml`)).toMatch(new RegExp(`^name = "${name}"\\n`));
        }
        expect(files).toHaveLength(3 + 2 * agentNames.length);
    });
});

describe('readFactoryFiles with a broken source', () => {
    let root: string | null = null;

    afterEach(() => {
        if (root !== null) fs.rmSync(root, { recursive: true, force: true });
        root = null;
    });

    it('rejects an agent whose name does not match its file', () => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-factory-'));
        fs.mkdirSync(path.join(root, 'skill', 'agents'), { recursive: true });
        fs.mkdirSync(path.join(root, 'agents'));
        fs.writeFileSync(path.join(root, 'skill', 'SKILL.md'), 'skill\n');
        fs.writeFileSync(path.join(root, 'skill', 'agents', 'openai.yaml'), 'policy: {}\n');
        fs.writeFileSync(path.join(root, 'agents', 'builder.md'), SOURCE);
        expect(() => readFactoryFiles(root as string)).toThrow('builder.md: name reviewer-demo does not match the file name');
    });
});

describe('the published package', () => {
    it('ships the factory sources that init reads', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(FACTORY_ROOT, '..', 'package.json'), 'utf-8')) as {
            files: string[];
        };
        expect(pkg.files).toContain('factory');
    });
});
