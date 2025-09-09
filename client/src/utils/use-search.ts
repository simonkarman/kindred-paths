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
        const type = searchTerm.slice(searchTerm.indexOf(':') + 1);
        return [
          ...card.types,
          ...(card.subtypes ?? []),
          ...(card.supertype ? [card.supertype] : []),
        ].some(t => t.toLowerCase() === type);
      }

      // If search term starts with "rarity:", filter by rarity
      if (searchTerm.startsWith('rarity:') || searchTerm.startsWith('r:')) {
        const rarity = searchTerm.slice(searchTerm.indexOf(':') + 1);
        return card.rarity.toLowerCase() === rarity;
      }

      // If search term starts with "color:", filter by color
      if (searchTerm.startsWith('color:') || searchTerm.startsWith('c:')) {
        const color = searchTerm.slice(searchTerm.indexOf(':') + 1);
        if (color === 'colorless' || color === 'c') {
          return card.color().length === 0;
        }
        if (color === 'multicolor' || color === 'm') {
          return card.color().length > 1;
        }
        // Convert single character to full color name
        const c = wubrg.includes(color as CardColorCharacter)
          ? colorToLong(color as CardColorCharacter)
          : color;
        return card.color().includes(c as CardColor);
      }

      // If search term starts wiht "manavalue:", filter by mana value
      if (searchTerm.startsWith('manavalue:') || searchTerm.startsWith('mv:')) {
        const mvStr = searchTerm.slice(searchTerm.indexOf(':') + 1);
        const mv = Number(mvStr);
        if (isNaN(mv)) return false;
        return card.manaValue() === mv;
      }

      // If search term starts with "pt:", filter by power/toughness
      if (searchTerm.startsWith('pt:')) {
        const pt = searchTerm.slice(searchTerm.indexOf(':') + 1);
        if (!card.pt) return false;
        return `${card.pt.power}/${card.pt.toughness}` === pt;
      }

      // Default scenario: check if card name includes the search term
      return card.name.toLowerCase().includes(searchTerm)
    });
  });
}
