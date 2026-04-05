import * as path from 'path';
import { ensureFeatureExists, writeFileSafe, fileExists, resolveImport } from '../utils';

type ServiceAction = 'List' | 'Create' | 'Update' | 'Delete' | 'Show';

const SERVICE_ACTIONS: ServiceAction[] = ['List', 'Create', 'Update', 'Delete', 'Show'];

function renderService(action: ServiceAction, name: string, feature: string): string {
    const typePath = resolveImport(feature, `types/${name}.types`);
    const repoPath = (op: string) => resolveImport(feature, `repositories/${op}${name}.repository`);
    const schemaPath = (op: string) => resolveImport(feature, `schemas/${op}${name}.schema`);

    switch (action) {
        case 'List':
            return `import { ${name} } from '${typePath}';
import { List${name}Repository } from '${repoPath('List')}';

const repository = new List${name}Repository();

export class List${name}Service {
  async handle(): Promise<${name}[]> {
    return repository.handle();
  }
}
`;
        case 'Show':
            return `import { ${name} } from '${typePath}';
import { Show${name}Repository } from '${repoPath('Show')}';

const repository = new Show${name}Repository();

export class Show${name}Service {
  async handle(id: string): Promise<${name}> {
    return repository.handle(id);
  }
}
`;
        case 'Create':
            return `import { ${name} } from '${typePath}';
import { Create${name} } from '${schemaPath('Create')}';
import { Create${name}Repository } from '${repoPath('Create')}';

const repository = new Create${name}Repository();

export class Create${name}Service {
  async handle(data: Create${name}): Promise<${name}> {
    return repository.handle(data);
  }
}
`;
        case 'Update':
            return `import { ${name} } from '${typePath}';
import { Update${name} } from '${schemaPath('Update')}';
import { Update${name}Repository } from '${repoPath('Update')}';

const repository = new Update${name}Repository();

export class Update${name}Service {
  async handle(id: string, data: Update${name}): Promise<${name}> {
    return repository.handle(id, data);
  }
}
`;
        case 'Delete':
            return `import { Delete${name}Repository } from '${repoPath('Delete')}';

const repository = new Delete${name}Repository();

export class Delete${name}Service {
  async handle(id: string): Promise<void> {
    return repository.handle(id);
  }
}
`;
    }
}

export function makeService(feature: string, name: string): void {
    const base = ensureFeatureExists(feature, 'services');

    for (const action of SERVICE_ACTIONS) {
        const filePath = path.join(base, `${action}${name}.service.ts`);

        if (fileExists(filePath)) {
            console.warn(`⚠️  Skipping "${action}${name}.service.ts" — already exists`);
            continue;
        }

        writeFileSafe(filePath, renderService(action, name, feature));
    }

    console.log(`✅ Services for "${name}" created at ${base}`);
}
