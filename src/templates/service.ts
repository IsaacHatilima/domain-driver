import { Side } from '../stack/types';
import { Action } from './actions';
import { RenderContext } from './context';
import { actionSignature, domainImports } from './signatures';

const INJECTABLE_IMPORT = "import { Injectable } from '@nestjs/common';";

export function renderService(
    ctx: RenderContext,
    action: Action,
    entity: string,
    fromFile: string,
    side: Side
): string {
    const signature = actionSignature(action, entity);
    const repositoryClass = `${action}${entity}Repository`;
    const serviceClass = `${action}${entity}Service`;
    const repositoryLayer = side === 'client' ? 'clientRepository' : 'serverRepository';
    const repositoryPath = ctx.importLayer(fromFile, repositoryLayer, `${action}${entity}.repository`);
    const injectable = side === 'server' && ctx.profile.name === 'nest';

    const imports = [
        ...(injectable ? [INJECTABLE_IMPORT] : []),
        ...domainImports(ctx, fromFile, action, entity),
        `import { ${repositoryClass} } from '${repositoryPath}';`,
    ].join('\n');

    if (injectable) {
        return `${imports}

@Injectable()
export class ${serviceClass} {
  constructor(private readonly repository: ${repositoryClass}) {}

  async handle(${signature.params}): ${signature.returns} {
    return this.repository.handle(${signature.args});
  }
}
`;
    }

    return `${imports}

const repository = new ${repositoryClass}();

export class ${serviceClass} {
  async handle(${signature.params}): ${signature.returns} {
    return repository.handle(${signature.args});
  }
}
`;
}
