import { useId, useRef, useState } from "react";
import { Button } from "@kcom/ui";
import { uploadImage as defaultUpload, validateImageFile } from "../richtext/uploadImage";
import type { UploadedImage } from "../richtext/uploadImage";

export interface ImageUploadFieldProps {
  label: string;
  /** Current image URL, or null when none. */
  value: string | null;
  onChange: (url: string | null) => void;
  help?: string;
  upload?: (file: File, onProgress: (fraction: number) => void) => Promise<UploadedImage>;
  disabled?: boolean;
  /** Shape of the preview, width over height. Default 16/9; use 1 for portraits. */
  aspectRatio?: number;
}

/** Pick, upload and preview one image. Uploads straight to Cloudinary through the admin API. */
export function ImageUploadField({
  label,
  value,
  onChange,
  help,
  upload = defaultUpload,
  disabled,
  aspectRatio = 16 / 9,
}: ImageUploadFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) return setError(invalid);
    setError(null);
    setProgress(0);
    try {
      const { src } = await upload(file, setProgress);
      onChange(src);
    } catch {
      setError("Couldn’t upload the image. Try again.");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="kc-image-field">
      <span className="kc-image-field__label" id={`${id}-label`}>
        {label}
      </span>
      {value && (
        <img
          className={`kc-image-field__preview${aspectRatio <= 1 ? " kc-image-field__preview--narrow" : ""}`}
          style={{ aspectRatio }}
          src={value}
          alt=""
        />
      )}
      <div className="kc-image-field__actions">
        <Button
          variant="secondary"
          disabled={disabled || progress !== null}
          onClick={() => input.current?.click()}
        >
          {progress !== null
            ? `Uploading ${Math.round(progress * 100)}%`
            : value
              ? "Replace image"
              : "Choose image"}
        </Button>
        {value && (
          <Button variant="tertiary" disabled={disabled} onClick={() => onChange(null)}>
            Remove
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp"
        aria-labelledby={`${id}-label`}
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      {help && !error && <span className="kc-image-field__help">{help}</span>}
      {error && (
        <span className="kc-image-field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
