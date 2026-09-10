import { StackName } from '../stack/types';
import { ActionSpec } from '../templates/actions';
import { RenderContext } from '../templates/context';
import { renderNestController } from '../templates/controllers/nest';
import { renderNodeController } from '../templates/controllers/node';
import { renderServerFn } from '../templates/controllers/server-fn';

export type ControllerRenderer = (ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string) => string;

const RENDERERS: Readonly<Partial<Record<StackName, ControllerRenderer>>> = Object.freeze({
    nest: renderNestController,
    node: renderNodeController,
    'tanstack-start': renderServerFn,
});

const SUFFIXES: Readonly<Partial<Record<StackName, string>>> = Object.freeze({
    'tanstack-start': 'fn',
});

export function controllerRenderer(stack: StackName): ControllerRenderer {
    const renderer = RENDERERS[stack];
    if (renderer === undefined) {
        throw new Error(`No controller renderer registered for the "${stack}" stack.`);
    }
    return renderer;
}

export function controllerSuffix(stack: StackName): string {
    return SUFFIXES[stack] ?? 'controller';
}
