import * as fs from 'fs';
import * as path from 'path';

type RepositoryAction = 'List' | 'Create' | 'Update' | 'Delete' | 'Show';

const REPOSITORY_ACTIONS: RepositoryAction[] = ['List', 'Create', 'Update', 'Delete', 'Show'];

function renderRepository(action: RepositoryAction, name: string, feature: string): string {
    switch (action) {
        case 'List':
            return `export class List${name}Repository {
  async handle() {
    const response = await fetch('/api/${feature}');
    return response.json();
  }
}
`;
        case 'Show':
            return `export class Show${name}Repository {
  async handle(id: string) {
    const response = await fetch(\`/api/${feature}/\${id}\`);
    return response.json();
  }
}
`;
        case 'Create':
            return `export class Create${name}Repository {
  async handle(data: unknown) {
    const response = await fetch('/api/${feature}', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  }
}
`;
        case 'Update':
            return `export class Update${name}Repository {
  async handle(id: string, data: unknown) {
    const response = await fetch(\`/api/${feature}/\${id}\`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.json();
  }
}
`;
        case 'Delete':
            return `export class Delete${name}Repository {
  async handle(id: string) {
    const response = await fetch(\`/api/${feature}/\${id}\`, {
      method: 'DELETE',
    });
    return response.json();
  }
}
`;
    }
}

export function makeRepository(feature: string, name: string) {
    const base = path.join(process.cwd(), 'app', feature, 'repositories');

    if (!fs.existsSync(base)) {
        console.error(`❌ Feature "${feature}" does not exist. Run make:feature ${feature} first.`);
        process.exit(1);
    }

    for (const action of REPOSITORY_ACTIONS) {
        const filePath = path.join(base, `${action}${name}.repository.ts`);

        if (fs.existsSync(filePath)) {
            console.warn(`⚠️  Skipping "${action}${name}.repository.ts" — already exists`);
            continue;
        }

        fs.writeFileSync(filePath, renderRepository(action, name, feature));
    }

    console.log(`✅ Repositories for "${name}" created at ${base}`);
}