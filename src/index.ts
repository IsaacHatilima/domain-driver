#!/usr/bin/env node
// src/index.ts
import { Command } from 'commander';
import { makeAction, parseReturns } from './commands/action';
import { makeComponent, parseComponentType } from './commands/component';
import { makeContainer } from './commands/container';
import { makeController } from './commands/controller';
import { makeFeature } from './commands/feature';
import { hintRegisterInModule, standardClassNames } from './commands/hints';
import { makeHook } from './commands/hook';
import { makeRepository } from './commands/repository';
import { makeSchema } from './commands/schema';
import { makeService } from './commands/service';
import { parseSide } from './commands/sides';
import { parseFeatureTarget, parseTarget } from './commands/target';
import { makeTypes } from './commands/types';
import { runInit } from './init/init';
import { SectionStatus } from './init/markers';
import { describeStack, detectStack } from './stack/detect';
import { STACK_NAMES } from './stack/types';
import { actionCase } from './templates/actions';
import { currentVersion } from './update/version';

const program = new Command();

program
    .name('domain-driver')
    .description('CLI scaffolding tool for domain-driven feature folders in Next.js, React, Node, and NestJS projects')
    .version(currentVersion())
    .option('--stack <name>', `Override stack detection (${STACK_NAMES.join(', ')})`);

program.hook('preAction', (_thisCommand, actionCommand) => {
    if (actionCommand.name() === 'init') return;
    const { stack } = program.opts<{ stack?: string }>();
    console.log(describeStack(detectStack(stack)));
});

program
    .command('make:feature <target>')
    .description('Scaffold a feature folder for the detected stack (<feature> or <feature>/<Entity>)')
    .option('-a, --all', 'Scaffold all files inside each folder')
    .action(async (target: string, options: { all?: boolean }) => {
        const { feature, entity } = parseFeatureTarget(target);
        await makeFeature(feature, options.all ?? false, entity ?? undefined);
    });

program
    .command('make:component <target>')
    .description('Scaffold a component inside an existing feature (<feature>/<Name>)')
    .argument('[type]', 'Component type: client or server', 'client')
    .action((target: string, type: string) => {
        const { feature, name } = parseTarget(target);
        makeComponent(feature, name, parseComponentType(type));
    });

program
    .command('make:container <target>')
    .description('Scaffold a smart container component inside an existing feature (<feature>/<Name>)')
    .action((target: string) => {
        const { feature, name } = parseTarget(target);
        makeContainer(feature, name);
    });

program
    .command('make:hook <target>')
    .description('Scaffold a custom hook inside an existing feature (<feature>/<useName>)')
    .action((target: string) => {
        const { feature, name } = parseTarget(target);
        makeHook(feature, name);
    });

program
    .command('make:service <target>')
    .description('Scaffold single-responsibility service files inside an existing feature (<feature>/<Entity>)')
    .option('--side <side>', 'client, server, or both', 'both')
    .action((target: string, options: { side: string }) => {
        const { feature, name } = parseTarget(target);
        const wrote = makeService(feature, name, parseSide(options.side));
        if (wrote) hintRegisterInModule(feature, standardClassNames(name, 'Service'));
    });

program
    .command('make:repository <target>')
    .description('Scaffold single-responsibility repository files inside an existing feature (<feature>/<Entity>)')
    .option('--side <side>', 'client, server, or both', 'both')
    .action((target: string, options: { side: string }) => {
        const { feature, name } = parseTarget(target);
        const wrote = makeRepository(feature, name, parseSide(options.side));
        if (wrote) hintRegisterInModule(feature, standardClassNames(name, 'Repository'));
    });

program
    .command('make:controller <target>')
    .description('Scaffold single-responsibility controllers or route handlers inside an existing feature (<feature>/<Entity>)')
    .action((target: string) => {
        const { feature, name } = parseTarget(target);
        const wrote = makeController(feature, name);
        if (wrote) hintRegisterInModule(feature, standardClassNames(name, 'Controller'));
    });

program
    .command('make:action <target> <action>')
    .description('Scaffold a bespoke action as its own service, repository, and controller (<feature>/<Entity> <actionName>)')
    .option('--with-input', 'The action takes a request body validated by a Zod schema', false)
    .option('--returns <kind>', 'list, one, or void', 'list')
    .action((target: string, action: string, options: { withInput: boolean; returns: string }) => {
        const { feature, name } = parseTarget(target);
        const returns = parseReturns(options.returns);
        const wrote = makeAction(feature, name, action, { withInput: options.withInput, returns });
        if (wrote) {
            const { pascal } = actionCase(action);
            hintRegisterInModule(
                feature,
                [`${pascal}Controller`, `${pascal}Service`, `${pascal}Repository`],
                `list ${pascal}Controller before Show${name}Controller in controllers`
            );
        }
    });

program
    .command('make:schema <target>')
    .description('Scaffold Zod schemas (and Nest DTOs) for create and update operations (<feature>/<Entity>)')
    .action((target: string) => {
        const { feature, name } = parseTarget(target);
        makeSchema(feature, name);
    });

program
    .command('make:types <target>')
    .description('Scaffold a types file inside an existing feature (<feature>/<Entity>)')
    .action((target: string) => {
        const { feature, name } = parseTarget(target);
        makeTypes(feature, name);
    });

const INIT_ICONS: Readonly<Record<SectionStatus, string>> = Object.freeze({
    created: '✅',
    updated: '✅',
    unchanged: 'ℹ️ ',
});

program
    .command('init')
    .description('Write agent guidance into this project: AGENTS.md, CLAUDE.md, and .claude/skills/domain-driver/SKILL.md')
    .action(() => {
        for (const result of runInit(process.cwd())) {
            console.log(`${INIT_ICONS[result.status]} ${result.file} ${result.status}`);
        }
    });

function fail(error: unknown): never {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ ${message}`);
    process.exit(1);
}

program.parseAsync().catch(fail);
