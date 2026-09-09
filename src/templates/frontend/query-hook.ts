import { ActionSpec } from '../actions';
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

function renderQuery(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string {
    const key = spec.usesId ? `${keysConstant(ctx.feature)}.detail(id)` : `${keysConstant(ctx.feature)}.all`;

    return `${preamble(ctx, spec, entity, fromFile, 'useQuery')}
export function use${spec.name}(${spec.params}) {
  return useQuery({
    queryKey: ${key},
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
    return spec.method === 'get'
        ? renderQuery(ctx, spec, entity, fromFile)
        : renderMutation(ctx, spec, entity, fromFile);
}
