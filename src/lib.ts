import { getCollection } from "astro:content";

export async function categoriasOrdenadas() {
  const cats = await getCollection("categorias");
  return cats.sort(
    (a, b) => (a.data.orden ?? 99) - (b.data.orden ?? 99) || a.data.titulo.localeCompare(b.data.titulo)
  );
}

export async function entradasOrdenadas() {
  const posts = await getCollection("blog");
  return posts.sort((a, b) => b.data.fecha.getTime() - a.data.fecha.getTime());
}

// Portada de la categoría: la primera foto (si no tiene fotos, la portada guardada)
export const portadaDe = (c: { data: { portada?: string | null; fotos: { imagen: string }[] } }) =>
  c.data.fotos[0]?.imagen || c.data.portada;
