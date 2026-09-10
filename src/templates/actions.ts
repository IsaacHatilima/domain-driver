import { lowerFirst, toKebabCase, upperFirst } from '../utils/naming';

export const ACTIONS = ['List', 'Show', 'Create', 'Update', 'Delete'] as const;
export type Action = (typeof ACTIONS)[number];

export const WRITE_ACTIONS = ['Create', 'Update'] as const;
export type WriteAction = (typeof WRITE_ACTIONS)[number];

export type HttpMethod = 'get' | 'post' | 'put' | 'delete';

export const RETURN_KINDS = ['list', 'one', 'void'] as const;
export type ReturnKind = (typeof RETURN_KINDS)[number];

export interface ActionSpec {
    readonly name: string;
    readonly handler: string;
    readonly params: string;
    readonly args: string;
    readonly returns: string;
    readonly usesEntityType: boolean;
    readonly schema: string | null;
    readonly usesId: boolean;
    readonly status: number;
    readonly method: HttpMethod;
    readonly path: string;
    readonly failure: string;
}

export interface ActionCase {
    readonly pascal: string;
    readonly camel: string;
    readonly slug: string;
}

export interface CustomActionOptions {
    readonly withInput: boolean;
    readonly returns: ReturnKind;
}

const ACTION_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;

export function actionCase(name: string): ActionCase {
    if (!ACTION_NAME_PATTERN.test(name)) {
        throw new Error(`Action name "${name}" must be camelCase or PascalCase, for example findActiveUsers.`);
    }
    const pascal = upperFirst(name);
    return Object.freeze({ pascal, camel: lowerFirst(pascal), slug: toKebabCase(pascal) });
}

function freeze(spec: ActionSpec): ActionSpec {
    return Object.freeze(spec);
}

function returnType(kind: ReturnKind, entity: string): string {
    switch (kind) {
        case 'list':
            return `Promise<${entity}[]>`;
        case 'one':
            return `Promise<${entity}>`;
        case 'void':
            return 'Promise<void>';
    }
}

export function standardAction(action: Action, entity: string): ActionSpec {
    const name = `${action}${entity}`;
    const handler = `${lowerFirst(action)}${entity}Controller`;
    switch (action) {
        case 'List':
            return freeze({ name, handler, params: '', args: '', returns: `Promise<${entity}[]>`, usesEntityType: true, schema: null, usesId: false, status: 200, method: 'get', path: '/', failure: `Failed to fetch ${entity} list` });
        case 'Show':
            return freeze({ name, handler, params: 'id: string', args: 'id', returns: `Promise<${entity}>`, usesEntityType: true, schema: null, usesId: true, status: 200, method: 'get', path: '/:id', failure: `Failed to fetch ${entity}` });
        case 'Create':
            return freeze({ name, handler, params: `data: ${name}`, args: 'data', returns: `Promise<${entity}>`, usesEntityType: true, schema: name, usesId: false, status: 201, method: 'post', path: '/', failure: `Failed to create ${entity}` });
        case 'Update':
            return freeze({ name, handler, params: `id: string, data: ${name}`, args: 'id, data', returns: `Promise<${entity}>`, usesEntityType: true, schema: name, usesId: true, status: 200, method: 'put', path: '/:id', failure: `Failed to update ${entity}` });
        case 'Delete':
            return freeze({ name, handler, params: 'id: string', args: 'id', returns: 'Promise<void>', usesEntityType: false, schema: null, usesId: true, status: 204, method: 'delete', path: '/:id', failure: `Failed to delete ${entity}` });
    }
}

export function standardActions(entity: string): readonly ActionSpec[] {
    return ACTIONS.map((action) => standardAction(action, entity));
}

export function customAction(entity: string, actionName: string, options: CustomActionOptions): ActionSpec {
    const { pascal, camel, slug } = actionCase(actionName);
    return freeze({
        name: pascal,
        handler: `${camel}Controller`,
        params: options.withInput ? `data: ${pascal}` : '',
        args: options.withInput ? 'data' : '',
        returns: returnType(options.returns, entity),
        usesEntityType: options.returns !== 'void',
        schema: options.withInput ? pascal : null,
        usesId: false,
        status: options.returns === 'void' ? 204 : 200,
        method: options.withInput ? 'post' : 'get',
        path: `/${slug}`,
        failure: `Failed to ${camel} ${entity}`,
    });
}

/**
 * Whether a hook renders as a query (auto-fetches, returns data) rather than a mutation
 * (triggered imperatively). `spec.method === 'get'` alone is not enough: a custom action
 * declared `--returns void` is also a GET (no input forces GET regardless of return kind),
 * but it has no payload worth polling for and must not auto-fire on mount. `usesEntityType`
 * is false exactly when the action returns void, so requiring it here routes that case to
 * the mutation branch instead.
 */
export function isQueryAction(spec: ActionSpec): boolean {
    return spec.method === 'get' && spec.usesEntityType;
}
