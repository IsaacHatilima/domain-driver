import { describe, it, expect } from 'vitest';
import { parseJsonc } from '../jsonc';

describe('parseJsonc', () => {
    it('parses plain JSON', () => {
        expect(parseJsonc('{ "a": [1, 2], "b": { "c": null } }')).toEqual({ a: [1, 2], b: { c: null } });
    });

    it('drops line and block comments', () => {
        expect(parseJsonc('{\n  // line\n  "a": /* block */ 1 /* multi\n line */\n}')).toEqual({ a: 1 });
    });

    it('keeps comment markers that sit inside strings', () => {
        expect(parseJsonc('{ "glob": "**/*.ts", "alias": "@/*", "url": "https://x.dev/a" }')).toEqual({
            glob: '**/*.ts',
            alias: '@/*',
            url: 'https://x.dev/a',
        });
    });

    it('does not end a string at an escaped quote', () => {
        expect(parseJsonc('{ "a": "say \\"/* hi */\\"", "b": "c:\\\\" }')).toEqual({ a: 'say "/* hi */"', b: 'c:\\' });
    });

    it('drops trailing commas outside strings but not inside them', () => {
        expect(parseJsonc('{ "a": [1, 2,], "b": ",}", }')).toEqual({ a: [1, 2], b: ',}' });
        expect(parseJsonc('{ "a": 1, // last\n}')).toEqual({ a: 1 });
    });

    it('throws on malformed input', () => {
        expect(() => parseJsonc('{ nope')).toThrow();
        expect(() => parseJsonc('{ "a": 1 /* unterminated')).toThrow();
    });
});
