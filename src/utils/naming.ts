const FEATURE_NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function toPascalCase(name: string): string {
    return name
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

export function lowerFirst(name: string): string {
    return name.charAt(0).toLowerCase() + name.slice(1);
}

export function validateFeatureName(name: string): void {
    if (!FEATURE_NAME_PATTERN.test(name)) {
        throw new Error(`Feature name "${name}" must be kebab-case, for example coffee-type.`);
    }
}
