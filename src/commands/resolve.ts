import * as path from 'path';
import { detectStack } from '../stack/detect';
import { getProfile, layerDir } from '../stack/registry';
import { Layer } from '../stack/types';
import { createContext, RenderContext } from '../templates/context';
import { fileExists, mkdirSafe } from '../utils/fs';
import { validateFeatureName } from '../utils/naming';

export function resolveFeature(feature: string): RenderContext {
    validateFeatureName(feature);
    const stack = detectStack();
    return createContext(feature, stack, getProfile(stack.stack));
}

export function requireFeature(feature: string): RenderContext {
    const ctx = resolveFeature(feature);
    if (!fileExists(ctx.featureDir)) {
        throw new Error(`Feature "${feature}" does not exist. Run: domain-driver make:feature ${feature}`);
    }
    return ctx;
}

export function ensureLayerDir(ctx: RenderContext, layer: Layer): string {
    const dir = path.join(ctx.featureDir, layerDir(ctx.profile, layer));
    mkdirSafe(dir);
    return dir;
}
