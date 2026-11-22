import { Button, IconButton, TextField, TextareaField } from "@kcom/ui";
import { ImageUploadField } from "../editor";
import { RichTextEditor, emptyRichText, type RichTextDoc } from "../richtext/RichTextEditor";

type Props = Record<string, unknown>;
interface Card {
  title?: string;
  subtitle?: string;
  text?: string;
  [key: string]: unknown;
}

interface FormProps {
  type: string;
  id: string;
  props: Props;
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (props: Props) => void;
}

const s = (v: unknown) => (typeof v === "string" ? v : "");

const TRASH = (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
  </svg>
);

/** The fields for one kind of block. Props it doesn't show are kept as they are. */
export function BlockForm({ type, id, props, errors, disabled, onChange }: FormProps) {
  const set = (patch: Props) => onChange({ ...props, ...patch });
  const text = (key: string, label: string, opts: { required?: boolean; area?: boolean } = {}) => {
    const common = {
      label,
      value: s(props[key]),
      disabled,
      error: errors[key],
      required: opts.required,
      optional: !opts.required,
      onChange: (e: { target: { value: string } }) => set({ [key]: e.target.value }),
    };
    return opts.area ? <TextareaField rows={3} {...common} /> : <TextField {...common} />;
  };

  switch (type) {
    case "hero":
      return (
        <>
          {text("eyebrow", "Small heading above")}
          {text("heading", "Heading", { required: true })}
          {text("subheading", "Subheading", { area: true })}
          <ImageUploadField
            label="Image"
            value={s(props.imageUrl) || null}
            disabled={disabled}
            onChange={(url) => set({ imageUrl: url ?? "" })}
          />
        </>
      );
    case "richText":
      return (
        <>
          {text("heading", "Heading")}
          <div>
            <span className="kc-site-page__label" id={`${id}-body`}>
              Text
            </span>
            <RichTextEditor
              aria-labelledby={`${id}-body`}
              value={(props.body as RichTextDoc | undefined) ?? emptyRichText}
              disabled={disabled}
              onChange={(body) => set({ body })}
            />
          </div>
        </>
      );
    case "quote":
      return (
        <>
          {text("text", "Quote", { required: true, area: true })}
          {text("cite", "Who said it")}
        </>
      );
    case "image":
      return (
        <>
          <ImageUploadField
            label="Image"
            value={s(props.url) || null}
            disabled={disabled}
            onChange={(url) => set({ url: url ?? "" })}
          />
          {errors.url && <p className="kc-site-page__error">{errors.url}</p>}
          {text("alt", "Description for screen readers")}
          {text("caption", "Caption")}
        </>
      );
    case "cta":
      return (
        <>
          {text("text", "Text above the button", { area: true })}
          {text("label", "Button label", { required: true })}
          {text("url", "Link", { required: true })}
        </>
      );
    case "cardGrid": {
      const cards = (props.cards as Card[] | undefined) ?? [];
      const setCard = (i: number, patch: Card) =>
        set({ cards: cards.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
      return (
        <>
          {text("heading", "Heading")}
          {text("intro", "Introduction", { area: true })}
          {errors.cards && <p className="kc-site-page__error">{errors.cards}</p>}
          {cards.map((card, i) => (
            <div className="kc-site-page__card" key={i}>
              <TextField
                label={`Card ${i + 1} title`}
                required
                disabled={disabled}
                value={s(card.title)}
                onChange={(e) => setCard(i, { title: e.target.value })}
              />
              <TextField
                label={`Card ${i + 1} subtitle`}
                optional
                disabled={disabled}
                value={s(card.subtitle)}
                onChange={(e) => setCard(i, { subtitle: e.target.value })}
              />
              <TextareaField
                label={`Card ${i + 1} text`}
                optional
                rows={3}
                disabled={disabled}
                value={s(card.text)}
                onChange={(e) => setCard(i, { text: e.target.value })}
              />
              <IconButton
                label={`Remove card ${i + 1}`}
                icon={TRASH}
                disabled={disabled}
                onClick={() => set({ cards: cards.filter((_, j) => j !== i) })}
              />
            </div>
          ))}
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => set({ cards: [...cards, { title: "" }] })}
          >
            Add card
          </Button>
        </>
      );
    }
    case "bankDetails":
      return <p className="kc-site-page__note">Shows the bank details saved under Settings.</p>;
    default:
      return (
        <p className="kc-site-page__note">
          This block can&rsquo;t be edited here. It is kept as it is.
        </p>
      );
  }
}
