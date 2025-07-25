import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWandMagicSparkles, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { Card } from 'kindred-paths';
import { getNameSuggestions, NameSuggestion } from '@/utils/server';

export const CardNameInput = (props: {
  name: string,
  setName: (value: string) => void,
  getErrorMessage: () => string | undefined,
  card: Card | undefined,
}) => {
  const [suggestions, setSuggestions] = useState<NameSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fetchSuggestions = async () => {
    if (suggestions.length > 0) {
      // If suggestions are already fetched, just toggle visibility
      setShowSuggestions(!showSuggestions);
      return;
    }
    setIsLoading(true);
    try {
      setSuggestions(await getNameSuggestions(props.card!));
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsLoading(false);
    }
  };

  const selectSuggestion = (suggestion: NameSuggestion) => {
    props.setName(suggestion.name);
    setShowSuggestions(false);
  };

  return (
    <div className="space-y-1 relative">
      <label htmlFor="cardName" className="block font-medium text-zinc-800">
        Card Name
      </label>
      <div className="relative">
        <input
          id="cardName"
          type="text"
          value={props.name}
          onChange={(e) => props.setName(e.target.value)}
          placeholder="Enter card name..."
          className="w-full bg-white px-1 py-0.5 pr-10 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {props.card &&
          <button
            type="button"
            onClick={fetchSuggestions}
            disabled={isLoading}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Get AI name suggestions"
          >
            <FontAwesomeIcon
              icon={isLoading ? faSpinner : faWandMagicSparkles}
              className={isLoading ? "animate-spin" : ""}
            />
          </button>
        }
      </div>

      {props.getErrorMessage() && (
        <p className="text-red-700 text-xs">
          {props.getErrorMessage()}
        </p>
      )}

      {/* Suggestions Modal/Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-zinc-300 rounded-md shadow-lg max-h-80 overflow-y-auto">
          <div className="p-3 border-b border-zinc-200 bg-zinc-50">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-zinc-800">AI Name Suggestions</h3>
              <button
                onClick={() => setShowSuggestions(false)}
                className="text-zinc-500 hover:text-zinc-700"
              >
                ×
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                onClick={() => selectSuggestion(suggestion)}
                className="p-3 border-b border-zinc-100 last:border-b-0 hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <div className="font-medium text-zinc-800 mb-1">
                  {suggestion.name}
                </div>
                <div className="text-xs text-zinc-600">
                  {suggestion.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Backdrop to close suggestions when clicking outside */}
      {showSuggestions && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSuggestions(false)}
        />
      )}
    </div>
  );
};
