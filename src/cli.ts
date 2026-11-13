// src/cli.ts
import { Command } from 'commander';
import * as os from 'os';
import { makeAction, parseMethod, parseReturns } from './commands/action';
import { makeComponent, parseComponentType } from './commands/component';
import { makeContainer } from './commands/container';
import { makeController } from './commands/controller';
import { makeFeature } from './commands/feature';
import { registerClasses, registerCustomAction, standardActionNames } from './commands/register';
import { requireFeature } from './commands/resolve';
import { makeHook } from './commands/hook';
import { makeRepository } from './commands/repository';
import { makeSchema } from './commands/schema';
import { makeService } from './commands/service';
import { parseFeatureTarget, parseTarget } from './commands/target';
import { makeTypes } from './commands/types';
import { runUpdate, defaultUpdateDeps, UpdateDeps } from './commands/update';
import { describeStack, detectStack } from './stack/detect';
import { STACK_NAMES } from './stack/types';
import { actionCase } from './templates/actions';
import { checkForUpdate, shouldCheck } from './update/check';
import { FetchLike, nodeFetch } from './update/registry';
import { currentVersion } from './update/version';

export interface CliDeps {
    readonly env: NodeJS.ProcessEnv;
    readonly isTTY: boolean;
    readonly homedir: string;
    readonly now: () => number;
    readonly fetchImpl: FetchLike;
    readonly current: string;
    readonly updateDeps: () => UpdateDeps;
    readonly log: (line: string) => void;
}

const SKIP_DETECTION = new Set(['update']);

/** make:action writes different files per stack, so its help says which, rather than one list for all. */
const ACTION_FILES_HELP = `
Files per stack:
  react, next-frontend   hook only; the service and repository live behind the API, outside the project
  next-fullstack         hook, service, repository, route handler at app/api/<feature>/<slug>/route.ts
  tanstack-start         hook, service, repository, server function (<Name>.fn.ts)
  node                   service, repository, controller; prints the line for <feature>.routes.ts
  nest                   service, repository, controller, and a DTO with --with-input; registered in <feature>.module.ts
--with-input also writes <Name>.schema.ts on every stack.`;

interface MakeActionOptions {
    readonly withInput: boolean;
    readonly returns: string;
    readonly method?: string;
    readonly onRecord: boolean;
}

export function defaultCliDeps(): CliDeps {
    return {
        env: process.env,
        isTTY: process.stdout.isTTY === true,
        homedir: os.homedir(),
        now: Date.now,
        fetchImpl: nodeFetch,
        current: currentVersion(),
        updateDeps: defaultUpdateDeps,
        log: (line) => console.log(line),
    };
}

export function createProgram(deps: CliDeps): Command {
    const program = new Command();

    program
        .name('domain-driver')
        .description('CLI scaffolding tool for domain-driven feature folders in Next.js, React, Node, NestJS, and TanStack Start projects')
        .version(deps.current)
        .option('--stack <name>', `Override stack detection (${STACK_NAMES.join(', ')})`)
        .option('--root <dir>', 'Override where feature folders are created, for example src/features')
        .option('--no-auto-register', 'Do not edit Nest module files; print what to add instead');

    let pendingNotice: Promise<string | null> = Promise.resolve(null);

    program.hook('preAction', (_thisCommand, actionCommand) => {
        const name = actionCommand.name();
        if (shouldCheck(deps.env, deps.isTTY, name)) {
            pendingNotice = checkForUpdate({
                env: deps.env,
                homedir: deps.homedir,
                now: deps.now,
                fetchImpl: deps.fetchImpl,
                current: deps.current,
            });
        }
        if (SKIP_DETECTION.has(name)) return;
        const { stack, root } = program.opts<{ stack?: string; root?: string }>();
        // commander defaults a --no-x flag to true, which would shadow the package.json key,
        // so only an explicitly passed flag counts as an override.
        const passed = program.getOptionValueSource('autoRegister') === 'cli';
        const autoRegister = passed ? program.opts<{ autoRegister: boolean }>().autoRegister : undefined;
        deps.log(describeStack(detectStack({ stack, root, autoRegister })));
    });

    program.hook('postAction', async () => {
        const notice = await pendingNotice;
        if (notice !== null) deps.log(notice);
    });

    program
        .command('make:feature <target>')
        .description('Scaffold a feature folder for the detected stack (<feature> or <feature>/<Entity>)')
        .option('-a, --all', "Scaffold every layer's files, not just the folders")
        .action(async (target: string, options: { all?: boolean }) => {
            const { feature, entity } = parseFeatureTarget(target);
            await makeFeature(feature, options.all ?? false, entity ?? undefined);
        });

    program
        .command('make:component <target>')
        .description('Scaffold a component inside an existing feature (<feature>/<Name>); react, next-frontend, next-fullstack, tanstack-start')
        .argument('[type]', 'Component type: client or server', 'client')
        .action((target: string, type: string) => {
            const { feature, name } = parseTarget(target);
            makeComponent(feature, name, parseComponentType(type));
        });

    program
        .command('make:container <target>')
        .description(
            'Scaffold a container (<feature>/<Entity>Container): it lists records through useList<Entity> when that hook exists, and calls no hook otherwise'
        )
        .action((target: string) => {
            const { feature, name } = parseTarget(target);
            makeContainer(feature, name);
        });

    program
        .command('make:hook <target>')
        .description(
            'Scaffold one hook file per action, List to Delete, that calls the API (<feature>/<Entity>); react, next-frontend, next-fullstack, tanstack-start'
        )
        .action((target: string) => {
            const { feature, name } = parseTarget(target);
            makeHook(feature, name);
        });

    program
        .command('make:service <target>')
        .description(
            'Scaffold one server-side service per action (<feature>/<Entity>); node, nest, next-fullstack, tanstack-start'
        )
        .action((target: string) => {
            const { feature, name } = parseTarget(target);
            const wrote = makeService(feature, name);
            if (wrote) registerClasses(requireFeature(feature), 'service', standardActionNames(name));
        });

    program
        .command('make:repository <target>')
        .description(
            'Scaffold one server-side repository per action (<feature>/<Entity>); node, nest, next-fullstack, tanstack-start'
        )
        .action((target: string) => {
            const { feature, name } = parseTarget(target);
            const wrote = makeRepository(feature, name);
            if (wrote) registerClasses(requireFeature(feature), 'repository', standardActionNames(name));
        });

    program
        .command('make:controller <target>')
        .description(
            'Scaffold one controller per action: Node and Nest controllers, Next route handlers, TanStack Start server functions (<feature>/<Entity>); not on react or next-frontend'
        )
        .action((target: string) => {
            const { feature, name } = parseTarget(target);
            const wrote = makeController(feature, name);
            if (wrote) registerClasses(requireFeature(feature), 'controller', standardActionNames(name));
        });

    program
        .command('make:action <target> <action>')
        .description("Scaffold a bespoke action as its own file in each of the stack's layers (<feature>/<Entity> <actionName>)")
        .option('--with-input', 'The action takes a request body validated by a Zod schema', false)
        .option('--returns <kind>', 'list, one, or void', 'list')
        .option('--method <method>', 'get, post, put, patch, or delete (default: post with --with-input, otherwise get)')
        .option('--on-record', 'The action takes the record id: route /:id/<slug>, with id passed through every layer', false)
        .addHelpText('after', ACTION_FILES_HELP)
        .action((target: string, action: string, options: MakeActionOptions) => {
            const { feature, name } = parseTarget(target);
            const returns = parseReturns(options.returns);
            const method = options.method === undefined ? undefined : parseMethod(options.method);
            const wrote = makeAction(feature, name, action, {
                withInput: options.withInput,
                returns,
                method,
                onRecord: options.onRecord,
            });
            if (wrote) {
                const { pascal } = actionCase(action);
                registerCustomAction(requireFeature(feature), pascal, name);
            }
        });

    program
        .command('make:schema <target>')
        .description(
            'Scaffold the entity schema and the Create and Update Zod schemas, plus Create and Update DTOs on Nest (<feature>/<Entity>)'
        )
        .action((target: string) => {
            const { feature, name } = parseTarget(target);
            makeSchema(feature, name);
        });

    program
        .command('make:types <target>')
        .description(
            'Scaffold the entity type, inferred with z.infer from the entity schema, which it writes when missing (<feature>/<Entity>)'
        )
        .action((target: string) => {
            const { feature, name } = parseTarget(target);
            makeTypes(feature, name);
        });

    program
        .command('update')
        .description('Update domain-driver with your package manager')
        .option('--dry-run', 'Print the command without running it', false)
        .option('--check', 'Only report whether a newer version exists', false)
        .action(async (options: { dryRun: boolean; check: boolean }) => {
            await runUpdate(options, deps.updateDeps());
        });

    return program;
}
