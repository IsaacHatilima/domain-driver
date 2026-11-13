import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { renderPage } from '../frontend/page';
import { renderRoute } from '../frontend/route';
import { renderComponent } from '../frontend/component';
import { renderContainer } from '../frontend/container';
import { renderHook } from '../frontend/hook';
import { customAction, standardAction } from '../actions';
import { contextFor } from '../../__tests__/helpers/context';
import { createTempProject, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('frontend-templates');
});

afterEach(() => project.cleanup());

describe('renderPage', () => {
    it('renders a plain page without container', () => {
        const ctx = contextFor('next-frontend', 'coffee-type');
        const content = renderPage(ctx, 'CoffeeType', path.join(ctx.featureDir, 'page.tsx'), false);
        expect(content).toContain('export default function CoffeeTypePage()');
        expect(content).toContain('<h1>CoffeeType</h1>');
        expect(content).not.toContain('import');
    });

    it('imports and renders the container when requested', () => {
        const ctx = contextFor('next-frontend', 'coffee-type');
        const content = renderPage(ctx, 'CoffeeType', path.join(ctx.featureDir, 'page.tsx'), true);
        expect(content).toContain("import CoffeeTypeContainer from './containers/CoffeeTypeContainer';");
        expect(content).toContain('<CoffeeTypeContainer />');
    });
});

describe('renderRoute', () => {
    it('renders a bare route without a container', () => {
        const ctx = contextFor('tanstack-start', 'coffee-type');
        const content = renderRoute(ctx, 'CoffeeType', path.join(ctx.featureDir, 'index.tsx'), false);
        expect(content).toContain("import { createFileRoute } from '@tanstack/react-router';");
        expect(content).toContain("export const Route = createFileRoute('/coffee-type/')({");
        expect(content).toContain('component: CoffeeTypePage,');
        expect(content).toContain('<h1>CoffeeType</h1>');
    });

    it('imports the container as a default import when asked', () => {
        const ctx = contextFor('tanstack-start', 'cat');
        const content = renderRoute(ctx, 'Cat', path.join(ctx.featureDir, 'index.tsx'), true);
        expect(content).toContain("import CatContainer from './-containers/CatContainer';");
        expect(content).toContain('<CatContainer />');
    });
});

describe('renderComponent', () => {
    it('adds the client directive when asked', () => {
        const content = renderComponent('Cat', true);
        expect(content.startsWith("'use client';")).toBe(true);
        expect(content).toContain('interface CatProps');
        expect(content).toContain('export default function Cat({ id }: CatProps)');
        expect(content).toContain('<h1>Cat {id}</h1>');
    });

    it('omits the directive otherwise', () => {
        const content = renderComponent('Cat', false);
        expect(content).not.toContain("'use client'");
        expect(content).toContain('<h1>Cat {id}</h1>');
    });
});

const WIRED = { listHook: true, component: true } as const;

describe('renderContainer', () => {
    it('renders a container that imports nothing when there is no List hook to call', () => {
        const ctx = contextFor('next-frontend', 'projects');
        const fromFile = path.join(ctx.featureDir, 'containers', 'ProjectDetailContainer.tsx');
        const content = renderContainer(ctx, 'ProjectDetailContainer', 'ProjectDetail', fromFile, {
            listHook: false,
            component: false,
        });
        expect(content).toBe(`'use client';

export default function ProjectDetailContainer() {
  // Call this feature's hooks here and pass what they return to its components.
  return <div>ProjectDetail</div>;
}
`);
    });

    it('renders each record inline when the entity component does not exist', () => {
        const ctx = contextFor('react', 'cat');
        const fromFile = path.join(ctx.featureDir, 'containers', 'CatContainer.tsx');
        const content = renderContainer(ctx, 'CatContainer', 'Cat', fromFile, { listHook: true, component: false });
        expect(content).toContain("import { useListCat } from '../hooks/ListCat.hook';");
        expect(content).not.toContain('components/');
        expect(content).toContain('<div key={item.id}>{item.id}</div>');
    });

    it('uses the directive and split component dir on next', () => {
        const ctx = contextFor('next-frontend', 'cat');
        const fromFile = path.join(ctx.featureDir, 'containers', 'CatContainer.tsx');
        const content = renderContainer(ctx, 'CatContainer', 'Cat', fromFile, WIRED);
        expect(content.startsWith("'use client';")).toBe(true);
        expect(content).toContain("import { useListCat } from '../hooks/ListCat.hook';");
        expect(content).toContain("import Cat from '../components/client/Cat';");
        expect(content).toContain('export default function CatContainer()');
        expect(content).toContain('const { data, loading, error } = useListCat();');
    });

    it('drops the directive and uses the flat component dir on react', () => {
        const ctx = contextFor('react', 'cat');
        const fromFile = path.join(ctx.featureDir, 'containers', 'CatContainer.tsx');
        const content = renderContainer(ctx, 'CatContainer', 'Cat', fromFile, WIRED);
        expect(content).not.toContain("'use client'");
        expect(content).toContain("import { useListCat } from '../hooks/ListCat.hook';");
        expect(content).toContain("import Cat from '../components/Cat';");
    });

    it('uses isPending, error.message, and a nullish-coalesced list on tanstack-start', () => {
        const ctx = contextFor('tanstack-start', 'cat');
        const fromFile = path.join(ctx.featureDir, '-containers', 'CatContainer.tsx');
        const content = renderContainer(ctx, 'CatContainer', 'Cat', fromFile, WIRED);
        expect(content).toContain("import { useListCat } from '../-hooks/ListCat.hook';");
        expect(content).toContain('const { data, isPending, error } = useListCat();');
        expect(content).toContain('if (isPending) return <div>Loading...</div>;');
        expect(content).toContain('if (error) return <div>Error: {error.message}</div>;');
        expect(content).toContain('{(data ?? []).map((item) => (');
    });
});

describe('renderHook', () => {
    it('renders a list query hook that fetches the feature API on mount', () => {
        const ctx = contextFor('react', 'cat');
        const spec = standardAction('List', 'Cat');
        const file = path.join(ctx.featureDir, 'hooks/ListCat.hook.ts');
        const content = renderHook(ctx, spec, 'Cat', file);

        expect(content).toContain('export function useListCat()');
        expect(content).toContain("import type { Cat } from '../types/Cat.types';");
        expect(content).toContain("import { z } from 'zod';");
        expect(content).toContain("import { CatSchema } from '../schemas/Cat.schema';");
        expect(content).toContain('type ListCatResult = { request: string; data: Cat[]; error: string | null };');
        expect(content).toContain('const request = String(attempt);');
        expect(content).toContain("fetch('/api/cat', { signal: controller.signal })");
        expect(content).toContain("if (!response.ok) throw new Error('Failed to fetch Cat list');");
        expect(content).toContain('return z.array(CatSchema).parse(await response.json());');
        expect(content).not.toContain(' as Cat');
        expect(content).toContain('}, [request]);');
        expect(content).toContain('return () => controller.abort();');
        expect(content).toContain('data: result?.data ?? [],');
        expect(content).toContain('loading: result?.request !== request,');
        expect(content).toContain('const refetch = useCallback(() => setAttempt((count) => count + 1), []);');
    });

    it('sets query state only in the request callbacks, never synchronously in the effect', () => {
        const ctx = contextFor('react', 'cat');
        const content = renderHook(ctx, standardAction('List', 'Cat'), 'Cat', path.join(ctx.featureDir, 'hooks/ListCat.hook.ts'));
        const effect = content.slice(content.indexOf('useEffect(() => {'), content.indexOf('}, [request]);'));
        const synchronous = effect.split('\n').filter((line) => /^ {4}\w/.test(line));

        expect(synchronous.join('\n')).not.toMatch(/set[A-Z]/);
        expect(content).not.toContain('void refetch();');
        expect(content).not.toContain('setLoading');
        // The response is parsed inside the request chain, before any state is set.
        expect(effect).toContain('return z.array(CatSchema).parse(await response.json());');
    });

    it('renders a detail query hook keyed on the id', () => {
        const ctx = contextFor('react', 'cat');
        const content = renderHook(ctx, standardAction('Show', 'Cat'), 'Cat', path.join(ctx.featureDir, 'hooks/ShowCat.hook.ts'));

        expect(content).toContain('export function useShowCat(id: string)');
        expect(content).toContain('type ShowCatResult = { request: string; data: Cat | null; error: string | null };');
        expect(content).toContain('const request = `${id}:${attempt}`;');
        expect(content).toContain('fetch(`/api/cat/${encodeURIComponent(id)}`, { signal: controller.signal })');
        expect(content).toContain("if (!response.ok) throw new Error('Failed to fetch Cat');");
        expect(content).toContain('return CatSchema.parse(await response.json());');
        expect(content).not.toContain("from 'zod'");
        expect(content).not.toContain(' as Cat');
        expect(content).toContain('}, [id, request]);');
        expect(content).toContain('data: result?.data ?? null,');
    });

    it('renders a mutation hook with a destructured onSuccess', () => {
        const ctx = contextFor('react', 'cat');
        const content = renderHook(ctx, standardAction('Update', 'Cat'), 'Cat', path.join(ctx.featureDir, 'hooks/UpdateCat.hook.ts'));

        expect(content).toContain('export function useUpdateCat(options: { onSuccess?: (result: Cat) => void } = {})');
        expect(content).toContain('const { onSuccess } = options;');
        expect(content).toContain('const updateCat = useCallback(async (id: string, data: UpdateCat) => {');
        expect(content).toContain("import type { UpdateCat } from '../schemas/UpdateCat.schema';");
        expect(content).toContain(`      const response = await fetch(\`/api/cat/\${encodeURIComponent(id)}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });`);
        expect(content).toContain("if (!response.ok) throw new Error('Failed to update Cat');");
        expect(content).toContain('const result = CatSchema.parse(await response.json());');
        expect(content).toContain("import { CatSchema } from '../schemas/Cat.schema';");
        expect(content).toContain('onSuccess?.(result);');
        expect(content).toContain('}, [onSuccess]);');
        expect(content).toContain('return { updateCat, loading, error };');
        expect(content).not.toContain('[options]');
    });

    it('renders a void mutation hook without a result argument', () => {
        const ctx = contextFor('react', 'cat');
        const content = renderHook(ctx, standardAction('Delete', 'Cat'), 'Cat', path.join(ctx.featureDir, 'hooks/DeleteCat.hook.ts'));

        expect(content).toContain('options: { onSuccess?: () => void } = {}');
        expect(content).toContain(`      const response = await fetch(\`/api/cat/\${encodeURIComponent(id)}\`, {
        method: 'DELETE',
      });`);
        expect(content).toContain("if (!response.ok) throw new Error('Failed to delete Cat');");
        expect(content).toContain('onSuccess?.();');
        expect(content).not.toContain('JSON.stringify');
        expect(content).not.toContain('const result =');
        expect(content).not.toContain('CatSchema');
        expect(content).not.toContain("from 'zod'");
    });

    it('renders a void custom action as a callable mutation, not an auto-fetching query', () => {
        const ctx = contextFor('react', 'cat');
        const spec = customAction('Cat', 'purgeCats', { withInput: false, returns: 'void' });
        const content = renderHook(ctx, spec, 'Cat', path.join(ctx.featureDir, 'hooks/PurgeCats.hook.ts'));

        expect(content).toContain('export function usePurgeCats(options: { onSuccess?: () => void } = {})');
        expect(content).toContain('const purgeCats = useCallback(async () => {');
        expect(content).toContain("const response = await fetch('/api/cat/purge-cats');");
        expect(content).toContain('onSuccess?.();');
        expect(content).not.toContain('useEffect');
        expect(content).not.toContain('useState<void');
    });

    it('renders a non-GET action on one record as a mutation that sends the id in the path', () => {
        const ctx = contextFor('react', 'projects');
        const spec = customAction('Project', 'archiveProject', { withInput: false, returns: 'one', method: 'patch', onRecord: true });
        const content = renderHook(ctx, spec, 'Project', path.join(ctx.featureDir, 'hooks/ArchiveProject.hook.ts'));

        expect(content).toContain('export function useArchiveProject(options: { onSuccess?: (result: Project) => void } = {})');
        expect(content).toContain('const archiveProject = useCallback(async (id: string) => {');
        expect(content).toContain(`      const response = await fetch(\`/api/projects/\${encodeURIComponent(id)}/archive-project\`, {
        method: 'PATCH',
      });`);
        expect(content).toContain('return { archiveProject, loading, error };');
        expect(content).not.toContain('useEffect');
    });

    it('renders a non-GET action without input as a mutation, never a query that fires on mount', () => {
        const ctx = contextFor('react', 'projects');
        const spec = customAction('Project', 'syncProjects', { withInput: false, returns: 'list', method: 'post' });
        const content = renderHook(ctx, spec, 'Project', path.join(ctx.featureDir, 'hooks/SyncProjects.hook.ts'));

        expect(content).toContain('const syncProjects = useCallback(async () => {');
        expect(content).toContain("method: 'POST',");
        expect(content).not.toContain('useEffect');
    });

    it('renders a GET on one record as a query keyed on the id', () => {
        const ctx = contextFor('react', 'projects');
        const spec = customAction('Project', 'projectHistory', { withInput: false, returns: 'list', onRecord: true });
        const content = renderHook(ctx, spec, 'Project', path.join(ctx.featureDir, 'hooks/ProjectHistory.hook.ts'));

        expect(content).toContain('export function useProjectHistory(id: string)');
        expect(content).toContain('const request = `${id}:${attempt}`;');
        expect(content).toContain('fetch(`/api/projects/${encodeURIComponent(id)}/project-history`, { signal: controller.signal })');
        expect(content).toContain('}, [id, request]);');
    });

    it('encodes the id in every URL, so a slash or ? in it cannot change the route', () => {
        const ctx = contextFor('react', 'projects');
        const specs = [
            standardAction('Show', 'Project'),
            standardAction('Update', 'Project'),
            standardAction('Delete', 'Project'),
            customAction('Project', 'archiveProject', { withInput: false, returns: 'one', method: 'patch', onRecord: true }),
            customAction('Project', 'projectHistory', { withInput: false, returns: 'list', onRecord: true }),
        ];
        for (const spec of specs) {
            const content = renderHook(ctx, spec, 'Project', path.join(ctx.featureDir, `hooks/${spec.name}.hook.ts`));
            expect(content, spec.name).toContain('/api/projects/${encodeURIComponent(id)}');
            expect(content, spec.name).not.toContain('/api/projects/${id}');
        }
    });

    it('omits the client directive on Next, so the TS plugin does not read the hook as a component', () => {
        const ctx = contextFor('next-frontend', 'cat');
        const content = renderHook(ctx, standardAction('List', 'Cat'), 'Cat', path.join(ctx.featureDir, 'hooks/ListCat.hook.ts'));
        expect(content).not.toContain("'use client'");
        expect(content.startsWith("import { useState, useEffect, useCallback } from 'react';")).toBe(true);
    });

    it('calls the feature API itself instead of a service on next-fullstack', () => {
        const ctx = contextFor('next-fullstack', 'cat');
        const content = renderHook(ctx, standardAction('Create', 'Cat'), 'Cat', path.join(ctx.featureDir, 'hooks/CreateCat.hook.ts'));

        expect(content).toContain(`      const response = await fetch('/api/cat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });`);
        expect(content).toContain('const result = CatSchema.parse(await response.json());');
        expect(content).toContain("import type { Cat } from '../types/Cat.types';");
        expect(content).toContain("import type { CreateCat } from '../schemas/CreateCat.schema';");
        expect(content).toContain("import { CatSchema } from '../schemas/Cat.schema';");
        expect(content).not.toContain('service');
        expect(content).not.toContain('Service');
        expect(content).not.toContain('repositories');
    });
});
