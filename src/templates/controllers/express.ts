import { lowerFirst } from '../../utils/naming';
import { Action } from '../actions';
import { RenderContext } from '../context';
import { callArgs, controllerImports, controllerShape, handlerName, schemaImport, serviceImport } from './shape';

export function renderExpressController(
    ctx: RenderContext,
    action: Action,
    entity: string,
    fromFile: string
): string {
    const shape = controllerShape(action);
    const imports = [
        "import { NextFunction, Request, Response } from 'express';",
        ...(shape.usesBody ? [schemaImport(ctx, fromFile, action, entity)] : []),
        serviceImport(ctx, fromFile, action, entity),
    ].join('\n');
    const reqName = shape.usesBody || shape.usesId ? 'req' : '_req';
    const requestType = shape.usesId ? 'Request<{ id: string }>' : 'Request';
    const validate = shape.usesBody
        ? `  const parsed = ${action}${entity}Schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten() });
    return;
  }
`
        : '';
    const args = callArgs(shape, 'req.params.id', 'parsed.data');
    const respond =
        shape.status === 204
            ? `    await service.handle(${args});
    res.status(204).send();`
            : `    res.status(${shape.status}).json(await service.handle(${args}));`;

    return `${imports}

const service = new ${action}${entity}Service();

export async function ${handlerName(action, entity)}(${reqName}: ${requestType}, res: Response, next: NextFunction): Promise<void> {
${validate}  try {
${respond}
  } catch (error) {
    next(error);
  }
}
`;
}

export function renderExpressRoutes(ctx: RenderContext, entity: string, fromFile: string): string {
    const name = lowerFirst(entity);
    return `import { Router } from 'express';
${controllerImports(ctx, fromFile, entity)}

const router = Router();

router.get('/', ${handlerName('List', entity)});
router.get('/:id', ${handlerName('Show', entity)});
router.post('/', ${handlerName('Create', entity)});
router.put('/:id', ${handlerName('Update', entity)});
router.delete('/:id', ${handlerName('Delete', entity)});

export default router;

// app.use('/${ctx.feature}', ${name}Routes);
`;
}
