import { ActionSpec, takesQuery } from '../actions';
import { RenderContext } from '../context';
import { callArgs, schemaImport, serviceImport } from './shape';

const ROUTE_CONTEXT = 'type RouteContext = { params: Promise<{ id: string }> };';

/** The handler's parameters: the request when there is a body, and the route context on a record. */
function parameters(spec: ActionSpec): string {
    const request = spec.schema !== null ? 'request: Request' : '_request: Request';
    if (spec.usesId) return `${request}, { params }: RouteContext`;
    return spec.schema !== null ? request : '';
}

/**
 * A GET carries its input in the URL's search params, read the way Next hands a page its
 * searchParams: a repeated key as an array, any other key as a string. `Object.fromEntries` on the
 * params alone would keep only a repeated key's last value. Every other method sends a JSON body.
 */
const READ_QUERY = `  const { searchParams } = new URL(request.url);
  const query = Object.fromEntries(
    Array.from(new Set(searchParams.keys()), (key) => {
      const values = searchParams.getAll(key);
      return [key, values.length === 1 ? values[0] : values];
    }),
  );
`;

function input(spec: ActionSpec): string {
    return takesQuery(spec) ? 'query' : 'await request.json()';
}

function body(spec: ActionSpec): string {
    const id = spec.usesId ? '  const { id } = await params;\n' : '';
    const read = takesQuery(spec) ? READ_QUERY : '';
    const validate =
        spec.schema !== null
            ? `${read}  const parsed = ${spec.schema}Schema.safeParse(${input(spec)});
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
`
            : '';
    const args = callArgs(spec, 'id', 'parsed.data');
    if (spec.status === 204) {
        return `${id}${validate}  await service.handle(${args});
  return new Response(null, { status: 204 });`;
    }
    const status = spec.status === 200 ? '' : `, { status: ${spec.status} }`;
    return `${id}${validate}  return NextResponse.json(await service.handle(${args})${status});`;
}

export function renderActionRoute(ctx: RenderContext, spec: ActionSpec, fromFile: string): string {
    const imports = [
        "import { NextResponse } from 'next/server';",
        ...(spec.schema !== null ? [schemaImport(ctx, fromFile, spec.schema)] : []),
        serviceImport(ctx, fromFile, spec),
    ].join('\n');
    const method = spec.method.toUpperCase();
    const returns = spec.status === 204 ? 'Promise<Response>' : 'Promise<NextResponse>';
    const routeContext = spec.usesId ? `\n${ROUTE_CONTEXT}\n` : '';

    return `${imports}

const service = new ${spec.name}Service();
${routeContext}
export async function ${method}(${parameters(spec)}): ${returns} {
${body(spec)}
}
`;
}
