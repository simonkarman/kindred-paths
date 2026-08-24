export const pipColors = new Map<string, string>([
  ['w', 'rgb(236, 230, 179)'],
  ['u', 'rgb(171, 225, 250)'],
  ['b', 'rgb(204, 195, 192)'],
  ['r', 'rgb(249, 172, 144)'],
  ['g', 'rgb(156, 212, 176)'],
]);
const colorlessPip = 'rgb(238, 236, 235)';
const colorLetters = new Set(['w', 'u', 'b', 'r', 'g']);

export function colorFor(char: string): string {
  return pipColors.get(char.toLowerCase()) ?? colorlessPip;
}

function parseManaSymbols(cost: string): string[] {
  const symbols: string[] = [];
  const regex = /\{([^}]+)\}/g;
  let match;
  while ((match = regex.exec(cost)) !== null) {
    symbols.push(match[1].toLowerCase());
  }
  return symbols;
}

/**
 * Splits a hybrid-looking symbol (e.g. "b/r", "2b", "wb") into its two parts.
 * Returns null if the symbol isn't a recognized hybrid shape.
 */
function splitHybrid(symbol: string): [string, string] | null {
  if (symbol.includes('/')) {
    const [a, b] = symbol.split('/');
    return [a, b];
  }
  if (symbol.length === 2) {
    const [a, b] = symbol;
    // shorthand generic/color hybrid, e.g. "2b" -> generic 2 or black
    if (/\d/.test(a) && colorLetters.has(b)) return [a, b];
    // shorthand color/color hybrid, e.g. "wb" -> white or black
    if (colorLetters.has(a) && colorLetters.has(b)) return [a, b];
  }
  return null;
}

export function ManaSymbol({ symbol, size = 'md' }: { symbol: string; size?: 'sm' | 'md' }) {
  const dimensions =
    size === 'sm'
      ? 'h-[1.45em] w-[1.45em] mx-px align-[0.04em] text-[0.78em]'
      : 'h-5 w-5 text-xs';
  const hybrid = splitHybrid(symbol);
  if (hybrid) {
    const [colorA, colorB] = hybrid;
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full border border-navy-300 text-center font-bold uppercase leading-none text-navy-900 ${dimensions} ${size === 'sm' ? 'text-[0.62em]' : ''}`}
        style={{ background: `linear-gradient(135deg, ${colorFor(colorA)} 50%, ${colorFor(colorB)} 50%)` }}
      >
        {colorA}/{colorB}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border border-navy-300 text-center font-bold uppercase leading-none text-navy-900 ${dimensions}`}
      style={{ backgroundColor: colorFor(symbol) }}
    >
      {symbol === 'c' ? '◇' : symbol}
    </span>
  );
}

export function ManaCost({ cost }: { cost: string }) {
  const symbols = parseManaSymbols(cost);
  if (symbols.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {symbols.map((symbol, index) => (
        <ManaSymbol key={index} symbol={symbol} />
      ))}
    </span>
  );
}
