import { DetectedStack, StackName } from '../../stack/types';
import { getProfile } from '../../stack/registry';
import { createContext, RenderContext } from '../../templates/context';

/** The app directory's api folder, which route handlers resolve against. */
const DEFAULT_API_ROOT = 'app/api';

const DEFAULT_ROOTS: Readonly<Record<StackName, string>> = Object.freeze({
    'next-fullstack': 'app',
    'next-frontend': 'app',
    react: 'src/features',
    node: 'src/features',
    nest: 'src',
    'tanstack-start': 'src/routes',
});

export function contextFor(
    stack: StackName,
    feature: string,
    extra: Partial<DetectedStack> = {}
): RenderContext {
    const detected: DetectedStack = Object.freeze({
        stack,
        source: 'detected',
        httpFramework: null,
        featureRoot: DEFAULT_ROOTS[stack],
        featureRootSource: 'detected',
        apiRoot: DEFAULT_API_ROOT,
        hasNestjsZod: false,
        rootModule: null,
        autoRegister: true,
        ...extra,
    });
    return createContext(feature, detected, getProfile(stack));
}
