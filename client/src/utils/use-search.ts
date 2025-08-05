import { useLocalStorageState } from '@/utils/use-local-storage-state';
import { SerializedCard } from 'kindred-paths';

export const useSearch = () => useLocalStorageState('search', '');

export const filterCardsBasedOnSearch = (cards: SerializedCard[], searchText: string): SerializedCard[] => {
  searchText = searchText.trim();
  if (!searchText || searchText === '') return cards;

  const searchTerms = searchText.toLowerCase().split(/\s+/);

  return cards.filter(card => {
    return searchTerms.every(searchTerm => {
      // If search term starts with "type:", filter by type
      if (searchTerm.startsWith('type:')) {
        const type = searchTerm.slice(5);
        return [
          ...card.types,
          ...(card.subtypes ?? []),
          ...(card.supertype ? [card.supertype] : []),
        ].some(t => t.toLowerCase() === type);
      }

      // If search term starts with "rarity:", filter by rarity
      if (searchTerm.startsWith('rarity:')) {
        const rarity = searchTerm.slice(7);
        return card.rarity.toLowerCase() === rarity;
      }

      // Default scenario: check if card name includes the search term
      return card.name.toLowerCase().includes(searchTerm)
    });
  });
}
