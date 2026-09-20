import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { featureDir, apiRouteDir } from '../paths';
import { DetectedStack } from '../../stack/types';

const stack = Object.freeze({
    stack: 'next-fullstack',
    source: 'detected',
    httpFramework: null,
    featureRoot: 'src/app',
    apiRoot: 'src/app/api',
    hasNestjsZod: false,
}) as DetectedStack;

/** A feature relocated with --root, whose handlers must NOT follow it. */
const relocated = Object.freeze({ ...stack, featureRoot: 'src/app/auth' }) as DetectedStack;

describe('paths', () => {
    it('featureDir joins cwd, feature root, and feature', () => {
        expect(featureDir(stack, 'cat')).toBe(path.join(process.cwd(), 'src/app', 'cat'));
    });

    it('apiRouteDir joins cwd, the api root, and the feature', () => {
        expect(apiRouteDir(stack, 'cat')).toBe(path.join(process.cwd(), 'src/app/api', 'cat'));
    });

    it('moves the feature but not its route handlers when the root is overridden', () => {
        // Regression guard: apiRouteDir used to hang "api" off featureRoot, which put the
        // handlers inside the feature at src/app/auth/api/cat. Next would have served that
        // at /auth/api/cat while the generated hook kept fetching /api/cat.
        expect(featureDir(relocated, 'cat')).toBe(path.join(process.cwd(), 'src/app/auth', 'cat'));
        expect(apiRouteDir(relocated, 'cat')).toBe(path.join(process.cwd(), 'src/app/api', 'cat'));
    });
});
