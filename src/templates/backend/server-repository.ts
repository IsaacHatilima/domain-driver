import { ActionSpec } from '../actions';
import { RenderContext } from '../context';
import { INJECTABLE_IMPORT } from '../nest/injectable';
import { domainImports } from '../signatures';

export function renderServerRepository(
    ctx: RenderContext,
    spec: ActionSpec,
    entity: string,
    fromFile: string
): string {
    const cls = `${spec.name}Repository`;
    const injectable = ctx.profile.name === 'nest';
    const imports = [
        ...(injectable ? [INJECTABLE_IMPORT] : []),
        ...domainImports(ctx, fromFile, spec, entity),
    ].join('\n');
    const header = imports ? `${imports}\n\n` : '';
    const decorator = injectable ? '@Injectable()\n' : '';

    return `${header}${decorator}export class ${cls} {
  async handle(${spec.params}): ${spec.returns} {
    // TODO: implement with your ORM (Prisma, Drizzle, TypeORM, ...)
    throw new Error('${cls}.handle is not implemented');
  }
}
`;
}
