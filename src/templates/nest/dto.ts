import { WriteAction } from '../actions';
import { RenderContext } from '../context';

export function renderDto(ctx: RenderContext, action: WriteAction, entity: string, fromFile: string): string {
    const schemaName = `${action}${entity}Schema`;
    const schemaPath = ctx.importLayer(fromFile, 'schema', `${action}${entity}.schema`);
    return `import { createZodDto } from 'nestjs-zod';
import { ${schemaName} } from '${schemaPath}';

export class ${action}${entity}Dto extends createZodDto(${schemaName}) {}
`;
}
