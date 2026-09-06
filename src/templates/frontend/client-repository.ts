import { Action } from '../actions';
import { RenderContext } from '../context';
import { domainImports } from '../signatures';

function body(action: Action, entity: string, url: string): string {
    const cls = `${action}${entity}Repository`;
    switch (action) {
        case 'List':
            return `export class ${cls} {
  async handle(): Promise<${entity}[]> {
    const response = await fetch('${url}');
    if (!response.ok) throw new Error('Failed to fetch ${entity} list');
    return response.json();
  }
}
`;
        case 'Show':
            return `export class ${cls} {
  async handle(id: string): Promise<${entity}> {
    const response = await fetch(\`${url}/\${id}\`);
    if (!response.ok) throw new Error('Failed to fetch ${entity}');
    return response.json();
  }
}
`;
        case 'Create':
            return `export class ${cls} {
  async handle(data: Create${entity}): Promise<${entity}> {
    const response = await fetch('${url}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create ${entity}');
    return response.json();
  }
}
`;
        case 'Update':
            return `export class ${cls} {
  async handle(id: string, data: Update${entity}): Promise<${entity}> {
    const response = await fetch(\`${url}/\${id}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update ${entity}');
    return response.json();
  }
}
`;
        case 'Delete':
            return `export class ${cls} {
  async handle(id: string): Promise<void> {
    const response = await fetch(\`${url}/\${id}\`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete ${entity}');
  }
}
`;
    }
}

export function renderClientRepository(
    ctx: RenderContext,
    action: Action,
    entity: string,
    fromFile: string
): string {
    const imports = domainImports(ctx, fromFile, action, entity).join('\n');
    const header = imports ? `${imports}\n\n` : '';
    return `${header}${body(action, entity, `/api/${ctx.feature}`)}`;
}
