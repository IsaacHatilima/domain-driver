import { Action } from '../actions';
import { RenderContext } from '../context';
import { actionSignature, domainImports } from '../signatures';

const INJECTABLE_IMPORT = "import { Injectable } from '@nestjs/common';";

export function renderServerRepository(
    ctx: RenderContext,
    action: Action,
    entity: string,
    fromFile: string
): string {
    const signature = actionSignature(action, entity);
    const cls = `${action}${entity}Repository`;
    const injectable = ctx.profile.name === 'nest';
    const imports = [
        ...(injectable ? [INJECTABLE_IMPORT] : []),
        ...domainImports(ctx, fromFile, action, entity),
    ].join('\n');
    const header = imports ? `${imports}\n\n` : '';
    const decorator = injectable ? '@Injectable()\n' : '';

    return `${header}${decorator}export class ${cls} {
  async handle(${signature.params}): ${signature.returns} {
    // TODO: implement with your ORM (Prisma, Drizzle, TypeORM, ...)
    throw new Error('${cls}.handle is not implemented');
  }
}
`;
}
