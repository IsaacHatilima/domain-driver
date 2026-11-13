import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { renderTypes } from '../shared/types';
import { renderEntitySchema, renderSchema } from '../shared/schema';
import { contextFor } from '../../__tests__/helpers/context';
import { createTempProject, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('shared-templates');
});

afterEach(() => project.cleanup());

describe('renderTypes', () => {
    it('derives the entity type from its schema instead of a parallel interface', () => {
        const ctx = contextFor('react', 'cat');
        const content = renderTypes(ctx, 'Cat', path.join(ctx.featureDir, 'types', 'Cat.types.ts'));
        expect(content).toBe(`import type { z } from 'zod';
import type { CatSchema } from '../schemas/Cat.schema';

export type Cat = z.infer<typeof CatSchema>;
`);
        expect(content).not.toContain('interface');
    });

    it('reaches the schema through the profile layer folders', () => {
        const ctx = contextFor('tanstack-start', 'cat');
        const content = renderTypes(ctx, 'Cat', path.join(ctx.featureDir, '-types', 'Cat.types.ts'));
        expect(content).toContain("import type { CatSchema } from '../-schemas/Cat.schema';");
    });
});

describe('renderEntitySchema', () => {
    it('renders the record with its id and timestamps and room for the fields', () => {
        expect(renderEntitySchema('Cat')).toBe(`import { z } from 'zod';

export const CatSchema = z.object({
  id: z.string(),
  // add Cat fields here
  createdAt: z.string(),
  updatedAt: z.string(),
});
`);
    });
});

describe('renderSchema', () => {
    it('renders the Create schema and inferred type', () => {
        const content = renderSchema('CreateCat', 'create');
        expect(content).toContain("import { z } from 'zod';");
        expect(content).toContain('export const CreateCatSchema = z.object({');
        expect(content).toContain('export type CreateCat = z.infer<typeof CreateCatSchema>;');
        expect(content).toContain('// add create fields here');
    });

    it('renders the Update schema without an id field', () => {
        const content = renderSchema('UpdateCat', 'update');
        expect(content).toContain('export const UpdateCatSchema = z.object({');
        expect(content).not.toContain('id: z.string()');
    });
});
