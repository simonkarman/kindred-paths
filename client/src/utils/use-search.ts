import { useLocalStorageState } from '@/utils/use-local-storage-state';
import { normalizeSortOptions, SortOptions } from 'kindred-paths';

export const useSearch = (scope: string, initial?: string) => useLocalStorageState(`${scope}/search`, initial ?? '');
export const useSortOptions = (scope: string) => {
  const defaultOptions: SortOptions = { keys: [{ key: 'collector-number', direction: 'asc' }] };
  const [raw, setRaw] = useLocalStorageState<unknown>(`${scope}/sort`, defaultOptions);
  const sortOptions = normalizeSortOptions(raw);
  return [sortOptions, (value: SortOptions | ((prev: SortOptions) => SortOptions)) => {
    if (value instanceof Function) {
      setRaw((prev: unknown) => value(normalizeSortOptions(prev)));
    } else {
      setRaw(value);
    }
  }] as const;
};

const useValueFromHomeSearch = (keys: string[]): string | undefined => {
  // TODO: this could result in multiple values if the user specifies the same key multiple times
  //       e.g. "deck:foo deck:bar" would return "foo" currently, but maybe should return undefined or an array of both values
  const [searchText] = useSearch('home');
  const searchTerms = searchText.trim().toLowerCase().split(/\s+/);
  for (const term of searchTerms) {
    if (keys.some(key => term.startsWith(`${key}:`))) {
      const value = term.slice(term.indexOf(':') + 1).trim();
      if (value.length > 0) {
        return value;
      }
    }
    if (keys.some(key => term.startsWith(`${key}=`))) {
      const value = term.slice(term.indexOf('=') + 1).trim();
      if (value.length > 0) {
        return value;
      }
    }
  }
  return undefined;
};

export const useDeckNameFromSearch = () => useValueFromHomeSearch(['deck', 'd']);
export const useSetNameFromSearch = () => useValueFromHomeSearch(['set', 's'])?.toUpperCase();

export const replaceKeysInSearchText = (searchText: string, keys: string[], value: string | undefined) => {
  const searchTerms = searchText.trim().toLowerCase().split(/\s+/).filter(term => {
    return !keys.some(key => term.startsWith(`${key}:`) || term.startsWith(`${key}=`));
  });
  if (value && value.trim().length > 0) {
    searchTerms.push(`${keys[0]}:${value.trim()}`);
  }
  return searchTerms.join(' ');
}
