'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface AutoSuggestInputProps {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string | null;
}

export default function AutoSuggestInput({
  id,
  name,
  value,
  onChange,
  options,
  placeholder,
  required,
  disabled,
  className = 'form-input',
  error,
}: AutoSuggestInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<string[]>(options);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!value.trim()) {
      setFilteredOptions(options);
    } else {
      const query = value.toLowerCase();
      const filtered = options.filter(opt => opt.toLowerCase().includes(query));
      setFilteredOptions(filtered);
    }
    setHighlightedIndex(-1);
  }, [value, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  const handleBlur = () => {
    const trimmed = value.trim();
    if (trimmed) {
      const isExactMatch = options.some(opt => opt.toLowerCase() === trimmed.toLowerCase());
      if (!isExactMatch) {
        // Find suggestions matching the typed input
        const matches = options.filter(opt => opt.toLowerCase().includes(trimmed.toLowerCase()));
        if (matches.length === 1) {
          // If only one suggestion matches, use that match when focus out of field
          onChange(matches[0]);
        }
      }
    }
    setIsOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        e.preventDefault();
        handleSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          id={id}
          name={name}
          type="text"
          className={`${className} ${error ? 'input-error' : ''}`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          required={required}
          disabled={disabled}
          autoComplete="off"
          style={{
            width: '100%',
            paddingRight: '36px',
            borderColor: error ? '#ef4444' : undefined,
          }}
        />
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          tabIndex={-1}
          style={{
            position: 'absolute',
            right: '10px',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Toggle suggestions dropdown"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {isOpen && !disabled && filteredOptions.length > 0 && (
        <ul
          ref={listRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: '220px',
            overflowY: 'auto',
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            listStyle: 'none',
            margin: 0,
            padding: '4px 0',
          }}
        >
          {filteredOptions.map((opt, idx) => {
            const isHighlighted = idx === highlightedIndex;
            const isSelected = opt.toLowerCase() === value.trim().toLowerCase();
            return (
              <li
                key={idx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(opt);
                }}
                style={{
                  padding: '10px 14px',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                  backgroundColor: isHighlighted
                    ? 'rgba(59, 130, 246, 0.25)'
                    : isSelected
                    ? 'rgba(59, 130, 246, 0.15)'
                    : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
              >
                <span>{opt}</span>
                {isSelected && (
                  <span style={{ color: 'var(--color-accent-blue)', fontSize: '12px', fontWeight: 600 }}>✓</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <span
          style={{
            color: '#ef4444',
            fontSize: 'var(--font-size-xs)',
            marginTop: '4px',
            display: 'block',
            fontWeight: 500,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
