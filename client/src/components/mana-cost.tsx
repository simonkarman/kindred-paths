import { singleCharacterToTypographyColor, typographyColors } from '@/utils/typography';

/**
 * Parse a rendered mana cost string into individual mana symbols.
 * E.g. "{2}{w/u}{b}" -> ["2", "w/u", "b"]
 */
function parseManaSymbols(cost: string): string[] {
  const symbols: string[] = [];
  const regex = /\{([^}]+)\}/g;
  let match;
  while ((match = regex.exec(cost)) !== null) {
    symbols.push(match[1].toLowerCase());
  }
  return symbols;
}

function ManaSymbol(props: { symbol: string }) {
  const { symbol } = props;

  // Check if this is a hybrid mana symbol (contains '/')
  if (symbol.includes('/')) {
    const [colorA, colorB] = symbol.split('/');
    const bgA = typographyColors.get(singleCharacterToTypographyColor(colorA))!;
    const bgB = typographyColors.get(singleCharacterToTypographyColor(colorB))!;
    return (
      <span
        className="inline-block text-xs uppercase font-bold border border-zinc-500 py-0.5 px-1 mr-0.25 rounded-full text-center"
        style={{
          background: `linear-gradient(135deg, ${bgA.main} 50%, ${bgB.main} 50%)`,
        }}
      >
        <span style={{ fontSize: '0.55rem' }}>{colorA}/{colorB}</span>
      </span>
    );
  }

  // Regular (non-hybrid) mana symbol
  const backgroundColor = typographyColors.get(singleCharacterToTypographyColor(symbol))!;
  return (
    <span
      className="inline-block text-xs uppercase font-bold border border-zinc-500 py-0.5 px-1 mr-0.25 rounded-full text-center"
      style={{
        backgroundColor: backgroundColor.main,
      }}
    >
      {symbol === 'c' ? '◇' : symbol}
    </span>
  );
}

export function ManaCost(props: { cost: string }) {
  const symbols = parseManaSymbols(props.cost);

  if (symbols.length === 0) {
    return <span className="text-gray-400">No mana cost</span>;
  }

  return symbols.map((symbol, index) => (
    <ManaSymbol key={index} symbol={symbol} />
  ));
}
