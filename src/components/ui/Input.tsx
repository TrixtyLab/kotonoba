"use client";

import React, { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

/**
 * Properties configuring standard text field inputs with label and validation states.
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Optional header label string displayed above the input. */
  label?: string;
  /** Validation error message string rendered below the input with danger styling. */
  error?: string;
  /** Subordinate helper description text rendered when no error is present. */
  helperText?: string;
}

/**
 * Standard styled single-line text input field supporting integrated labels, helper text, and validation states.
 *
 * @param props - InputProps with label, error, and standard HTML input attributes.
 * @param ref - Forwarded DOM ref to the HTMLInputElement.
 * @returns React JSX input container element.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, helperText, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="w-full space-y-1 text-left">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-text">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full bg-input border ${
            error
              ? "border-danger ring-1 ring-danger"
              : "border-border hover:border-border-hover focus:border-accent focus:ring-1 focus:ring-accent"
          } rounded-lg px-3 py-2 text-xs text-text placeholder-text-muted/40 transition-all focus:outline-hidden ${className}`}
          {...props}
        />
        {error && <p className="text-[11px] text-danger font-medium mt-0.5">{error}</p>}
        {helperText && !error && <p className="text-[11px] text-text-muted mt-0.5 leading-normal">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

/**
 * Properties configuring multi-line textarea input fields.
 */
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Optional header label string displayed above the textarea. */
  label?: string;
  /** Validation error message string rendered below the textarea. */
  error?: string;
  /** Subordinate helper description text. */
  helperText?: string;
}

/**
 * Standard styled multi-line text input area with vertical resizing and error states.
 *
 * @param props - TextareaProps configuring label, error, and HTML textarea attributes.
 * @param ref - Forwarded DOM ref to the HTMLTextAreaElement.
 * @returns React JSX textarea container element.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", label, error, helperText, id, ...props }, ref) => {
    const textareaId = id || props.name;

    return (
      <div className="w-full space-y-1 text-left">
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-semibold text-text">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`w-full bg-input border ${
            error
              ? "border-danger ring-1 ring-danger"
              : "border-border hover:border-border-hover focus:border-accent focus:ring-1 focus:ring-accent"
          } rounded-lg px-3 py-2 text-xs text-text placeholder-text-muted/40 transition-all focus:outline-hidden resize-y min-h-[85px] ${className}`}
          {...props}
        />
        {error && <p className="text-[11px] text-danger font-medium mt-0.5">{error}</p>}
        {helperText && !error && <p className="text-[11px] text-text-muted mt-0.5 leading-normal">{helperText}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
