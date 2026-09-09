import { describe, it, expect } from 'vitest';
import { getProfile, hasLayer, layerDir, componentDir, availableCommands, assertLayer } from '../registry';
import { STACK_NAMES } from '../types';

describe('profiles', () => {
    it.each(STACK_NAMES)('%s profile is frozen and named', (name) => {
        const profile = getProfile(name);
        expect(profile.name).toBe(name);
        expect(Object.isFrozen(profile)).toBe(true);
    });

    it('next-fullstack declares split client and server folders', () => {
        expect(getProfile('next-fullstack').folders).toEqual([
            'components/client',
            'components/server',
            'containers',
            'hooks',
            'client/services',
            'client/repositories',
            'server/services',
            'server/repositories',
            'schemas',
            'types',
        ]);
    });

    it('next-frontend keeps the current layout', () => {
        expect(getProfile('next-frontend').folders).toEqual([
            'components/client',
            'components/server',
            'containers',
            'hooks',
            'services',
            'repositories',
            'schemas',
            'types',
        ]);
    });

    it('react flattens components and has no page', () => {
        const profile = getProfile('react');
        expect(profile.folders).toEqual([
            'components',
            'containers',
            'hooks',
            'services',
            'repositories',
            'schemas',
            'types',
        ]);
        expect(hasLayer(profile, 'page')).toBe(false);
        expect(profile.clientDirective).toBe(false);
        expect(profile.serverComponents).toBe(false);
    });

    it('node has backend layers only', () => {
        const profile = getProfile('node');
        expect(profile.folders).toEqual(['controllers', 'services', 'repositories', 'schemas', 'types']);
        expect(profile.layers).toEqual(['serverService', 'serverRepository', 'controller', 'schema', 'types']);
    });

    it('nest adds dto and module layers', () => {
        const profile = getProfile('nest');
        expect(profile.folders).toEqual(['controllers', 'services', 'repositories', 'schemas', 'dto', 'types']);
        expect(hasLayer(profile, 'module')).toBe(true);
        expect(hasLayer(profile, 'dto')).toBe(true);
        expect(hasLayer(profile, 'hook')).toBe(false);
    });

    it('next profiles emit the client directive and have server components', () => {
        for (const name of ['next-fullstack', 'next-frontend'] as const) {
            expect(getProfile(name).clientDirective).toBe(true);
            expect(getProfile(name).serverComponents).toBe(true);
        }
    });
});

describe('layerDir', () => {
    it('maps fullstack client and server layers to their subfolders', () => {
        const profile = getProfile('next-fullstack');
        expect(layerDir(profile, 'clientService')).toBe('client/services');
        expect(layerDir(profile, 'serverRepository')).toBe('server/repositories');
    });

    it('maps node layers to top-level folders', () => {
        expect(layerDir(getProfile('node'), 'controller')).toBe('controllers');
    });

    it('throws for a layer the profile lacks', () => {
        expect(() => layerDir(getProfile('node'), 'hook')).toThrow(
            'Layer "hook" has no directory in the node profile.'
        );
    });
});

describe('componentDir', () => {
    it('splits by type when the stack has server components', () => {
        expect(componentDir(getProfile('next-frontend'), 'server')).toBe('components/server');
        expect(componentDir(getProfile('next-frontend'), 'client')).toBe('components/client');
    });

    it('splits by type for next-fullstack too', () => {
        expect(componentDir(getProfile('next-fullstack'), 'client')).toBe('components/client');
        expect(componentDir(getProfile('next-fullstack'), 'server')).toBe('components/server');
    });

    it('flattens for react', () => {
        expect(componentDir(getProfile('react'), 'client')).toBe('components');
    });

    it('uses the dash-prefixed directory for tanstack-start', () => {
        expect(componentDir(getProfile('tanstack-start'), 'client')).toBe('-components');
    });
});

describe('assertLayer', () => {
    it('passes when the layer exists', () => {
        expect(() => assertLayer(getProfile('react'), 'hook', 'make:hook')).not.toThrow();
    });

    it('lists available commands when the layer is missing', () => {
        expect(() => assertLayer(getProfile('node'), 'hook', 'make:hook')).toThrow(
            'make:hook is not available for the node stack. Available: make:service, make:repository, make:controller, make:schema, make:types.'
        );
    });

    it('appends an escape hatch when make:controller is missing on next-frontend', () => {
        expect(() => assertLayer(getProfile('next-frontend'), 'controller', 'make:controller')).toThrow(
            'make:controller is not available for the next-frontend stack. Available: make:component, make:container, ' +
                'make:hook, make:service, make:repository, make:schema, make:types. Create an app/api directory or ' +
                'pass --stack next-fullstack to enable route handlers.'
        );
    });

    it('availableCommands de-duplicates service and repository sides', () => {
        expect(availableCommands(getProfile('next-fullstack'))).toEqual([
            'make:component',
            'make:container',
            'make:hook',
            'make:service',
            'make:repository',
            'make:controller',
            'make:schema',
            'make:types',
        ]);
    });
});
