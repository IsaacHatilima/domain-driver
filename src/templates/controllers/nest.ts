import { ActionSpec, HttpMethod, inputArg, takesQuery } from '../actions';
import { RenderContext } from '../context';
import { nestRoute, NestRoute } from './nest-route';
import { serviceImport } from './shape';

const METHOD_DECORATORS: Readonly<Record<HttpMethod, string>> = Object.freeze({
    get: 'Get',
    post: 'Post',
    put: 'Put',
    patch: 'Patch',
    delete: 'Delete',
});

const NEST_DEFAULT_STATUS: Readonly<Record<HttpMethod, number>> = Object.freeze({
    get: 200,
    post: 201,
    put: 200,
    patch: 200,
    delete: 200,
});

interface NestDecorator {
    readonly decorator: string;
    readonly commonImports: readonly string[];
}

function nestDecorator(spec: ActionSpec, target: NestRoute): NestDecorator {
    const decoratorName = METHOD_DECORATORS[target.method];
    const route = `@${decoratorName}(${target.path ? `'${target.path}'` : ''})`;
    const needsHttpCode = spec.status !== NEST_DEFAULT_STATUS[target.method];
    const decorator = needsHttpCode ? `${route}\n  @HttpCode(${spec.status})` : route;
    const commonImports = [
        'Controller',
        decoratorName,
        ...(spec.schema !== null ? [inputDecorator(spec)] : []),
        ...(spec.usesId ? ['Param'] : []),
        ...(needsHttpCode ? ['HttpCode'] : []),
    ].sort();
    return { decorator, commonImports };
}

/** A GET's input is its query string, validated by the same DTO a body would be. */
function inputDecorator(spec: ActionSpec): 'Query' | 'Body' {
    return takesQuery(spec) ? 'Query' : 'Body';
}

/** The DTO-typed parameter and the name it is passed on as: `query` for a GET, `body` otherwise. */
function inputParameter(spec: ActionSpec): string {
    return inputArg(spec) === 'query' ? 'query' : 'body';
}

export function renderNestController(
    ctx: RenderContext,
    spec: ActionSpec,
    entity: string,
    fromFile: string
): string {
    const target = nestRoute(ctx, spec, entity);
    const route = nestDecorator(spec, target);
    const dto = spec.schema !== null ? `${spec.schema}Dto` : null;

    const imports = [
        `import { ${route.commonImports.join(', ')} } from '@nestjs/common';`,
        ...(spec.usesEntityType
            ? [`import type { ${entity} } from '${ctx.importLayer(fromFile, 'types', `${entity}.types`)}';`]
            : []),
        ...(dto !== null && spec.schema !== null
            ? [`import { ${dto} } from '${ctx.importLayer(fromFile, 'dto', `${spec.schema}.dto`)}';`]
            : []),
        serviceImport(ctx, fromFile, spec),
    ].join('\n');

    const input = inputParameter(spec);
    const params = [
        spec.usesId ? "@Param('id') id: string" : null,
        dto !== null ? `@${inputDecorator(spec)}() ${input}: ${dto}` : null,
    ]
        .filter((param): param is string => param !== null)
        .join(', ');
    const args = [spec.usesId ? 'id' : null, dto !== null ? input : null]
        .filter((arg): arg is string => arg !== null)
        .join(', ');

    return `${imports}

@Controller('${target.prefix}')
export class ${spec.name}Controller {
  constructor(private readonly service: ${spec.name}Service) {}

  ${route.decorator}
  handle(${params}): ${spec.returns} {
    return this.service.handle(${args});
  }
}
`;
}
