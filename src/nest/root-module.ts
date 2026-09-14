import * as path from 'path';
import { fileExists } from '../utils/fs';

/**
 * Probes the conventional locations for a Nest root module. A project that keeps it
 * anywhere else names it with the `domainDriver.rootModule` key instead of being guessed at.
 */
export function findRootModule(cwd: string, featureRoot: string, configured: string | null): string | null {
    if (configured !== null) {
        const target = path.join(cwd, configured);
        return fileExists(target) ? target : null;
    }

    // Most specific first: a monorepo's stray root-level src/app.module.ts must not win over
    // the one sitting beside the feature root it actually belongs to.
    const candidates = [path.join(path.dirname(featureRoot), 'app.module.ts'), 'src/app.module.ts', 'app.module.ts'];
    for (const candidate of candidates) {
        const target = path.join(cwd, candidate);
        if (fileExists(target)) return target;
    }
    return null;
}
