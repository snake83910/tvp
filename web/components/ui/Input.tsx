import { forwardRef, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
}

const BASE = "w-full rounded-lg border bg-paper px-3 text-ink outline-none transition focus-visible:border-signal focus-visible:ring-1 focus-visible:ring-signal disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leadingIcon, className, id, ...rest },
  ref,
) {
  const inputId = id ?? `in-${label?.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-bold uppercase tracking-wider text-ink-muted">
          {label}
        </label>
      )}
      <div className="relative">
        {leadingIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            BASE,
            "h-11",
            leadingIcon ? "pl-9" : "",
            error ? "border-signal" : "border-line",
            className ?? "",
          ].join(" ")}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined}
          {...rest}
        />
      </div>
      {error ? (
        <p id={`${inputId}-err`} className="text-xs text-signal-dark">{error}</p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, rows = 4, ...rest },
  ref,
) {
  const inputId = id ?? `ta-${label?.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-bold uppercase tracking-wider text-ink-muted">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={[BASE, "py-2", error ? "border-signal" : "border-line", className ?? ""].join(" ")}
        {...rest}
      />
      {error ? (
        <p className="text-xs text-signal-dark">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
});
