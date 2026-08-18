"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, helperText, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full bg-input/80 border ${
            error ? "border-danger ring-1 ring-danger" : "border-border focus:border-primary focus:ring-1 focus:ring-primary"
          } rounded-md px-3.5 py-2 text-sm text-text placeholder-text-muted/60 transition-colors focus:outline-none ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-danger font-medium mt-1">{error}</p>}
        {helperText && !error && <p className="text-xs text-text-muted mt-1">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", label, error, helperText, id, ...props }, ref) => {
    const textareaId = id || props.name;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`w-full bg-input/80 border ${
            error ? "border-danger ring-1 ring-danger" : "border-border focus:border-primary focus:ring-1 focus:ring-primary"
          } rounded-md px-3.5 py-2 text-sm text-text placeholder-text-muted/60 transition-colors focus:outline-none resize-y min-h-[100px] ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-danger font-medium mt-1">{error}</p>}
        {helperText && !error && <p className="text-xs text-text-muted mt-1">{helperText}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
