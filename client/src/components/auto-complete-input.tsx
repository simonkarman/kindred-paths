import { useEffect, useRef, useState } from 'react';

type AutoCompleteInputProps = {
  value: string,
  onChange: (value: string) => void,
  suggestions: string[],
  placeholder: string,
  className?: string,
  focusKey?: string,
}

export default function AutoCompleteInput(props: AutoCompleteInputProps) {
  const { value, onChange, suggestions, placeholder, className } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value.trim() === '') {
      // Show all suggestions when input is empty
      setFilteredSuggestions(suggestions);
    } else {
      // Filter suggestions based on input
      const filtered = suggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
    }
  }, [value, suggestions]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for CMD+<key> on Mac or CTRL+<key> on Windows/Linux
      const isSearchShortcut = props.focusKey !== undefined && (event.metaKey || event.ctrlKey) && event.key === props.focusKey;
      const current = inputRef.current;
      if (current && isSearchShortcut) {
        event.preventDefault(); // Prevent the default browser find dialog
        current.focus();
        current.select();
      }
    };

    // Add event listener to document
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup function to remove event listener
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [props.focusKey]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleInputBlur = () => {
    // Delay closing to allow suggestion clicks
    setTimeout(() => setIsOpen(false), 150);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        className={className}
      />

      {isOpen && filteredSuggestions.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border border-zinc-300 rounded-md shadow-lg max-h-60 overflow-auto mt-1">
          {filteredSuggestions.map((suggestion, index) => (
            <li
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm border-b border-zinc-100 last:border-b-0"
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
