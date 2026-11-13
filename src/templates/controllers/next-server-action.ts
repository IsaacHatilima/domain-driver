import * as path from 'path';
import { lowerFirst } from '../../utils/naming';
import { ActionSpec } from '../actions';
import { RenderContext } from '../context';
import { serviceImport } from './shape';

/** The line every generated action fails on until the project wires its own session check. */
export const CALLER_CHECK = 'await requireCaller();';

/** A route group `(name)` or a parallel route slot `@name` is a folder that is not part of the URL. */
const UNROUTED_SEGMENT = /^(\(.*\)|@.*)$/;

export function serverActionName(spec: ActionSpec): string {
    return `${lowerFirst(spec.name)}Action`;
}

/**
 * Only GET reads: List, Show and a custom GET are rendered by a Server Component calling the
 * service. Anything else changes data and gets a Server Action.
 */
export function isWrite(spec: ActionSpec): boolean {
    return spec.method !== 'get';
}

/**
 * The URL of the feature's page, which a write revalidates: the feature folder under the app
 * directory, without route groups or slots. A feature root outside the app directory is not
 * routed, so its feature name stands in.
 */
export function featureUrl(ctx: RenderContext): string {
    const appDir = path.join(process.cwd(), path.dirname(ctx.stack.apiRoot));
    const relative = path.relative(appDir, ctx.featureDir);
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return `/${ctx.feature}`;
    const segments = relative.split(path.sep).filter((segment) => !UNROUTED_SEGMENT.test(segment));
    return `/${segments.join('/')}`;
}

/** A path with a dynamic segment is a pattern, which `revalidatePath` only accepts with its type. */
function revalidateCall(url: string): string {
    return url.includes('[') ? `revalidatePath('${url}', 'page');` : `revalidatePath('${url}');`;
}

function imports(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string {
    const lines = ["import { revalidatePath } from 'next/cache';"];
    if (spec.schema !== null) lines.push("import { z } from 'zod';");
    if (spec.usesId) {
        lines.push(`import { ${entity}Schema } from '${ctx.importLayer(fromFile, 'schema', `${entity}.schema`)}';`);
    }
    if (spec.schema !== null) {
        const schemaPath = ctx.importLayer(fromFile, 'schema', `${spec.schema}.schema`);
        lines.push(`import { ${spec.schema}Schema, type ${spec.schema} } from '${schemaPath}';`);
    }
    lines.push(serviceImport(ctx, fromFile, spec));
    return lines.join('\n');
}

/** The fields a failed validation reports on: the body's fields, and the id on one record. */
function invalidFields(spec: ActionSpec): readonly string[] {
    return [spec.schema !== null ? `keyof ${spec.schema}` : null, spec.usesId ? "'id'" : null].filter(
        (field): field is string => field !== null
    );
}

/**
 * What `useActionState` holds. A form starts `idle`; an expected failure comes back as `invalid`
 * rather than a thrown error, and a write that went through as `saved`. It returns no record:
 * the page re-renders with the revalidated data.
 */
function stateType(spec: ActionSpec): string {
    const fields = invalidFields(spec);
    const invalid =
        fields.length === 0 ? '' : `\n  | { status: 'invalid'; errors: Partial<Record<${fields.join(' | ')}, string[]>> }`;
    return `export type ${spec.name}State =
  | { status: 'idle' }${invalid}
  | { status: 'saved' };`;
}

function requireCaller(spec: ActionSpec): string {
    return `/**
 * Fails closed until the caller is checked. Replace \`${CALLER_CHECK}\` in
 * ${serverActionName(spec)} with the project's session check, such as
 * \`const { user } = await requireSession();\`, then delete this function.
 */
async function requireCaller(): Promise<void> {
  throw new Error('${serverActionName(spec)} does not check the caller yet');
}`;
}

/** The id is checked against the entity schema's own `id`, so it follows whatever that field becomes. */
function validation(spec: ActionSpec, entity: string): string {
    const id = spec.usesId
        ? `
  const id = ${entity}Schema.shape.id.safeParse(formData.get('id'));
  if (!id.success) {
    return { status: 'invalid', errors: { id: id.error.issues.map((issue) => issue.message) } };
  }
`
        : '';
    const body =
        spec.schema !== null
            ? `
  const parsed = ${spec.schema}Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: 'invalid', errors: z.flattenError(parsed.error).fieldErrors };
  }
`
            : '';
    return `${id}${body}`;
}

function serviceArgs(spec: ActionSpec): string {
    return [spec.usesId ? 'id.data' : null, spec.schema !== null ? 'parsed.data' : null]
        .filter((arg): arg is string => arg !== null)
        .join(', ');
}

/**
 * One Server Action per write, for `useActionState`: `(previous, formData)` in, a typed state out.
 * It checks the caller, validates the form with the feature's schemas, delegates to the service's
 * `handle()`, and revalidates the feature's page. Until the project wires its session check the
 * action throws on every call, the way a generated repository throws until it reaches a database.
 */
export function renderServerAction(ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string): string {
    const name = serverActionName(spec);
    const formData = spec.usesId || spec.schema !== null ? 'formData' : '_formData';

    return `'use server';

${imports(ctx, spec, entity, fromFile)}

${stateType(spec)}

const service = new ${spec.name}Service();

${requireCaller(spec)}

export async function ${name}(
  _previous: ${spec.name}State,
  ${formData}: FormData,
): Promise<${spec.name}State> {
  ${CALLER_CHECK}
${validation(spec, entity)}
  await service.handle(${serviceArgs(spec)});
  ${revalidateCall(featureUrl(ctx))}
  return { status: 'saved' };
}
`;
}
