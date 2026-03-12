#!/usr/bin/env node
import { makeFeature } from './commands/feature';

const [,, command, name] = process.argv;

if (!command || !name) {
    console.error('Usage: domain-driver make:feature <name>');
    process.exit(1);
}

if (command === 'make:feature') {
    makeFeature(name);
} else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}