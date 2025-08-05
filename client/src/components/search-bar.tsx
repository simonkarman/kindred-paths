'use client';

import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { useSearch } from '@/utils/use-search';

export default function SearchBar() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchText, setSearchText] = useSearch();
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
        current.select(); // Select the text in the input
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
      <input
        ref={searchInputRef}
        id="search"
        type="text"
        placeholder="Search..."
        value={searchText}
        onBlur={handleBlur}
        onChange={(e) => setSearchText(e.target.value)}
        className={`inline-block w-full ${isOpen ? 'border' : 'text-white'} px-3 py-1 text-sm border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
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
