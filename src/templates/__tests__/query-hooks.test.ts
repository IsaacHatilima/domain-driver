import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { renderQueryHook } from '../frontend/query-hook';
import { renderQueryKeys } from '../frontend/query-keys';
import { customAction, standardAction } from '../actions';
import { contextFor } from '../../__tests__/helpers/context';

describe('renderQueryKeys', () => {
    it('camelCases the constant and keeps the kebab key', () => {
        const content = renderQueryKeys('coffee-type');
        expect(content).toContain('export const coffeeTypeKeys = {');
        expect(content).toContain("all: ['coffee-type'] as const,");
        expect(content).toContain("detail: (id: string) => ['coffee-type', id] as const,");
    });
});

describe('renderQueryHook', () => {
    const ctx = contextFor('tanstack-start', 'cat');
    const file = (name: string) => path.join(ctx.featureDir, `-hooks/${name}.hook.ts`);

    it('renders a list query against the all key', () => {
        const content = renderQueryHook(ctx, standardAction('List', 'Cat'), 'Cat', file('ListCat'));
        expect(content).toContain("import { useQuery } from '@tanstack/react-query';");
        expect(content).toContain('queryKey: catKeys.all,');
        expect(content).toContain('queryFn: async (): Promise<Cat[]> => z.array(CatSchema).parse(await listCat()),');
        expect(content).toContain("import { z } from 'zod';");
        expect(content).toContain("import { CatSchema } from '../-schemas/Cat.schema';");
        expect(content).toContain("import { listCat } from '../-server/functions/ListCat.fn';");
        expect(content).not.toContain('Service');
        expect(content).not.toContain('useMutation');
    });

    it('renders a detail query against the detail key', () => {
        const content = renderQueryHook(ctx, standardAction('Show', 'Cat'), 'Cat', file('ShowCat'));
        expect(content).toContain('export function useShowCat(id: string)');
        expect(content).toContain('queryKey: catKeys.detail(id),');
        expect(content).toContain('queryFn: async (): Promise<Cat> => CatSchema.parse(await showCat({ data: id })),');
        expect(content).not.toContain("from 'zod'");
    });

    it('renders a create mutation that invalidates the list', () => {
        const content = renderQueryHook(ctx, standardAction('Create', 'Cat'), 'Cat', file('CreateCat'));
        expect(content).toContain("import { useMutation, useQueryClient } from '@tanstack/react-query';");
        expect(content).toContain('mutationFn: async (data: CreateCat): Promise<Cat> => CatSchema.parse(await createCat({ data })),');
        expect(content).not.toContain('Service');
        expect(content).toContain('void queryClient.invalidateQueries({ queryKey: catKeys.all });');
    });

    it('wraps a two-argument mutation in one object and invalidates both keys', () => {
        const content = renderQueryHook(ctx, standardAction('Update', 'Cat'), 'Cat', file('UpdateCat'));
        expect(content).toContain(
            'mutationFn: async ({ id, data }: { id: string; data: UpdateCat }): Promise<Cat> =>\n      CatSchema.parse(await updateCat({ data: { id, data } })),'
        );
        expect(content).toContain('onSuccess: (_result, { id }) => {');
        expect(content).toContain('void queryClient.invalidateQueries({ queryKey: catKeys.detail(id) });');
    });

    it('passes the id straight through for a delete mutation', () => {
        const content = renderQueryHook(ctx, standardAction('Delete', 'Cat'), 'Cat', file('DeleteCat'));
        expect(content).toContain('mutationFn: (id: string): Promise<void> => deleteCat({ data: id }),');
        expect(content).not.toContain('CatSchema');
        expect(content).toContain('onSuccess: (_result, id) => {');
    });

    it('gives List, Show, and a custom GET action three distinct query keys', () => {
        const listContent = renderQueryHook(ctx, standardAction('List', 'Cat'), 'Cat', file('ListCat'));
        const showContent = renderQueryHook(ctx, standardAction('Show', 'Cat'), 'Cat', file('ShowCat'));
        const customContent = renderQueryHook(
            ctx,
            customAction('Cat', 'findActiveCats', { withInput: false, returns: 'list' }),
            'Cat',
            file('FindActiveCats')
        );

        expect(listContent).toContain('queryKey: catKeys.all,');
        expect(showContent).toContain('queryKey: catKeys.detail(id),');
        expect(customContent).toContain("queryKey: [...catKeys.all, 'FindActiveCats'],");

        // Regression guard: a custom GET action must never fall back to the exact same key
        // expression as List (or Show) — same expression means the same TanStack Query cache
        // entry, so the last-mounting hook's data would silently win under the other's name.
        expect(customContent).not.toContain('queryKey: catKeys.all,');
        expect(customContent).not.toContain('queryKey: catKeys.detail(id),');
    });

    it('keys a GET on one record under its detail key, apart from Show', () => {
        const spec = customAction('Cat', 'catHistory', { withInput: false, returns: 'list', onRecord: true });
        const content = renderQueryHook(ctx, spec, 'Cat', file('CatHistory'));

        expect(content).toContain('export function useCatHistory(id: string)');
        expect(content).toContain("queryKey: [...catKeys.detail(id), 'CatHistory'],");
        expect(content).not.toContain('queryKey: catKeys.detail(id),');
    });

    it('keeps a distinct key for a custom GET routed at the feature root', () => {
        const flow = contextFor('tanstack-start', 'active-cats');
        const spec = customAction('Cat', 'activeCats', { withInput: false, returns: 'list' }, 'active-cats');
        const content = renderQueryHook(flow, spec, 'Cat', path.join(flow.featureDir, '-hooks/ActiveCats.hook.ts'));

        expect(spec.path).toBe('/');
        expect(content).toContain("queryKey: [...activeCatsKeys.all, 'ActiveCats'],");
    });

    it('renders a PATCH on one record as a mutation that invalidates the record', () => {
        const spec = customAction('Cat', 'archiveCat', { withInput: false, returns: 'one', method: 'patch', onRecord: true });
        const content = renderQueryHook(ctx, spec, 'Cat', file('ArchiveCat'));

        expect(content).toContain('export function useArchiveCat() {');
        expect(content).toContain(
            'mutationFn: async (id: string): Promise<Cat> => CatSchema.parse(await archiveCat({ data: id })),'
        );
        expect(content).toContain('onSuccess: (_result, id) => {');
        expect(content).toContain('void queryClient.invalidateQueries({ queryKey: catKeys.detail(id) });');
    });

    it('passes the input of a GET to the server function and keys the query on it', () => {
        const spec = customAction('Cat', 'searchCats', { withInput: true, returns: 'list', method: 'get' });
        const content = renderQueryHook(ctx, spec, 'Cat', file('SearchCats'));

        expect(content).toContain("import type { SearchCats } from '../-schemas/SearchCats.schema';");
        expect(content).toContain('export function useSearchCats(query: SearchCats) {');
        expect(content).toContain("queryKey: [...catKeys.all, 'SearchCats', query],");
        expect(content).toContain('queryFn: async (): Promise<Cat[]> => z.array(CatSchema).parse(await searchCats({ data: query })),');
    });

    it('keys a GET with input on one record under the record and the query', () => {
        const spec = customAction('Cat', 'catHistory', { withInput: true, returns: 'list', method: 'get', onRecord: true });
        const content = renderQueryHook(ctx, spec, 'Cat', file('CatHistory'));

        expect(content).toContain('export function useCatHistory(id: string, query: CatHistory) {');
        expect(content).toContain("queryKey: [...catKeys.detail(id), 'CatHistory', query],");
        expect(content).toContain('await catHistory({ data: { id, data: query } })');
    });

    it('calls a void GET with input as a mutation that passes the query', () => {
        const spec = customAction('Cat', 'exportCats', { withInput: true, returns: 'void', method: 'get' });
        const content = renderQueryHook(ctx, spec, 'Cat', file('ExportCats'));

        expect(content).toContain('mutationFn: (query: ExportCats): Promise<void> => exportCats({ data: query }),');
    });

    it('renders a void custom action as a mutation, not an auto-firing query', () => {
        const spec = customAction('Cat', 'purgeCats', { withInput: false, returns: 'void' });
        const content = renderQueryHook(ctx, spec, 'Cat', file('PurgeCats'));

        expect(content).toContain("import { useMutation, useQueryClient } from '@tanstack/react-query';");
        expect(content).toContain('export function usePurgeCats() {');
        expect(content).toContain('mutationFn: (): Promise<void> => purgeCats(),');
        expect(content).toContain("import { purgeCats } from '../-server/functions/PurgeCats.fn';");
        expect(content).toContain('onSuccess: () => {');
        expect(content).toContain('void queryClient.invalidateQueries({ queryKey: catKeys.all });');
        expect(content).not.toContain('import { useQuery }');
        expect(content).not.toContain('queryFn');
    });
});
