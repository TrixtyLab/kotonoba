"use client";

import React, { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

/**
 * Properties configuring standard text field inputs with label and validation states.
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Optional header label displayed above the input. */
  label?: ReactNode;
  /** Validation error message rendered below the input with danger styling. */
  error?: string;
  /** Subordinate helper description text rendered when no error is present. */
  helperText?: string;
  /** Control rendered inside the field, such as a password visibility toggle. */
  endAdornment?: ReactNode;
}

function fieldClassName(error: string | undefined, hasAdornment: boolean, className: string): string {
  const border = error
    ? "border-danger ring-1 ring-danger"
    : "border-border hover:border-border-hover focus:border-accent focus:ring-1 focus:ring-accent";
  const adornment = hasAdornment ? "pr-11" : "";
  return `w-full bg-input border ${border} rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted placeholder:italic transition-colors focus:outline-hidden ${adornment} ${className}`;
}

/**
 * Standard styled single-line text input field supporting integrated labels, helper text, and validation states.
 *
 * @param props - InputProps with label, error, and standard HTML input attributes.
 * @param ref - Forwarded DOM ref to the HTMLInputElement.
 * @returns React JSX input container element.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, helperText, id, endAdornment, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || props.name || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    const describedBy = error ? errorId : helperText ? helperId : undefined;

    return (
      <div className="w-full space-y-1 text-left">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-text">
            {label}
          </label>
        )}
        <div className={endAdornment ? "relative" : undefined}>
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`${fieldClassName(error, Boolean(endAdornment), className)} min-h-[40px]`}
            {...props}
          />
          {endAdornment && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">{endAdornment}</div>
          )}
        </div>
        {error && (
          <p id={errorId} className="text-xs text-danger font-medium mt-0.5">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-xs text-text-muted mt-0.5 leading-normal">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

/**
 * Properties configuring multi-line textarea input fields.
 */
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Optional header label displayed above the textarea. */
  label?: ReactNode;
  /** Validation error message rendered below the textarea. */
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
    const generatedId = useId();
    const textareaId = id || props.name || generatedId;
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;
    const describedBy = error ? errorId : helperText ? helperId : undefined;

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
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${fieldClassName(error, false, className)} resize-y min-h-[96px]`}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-xs text-danger font-medium mt-0.5">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-xs text-text-muted mt-0.5 leading-normal">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
