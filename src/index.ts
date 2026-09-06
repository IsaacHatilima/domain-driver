#!/usr/bin/env node
// src/index.ts
import { Command } from 'commander';
import { makeComponent, parseComponentType } from './commands/component';
import { makeContainer } from './commands/container';
import { makeController } from './commands/controller';
import { makeFeature } from './commands/feature';
import { hintRegisterInModule } from './commands/hints';
import { makeHook } from './commands/hook';
import { makeRepository } from './commands/repository';
import { makeSchema } from './commands/schema';
import { makeService } from './commands/service';
import { parseSide } from './commands/sides';
import { makeTypes } from './commands/types';
import { describeStack, detectStack } from './stack/detect';
import { STACK_NAMES } from './stack/types';
import { ACTIONS } from './templates/actions';

const program = new Command();

program
    .name('domain-driver')
    .description('CLI scaffolding tool for domain-driven feature folders in Next.js, React, Node, and NestJS projects')
    .version('0.2.0')
    .option('--stack <name>', `Override stack detection (${STACK_NAMES.join(', ')})`);

program.hook('preAction', () => {
    const { stack } = program.opts<{ stack?: string }>();
    console.log(describeStack(detectStack(stack)));
});

program
    .command('make:feature <name>')
    .description('Scaffold a feature folder for the detected stack')
    .option('-a, --all', 'Scaffold all files inside each folder')
    .action(async (name: string, options: { all?: boolean }) => {
        await makeFeature(name, options.all ?? false);
    });

program
    .command('make:component <feature> <name>')
    .description('Scaffold a component inside an existing feature')
    .argument('[type]', 'Component type: client or server', 'client')
    .action((feature: string, name: string, type: string) => {
        makeComponent(feature, name, parseComponentType(type));
    });

program
    .command('make:container <feature> <name>')
    .description('Scaffold a smart container component inside an existing feature')
    .action((feature: string, name: string) => {
        makeContainer(feature, name);
    });

program
    .command('make:hook <feature> <name>')
    .description('Scaffold a custom hook inside an existing feature')
    .action((feature: string, name: string) => {
        makeHook(feature, name);
    });

program
    .command('make:service <feature> <name>')
    .description('Scaffold single-responsibility service files inside an existing feature')
    .option('--side <side>', 'client, server, or both', 'both')
    .action((feature: string, name: string, options: { side: string }) => {
        makeService(feature, name, parseSide(options.side));
        hintRegisterInModule(feature, ACTIONS.map((action) => `${action}${name}Service`));
    });

program
    .command('make:repository <feature> <name>')
    .description('Scaffold single-responsibility repository files inside an existing feature')
    .option('--side <side>', 'client, server, or both', 'both')
    .action((feature: string, name: string, options: { side: string }) => {
        makeRepository(feature, name, parseSide(options.side));
        hintRegisterInModule(feature, ACTIONS.map((action) => `${action}${name}Repository`));
    });

program
    .command('make:controller <feature> <name>')
    .description('Scaffold single-responsibility controllers or route handlers inside an existing feature')
    .action((feature: string, name: string) => {
        makeController(feature, name);
        hintRegisterInModule(feature, ACTIONS.map((action) => `${action}${name}Controller`));
    });

program
    .command('make:schema <feature> <name>')
    .description('Scaffold Zod schemas (and Nest DTOs) for create and update operations')
    .action((feature: string, name: string) => {
        makeSchema(feature, name);
    });

program
    .command('make:types <feature> <name>')
    .description('Scaffold a types file inside an existing feature')
    .action((feature: string, name: string) => {
        makeTypes(feature, name);
    });

function fail(error: unknown): never {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ ${message}`);
    process.exit(1);
}

program.parseAsync().catch(fail);
