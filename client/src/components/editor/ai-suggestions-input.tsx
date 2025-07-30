import { useState, ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWandMagicSparkles, faSpinner, faEye, faClose } from '@fortawesome/free-solid-svg-icons';
import { Card } from 'kindred-paths';
import { capitalize } from '@/utils/typography';
import { InputHeader } from '@/components/editor/input-header';

export function AiSuggestionsInput<Suggestion>(props: {
  propertyName: string,
  propertyValue: string | undefined,
  setPropertyValue: (value: string | undefined) => void,
  getPropertyErrorMessage: () => string | undefined,
  card: Card | undefined,
  selectSuggestion: (suggestion: Suggestion) => void,
  getServerSuggestions: (card: Card) => Promise<Suggestion[]>,
  maxHeight: string,
  renderSuggestion: (suggestion: Suggestion) => ReactNode,
  suggestionsAsGrid?: boolean,
  isChanged: boolean,
  revert: () => void,
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fetchSuggestions = async (force?: boolean) => {
    if (!force && suggestions.length > 0) {
      // If suggestions are already fetched, just toggle visibility
      setShowSuggestions(!showSuggestions);
      return;
    }
    setIsLoading(true);
    try {
      const next = await props.getServerSuggestions(props.card!);
      setSuggestions(prev => [...next, ...prev]);
      setShowSuggestions(true);
    } catch (error) {
      console.error(`Error fetching ${props.propertyName} suggestions:`, error);
      // You might want to show an error message to the user here
    } finally {
      setIsLoading(false);
    }
  };

  const selectSuggestion = (suggestion: Suggestion) => {
    props.selectSuggestion(suggestion);
    setShowSuggestions(false);
  };

  const htmlId = `card${capitalize(props.propertyName).replace(/\s+/g, '')}`;
  return (
    <div className="space-y-1 relative">
      <InputHeader propertyName={props.propertyName} isChanged={props.isChanged} revert={props.revert} />
      <div className="relative">
        <input
          id={htmlId}
          type="text"
          value={props.propertyValue ?? ''}
          onChange={(e) => e.target.value.length === 0
            ? props.setPropertyValue(undefined)
            : props.setPropertyValue(e.target.value)}
          placeholder={`Enter card ${props.propertyName.toLowerCase()}...`}
          className="w-full bg-white px-1 py-0.5 pr-10 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {props.card &&
          <button
            type="button"
            onClick={() => fetchSuggestions()}
            disabled={suggestions.length === 0 && isLoading}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={`Get AI ${props.propertyName} suggestions`}
          >
            <FontAwesomeIcon
              icon={suggestions.length > 0 ? faEye : (isLoading ? faSpinner : faWandMagicSparkles)}
              className={(suggestions.length === 0 && isLoading) ? "animate-spin" : ""}
            />
          </button>
        }
      </div>

      {props.getPropertyErrorMessage() && (
        <p className="text-red-700 text-xs">
          {props.getPropertyErrorMessage()}
        </p>
      )}

      {/* Suggestions Modal/Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className={`absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-zinc-300 rounded-md shadow-lg`}>
          <div className="p-3 border-b border-zinc-200 bg-zinc-50">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-zinc-800">AI {props.propertyName} Suggestions</h3>
              <div className="flex gap-2">
                <button
                  disabled={isLoading}
                  onClick={() => fetchSuggestions(true)}
                  className="text-zinc-500 hover:text-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FontAwesomeIcon
                    icon={isLoading ? faSpinner : faWandMagicSparkles}
                    className={isLoading ? "animate-spin" : ""}
                  />
                </button>
                <button
                  onClick={() => setShowSuggestions(false)}
                  className="text-zinc-500 hover:text-zinc-700"
                >
                  <FontAwesomeIcon icon={faClose} />
                </button>
              </div>
            </div>
          </div>
          <div className={`${props.maxHeight} ${props.suggestionsAsGrid ? 'grid grid-cols-2' : ''} overflow-y-auto`}>
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                onClick={() => selectSuggestion(suggestion)}
                className="p-3 border-b border-zinc-100 last:border-b-0 hover:bg-blue-50 cursor-pointer transition-colors"
              >
                {props.renderSuggestion(suggestion)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Backdrop to close suggestions when clicking outside */}
      {showSuggestions && (
        <div
          className="fixed inset-0 z-40 bg-black opacity-10"
          onClick={() => setShowSuggestions(false)}
        />
      )}
    </div>
  );
};
