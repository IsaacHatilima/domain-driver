import { lowerFirst } from '../../utils/naming';
import { ActionSpec, isQueryAction } from '../actions';
import { RenderContext } from '../context';
import { parseResponse, responseSchemaImports, serverFnCall } from './http';
import { domainImports } from '../signatures';
import { keysConstant } from './query-keys';

const MAX_LINE = 120;

/**
 * The hook calls the server function directly. There is no client-side service or
 * repository in between: the service and the repository sit behind that function,
 * on the server, where the database is.
 */
function preamble(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string, imported: string): string {
    const fnPath = ctx.importLayer(fromFile, 'controller', `${spec.name}.fn`);
    const keysPath = ctx.importLayer(fromFile, 'hook', `${ctx.feature}.keys`);
    const schemaPath = ctx.importLayer(fromFile, 'schema', `${entity}.schema`);
    const imports = [
        `import { ${imported} } from '@tanstack/react-query';`,
        ...responseSchemaImports(spec, entity, schemaPath),
        ...domainImports(ctx, fromFile, spec, entity),
        `import { ${lowerFirst(spec.name)} } from '${fnPath}';`,
        `import { ${keysConstant(ctx.feature)} } from '${keysPath}';`,
    ];
    return `${imports.join('\n')}\n`;
}

/**
 * The server function's result crosses the network like any API response, so a hook that
 * reads a record back parses it with the entity schema. A void action has nothing to parse.
 */
function callAndParse(spec: ActionSpec, entity: string, signature: string): string {
    const call = `${lowerFirst(spec.name)}${serverFnCall(spec)}`;
    if (!spec.usesEntityType) return `${signature}: ${spec.returns} => ${call}`;
    return `async ${signature}: ${spec.returns} => ${parseResponse(spec, entity, `await ${call}`)}`;
}

/**
 * List keys on `all` and Show on `detail(id)`. A custom GET action (e.g. `FindActiveCats`, or
 * `CatHistory` on one record) must not reuse either: one cache entry shared by two hooks lets
 * whichever observer mounts last win the `queryFn`. Neither `usesId` nor the path tells them
 * apart, because a custom action routed at its feature's root has List's path, so the spec's
 * `custom` flag decides. The `[...base, name]` spread (rather than a bare `[feature, name]`) is
 * deliberate: TanStack Query invalidates by key prefix, so a mutation invalidating `keys.all`
 * or `keys.detail(id)` still invalidates this custom query for free.
 */
function queryKey(ctx: RenderContext, spec: ActionSpec): string {
    const keys = keysConstant(ctx.feature);
    const base = spec.usesId ? `${keys}.detail(id)` : `${keys}.all`;
    return spec.custom ? `[...${base}, '${spec.name}']` : base;
}

function renderQuery(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string {
    return `${preamble(ctx, spec, entity, fromFile, 'useQuery')}
export function use${spec.name}(${spec.params}) {
  return useQuery({
    queryKey: ${queryKey(ctx, spec)},
    queryFn: ${callAndParse(spec, entity, '()')},
  });
}
`;
}

function mutationInput(spec: ActionSpec): { readonly signature: string; readonly call: string; readonly idFrom: string | null } {
    if (spec.usesId && spec.schema !== null) {
        return {
            signature: `({ id, data }: { id: string; data: ${spec.schema} })`,
            call: 'id, data',
            idFrom: '{ id }',
        };
    }
    if (spec.usesId) return { signature: '(id: string)', call: 'id', idFrom: 'id' };
    if (spec.schema !== null) return { signature: `(data: ${spec.schema})`, call: 'data', idFrom: null };
    return { signature: '()', call: '', idFrom: null };
}

/** Breaks a long `mutationFn` after its arrow, so the generated line stays readable. */
function wrap(fn: string): string {
    const line = `    mutationFn: ${fn},`;
    if (line.length <= MAX_LINE) return fn;
    const arrow = fn.indexOf(' => ');
    return `${fn.slice(0, arrow)} =>\n      ${fn.slice(arrow + ' => '.length)}`;
}

function renderMutation(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string {
    const keys = keysConstant(ctx.feature);
    const { signature, call, idFrom } = mutationInput(spec);
    const args = idFrom === null ? '()' : `(_result, ${idFrom})`;
    const detail =
        idFrom === null
            ? ''
            : `\n      void queryClient.invalidateQueries({ queryKey: ${keys}.detail(id) });`;

    return `${preamble(ctx, spec, entity, fromFile, 'useMutation, useQueryClient')}
export function use${spec.name}() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ${wrap(callAndParse(spec, entity, signature))},
    onSuccess: ${args} => {
      void queryClient.invalidateQueries({ queryKey: ${keys}.all });${detail}
    },
  });
}
`;
}

export function renderQueryHook(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string {
    return isQueryAction(spec)
        ? renderQuery(ctx, spec, entity, fromFile)
        : renderMutation(ctx, spec, entity, fromFile);
}
