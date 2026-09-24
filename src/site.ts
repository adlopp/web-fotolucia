// Datos generales de la web
export const SITE = {
  nombre: "Foto",
  subtitulo: "Lucía",
  descripcion: "Fotografía de animales, retratos, paisajes y calle. Y un pequeño blog.",
  instagram: "lairinx",
  correo: "lopezluciam7@gmail.com",
  // Formulario de contacto: crea una cuenta gratis en https://formspree.io, un formulario nuevo
  // y pega aquí su dirección (algo como "https://formspree.io/f/xxxxxxxx"). Hasta entonces el
  // formulario no puede enviar mensajes.
  formulario: "https://formspree.io/f/REEMPLAZAR",
};

// Añade la subcarpeta de GitHub Pages a enlaces e imágenes, si la hay: url("/blog")
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
export const url = (ruta: string) => `${BASE}${ruta}`;

export const formatoFecha = (d: Date) =>
  d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

// Para el botón de traducción (bandera)
export const formatoFechaEn = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
