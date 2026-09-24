import { getCollection } from "astro:content";

// Las categorías marcadas como «ocultas» desde el panel no se enseñan en la web pública
// (ni en el inicio ni en su propia página, aunque alguien tenga el enlace guardado)
export async function categoriasOrdenadas() {
  const cats = await getCollection("categorias");
  return cats
    .filter((c) => !c.data.oculta)
    .sort((a, b) => (a.data.orden ?? 99) - (b.data.orden ?? 99) || a.data.titulo.localeCompare(b.data.titulo));
}

// Las entradas marcadas como «ocultas» desde el panel no se enseñan en la web pública.
// El orden es el que se arrastra en el panel; si una entrada no lo tiene (aún no se ha tocado
// desde que existe esta opción), se ordena por fecha, la más reciente primero.
export async function entradasOrdenadas() {
  const posts = await getCollection("blog");
  return posts
    .filter((p) => !p.data.oculta)
    .sort((a, b) => {
      const oa = a.data.orden,
        ob = b.data.orden;
      if (oa != null && ob != null) return oa - ob;
      if (oa != null) return -1;
      if (ob != null) return 1;
      return b.data.fecha.getTime() - a.data.fecha.getTime();
    });
}

// Portada de la categoría: la primera foto que no esté oculta (si no hay, la portada guardada)
export const portadaDe = (c: {
  data: { portada?: string | null; fotos: { imagen: string; oculta?: boolean | null }[] };
}) => c.data.fotos.find((f) => !f.oculta)?.imagen || c.data.portada;
