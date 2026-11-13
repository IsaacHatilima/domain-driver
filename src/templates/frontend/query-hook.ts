import { lowerFirst } from '../../utils/naming';
import { ActionSpec, isQueryAction } from '../actions';
import { RenderContext } from '../context';
import { serverFnCall } from './http';
import { domainImports } from '../signatures';
import { keysConstant } from './query-keys';

/**
 * The hook calls the server function directly. There is no client-side service or
 * repository in between: the service and the repository sit behind that function,
 * on the server, where the database is.
 */
function preamble(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string, imported: string): string {
    const fnPath = ctx.importLayer(fromFile, 'controller', `${spec.name}.fn`);
    const keysPath = ctx.importLayer(fromFile, 'hook', `${ctx.feature}.keys`);
    const domain = domainImports(ctx, fromFile, spec, entity);

    return `import { ${imported} } from '@tanstack/react-query';
${domain.join('\n')}${domain.length > 0 ? '\n' : ''}import { ${lowerFirst(spec.name)} } from '${fnPath}';
import { ${keysConstant(ctx.feature)} } from '${keysPath}';
`;
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
    queryFn: (): ${spec.returns} => ${lowerFirst(spec.name)}${serverFnCall(spec)},
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
    mutationFn: ${signature}: ${spec.returns} => ${lowerFirst(spec.name)}${serverFnCall(spec)},
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
