import type * as TsModule from 'typescript';

export type Ts = typeof TsModule;

export type Resolver = (specifier: string, options: { paths: string[] }) => string;
export type Loader = (resolved: string) => unknown;

/**
 * Borrows the consuming project's own TypeScript rather than shipping one. Every TypeScript
 * Nest project has it — it cannot compile without one — so this keeps a scaffolding CLI free
 * of a heavy runtime dependency. Returning null is a normal outcome, not an error: the caller
 * falls back to printing the lines for the user to paste.
 */
export function loadTypeScript(
    cwd: string,
    resolve: Resolver = require.resolve,
    load: Loader = require
): Ts | null {
    try {
        const candidate = load(resolve('typescript', { paths: [cwd] }));
        return isTypeScript(candidate) ? candidate : null;
    } catch {
        return null;
    }
}

function isTypeScript(candidate: unknown): candidate is Ts {
    if (typeof candidate !== 'object' || candidate === null) return false;
    const api = candidate as Partial<Ts>;
    return (
        typeof api.createSourceFile === 'function' &&
        typeof api.transpileModule === 'function' &&
        typeof api.getDecorators === 'function'
    );
}
