import { SerializedCard } from './serialized-card';
import { Card } from './card';
import { CardColor, CardColorCharacter, colorToLong, wubrg } from './colors';
import { filterDefinitions } from './filter-definitions';

const check = (
  keys: string[],
  predicate: (needle: string) => boolean,
): (searchTerm: string) => { result: boolean } | undefined => {
  return (searchTerm: string) => {
    for (const key of keys) {
      // Check for both "key:needle" and "key!:needle" (negation)
      let needle: string | undefined = undefined;
      let negate = false;
      if (searchTerm.startsWith(key + '!:') || searchTerm.startsWith(key + '!=')) {
        needle = searchTerm.slice(key.length + 2).toLowerCase();
        negate = true;
      } else if (searchTerm.startsWith(key + ':') || searchTerm.startsWith(key + '=')) {
        needle = searchTerm.slice(key.length + 1).toLowerCase();
      } else {
        // No match, try next key
        continue;
      }

      // If no needle is provided, return undefined to indicate no match
      if (needle === undefined || needle.length === 0) {
        return undefined;
      }

      // Apply the predicate to the needle
      const result = predicate(needle);

      // Return the result, applying negation if needed
      return { result: negate ? !result : result };
    }
  };
};

/**
 * Validate a number requirement string against an actual number.
 * Supports exact match (e.g. "3"), greater than or equal (e.g. "3+"), and less than or equal (e.g. "3-").
 *
 * @param requirement The requirement string to validate against.
 * @param actual The actual number to validate.
 *
 * @returns True if the actual number satisfies the requirement, false otherwise.
 */
const validateNumberRequirement = (requirement: string, actual: number) => {
  let operator = (a: number, b: number) => a === b;
  let sliceEnd = 0;

  // Check if ends with + or - for greater than or less than comparisons
  if (requirement.endsWith('+')) {
    operator = (a, b) => a >= b;
    sliceEnd = 1;
  } else if (requirement.endsWith('-')) {
    operator = (a, b) => a <= b;
    sliceEnd = 1;
  }

  // Otherwise, check for exact match
  const num = Number(requirement.slice(0, requirement.length - sliceEnd));
  if (isNaN(num)) return false;
  return operator(actual, num);
};

export const filterCardsBasedOnSearch = (cards: SerializedCard[], searchQuery: string): SerializedCard[] => {
  searchQuery = searchQuery.trim();
  if (!searchQuery || searchQuery === '') return cards;

  const searchTerms = searchQuery.toLowerCase().split(/\s+/);

  return cards.filter(_card => {
    return new Card(_card).faces.some(cardFace => {
      const card = cardFace.card;

      // Build checks dynamically from filter definitions
      const getFilterKeys = (primaryKey: string) =>
        filterDefinitions.find(def => def.keys[0] === primaryKey)?.keys ?? [];

      const checks = [
        check(getFilterKeys('layout'), layoutNeedle => card.layout.id.startsWith(layoutNeedle)),

        check(getFilterKeys('type'), typeNeedle => [
          ...(card.isToken ? ['token'] : []),
          ...cardFace.types,
          ...(cardFace.subtypes ?? []),
          ...(cardFace.supertype ? [cardFace.supertype] : []),
        ].some(t => t.startsWith(typeNeedle))),

        check(getFilterKeys('rarity'), rarityNeedle => rarityNeedle.length === 1
          ? card.rarity[0] === rarityNeedle[0]
          : card.rarity === rarityNeedle),

        check(getFilterKeys('color'), colorNeedle => {
          if (colorNeedle === 'colorless' || colorNeedle === 'c') {
            return cardFace.color().length === 0;
          }
          if (colorNeedle === 'multicolor' || colorNeedle === 'multi' || colorNeedle === 'm') {
            return cardFace.color().length > 1;
          }
          // Convert single character to full color name
          const c = wubrg.includes(colorNeedle as CardColorCharacter)
            ? colorToLong(colorNeedle as CardColorCharacter)
            : colorNeedle;
          return cardFace.color().includes(c as CardColor);
        }),

        check(getFilterKeys('color-identity'), colorNeedle => {
          if (colorNeedle === 'colorless' || colorNeedle === 'c') {
            return cardFace.colorIdentity().length === 0;
          }
          if (colorNeedle === 'multicolor' || colorNeedle === 'multi' || colorNeedle === 'm') {
            return cardFace.colorIdentity().length > 1;
          }
          // Convert single character to full color name
          const c = wubrg.includes(colorNeedle as CardColorCharacter)
            ? colorToLong(colorNeedle as CardColorCharacter)
            : colorNeedle;
          return cardFace.colorIdentity().includes(c as CardColor);
        }),

        check(getFilterKeys('producible-color'), colorNeedle => {
          if (colorNeedle === 'none' || colorNeedle === 'n') {
            return cardFace.producibleColors().length === 0;
          }
          if (colorNeedle === 'multicolor' || colorNeedle === 'multi' || colorNeedle === 'm') {
            return cardFace.producibleColors().length > 1;
          }
          // Convert single character to full color name
          const c = wubrg.includes(colorNeedle as CardColorCharacter)
            ? colorToLong(colorNeedle as CardColorCharacter)
            : colorNeedle;
          return cardFace.producibleColors().includes(c as CardColor);
        }),

        check(getFilterKeys('manavalue'), manaValueNeedle => {
          return validateNumberRequirement(manaValueNeedle, cardFace.manaValue());
        }),

        check(getFilterKeys('pt'), ptNeedle => {
          const pt: { power: number, toughness: number } | undefined = cardFace.pt ? {
            power: typeof cardFace.pt?.power === 'string' ? 0 : cardFace.pt.power,
            toughness: typeof cardFace.pt?.toughness === 'string' ? 0 : cardFace.pt.toughness,
          } : undefined;
          if (ptNeedle === 'yes' || ptNeedle === 'no') {
            // Match "pt:yes" for cards with power/toughness
            // Match "pt:no" for cards without power/toughness
            return ptNeedle === 'yes' ? !!pt : !pt;
          }
          if (!pt
            || !ptNeedle.includes('/')
            || ptNeedle.indexOf('/') !== ptNeedle.lastIndexOf('/')
          ) return false;
          if (ptNeedle.includes('n')) {
            // Match "n/n" for cards with equal power/toughness
            if (ptNeedle === 'n/n') {
              return pt.power === pt.toughness;
              // Match "n/n+" for cards with greater toughness than power
            } else if (ptNeedle === 'n/n+') {
              return pt.toughness > pt.power;
              // Match "n+/n" for cards with greater power than toughness
            } else if (ptNeedle === 'n+/n') {
              return pt.power > pt.toughness;
              // Match "n/n-" for cards with less toughness than power
            } else if (ptNeedle === 'n/n-') {
              return pt.toughness < pt.power;
              // Match "n-/n" for cards with less power than toughness
            } else if (ptNeedle === 'n-/n') {
              return pt.power < pt.toughness;
              // Match "n/n+2" for cards with toughness exactly equal to its than power by 2
            } else if (ptNeedle.startsWith('n/n+')) {
              const diff = Number(ptNeedle.slice(4));
              return !isNaN(diff) && (pt.toughness - pt.power) === diff;
              // Match "n+3/n" for cards with power exactly equal to its than toughness by 3
            } else if (ptNeedle.startsWith('n+') && ptNeedle.endsWith('/n')) {
              const diff = Number(ptNeedle.slice(2, -2));
              return !isNaN(diff) && (pt.power - pt.toughness) === diff;
              // Match "n/n-3" for cards with toughness exactly equal to its than power minus 3
            } else if (ptNeedle.startsWith('n/n-')) {
              const diff = Number(ptNeedle.slice(4));
              return !isNaN(diff) && (pt.power - pt.toughness) === diff;
              // Match "n-3/n" for cards with power exactly equal to its than toughness minus 3
            } else if (ptNeedle.startsWith('n-') && ptNeedle.endsWith('/n')) {
              const diff = Number(ptNeedle.slice(2, -2));
              return !isNaN(diff) && (pt.toughness - pt.power) === diff;
            }
            // Invalid format
            return false;
          }
          let toughnessRequirement = '0+', powerRequirement = '0+';
          if (ptNeedle.startsWith('/')) {
            // If only toughness is specified (e.g. "/3"), match any power with that toughness
            toughnessRequirement = ptNeedle.slice(1);
          } else if (ptNeedle.endsWith('/')) {
            // If only power is specified (e.g. "3/"), match that power with any toughness
            powerRequirement = ptNeedle.slice(0, -1);
          } else {
            // Otherwise, match exact power/toughness (e.g. "3/4", "2+/3-", etc)
            [powerRequirement, toughnessRequirement] = ptNeedle.split('/');
          }
          return validateNumberRequirement(toughnessRequirement, pt.toughness)
            && validateNumberRequirement(powerRequirement, pt.power);
        }),

        check(getFilterKeys('rules'), ruleNeedle => {
          return cardFace.rules.some(r => (r.variant === 'keyword' || r.variant === 'ability')
            && r.content.toLowerCase().includes(ruleNeedle));
        }),

        check(getFilterKeys('reminder'), ruleNeedle => {
          return cardFace.rules.some(r => (r.variant === 'card-type-reminder' || r.variant === 'inline-reminder')
            && r.content.toLowerCase().includes(ruleNeedle));
        }),

        check(getFilterKeys('flavor'), ruleNeedle => {
          return cardFace.rules.some(r => (r.variant === 'flavor')
            && r.content.toLowerCase().includes(ruleNeedle));
        }),

        check(getFilterKeys('deck'), deckNameNeedle => {
          const deckTag = card.getTagAsNumber(`deck/${deckNameNeedle}`);
          return deckTag !== undefined && deckTag >= 0;
        }),

        check(getFilterKeys('set'), setNameNeedle => {
          const setTag = card.getTagAsString('set');
          return setTag !== undefined && setTag.toLowerCase().startsWith(setNameNeedle);
        }),

        check(getFilterKeys('tag'), tagNeedle => {
          const [key, value] = tagNeedle.split('=').map(s => s.trim());
          if (value) {
            // If both key and value are specified (e.g. "tag:foo=bar"), match exact key and value on contains
            return card.tags !== undefined && Object.entries(card.tags).some(([k, v]) =>
              k.toLowerCase() === key && v !== undefined && v.toString().toLowerCase().includes(value),
            );
          } else {
            // If only key is specified (e.g. "tag:foo"), match any tag with that key
            return card.tags !== undefined && Object.keys(card.tags).some(k =>
              k.toLowerCase() === key,
            );
          }
        }),
      ];

      return searchTerms.every(searchTerm => {
        // First try all checks
        for (const check of checks) {
          const res = check(searchTerm);
          if (res) return res.result;
        }
        // If the search term ends with ":", it's an incomplete key, so fail the search
        if (searchTerm.endsWith(':')) return false;

        // If no checks matched, default to name includes
        return cardFace.name.toLowerCase().includes(searchTerm);
      });
    });
  });
};
