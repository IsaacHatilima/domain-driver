import { assertLayer, hasLayer } from '../stack/registry';
import { WRITE_ACTIONS } from '../templates/actions';
import { RenderContext } from '../templates/context';
import { renderDto } from '../templates/nest/dto';
import { renderSchema } from '../templates/shared/schema';
import { hintNestjsZod } from './hints';
import { ensureLayerDir, requireFeature } from './resolve';
import { writeActionFiles } from './write';

export function makeSchema(feature: string, name: string): void {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'schema', 'make:schema');

    const schemaDir = ensureLayerDir(ctx, 'schema');
    writeActionFiles(schemaDir, name, 'schema', WRITE_ACTIONS, (action) =>
        renderSchema(`${action}${name}`, action.toLowerCase())
    );
    console.log(`✅ Schemas for "${name}" created at ${schemaDir}`);

    if (hasLayer(ctx.profile, 'dto')) writeDtos(ctx, name);
}

function writeDtos(ctx: RenderContext, name: string): void {
    const dtoDir = ensureLayerDir(ctx, 'dto');
    writeActionFiles(dtoDir, name, 'dto', WRITE_ACTIONS, (action, filePath) =>
        renderDto(ctx, `${action}${name}`, filePath)
    );
    hintNestjsZod(ctx.stack);
    console.log(`✅ DTOs for "${name}" created at ${dtoDir}`);
}
