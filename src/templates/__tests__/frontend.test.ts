import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { renderPage } from '../frontend/page';
import { renderComponent } from '../frontend/component';
import { renderContainer } from '../frontend/container';
import { renderHook } from '../frontend/hook';
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

describe('renderComponent', () => {
    it('adds the client directive when asked', () => {
        const content = renderComponent('Cat', true);
        expect(content.startsWith("'use client';")).toBe(true);
        expect(content).toContain('interface CatProps');
        expect(content).toContain('export default function Cat({ id }: CatProps)');
    });

    it('omits the directive otherwise', () => {
        expect(renderComponent('Cat', false)).not.toContain("'use client'");
    });
});

describe('renderContainer', () => {
    it('uses the directive and split component dir on next', () => {
        const ctx = contextFor('next-frontend', 'cat');
        const fromFile = path.join(ctx.featureDir, 'containers', 'CatContainer.tsx');
        const content = renderContainer(ctx, 'CatContainer', 'Cat', fromFile);
        expect(content.startsWith("'use client';")).toBe(true);
        expect(content).toContain("import { useCat } from '../hooks/useCat';");
        expect(content).toContain("import Cat from '../components/client/Cat';");
        expect(content).toContain('export default function CatContainer()');
    });

    it('drops the directive and uses the flat component dir on react', () => {
        const ctx = contextFor('react', 'cat');
        const fromFile = path.join(ctx.featureDir, 'containers', 'CatContainer.tsx');
        const content = renderContainer(ctx, 'CatContainer', 'Cat', fromFile);
        expect(content).not.toContain("'use client'");
        expect(content).toContain("import Cat from '../components/Cat';");
    });
});

describe('renderHook', () => {
    it('imports type, services, and schemas on next-frontend', () => {
        const ctx = contextFor('next-frontend', 'cat');
        const fromFile = path.join(ctx.featureDir, 'hooks', 'useCat.ts');
        const content = renderHook(ctx, 'useCat', 'Cat', fromFile);
        expect(content.startsWith("'use client';")).toBe(true);
        expect(content).toContain("import { Cat } from '../types/Cat.types';");
        expect(content).toContain("import { ListCatService } from '../services/ListCat.service';");
        expect(content).toContain("import { UpdateCat } from '../schemas/UpdateCat.schema';");
        expect(content).toContain('export function useCat()');
        expect(content).toContain('return { items, selected, loading, error, fetchAll, fetchOne, create, update, remove };');
    });

    it('imports client services under fullstack', () => {
        const ctx = contextFor('next-fullstack', 'cat');
        const fromFile = path.join(ctx.featureDir, 'hooks', 'useCat.ts');
        const content = renderHook(ctx, 'useCat', 'Cat', fromFile);
        expect(content).toContain("from '../client/services/CreateCat.service';");
    });

    it('drops the directive on react', () => {
        const ctx = contextFor('react', 'cat');
        const fromFile = path.join(ctx.featureDir, 'hooks', 'useCat.ts');
        expect(renderHook(ctx, 'useCat', 'Cat', fromFile)).not.toContain("'use client'");
    });
});
