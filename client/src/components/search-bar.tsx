'use client';

import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { useSearch } from '@/utils/use-search';
import ColorCodedSearchInput from '@/components/color-coded-search-input';

export default function SearchBar(props: { scope: string, initial?: string }) {
  const searchInputRef = useRef<HTMLDivElement>(null);
  const [searchText, setSearchText] = useSearch(props.scope, props.initial);
  const [open, setOpen] = useState(searchText.length > 0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {

      // Search
      // Check for CMD+F on Mac or CTRL+F on Windows/Linux
      const isSearchShortcut = (event.metaKey || event.ctrlKey) && event.key === 'f';
      const current = searchInputRef.current;
      if (current && isSearchShortcut) {
        event.preventDefault(); // Prevent the default browser find dialog
        current.focus();
        setOpen(true);
      }

      // Escape
      // Check for Escape key to close the search bar
      if (event.key === 'Escape') {
        event.preventDefault(); // Prevent default behavior
        setOpen(false);
        if (current) {
          current.blur(); // Remove focus from input
        }
      }
    };

    // Add event listener to document
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup function to remove event listener
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (open) {
      const current = searchInputRef.current;
      if (current) {
        current.focus();
        // current.select(); // Select the text in the input
      }
    }
  }, [open]);

  // If the search bar loses focus and is empty, hide it
  const handleBlur = () => {
    if (searchText.trim() === '') {
      setOpen(false);
    }
  };

  const isOpen = open || searchText.length > 0;

  return (
    <>
      <ColorCodedSearchInput
        ref={searchInputRef}
        searchText={searchText}
        setSearchText={setSearchText}
        onBlur={handleBlur}
        isOpen={isOpen}
        placeholder="Search... (e.g., set:miffy type:artifact home)"
      />
      <button
        onClick={() => setOpen(true)}
        className={`${isOpen ? 'hidden' : 'inline-block'} text-sm px-3 py-1 border border-gray-300 rounded`}
      >
        <FontAwesomeIcon icon={faSearch} />
      </button>
    </>
  );
}
