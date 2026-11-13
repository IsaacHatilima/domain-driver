import * as path from 'path';
import { componentDir } from '../stack/registry';
import { ActionSpec, takesQuery } from '../templates/actions';
import { RenderContext } from '../templates/context';
import { renderQueryContainer } from '../templates/frontend/server-container';
import { fileExists } from '../utils/fs';
import { ensureLayerDir } from './resolve';
import { writeIfAbsent } from './write';

/**
 * A read whose input is the query string, and which returns records to render. A void read has
 * nothing to render, so it keeps the plain hint to call its service.
 */
export function readsQuery(spec: ActionSpec): boolean {
    return takesQuery(spec) && spec.usesEntityType;
}

function hintQueryRead(spec: ActionSpec): void {
    const container = `${spec.name}Container`;
    const id = spec.usesId ? ' id={id}' : '';
    console.log(
        `ℹ️  ${spec.name} is a read that takes its input from the query string: ${container} parses the page's searchParams ` +
            `with ${spec.schema}Schema and calls ${spec.name}Service. Render it from the page with the page's own prop: ` +
            `<${container}${id} searchParams={searchParams} />`
    );
}

/**
 * Writes `containers/<Name>Container.tsx`, the async Server Component that turns the page's
 * `searchParams` into the service's input, and says how the page renders it.
 */
export function writeQueryContainer(ctx: RenderContext, spec: ActionSpec, entity: string): boolean {
    const file = path.join(ensureLayerDir(ctx, 'container'), `${spec.name}Container.tsx`);
    const component = fileExists(path.join(ctx.featureDir, componentDir(ctx.profile, 'client'), `${entity}.tsx`));
    const wrote = writeIfAbsent(file, () => renderQueryContainer(ctx, spec, entity, file, { component }));
    if (wrote) hintQueryRead(spec);
    return wrote;
}
