import { ActionSpec } from '../actions';
import { RenderContext } from '../context';
import { schemaImport, serviceImport } from './shape';

export function renderGenericController(
    ctx: RenderContext,
    spec: ActionSpec,
    entity: string,
    fromFile: string
): string {
    const typeImport = spec.usesEntityType
        ? [`import { ${entity} } from '${ctx.importLayer(fromFile, 'types', `${entity}.types`)}';`]
        : [];
    const imports = [
        ...typeImport,
        ...(spec.schema !== null ? [schemaImport(ctx, fromFile, spec.schema)] : []),
        serviceImport(ctx, fromFile, spec),
    ].join('\n');
    const params = [spec.usesId ? 'id: string' : null, spec.schema !== null ? 'input: unknown' : null]
        .filter((param): param is string => param !== null)
        .join(', ');
    const args = [spec.usesId ? 'id' : null, spec.schema !== null ? `${spec.schema}Schema.parse(input)` : null]
        .filter((arg): arg is string => arg !== null)
        .join(', ');

    return `${imports}

const service = new ${spec.name}Service();

export class ${spec.name}Controller {
  async handle(${params}): ${spec.returns} {
    return service.handle(${args});
  }
}
`;
}
