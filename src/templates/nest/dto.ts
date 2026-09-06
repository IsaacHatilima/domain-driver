import { RenderContext } from '../context';

export function renderDto(ctx: RenderContext, name: string, fromFile: string): string {
    const schemaName = `${name}Schema`;
    const schemaPath = ctx.importLayer(fromFile, 'schema', `${name}.schema`);
    return `import { createZodDto } from 'nestjs-zod';
import { ${schemaName} } from '${schemaPath}';

export class ${name}Dto extends createZodDto(${schemaName}) {}
`;
}
