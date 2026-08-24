import { Fragment } from 'react';
import { ManaSymbol } from '@/components/mana-cost';

// Tokens that are markup rather than mana/tap/generic pips.
const markupTokens = new Set(['i', '/i', 'indent', '/indent', 'bullet', 'lns', '-']);

/**
 * Renders rules text that may contain CardConjurer-style inline tokens (e.g. "{1}", "{t}",
 * "{w}", "{b/r}") as small mana pips, and handles simple markup tokens ("{i}"/"{/i}" for
 * italics, "{lns}" as a plain space, "{-}"/"{bullet}" as separators).
 */
export function RulesText({ content }: { content: string }) {
  const parts = content.split(/(\{[^}]*\})/g).filter((part) => part.length > 0);
  const nodes: React.ReactNode[] = [];
  let italic = false;

  parts.forEach((part, index) => {
    const isToken = part.startsWith('{') && part.endsWith('}');
    if (!isToken) {
      nodes.push(italic ? <em key={index}>{part}</em> : <Fragment key={index}>{part}</Fragment>);
      return;
    }

    const token = part.slice(1, -1);
    const tokenLower = token.toLowerCase();

    if (markupTokens.has(tokenLower)) {
      switch (tokenLower) {
        case 'i':
          italic = true;
          break;
        case '/i':
          italic = false;
          break;
        case 'lns':
          nodes.push(<Fragment key={index}> </Fragment>);
          break;
        case '-':
        case 'bullet':
          nodes.push(<Fragment key={index}> — </Fragment>);
          break;
        case 'indent':
        case '/indent':
          // no visual effect in this context
          break;
      }
      return;
    }

    nodes.push(<ManaSymbol key={index} symbol={tokenLower} size="sm" />);
  });

  return <>{nodes}</>;
}
