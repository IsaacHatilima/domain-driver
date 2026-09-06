import { describe, it, expect } from 'vitest';
import { applySection, END, START } from '../markers';

const section = `${START}\nhello\n${END}`;

describe('applySection', () => {
    it('creates the file content when nothing exists', () => {
        expect(applySection(null, section)).toEqual({ content: `${section}\n`, status: 'created' });
    });

    it('appends after a blank line when there are no markers', () => {
        expect(applySection('# Title\n', section)).toEqual({ content: `# Title\n\n${section}\n`, status: 'updated' });
    });

    it('adds the missing newline before appending', () => {
        expect(applySection('# Title', section)).toEqual({ content: `# Title\n\n${section}\n`, status: 'updated' });
    });

    it('replaces between markers and keeps everything else byte for byte', () => {
        const existing = `# Title\n\n${START}\nold\n${END}\n\n## Notes\nkeep me\n`;
        expect(applySection(existing, section)).toEqual({
            content: `# Title\n\n${section}\n\n## Notes\nkeep me\n`,
            status: 'updated',
        });
    });

    it('reports unchanged when the section is already current', () => {
        const existing = `intro\n${section}\noutro\n`;
        expect(applySection(existing, section)).toEqual({ content: existing, status: 'unchanged' });
    });

    it('appends when only one marker is present', () => {
        const existing = `${START}\nbroken\n`;
        expect(applySection(existing, section).content).toBe(`${existing}\n${section}\n`);
    });
});
