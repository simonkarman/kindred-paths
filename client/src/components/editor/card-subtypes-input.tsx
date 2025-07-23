import { useState } from 'react';

export const CardSubtypesInput = (props: {
  subtypes: string[] | undefined,
  setSubtypes: (value: string[] | undefined) => void,
  getErrorMessage: () => string | undefined,
}) => {
  const [newSubtype, setNewSubtype] = useState('');

  const subtypes = props.subtypes || [];

  const addSubtype = () => {
    if (newSubtype.trim() && !subtypes.includes(newSubtype.trim())) {
      const updated = [...subtypes, newSubtype.trim()];
      props.setSubtypes(updated.length > 0 ? updated : undefined);
      setNewSubtype('');
    }
  };

  const removeSubtype = (index: number) => {
    const updated = subtypes.filter((_, i) => i !== index);
    props.setSubtypes(updated.length > 0 ? updated : undefined);
  };

  const moveSubtype = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= subtypes.length) return;

    const updated = [...subtypes];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    props.setSubtypes(updated);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSubtype();
    }
  };

  return (
    <div className="space-y-1">
      <label htmlFor="cardSubtypes" className="block font-medium text-gray-800">
        Card Subtypes
      </label>

      {/* Display current subtypes */}
      <div className="min-h-[2.5rem] p-2 border border-gray-300 rounded-md bg-gray-50">
        {subtypes.length === 0 ? (
          <span className="text-gray-500 italic">-</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {subtypes.map((subtype, index) => (
              <div key={index} className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-md">
                <span className="text-sm">{subtype}</span>
                <div className="ml-2 flex items-center space-x-1">
                  {/* Move up button */}
                  <button
                    type="button"
                    onClick={() => moveSubtype(index, 'up')}
                    disabled={index === 0}
                    className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd"
                            d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                            clipRule="evenodd"/>
                    </svg>
                  </button>
                  {/* Move down button */}
                  <button
                    type="button"
                    onClick={() => moveSubtype(index, 'down')}
                    disabled={index === subtypes.length - 1}
                    className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"/>
                    </svg>
                  </button>
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeSubtype(index)}
                    className="text-red-600 hover:text-red-800 ml-1"
                    title="Remove"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add new subtype input */}
      <div className="flex gap-2">
        <input
          id="cardSubtypes"
          type="text"
          value={newSubtype}
          onChange={(e) => setNewSubtype(e.target.value.toLowerCase())}
          onKeyPress={handleKeyPress}
          placeholder="Add a new subtype..."
          className="flex-1 bg-white px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={addSubtype}
          disabled={!newSubtype.trim() || subtypes.includes(newSubtype.trim())}
          className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Add
        </button>
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
