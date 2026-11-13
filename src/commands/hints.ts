import { DetectedStack, StackProfile } from '../stack/types';

let nestjsZodHinted = false;
let reactQueryHinted = false;
let routeIgnoredHinted = false;

export function resetHints(): void {
    nestjsZodHinted = false;
    reactQueryHinted = false;
    routeIgnoredHinted = false;
}

/** `--route` chooses between Server Actions and route handlers, a choice only next-fullstack has. */
export function hintRouteIgnored(profile: StackProfile, route: boolean | undefined): void {
    if (route !== true || profile.serverActions || routeIgnoredHinted) return;
    routeIgnoredHinted = true;
    console.log(`ℹ️  --route only changes next-fullstack output; the ${profile.name} stack is unchanged.`);
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
