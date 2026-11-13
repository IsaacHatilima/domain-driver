import * as path from 'path';
import { ActionSpec } from '../templates/actions';
import { RenderContext } from '../templates/context';
import { CALLER_CHECK, renderServerAction } from '../templates/controllers/next-server-action';
import { joinWithAnd } from '../utils/text';
import { ensureLayerDir } from './resolve';
import { writeIfAbsent } from './write';

/** How a feature on a Server Actions stack is served. Other stacks ignore it. */
export interface DeliveryOptions {
    /**
     * Serve the operation through a route handler and a fetch hook, for callers outside the app
     * such as webhooks or a mobile client, instead of a Server Action or a Server Component read.
     */
    readonly route?: boolean;
}

export function usesServerActions(ctx: RenderContext, options: DeliveryOptions): boolean {
    return ctx.profile.serverActions && options.route !== true;
}

function relative(file: string): string {
    return path.relative(process.cwd(), file).split(path.sep).join('/');
}

/** Names the line in each new action that throws until the project wires its own session check. */
export function hintCallerCheck(files: readonly string[]): void {
    if (files.length === 0) return;
    console.log(
        `ℹ️  Server Actions fail closed until they check the caller. In ${joinWithAnd(files.map(relative))}, ` +
            `replace "${CALLER_CHECK}" with your session check (for example: const { user } = await requireSession();) ` +
            'and delete requireCaller().'
    );
}

/** A read has no action of its own: the page's Server Component calls its service. */
export function hintServerRead(spec: ActionSpec): void {
    console.log(
        `ℹ️  ${spec.name} is a read: call ${spec.name}Service from a Server Component, such as a container. ` +
            'It gets no Server Action; pass --route for a route handler and fetch hook.'
    );
}

/** Writes `server/actions/<Name>.action.ts` for each spec, and returns the files it wrote. */
export function writeServerActions(ctx: RenderContext, specs: readonly ActionSpec[], entity: string): readonly string[] {
    const dir = ensureLayerDir(ctx, 'serverAction');
    return specs.flatMap((spec) => {
        const file = path.join(dir, `${spec.name}.action.ts`);
        return writeIfAbsent(file, () => renderServerAction(ctx, spec, entity, file)) ? [file] : [];
    });
}
