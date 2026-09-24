// Cifrado de los datos de acceso del panel.
// El usuario y la contraseña NO se guardan en ningún sitio: se usan para derivar una clave
// (PBKDF2) que descifra el token de GitHub. Si el usuario o la contraseña no son correctos,
// el descifrado falla. En el código solo hay datos cifrados.
// Funciona igual en el navegador y en Node (Web Crypto).

export type Credenciales = {
  v: 1;
  iteraciones: number;
  sal: string;
  iv: string;
  datos: string;
};

export type Secreto = {
  token: string;
  repo: string; // "usuario/repositorio"
  rama: string;
};

const aBase64 = (b: ArrayBuffer | Uint8Array) => {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s);
};
const deBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derivarClave(usuario: string, clave: string, sal: Uint8Array, iteraciones: number) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${usuario.trim()}\u0000${clave}`),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iteraciones },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function cifrar(secreto: Secreto, usuario: string, clave: string): Promise<Credenciales> {
  const iteraciones = 600_000;
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const llave = await derivarClave(usuario, clave, sal, iteraciones);
  const datos = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    llave,
    new TextEncoder().encode(JSON.stringify(secreto))
  );
  return { v: 1, iteraciones, sal: aBase64(sal), iv: aBase64(iv), datos: aBase64(datos) };
}

/** Devuelve el secreto si usuario y contraseña son correctos, o null si no. */
export async function descifrar(cred: Credenciales, usuario: string, clave: string): Promise<Secreto | null> {
  try {
    const llave = await derivarClave(usuario, clave, deBase64(cred.sal), cred.iteraciones);
    const datos = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deBase64(cred.iv) }, llave, deBase64(cred.datos));
    return JSON.parse(new TextDecoder().decode(datos));
  } catch {
    return null;
  }
}
