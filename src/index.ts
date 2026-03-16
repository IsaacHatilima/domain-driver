#!/usr/bin/env node
import { makeFeature } from './commands/feature';
import { makeComponent } from './commands/component';
import { makeHook } from './commands/hook';
import { makeService } from './commands/service';
import { makeSchema } from './commands/schema';
import { makeRepository } from './commands/repository';
import { makeContainer } from './commands/container';

const [,, command, feature, name] = process.argv;

if (!command || !feature) {
    console.error('Usage: domain-driver <command> [options]');
    process.exit(1);
}

switch (command) {
    case 'make:feature':
        const all = process.argv.includes('-a') || process.argv.includes('-A');
        makeFeature(feature, all).then(() => {});
        break;

    case 'make:component':
        if (!name) {
            console.error('Usage: domain-driver make:component <feature> <name> [client|server]');
            process.exit(1);
        }
        const type = (process.argv[5] as 'client' | 'server') || 'client';
        makeComponent(feature, name, type);
        break;

    case 'make:hook':
        if (!name) {
            console.error('Usage: domain-driver make:hook <feature> <name>');
            process.exit(1);
        }
        makeHook(feature, name);
        break;

    case 'make:service':
        if (!name) {
            console.error('Usage: domain-driver make:service <feature> <name>');
            process.exit(1);
        }
        makeService(feature, name);
        break;

    case 'make:schema':
        if (!name) {
            console.error('Usage: domain-driver make:schema <feature> <name>');
            process.exit(1);
        }
        makeSchema(feature, name);
        break;

    case 'make:repository':
        if (!name) {
            console.error('Usage: domain-driver make:repository <feature> <name>');
            process.exit(1);
        }
        makeRepository(feature, name);
        break;

    case 'make:container':
        if (!name) {
            console.error('Usage: domain-driver make:container <feature> <name>');
            process.exit(1);
        }
        makeContainer(feature, name);
        break;

    default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
}