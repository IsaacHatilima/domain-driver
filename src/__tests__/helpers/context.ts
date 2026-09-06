import { DetectedStack, StackName } from '../../stack/types';
import { getProfile } from '../../stack/registry';
import { createContext, RenderContext } from '../../templates/context';

const DEFAULT_ROOTS: Readonly<Record<StackName, string>> = Object.freeze({
    'next-fullstack': 'app',
    'next-frontend': 'app',
    react: 'src/features',
    node: 'src/features',
    nest: 'src',
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
        hasNestjsZod: false,
        ...extra,
    });
    return createContext(feature, detected, getProfile(stack));
}
