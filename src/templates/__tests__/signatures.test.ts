import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { domainImports } from '../signatures';
import { standardAction } from '../actions';
import { contextFor } from '../../__tests__/helpers/context';
import { createTempProject, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('signatures');
});

afterEach(() => project.cleanup());

describe('domainImports', () => {
    it('imports type and schema for Create from a top-level layer', () => {
        const ctx = contextFor('next-frontend', 'cat');
        const fromFile = path.join(ctx.featureDir, 'services', 'CreateCat.service.ts');
        expect(domainImports(ctx, fromFile, standardAction('Create', 'Cat'), 'Cat')).toEqual([
            "import { Cat } from '../types/Cat.types';",
            "import { CreateCat } from '../schemas/CreateCat.schema';",
        ]);
    });

    it('imports nothing for Delete', () => {
        const ctx = contextFor('next-frontend', 'cat');
        const fromFile = path.join(ctx.featureDir, 'services', 'DeleteCat.service.ts');
        expect(domainImports(ctx, fromFile, standardAction('Delete', 'Cat'), 'Cat')).toEqual([]);
    });

    it('walks up two levels from fullstack client layers', () => {
        const ctx = contextFor('next-fullstack', 'cat');
        const fromFile = path.join(ctx.featureDir, 'client', 'services', 'ListCat.service.ts');
        expect(domainImports(ctx, fromFile, standardAction('List', 'Cat'), 'Cat')).toEqual([
            "import { Cat } from '../../types/Cat.types';",
        ]);
    });
});
