import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Promise-based confirm dialog built on the native <dialog> element — no
 * dependency, and showModal() gives focus-trap, Escape-to-close, an inert
 * background and ::backdrop for free (WCAG-friendly out of the box).
 *
 * Usage:
 *   const { confirm, dialog } = useConfirm();
 *   if (await confirm({ title: '…', danger: true })) { … }
 *   return (<div>… {dialog}</div>);
 */
export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function useConfirm() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setOpts(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (opts && dlg && !dlg.open) dlg.showModal();
  }, [opts]);

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    dialogRef.current?.close();
    setOpts(null);
  }, []);

  const dialog = (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      onCancel={(e) => {
        e.preventDefault(); // Escape → treat as cancel, close ourselves
        settle(false);
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) settle(false); // backdrop click
      }}
    >
      {opts && (
        <div className="confirm-dialog-inner">
          <h3 className="confirm-dialog-title">{opts.title}</h3>
          {opts.description && <p className="confirm-dialog-desc">{opts.description}</p>}
          <div className="confirm-dialog-actions">
            <button type="button" className="btn btn-ghost" autoFocus onClick={() => settle(false)}>
              {opts.cancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              className={`btn ${opts.danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => settle(true)}
            >
              {opts.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );

  return { confirm, dialog };
}
