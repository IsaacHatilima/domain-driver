import * as path from 'path';
import { hasLayer, layerDir } from '../stack/registry';
import { Side } from '../stack/types';
import { ActionSpec, customAction, CustomActionOptions, RETURN_KINDS, ReturnKind } from '../templates/actions';
import { renderServerRepository } from '../templates/backend/server-repository';
import { RenderContext } from '../templates/context';
import { renderNestController } from '../templates/controllers/nest';
import { renderActionRoute } from '../templates/controllers/next-action-route';
import { renderNodeController, renderNodeRouteLine } from '../templates/controllers/node';
import { renderClientRepository } from '../templates/frontend/client-repository';
import { renderDto } from '../templates/nest/dto';
import { renderService } from '../templates/service';
import { renderSchema } from '../templates/shared/schema';
import { fileExists, mkdirSafe } from '../utils/fs';
import { lowerFirst } from '../utils/naming';
import { apiRouteDir } from '../utils/paths';
import { hintNestjsZod } from './hints';
import { ensureLayerDir, requireFeature } from './resolve';
import { writeIfAbsent } from './write';

export function parseReturns(value: string): ReturnKind {
    if ((RETURN_KINDS as readonly string[]).includes(value)) return value as ReturnKind;
    throw new Error(`Invalid --returns "${value}". Use list, one, or void.`);
}

export function makeAction(
    feature: string,
    entity: string,
    actionName: string,
    options: CustomActionOptions
): void {
    const ctx = requireFeature(feature);
    const spec = customAction(entity, actionName, options);

    hintMissingTypes(ctx, entity);
    if (spec.schema !== null) writeInput(ctx, spec);
    if (hasLayer(ctx.profile, 'serverRepository')) writeSide(ctx, spec, entity, 'server');
    if (hasLayer(ctx.profile, 'controller')) writeController(ctx, spec, entity);
    if (hasLayer(ctx.profile, 'clientRepository')) writeSide(ctx, spec, entity, 'client');

    console.log(`✅ Action "${spec.name}" scaffolded in "${feature}"`);
}

function hintMissingTypes(ctx: RenderContext, entity: string): void {
    const typesFile = path.join(ctx.featureDir, layerDir(ctx.profile, 'types'), `${entity}.types.ts`);
    if (fileExists(typesFile)) return;
    console.log(`ℹ️  types/${entity}.types.ts not found. Run: domain-driver make:types ${ctx.feature}/${entity}`);
}

function writeInput(ctx: RenderContext, spec: ActionSpec): void {
    const schemaFile = path.join(ensureLayerDir(ctx, 'schema'), `${spec.name}.schema.ts`);
    writeIfAbsent(schemaFile, () => renderSchema(spec.name, lowerFirst(spec.name)));

    if (!hasLayer(ctx.profile, 'dto')) return;
    const dtoFile = path.join(ensureLayerDir(ctx, 'dto'), `${spec.name}.dto.ts`);
    writeIfAbsent(dtoFile, () => renderDto(ctx, spec.name, dtoFile));
    hintNestjsZod(ctx.stack);
}

function writeSide(ctx: RenderContext, spec: ActionSpec, entity: string, side: Side): void {
    const repositoryLayer = side === 'client' ? 'clientRepository' : 'serverRepository';
    const serviceLayer = side === 'client' ? 'clientService' : 'serverService';
    const renderRepository = side === 'client' ? renderClientRepository : renderServerRepository;

    const repositoryFile = path.join(ensureLayerDir(ctx, repositoryLayer), `${spec.name}.repository.ts`);
    writeIfAbsent(repositoryFile, () => renderRepository(ctx, spec, entity, repositoryFile));

    const serviceFile = path.join(ensureLayerDir(ctx, serviceLayer), `${spec.name}.service.ts`);
    writeIfAbsent(serviceFile, () => renderService(ctx, spec, entity, serviceFile, side));
}

function writeController(ctx: RenderContext, spec: ActionSpec, entity: string): void {
    if (ctx.profile.name === 'next-fullstack') {
        const routeDir = path.join(apiRouteDir(ctx.stack, ctx.feature), spec.path.slice(1));
        mkdirSafe(routeDir);
        const routeFile = path.join(routeDir, 'route.ts');
        writeIfAbsent(routeFile, () => renderActionRoute(ctx, spec, routeFile));
        return;
    }

    const controllerFile = path.join(ensureLayerDir(ctx, 'controller'), `${spec.name}.controller.ts`);
    const render = ctx.profile.name === 'nest' ? renderNestController : renderNodeController;
    writeIfAbsent(controllerFile, () => render(ctx, spec, entity, controllerFile));

    const line = ctx.profile.name === 'node' ? renderNodeRouteLine(ctx, spec, entity) : null;
    if (line !== null) console.log(`ℹ️  Add to ${ctx.feature}.routes.ts: ${line}`);
}
