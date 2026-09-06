import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { actionSignature, domainImports } from '../signatures';
import { contextFor } from '../../__tests__/helpers/context';
import { createTempProject, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('signatures');
});

afterEach(() => project.cleanup());

describe('actionSignature', () => {
    it('List takes nothing and returns an array', () => {
        expect(actionSignature('List', 'Cat')).toEqual({
            params: '',
            args: '',
            returns: 'Promise<Cat[]>',
            usesEntityType: true,
            usesSchema: false,
        });
    });

    it('Update takes id and data', () => {
        expect(actionSignature('Update', 'Cat')).toEqual({
            params: 'id: string, data: UpdateCat',
            args: 'id, data',
            returns: 'Promise<Cat>',
            usesEntityType: true,
            usesSchema: true,
        });
    });

    it('Delete returns void and uses no entity type', () => {
        expect(actionSignature('Delete', 'Cat')).toEqual({
            params: 'id: string',
            args: 'id',
            returns: 'Promise<void>',
            usesEntityType: false,
            usesSchema: false,
        });
    });
});

describe('domainImports', () => {
    it('imports type and schema for Create from a top-level layer', () => {
        const ctx = contextFor('next-frontend', 'cat');
        const fromFile = path.join(ctx.featureDir, 'services', 'CreateCat.service.ts');
        expect(domainImports(ctx, fromFile, 'Create', 'Cat')).toEqual([
            "import { Cat } from '../types/Cat.types';",
            "import { CreateCat } from '../schemas/CreateCat.schema';",
        ]);
    });

    it('imports nothing for Delete', () => {
        const ctx = contextFor('next-frontend', 'cat');
        const fromFile = path.join(ctx.featureDir, 'services', 'DeleteCat.service.ts');
        expect(domainImports(ctx, fromFile, 'Delete', 'Cat')).toEqual([]);
    });

    it('walks up two levels from fullstack client layers', () => {
        const ctx = contextFor('next-fullstack', 'cat');
        const fromFile = path.join(ctx.featureDir, 'client', 'services', 'ListCat.service.ts');
        expect(domainImports(ctx, fromFile, 'List', 'Cat')).toEqual([
            "import { Cat } from '../../types/Cat.types';",
        ]);
    });
});
