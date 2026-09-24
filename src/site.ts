// Datos generales de la web
export const SITE = {
  nombre: "Foto",
  subtitulo: "Lucía",
  descripcion: "Fotografía de animales, retratos, paisajes y calle. Y un pequeño blog.",
};

// Añade la subcarpeta de GitHub Pages (/web-fotolucia) a enlaces e imágenes: url("/blog")
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
export const url = (ruta: string) => `${BASE}${ruta}`;

export const formatoFecha = (d: Date) =>
  d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
