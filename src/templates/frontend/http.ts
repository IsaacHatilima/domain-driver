import { ActionSpec } from '../actions';

/**
 * Renders the `fetch(...)` arguments for an action. Hooks own the call to the API:
 * the service and the repository live behind that API, on the server, so there is
 * nothing for the browser to layer on top of a request.
 */
function fetchUrl(spec: ActionSpec, base: string): string {
    if (!spec.path.includes(':id')) return `'${base}${spec.path === '/' ? '' : spec.path}'`;
    return `\`${base}${spec.path.replace(':id', '${id}')}\``;
}

export function fetchCall(spec: ActionSpec, feature: string, indent: string): string {
    const base = `/api/${feature}`;
    const url = fetchUrl(spec, base);
    if (spec.method === 'get') return url;

    const method = spec.method.toUpperCase();
    if (spec.schema === null) {
        return `${url}, {
${indent}  method: '${method}',
${indent}}`;
    }
    return `${url}, {
${indent}  method: '${method}',
${indent}  headers: { 'Content-Type': 'application/json' },
${indent}  body: JSON.stringify(data),
${indent}}`;
}

/** The arguments a generated TanStack Start server function is called with. */
export function serverFnCall(spec: ActionSpec): string {
    if (spec.usesId && spec.schema !== null) return '({ data: { id, data } })';
    if (spec.usesId) return '({ data: id })';
    if (spec.schema !== null) return '({ data })';
    return '()';
}

/** Whether the action answers with a list of records, which parses with `z.array(...)`. */
export function returnsList(spec: ActionSpec): boolean {
    return spec.returns.endsWith('[]>');
}

/**
 * The expression that turns an untrusted response body into the entity: the entity schema for one
 * record, `z.array` of it for a list. A cast would let a response the API changed flow on unchecked.
 */
export function parseResponse(spec: ActionSpec, entity: string, value: string): string {
    const schema = `${entity}Schema`;
    return returnsList(spec) ? `z.array(${schema}).parse(${value})` : `${schema}.parse(${value})`;
}

/** The imports `parseResponse` needs, none when the action returns nothing to parse. */
export function responseSchemaImports(spec: ActionSpec, entity: string, schemaPath: string): readonly string[] {
    if (!spec.usesEntityType) return [];
    return [
        ...(returnsList(spec) ? ["import { z } from 'zod';"] : []),
        `import { ${entity}Schema } from '${schemaPath}';`,
    ];
}
