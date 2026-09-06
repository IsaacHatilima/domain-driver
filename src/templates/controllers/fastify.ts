import { lowerFirst } from '../../utils/naming';
import { Action, ActionSpec, standardAction } from '../actions';
import { RenderContext } from '../context';
import { callArgs, controllerImports, schemaImport, serviceImport } from './shape';

export function renderFastifyController(ctx: RenderContext, spec: ActionSpec, fromFile: string): string {
    const imports = [
        "import { FastifyReply, FastifyRequest } from 'fastify';",
        ...(spec.schema !== null ? [schemaImport(ctx, fromFile, spec.schema)] : []),
        serviceImport(ctx, fromFile, spec),
    ].join('\n');
    const requestType = spec.usesId ? 'FastifyRequest<{ Params: { id: string } }>' : 'FastifyRequest';
    const requestName = spec.schema !== null || spec.usesId ? 'request' : '_request';
    const validate =
        spec.schema !== null
            ? `  const parsed = ${spec.schema}Schema.safeParse(request.body);
  if (!parsed.success) {
    reply.status(400).send({ errors: parsed.error.flatten() });
    return;
  }
`
            : '';
    const args = callArgs(spec, 'request.params.id', 'parsed.data');
    const respond =
        spec.status === 204
            ? `  await service.handle(${args});
  reply.status(204).send();`
            : `  reply.status(${spec.status}).send(await service.handle(${args}));`;

    return `${imports}

const service = new ${spec.name}Service();

export async function ${spec.handler}(${requestName}: ${requestType}, reply: FastifyReply): Promise<void> {
${validate}${respond}
}
`;
}

export function renderFastifyRoutes(ctx: RenderContext, entity: string, fromFile: string): string {
    const name = lowerFirst(entity);
    const handler = (action: Action): string => standardAction(action, entity).handler;
    return `import { FastifyInstance } from 'fastify';
${controllerImports(ctx, fromFile, entity)}

export async function ${name}Routes(app: FastifyInstance): Promise<void> {
  app.get('/', ${handler('List')});
  app.get('/:id', ${handler('Show')});
  app.post('/', ${handler('Create')});
  app.put('/:id', ${handler('Update')});
  app.delete('/:id', ${handler('Delete')});
}

// app.register(${name}Routes, { prefix: '/${ctx.feature}' });
`;
}
