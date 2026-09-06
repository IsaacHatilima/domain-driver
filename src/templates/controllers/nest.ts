import { ActionSpec, HttpMethod } from '../actions';
import { RenderContext } from '../context';
import { serviceImport } from './shape';

const METHOD_DECORATORS: Readonly<Record<HttpMethod, string>> = Object.freeze({
    get: 'Get',
    post: 'Post',
    put: 'Put',
    delete: 'Delete',
});

const NEST_DEFAULT_STATUS: Readonly<Record<HttpMethod, number>> = Object.freeze({
    get: 200,
    post: 201,
    put: 200,
    delete: 200,
});

interface NestRoute {
    readonly decorator: string;
    readonly commonImports: readonly string[];
}

function nestRoute(spec: ActionSpec): NestRoute {
    const decoratorName = METHOD_DECORATORS[spec.method];
    const routePath = spec.path === '/' ? '' : spec.path.slice(1);
    const route = `@${decoratorName}(${routePath ? `'${routePath}'` : ''})`;
    const needsHttpCode = spec.status !== NEST_DEFAULT_STATUS[spec.method];
    const decorator = needsHttpCode ? `${route}\n  @HttpCode(${spec.status})` : route;
    const commonImports = [
        'Controller',
        decoratorName,
        ...(spec.schema !== null ? ['Body'] : []),
        ...(spec.usesId ? ['Param'] : []),
        ...(needsHttpCode ? ['HttpCode'] : []),
    ].sort();
    return { decorator, commonImports };
}

export function renderNestController(
    ctx: RenderContext,
    spec: ActionSpec,
    entity: string,
    fromFile: string
): string {
    const route = nestRoute(spec);
    const dto = spec.schema !== null ? `${spec.schema}Dto` : null;

    const imports = [
        `import { ${route.commonImports.join(', ')} } from '@nestjs/common';`,
        ...(spec.usesEntityType
            ? [`import { ${entity} } from '${ctx.importLayer(fromFile, 'types', `${entity}.types`)}';`]
            : []),
        ...(dto !== null && spec.schema !== null
            ? [`import { ${dto} } from '${ctx.importLayer(fromFile, 'dto', `${spec.schema}.dto`)}';`]
            : []),
        serviceImport(ctx, fromFile, spec),
    ].join('\n');

    const params = [spec.usesId ? "@Param('id') id: string" : null, dto !== null ? `@Body() body: ${dto}` : null]
        .filter((param): param is string => param !== null)
        .join(', ');
    const args = [spec.usesId ? 'id' : null, dto !== null ? 'body' : null]
        .filter((arg): arg is string => arg !== null)
        .join(', ');

    return `${imports}

@Controller('${ctx.feature}')
export class ${spec.name}Controller {
  constructor(private readonly service: ${spec.name}Service) {}

  ${route.decorator}
  handle(${params}): ${spec.returns} {
    return this.service.handle(${args});
  }
}
`;
}
