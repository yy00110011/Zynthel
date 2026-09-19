// 密码本加密工具：使用原生 Web Crypto（AES-GCM 256 + PBKDF2-SHA256）。
// 不引入 crypto-js 等额外依赖，密钥仅存内存，不落盘。

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** 派生主密钥：PBKDF2-SHA256，返回 CryptoKey（仅内存）。 */
export async function deriveKey(
  masterPassword: string,
  saltBase64: string,
  iterations: number,
): Promise<CryptoKey> {
  const salt = fromBase64(saltBase64);
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** 生成随机的 salt 和 IV。 */
export function generateSalt(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16))));
}

export function generateIv(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12))));
}

/** 加密一段明文，返回 base64（ciphertext + auth tag 合并）。 */
export async function encryptText(
  key: CryptoKey,
  ivBase64: string,
  plaintext: string,
): Promise<string> {
  const iv = fromBase64(ivBase64);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );
  return toBase64(new Uint8Array(encrypted));
}

/** 解密一段 base64 密文，返回明文。失败抛错。 */
export async function decryptText(
  key: CryptoKey,
  ivBase64: string,
  cipherBase64: string,
): Promise<string> {
  const iv = fromBase64(ivBase64);
  const data = fromBase64(cipherBase64);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  return decoder.decode(decrypted);
}

/** 生成一个用于校验主密码的 verifier：对固定哨兵串加密。 */
export async function makeVerifier(
  key: CryptoKey,
  ivBase64: string,
): Promise<string> {
  return encryptText(key, ivBase64, "solaris-vault-verifier");
}

/** 校验主密码是否正确：尝试解密 verifier 并与哨兵比对。 */
export async function verifyMasterPassword(
  masterPassword: string,
  saltBase64: string,
  iterations: number,
  ivBase64: string,
  verifier: string,
): Promise<boolean> {
  try {
    const key = await deriveKey(masterPassword, saltBase64, iterations);
    const plain = await decryptText(key, ivBase64, verifier);
    return plain === "solaris-vault-verifier";
  } catch {
    return false;
  }
}

/** 随机密码生成器。 */
export function generatePassword(length = 16, opts?: {
  upper?: boolean;
  lower?: boolean;
  digits?: boolean;
  symbols?: boolean;
}): string {
  const upper = opts?.upper ?? true;
  const lower = opts?.lower ?? true;
  const digits = opts?.digits ?? true;
  const symbols = opts?.symbols ?? true;
  let pool = "";
  if (upper) pool += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (lower) pool += "abcdefghijklmnopqrstuvwxyz";
  if (digits) pool += "0123456789";
  if (symbols) pool += "!@#$%^&*()-_=+";
  if (!pool) pool = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let result = "";
  for (let i = 0; i < length; i++) {
    result += pool[bytes[i] % pool.length];
  }
  return result;
}
