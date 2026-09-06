import * as path from 'path';
import { Action, ActionSpec } from '../templates/actions';
import { fileExists, writeFileSafe } from '../utils/fs';

export function writeIfAbsent(filePath: string, render: () => string): boolean {
    if (fileExists(filePath)) {
        console.warn(`⚠️  Skipping "${path.basename(filePath)}" — already exists`);
        return false;
    }
    writeFileSafe(filePath, render());
    return true;
}

export function writeActionFiles<A extends Action>(
    dir: string,
    entity: string,
    suffix: string,
    actions: readonly A[],
    render: (action: A, filePath: string) => string
): void {
    for (const action of actions) {
        const filePath = path.join(dir, `${action}${entity}.${suffix}.ts`);
        writeIfAbsent(filePath, () => render(action, filePath));
    }
}

export function writeSpecFiles(
    dir: string,
    specs: readonly ActionSpec[],
    suffix: string,
    render: (spec: ActionSpec, filePath: string) => string
): void {
    for (const spec of specs) {
        const filePath = path.join(dir, `${spec.name}.${suffix}.ts`);
        writeIfAbsent(filePath, () => render(spec, filePath));
    }
}
