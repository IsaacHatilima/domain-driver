import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { currentVersion, isNewer, parseVersion } from '../version';

describe('currentVersion', () => {
    it('reads the version from the package root package.json', () => {
        const expected = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf-8')).version;
        expect(currentVersion()).toBe(expected);
    });

    it('falls back to 0.0.0 when the file cannot be read', () => {
        expect(currentVersion(() => { throw new Error('nope'); })).toBe('0.0.0');
    });

    it('falls back to 0.0.0 when version is not a string', () => {
        expect(currentVersion(() => JSON.stringify({ version: 3 }))).toBe('0.0.0');
    });
});

describe('parseVersion', () => {
    it('parses major.minor.patch', () => {
        expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
        expect(parseVersion(' 0.2.0 ')).toEqual([0, 2, 0]);
    });

    it.each(['1.2', '1.2.3-beta.1', 'v1.2.3', '', 'latest'])('returns null for %s', (value) => {
        expect(parseVersion(value)).toBeNull();
    });
});

describe('isNewer', () => {
    it.each([
        ['0.3.0', '0.2.0', true],
        ['1.0.0', '0.9.9', true],
        ['0.2.1', '0.2.0', true],
        ['0.2.0', '0.2.0', false],
        ['0.1.9', '0.2.0', false],
        ['0.3.0-beta.1', '0.2.0', false],
        ['', '0.2.0', false],
        ['0.3.0', 'garbage', false],
    ])('isNewer(%s, %s) is %s', (latest, current, expected) => {
        expect(isNewer(latest, current)).toBe(expected);
    });
});
