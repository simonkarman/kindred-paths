export const pipColors = new Map<string, string>([
  ['w', 'rgb(236, 230, 179)'],
  ['u', 'rgb(171, 225, 250)'],
  ['b', 'rgb(204, 195, 192)'],
  ['r', 'rgb(249, 172, 144)'],
  ['g', 'rgb(156, 212, 176)'],
]);
const colorlessPip = 'rgb(238, 236, 235)';

function colorFor(char: string): string {
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

function ManaSymbol({ symbol }: { symbol: string }) {
  if (symbol.includes('/')) {
    const [colorA, colorB] = symbol.split('/');
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-navy-300 text-center text-[0.55rem] font-bold uppercase text-navy-900"
        style={{ background: `linear-gradient(135deg, ${colorFor(colorA)} 50%, ${colorFor(colorB)} 50%)` }}
      >
        {colorA}/{colorB}
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-navy-300 text-center text-xs font-bold uppercase text-navy-900"
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
