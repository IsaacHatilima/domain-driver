import { describe, it, expect } from 'vitest';
import { parseFeatureTarget, parseTarget } from '../target';

describe('parseTarget', () => {
    it('splits feature and name', () => {
        expect(parseTarget('users/User')).toEqual({ feature: 'users', name: 'User' });
        expect(parseTarget('coffee-type/useCoffeeType')).toEqual({ feature: 'coffee-type', name: 'useCoffeeType' });
    });

    it.each(['users', 'users/User/extra', 'a/b/c'])('rejects %s', (value) => {
        expect(() => parseTarget(value)).toThrow(`Target "${value}" must be <feature>/<Name>, for example users/User.`);
    });

    it('rejects a bad feature part', () => {
        expect(() => parseTarget('Users/User')).toThrow('Feature name "Users" must be kebab-case, for example coffee-type.');
    });

    it.each(['users/', 'users/user-card', 'users/1User', 'users/User Card'])('rejects a bad name part in %s', (value) => {
        const name = value.slice(value.indexOf('/') + 1);
        expect(() => parseTarget(value)).toThrow(`Name "${name}" must be letters and digits only, for example User.`);
    });
});

describe('parseFeatureTarget', () => {
    it('accepts a bare feature', () => {
        expect(parseFeatureTarget('users')).toEqual({ feature: 'users', entity: null });
    });

    it('accepts feature/Entity', () => {
        expect(parseFeatureTarget('users/User')).toEqual({ feature: 'users', entity: 'User' });
    });

    it('rejects two slashes', () => {
        expect(() => parseFeatureTarget('a/b/c')).toThrow(
            'Target "a/b/c" must be <feature> or <feature>/<Entity>, for example users or users/User.'
        );
    });

    it('validates both parts', () => {
        expect(() => parseFeatureTarget('Users')).toThrow('must be kebab-case');
        expect(() => parseFeatureTarget('users/user')).not.toThrow();
        expect(() => parseFeatureTarget('users/')).toThrow('Name "" must be letters and digits only, for example User.');
    });
});
