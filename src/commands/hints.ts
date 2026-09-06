import { detectStack } from '../stack/detect';
import { DetectedStack } from '../stack/types';
import { ACTIONS } from '../templates/actions';

let nestjsZodHinted = false;

export function resetHints(): void {
    nestjsZodHinted = false;
}

export function hintNestjsZod(stack: DetectedStack): void {
    if (stack.stack !== 'nest' || stack.hasNestjsZod || nestjsZodHinted) return;
    nestjsZodHinted = true;
    console.log('ℹ️  nestjs-zod is not installed. Run: npm install nestjs-zod');
    console.log('   Then register the pipe in AppModule: { provide: APP_PIPE, useClass: ZodValidationPipe }');
}

export function standardClassNames(name: string, suffix: string): string[] {
    return ACTIONS.map((action) => `${action}${name}${suffix}`);
}

export function hintRegisterInModule(feature: string, classNames: readonly string[], note?: string): void {
    if (detectStack().stack !== 'nest') return;
    const suffix = note !== undefined ? ` (${note})` : '';
    console.log(`ℹ️  Register ${classNames.join(', ')} in ${feature}.module.ts${suffix}`);
}
