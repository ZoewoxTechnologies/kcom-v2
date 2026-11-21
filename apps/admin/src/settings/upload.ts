import { apiJson } from "../api/client";

interface Signed {
  uploadUrl: string;
  apiKey: string;
  signature: string;
  params: Record<string, string | number>;
  maxBytes: number;
}

/** Uploads an image straight to Cloudinary with an API-signed request; resolves to its https URL. */
export async function uploadImage(file: File): Promise<string> {
  const signed = await apiJson<Signed>("/admin/uploads/sign", {
    method: "POST",
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  });
  const form = new FormData();
  for (const [key, value] of Object.entries(signed.params)) form.set(key, String(value));
  form.set("api_key", signed.apiKey);
  form.set("signature", signed.signature);
  form.set("file", file);
  const res = await fetch(signed.uploadUrl, { method: "POST", body: form });
  if (!res.ok) throw new Error("upload failed");
  const { secure_url } = (await res.json()) as { secure_url: string };
  return secure_url;
}
