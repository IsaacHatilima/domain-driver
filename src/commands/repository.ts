import * as path from 'path';
import { ensureFeatureExists, writeFileSafe, fileExists, resolveImport } from '../utils';

type RepositoryAction = 'List' | 'Create' | 'Update' | 'Delete' | 'Show';

const REPOSITORY_ACTIONS: RepositoryAction[] = ['List', 'Create', 'Update', 'Delete', 'Show'];

function renderRepository(action: RepositoryAction, name: string, feature: string): string {
    const typePath = resolveImport(feature, `types/${name}.types`);
    const schemaPath = (op: string) => resolveImport(feature, `schemas/${op}${name}.schema`);

    switch (action) {
        case 'List':
            return `import { ${name} } from '${typePath}';

export class List${name}Repository {
  async handle(): Promise<${name}[]> {
    const response = await fetch('/api/${feature}');
    if (!response.ok) throw new Error('Failed to fetch ${name} list');
    return response.json();
  }
}
`;
        case 'Show':
            return `import { ${name} } from '${typePath}';

export class Show${name}Repository {
  async handle(id: string): Promise<${name}> {
    const response = await fetch(\`/api/${feature}/\${id}\`);
    if (!response.ok) throw new Error('Failed to fetch ${name}');
    return response.json();
  }
}
`;
        case 'Create':
            return `import { ${name} } from '${typePath}';
import { Create${name} } from '${schemaPath('Create')}';

export class Create${name}Repository {
  async handle(data: Create${name}): Promise<${name}> {
    const response = await fetch('/api/${feature}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create ${name}');
    return response.json();
  }
}
`;
        case 'Update':
            return `import { ${name} } from '${typePath}';
import { Update${name} } from '${schemaPath('Update')}';

export class Update${name}Repository {
  async handle(id: string, data: Update${name}): Promise<${name}> {
    const response = await fetch(\`/api/${feature}/\${id}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update ${name}');
    return response.json();
  }
}
`;
        case 'Delete':
            return `export class Delete${name}Repository {
  async handle(id: string): Promise<void> {
    const response = await fetch(\`/api/${feature}/\${id}\`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete ${name}');
  }
}
`;
    }
}

export function makeRepository(feature: string, name: string): void {
    const base = ensureFeatureExists(feature, 'repositories');

    for (const action of REPOSITORY_ACTIONS) {
        const filePath = path.join(base, `${action}${name}.repository.ts`);

        if (fileExists(filePath)) {
            console.warn(`⚠️  Skipping "${action}${name}.repository.ts" — already exists`);
            continue;
        }

        writeFileSafe(filePath, renderRepository(action, name, feature));
    }

    console.log(`✅ Repositories for "${name}" created at ${base}`);
}
