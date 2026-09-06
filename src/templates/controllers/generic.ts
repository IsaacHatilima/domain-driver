import { Action } from '../actions';
import { RenderContext } from '../context';
import { actionSignature } from '../signatures';
import { controllerShape, schemaImport, serviceImport } from './shape';

export function renderGenericController(
    ctx: RenderContext,
    action: Action,
    entity: string,
    fromFile: string
): string {
    const shape = controllerShape(action);
    const signature = actionSignature(action, entity);
    const typeImport = signature.usesEntityType
        ? [`import { ${entity} } from '${ctx.importLayer(fromFile, 'types', `${entity}.types`)}';`]
        : [];
    const imports = [
        ...typeImport,
        ...(shape.usesBody ? [schemaImport(ctx, fromFile, action, entity)] : []),
        serviceImport(ctx, fromFile, action, entity),
    ].join('\n');
    const params = [shape.usesId ? 'id: string' : null, shape.usesBody ? 'input: unknown' : null]
        .filter((param): param is string => param !== null)
        .join(', ');
    const args = [shape.usesId ? 'id' : null, shape.usesBody ? `${action}${entity}Schema.parse(input)` : null]
        .filter((arg): arg is string => arg !== null)
        .join(', ');

    return `${imports}

const service = new ${action}${entity}Service();

export class ${action}${entity}Controller {
  async handle(${params}): ${signature.returns} {
    return service.handle(${args});
  }
}
`;
}
