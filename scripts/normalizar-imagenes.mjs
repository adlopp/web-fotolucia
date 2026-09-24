// Deja todas las fotos de las categorías cuadradas (800x800) y las portadas del blog en 900x600.
// Uso: npm run imagenes
import sharp from "sharp";
import { readdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

sharp.cache(false); // en Windows la caché deja los archivos bloqueados

const RAIZ = "public/uploads";

for (const carpeta of readdirSync(RAIZ)) {
  const dir = join(RAIZ, carpeta);
  if (!statSync(dir).isDirectory()) continue;
  const esBlog = carpeta === "blog";
  const [ancho, alto] = esBlog ? [900, 600] : [800, 800];

  for (const archivo of readdirSync(dir)) {
    if (!/\.(jpe?g|png|webp)$/i.test(archivo)) continue;
    const ruta = join(dir, archivo);
    const meta = await sharp(ruta).metadata();
    if (meta.width === ancho && meta.height === alto) continue;

    const tmp = ruta + ".tmp";
    await sharp(ruta)
      .rotate()
      .resize(ancho, alto, { fit: "cover", position: "centre" })
      .jpeg({ quality: 84, mozjpeg: true })
      .toFile(tmp);
    renameSync(tmp, ruta);
    console.log(`✓ ${ruta} (${meta.width}x${meta.height} → ${ancho}x${alto})`);
  }
}
