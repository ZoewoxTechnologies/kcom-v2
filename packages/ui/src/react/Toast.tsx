import * as RadixToast from "@radix-ui/react-toast";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export type ToastVariant = "success" | "error" | "info";

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  /** Milliseconds before auto-dismiss. Defaults to 4000; errors persist unless set. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  /** Bumped by update so the toast remounts and its timer restarts. */
  rev: number;
  variant: ToastVariant;
  open: boolean;
}

interface ToastApi {
  /** Shows a toast and returns its id. */
  toast: (options: ToastOptions) => number;
  /** Changes a toast in place. Omitted fields keep their value; the timer restarts. */
  update: (id: number, options: Partial<ToastOptions>) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export const DEFAULT_TOAST_DURATION = 4000;

/** Toast API. Must be used under ToastProvider. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

/** Wrap the app once. Import "@kcom/ui/toast.css". Error toasts stay until dismissed. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setItems((prev) => [
      ...prev,
      { ...options, id, rev: 0, variant: options.variant ?? "info", open: true },
    ]);
    return id;
  }, []);

  const update = useCallback((id: number, options: Partial<ToastOptions>) => {
    setItems((prev) =>
      prev.map((t) => {
        if (t.id !== id || !t.open) return t;
        // An explicit new variant resets the default duration unless one is given.
        const next = { ...t, ...options, rev: t.rev + 1 };
        if (options.variant && options.duration === undefined) next.duration = undefined;
        return next;
      }),
    );
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, open: false } : t)));
  }, []);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const api = useMemo(() => ({ toast, update, dismiss }), [toast, update, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      <RadixToast.Provider swipeDirection="right" label="Notifications">
        {children}
        {items.map((t) => (
          <ToastView
            key={`${t.id}-${t.rev}`}
            item={t}
            onOpenChange={(open) => {
              if (!open) dismiss(t.id);
            }}
            onExited={() => remove(t.id)}
          />
        ))}
        <RadixToast.Viewport className="kc-toast-viewport" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

function ToastView({
  item: t,
  onOpenChange,
  onExited,
}: {
  item: ToastItem;
  onOpenChange: (open: boolean) => void;
  onExited: () => void;
}) {
  // Radix pauses its timer on hover and focus; the progress bar follows it.
  const [paused, setPaused] = useState(false);
  const duration = t.duration ?? (t.variant === "error" ? Infinity : DEFAULT_TOAST_DURATION);
  const timed = Number.isFinite(duration);

  return (
    <RadixToast.Root
      className="kc-toast"
      data-variant={t.variant}
      data-paused={paused || undefined}
      type={t.variant === "error" ? "foreground" : "background"}
      duration={duration}
      open={t.open}
      onOpenChange={onOpenChange}
      onPause={() => setPaused(true)}
      onResume={() => setPaused(false)}
      onAnimationEnd={(event) => {
        if (!t.open && event.target === event.currentTarget) onExited();
      }}
    >
      <div className="kc-toast__body">
        <RadixToast.Title className="kc-toast__title">{t.title}</RadixToast.Title>
        {t.description && (
          <RadixToast.Description className="kc-toast__description">
            {t.description}
          </RadixToast.Description>
        )}
      </div>
      <RadixToast.Close className="kc-toast__close" aria-label="Dismiss">
        <span aria-hidden="true">×</span>
      </RadixToast.Close>
      {timed && (
        <span
          className="kc-toast__progress"
          aria-hidden="true"
          style={{ "--kc-toast-duration": `${duration}ms` } as CSSProperties}
        />
      )}
    </RadixToast.Root>
  );
}
