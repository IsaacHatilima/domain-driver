import { ActionSpec, isQueryAction } from '../actions';
import { RenderContext } from '../context';
import { domainImports } from '../signatures';
import { keysConstant } from './query-keys';

function preamble(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string, imported: string): string {
    const servicePath = ctx.importLayer(fromFile, 'clientService', `${spec.name}.service`);
    const keysPath = ctx.importLayer(fromFile, 'hook', `${ctx.feature}.keys`);
    const domain = domainImports(ctx, fromFile, spec, entity);

    return `import { ${imported} } from '@tanstack/react-query';
${domain.join('\n')}${domain.length > 0 ? '\n' : ''}import { ${spec.name}Service } from '${servicePath}';
import { ${keysConstant(ctx.feature)} } from '${keysPath}';

const service = new ${spec.name}Service();
`;
}

/**
 * A custom GET action (e.g. `FindActiveCats`) has `usesId: false`, just like List. Testing
 * only `usesId` would give it the exact same key as List's `all` — one cache entry shared by
 * two hooks, with whichever observer mounts last winning the `queryFn`. `spec.path === '/'`
 * is what actually distinguishes List from a custom action, so it is the second branch.
 * The `[...all, name]` spread (rather than a bare `[feature, name]`) is deliberate: TanStack
 * Query invalidates by key prefix, so a Create mutation invalidating `keys.all` still
 * invalidates this custom list for free.
 */
function queryKey(ctx: RenderContext, spec: ActionSpec): string {
    const keys = keysConstant(ctx.feature);
    if (spec.usesId) return `${keys}.detail(id)`;
    if (spec.path === '/') return `${keys}.all`;
    return `[...${keys}.all, '${spec.name}']`;
}

function renderQuery(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string {
    return `${preamble(ctx, spec, entity, fromFile, 'useQuery')}
export function use${spec.name}(${spec.params}) {
  return useQuery({
    queryKey: ${queryKey(ctx, spec)},
    queryFn: (): ${spec.returns} => service.handle(${spec.args}),
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
    mutationFn: ${signature}: ${spec.returns} => service.handle(${call}),
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
