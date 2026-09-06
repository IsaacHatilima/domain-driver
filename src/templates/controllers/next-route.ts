import { standardAction } from '../actions';
import { RenderContext } from '../context';
import { schemaImport, serviceImport } from './shape';

export function renderCollectionRoute(ctx: RenderContext, entity: string, fromFile: string): string {
    return `import { NextResponse } from 'next/server';
${schemaImport(ctx, fromFile, `Create${entity}`)}
${serviceImport(ctx, fromFile, standardAction('List', entity))}
${serviceImport(ctx, fromFile, standardAction('Create', entity))}

const listService = new List${entity}Service();
const createService = new Create${entity}Service();

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(await listService.handle());
}

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = Create${entity}Schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json(await createService.handle(parsed.data), { status: 201 });
}
`;
}

export function renderItemRoute(ctx: RenderContext, entity: string, fromFile: string): string {
    return `import { NextResponse } from 'next/server';
${schemaImport(ctx, fromFile, `Update${entity}`)}
${serviceImport(ctx, fromFile, standardAction('Show', entity))}
${serviceImport(ctx, fromFile, standardAction('Update', entity))}
${serviceImport(ctx, fromFile, standardAction('Delete', entity))}

const showService = new Show${entity}Service();
const updateService = new Update${entity}Service();
const deleteService = new Delete${entity}Service();

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const { id } = await params;
  return NextResponse.json(await showService.handle(id));
}

export async function PUT(request: Request, { params }: RouteContext): Promise<NextResponse> {
  const { id } = await params;
  const parsed = Update${entity}Schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json(await updateService.handle(id, parsed.data));
}

export async function DELETE(_request: Request, { params }: RouteContext): Promise<Response> {
  const { id } = await params;
  await deleteService.handle(id);
  return new Response(null, { status: 204 });
}
`;
}
