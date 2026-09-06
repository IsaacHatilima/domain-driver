import { ActionSpec, standardActions } from '../actions';
import { RenderContext } from '../context';

export function schemaImport(ctx: RenderContext, fromFile: string, schemaName: string): string {
    const schemaPath = ctx.importLayer(fromFile, 'schema', `${schemaName}.schema`);
    return `import { ${schemaName}Schema } from '${schemaPath}';`;
}

export function serviceImport(ctx: RenderContext, fromFile: string, spec: ActionSpec): string {
    const servicePath = ctx.importLayer(fromFile, 'serverService', `${spec.name}.service`);
    return `import { ${spec.name}Service } from '${servicePath}';`;
}

export function controllerImports(ctx: RenderContext, fromFile: string, entity: string): string {
    return standardActions(entity)
        .map((spec) => {
            const controllerPath = ctx.importLayer(fromFile, 'controller', `${spec.name}.controller`);
            return `import { ${spec.handler} } from '${controllerPath}';`;
        })
        .join('\n');
}

export function callArgs(spec: ActionSpec, idExpression: string, bodyExpression: string): string {
    return [spec.usesId ? idExpression : null, spec.schema !== null ? bodyExpression : null]
        .filter((arg): arg is string => arg !== null)
        .join(', ');
}
