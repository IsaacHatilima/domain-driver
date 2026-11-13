import { lowerFirst } from '../../utils/naming';
import { ActionSpec, isQueryAction } from '../actions';
import { RenderContext } from '../context';
import { domainImports } from '../signatures';
import { fetchCall, parseResponse, responseSchemaImports } from './http';

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
    const schemaPath = ctx.importLayer(fromFile, 'schema', `${entity}.schema`);
    const imports = [
        `import { ${hooks} } from 'react';`,
        ...responseSchemaImports(spec, entity, schemaPath),
        ...domainImports(ctx, fromFile, spec, entity),
    ];
    return `${imports.join('\n')}\n`;
}

/**
 * The query hook keeps one result, tagged with the request that produced it. `loading`
 * and `error` are derived from that tag, so the effect only sets state in the request's
 * promise callbacks: eslint-plugin-react-hooks 7 rejects a synchronous `setState` in an
 * effect (`react-hooks/set-state-in-effect`), and a changed id or a `refetch()` still
 * reads as loading straight away. The cleanup aborts the superseded request, so a late
 * response never overwrites a newer one.
 */
function renderQuery(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string {
    const type = payloadType(spec);
    const isList = type.endsWith('[]');
    const dataType = isList ? type : `${type} | null`;
    const empty = isList ? '[]' : 'null';
    const request = spec.usesId ? '`${id}:${attempt}`' : 'String(attempt)';
    const deps = spec.usesId ? '[id, request]' : '[request]';

    return `${header(ctx, spec, entity, fromFile, 'useState, useEffect, useCallback')}
type ${spec.name}Result = { request: string; data: ${dataType}; error: string | null };

export function use${spec.name}(${spec.params}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<${spec.name}Result | null>(null);
  const request = ${request};

  useEffect(() => {
    const controller = new AbortController();
    fetch(${fetchCall(spec, ctx.feature, '    ')}, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('${spec.failure}');
        return ${parseResponse(spec, entity, 'await response.json()')};
      })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ request, data, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ request, data: ${empty}, error: err instanceof Error ? err.message : '${spec.failure}' });
      });
    return () => controller.abort();
  }, ${deps});

  const refetch = useCallback(() => setAttempt((count) => count + 1), []);

  return {
    data: result?.data ?? ${empty},
    loading: result?.request !== request,
    error: result?.request === request ? result.error : null,
    refetch,
  };
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
      const result = ${parseResponse(spec, entity, 'await response.json()')};
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
