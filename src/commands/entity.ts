import * as path from 'path';
import { layerDir } from '../stack/registry';
import { RenderContext } from '../templates/context';
import { renderEntitySchema } from '../templates/shared/schema';
import { fileExists, writeFileSafe } from '../utils/fs';
import { ensureLayerDir } from './resolve';

function entitySchemaPath(ctx: RenderContext, entity: string): string {
    return path.join(layerDir(ctx.profile, 'schema'), `${entity}.schema.ts`);
}

function typesPath(ctx: RenderContext, entity: string): string {
    return path.join(layerDir(ctx.profile, 'types'), `${entity}.types.ts`);
}

/**
 * Writes `<Entity>.schema.ts` unless it exists. Both make:types and make:schema need it, and
 * make:feature -a runs both, so an existing schema is expected rather than a skip worth warning
 * about.
 */
export function ensureEntitySchema(ctx: RenderContext, entity: string): void {
    ensureLayerDir(ctx, 'schema');
    const filePath = path.join(ctx.featureDir, entitySchemaPath(ctx, entity));
    if (fileExists(filePath)) return;
    writeFileSafe(filePath, renderEntitySchema(entity));
    console.log(`✅ Schema for "${entity}" created at ${filePath}`);
}

/**
 * Generated hooks, services and controllers import the entity type, and hooks parse responses
 * with the entity schema. make:types writes both, so that is the command to point at.
 */
export function hintMissingEntity(ctx: RenderContext, entity: string): void {
    const missing = [typesPath(ctx, entity), entitySchemaPath(ctx, entity)].filter(
        (relative) => !fileExists(path.join(ctx.featureDir, relative))
    );
    if (missing.length === 0) return;
    const files = missing.map((relative) => relative.split(path.sep).join('/')).join(' and ');
    console.log(`ℹ️  ${files} not found. Run: domain-driver make:types ${ctx.feature}/${entity}`);
}
