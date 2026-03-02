import React, { RefObject, useCallback, useEffect, useRef } from 'react';
import { filterDefinitions, FilterQueryHandler } from 'kindred-paths';

interface ColorCodedSearchInputProps {
  ref?: RefObject<HTMLDivElement | null>;
  searchText: string;
  setSearchText: (text: string) => void;
  onBlur?: () => void;
  isOpen?: boolean;
  placeholder?: string;
  className?: string;
}

const ColorCodedSearchInput: React.FC<ColorCodedSearchInputProps> = ({
  ref: externalRef,
  searchText,
  setSearchText,
  onBlur,
  isOpen = false,
  placeholder = 'Search...',
  className = '',
}) => {
  const internalRef = useRef<HTMLDivElement>(null);
  const contentEditableRef = (externalRef ?? internalRef) as RefObject<HTMLDivElement>;
  const isInternalUpdate = useRef(false);

  const colorizeText = useCallback((text: string): string => {
    if (!text) return '';

    const validations = filterDefinitions.map(def => ({
      keys: def.keys,
      value: def.validation,
    }));

    const handler = new FilterQueryHandler();
    const tokens = handler.tokenize(text);

    const items = tokens.map(token => {
      if (token.type === 'AND' || token.type === 'OR') {
        return `<span class="text-zinc-400 italic px-1">${token.type.toLowerCase()}</span>`;
      }
      if (token.type === 'LPAREN' || token.type === 'RPAREN') {
        const depthColor = ['text-purple-400', 'text-amber-400', 'text-pink-400'][(token.depth - 1) % 3];
        return `<span class="${depthColor}">${token.type === 'LPAREN' ? '(' : ')'}</span>`;
      }

      const match = token.value.match(/^([^\s!]+?)(!?[:=])(.*)$/);
      if (match === null) {
        return `<span class="text-zinc-800">${token.value}</span>`;
      }

      const [, key, op, _value] = match;
      const value = _value?.toLowerCase();
      let keyColor = 'text-zinc-600';
      let valueColor = 'text-blue-600';

      const validation = validations.find(val => val.keys.includes(key.toLowerCase()));
      if (!validation || value === undefined || value === '') {
        keyColor = 'text-red-600';
        valueColor = 'text-zinc-400';
      }
      if (validation?.value) {
        if (Array.isArray(validation.value)) {
          if (!validation.value.includes(value)) valueColor = 'text-red-600';
        } else { // noinspection SuspiciousTypeOfGuard
          if (validation.value instanceof RegExp) {
            if (!validation.value.test(value)) valueColor = 'text-red-600';
          }
        }
      }

      return `<span class="px-1.5 py-0.5 rounded-lg border border-zinc-100 border-b-zinc-200 bg-zinc-50 shadow-sm">` +
        `<span class="${keyColor}">${key}</span><span class="text-zinc-400">${op}</span><span class="${valueColor}">${_value}</span>` +
      `</span>`;
    });

    const trailingSpaces = text.match(/\s+$/)?.[0] ?? '';
    return items.join(' ') + (trailingSpaces ? '\u00A0'.repeat(trailingSpaces.length) : '');
  }, []);

  // Build a map from raw-text index to {textNode, offsetInNode}
  const buildCharMap = useCallback((): { node: Text; offset: number }[] => {
    if (!contentEditableRef.current) return [];

    const map: { node: Text; offset: number }[] = [];
    const walker = document.createTreeWalker(
      contentEditableRef.current,
      NodeFilter.SHOW_TEXT,
      null,
    );

    let node: Text | null;
    while ((node = walker.nextNode() as Text)) {
      const text = node.textContent || '';
      for (let i = 0; i < text.length; i++) {
        map.push({ node, offset: i });
      }
    }

    return map;
  }, [contentEditableRef]);

  // Get raw text from DOM, normalizing nbsp
  const getRawText = useCallback((): string => {
    if (!contentEditableRef.current) return '';
    return (contentEditableRef.current.textContent || '').replace(/\u00A0/g, ' ');
  }, [contentEditableRef]);

  const getCursorPosition = useCallback((): number => {
    if (!contentEditableRef.current) return 0;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;

    const range = sel.getRangeAt(0);
    const charMap = buildCharMap();

    // Find the index in the charMap that matches our cursor position
    for (let i = 0; i < charMap.length; i++) {
      if (charMap[i].node === range.endContainer && charMap[i].offset === range.endOffset) {
        return i;
      }
    }

    // If cursor is right after the last character
    if (range.endContainer === contentEditableRef.current) {
      return charMap.length;
    }

    // Fallback: use the clonedRange approach with normalization
    const clonedRange = range.cloneRange();
    clonedRange.selectNodeContents(contentEditableRef.current);
    clonedRange.setEnd(range.endContainer, range.endOffset);
    return clonedRange.toString().replace(/\u00A0/g, ' ').length;
  }, [contentEditableRef, buildCharMap]);

  const setCursorPosition = useCallback((position: number) => {
    if (!contentEditableRef.current) return;

    const sel = window.getSelection();
    if (!sel) return;

    try {
      const charMap = buildCharMap();

      if (charMap.length === 0) {
        const range = document.createRange();
        range.selectNodeContents(contentEditableRef.current);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }

      if (position >= charMap.length) {
        const last = charMap[charMap.length - 1];
        const range = document.createRange();
        range.setStart(last.node, last.offset + 1);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }

      const entry = charMap[position];
      const range = document.createRange();
      range.setStart(entry.node, entry.offset);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (error) {
      console.warn('Could not set cursor position:', error);
    }
  }, [contentEditableRef, buildCharMap]);

  const handleInput = useCallback(() => {
    if (!contentEditableRef.current) return;

    const text = getRawText();
    const cursorPos = getCursorPosition();

    isInternalUpdate.current = true;
    contentEditableRef.current.innerHTML = colorizeText(text);
    setCursorPosition(cursorPos);

    setSearchText(text);
    requestAnimationFrame(() => {
      isInternalUpdate.current = false;
    });
  }, [contentEditableRef, getRawText, getCursorPosition, colorizeText, setCursorPosition, setSearchText]);

  useEffect(() => {
    if (!contentEditableRef.current) return;
    if (isInternalUpdate.current) return;
    const currentText = getRawText();
    if (currentText !== searchText) {
      contentEditableRef.current.innerHTML = colorizeText(searchText);
    }
  }, [searchText, colorizeText, contentEditableRef, getRawText]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      contentEditableRef.current?.blur();
    }
  }, [contentEditableRef]);

  return (
    <div className="relative w-full">
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
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        className={`w-full px-3 py-2 text-sm ${isOpen ? 'border border-zinc-300' : 'text-white'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[1.5rem] ${className}`}
        style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}
        suppressContentEditableWarning={true}
      />

      {!searchText && (
        <div
          className="absolute inset-0 px-3 py-2 text-sm text-zinc-400 pointer-events-none flex items-center"
          style={{ whiteSpace: 'nowrap' }}
        >
          {placeholder}
        </div>
      )}
    </div>
  );
};

export default ColorCodedSearchInput;
