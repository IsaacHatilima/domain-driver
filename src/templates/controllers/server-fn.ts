import { lowerFirst } from '../../utils/naming';
import { ActionSpec } from '../actions';
import { RenderContext } from '../context';

interface Input {
    readonly validator: string | null;
    readonly call: string;
    readonly handlerArg: string;
    readonly needsZod: boolean;
}

function inputFor(spec: ActionSpec): Input {
    if (spec.schema !== null && spec.usesId) {
        return {
            validator: `z.object({ id: z.string(), data: ${spec.schema}Schema })`,
            call: 'data.id, data.data',
            handlerArg: '{ data }',
            needsZod: true,
        };
    }
    if (spec.schema !== null) {
        return { validator: `${spec.schema}Schema`, call: 'data', handlerArg: '{ data }', needsZod: false };
    }
    if (spec.usesId) {
        return { validator: 'z.string()', call: 'data', handlerArg: '{ data }', needsZod: true };
    }
    return { validator: null, call: '', handlerArg: '', needsZod: false };
}

export function renderServerFn(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string {
    const { validator, call, handlerArg, needsZod } = inputFor(spec);
    const method = spec.method === 'get' ? 'GET' : 'POST';
    const servicePath = ctx.importLayer(fromFile, 'serverService', `${spec.name}.service`);

    const imports = ["import { createServerFn } from '@tanstack/react-start';"];
    if (needsZod) imports.push("import { z } from 'zod';");
    if (spec.schema !== null) {
        const schemaPath = ctx.importLayer(fromFile, 'schema', `${spec.schema}.schema`);
        imports.push(`import { ${spec.schema}Schema } from '${schemaPath}';`);
    }
    imports.push(`import { ${spec.name}Service } from '${servicePath}';`);

    const validatorLine = validator === null ? '' : `\n  .validator(${validator})`;

    return `${imports.join('\n')}

const service = new ${spec.name}Service();

export const ${lowerFirst(spec.name)} = createServerFn({ method: '${method}' })${validatorLine}
  .handler(async (${handlerArg}) => service.handle(${call}));
`;
}
