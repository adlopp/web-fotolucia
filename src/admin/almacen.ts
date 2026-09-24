// Dónde lee y guarda el panel:
// - con `npm run dev`: en los archivos del ordenador (ver scripts/admin-local.mjs)
// - en la web publicada: en GitHub, con un commit por operación. GitHub Pages se vuelve a publicar solo.
import type { Secreto } from "./cripto";

export type Archivo = { ruta: string; contenido: string };
export type Cambio = { ruta: string; base64: string | null }; // null = borrar

export interface Almacen {
  listar(dir: string): Promise<Archivo[]>;
  guardar(cambios: Cambio[], mensaje: string): Promise<void>;
  local: boolean;
}

export const textoABase64 = (t: string) => {
  const bytes = new TextEncoder().encode(t);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

const base64ATexto = (b: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\n/g, "")), (c) => c.charCodeAt(0)));

async function comprobar(res: Response) {
  if (!res.ok) {
    let detalle = "";
    try {
      detalle = (await res.json()).message ?? "";
    } catch {}
    throw new Error(`Error ${res.status}${detalle ? `: ${detalle}` : ""}`);
  }
  return res;
}

export function almacenLocal(): Almacen {
  return {
    local: true,
    async listar(dir) {
      const res = await comprobar(await fetch(`/__admin/listar?dir=${encodeURIComponent(dir)}`));
      return res.json();
    },
    async guardar(cambios) {
      await comprobar(
        await fetch("/__admin/guardar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cambios }),
        })
      );
    },
  };
}

export function almacenGitHub({ token, repo, rama }: Secreto): Almacen {
  const api = `https://api.github.com/repos/${repo}`;
  const gh = async (ruta: string, init: RequestInit = {}) => {
    const res = await fetch(`${api}${ruta}`, {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    return (await comprobar(res)).json();
  };

  return {
    local: false,
    async listar(dir) {
      let lista: { name: string; path: string; type: string }[];
      try {
        lista = await gh(`/contents/${dir}?ref=${rama}`);
      } catch (e) {
        if (String(e).includes("404")) return [];
        throw e;
      }
      const archivos = lista.filter((f) => f.type === "file" && /\.(json|md)$/.test(f.name));
      return Promise.all(
        archivos.map(async (f) => {
          const datos = await gh(`/contents/${f.path}?ref=${rama}`);
          return { ruta: f.path, contenido: base64ATexto(datos.content) };
        })
      );
    },
    // Hace un único commit con todos los cambios (fotos + ficha de la categoría)
    async guardar(cambios, mensaje) {
      const ref = await gh(`/git/ref/heads/${rama}`);
      const ultimo = await gh(`/git/commits/${ref.object.sha}`);
      const arbol = await Promise.all(
        cambios.map(async (c) => {
          if (c.base64 === null) return { path: c.ruta, mode: "100644", type: "blob", sha: null };
          const blob = await gh(`/git/blobs`, {
            method: "POST",
            body: JSON.stringify({ content: c.base64, encoding: "base64" }),
          });
          return { path: c.ruta, mode: "100644", type: "blob", sha: blob.sha };
        })
      );
      const nuevoArbol = await gh(`/git/trees`, {
        method: "POST",
        body: JSON.stringify({ base_tree: ultimo.tree.sha, tree: arbol }),
      });
      const commit = await gh(`/git/commits`, {
        method: "POST",
        body: JSON.stringify({ message: mensaje, tree: nuevoArbol.sha, parents: [ref.object.sha] }),
      });
      await gh(`/git/refs/heads/${rama}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
    },
  };
}
