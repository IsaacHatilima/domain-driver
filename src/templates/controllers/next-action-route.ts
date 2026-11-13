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

/** A GET carries its input in the URL's search params; every other method in a JSON body. */
function input(spec: ActionSpec): string {
    return takesQuery(spec) ? 'Object.fromEntries(new URL(request.url).searchParams)' : 'await request.json()';
}

function body(spec: ActionSpec): string {
    const id = spec.usesId ? '  const { id } = await params;\n' : '';
    const validate =
        spec.schema !== null
            ? `  const parsed = ${spec.schema}Schema.safeParse(${input(spec)});
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
