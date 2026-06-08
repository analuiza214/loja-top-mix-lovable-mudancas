// AES-GCM 256-bit — formato: base64(iv_12bytes + ciphertext)
async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32)),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptData(plaintext: string, secret: string): Promise<string> {
  const key = await getKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  // Concatena IV (12 bytes) + ciphertext e retorna como base64
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  return btoa(String.fromCharCode(...combined));
}

export async function decryptData(encrypted: string, secret: string): Promise<string> {
  const key = await getKey(secret);

  // Suporta dois formatos: base64 único (iv+ciphertext) e legado iv:ciphertext
  let iv: Uint8Array;
  let ciphertext: Uint8Array;

  if (encrypted.includes(":")) {
    // Formato legado: "ivBase64:ciphertextBase64"
    const [ivB64, ctB64] = encrypted.split(":");
    iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
    ciphertext = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0));
  } else {
    // Formato atual: base64(iv_12bytes + ciphertext)
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    iv = combined.slice(0, 12);
    ciphertext = combined.slice(12);
  }

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}
