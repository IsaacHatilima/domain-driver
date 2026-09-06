import { Action } from './actions';
import { RenderContext } from './context';

export interface ActionSignature {
    readonly params: string;
    readonly args: string;
    readonly returns: string;
    readonly usesEntityType: boolean;
    readonly usesSchema: boolean;
}

export function actionSignature(action: Action, entity: string): ActionSignature {
    switch (action) {
        case 'List':
            return { params: '', args: '', returns: `Promise<${entity}[]>`, usesEntityType: true, usesSchema: false };
        case 'Show':
            return { params: 'id: string', args: 'id', returns: `Promise<${entity}>`, usesEntityType: true, usesSchema: false };
        case 'Create':
            return { params: `data: Create${entity}`, args: 'data', returns: `Promise<${entity}>`, usesEntityType: true, usesSchema: true };
        case 'Update':
            return { params: `id: string, data: Update${entity}`, args: 'id, data', returns: `Promise<${entity}>`, usesEntityType: true, usesSchema: true };
        case 'Delete':
            return { params: 'id: string', args: 'id', returns: 'Promise<void>', usesEntityType: false, usesSchema: false };
    }
}

export function domainImports(
    ctx: RenderContext,
    fromFile: string,
    action: Action,
    entity: string
): readonly string[] {
    const signature = actionSignature(action, entity);
    const lines: string[] = [];

    if (signature.usesEntityType) {
        const typePath = ctx.importLayer(fromFile, 'types', `${entity}.types`);
        lines.push(`import { ${entity} } from '${typePath}';`);
    }
    if (signature.usesSchema) {
        const schemaPath = ctx.importLayer(fromFile, 'schema', `${action}${entity}.schema`);
        lines.push(`import { ${action}${entity} } from '${schemaPath}';`);
    }
    return lines;
}
