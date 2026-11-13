import { lowerFirst, toKebabCase, upperFirst } from '../utils/naming';

export const ACTIONS = ['List', 'Show', 'Create', 'Update', 'Delete'] as const;
export type Action = (typeof ACTIONS)[number];

export const WRITE_ACTIONS = ['Create', 'Update'] as const;
export type WriteAction = (typeof WRITE_ACTIONS)[number];

export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

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
    /** Relative to the feature's base route: `/`, `/:id`, `/<slug>` or `/:id/<slug>`. */
    readonly path: string;
    readonly failure: string;
    /**
     * A bespoke action from `make:action`, not one of the standard five. A custom action can share
     * List's path (`/`) or Show's (`/:id`) when its feature is the action itself, so the path alone
     * cannot tell them apart.
     */
    readonly custom: boolean;
}

export interface ActionCase {
    readonly pascal: string;
    readonly camel: string;
    readonly slug: string;
}

export interface CustomActionOptions {
    readonly withInput: boolean;
    readonly returns: ReturnKind;
    /** Defaults to `post` with input and `get` without. */
    readonly method?: HttpMethod;
    /** The action takes the record id from the path, as Show, Update and Delete do. */
    readonly onRecord?: boolean;
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
            return freeze({ name, handler, params: '', args: '', returns: `Promise<${entity}[]>`, usesEntityType: true, schema: null, usesId: false, status: 200, method: 'get', path: '/', failure: `Failed to fetch ${entity} list`, custom: false });
        case 'Show':
            return freeze({ name, handler, params: 'id: string', args: 'id', returns: `Promise<${entity}>`, usesEntityType: true, schema: null, usesId: true, status: 200, method: 'get', path: '/:id', failure: `Failed to fetch ${entity}`, custom: false });
        case 'Create':
            return freeze({ name, handler, params: `data: ${name}`, args: 'data', returns: `Promise<${entity}>`, usesEntityType: true, schema: name, usesId: false, status: 201, method: 'post', path: '/', failure: `Failed to create ${entity}`, custom: false });
        case 'Update':
            return freeze({ name, handler, params: `id: string, data: ${name}`, args: 'id, data', returns: `Promise<${entity}>`, usesEntityType: true, schema: name, usesId: true, status: 200, method: 'put', path: '/:id', failure: `Failed to update ${entity}`, custom: false });
        case 'Delete':
            return freeze({ name, handler, params: 'id: string', args: 'id', returns: 'Promise<void>', usesEntityType: false, schema: null, usesId: true, status: 204, method: 'delete', path: '/:id', failure: `Failed to delete ${entity}`, custom: false });
    }
}

export function standardActions(entity: string): readonly ActionSpec[] {
    return ACTIONS.map((action) => standardAction(action, entity));
}

/** A create answers 201 Created, like the standard Create. Any other action answers 200. */
const CREATE_NAME = /^Create(?=[A-Z0-9]|$)/;

function customStatus(pascal: string, method: HttpMethod, returns: ReturnKind): number {
    if (returns === 'void') return 204;
    return method === 'post' && CREATE_NAME.test(pascal) ? 201 : 200;
}

/**
 * The action's route below the feature's base route. A feature can be the action itself, as when a
 * project scaffolds one feature per flow (`create-project` holding `createProject`): repeating the
 * slug there would route it at `/create-project/create-project`, so the action takes the base route.
 */
function customPath(slug: string, onRecord: boolean, feature: string | null): string {
    const own = feature === slug ? '' : `/${slug}`;
    if (onRecord) return `/:id${own}`;
    return own === '' ? '/' : own;
}

function joinPresent(parts: readonly (string | null)[]): string {
    return parts.filter((part): part is string => part !== null).join(', ');
}

export function customAction(
    entity: string,
    actionName: string,
    options: CustomActionOptions,
    feature: string | null = null
): ActionSpec {
    const { pascal, camel, slug } = actionCase(actionName);
    const onRecord = options.onRecord ?? false;
    const method = options.method ?? (options.withInput ? 'post' : 'get');
    if (method === 'get' && options.withInput) {
        throw new Error('A GET action cannot take a request body. Drop --with-input, or pick --method post, put, patch, or delete.');
    }

    return freeze({
        name: pascal,
        handler: `${camel}Controller`,
        params: joinPresent([onRecord ? 'id: string' : null, options.withInput ? `data: ${pascal}` : null]),
        args: joinPresent([onRecord ? 'id' : null, options.withInput ? 'data' : null]),
        returns: returnType(options.returns, entity),
        usesEntityType: options.returns !== 'void',
        schema: options.withInput ? pascal : null,
        usesId: onRecord,
        status: customStatus(pascal, method, options.returns),
        method,
        path: customPath(slug, onRecord, feature),
        failure: `Failed to ${slug.replace(/-/g, ' ')}`,
        custom: true,
    });
}

/**
 * Whether a hook renders as a query (auto-fetches, returns data) rather than a mutation
 * (triggered imperatively). Any method other than GET is a mutation. `spec.method === 'get'`
 * alone is not enough: a custom action without input defaults to GET even when it is declared
 * `--returns void`, but it has no payload worth polling for and must not auto-fire on mount.
 * `usesEntityType` is false exactly when the action returns void, so requiring it here routes
 * that case to the mutation branch instead.
 */
export function isQueryAction(spec: ActionSpec): boolean {
    return spec.method === 'get' && spec.usesEntityType;
}
