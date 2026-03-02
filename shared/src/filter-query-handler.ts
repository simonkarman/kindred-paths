export type FilterQueryToken =
  | { depth: number, type: 'term'; value: string }
  | { depth: number, type: 'AND' }
  | { depth: number, type: 'OR' }
  | { depth: number, type: 'LPAREN' }
  | { depth: number, type: 'RPAREN' };

type MixedToken =
  | FilterQueryToken
  | { depth: number; type: 'resolved'; value: boolean };

const isWhitespace = (char: string) => char === ' ' || char === '\t' || char === '\u00a0';

export class FilterQueryHandler {

  tokenize(query: string): FilterQueryToken[] {
    const tokens: FilterQueryToken[] = [];
    let i = 0;
    let depth = 0;
    while (i < query.length) {
      // Skip whitespace
      if (isWhitespace(query[i])) {
        i += 1;
        continue;
      }

      // Parentheses
      if (query[i] === '(') {
        depth += 1;
        tokens.push({ depth, type: 'LPAREN' });
        i += 1;
        continue;
      }
      if (query[i] === ')') {
        tokens.push({ depth, type: 'RPAREN' });
        depth -= 1;
        i += 1;
        continue;
      }

      // Read a full token until next whitespace or paren (respecting quotes)
      let isQuoted = false;
      let word = '';
      while (i < query.length && !isWhitespace(query[i]) && query[i] !== '(' && query[i] !== ')') {

        // Consume everything inside quotes literally, if there is a closing quote later in the string
        if ((query[i] === '"' || query[i] === '\'') && query.lastIndexOf(query[i]) > i) {
          const quoteChar = query[i];
          isQuoted = true;

          // Including the opening quote
          word += quoteChar;
          i += 1;

          // Consume until the matching closing quote
          while (i < query.length && query[i] !== quoteChar) {
            word += query[i];
            i += 1;
          }

          // Immediately consume the closing quote
          if (query[i] === quoteChar) {
            word += quoteChar;
            i += 1;
          }
        } else {
          word += query[i];
          i += 1;
        }
      }

      if (!word) continue;

      if (!isQuoted) {
        if (word === 'and') {
          tokens.push({ depth, type: 'AND' });
          continue;
        } else if (word === 'or') {
          tokens.push({ depth, type: 'OR' });
          continue;
        }
      }
      tokens.push({ depth, type: 'term', value: word });
    }

    // If there are unmatched parentheses, increase the depth of all tokens so that they are effectively wrapped in enough parentheses to be valid
    if (depth < 0) {
      return tokens.map(t => ({ ...t, depth: t.depth - depth }));
    }
    return tokens;
  }

  resolve(
    query: FilterQueryToken[],
    termResolver: (term: string) => boolean,
  ): boolean {
    if (query.length === 0) return true;

    const maxDepth = Math.max(...query.map((t) => t.depth));
    const tokens: MixedToken[] = [...query];

    // Process groups inside-out
    for (let depth = maxDepth; depth >= 1; depth--) {
      let i = 0;
      while (i < tokens.length) {
        if (tokens[i].type === 'LPAREN' && tokens[i].depth === depth) {
          const start = i;
          let end = i + 1;
          while (
            end < tokens.length &&
            !(tokens[end].type === 'RPAREN' && tokens[end].depth === depth)
          ) {
            end += 1;
          }
          const inner = tokens.slice(start + 1, end) as MixedToken[];
          const result = this.evaluateFlat(inner, termResolver);
          tokens.splice(start, end - start + 1, {
            depth: depth - 1,
            type: 'resolved',
            value: result,
          });
        } else {
          i += 1;
        }
      }
    }

    return this.evaluateFlat(tokens, termResolver);
  }

  private evaluateFlat(
    tokens: ({ depth: number; type: string; value?: any })[],
    termResolver: (term: string) => boolean,
  ): boolean {
    // Build items with implicit AND between adjacent values
    type Item = { kind: 'value'; v: boolean } | { kind: 'op'; op: 'AND' | 'OR' };
    const items: Item[] = [];
    let lastWasValue = false;

    for (const token of tokens) {
      if (token.type === 'term' || token.type === 'resolved') {
        if (lastWasValue) {
          items.push({ kind: 'op', op: 'AND' }); // implicit AND
        }
        const v =
          token.type === 'resolved'
            ? (token.value as boolean)
            : termResolver(token.value as string);
        items.push({ kind: 'value', v });
        lastWasValue = true;
      } else if (token.type === 'AND' || token.type === 'OR') {
        if (!lastWasValue) {
          // Leading op or consecutive op: skip (or replace previous op)
          if (items.length > 0 && items[items.length - 1].kind === 'op') {
            items[items.length - 1] = { kind: 'op', op: token.type as 'AND' | 'OR' };
          }
          // If items is empty, just drop it (leading operator)
        } else {
          items.push({ kind: 'op', op: token.type as 'AND' | 'OR' });
          lastWasValue = false;
        }
      }
    }

    // Drop trailing operators if present
    while (items.length > 0 && items[items.length - 1].kind === 'op') {
      items.pop();
    }

    if (items.length === 0) return true;

    // Evaluate AND before OR
    const orValues: boolean[] = [];
    let current = (items[0] as { kind: 'value'; v: boolean }).v;

    for (let i = 1; i < items.length; i += 2) {
      const op = (items[i] as { kind: 'op'; op: 'AND' | 'OR' }).op;
      const next = (items[i + 1] as { kind: 'value'; v: boolean }).v;
      if (op === 'AND') {
        current = current && next;
      } else {
        orValues.push(current);
        current = next;
      }
    }
    orValues.push(current);

    return orValues.some(Boolean);
  }
}
