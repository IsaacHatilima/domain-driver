import { lowerFirst } from '../../utils/naming';
import { ActionSpec, isQueryAction } from '../actions';
import { RenderContext } from '../context';
import { domainImports } from '../signatures';
import { fetchCall } from './http';

function payloadType(spec: ActionSpec): string {
    return spec.returns.replace(/^Promise<(.*)>$/, '$1');
}

/**
 * No `'use client'` directive, deliberately. The directive marks a boundary, and the
 * component that consumes the hook is that boundary. Putting it here as well makes
 * Next's TypeScript plugin treat the exported hook as a component and reject an
 * `onSuccess` callback as a non-serializable prop (TS71007).
 */
function header(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string, hooks: string): string {
    const domain = domainImports(ctx, fromFile, spec, entity);

    return `import { ${hooks} } from 'react';
${domain.join('\n')}${domain.length > 0 ? '\n' : ''}`;
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
      const response = await fetch(${fetchCall(spec, ctx.feature, '      ')});
      if (!response.ok) throw new Error('${spec.failure}');
      setData((await response.json()) as ${type});
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
    const request = `      const response = await fetch(${fetchCall(spec, ctx.feature, '      ')});
      if (!response.ok) throw new Error('${spec.failure}');`;
    const body = returnsValue
        ? `${request}
      const result = (await response.json()) as ${type};
      onSuccess?.(result);
      return result;`
        : `${request}
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
