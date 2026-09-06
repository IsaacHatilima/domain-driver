import { lowerFirst } from '../../utils/naming';
import { Action, ActionSpec, standardAction } from '../actions';
import { RenderContext } from '../context';
import { callArgs, controllerImports, schemaImport, serviceImport } from './shape';

export function renderExpressController(ctx: RenderContext, spec: ActionSpec, fromFile: string): string {
    const imports = [
        "import { NextFunction, Request, Response } from 'express';",
        ...(spec.schema !== null ? [schemaImport(ctx, fromFile, spec.schema)] : []),
        serviceImport(ctx, fromFile, spec),
    ].join('\n');
    const reqName = spec.schema !== null || spec.usesId ? 'req' : '_req';
    const requestType = spec.usesId ? 'Request<{ id: string }>' : 'Request';
    const validate =
        spec.schema !== null
            ? `  const parsed = ${spec.schema}Schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten() });
    return;
  }
`
            : '';
    const args = callArgs(spec, 'req.params.id', 'parsed.data');
    const respond =
        spec.status === 204
            ? `    await service.handle(${args});
    res.status(204).send();`
            : `    res.status(${spec.status}).json(await service.handle(${args}));`;

    return `${imports}

const service = new ${spec.name}Service();

export async function ${spec.handler}(${reqName}: ${requestType}, res: Response, next: NextFunction): Promise<void> {
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
    const handler = (action: Action): string => standardAction(action, entity).handler;
    return `import { Router } from 'express';
${controllerImports(ctx, fromFile, entity)}

const router = Router();

router.get('/', ${handler('List')});
router.get('/:id', ${handler('Show')});
router.post('/', ${handler('Create')});
router.put('/:id', ${handler('Update')});
router.delete('/:id', ${handler('Delete')});

export default router;

// app.use('/${ctx.feature}', ${name}Routes);
`;
}
