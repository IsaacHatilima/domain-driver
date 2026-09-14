import { DetectedStack, StackProfile } from '../stack/types';

let nestjsZodHinted = false;
let reactQueryHinted = false;

export function resetHints(): void {
    nestjsZodHinted = false;
    reactQueryHinted = false;
}

export function hintNestjsZod(stack: DetectedStack): void {
    if (stack.stack !== 'nest' || stack.hasNestjsZod || nestjsZodHinted) return;
    nestjsZodHinted = true;
    console.log('ℹ️  nestjs-zod is not installed. Run: npm install nestjs-zod');
    console.log('   Then register the pipe in AppModule: { provide: APP_PIPE, useClass: ZodValidationPipe }');
}

export function hintReactQuery(profile: StackProfile): void {
    if (!profile.queryHooks || reactQueryHinted) return;
    reactQueryHinted = true;
    console.log('ℹ️  Hooks use TanStack Query. Install it: npm install @tanstack/react-query');
    console.log('   Then wrap your app in a QueryClientProvider.');
}
