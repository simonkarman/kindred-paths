import React, { RefObject, useCallback, useEffect, useState } from 'react';
import { cardColors, cardRarities, wubrg } from 'kindred-paths';

interface ColorCodedSearchInputProps {
  ref: RefObject<HTMLDivElement | null>;
  searchText: string;
  setSearchText: (text: string) => void;
  onBlur?: () => void;
  isOpen?: boolean;
  placeholder?: string;
  className?: string;
}

const ColorCodedSearchInput: React.FC<ColorCodedSearchInputProps> = ({
  ref,
  searchText,
  setSearchText,
  onBlur,
  isOpen = false,
  placeholder = "Search...",
  className = ""
}) => {
  const contentEditableRef = ref;
  const [isFocused, setIsFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Parse and colorize the search text
  const colorizeText = useCallback((text: string) => {
    if (!text) return '';

    // Define keys and their corresponding values
    const validations: { keys: string[], value?: readonly string[] | RegExp | RegExp[] }[] = [
      { keys: ['type', 't'] },
      { keys: ['rarity', 'r'], value: [...cardRarities, ...cardRarities.map(r => r[0])] },
      { keys: ['color', 'c'], value: [...cardColors, ...wubrg, 'colorless', 'c', 'multicolor', 'm'] },
      { keys: ['manavalue', 'mv'], value: /^\d+$|^\d+[+-]$/ },
      { keys: ['pt'], value: /^yes$|^no$|^n\/n(?:[+-]\d*)?$|^n(?:[+-]\d*)?\/n$|^(?:\d+[+-]?)?\/(?:\d+[+-]?)?$/ },
      { keys: ['deck', 'd'] },
      { keys: ['set', 's'] },
      { keys: ['tag'] },
    ];

    // Color key-value pairs
    let colorizedText = text.replace(/([^\s!]+?)(!?[:=])([^\s]*)/g, (_, key, op, _value) => {
      const value = _value?.toLowerCase();
      let keyColor = 'text-zinc-400';
      let valueColor = 'text-blue-600';

      // Get key value validation
      const validation = validations.find(val => val.keys.includes(key.toLowerCase()));
      if (!validation || value === undefined || value === '') {
        keyColor = 'text-red-600';
        valueColor = 'text-zinc-400';
      }
      if (validation?.value) {
        if (Array.isArray(validation.value)) {
          if (!validation.value.includes(value)) {
            valueColor = 'text-red-600';
          }
        } else {
          // noinspection SuspiciousTypeOfGuard
          if (validation.value instanceof RegExp) {
            if (!validation.value.test(value)) {
              valueColor = 'text-red-600';
            }
          }
        }
      }

      return `<span class="px-1.5 py-0.5 rounded-lg border border-zinc-100 border-b-zinc-200 bg-zinc-50">` +
          `<span class="${keyColor}">${key}</span>` +
          op +
          `<span class="${valueColor}">${_value}</span>` +
        `</span>`;
    });

    // Color remaining words (non-pattern matches) as default
    colorizedText = colorizedText.replace(/\b(?![^<]*>)(\w+)(?![^<]*<\/)/g, (match) => {
      // Check if this word is already wrapped in a span
      if (match.includes('<span')) return match;
      return `<span class="text-zinc-800">${match}</span>`;
    });

    return colorizedText;
  }, []);

  // Get cursor position relative to text content (ignoring HTML tags)
  const getCursorPosition = useCallback(() => {
    if (!contentEditableRef.current) return 0;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;

    const range = sel.getRangeAt(0);
    const clonedRange = range.cloneRange();
    clonedRange.selectNodeContents(contentEditableRef.current);
    clonedRange.setEnd(range.endContainer, range.endOffset);

    return clonedRange.toString().length;
  }, [contentEditableRef]);

  // Restore cursor position after content update (handles HTML content)
  const setCursorPosition = useCallback((position: number) => {
    if (!contentEditableRef.current) return;

    const sel = window.getSelection();
    if (!sel) return;

    try {
      const walker = document.createTreeWalker(
        contentEditableRef.current,
        NodeFilter.SHOW_TEXT,
        null,
      );

      let currentPosition = 0;
      let node: Text | null = null;

      // Walk through all text nodes to find the correct position
      while (node = walker.nextNode() as Text) {
        const nodeLength = node.textContent?.length || 0;

        if (currentPosition + nodeLength >= position) {
          // Found the node containing our cursor position
          const range = document.createRange();
          const offsetInNode = position - currentPosition;

          range.setStart(node, Math.min(offsetInNode, nodeLength));
          range.collapse(true);

          sel.removeAllRanges();
          sel.addRange(range);
          return;
        }

        currentPosition += nodeLength;
      }

      // If we couldn't find the exact position, place cursor at the end
      const range = document.createRange();
      range.selectNodeContents(contentEditableRef.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);

    } catch (error) {
      console.warn('Could not set cursor position:', error);
    }
  }, [contentEditableRef]);

  // Handle input changes with real-time coloring
  const handleInput = useCallback(() => {
    if (contentEditableRef.current) {
      const text = contentEditableRef.current.textContent || '';
      const cursorPos = getCursorPosition();

      setIsTyping(true);
      setSearchText(text);

      // Apply coloring while preserving cursor position
      setTimeout(() => {
        if (contentEditableRef.current) {
          contentEditableRef.current.innerHTML = colorizeText(text);
          setCursorPosition(cursorPos);
          setIsTyping(false);
        }
      }, 0);
    }
  }, [contentEditableRef, getCursorPosition, setSearchText, colorizeText, setCursorPosition]);

  // Update content when searchText changes externally (not from typing)
  useEffect(() => {
    if (contentEditableRef.current && !isTyping) {
      const currentText = contentEditableRef.current.textContent || '';
      // Only update if the text actually changed from external source
      if (currentText !== searchText) {
        contentEditableRef.current.innerHTML = colorizeText(searchText);
        setCursorPosition(searchText.length);
      }
    }
  }, [searchText, colorizeText, setCursorPosition, isTyping, contentEditableRef]);

  // Handle focus events
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setIsTyping(false);
    onBlur?.();
  }, [onBlur]);

  // Handle key events
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      contentEditableRef.current?.blur();
    }
  }, [contentEditableRef]);

  return (
    <>
      <div
        ref={contentEditableRef}
        role="textbox"
        aria-label="Search input"
        aria-multiline="false"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        contentEditable
        onInput={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`inline-block w-full ${isOpen ? 'border' : 'text-white'} px-3 py-2 text-sm border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[1.5rem] ${className}`}
        style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
        suppressContentEditableWarning={true}
      />

      {/* Placeholder */}
      {!searchText && !isFocused && (
        <div
          className="inset-0 px-3 py-1 text-sm text-zinc-400 pointer-events-none flex items-center"
          style={{ whiteSpace: 'nowrap' }}
        >
          {placeholder}
        </div>
      )}
    </>
  );
};

export default ColorCodedSearchInput;
