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

// Portada de la categoría: la elegida, o si no la primera foto
export const portadaDe = (c: { data: { portada?: string | null; fotos: { imagen: string }[] } }) =>
  c.data.portada || c.data.fotos[0]?.imagen;
