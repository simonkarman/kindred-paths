import { expect, test } from 'vitest';
import { FilterQueryHandler, FilterQueryToken } from '../src';

test('resolver', () => {
  const handler = new FilterQueryHandler();
  const termResolver = (term: string) => ['true', '1', 'yes', 'y'].includes(term.toLowerCase());
  const t = (query: string) => handler.resolve(handler.tokenize(query), termResolver);

  // simple
  expect(t('true')).toBe(true);
  expect(t('1')).toBe(true);
  expect(t('false')).toBe(false);
  expect(t('n')).toBe(false);

  // and
  expect(t('true and true')).toBe(true);
  expect(t('true true')).toBe(true);
  expect(t('true and false')).toBe(false);
  expect(t('true false')).toBe(false);
  expect(t('false and true')).toBe(false);
  expect(t('false true')).toBe(false);
  expect(t('false and false')).toBe(false);
  expect(t('false false')).toBe(false);

  // or
  expect(t('true or true')).toBe(true);
  expect(t('true or false')).toBe(true);
  expect(t('false or true')).toBe(true);
  expect(t('false or false')).toBe(false);

  // or and precedence
  expect(t('true and false or true')).toBe(true);
  expect(t('true false or true')).toBe(true);
  expect(t('true false or false')).toBe(false);
  expect(t('true and (false or true)')).toBe(true);
  expect(t('(true and false) or true')).toBe(true);
  expect(t('true and (false or false)')).toBe(false);
  expect(t('false or (false or true)')).toBe(true);

  // parentheses edge cases
  expect(t('()')).toBe(true);
  expect(t('()(false)')).toBe(false);
  expect(t('((((((((false)')).toBe(false);
  expect(t('((((((((true')).toBe(true);
  expect(t('true)))))')).toBe(true);
  expect(t('(false)())))')).toBe(false);

  // and or and beginning and end of query
  expect(t('and true')).toBe(true);
  expect(t('or true')).toBe(true);
  expect(t('and or true')).toBe(true);
  expect(t('true and')).toBe(true);
  expect(t('true or')).toBe(true);
  expect(t('true or and')).toBe(true);
  expect(t('and false')).toBe(false);
  expect(t('or false')).toBe(false);
  expect(t('or and false')).toBe(false);
  expect(t('false and')).toBe(false);
  expect(t('false or')).toBe(false);
  expect(t('false and or')).toBe(false);
  expect(t('or false or')).toBe(false);
  expect(t('or true or')).toBe(true);
  expect(t('and false and')).toBe(false);
  expect(t('and true and')).toBe(true);
  expect(t('and')).toBe(true);
  expect(t('or')).toBe(true);
  expect(t('and and and')).toBe(true);
  expect(t('or or or')).toBe(true);
  expect(t('or and or')).toBe(true);
  expect(t('and and or or')).toBe(true);
  expect(t('or or and or or')).toBe(true);

  // multiple ands and ors in a row
  expect(t('true and and true')).toBe(true);
  expect(t('true or or false')).toBe(true);
  expect(t('false and and false')).toBe(false);
  expect(t('false or or false')).toBe(false);
  expect(t('true and and or true')).toBe(true);
  expect(t('true or or and false')).toBe(false);
  expect(t('false and and or true')).toBe(true);
  expect(t('false or or and true')).toBe(false);

  // Empty query
  expect(t('')).toBe(true);
  expect(t('   ')).toBe(true);
});

test('tokenizer', () => {
  const handler = new FilterQueryHandler();

  // Single term
  expect(handler.tokenize('type=forest'))
    .toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'term', value: 'type=forest' }]);

  // Two Terms
  expect(handler.tokenize('type=forest producible-color=u'))
    .toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'term', value: 'type=forest' }, { depth: 0, type: 'term', value: 'producible-color=u' }]);
  expect(handler.tokenize('a\tb'))
    .toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'term', value: 'a' }, { depth: 0, type: 'term', value: 'b' }]);
  expect(handler.tokenize('a\u00a0b'))
    .toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'term', value: 'a' }, { depth: 0, type: 'term', value: 'b' }]);

  // Empty query
  expect(handler.tokenize(''))
    .toStrictEqual<FilterQueryToken[]>([]);
  expect(handler.tokenize('   '))
    .toStrictEqual<FilterQueryToken[]>([]);

  // Quoted terms
  expect(handler.tokenize('"the great"'))
    .toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'term', value: '"the great"' }]);
  expect(handler.tokenize('rules="whenever this creature enters"'))
    .toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'term', value: 'rules="whenever this creature enters"' }]);
  expect(handler.tokenize('\'the great\''))
    .toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'term', value: '\'the great\'' }]);
  expect(handler.tokenize('six=\'3 + 3\''))
    .toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'term', value: 'six=\'3 + 3\'' }]);
  expect(handler.tokenize('\'abc\' "def" ghi=\'jkl mnop\' qrs tuv "wxy z"'))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 0, type: 'term', value: '\'abc\'' },
      { depth: 0, type: 'term', value: '"def"' },
      { depth: 0, type: 'term', value: 'ghi=\'jkl mnop\'' },
      { depth: 0, type: 'term', value: 'qrs' },
      { depth: 0, type: 'term', value: 'tuv' },
      { depth: 0, type: 'term', value: '"wxy z"' },
    ]);
  expect(handler.tokenize('"" the'))
    .toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'term', value: '""' }, { depth: 0, type: 'term', value: 'the' }]);
  expect(handler.tokenize('"'))
    .toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'term', value: '"' }]);

  // Test unclosed quotes
  expect(handler.tokenize('"the great'))
    .toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'term', value: '"the' }, { depth: 0, type: 'term', value: 'great' }]);
  expect(handler.tokenize('\'the grea"t'))
    .toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'term', value: '\'the' }, { depth: 0, type: 'term', value: 'grea"t' }]);

  // Test mismatched quotes
  expect(handler.tokenize('\'the great"'))
    .toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'term', value: '\'the' }, { depth: 0, type: 'term', value: 'great"' }]);

  // Nested quotes
  expect(handler.tokenize('"the \'great\' one"'))
    .toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'term', value: '"the \'great\' one"' }]);
  expect(handler.tokenize('\'the "great" one\''))
    .toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'term', value: '\'the "great" one\'' }]);

  // Test "and" and "or"
  expect(handler.tokenize('forest and island'))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 0, type: 'term', value: 'forest' },
      { depth: 0, type: 'AND' },
      { depth: 0, type: 'term', value: 'island' },
    ]);
  expect(handler.tokenize('forest or island'))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 0, type: 'term', value: 'forest' },
      { depth: 0, type: 'OR' },
      { depth: 0, type: 'term', value: 'island' },
    ]);
  expect(handler.tokenize('forest and island or plains'))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 0, type: 'term', value: 'forest' },
      { depth: 0, type: 'AND' },
      { depth: 0, type: 'term', value: 'island' },
      { depth: 0, type: 'OR' },
      { depth: 0, type: 'term', value: 'plains' },
    ]);
  expect(handler.tokenize('and')).toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'AND' }]);
  expect(handler.tokenize('and ')).toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'AND' }]);
  expect(handler.tokenize(' and')).toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'AND' }]);
  expect(handler.tokenize('or')).toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'OR' }]);
  expect(handler.tokenize('or ')).toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'OR' }]);
  expect(handler.tokenize(' or')).toStrictEqual<FilterQueryToken[]>([{ depth: 0, type: 'OR' }]);

  // Test "and" and "or" with quotes
  expect(handler.tokenize('forest and "island or plains"'))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 0, type: 'term', value: 'forest' },
      { depth: 0, type: 'AND' },
      { depth: 0, type: 'term', value: '"island or plains"' },
    ]);
  expect(handler.tokenize('\'and\' and or "or" a"n"d ""or'))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 0, type: 'term', value: '\'and\'' },
      { depth: 0, type: 'AND' },
      { depth: 0, type: 'OR' },
      { depth: 0, type: 'term', value: '"or"' },
      { depth: 0, type: 'term', value: 'a"n"d' },
      { depth: 0, type: 'term', value: '""or' },
    ]);

  // Test "and" and "or" with mismatched quotes
  expect(handler.tokenize('forest and "island or plains'))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 0, type: 'term', value: 'forest' },
      { depth: 0, type: 'AND' },
      { depth: 0, type: 'term', value: '"island' },
      { depth: 0, type: 'OR' },
      { depth: 0, type: 'term', value: 'plains' },
    ]);
  expect(handler.tokenize('forest and \'island \'or plains'))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 0, type: 'term', value: 'forest' },
      { depth: 0, type: 'AND' },
      { depth: 0, type: 'term', value: '\'island \'or' },
      { depth: 0, type: 'term', value: 'plains' },
    ]);

  // Test "and" and "or" at start and end of query
  expect(handler.tokenize('and forest or island and'))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 0, type: 'AND' },
      { depth: 0, type: 'term', value: 'forest' },
      { depth: 0, type: 'OR' },
      { depth: 0, type: 'term', value: 'island' },
      { depth: 0, type: 'AND' },
    ]);
  expect(handler.tokenize('or forest and island or'))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 0, type: 'OR' },
      { depth: 0, type: 'term', value: 'forest' },
      { depth: 0, type: 'AND' },
      { depth: 0, type: 'term', value: 'island' },
      { depth: 0, type: 'OR' },
    ]);

  // Test multiple spaces
  expect(handler.tokenize('  forest   and   island  '))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 0, type: 'term', value: 'forest' },
      { depth: 0, type: 'AND' },
      { depth: 0, type: 'term', value: 'island' },
    ]);

  // Test ( and )
  expect(handler.tokenize('(forest and island) or plains'))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 1, type: 'LPAREN' },
      { depth: 1, type: 'term', value: 'forest' },
      { depth: 1, type: 'AND' },
      { depth: 1, type: 'term', value: 'island' },
      { depth: 1, type: 'RPAREN' },
      { depth: 0, type: 'OR' },
      { depth: 0, type: 'term', value: 'plains' },
    ]);
  expect(handler.tokenize('(forest and (island or plains))'))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 1, type: 'LPAREN' },
      { depth: 1, type: 'term', value: 'forest' },
      { depth: 1, type: 'AND' },
      { depth: 2, type: 'LPAREN' },
      { depth: 2, type: 'term', value: 'island' },
      { depth: 2, type: 'OR' },
      { depth: 2, type: 'term', value: 'plains' },
      { depth: 2, type: 'RPAREN' },
      { depth: 1, type: 'RPAREN' },
    ]);
  expect(handler.tokenize('(((forest)and)(island))'))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 1, type: 'LPAREN' },
      { depth: 2, type: 'LPAREN' },
      { depth: 3, type: 'LPAREN' },
      { depth: 3, type: 'term', value: 'forest' },
      { depth: 3, type: 'RPAREN' },
      { depth: 2, type: 'AND' },
      { depth: 2, type: 'RPAREN' },
      { depth: 2, type: 'LPAREN' },
      { depth: 2, type: 'term', value: 'island' },
      { depth: 2, type: 'RPAREN' },
      { depth: 1, type: 'RPAREN' },
    ]);

  // Mismatched parentheses
  expect(handler.tokenize('(forest and island or plains'))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 1, type: 'LPAREN' },
      { depth: 1, type: 'term', value: 'forest' },
      { depth: 1, type: 'AND' },
      { depth: 1, type: 'term', value: 'island' },
      { depth: 1, type: 'OR' },
      { depth: 1, type: 'term', value: 'plains' },
    ]);
  expect(handler.tokenize('forest and island) or plains)'))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 2, type: 'term', value: 'forest' },
      { depth: 2, type: 'AND' },
      { depth: 2, type: 'term', value: 'island' },
      { depth: 2, type: 'RPAREN' },
      { depth: 1, type: 'OR' },
      { depth: 1, type: 'term', value: 'plains' },
      { depth: 1, type: 'RPAREN' },
    ]);
  expect(handler.tokenize('((forest and) island or plains)'))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 1, type: 'LPAREN' },
      { depth: 2, type: 'LPAREN' },
      { depth: 2, type: 'term', value: 'forest' },
      { depth: 2, type: 'AND' },
      { depth: 2, type: 'RPAREN' },
      { depth: 1, type: 'term', value: 'island' },
      { depth: 1, type: 'OR' },
      { depth: 1, type: 'term', value: 'plains' },
      { depth: 1, type: 'RPAREN' },
    ]);

  // Quotes with parentheses
  expect(handler.tokenize('"(forest and island) or plains"'))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 0, type: 'term', value: '"(forest and island) or plains"' },
    ]);
  expect(handler.tokenize('\'(forest and island) or plains\''))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 0, type: 'term', value: '\'(forest and island) or plains\'' },
    ]);
  expect(handler.tokenize('"(forest and island) or plains" and forest'))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 0, type: 'term', value: '"(forest and island) or plains"' },
      { depth: 0, type: 'AND' },
      { depth: 0, type: 'term', value: 'forest' },
    ]);
  expect(handler.tokenize('(")) hello" and ( yes )( or "(island)" ) )'))
    .toStrictEqual<FilterQueryToken[]>([
      { depth: 1, type: 'LPAREN' },
      { depth: 1, type: 'term', value: '")) hello"' },
      { depth: 1, type: 'AND' },
      { depth: 2, type: 'LPAREN' },
      { depth: 2, type: 'term', value: 'yes' },
      { depth: 2, type: 'RPAREN' },
      { depth: 2, type: 'LPAREN' },
      { depth: 2, type: 'OR' },
      { depth: 2, type: 'term', value: '"(island)"' },
      { depth: 2, type: 'RPAREN' },
      { depth: 1, type: 'RPAREN' },
    ]);
});
