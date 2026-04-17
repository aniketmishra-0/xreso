"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./UnifiedDropdown.module.css";

export interface UnifiedDropdownOption {
  value: string;
  label: string;
}

interface UnifiedDropdownProps {
  id?: string;
  name?: string;
  value: string;
  options: UnifiedDropdownOption[];
  onChange: (value: string) => void;
  title: string;
  placeholder: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  desktopClassName?: string;
}

export default function UnifiedDropdown({
  id,
  name,
  value,
  options,
  onChange,
  title,
  placeholder,
  disabled = false,
  required = false,
  className = "",
  desktopClassName = "",
}: UnifiedDropdownProps) {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    return options.find((option) => option.value === value)?.label || placeholder;
  }, [options, placeholder, value]);

  useEffect(() => {
    if (!open) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open]);

  return (
    <div className={`${styles.root} ${className}`.trim()}>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required={required}
        className={`${styles.desktopSelect} ${desktopClassName}`.trim()}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value || "__empty"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div className={styles.mobileSelect}>
        <button
          type="button"
          className={`${styles.mobileSelectTrigger} ${
            !value ? styles.mobileSelectTriggerPlaceholder : ""
          } ${disabled ? styles.mobileSelectTriggerDisabled : ""}`}
          onClick={() => {
            if (disabled) return;
            setOpen(true);
          }}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className={styles.mobileSelectTriggerValue}>{selectedLabel}</span>
          <span className={styles.mobileSelectTriggerIcon} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </button>

        {open && (
          <>
            <div className={styles.mobileSelectOverlay} onClick={() => setOpen(false)} aria-hidden="true" />
            <div className={styles.mobileSelectSheet} role="dialog" aria-modal="true">
              <div className={styles.mobileSelectSheetHandle} />
              <div className={styles.mobileSelectSheetHeader}>
                <div>
                  <p className={styles.mobileSelectSheetLabel}>Choose One</p>
                  <p className={styles.mobileSelectSheetTitle}>{title}</p>
                </div>
                <button
                  type="button"
                  className={styles.mobileSelectSheetClose}
                  onClick={() => setOpen(false)}
                  aria-label="Close picker"
                >
                  ×
                </button>
              </div>

              <div className={styles.mobileSelectOptions}>
                <button
                  type="button"
                  className={`${styles.mobileSelectOption} ${!value ? styles.mobileSelectOptionActive : ""}`}
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <span className={styles.mobileSelectOptionText}>{placeholder}</span>
                  {!value ? (
                    <span className={styles.mobileSelectOptionCheck} aria-hidden="true">✓</span>
                  ) : null}
                </button>
                {options.map((option) => {
                  const active = option.value === value;
                  return (
                    <button
                      key={option.value || "__empty_mobile"}
                      type="button"
                      className={`${styles.mobileSelectOption} ${active ? styles.mobileSelectOptionActive : ""}`}
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                    >
                      <span className={styles.mobileSelectOptionText}>{option.label}</span>
                      {active ? (
                        <span className={styles.mobileSelectOptionCheck} aria-hidden="true">✓</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
