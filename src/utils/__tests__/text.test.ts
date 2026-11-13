import { describe, it, expect } from 'vitest';
import { joinWithAnd } from '../text';

describe('joinWithAnd', () => {
    it.each([
        [[], ''],
        [['a'], 'a'],
        [['a', 'b'], 'a and b'],
        [['a', 'b', 'c'], 'a, b and c'],
    ])('joins %j as "%s"', (items, joined) => {
        expect(joinWithAnd(items)).toBe(joined);
    });
});
