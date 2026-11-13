import * as path from 'path';
import { fileExists } from '../utils/fs';

/**
 * Projects that group flows into areas scaffold each one with `--root src/<area>`, and the area is
 * a module of its own: `src/projects/projects.module.ts`. That module is where a flow's module is
 * registered, and its folder name is the prefix every flow in it routes under.
 */
export function areaModulePath(featureRoot: string): string {
    return path.join(featureRoot, `${path.basename(featureRoot)}.module.ts`);
}

/** The area a feature root is, or null when the root has no module of its own. */
export function findArea(cwd: string, featureRoot: string): string | null {
    return fileExists(path.join(cwd, areaModulePath(featureRoot))) ? path.basename(featureRoot) : null;
}
