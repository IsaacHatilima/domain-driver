import { assertLayer, hasLayer } from '../stack/registry';
import { WRITE_ACTIONS } from '../templates/actions';
import { RenderContext } from '../templates/context';
import { renderDto } from '../templates/nest/dto';
import { renderSchema } from '../templates/shared/schema';
import { ensureEntitySchema } from './entity';
import { hintNestjsZod } from './hints';
import { ensureLayerDir, openFeature } from './resolve';
import { writeActionFiles } from './write';

export function makeSchema(feature: string, name: string): void {
    const ctx = openFeature(feature, 'make:schema');
    assertLayer(ctx.profile, 'schema', 'make:schema');

    ensureEntitySchema(ctx, name);
    const schemaDir = ensureLayerDir(ctx, 'schema');
    const written = writeActionFiles(schemaDir, name, 'schema', WRITE_ACTIONS, (action) =>
        renderSchema(`${action}${name}`, action.toLowerCase())
    );
    if (written > 0) console.log(`✅ Schemas for "${name}" created at ${schemaDir}`);

    if (hasLayer(ctx.profile, 'dto')) writeDtos(ctx, name);
}

/** DTOs validate request bodies, so only Create and Update get one: the entity schema describes responses. */
function writeDtos(ctx: RenderContext, name: string): void {
    const dtoDir = ensureLayerDir(ctx, 'dto');
    const written = writeActionFiles(dtoDir, name, 'dto', WRITE_ACTIONS, (action, filePath) =>
        renderDto(ctx, `${action}${name}`, filePath)
    );
    hintNestjsZod(ctx.stack);
    if (written > 0) console.log(`✅ DTOs for "${name}" created at ${dtoDir}`);
}
