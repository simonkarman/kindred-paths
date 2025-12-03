import { InputHeader } from '@/components/editor/input-header';
import { useCallback, useState } from 'react';
import { useSetNameFromSearch } from '@/utils/use-search';
import { CollectorNumberInfo, getOrganizeCollectorNumbers } from '@/utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCompass, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { CollectorNumberOverview } from '@/components/collector-number-overview';

function getFirstAvailableCollectorNumber(
  renderedTypeLine: string,
  info: CollectorNumberInfo[]
): number {
  // Step 1: Sort by collector number
  const sorted = [...info].sort((a, b) => a.collectorNumber - b.collectorNumber);

  // Step 2: Find the info with the longest matching prefix
  let bestMatch: CollectorNumberInfo | null = null;
  let longestMatchLength = 0;

  for (const item of info) {
    for (const face of item.faces) {
      // Calculate the length of matching prefix
      let matchLength = 0;
      const minLength = Math.min(face.renderedTypeLine.length, renderedTypeLine.length);

      for (let i = 0; i < minLength; i++) {
        if (face.renderedTypeLine[i] === renderedTypeLine[i]) {
          matchLength++;
        } else {
          break;
        }
      }

      // Update best match if this is longer
      if (matchLength > longestMatchLength) {
        longestMatchLength = matchLength;
        bestMatch = item;
      }
    }
  }

  // If no match found, start from 1
  if (!bestMatch) {
    const existingNumbers = new Set(info.map(i => i.collectorNumber));
    let candidate = 1;
    while (existingNumbers.has(candidate)) {
      candidate++;
    }
    return candidate;
  }

  // Step 3: Find first available number after the matched collector number
  const existingNumbers = new Set(sorted.map(i => i.collectorNumber));
  let candidate = bestMatch.collectorNumber + 1;

  while (existingNumbers.has(candidate)) {
    candidate++;
  }

  return candidate;
}

export const CardCollectorNumberInput = (props: {
  collectorNumber: number,
  setCollectorNumber: (value: number) => void,
  cardId: string,
  renderedTypeLine: string,
  getErrorMessage: () => string | undefined,
  isChanged: boolean,
  revert: () => void,
}) => {
  const { collectorNumber, setCollectorNumber, renderedTypeLine, cardId } = props;

  const [showCollectorNumbers, setShowCollectorNumbers] = useState(false);
  const [collectorNumbers, setCollectorNumbers] = useState<CollectorNumberInfo[]>([]);
  const [fetching, setFetching] = useState(false);

  const setNameFromSearch = useSetNameFromSearch();
  const update = useCallback(async (autoAssign: boolean) => {
    setFetching(true);
    try {
      const collectorNumbers = (await getOrganizeCollectorNumbers(setNameFromSearch ? `set:${setNameFromSearch}` : ''))
        .filter(c => c.cardId !== cardId);
      setCollectorNumbers(collectorNumbers);
      if (autoAssign) {
        const n = getFirstAvailableCollectorNumber(renderedTypeLine, collectorNumbers);
        setCollectorNumber(n);
      }
    } finally {
      setFetching(false);
    }
  }, [setNameFromSearch, renderedTypeLine, setCollectorNumber, cardId]);

  return <div className="space-y-1">
    <InputHeader propertyName="collector number" isChanged={props.isChanged} revert={props.revert} />
    <input
      id="cardCollectorNumber"
      type="number"
      min="1"
      value={collectorNumber}
      onChange={(e) => setCollectorNumber(parseInt(e.target.value, 10))}
      className="w-full bg-white px-1 py-0.5 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      disabled={fetching}
    />
    {props.getErrorMessage() && (
      <p className="text-red-700 text-xs">
        {props.getErrorMessage()}
      </p>
    )}
    <div className="flex justify-between items-center">
      <div>
        <button
          className="text-xs text-zinc-500 hover:text-blue-600 cursor-pointer"
          onClick={() => {
            update(false).then(() => setShowCollectorNumbers(b => !b));
          }}
        >
          {collectorNumbers.length > 0 ? (
            `Found ${collectorNumbers.length} cards ${setNameFromSearch ? `in 'set:${setNameFromSearch}'.` : 'in collection.'}`
          ) : (
            fetching ? 'Fetching collector numbers...' : 'Show collector numbers overview.'
          )}
        </button>
      </div>
      <div className="hover:text-blue-600 text-zinc-500 flex gap-2 items-center">
        <label
          htmlFor="cardCollectorNumberAutoAssign"
        >
          <span className="hover:underline text-xs cursor-pointer">
            Auto assign collector number
          </span>
        </label>
        <button
          id="cardCollectorNumberAutoAssign"
          type="button"
          onClick={() => update(true)}
          disabled={fetching}
          className="text-zinc-500 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title={`Auto assign collector number`}
        >
          <FontAwesomeIcon
            icon={fetching ? faSpinner : faCompass}
            className={fetching ? "animate-spin" : ""}
          />
        </button>
      </div>
    </div>
    {showCollectorNumbers && collectorNumbers.length > 0 && (
      <div>
        <CollectorNumberOverview
          selectedCollectorNumber={collectorNumber}
          setSelectedCollectorNumber={setCollectorNumber}
          collectorNumbers={collectorNumbers}
        />
        <button
          type="button"
          className="mt-2 text-xs text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded cursor-pointer"
          onClick={() => setShowCollectorNumbers(false)}
        >
          (Close)
        </button>
      </div>
    )}
  </div>;
}
