import { validateFeatureName } from '../utils/naming';

export interface Target {
    readonly feature: string;
    readonly name: string;
}

export interface FeatureTarget {
    readonly feature: string;
    readonly entity: string | null;
}

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;

function validateName(name: string): void {
    if (!NAME_PATTERN.test(name)) {
        throw new Error(`Name "${name}" must be letters and digits only, for example User.`);
    }
}

export function parseTarget(value: string): Target {
    const parts = value.split('/');
    if (parts.length !== 2) {
        throw new Error(`Target "${value}" must be <feature>/<Name>, for example users/User.`);
    }
    const [feature, name] = parts;
    validateFeatureName(feature);
    validateName(name);
    return Object.freeze({ feature, name });
}

export function parseFeatureTarget(value: string): FeatureTarget {
    const parts = value.split('/');
    if (parts.length > 2) {
        throw new Error(
            `Target "${value}" must be <feature> or <feature>/<Entity>, for example users or users/User.`
        );
    }
    const [feature, entity] = parts;
    validateFeatureName(feature);
    if (entity !== undefined) validateName(entity);
    return Object.freeze({ feature, entity: entity ?? null });
}
