import * as RadixToast from "@radix-ui/react-toast";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
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
  variant: ToastVariant;
  open: boolean;
}

interface ToastApi {
  /** Shows a toast and returns its id. */
  toast: (options: ToastOptions) => number;
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
    setItems((prev) => [...prev, { ...options, id, variant: options.variant ?? "info", open: true }]);
    return id;
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, open: false } : t)));
  }, []);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      <RadixToast.Provider swipeDirection="right" label="Notifications">
        {children}
        {items.map((t) => (
          <RadixToast.Root
            key={t.id}
            className="kc-toast"
            data-variant={t.variant}
            type={t.variant === "error" ? "foreground" : "background"}
            duration={t.duration ?? (t.variant === "error" ? Infinity : DEFAULT_TOAST_DURATION)}
            open={t.open}
            onOpenChange={(open) => {
              if (!open) dismiss(t.id);
            }}
            onAnimationEnd={() => {
              if (!t.open) remove(t.id);
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
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="kc-toast-viewport" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
