import { lowerFirst } from '../../utils/naming';
import { Action, ActionSpec, standardAction, takesQuery } from '../actions';
import { RenderContext } from '../context';
import { callArgs, controllerImports, schemaImport, serviceImport } from './shape';

export function renderHonoController(ctx: RenderContext, spec: ActionSpec, fromFile: string): string {
    const imports = [
        "import { Context } from 'hono';",
        ...(spec.schema !== null ? [schemaImport(ctx, fromFile, spec.schema)] : []),
        serviceImport(ctx, fromFile, spec),
    ].join('\n');
    const contextType = spec.usesId ? `Context<{}, '${spec.path}'>` : 'Context';
    // c.req.query() keeps only a repeated key's first value, so the query is read through queries():
    // a repeated key as an array, as Express and Fastify parse it, and any other key as a string.
    const query = takesQuery(spec)
        ? `  const query = Object.fromEntries(
    Object.entries(c.req.queries()).map(([key, values]) => [key, values.length === 1 ? values[0] : values]),
  );
`
        : '';
    const validate =
        spec.schema !== null
            ? `${query}  const parsed = ${spec.schema}Schema.safeParse(${takesQuery(spec) ? 'query' : 'await c.req.json()'});
  if (!parsed.success) return c.json({ errors: parsed.error.flatten() }, 400);
`
            : '';
    const args = callArgs(spec, "c.req.param('id')", 'parsed.data');
    const respond =
        spec.status === 204
            ? `  await service.handle(${args});
  return c.body(null, 204);`
            : `  return c.json(await service.handle(${args}), ${spec.status});`;

    return `${imports}

const service = new ${spec.name}Service();

export async function ${spec.handler}(c: ${contextType}): Promise<Response> {
${validate}${respond}
}
`;
}

export function renderHonoRoutes(ctx: RenderContext, entity: string, fromFile: string): string {
    const name = lowerFirst(entity);
    const handler = (action: Action): string => standardAction(action, entity).handler;
    return `import { Hono } from 'hono';
${controllerImports(ctx, fromFile, entity)}

const ${name} = new Hono();

${name}.get('/', ${handler('List')});
${name}.get('/:id', ${handler('Show')});
${name}.post('/', ${handler('Create')});
${name}.put('/:id', ${handler('Update')});
${name}.delete('/:id', ${handler('Delete')});

export default ${name};

// app.route('/${ctx.feature}', ${name});
`;
}
