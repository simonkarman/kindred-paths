import { useLocalStorageState } from '@/utils/use-local-storage-state';
import { Card, CardColor, CardColorCharacter, colorToLong, SerializedCard, wubrg } from 'kindred-paths';

export const useSearch = () => useLocalStorageState('search', '');

export const filterCardsBasedOnSearch = (cards: SerializedCard[], searchText: string): SerializedCard[] => {
  searchText = searchText.trim();
  if (!searchText || searchText === '') return cards;

  const searchTerms = searchText.toLowerCase().split(/\s+/);

  return cards.filter(_card => {
    const card = new Card(_card);
    return searchTerms.every(searchTerm => {
      // If search term starts with "type:", filter by type
      if (searchTerm.startsWith('type:') || searchTerm.startsWith('t:')) {
        const typeNeedle = searchTerm.slice(searchTerm.indexOf(':') + 1).toLowerCase();
        return [
          ...card.types,
          ...(card.subtypes ?? []),
          ...(card.supertype ? [card.supertype] : []),
        ].some(t => t.startsWith(typeNeedle));
      }

      // If search term starts with "rarity:", filter by rarity
      if (searchTerm.startsWith('rarity:') || searchTerm.startsWith('r:')) {
        const rarityNeedle = searchTerm.slice(searchTerm.indexOf(':') + 1).toLowerCase();
        return rarityNeedle.length === 1
          ? card.rarity[0] === rarityNeedle[0]
          : card.rarity === rarityNeedle;
      }

      // If search term starts with "color:", filter by color
      if (searchTerm.startsWith('color:') || searchTerm.startsWith('c:')) {
        const colorNeedle = searchTerm.slice(searchTerm.indexOf(':') + 1).toLowerCase();
        if (colorNeedle === 'colorless' || colorNeedle === 'c') {
          return card.color().length === 0;
        }
        if (colorNeedle === 'multicolor' || colorNeedle === 'm') {
          return card.color().length > 1;
        }
        // Convert single character to full color name
        const c = wubrg.includes(colorNeedle as CardColorCharacter)
          ? colorToLong(colorNeedle as CardColorCharacter)
          : colorNeedle;
        return card.color().includes(c as CardColor);
      }

      // If search term starts wiht "manavalue:", filter by mana value
      if (searchTerm.startsWith('manavalue:') || searchTerm.startsWith('mv:')) {
        const manaValueNeedle = Number(searchTerm.slice(searchTerm.indexOf(':') + 1));
        if (isNaN(manaValueNeedle)) return false;
        return card.manaValue() === manaValueNeedle;
      }

      // If search term starts with "pt:", filter by power/toughness
      if (searchTerm.startsWith('pt:')) {
        const ptNeedle = searchTerm.slice(searchTerm.indexOf(':') + 1);
        if (!card.pt) return false;
        if (ptNeedle.startsWith('/')) {
          // If only toughness is specified (e.g. "/3"), match any power with that toughness
          const toughness = ptNeedle.slice(1);
          return card.pt.toughness.toString() === toughness;
        }
        if (ptNeedle.endsWith('/')) {
          // If only power is specified (e.g. "3/"), match that power with any toughness
          const power = ptNeedle.slice(0, -1);
          return card.pt.power.toString() === power;
        }
        return `${card.pt.power}/${card.pt.toughness}` === ptNeedle;
      }

      // If search terms starts with "deck:", filter by deck tag
      if (searchTerm.startsWith('deck:') || searchTerm.startsWith('d:')) {
        const deckNameNeedle = searchTerm.slice(searchTerm.indexOf(':') + 1).toLowerCase();
        const deckTag = card.getTagAsString('deck');
        return deckTag !== undefined && deckTag.toLowerCase().startsWith(deckNameNeedle);
      }

      // Default scenario: check if card name includes the search term
      return card.name.toLowerCase().includes(searchTerm)
    });
  });
}
