import { Action } from '../actions';
import { RenderContext } from '../context';
import { actionSignature } from '../signatures';
import { controllerShape, serviceImport } from './shape';

interface NestRoute {
    readonly decorator: string;
    readonly commonImports: readonly string[];
}

function nestRoute(action: Action): NestRoute {
    switch (action) {
        case 'List':
            return { decorator: '@Get()', commonImports: ['Controller', 'Get'] };
        case 'Show':
            return { decorator: "@Get(':id')", commonImports: ['Controller', 'Get', 'Param'] };
        case 'Create':
            return { decorator: '@Post()', commonImports: ['Body', 'Controller', 'Post'] };
        case 'Update':
            return { decorator: "@Put(':id')", commonImports: ['Body', 'Controller', 'Param', 'Put'] };
        case 'Delete':
            return { decorator: "@Delete(':id')\n  @HttpCode(204)", commonImports: ['Controller', 'Delete', 'HttpCode', 'Param'] };
    }
}

export function renderNestController(
    ctx: RenderContext,
    action: Action,
    entity: string,
    fromFile: string
): string {
    const shape = controllerShape(action);
    const signature = actionSignature(action, entity);
    const route = nestRoute(action);
    const dto = `${action}${entity}Dto`;

    const imports = [
        `import { ${route.commonImports.join(', ')} } from '@nestjs/common';`,
        ...(signature.usesEntityType
            ? [`import { ${entity} } from '${ctx.importLayer(fromFile, 'types', `${entity}.types`)}';`]
            : []),
        ...(shape.usesBody ? [`import { ${dto} } from '${ctx.importLayer(fromFile, 'dto', `${action}${entity}.dto`)}';`] : []),
        serviceImport(ctx, fromFile, action, entity),
    ].join('\n');

    const params = [shape.usesId ? "@Param('id') id: string" : null, shape.usesBody ? `@Body() body: ${dto}` : null]
        .filter((param): param is string => param !== null)
        .join(', ');
    const args = [shape.usesId ? 'id' : null, shape.usesBody ? 'body' : null]
        .filter((arg): arg is string => arg !== null)
        .join(', ');

    return `${imports}

@Controller('${ctx.feature}')
export class ${action}${entity}Controller {
  constructor(private readonly service: ${action}${entity}Service) {}

  ${route.decorator}
  handle(${params}): ${signature.returns} {
    return this.service.handle(${args});
  }
}
`;
}
