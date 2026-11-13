import { ActionSpec, inputArg } from '../actions';

/**
 * Renders the `fetch(...)` arguments for an action. Hooks own the call to the API:
 * the service and the repository live behind that API, on the server, so there is
 * nothing for the browser to layer on top of a request.
 *
 * The id is encoded: it comes from outside the hook, and a `/`, `?` or `#` in it would
 * otherwise send the request to a different route.
 */
function fetchUrl(spec: ActionSpec, base: string, search: string | null): string {
    const route = `${base}${spec.path === '/' ? '' : spec.path}`;
    if (!route.includes(':id') && search === null) return `'${route}'`;
    const tail = search === null ? '' : `\${${search}}`;
    return `\`${route.replace(':id', '${encodeURIComponent(id)}')}${tail}\``;
}

/**
 * `search` is the expression holding the query string a GET with input sends, `?...` or empty. A
 * GET has no body, so that is the only place its input goes.
 */
export function fetchCall(spec: ActionSpec, feature: string, indent: string, search: string | null = null): string {
    const base = `/api/${feature}`;
    const url = fetchUrl(spec, base, search);
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

/**
 * The helper a hook for a GET with input sends that input with: one search param per defined value,
 * an array as repeated keys, and an empty string rather than a bare `?` when there is nothing to send.
 */
export function renderQueryStringHelper(schema: string): string {
    return `/** The input as a query string: every defined value as a string, an array as repeated keys. */
function toQueryString(query: ${schema}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item));
  }
  const search = params.toString();
  return search === '' ? '' : \`?\${search}\`;
}
`;
}

/** The arguments a generated TanStack Start server function is called with. */
export function serverFnCall(spec: ActionSpec): string {
    const input = inputArg(spec);
    const payload = input === 'data' ? 'data' : `data: ${input}`;
    if (spec.usesId && spec.schema !== null) return `({ data: { id, ${payload} } })`;
    if (spec.usesId) return '({ data: id })';
    if (spec.schema !== null) return `({ ${payload} })`;
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
