import { ActionSpec } from './actions';
import { RenderContext } from './context';

export function domainImports(
    ctx: RenderContext,
    fromFile: string,
    spec: ActionSpec,
    entity: string
): readonly string[] {
    const lines: string[] = [];

    if (spec.usesEntityType) {
        const typePath = ctx.importLayer(fromFile, 'types', `${entity}.types`);
        lines.push(`import { ${entity} } from '${typePath}';`);
    }
    if (spec.schema !== null) {
        const schemaPath = ctx.importLayer(fromFile, 'schema', `${spec.schema}.schema`);
        lines.push(`import { ${spec.schema} } from '${schemaPath}';`);
    }
    return lines;
}
