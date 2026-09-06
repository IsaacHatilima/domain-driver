import { Action, ActionSpec, standardAction } from './actions';
import { RenderContext } from './context';

export interface ActionSignature {
    readonly params: string;
    readonly args: string;
    readonly returns: string;
    readonly usesEntityType: boolean;
    readonly usesSchema: boolean;
}

/** @deprecated removed in the controller refactor; use ActionSpec */
export function actionSignature(action: Action, entity: string): ActionSignature {
    const spec = standardAction(action, entity);
    return { params: spec.params, args: spec.args, returns: spec.returns, usesEntityType: spec.usesEntityType, usesSchema: spec.schema !== null };
}

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
