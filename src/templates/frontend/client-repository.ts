import { ActionSpec } from '../actions';
import { RenderContext } from '../context';
import { domainImports } from '../signatures';

const JSON_HEADERS = "headers: { 'Content-Type': 'application/json' },";

function fetchUrl(spec: ActionSpec, base: string): string {
    if (!spec.path.includes(':id')) return `'${base}${spec.path === '/' ? '' : spec.path}'`;
    return `\`${base}${spec.path.replace(':id', '${id}')}\``;
}

function fetchCall(spec: ActionSpec, base: string): string {
    const url = fetchUrl(spec, base);
    if (spec.method === 'get') return url;
    const method = spec.method.toUpperCase();
    if (spec.schema === null) {
        return `${url}, {
      method: '${method}',
    }`;
    }
    return `${url}, {
      method: '${method}',
      ${JSON_HEADERS}
      body: JSON.stringify(data),
    }`;
}

export function renderClientRepository(
    ctx: RenderContext,
    spec: ActionSpec,
    entity: string,
    fromFile: string
): string {
    const imports = domainImports(ctx, fromFile, spec, entity).join('\n');
    const header = imports ? `${imports}\n\n` : '';
    const returnLine = spec.returns === 'Promise<void>' ? '' : '    return response.json();\n';

    return `${header}export class ${spec.name}Repository {
  async handle(${spec.params}): ${spec.returns} {
    const response = await fetch(${fetchCall(spec, `/api/${ctx.feature}`)});
    if (!response.ok) throw new Error('${spec.failure}');
${returnLine}  }
}
`;
}
