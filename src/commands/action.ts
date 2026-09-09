import * as path from 'path';
import { hasLayer, layerDir } from '../stack/registry';
import { Side } from '../stack/types';
import { ActionSpec, customAction, CustomActionOptions, RETURN_KINDS, ReturnKind } from '../templates/actions';
import { renderServerRepository } from '../templates/backend/server-repository';
import { RenderContext } from '../templates/context';
import { renderActionRoute } from '../templates/controllers/next-action-route';
import { renderNodeRouteLine } from '../templates/controllers/node';
import { renderClientRepository } from '../templates/frontend/client-repository';
import { renderDto } from '../templates/nest/dto';
import { renderService } from '../templates/service';
import { renderSchema } from '../templates/shared/schema';
import { fileExists, mkdirSafe } from '../utils/fs';
import { lowerFirst } from '../utils/naming';
import { apiRouteDir } from '../utils/paths';
import { controllerRenderer, controllerSuffix } from './controller-renderer';
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
): boolean {
    const ctx = requireFeature(feature);
    const spec = customAction(entity, actionName, options);

    hintMissingTypes(ctx, entity);
    let wroteAny = false;
    if (spec.schema !== null) wroteAny = writeInput(ctx, spec) || wroteAny;
    if (hasLayer(ctx.profile, 'serverRepository')) wroteAny = writeSide(ctx, spec, entity, 'server') || wroteAny;
    if (hasLayer(ctx.profile, 'controller')) wroteAny = writeController(ctx, spec, entity) || wroteAny;
    if (hasLayer(ctx.profile, 'clientRepository')) wroteAny = writeSide(ctx, spec, entity, 'client') || wroteAny;

    if (wroteAny) console.log(`✅ Action "${spec.name}" scaffolded in "${feature}"`);
    return wroteAny;
}

function hintMissingTypes(ctx: RenderContext, entity: string): void {
    const typesFile = path.join(ctx.featureDir, layerDir(ctx.profile, 'types'), `${entity}.types.ts`);
    if (fileExists(typesFile)) return;
    console.log(`ℹ️  types/${entity}.types.ts not found. Run: domain-driver make:types ${ctx.feature}/${entity}`);
}

function writeInput(ctx: RenderContext, spec: ActionSpec): boolean {
    const schemaFile = path.join(ensureLayerDir(ctx, 'schema'), `${spec.name}.schema.ts`);
    const wroteSchema = writeIfAbsent(schemaFile, () => renderSchema(spec.name, lowerFirst(spec.name)));

    if (!hasLayer(ctx.profile, 'dto')) return wroteSchema;
    const dtoFile = path.join(ensureLayerDir(ctx, 'dto'), `${spec.name}.dto.ts`);
    const wroteDto = writeIfAbsent(dtoFile, () => renderDto(ctx, spec.name, dtoFile));
    hintNestjsZod(ctx.stack);
    return wroteSchema || wroteDto;
}

function writeSide(ctx: RenderContext, spec: ActionSpec, entity: string, side: Side): boolean {
    const repositoryLayer = side === 'client' ? 'clientRepository' : 'serverRepository';
    const serviceLayer = side === 'client' ? 'clientService' : 'serverService';
    const renderRepository = side === 'client' ? renderClientRepository : renderServerRepository;

    const repositoryFile = path.join(ensureLayerDir(ctx, repositoryLayer), `${spec.name}.repository.ts`);
    const wroteRepository = writeIfAbsent(repositoryFile, () => renderRepository(ctx, spec, entity, repositoryFile));

    const serviceFile = path.join(ensureLayerDir(ctx, serviceLayer), `${spec.name}.service.ts`);
    const wroteService = writeIfAbsent(serviceFile, () => renderService(ctx, spec, entity, serviceFile, side));

    return wroteRepository || wroteService;
}

function writeController(ctx: RenderContext, spec: ActionSpec, entity: string): boolean {
    if (ctx.profile.name === 'next-fullstack') {
        const routeDir = path.join(apiRouteDir(ctx.stack, ctx.feature), spec.path.slice(1));
        mkdirSafe(routeDir);
        const routeFile = path.join(routeDir, 'route.ts');
        return writeIfAbsent(routeFile, () => renderActionRoute(ctx, spec, routeFile));
    }

    const suffix = controllerSuffix(ctx.profile.name);
    const controllerFile = path.join(ensureLayerDir(ctx, 'controller'), `${spec.name}.${suffix}.ts`);
    const render = controllerRenderer(ctx.profile.name);
    const wroteController = writeIfAbsent(controllerFile, () => render(ctx, spec, entity, controllerFile));

    const line = ctx.profile.name === 'node' ? renderNodeRouteLine(ctx, spec, entity) : null;
    if (wroteController && line !== null) {
        console.log(`ℹ️  Add to ${ctx.feature}.routes.ts above the '/:id' routes: ${line}`);
    }

    return wroteController;
}
