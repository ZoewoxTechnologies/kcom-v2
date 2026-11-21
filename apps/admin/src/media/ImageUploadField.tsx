import { useRef, useState } from "react";
import { Button, Field } from "@kcom/ui";
import { uploadImage, UploadError, validateImageFile } from "../richtext/uploadImage";

export interface ImageUploadFieldProps {
  label: string;
  /** Current image URL, or null when there is none. */
  value: string | null;
  onChange: (url: string | null) => void;
  help?: string;
  optional?: boolean;
  disabled?: boolean;
  /** Preview shape, as a CSS aspect-ratio. */
  aspectRatio?: string;
}

/** Pick an image, upload it to Cloudinary through the admin API, and preview it. */
export function ImageUploadField({
  label,
  value,
  onChange,
  help,
  optional,
  disabled,
  aspectRatio = "2 / 3",
}: ImageUploadFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string>();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) return setError(invalid);
    setError(undefined);
    setProgress(0);
    try {
      const image = await uploadImage(file, setProgress);
      onChange(image.src);
    } catch (err) {
      setError(err instanceof UploadError ? err.message : "Upload failed. Try again.");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  };

  const uploading = progress !== null;
  return (
    <Field label={label} help={help} error={error} optional={optional}>
      {(c) => (
        <div className="kc-image-upload">
          <div className="kc-image-upload__preview" style={{ aspectRatio }}>
            {value ? <img src={value} alt="" /> : <span>No image</span>}
          </div>
          <div className="kc-image-upload__actions">
            <input
              ref={input}
              id={c.id}
              className="kc-image-upload__input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={disabled || uploading}
              aria-describedby={c["aria-describedby"]}
              aria-invalid={c["aria-invalid"]}
              onChange={(e) => void pick(e.target.files?.[0])}
            />
            <Button
              variant="secondary"

              disabled={disabled || uploading}
              onClick={() => input.current?.click()}
            >
              {uploading
                ? `Uploading ${Math.round((progress ?? 0) * 100)}%`
                : value
                  ? "Replace"
                  : "Upload image"}
            </Button>
            {value && !uploading && (
              <Button variant="tertiary" disabled={disabled} onClick={() => onChange(null)}>
                Remove
              </Button>
            )}
          </div>
        </div>
      )}
    </Field>
  );
}
