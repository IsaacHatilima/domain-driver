import { describe, it, expect } from 'vitest';
import { getProfile, hasLayer, layerDir, componentDir, availableCommands, assertLayer } from '../registry';
import { STACK_NAMES } from '../types';

describe('profiles', () => {
    it.each(STACK_NAMES)('%s profile is frozen and named', (name) => {
        const profile = getProfile(name);
        expect(profile.name).toBe(name);
        expect(Object.isFrozen(profile)).toBe(true);
    });

    it('next-fullstack keeps services and repositories on the server only', () => {
        const profile = getProfile('next-fullstack');
        expect(profile.folders).toEqual([
            'components/client',
            'components/server',
            'containers',
            'hooks',
            'server/services',
            'server/repositories',
            'schemas',
            'types',
        ]);
        expect(profile.folders).not.toContain('client/services');
        expect(profile.folders).not.toContain('client/repositories');
        expect(Object.keys(profile.layerDirs)).not.toContain('clientService');
        expect(Object.keys(profile.layerDirs)).not.toContain('clientRepository');
    });

    it('next-frontend has no service or repository layer at all', () => {
        const profile = getProfile('next-frontend');
        expect(profile.folders).toEqual([
            'components/client',
            'components/server',
            'containers',
            'hooks',
            'schemas',
            'types',
        ]);
        expect(profile.folders).not.toContain('services');
        expect(profile.folders).not.toContain('repositories');
        expect(hasLayer(profile, 'serverService')).toBe(false);
        expect(hasLayer(profile, 'serverRepository')).toBe(false);
    });

    it('react flattens components, has no page and no service or repository layer', () => {
        const profile = getProfile('react');
        expect(profile.folders).toEqual(['components', 'containers', 'hooks', 'schemas', 'types']);
        expect(profile.folders).not.toContain('services');
        expect(profile.folders).not.toContain('repositories');
        expect(hasLayer(profile, 'page')).toBe(false);
        expect(hasLayer(profile, 'serverService')).toBe(false);
        expect(hasLayer(profile, 'serverRepository')).toBe(false);
        expect(profile.clientDirective).toBe(false);
        expect(profile.serverComponents).toBe(false);
    });

    it('tanstack-start keeps services and repositories on the server only', () => {
        const profile = getProfile('tanstack-start');
        expect(profile.folders).toEqual([
            '-components',
            '-containers',
            '-hooks',
            '-server/functions',
            '-server/services',
            '-server/repositories',
            '-schemas',
            '-types',
        ]);
        expect(profile.folders).not.toContain('-client/services');
        expect(profile.folders).not.toContain('-client/repositories');
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
    it('maps fullstack server layers to their subfolders', () => {
        const profile = getProfile('next-fullstack');
        expect(layerDir(profile, 'serverService')).toBe('server/services');
        expect(layerDir(profile, 'serverRepository')).toBe('server/repositories');
    });

    it('maps tanstack-start server layers to their dash-prefixed subfolders', () => {
        const profile = getProfile('tanstack-start');
        expect(layerDir(profile, 'serverService')).toBe('-server/services');
        expect(layerDir(profile, 'serverRepository')).toBe('-server/repositories');
    });

    it('maps node layers to top-level folders', () => {
        expect(layerDir(getProfile('node'), 'controller')).toBe('controllers');
    });

    it('throws for a layer the profile lacks', () => {
        expect(() => layerDir(getProfile('node'), 'hook')).toThrow(
            'Layer "hook" has no directory in the node profile.'
        );
    });

    it('throws for the service layer on a stack with no server side', () => {
        expect(() => layerDir(getProfile('react'), 'serverService')).toThrow(
            'Layer "serverService" has no directory in the react profile.'
        );
        expect(() => layerDir(getProfile('next-frontend'), 'serverRepository')).toThrow(
            'Layer "serverRepository" has no directory in the next-frontend profile.'
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
                'make:hook, make:schema, make:types. Create an app/api directory or ' +
                'pass --stack next-fullstack to enable route handlers.'
        );
    });

    it('explains the architecture when make:service is missing on react', () => {
        expect(() => assertLayer(getProfile('react'), 'serverService', 'make:service')).toThrow(
            'make:service is not available for the react stack. Available: make:component, make:container, ' +
                'make:hook, make:schema, make:types. Services and repositories live behind the API, and the ' +
                'react stack has no server side. Its hooks call the API directly.'
        );
    });

    it('explains the architecture when make:repository is missing on next-frontend', () => {
        expect(() => assertLayer(getProfile('next-frontend'), 'serverRepository', 'make:repository')).toThrow(
            'make:repository is not available for the next-frontend stack. Available: make:component, make:container, ' +
                'make:hook, make:schema, make:types. Services and repositories live behind the API, and the ' +
                'next-frontend stack has no server side. Its hooks call the API directly.'
        );
    });

    it('availableCommands lists every command a fullstack profile exposes', () => {
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

    it('availableCommands de-duplicates layers that share a command', () => {
        expect(availableCommands(getProfile('nest'))).toEqual([
            'make:service',
            'make:repository',
            'make:controller',
            'make:schema',
            'make:types',
        ]);
    });
});
