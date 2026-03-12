#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const feature_1 = require("./commands/feature");
const [, , command, name] = process.argv;
if (!command || !name) {
    console.error('Usage: domain-driver make:feature <name>');
    process.exit(1);
}
if (command === 'make:feature') {
    (0, feature_1.makeFeature)(name);
}
else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
