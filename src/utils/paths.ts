import * as path from 'path';
import { DetectedStack } from '../stack/types';

export function featureDir(stack: DetectedStack, feature: string): string {
    return path.join(process.cwd(), stack.featureRoot, feature);
}

/**
 * Route handlers resolve against the app directory, never against the feature root.
 * `--root app/auth` moves the feature to app/auth/<feature>, but its handlers must
 * stay at app/api/<feature>: a handler's URL is its path under app/, so one placed
 * inside the feature would answer /auth/api/<feature> while the generated hook still
 * fetches /api/<feature>.
 */
export function apiRouteDir(stack: DetectedStack, feature: string): string {
    return path.join(process.cwd(), stack.apiRoot, feature);
}
