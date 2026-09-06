import * as path from 'path';
import { DetectedStack, Layer, StackProfile } from '../stack/types';
import { layerDir } from '../stack/registry';
import { resolveImport } from '../utils/imports';
import { featureDir } from '../utils/paths';

export interface RenderContext {
    readonly feature: string;
    readonly stack: DetectedStack;
    readonly profile: StackProfile;
    readonly featureDir: string;
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
        importFrom,
        importLayer: (fromFile: string, layer: Layer, fileName: string): string =>
            importFrom(fromFile, `${layerDir(profile, layer)}/${fileName}`),
    });
}
