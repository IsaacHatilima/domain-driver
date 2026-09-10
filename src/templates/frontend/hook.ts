import { lowerFirst } from '../../utils/naming';
import { ActionSpec, isQueryAction } from '../actions';
import { RenderContext } from '../context';
import { domainImports } from '../signatures';

function payloadType(spec: ActionSpec): string {
    return spec.returns.replace(/^Promise<(.*)>$/, '$1');
}

function header(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string, hooks: string): string {
    const directive = ctx.profile.clientDirective ? "'use client';\n\n" : '';
    const servicePath = ctx.importLayer(fromFile, 'clientService', `${spec.name}.service`);
    const domain = domainImports(ctx, fromFile, spec, entity);

    return `${directive}import { ${hooks} } from 'react';
${domain.join('\n')}${domain.length > 0 ? '\n' : ''}import { ${spec.name}Service } from '${servicePath}';

const service = new ${spec.name}Service();
`;
}

function renderQuery(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string {
    const type = payloadType(spec);
    const isList = type.endsWith('[]');
    const stateType = isList ? type : `${type} | null`;
    const initial = isList ? '[]' : 'null';
    const deps = spec.usesId ? '[id]' : '[]';

    return `${header(ctx, spec, entity, fromFile, 'useState, useEffect, useCallback')}
export function use${spec.name}(${spec.params}) {
  const [data, setData] = useState<${stateType}>(${initial});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await service.handle(${spec.args}));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '${spec.failure}');
    } finally {
      setLoading(false);
    }
  }, ${deps});

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
`;
}

function renderMutation(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string {
    const callable = lowerFirst(spec.name);
    const returnsValue = spec.usesEntityType;
    const type = payloadType(spec);
    const callbackType = returnsValue ? `(result: ${type}) => void` : '() => void';
    const body = returnsValue
        ? `      const result = await service.handle(${spec.args});
      onSuccess?.(result);
      return result;`
        : `      await service.handle(${spec.args});
      onSuccess?.();`;
    const failure = returnsValue
        ? `      setError(err instanceof Error ? err.message : '${spec.failure}');
      return null;`
        : `      setError(err instanceof Error ? err.message : '${spec.failure}');`;

    return `${header(ctx, spec, entity, fromFile, 'useState, useCallback')}
export function use${spec.name}(options: { onSuccess?: ${callbackType} } = {}) {
  const { onSuccess } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ${callable} = useCallback(async (${spec.params}) => {
    setLoading(true);
    setError(null);
    try {
${body}
    } catch (err: unknown) {
${failure}
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return { ${callable}, loading, error };
}
`;
}

export function renderHook(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string {
    return isQueryAction(spec)
        ? renderQuery(ctx, spec, entity, fromFile)
        : renderMutation(ctx, spec, entity, fromFile);
}
