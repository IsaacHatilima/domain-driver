import { describe, it, expect } from 'vitest';
import { toPascalCase, lowerFirst, validateFeatureName, upperFirst, toKebabCase, pluralize, stripEntity } from '../naming';

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

describe('upperFirst', () => {
    it('uppercases the first character only', () => {
        expect(upperFirst('findActiveUsers')).toBe('FindActiveUsers');
        expect(upperFirst('')).toBe('');
    });
});

describe('toKebabCase', () => {
    it.each([
        ['FindActiveUsers', 'find-active-users'],
        ['findActiveUsers', 'find-active-users'],
        ['archiveUser', 'archive-user'],
        ['ExportCSV', 'export-csv'],
        ['ParseHTMLDoc', 'parse-html-doc'],
        ['List', 'list'],
    ])('converts %s to %s', (input, expected) => {
        expect(toKebabCase(input)).toBe(expected);
    });
});

describe('pluralize', () => {
    it.each([
        ['Project', 'Projects'],
        ['Category', 'Categories'],
        ['Key', 'Keys'],
        ['Address', 'Addresses'],
        ['Box', 'Boxes'],
        ['Batch', 'Batches'],
        ['Wish', 'Wishes'],
        ['CoffeeType', 'CoffeeTypes'],
    ])('%s becomes %s', (word, plural) => {
        expect(pluralize(word)).toBe(plural);
    });
});

describe('stripEntity', () => {
    it.each([
        ['ArchiveProject', 'Project', 'Archive'],
        ['ListProjects', 'Project', 'List'],
        ['FindActiveProjects', 'Project', 'FindActive'],
        ['ProjectHistory', 'Project', 'History'],
        ['CreateProject', 'Project', 'Create'],
        ['Project', 'Project', ''],
        ['Login', 'Session', 'Login'],
        ['ProjectsReport', 'Project', 'Report'],
        ['ArchiveCategories', 'Category', 'Archive'],
    ])('%s without %s is "%s"', (name, entity, verb) => {
        expect(stripEntity(name, entity)).toBe(verb);
    });

    it('only removes the entity as a whole word', () => {
        expect(stripEntity('ProjectileLaunch', 'Project')).toBe('ProjectileLaunch');
    });
});
