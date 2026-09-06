import { lowerFirst } from '../../utils/naming';
import { Action } from '../actions';
import { RenderContext } from '../context';
import { callArgs, controllerImports, controllerShape, handlerName, schemaImport, serviceImport } from './shape';

export function renderHonoController(
    ctx: RenderContext,
    action: Action,
    entity: string,
    fromFile: string
): string {
    const shape = controllerShape(action);
    const imports = [
        "import { Context } from 'hono';",
        ...(shape.usesBody ? [schemaImport(ctx, fromFile, action, entity)] : []),
        serviceImport(ctx, fromFile, action, entity),
    ].join('\n');
    const contextType = shape.usesId ? "Context<{}, '/:id'>" : 'Context';
    const validate = shape.usesBody
        ? `  const parsed = ${action}${entity}Schema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ errors: parsed.error.flatten() }, 400);
`
        : '';
    const args = callArgs(shape, "c.req.param('id')", 'parsed.data');
    const respond =
        shape.status === 204
            ? `  await service.handle(${args});
  return c.body(null, 204);`
            : `  return c.json(await service.handle(${args}), ${shape.status});`;

    return `${imports}

const service = new ${action}${entity}Service();

export async function ${handlerName(action, entity)}(c: ${contextType}): Promise<Response> {
${validate}${respond}
}
`;
}

export function renderHonoRoutes(ctx: RenderContext, entity: string, fromFile: string): string {
    const name = lowerFirst(entity);
    return `import { Hono } from 'hono';
${controllerImports(ctx, fromFile, entity)}

const ${name} = new Hono();

${name}.get('/', ${handlerName('List', entity)});
${name}.get('/:id', ${handlerName('Show', entity)});
${name}.post('/', ${handlerName('Create', entity)});
${name}.put('/:id', ${handlerName('Update', entity)});
${name}.delete('/:id', ${handlerName('Delete', entity)});

export default ${name};

// app.route('/${ctx.feature}', ${name});
`;
}
