#!/usr/bin/env node
// src/index.ts
import { createProgram, defaultCliDeps } from './cli';

function fail(error: unknown): never {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ ${message}`);
    process.exit(1);
}

createProgram(defaultCliDeps()).parseAsync().catch(fail);
