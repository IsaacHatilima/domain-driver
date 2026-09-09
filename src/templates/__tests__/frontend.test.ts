import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { renderPage } from '../frontend/page';
import { renderRoute } from '../frontend/route';
import { renderComponent } from '../frontend/component';
import { renderContainer } from '../frontend/container';
import { renderHook } from '../frontend/hook';
import { standardAction } from '../actions';
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

describe('renderContainer', () => {
    it('uses the directive and split component dir on next', () => {
        const ctx = contextFor('next-frontend', 'cat');
        const fromFile = path.join(ctx.featureDir, 'containers', 'CatContainer.tsx');
        const content = renderContainer(ctx, 'CatContainer', 'Cat', fromFile);
        expect(content.startsWith("'use client';")).toBe(true);
        expect(content).toContain("import { useListCat } from '../hooks/ListCat.hook';");
        expect(content).toContain("import Cat from '../components/client/Cat';");
        expect(content).toContain('export default function CatContainer()');
        expect(content).toContain('const { data, loading, error } = useListCat();');
    });

    it('drops the directive and uses the flat component dir on react', () => {
        const ctx = contextFor('react', 'cat');
        const fromFile = path.join(ctx.featureDir, 'containers', 'CatContainer.tsx');
        const content = renderContainer(ctx, 'CatContainer', 'Cat', fromFile);
        expect(content).not.toContain("'use client'");
        expect(content).toContain("import { useListCat } from '../hooks/ListCat.hook';");
        expect(content).toContain("import Cat from '../components/Cat';");
    });

    it('uses isPending, error.message, and a nullish-coalesced list on tanstack-start', () => {
        const ctx = contextFor('tanstack-start', 'cat');
        const fromFile = path.join(ctx.featureDir, '-containers', 'CatContainer.tsx');
        const content = renderContainer(ctx, 'CatContainer', 'Cat', fromFile);
        expect(content).toContain("import { useListCat } from '../-hooks/ListCat.hook';");
        expect(content).toContain('const { data, isPending, error } = useListCat();');
        expect(content).toContain('if (isPending) return <div>Loading...</div>;');
        expect(content).toContain('if (error) return <div>Error: {error.message}</div>;');
        expect(content).toContain('{(data ?? []).map((item) => (');
    });
});

describe('renderHook', () => {
    it('renders a list query hook that fetches on mount', () => {
        const ctx = contextFor('react', 'cat');
        const spec = standardAction('List', 'Cat');
        const file = path.join(ctx.featureDir, 'hooks/ListCat.hook.ts');
        const content = renderHook(ctx, spec, 'Cat', file);

        expect(content).toContain('export function useListCat()');
        expect(content).toContain('const [data, setData] = useState<Cat[]>([]);');
        expect(content).toContain('setData(await service.handle());');
        expect(content).toContain('}, []);');
        expect(content).toContain('void refetch();');
        expect(content).toContain('return { data, loading, error, refetch };');
    });

    it('renders a detail query hook keyed on the id', () => {
        const ctx = contextFor('react', 'cat');
        const content = renderHook(ctx, standardAction('Show', 'Cat'), 'Cat', path.join(ctx.featureDir, 'hooks/ShowCat.hook.ts'));

        expect(content).toContain('export function useShowCat(id: string)');
        expect(content).toContain('const [data, setData] = useState<Cat | null>(null);');
        expect(content).toContain('setData(await service.handle(id));');
        expect(content).toContain('}, [id]);');
    });

    it('renders a mutation hook with a destructured onSuccess', () => {
        const ctx = contextFor('react', 'cat');
        const content = renderHook(ctx, standardAction('Update', 'Cat'), 'Cat', path.join(ctx.featureDir, 'hooks/UpdateCat.hook.ts'));

        expect(content).toContain('export function useUpdateCat(options: { onSuccess?: (result: Cat) => void } = {})');
        expect(content).toContain('const { onSuccess } = options;');
        expect(content).toContain('const updateCat = useCallback(async (id: string, data: UpdateCat) => {');
        expect(content).toContain('const result = await service.handle(id, data);');
        expect(content).toContain('onSuccess?.(result);');
        expect(content).toContain('}, [onSuccess]);');
        expect(content).toContain('return { updateCat, loading, error };');
        expect(content).not.toContain('[options]');
    });

    it('renders a void mutation hook without a result argument', () => {
        const ctx = contextFor('react', 'cat');
        const content = renderHook(ctx, standardAction('Delete', 'Cat'), 'Cat', path.join(ctx.featureDir, 'hooks/DeleteCat.hook.ts'));

        expect(content).toContain('options: { onSuccess?: () => void } = {}');
        expect(content).toContain('onSuccess?.();');
        expect(content).not.toContain('const result =');
    });

    it('adds the client directive on Next', () => {
        const ctx = contextFor('next-frontend', 'cat');
        const content = renderHook(ctx, standardAction('List', 'Cat'), 'Cat', path.join(ctx.featureDir, 'hooks/ListCat.hook.ts'));
        expect(content.startsWith("'use client';")).toBe(true);
    });
});
