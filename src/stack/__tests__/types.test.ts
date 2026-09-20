import { describe, it, expect } from 'vitest';
import { STACK_NAMES, HTTP_FRAMEWORKS, LAYERS, isStackName } from '../types';

describe('stack types', () => {
    it('lists the six stacks in priority order', () => {
        expect(STACK_NAMES).toEqual([
            'next-fullstack',
            'next-frontend',
            'react',
            'node',
            'nest',
            'tanstack-start',
        ]);
    });

    it('lists http frameworks in detection order', () => {
        expect(HTTP_FRAMEWORKS).toEqual(['express', 'fastify', 'hono']);
    });

    it('lists every layer', () => {
        expect(LAYERS).toEqual([
            'page',
            'component',
            'container',
            'hook',
            'serverService',
            'serverRepository',
            'controller',
            'module',
            'dto',
            'schema',
            'types',
        ]);
        expect(LAYERS).toHaveLength(11);
        expect(LAYERS).toContain('module');
    });

    it('has no client service or client repository layer', () => {
        expect(LAYERS).not.toContain('clientService');
        expect(LAYERS).not.toContain('clientRepository');
    });

    it('isStackName guards unknown values', () => {
        expect(isStackName('nest')).toBe(true);
        expect(isStackName('remix')).toBe(false);
    });
});
