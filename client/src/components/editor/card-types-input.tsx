import { CardType, cardTypes } from 'kindred-paths';
import { capitalize } from '@/utils/typography';
import { InputHeader } from '@/components/editor/input-header';
import { useState } from 'react';

export const CardTypesInput = (props: {
  types: [CardType, ...CardType[]],
  setTypes: (value: [CardType, ...CardType[]]) => void,
  getErrorMessage: () => string | undefined,
  isChanged: boolean,
  revert: () => void,
}) => {
  const [multipleMode, setMultipleMode] = useState(props.types.length > 1);

  const setTypes = (value: [CardType, ...CardType[]]) => {
    const orderedTypes = cardTypes.filter(type => value.includes(type)) as [CardType, ...CardType[]];
    props.setTypes(orderedTypes);
  }

  const handleTypeClick = (type: CardType) => {
    if (multipleMode) {
      // Multiple selection mode - toggle the type
      if (props.types.includes(type)) {
        if (props.types.length > 1) {
          const newTypes = props.types.filter(t => t !== type);
          setTypes(newTypes as [CardType, ...CardType[]]);
        }
      } else {
        setTypes([...props.types, type] as [CardType, ...CardType[]]);
      }
    } else {
      // Single selection mode - replace current selection
      setTypes([type] as [CardType, ...CardType[]]);
    }
  };

  const toggleMultipleMode = () => {
    const newMode = !multipleMode;
    setMultipleMode(newMode);

    // If switching to single mode and multiple types are selected, keep only the last one
    if (!newMode && props.types.length > 1) {
      setTypes([props.types[props.types.length - 1]] as [CardType, ...CardType[]]);
    }
  };

  return (
    <div className="space-y-1">
      <InputHeader propertyName="type" isChanged={props.isChanged} revert={props.revert}>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={toggleMultipleMode}
            className="text-xs text-blue-600 hover:text-blue-800 underline cursor-pointer"
          >
            Switch to {multipleMode ? 'single' : 'multiple'} selection
          </button>
          {multipleMode && (
            <span className="text-xs text-zinc-500">
            ({props.types.length} selected)
          </span>
          )}
        </div>
      </InputHeader>
      <div className="grid grid-cols-2 gap-2">
        {cardTypes.map(type => {
          const isSelected = props.types.includes(type);
          const isDisabled = multipleMode && isSelected && props.types.length === 1;

          return (
            <button
              key={type}
              type="button"
              onClick={() => handleTypeClick(type)}
              disabled={isDisabled}
              className={`
                flex items-center space-x-2 p-2 rounded border text-left transition-colors
                ${isSelected
                ? 'bg-blue-50 border-blue-300 text-blue-900'
                : 'bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-50'
              }
                ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {multipleMode ? (
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isDisabled}
                  readOnly
                  className="w-4 h-4 text-blue-600 bg-zinc-100 border-zinc-300 rounded focus:ring-blue-500 focus:ring-2 pointer-events-none"
                />
              ) : (
                <input
                  type="radio"
                  checked={isSelected}
                  readOnly
                  className="w-4 h-4 text-blue-600 bg-zinc-100 border-zinc-300 focus:ring-blue-500 focus:ring-2 pointer-events-none"
                />
              )}
              <span className="text-sm">
                {capitalize(type)}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-right text-xs text-zinc-500 italic">
        {multipleMode
          ? '(at least one type must be selected)'
          : '(click any type to select it)'
        }
      </p>
      {props.getErrorMessage() && (
        <p className="text-red-700 text-xs">
          {props.getErrorMessage()}
        </p>
      )}
    </div>
  );
};
