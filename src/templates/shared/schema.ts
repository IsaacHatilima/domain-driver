import { WriteAction } from '../actions';

export function renderSchema(action: WriteAction, entity: string): string {
    const name = `${action}${entity}`;
    return `import { z } from 'zod';

export const ${name}Schema = z.object({
  // add ${action.toLowerCase()} fields here
});

export type ${name} = z.infer<typeof ${name}Schema>;
`;
}
