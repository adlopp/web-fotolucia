# Web de Lucía (en construcción, fotos provisionales generadas con IA)

Portfolio de fotografía con blog, hecho como sitio estático (Astro),
desplegado gratis en GitHub Pages y con un panel de administración propio
para gestionar las fotos sin tocar código.

Web publicada: https://adlopp.github.io/web-fotolucia/

## Cómo está organizado este repo

- `content/` — el contenido de la web, en archivos de texto (lo edita el panel).
  - `categorias/` — una ficha `.json` por categoría: nombre, descripción, orden y lista de fotos.
  - `blog/` — una entrada `.md` por archivo: título, fecha, portada, resumen y texto.
- `public/uploads/` — las imágenes, una carpeta por categoría más `blog/`.
- `src/` — el proyecto Astro.
  - `pages/` — las páginas: inicio, `fotografias/`, `blog/`, `contacto` y `admin`.
  - `components/`, `layouts/`, `styles/` — piezas reutilizables, plantilla base y estilos globales.
  - `admin/` — lógica del panel: login cifrado (`cripto.ts`), guardado local o en GitHub (`almacen.ts`) y la interfaz (`panel.ts`).
  - `admin/credenciales.json` — acceso al panel **cifrado** (no contiene ni el usuario ni la contraseña).
  - `site.ts` — nombre de la web, subtítulo y descripción.
- `scripts/` — utilidades de Node.
  - `configurar-admin.ts` — crea `credenciales.json` (`npm run configurar-admin`).
  - `normalizar-imagenes.mjs` — deja todas las fotos del mismo tamaño (`npm run imagenes`).
  - `admin-local.mjs` — permite que el panel guarde en los archivos del ordenador con `npm run dev`.
- `.github/workflows/publicar.yml` — publica en GitHub Pages en cada push a `main`.

## Panel de administración

Se entra con el candado 🔒 a la derecha de «Contacto» (o en `/admin`).

- **Categorías:** añadir, modificar (nombre y fotos desde el ordenador) y eliminar (con confirmación).
- **Blog:** en construcción.
- **Cerrar panel:** cierra la sesión.

En la web publicada, cada cambio se guarda como un commit en GitHub y la web
se actualiza sola en 1–2 minutos. El usuario y la contraseña solo sirven para
descifrar un token de GitHub con permiso únicamente sobre este repositorio.
Para cambiarlos o renovar el token: `npm run configurar-admin`, y después hacer
commit y push de `src/admin/credenciales.json`.

## Trabajar en local

```
npm install      # la primera vez
npm run dev      # web en http://localhost:4321 y panel en /admin (guarda en los archivos)
npm run build    # compila la web en dist/
```

Antes de tocar nada en local, ejecuta `git pull`: el panel también hace commits.

## Estado actual

Hecho: portfolio con 4 categorías (animales, retratos, paisajes y fotografía
callejera), galería con visor a pantalla completa, blog con 3 entradas de
ejemplo, panel de administración de categorías y publicación automática en
GitHub Pages.

Siguiente paso: sustituir las fotos generadas con IA por las reales, hacer la
página de Contacto, completar la gestión del blog en el panel y usar una
contraseña más larga (12 caracteres o más).
