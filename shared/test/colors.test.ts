import { CardColorCharacter, colorToShort, colorToLong, toOrderedColors } from '../src';

const t = (_input: CardColorCharacter[], output: CardColorCharacter[]) => {
  const input = _input.map(c => colorToLong(c));
  const result = toOrderedColors(input);
  expect(result).not.toBe(input);
  expect(result.map(cc => colorToShort(cc))).toStrictEqual(output);
}

describe('toOrderColors', () => {
  test('zero colors', () => {
    t([], []);
  });
  test('one color', () => {
    t(['w'], ['w']);
    t(['r'], ['r']);
  });
  test('two colors', () => {
    t(['b', 'w'], ['w', 'b']);
    t(['u', 'g'], ['g', 'u']);
    t(['g', 'w'], ['g', 'w']);
    t(['b', 'g'], ['b', 'g']);
    t(['w', 'r'], ['r', 'w']);
    t(['r', 'u'], ['u', 'r']);
  });
  test('three colors', () => {
    t(['w', 'b', 'r'], ['r', 'w', 'b']);
    t(['g', 'r', 'u'], ['g', 'u', 'r']);
    t(['w', 'g', 'u'], ['g', 'w', 'u']);
    t(['w', 'b', 'u'], ['w', 'u', 'b']);
    t(['w', 'g', 'r'], ['r', 'g', 'w']);
  });
  test('four colors', () => {
    t(['w', 'b', 'r', 'u'], ['w', 'u', 'b', 'r']);
    t(['b', 'r', 'u', 'w'], ['w', 'u', 'b', 'r']);
    t(['u', 'r', 'g', 'w'], ['r', 'g', 'w', 'u']);
  });
  test('five colors', () => {
    t(['w', 'b', 'r', 'u', 'g'], ['w', 'u', 'b', 'r', 'g']);
  });
});
