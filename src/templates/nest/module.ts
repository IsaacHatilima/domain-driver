import { Layer } from '../../stack/types';
import { ACTIONS } from '../actions';
import { RenderContext } from '../context';

function classNames(entity: string, suffix: string): readonly string[] {
    return ACTIONS.map((action) => `${action}${entity}${suffix}`);
}

function importLines(ctx: RenderContext, fromFile: string, entity: string, layer: Layer, suffix: string): string {
    return ACTIONS.map((action) => {
        const name = `${action}${entity}${suffix}`;
        const target = ctx.importLayer(fromFile, layer, `${action}${entity}.${suffix.toLowerCase()}`);
        return `import { ${name} } from '${target}';`;
    }).join('\n');
}

function list(names: readonly string[]): string {
    if (names.length === 0) return '[]';
    return `[\n${names.map((name) => `    ${name},`).join('\n')}\n  ]`;
}

export function renderModule(ctx: RenderContext, entity: string, fromFile: string, populated: boolean): string {
    const controllers = populated ? classNames(entity, 'Controller') : [];
    const providers = populated ? [...classNames(entity, 'Service'), ...classNames(entity, 'Repository')] : [];
    const imports = [
        "import { Module } from '@nestjs/common';",
        ...(populated
            ? [
                  importLines(ctx, fromFile, entity, 'controller', 'Controller'),
                  importLines(ctx, fromFile, entity, 'serverService', 'Service'),
                  importLines(ctx, fromFile, entity, 'serverRepository', 'Repository'),
              ]
            : []),
    ].join('\n');

    return `${imports}

@Module({
  controllers: ${list(controllers)},
  providers: ${list(providers)},
})
export class ${entity}Module {}
`;
}
