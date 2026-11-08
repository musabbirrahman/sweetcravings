'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

/**
 * In-site confirm modal + toast system (redesign 2026-11-08).
 * Replaces every native browser dialog
 * in the storefront and admin. Provided from the root layout so both
 * sides can use it.
 *
 * Safety semantics are unchanged: destructive actions still need an
 * explicit confirmation, and cancelling the modal aborts the action
 * exactly as a cancelled native confirm did (the promise resolves
 * false / null). The Cancel button is the default-focused one;
 * Escape and backdrop-click both cancel.
 */

export interface ConfirmInputOptions {
  label: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  inputType?: 'text' | 'number';
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive confirms get the desaturated brick button; all others ink. */
  destructive?: boolean;
  /** When set, the modal shows a text input and resolves with the
      entered string, or null when cancelled. Without it, resolves boolean. */
  input?: ConfirmInputOptions;
}

interface ToastItem {
  id: number;
  message: string;
  kind: 'success' | 'error';
}

interface DialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean | string | null>;
  toast: (message: string, kind?: 'success' | 'error') => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useConfirm(): DialogContextValue['confirm'] {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useConfirm must be used inside <DialogProvider>');
  return ctx.confirm;
}

export function useToast(): DialogContextValue['toast'] {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useToast must be used inside <DialogProvider>');
  return ctx.toast;
}

export default function DialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean | string | null) => void }) | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean | string | null>((resolve) => {
      setInputValue(options.input?.defaultValue ?? '');
      setInputError('');
      setPending({ ...options, resolve });
    });
  }, []);

  const toast = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.slice(-2), { id, message, kind }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const close = useCallback(
    (value: boolean | string | null) => {
      if (!pending) return;
      const resolve = pending.resolve;
      setPending(null);
      resolve(value);
    },
    [pending],
  );

  const handleConfirm = useCallback(() => {
    if (!pending) return;
    if (pending.input) {
      const value = inputValue.trim();
      if (pending.input.required && !value) {
        setInputError('This field is required.');
        return;
      }
      if (pending.input.inputType === 'number' && value && Number.isNaN(parseInt(value, 10))) {
        setInputError('Please enter a number.');
        return;
      }
      close(value);
      return;
    }
    close(true);
  }, [pending, inputValue, close]);

  // Escape cancels; focus the Cancel button when the modal opens.
  useEffect(() => {
    if (!pending) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(pending.input ? null : false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pending, close]);

  return (
    <DialogContext.Provider value={{ confirm, toast }}>
      {children}

      {pending && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[#221A14]/50 p-4"
          onClick={() => close(pending.input ? null : false)}
          role="presentation"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby="dialog-message"
            className="w-full max-w-sm rounded-2xl border border-[#E7DFD6] bg-white p-6 shadow-[0_16px_40px_-6px_rgba(34,26,20,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="dialog-title" className="text-lg font-bold text-[#221A14]">
              {pending.title}
            </h2>
            <p id="dialog-message" className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-[#6B5D52]">
              {pending.message}
            </p>

            {pending.input && (
              <div className="mt-4">
                <label htmlFor="dialog-input" className="mb-1.5 block text-[13px] font-semibold text-[#221A14]">
                  {pending.input.label}
                </label>
                <input
                  id="dialog-input"
                  type={pending.input.inputType === 'number' ? 'number' : 'text'}
                  value={inputValue}
                  placeholder={pending.input.placeholder}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setInputError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirm();
                  }}
                  className="w-full rounded-xl border border-[#E7DFD6] bg-white px-3.5 py-2.5 text-[15px] text-[#221A14] outline-none focus:border-[#8A5A33] focus:ring-2 focus:ring-[#8A5A33]/15"
                />
                {inputError && <p className="mt-1.5 text-[13px] text-[#A33B2E]">{inputError}</p>}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                ref={cancelRef}
                onClick={() => close(pending.input ? null : false)}
                className="rounded-full border border-[#E7DFD6] bg-white px-5 py-2.5 text-sm font-semibold text-[#221A14] transition-colors hover:bg-[#FBF9F6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A5A33]"
              >
                {pending.cancelLabel ?? 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A5A33] ${
                  pending.destructive ? 'bg-[#A33B2E] hover:bg-[#8E3328]' : 'bg-[#221A14] hover:bg-[#3a2d24]'
                }`}
              >
                {pending.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts: small dark pill, bottom-centre, auto-dismiss */}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[110] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#221A14] px-4 py-2.5 text-sm font-medium text-white shadow-lg"
          >
            <span
              aria-hidden
              className={`h-2 w-2 shrink-0 rounded-full ${t.kind === 'error' ? 'bg-[#E0806E]' : 'bg-[#7FB08F]'}`}
            />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </DialogContext.Provider>
  );
}
