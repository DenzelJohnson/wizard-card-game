import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';

export interface AccessibleDialogProps {
  readonly open: boolean;
  readonly titleId: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly initialFocusRef?: RefObject<HTMLElement | null>;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
  readonly className?: string;
}

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  '[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function AccessibleDialog({
  open,
  titleId,
  onClose,
  children,
  initialFocusRef,
  returnFocusRef,
  className,
}: AccessibleDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }

    openerRef.current =
      returnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    let usingFallback = !supportsModalDialog();
    if (supportsModalDialog()) {
      try {
        if (!dialog.open) {
          dialog.showModal();
        }
        usingFallback = !dialog.open;
      } catch {
        usingFallback = true;
      }
    }
    const inertedElements = usingFallback ? makeBackgroundInert(dialog) : [];
    if (usingFallback) {
      dialog.setAttribute('open', '');
    }

    const firstFocusable = (): HTMLElement | null =>
      initialFocusRef?.current ?? dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable()?.focus();

    const containFocus = (event: FocusEvent): void => {
      if (!dialog.contains(event.target as Node)) {
        firstFocusable()?.focus();
      }
    };
    document.addEventListener('focusin', containFocus);

    return () => {
      document.removeEventListener('focusin', containFocus);
      restoreBackground(inertedElements);
      try {
        if (dialog.open && typeof dialog.close === 'function') {
          dialog.close();
        } else {
          dialog.removeAttribute('open');
        }
      } catch {
        dialog.removeAttribute('open');
      }

      const opener = openerRef.current;
      if (opener?.isConnected) {
        opener.focus();
      }
    };
  }, [initialFocusRef, open, returnFocusRef]);

  if (!open) {
    return null;
  }

  const trapTab = (event: ReactKeyboardEvent<HTMLDialogElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const atStart = currentIndex <= 0;
    const atEnd = currentIndex === focusable.length - 1;
    if ((event.shiftKey && atStart) || (!event.shiftKey && (atEnd || currentIndex < 0))) {
      event.preventDefault();
      focusable[event.shiftKey ? focusable.length - 1 : 0]?.focus();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={className}
      open={supportsModalDialog() ? undefined : true}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={trapTab}
    >
      {children}
    </dialog>
  );
}

function supportsModalDialog(): boolean {
  return (
    typeof HTMLDialogElement !== 'undefined' &&
    typeof HTMLDialogElement.prototype.showModal === 'function'
  );
}

interface InertedElement {
  readonly element: HTMLElement;
  readonly ariaHidden: string | null;
}

function makeBackgroundInert(dialog: HTMLDialogElement): InertedElement[] {
  const inerted: InertedElement[] = [];
  let current: HTMLElement = dialog;

  while (current !== document.body && current.parentElement !== null) {
    const parent = current.parentElement;
    for (const sibling of Array.from(parent.children)) {
      if (!(sibling instanceof HTMLElement) || sibling === current || sibling.hasAttribute('inert')) {
        continue;
      }
      inerted.push({ element: sibling, ariaHidden: sibling.getAttribute('aria-hidden') });
      sibling.setAttribute('inert', '');
      sibling.setAttribute('aria-hidden', 'true');
    }
    current = parent;
  }

  return inerted;
}

function restoreBackground(inerted: readonly InertedElement[]): void {
  for (const { element, ariaHidden } of inerted) {
    element.removeAttribute('inert');
    if (ariaHidden === null) {
      element.removeAttribute('aria-hidden');
    } else {
      element.setAttribute('aria-hidden', ariaHidden);
    }
  }
}
