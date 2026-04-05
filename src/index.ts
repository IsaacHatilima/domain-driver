#!/usr/bin/env node
import { Command } from 'commander';
import { makeFeature } from './commands/feature';
import { makeComponent } from './commands/component';
import { makeHook } from './commands/hook';
import { makeService } from './commands/service';
import { makeSchema } from './commands/schema';
import { makeRepository } from './commands/repository';
import { makeContainer } from './commands/container';
import { makeTypes } from './commands/types';

const program = new Command();

program
    .name('domain-driver')
    .description('CLI scaffolding tool for domain-driven development in Next.js')
    .version('0.1.0');

program
    .command('make:feature <name>')
    .description('Scaffold a full feature folder structure')
    .option('-a, --all', 'Scaffold all files inside each folder')
    .action(async (name: string, options: { all?: boolean }) => {
        try {
            await makeFeature(name, options.all ?? false);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ ${message}`);
            process.exit(1);
        }
    });

program
    .command('make:component <feature> <name>')
    .description('Scaffold a component inside an existing feature')
    .argument('[type]', 'Component type: client or server', 'client')
    .action((feature: string, name: string, type: string) => {
        try {
            const componentType = type === 'server' ? 'server' : 'client';
            makeComponent(feature, name, componentType);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ ${message}`);
            process.exit(1);
        }
    });

program
    .command('make:container <feature> <name>')
    .description('Scaffold a smart container component inside an existing feature')
    .action((feature: string, name: string) => {
        try {
            makeContainer(feature, name);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ ${message}`);
            process.exit(1);
        }
    });

program
    .command('make:hook <feature> <name>')
    .description('Scaffold a custom hook inside an existing feature')
    .action((feature: string, name: string) => {
        try {
            makeHook(feature, name);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ ${message}`);
            process.exit(1);
        }
    });

program
    .command('make:service <feature> <name>')
    .description('Scaffold single-responsibility service files inside an existing feature')
    .action((feature: string, name: string) => {
        try {
            makeService(feature, name);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ ${message}`);
            process.exit(1);
        }
    });

program
    .command('make:repository <feature> <name>')
    .description('Scaffold single-responsibility repository files inside an existing feature')
    .action((feature: string, name: string) => {
        try {
            makeRepository(feature, name);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ ${message}`);
            process.exit(1);
        }
    });

program
    .command('make:schema <feature> <name>')
    .description('Scaffold Zod schemas for create and update operations')
    .action((feature: string, name: string) => {
        try {
            makeSchema(feature, name);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ ${message}`);
            process.exit(1);
        }
    });

program
    .command('make:types <feature> <name>')
    .description('Scaffold a types file inside an existing feature')
    .action((feature: string, name: string) => {
        try {
            makeTypes(feature, name);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ ${message}`);
            process.exit(1);
        }
    });

program.parse();
