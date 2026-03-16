import * as fs from 'fs';
import * as path from 'path';

type ServiceAction = 'List' | 'Create' | 'Update' | 'Delete' | 'Show';

const SERVICE_ACTIONS: ServiceAction[] = ['List', 'Create', 'Update', 'Delete', 'Show'];

function renderService(action: ServiceAction, name: string): string {
    switch (action) {
        case 'List':
            return `export class List${name}Service {
  async handle() {
    // fetch all ${name}
  }
}
`;
        case 'Show':
            return `export class Show${name}Service {
  async handle(id: string) {
    // fetch single ${name}
  }
}
`;
        case 'Create':
            return `export class Create${name}Service {
  async handle(data: unknown) {
    // create ${name}
  }
}
`;
        case 'Update':
            return `export class Update${name}Service {
  async handle(id: string, data: unknown) {
    // update ${name}
  }
}
`;
        case 'Delete':
            return `export class Delete${name}Service {
  async handle(id: string) {
    // delete ${name}
  }
}
`;
    }
}

export function makeService(feature: string, name: string) {
    const base = path.join(process.cwd(), 'app', feature, 'services');

    if (!fs.existsSync(base)) {
        console.error(`❌ Feature "${feature}" does not exist. Run make:feature ${feature} first.`);
        process.exit(1);
    }

    for (const action of SERVICE_ACTIONS) {
        const filePath = path.join(base, `${action}${name}.service.ts`);

        if (fs.existsSync(filePath)) {
            console.warn(`⚠️  Skipping "${action}${name}.service.ts" — already exists`);
            continue;
        }

        fs.writeFileSync(filePath, renderService(action, name));
    }

    console.log(`✅ Services for "${name}" created at ${base}`);
}