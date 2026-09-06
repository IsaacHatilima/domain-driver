import { describe, it, expect } from 'vitest';
import { STACK_NAMES, HTTP_FRAMEWORKS, LAYERS, isStackName } from '../types';

describe('stack types', () => {
    it('lists the five stacks in priority order', () => {
        expect(STACK_NAMES).toEqual(['next-fullstack', 'next-frontend', 'react', 'node', 'nest']);
    });

    it('lists http frameworks in detection order', () => {
        expect(HTTP_FRAMEWORKS).toEqual(['express', 'fastify', 'hono']);
    });

    it('lists every layer', () => {
        expect(LAYERS).toHaveLength(13);
        expect(LAYERS).toContain('clientRepository');
        expect(LAYERS).toContain('module');
    });

    it('isStackName guards unknown values', () => {
        expect(isStackName('nest')).toBe(true);
        expect(isStackName('remix')).toBe(false);
    });
});
