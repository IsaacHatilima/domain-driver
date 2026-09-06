import { Side } from '../stack/types';
import { ActionSpec } from './actions';
import { RenderContext } from './context';
import { INJECTABLE_IMPORT } from './nest/injectable';
import { domainImports } from './signatures';

export function renderService(
    ctx: RenderContext,
    spec: ActionSpec,
    entity: string,
    fromFile: string,
    side: Side
): string {
    const repositoryClass = `${spec.name}Repository`;
    const serviceClass = `${spec.name}Service`;
    const repositoryLayer = side === 'client' ? 'clientRepository' : 'serverRepository';
    const repositoryPath = ctx.importLayer(fromFile, repositoryLayer, `${spec.name}.repository`);
    const injectable = side === 'server' && ctx.profile.name === 'nest';

    const imports = [
        ...(injectable ? [INJECTABLE_IMPORT] : []),
        ...domainImports(ctx, fromFile, spec, entity),
        `import { ${repositoryClass} } from '${repositoryPath}';`,
    ].join('\n');

    if (injectable) {
        return `${imports}

@Injectable()
export class ${serviceClass} {
  constructor(private readonly repository: ${repositoryClass}) {}

  async handle(${spec.params}): ${spec.returns} {
    return this.repository.handle(${spec.args});
  }
}
`;
    }

    return `${imports}

const repository = new ${repositoryClass}();

export class ${serviceClass} {
  async handle(${spec.params}): ${spec.returns} {
    return repository.handle(${spec.args});
  }
}
`;
}
