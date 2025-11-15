import { useRef, useState } from 'react';
import { CardType, capitalize } from 'kindred-paths';
import { InputHeader } from '@/components/editor/input-header';

export const CardSubtypesInput = (props: {
  subtypes: string[] | undefined,
  setSubtypes: (value: string[] | undefined) => void,
  types: [CardType, ...CardType[]],
  getErrorMessage: () => string | undefined,
  isChanged: boolean,
  revert: () => void,
}) => {
  const [newSubtype, setNewSubtype] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const subtypes = props.subtypes || [];

  // Get relevant subtypes based on card types - only show when exactly 1 type
  const getRelevantSubtypes = (): string[] => {
    if (props.types.length !== 1) return [];

    const cardType = props.types[0];
    if (cardType === 'creature') {
      return [
        'human', 'merfolk', 'vampire', 'zombie', 'goblin', 'elf',
        'angel', 'sphinx', 'demon', 'dragon', 'hydra',
        'fox', 'cat', 'whale', 'turtle', 'bat', 'scorpion', 'goat', 'phoenix', 'wolf', 'boar',
        'rabbit', 'bird',
        'cleric', 'advisor', 'scout',
        'wizard', 'rogue', 'elder',
        'warlock', 'knight', 'mercenary',
        'shaman', 'berserker', 'artificer',
        'druid', 'archer', 'smith',
      ];
    } else if (cardType === 'artifact') {
      return ['equipment', 'vehicle']
    } else if (cardType === 'enchantment') {
      return ['aura', 'curse'];
    } else if (cardType === 'land') {
      return ['plains', 'island', 'swamp', 'mountain', 'forest'];
    } else if (cardType === 'sorcery' || cardType === 'instant') {
      return ['adventure'];
    }
    return [];
  };
  const allSuggestions = getRelevantSubtypes().filter(subtype => !subtypes.includes(subtype));
  const filteredSuggestions = allSuggestions.filter(suggestion => suggestion.toLowerCase().includes(newSubtype.toLowerCase()));

  const addSubtype = (subtypeToAdd?: string) => {
    const subtype = (subtypeToAdd || newSubtype.trim()).toLowerCase();
    if (subtype && !subtypes.some(existing => existing === subtype)) {
      const updated = [...subtypes, subtype];
      props.setSubtypes(updated);
      setNewSubtype('');
      setShowSuggestions(false);
    }
  };

  const removeSubtype = (index: number) => {
    const updated = subtypes.filter((_, i) => i !== index);
    props.setSubtypes(updated);
  };

  const moveSubtype = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= subtypes.length) return;

    const updated = [...subtypes];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    props.setSubtypes(updated);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredSuggestions.length > 0 && showSuggestions) {
        addSubtype(filteredSuggestions[0]);
      } else {
        addSubtype();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="space-y-1">
      <InputHeader propertyName="subtypes" isChanged={props.isChanged} revert={props.revert} />

      <div className="space-y-3">
        {/* Current subtypes display */}
        <div className="p-2 border border-zinc-300 rounded bg-white">
          {subtypes.length === 0 ? (
            <span className="text-zinc-300">No subtypes</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {subtypes.map((subtype, index) => (
                <div
                  key={index}
                  className="group flex items-center bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <span className="text-sm font-medium">{capitalize(subtype)}</span>

                  <div className="ml-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Move buttons */}
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => moveSubtype(index, index - 1)}
                        className="p-0.5 text-blue-600 hover:text-blue-800 hover:bg-blue-200 rounded"
                        title="Move left"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}

                    {index < subtypes.length - 1 && (
                      <button
                        type="button"
                        onClick={() => moveSubtype(index, index + 1)}
                        className="p-0.5 text-blue-600 hover:text-blue-800 hover:bg-blue-200 rounded"
                        title="Move right"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeSubtype(index)}
                      className="p-0.5 text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
                      title="Remove subtype"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add new subtype */}
        <div className="relative">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newSubtype}
              onChange={(e) => {
                setNewSubtype(e.target.value);
                setShowSuggestions(e.target.value.length > 0);
              }}
              onKeyUp={handleKeyPress}
              onFocus={() => setShowSuggestions(newSubtype.length > 0)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 10)} // Delay to allow click on suggestions
              placeholder="Add subtype..."
              className="flex-1 bg-white text-sm px-2 py-0.5 border border-zinc-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => addSubtype()}
              disabled={!newSubtype.trim() || subtypes.some(existing => existing.toLowerCase() === newSubtype.trim().toLowerCase())}
              className="px-3 py-0.5 bg-blue-600 text-sm text-white rounded hover:bg-blue-700 disabled:bg-zinc-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Add
            </button>
          </div>

          {/* Autocomplete suggestions */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-14 mt-1 bg-white border border-zinc-300 rounded shadow-lg z-10 max-h-40 overflow-y-auto">
              {filteredSuggestions.slice(0, 8).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => addSubtype(suggestion)}
                  className="w-full text-left px-3 py-1 hover:bg-blue-50 text-sm border-b border-zinc-100 last:border-b-0"
                >
                  {capitalize(suggestion)}
                </button>
              ))}
              {filteredSuggestions.length > 8 && (
                <div className="px-3 py-1 text-xs text-zinc-500 bg-zinc-50">
                  ...and {filteredSuggestions.length - 8} more
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick add relevant subtypes */}
        {allSuggestions.length > 0 && allSuggestions.length <= 7 && (
          <div className="flex flex-wrap gap-1">
            {allSuggestions.map((subtype) => (
              <button
                key={subtype}
                type="button"
                onClick={() => addSubtype(subtype)}
                className="px-2 py-1 text-xs bg-zinc-50 hover:bg-zinc-200 text-zinc-700 rounded border border-zinc-200 transition-colors"
              >
                {capitalize(subtype)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error message */}
      {props.getErrorMessage() && (
        <p className="text-red-700 text-xs">
          {props.getErrorMessage()}
        </p>
      )}
    </div>
  );
};
