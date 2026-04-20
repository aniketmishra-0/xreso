"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

type HomeHeroSearchProps = {
  suggestions: string[];
};

export default function HomeHeroSearch({ suggestions }: HomeHeroSearchProps) {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredSuggestions = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    return suggestions.filter((item) => item.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery, suggestions]);

  const shouldShowDropdown =
    showSuggestions && normalizedQuery.length > 0 && filteredSuggestions.length > 0;

  return (
    <div className={styles.searchAutocompleteWrap}>
      <form action="/search" method="GET" className={styles.searchWrap}>
        <span className={styles.searchHint}>{"⌘K"}</span>
        <input
          className={styles.searchBox}
          type="text"
          name="q"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          data-global-search-input="true"
          placeholder="Search notes, videos, categories, tracks..."
          value={query}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            // Delay close so click on suggestion still works.
            window.setTimeout(() => setShowSuggestions(false), 120);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setShowSuggestions(true);
          }}
        />
        <button type="submit" className={styles.searchSubmit}>
          Search
        </button>
      </form>

      {shouldShowDropdown ? (
        <div className={styles.searchSuggestDropdown} role="listbox" aria-label="Search suggestions">
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className={styles.searchSuggestItem}
              onMouseDown={(event) => {
                event.preventDefault();
                setQuery(suggestion);
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}