import { imageUploadConfig, type ImageContentType } from "@kcom/media";

const apiUrl = () => (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

interface SignResponse {
  uploadUrl: string;
  apiKey: string;
  signature: string;
  params: Record<string, string | number>;
  maxBytes: number;
}

export interface UploadedImage {
  src: string;
  width?: number;
  height?: number;
}

export class UploadError extends Error {}

/** Checks the file against the shared upload rules; returns an error message or null. */
export function validateImageFile(file: File): string | null {
  if (!(file.type in imageUploadConfig.allowedTypes)) return "Use a PNG, JPEG or WebP image.";
  if (file.size > imageUploadConfig.maxBytes) {
    return `Image must be ${Math.round(imageUploadConfig.maxBytes / 1024 / 1024)} MB or smaller.`;
  }
  return null;
}

/** Signs with the API, then posts straight to Cloudinary. Resolves to the secure image URL and its size. */
export async function uploadImage(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<UploadedImage> {
  const invalid = validateImageFile(file);
  if (invalid) throw new UploadError(invalid);
  const signRes = await fetch(`${apiUrl()}/admin/uploads/sign`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType: file.type as ImageContentType, size: file.size }),
  });
  if (!signRes.ok) {
    throw new UploadError(
      signRes.status === 503
        ? "Image uploads are not set up yet."
        : "Could not start the upload. Try again.",
    );
  }
  const sign = (await signRes.json()) as SignResponse;
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sign.apiKey);
  form.append("signature", sign.signature);
  for (const [k, v] of Object.entries(sign.params)) form.append(k, String(v));

  return new Promise<UploadedImage>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", sign.uploadUrl);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onerror = () =>
      reject(new UploadError("Upload failed. Check your connection and try again."));
    xhr.onload = () => {
      try {
        const r = JSON.parse(xhr.responseText) as {
          secure_url?: string;
          width?: number;
          height?: number;
        };
        if (xhr.status >= 200 && xhr.status < 300 && r.secure_url) {
          return resolve({ src: r.secure_url, width: r.width, height: r.height });
        }
      } catch {
        /* fall through */
      }
      reject(new UploadError("Upload failed. Try again."));
    };
    xhr.send(form);
  });
}
