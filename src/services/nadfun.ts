import { z } from "zod";
import { config } from "../config";
import { AppError } from "../middleware/error";

const BASE = config.nadFunApiUrl;
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

// ─── Validation Schemas ──────────────────────────────────────────────────────
// Field names match what the frontend sends (user-friendly).
// We remap to nad.fun's expected field names before forwarding.

export const createMetadataSchema = z.object({
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(20),
  description: z.string().min(1).max(1000),
  image: z.string().url(),           // frontend sends "image", we remap to "image_uri"
  twitter: z.string().optional(),
  telegram: z.string().optional(),
  website: z.string().optional(),
});

export const getSaltSchema = z.object({
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(20),
  deployer: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  tokenURI: z.string().url(),         // frontend sends "tokenURI", we remap to "metadata_uri"
});

export type CreateMetadataInput = z.infer<typeof createMetadataSchema>;
export type GetSaltInput = z.infer<typeof getSaltSchema>;

// ─── Retry Helper ────────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastErr: Error | undefined;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (i < retries) await new Promise((r) => setTimeout(r, RETRY_DELAY * (i + 1)));
    }
  }
  throw lastErr;
}

// ─── Image Upload ────────────────────────────────────────────────────────────

export interface ImageUploadResult {
  url: string;
}

// nad.fun response: { is_nsfw: boolean, image_uri: string }
export async function uploadImage(imageBuffer: Buffer, contentType: string): Promise<ImageUploadResult> {
  const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  if (!allowedTypes.includes(contentType)) {
    throw new AppError(400, "INVALID_IMAGE_FORMAT", `Unsupported image type: ${contentType}. Allowed: ${allowedTypes.join(", ")}`);
  }

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (imageBuffer.length > maxSize) {
    throw new AppError(400, "IMAGE_TOO_LARGE", "Image must be under 5MB");
  }

  return withRetry(async () => {
    const res = await fetch(`${BASE}/metadata/image`, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: imageBuffer,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new AppError(502, "NADFUN_IMAGE_ERROR", `nad.fun image upload failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as { image_uri?: string };

    if (!data.image_uri) {
      throw new AppError(502, "NADFUN_IMAGE_ERROR", "nad.fun returned no image URL");
    }

    return { url: data.image_uri };
  });
}

// ─── Metadata Creation ───────────────────────────────────────────────────────

export interface MetadataResult {
  url: string;
}

// nad.fun expects: { name, symbol, description, image_uri, website?, twitter?, telegram? }
// nad.fun returns: { metadata_uri: string, metadata: { ... } }
export async function createMetadata(input: CreateMetadataInput): Promise<MetadataResult> {
  // Remap "image" → "image_uri" for nad.fun API
  const { image, ...rest } = input;
  const nadPayload = { ...rest, image_uri: image };

  return withRetry(async () => {
    const res = await fetch(`${BASE}/metadata/metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nadPayload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new AppError(502, "NADFUN_METADATA_ERROR", `nad.fun metadata creation failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as { metadata_uri?: string };

    if (!data.metadata_uri) {
      throw new AppError(502, "NADFUN_METADATA_ERROR", "nad.fun returned no metadata URL");
    }

    return { url: data.metadata_uri };
  });
}

// ─── Salt Generation ─────────────────────────────────────────────────────────

export interface SaltResult {
  salt: string;
  token: string; // predicted token address
}

// nad.fun expects: { name, symbol, creator, metadata_uri }
// nad.fun returns: { salt: string, address: string }
export async function getSalt(input: GetSaltInput): Promise<SaltResult> {
  // Remap "deployer" → "creator", "tokenURI" → "metadata_uri" for nad.fun API
  const nadPayload = {
    name: input.name,
    symbol: input.symbol,
    creator: input.deployer,
    metadata_uri: input.tokenURI,
  };

  return withRetry(async () => {
    const res = await fetch(`${BASE}/token/salt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nadPayload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new AppError(502, "NADFUN_SALT_ERROR", `nad.fun salt generation failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as { salt?: string; address?: string };

    if (!data.salt || !data.address) {
      throw new AppError(502, "NADFUN_SALT_ERROR", "nad.fun returned incomplete salt data");
    }

    return { salt: data.salt, token: data.address };
  });
}
