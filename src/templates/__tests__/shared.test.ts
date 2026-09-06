import { describe, it, expect } from 'vitest';
import { renderTypes } from '../shared/types';
import { renderSchema } from '../shared/schema';

describe('renderTypes', () => {
    it('renders an interface with id and timestamps', () => {
        const content = renderTypes('Cat');
        expect(content).toContain('export interface Cat {');
        expect(content).toContain('id: string;');
        expect(content).toContain('createdAt: string;');
    });
});

describe('renderSchema', () => {
    it('renders the Create schema and inferred type', () => {
        const content = renderSchema('Create', 'Cat');
        expect(content).toContain("import { z } from 'zod';");
        expect(content).toContain('export const CreateCatSchema = z.object({');
        expect(content).toContain('export type CreateCat = z.infer<typeof CreateCatSchema>;');
    });

    it('renders the Update schema without an id field', () => {
        const content = renderSchema('Update', 'Cat');
        expect(content).toContain('export const UpdateCatSchema = z.object({');
        expect(content).not.toContain('id: z.string()');
    });
});
