import { ActionSpec } from '../actions';
import { RenderContext } from '../context';
import { schemaImport, serviceImport } from './shape';

export function renderActionRoute(ctx: RenderContext, spec: ActionSpec, fromFile: string): string {
    const imports = [
        "import { NextResponse } from 'next/server';",
        ...(spec.schema !== null ? [schemaImport(ctx, fromFile, spec.schema)] : []),
        serviceImport(ctx, fromFile, spec),
    ].join('\n');
    const method = spec.method.toUpperCase();
    const requestParam = spec.schema !== null ? 'request: Request' : '';
    const validate =
        spec.schema !== null
            ? `  const parsed = ${spec.schema}Schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
`
            : '';
    const args = spec.schema !== null ? 'parsed.data' : '';

    if (spec.status === 204) {
        return `${imports}

const service = new ${spec.name}Service();

export async function ${method}(${requestParam}): Promise<Response> {
${validate}  await service.handle(${args});
  return new Response(null, { status: 204 });
}
`;
    }

    return `${imports}

const service = new ${spec.name}Service();

export async function ${method}(${requestParam}): Promise<NextResponse> {
${validate}  return NextResponse.json(await service.handle(${args}));
}
`;
}
