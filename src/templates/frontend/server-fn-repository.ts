import { lowerFirst } from '../../utils/naming';
import { ActionSpec } from '../actions';
import { RenderContext } from '../context';
import { domainImports } from '../signatures';

function callArgument(spec: ActionSpec): string {
    if (spec.usesId && spec.schema !== null) return '({ data: { id, data } })';
    if (spec.usesId) return '({ data: id })';
    if (spec.schema !== null) return '({ data })';
    return '()';
}

export function renderServerFnRepository(
    ctx: RenderContext,
    spec: ActionSpec,
    entity: string,
    fromFile: string
): string {
    const fnName = lowerFirst(spec.name);
    const fnPath = ctx.importLayer(fromFile, 'controller', `${spec.name}.fn`);
    const imports = [...domainImports(ctx, fromFile, spec, entity), `import { ${fnName} } from '${fnPath}';`];

    return `${imports.join('\n')}

export class ${spec.name}Repository {
  async handle(${spec.params}): ${spec.returns} {
    return ${fnName}${callArgument(spec)};
  }
}
`;
}
