'use client';

import React from 'react';
import { filterDefinitions } from 'kindred-paths';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

interface SearchHelpPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onExampleClick: (example: string) => void;
}

const SearchHelpPopup: React.FC<SearchHelpPopupProps> = ({
  isOpen,
  onClose,
  onExampleClick,
}) => {
  if (!isOpen) return null;

  const formatValidation = (validation: readonly string[] | RegExp | undefined): string => {
    if (!validation) return 'any text';
    if (validation instanceof RegExp) return `pattern: ${validation.source}`;
    if (validation.length <= 6) return validation.join(', ');
    return `${validation.slice(0, 5).join(', ')}, ... (${validation.length} options)`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-50">
          <h2 className="text-lg font-semibold text-zinc-800">Search Filters Help</h2>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200 rounded"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4">
          <p className="text-sm text-zinc-600 mb-4">
            Use filters to narrow down your search. Format: <code className="bg-zinc-100 px-1 rounded">key:value</code> or <code className="bg-zinc-100 px-1 rounded">key=value</code>.
            Negate with <code className="bg-zinc-100 px-1 rounded">key!:value</code>. Click an example to add it to your search.
          </p>

          <div className="space-y-4">
            {filterDefinitions.map((filter) => (
              <div key={filter.keys[0]} className="border border-zinc-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="font-mono font-semibold text-zinc-800">
                      {filter.keys[0]}
                    </span>
                    {filter.keys.length > 1 && (
                      <span className="text-zinc-500 text-sm ml-2">
                        (alias: {filter.keys.slice(1).join(', ')})
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-sm text-zinc-600 mb-2">{filter.description}</p>

                <div className="text-xs text-zinc-500 mb-2">
                  <span className="font-medium">Valid values:</span>{' '}
                  {formatValidation(filter.validation)}
                </div>

                <div className="flex flex-wrap gap-2">
                  {filter.examples.map((example) => (
                    <button
                      key={example}
                      onClick={() => onExampleClick(example)}
                      className="px-2 py-1 text-xs font-mono bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 hover:border-blue-300 transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-200 bg-zinc-50">
          <p className="text-xs text-zinc-500">
            Tip: Plain text without a filter searches card names. Multiple filters are combined with AND logic.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SearchHelpPopup;
