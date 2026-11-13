import * as path from 'path';
import { DetectedStack, Layer, StackProfile } from '../stack/types';
import { findArea } from '../nest/area';
import { layerDir } from '../stack/registry';
import { resolveImport } from '../utils/imports';
import { featureDir } from '../utils/paths';

export interface RenderContext {
    readonly feature: string;
    readonly stack: DetectedStack;
    readonly profile: StackProfile;
    readonly featureDir: string;
    /**
     * The Nest area the feature sits in: its root's folder name when that folder has its own
     * `<area>.module.ts`, as `src/projects/projects.module.ts` does. Null everywhere else.
     */
    readonly area: string | null;
    readonly importFrom: (fromFile: string, featureRelativePath: string) => string;
    readonly importLayer: (fromFile: string, layer: Layer, fileName: string) => string;
}

export function createContext(feature: string, stack: DetectedStack, profile: StackProfile): RenderContext {
    const dir = featureDir(stack, feature);
    const importFrom = (fromFile: string, relative: string): string =>
        resolveImport(fromFile, path.join(dir, relative));

    return Object.freeze({
        feature,
        stack,
        profile,
        featureDir: dir,
        area: profile.name === 'nest' ? findArea(process.cwd(), stack.featureRoot) : null,
        importFrom,
        importLayer: (fromFile: string, layer: Layer, fileName: string): string =>
            importFrom(fromFile, `${layerDir(profile, layer)}/${fileName}`),
    });
}
