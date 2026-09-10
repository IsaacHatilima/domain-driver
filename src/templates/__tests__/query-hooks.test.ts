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
        expect(content).toContain('queryFn: (): Promise<Cat[]> => service.handle(),');
        expect(content).not.toContain('useMutation');
    });

    it('renders a detail query against the detail key', () => {
        const content = renderQueryHook(ctx, standardAction('Show', 'Cat'), 'Cat', file('ShowCat'));
        expect(content).toContain('export function useShowCat(id: string)');
        expect(content).toContain('queryKey: catKeys.detail(id),');
    });

    it('renders a create mutation that invalidates the list', () => {
        const content = renderQueryHook(ctx, standardAction('Create', 'Cat'), 'Cat', file('CreateCat'));
        expect(content).toContain("import { useMutation, useQueryClient } from '@tanstack/react-query';");
        expect(content).toContain('mutationFn: (data: CreateCat): Promise<Cat> => service.handle(data),');
        expect(content).toContain('void queryClient.invalidateQueries({ queryKey: catKeys.all });');
    });

    it('wraps a two-argument mutation in one object and invalidates both keys', () => {
        const content = renderQueryHook(ctx, standardAction('Update', 'Cat'), 'Cat', file('UpdateCat'));
        expect(content).toContain('mutationFn: ({ id, data }: { id: string; data: UpdateCat }): Promise<Cat> => service.handle(id, data),');
        expect(content).toContain('onSuccess: (_result, { id }) => {');
        expect(content).toContain('void queryClient.invalidateQueries({ queryKey: catKeys.detail(id) });');
    });

    it('passes the id straight through for a delete mutation', () => {
        const content = renderQueryHook(ctx, standardAction('Delete', 'Cat'), 'Cat', file('DeleteCat'));
        expect(content).toContain('mutationFn: (id: string): Promise<void> => service.handle(id),');
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

    it('renders a void custom action as a mutation, not an auto-firing query', () => {
        const spec = customAction('Cat', 'purgeCats', { withInput: false, returns: 'void' });
        const content = renderQueryHook(ctx, spec, 'Cat', file('PurgeCats'));

        expect(content).toContain("import { useMutation, useQueryClient } from '@tanstack/react-query';");
        expect(content).toContain('export function usePurgeCats() {');
        expect(content).toContain('mutationFn: (): Promise<void> => service.handle(),');
        expect(content).toContain('onSuccess: () => {');
        expect(content).toContain('void queryClient.invalidateQueries({ queryKey: catKeys.all });');
        expect(content).not.toContain('import { useQuery }');
        expect(content).not.toContain('queryFn');
    });
});
