import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { featureDir, apiRouteDir } from '../paths';
import { DetectedStack } from '../../stack/types';

const stack: DetectedStack = Object.freeze({
    stack: 'next-fullstack',
    source: 'detected',
    httpFramework: null,
    featureRoot: 'src/app',
    hasNestjsZod: false,
});

describe('paths', () => {
    it('featureDir joins cwd, feature root, and feature', () => {
        expect(featureDir(stack, 'cat')).toBe(path.join(process.cwd(), 'src/app', 'cat'));
    });

    it('apiRouteDir joins cwd, feature root, api, and feature', () => {
        expect(apiRouteDir(stack, 'cat')).toBe(path.join(process.cwd(), 'src/app', 'api', 'cat'));
    });
});
