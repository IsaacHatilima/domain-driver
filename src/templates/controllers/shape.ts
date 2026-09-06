import { lowerFirst } from '../../utils/naming';
import { Action, ACTIONS } from '../actions';
import { RenderContext } from '../context';

export interface ControllerShape {
    readonly status: number;
    readonly usesBody: boolean;
    readonly usesId: boolean;
}

export function controllerShape(action: Action): ControllerShape {
    switch (action) {
        case 'List':
            return { status: 200, usesBody: false, usesId: false };
        case 'Show':
            return { status: 200, usesBody: false, usesId: true };
        case 'Create':
            return { status: 201, usesBody: true, usesId: false };
        case 'Update':
            return { status: 200, usesBody: true, usesId: true };
        case 'Delete':
            return { status: 204, usesBody: false, usesId: true };
    }
}

export function handlerName(action: Action, entity: string): string {
    return `${lowerFirst(action)}${entity}Controller`;
}

export function schemaImport(ctx: RenderContext, fromFile: string, action: Action, entity: string): string {
    const schemaPath = ctx.importLayer(fromFile, 'schema', `${action}${entity}.schema`);
    return `import { ${action}${entity}Schema } from '${schemaPath}';`;
}

export function serviceImport(ctx: RenderContext, fromFile: string, action: Action, entity: string): string {
    const servicePath = ctx.importLayer(fromFile, 'serverService', `${action}${entity}.service`);
    return `import { ${action}${entity}Service } from '${servicePath}';`;
}

export function controllerImports(ctx: RenderContext, fromFile: string, entity: string): string {
    return ACTIONS
        .map((action) => {
            const name = handlerName(action, entity);
            const controllerPath = ctx.importLayer(fromFile, 'controller', `${action}${entity}.controller`);
            return `import { ${name} } from '${controllerPath}';`;
        })
        .join('\n');
}

export function callArgs(shape: ControllerShape, idExpression: string, bodyExpression: string): string {
    return [shape.usesId ? idExpression : null, shape.usesBody ? bodyExpression : null]
        .filter((arg): arg is string => arg !== null)
        .join(', ');
}
