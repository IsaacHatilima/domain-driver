import * as path from 'path';
import { DetectedStack } from '../stack/types';

export function featureDir(stack: DetectedStack, feature: string): string {
    return path.join(process.cwd(), stack.featureRoot, feature);
}

export function apiRouteDir(stack: DetectedStack, feature: string): string {
    return path.join(process.cwd(), stack.featureRoot, 'api', feature);
}
