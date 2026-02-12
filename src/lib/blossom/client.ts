/**
 * Blossom server client — BUD-01 through BUD-06.
 * Handles upload, fetch, and L402 payment flow.
 */

export interface BlossomServer {
  url: string;
  pubkey?: string;
}

export interface BlobDescriptor {
  sha256: string;
  size: number;
  type?: string;
  url: string;
}

/** Upload a blob to a Blossom server (BUD-02) */
export async function uploadBlob(
  server: BlossomServer,
  data: ArrayBuffer,
  authHeader?: string
): Promise<BlobDescriptor> {
  const res = await fetch(`${server.url}/upload`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/octet-stream",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: data,
  });

  if (!res.ok) throw new Error(`Blossom upload failed: ${res.status}`);
  return res.json();
}

/** Fetch a blob by SHA256 hash (BUD-01) */
export async function fetchBlob(
  server: BlossomServer,
  sha256: string
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  const res = await fetch(`${server.url}/${sha256}`);

  if (res.status === 402) {
    // L402 required — return null, caller handles payment
    return null;
  }
  if (!res.ok) return null;

  return {
    data: await res.arrayBuffer(),
    contentType: res.headers.get("content-type") ?? "application/octet-stream",
  };
}

/** Check if a blob exists on a server (HEAD request) */
export async function hasBlob(
  server: BlossomServer,
  sha256: string
): Promise<boolean> {
  try {
    const res = await fetch(`${server.url}/${sha256}`, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/** List blobs on a server (BUD-04) */
export async function listBlobs(
  server: BlossomServer,
  pubkey?: string
): Promise<BlobDescriptor[]> {
  const url = pubkey
    ? `${server.url}/list/${pubkey}`
    : `${server.url}/list`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

/**
 * Resolve a content hash across multiple servers.
 * Returns first available server URL.
 */
export async function resolveBlob(
  servers: BlossomServer[],
  sha256: string
): Promise<{ server: BlossomServer; url: string } | null> {
  for (const server of servers) {
    if (await hasBlob(server, sha256)) {
      return { server, url: `${server.url}/${sha256}` };
    }
  }
  return null;
}

/** Hash a file in the browser using Web Crypto API */
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
