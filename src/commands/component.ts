import * as path from 'path';
import { assertLayer, componentDir } from '../stack/registry';
import { renderComponent } from '../templates/frontend/component';
import { fileExists, writeFileSafe } from '../utils/fs';
import { ensureFeatureDir, openFeature } from './resolve';

export type ComponentType = 'client' | 'server';

export function parseComponentType(value: string | undefined): ComponentType {
    return value === 'server' ? 'server' : 'client';
}

export function makeComponent(feature: string, name: string, type: ComponentType = 'client'): void {
    const ctx = openFeature(feature, 'make:component');
    assertLayer(ctx.profile, 'component', 'make:component');

    if (type === 'server' && !ctx.profile.serverComponents) {
        throw new Error(`The ${ctx.profile.name} stack has no server components.`);
    }

    const dir = ensureFeatureDir(ctx, componentDir(ctx.profile, type));
    const filePath = path.join(dir, `${name}.tsx`);

    if (fileExists(filePath)) {
        throw new Error(`Component "${name}" already exists at ${filePath}`);
    }

    const directive = type === 'client' && ctx.profile.clientDirective;
    writeFileSafe(filePath, renderComponent(name, directive));
    console.log(`✅ Component "${name}" created at ${filePath}`);
}
