import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { renderServerFn } from '../controllers/server-fn';
import { standardAction, customAction } from '../actions';
import { contextFor } from '../../__tests__/helpers/context';

const ctx = contextFor('tanstack-start', 'cat');
const file = (name: string) => path.join(ctx.featureDir, `-server/functions/${name}.fn.ts`);

describe('renderServerFn', () => {
    it('omits the validator when there is no input', () => {
        const content = renderServerFn(ctx, standardAction('List', 'Cat'), 'Cat', file('ListCat'));
        expect(content).toContain("import { createServerFn } from '@tanstack/react-start';");
        expect(content).toContain("export const listCat = createServerFn({ method: 'GET' })");
        expect(content).toContain('.handler(async () => service.handle());');
        expect(content).not.toContain('.validator(');
        expect(content).not.toContain("from 'zod'");
    });

    it('validates a bare id with z.string', () => {
        const content = renderServerFn(ctx, standardAction('Show', 'Cat'), 'Cat', file('ShowCat'));
        expect(content).toContain("import { z } from 'zod';");
        expect(content).toContain('.validator(z.string())');
        expect(content).toContain('.handler(async ({ data }) => service.handle(data));');
    });

    it('validates a create with the generated schema', () => {
        const content = renderServerFn(ctx, standardAction('Create', 'Cat'), 'Cat', file('CreateCat'));
        expect(content).toContain("export const createCat = createServerFn({ method: 'POST' })");
        expect(content).toContain('.validator(CreateCatSchema)');
        expect(content).toContain('CreateCatSchema }');
    });

    it('wraps id and payload for an update and downgrades PUT to POST', () => {
        const content = renderServerFn(ctx, standardAction('Update', 'Cat'), 'Cat', file('UpdateCat'));
        expect(content).toContain("createServerFn({ method: 'POST' })");
        expect(content).toContain('.validator(z.object({ id: z.string(), data: UpdateCatSchema }))');
        expect(content).toContain('.handler(async ({ data }) => service.handle(data.id, data.data));');
    });

    it('downgrades DELETE to POST', () => {
        const content = renderServerFn(ctx, standardAction('Delete', 'Cat'), 'Cat', file('DeleteCat'));
        expect(content).toContain("createServerFn({ method: 'POST' })");
    });

    it('handles a custom GET action with no input', () => {
        const spec = customAction('Cat', 'findActiveCats', { withInput: false, returns: 'list' });
        const content = renderServerFn(ctx, spec, 'Cat', file('FindActiveCats'));
        expect(content).toContain("export const findActiveCats = createServerFn({ method: 'GET' })");
        expect(content).not.toContain('.validator(');
    });
});
