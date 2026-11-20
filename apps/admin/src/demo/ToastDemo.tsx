import { Button, useToast } from "@kcom/ui";
import { useEffect, useRef } from "react";

/** Every toast variant. Add ?toasts to the URL to open all three on load. */
export function ToastDemo() {
  const { toast, update } = useToast();
  const opened = useRef(false);

  useEffect(() => {
    if (!new URLSearchParams(location.search).has("toasts") || opened.current) return;
    opened.current = true;
    toast({ variant: "success", title: "Saved as draft", duration: 60000 });
    toast({
      variant: "info",
      title: "New capsule available",
      description: "Today's capsule has been published.",
      duration: 60000,
    });
    toast({
      variant: "error",
      title: "Couldn't save",
      description: "Check your connection and try again.",
    });
  }, [toast]);

  return (
    <section>
      <h2>Toasts</h2>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Button onClick={() => toast({ variant: "success", title: "Saved as draft" })}>
          Success
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast({
              variant: "info",
              title: "New capsule available",
              description: "Today's capsule has been published.",
            })
          }
        >
          Info
        </Button>
        <Button
          variant="tertiary"
          onClick={() =>
            toast({
              variant: "error",
              title: "Couldn't save",
              description: "Check your connection and try again.",
            })
          }
        >
          Error (stays)
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            const id = toast({ variant: "info", title: "Saving…", duration: 60000 });
            setTimeout(
              () => update(id, { variant: "success", title: "Saved", duration: 4000 }),
              1500,
            );
          }}
        >
          Saving → Saved
        </Button>
      </div>
    </section>
  );
}
