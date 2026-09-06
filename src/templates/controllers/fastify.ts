import { lowerFirst } from '../../utils/naming';
import { Action } from '../actions';
import { RenderContext } from '../context';
import { callArgs, controllerImports, controllerShape, handlerName, schemaImport, serviceImport } from './shape';

export function renderFastifyController(
    ctx: RenderContext,
    action: Action,
    entity: string,
    fromFile: string
): string {
    const shape = controllerShape(action);
    const imports = [
        "import { FastifyReply, FastifyRequest } from 'fastify';",
        ...(shape.usesBody ? [schemaImport(ctx, fromFile, action, entity)] : []),
        serviceImport(ctx, fromFile, action, entity),
    ].join('\n');
    const requestType = shape.usesId ? 'FastifyRequest<{ Params: { id: string } }>' : 'FastifyRequest';
    const requestName = shape.usesBody || shape.usesId ? 'request' : '_request';
    const validate = shape.usesBody
        ? `  const parsed = ${action}${entity}Schema.safeParse(request.body);
  if (!parsed.success) {
    reply.status(400).send({ errors: parsed.error.flatten() });
    return;
  }
`
        : '';
    const args = callArgs(shape, 'request.params.id', 'parsed.data');
    const respond =
        shape.status === 204
            ? `  await service.handle(${args});
  reply.status(204).send();`
            : `  reply.status(${shape.status}).send(await service.handle(${args}));`;

    return `${imports}

const service = new ${action}${entity}Service();

export async function ${handlerName(action, entity)}(${requestName}: ${requestType}, reply: FastifyReply): Promise<void> {
${validate}${respond}
}
`;
}

export function renderFastifyRoutes(ctx: RenderContext, entity: string, fromFile: string): string {
    const name = lowerFirst(entity);
    return `import { FastifyInstance } from 'fastify';
${controllerImports(ctx, fromFile, entity)}

export async function ${name}Routes(app: FastifyInstance): Promise<void> {
  app.get('/', ${handlerName('List', entity)});
  app.get('/:id', ${handlerName('Show', entity)});
  app.post('/', ${handlerName('Create', entity)});
  app.put('/:id', ${handlerName('Update', entity)});
  app.delete('/:id', ${handlerName('Delete', entity)});
}

// app.register(${name}Routes, { prefix: '/${ctx.feature}' });
`;
}
