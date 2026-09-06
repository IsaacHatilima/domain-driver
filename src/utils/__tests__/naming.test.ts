import { describe, it, expect } from 'vitest';
import { toPascalCase, lowerFirst, validateFeatureName } from '../naming';

describe('toPascalCase', () => {
    it('converts kebab-case to PascalCase', () => {
        expect(toPascalCase('coffee-type')).toBe('CoffeeType');
    });

    it('handles a single word', () => {
        expect(toPascalCase('user')).toBe('User');
    });

    it('handles multiple hyphens', () => {
        expect(toPascalCase('my-long-feature-name')).toBe('MyLongFeatureName');
    });
});

describe('lowerFirst', () => {
    it('lowercases the first character only', () => {
        expect(lowerFirst('CreateCat')).toBe('createCat');
    });

    it('returns an empty string unchanged', () => {
        expect(lowerFirst('')).toBe('');
    });
});

describe('validateFeatureName', () => {
    it.each(['cat', 'coffee-type', 'a1', 'v2-api'])('accepts %s', (name) => {
        expect(() => validateFeatureName(name)).not.toThrow();
    });

    it.each(['Cat', 'coffee_type', '-cat', 'cat-', 'coffee--type', 'coffee type', ''])(
        'rejects %s',
        (name) => {
            expect(() => validateFeatureName(name)).toThrow(
                `Feature name "${name}" must be kebab-case, for example coffee-type.`
            );
        }
    );
});
