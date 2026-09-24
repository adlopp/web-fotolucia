# Web de Lucía: fotografía y blog

Web publicada: https://adlopp.github.io/web-fotolucia/

## Panel de administración

Se entra con el candado 🔒 que hay a la derecha de «Contacto» (o en `/admin`).

1. **Categorías**
   - **Añadir categoría:** pide el nombre y la crea vacía.
   - **Modificar:** cambiar el nombre, añadir imágenes desde el ordenador y quitar fotos (✕). Después, «Guardar cambios».
   - **Eliminar:** pide confirmación y borra la categoría con todas sus fotos.
2. **Blog:** en construcción.
3. **Cerrar panel:** cierra la sesión y vuelve a la portada.

En la web publicada, cada cambio se guarda en GitHub y la web se actualiza sola en **1–2 minutos**.

Las fotos se reducen automáticamente a un máximo de 2000 px antes de subirlas. En la galería todas se ven del mismo tamaño (cuadradas); al pulsar una, se ve entera.

## Cómo funciona el acceso (y por qué nadie puede ver la contraseña)

En el código **no están ni el usuario ni la contraseña**. En `src/admin/credenciales.json` solo hay datos cifrados (AES-256 + PBKDF2) que contienen el token de GitHub. Al entrar, el navegador intenta descifrarlos con el usuario y la contraseña escritos: si son correctos funciona, y si no, falla.

Para cambiar el usuario, la contraseña o el token:

```
npm run configurar-admin
```

Después hay que hacer commit y push de `src/admin/credenciales.json`.

## Trabajar en el ordenador

```
npm install        # la primera vez
npm run dev        # web en http://localhost:4321 y panel en http://localhost:4321/admin
```

Con `npm run dev`, el panel guarda los cambios directamente en los archivos del ordenador (modo local).

⚠️ Si se han hecho cambios desde el panel de la web publicada, ejecuta `git pull` antes de tocar nada en el ordenador.

## Estructura

- `content/categorias/`: una ficha por categoría, con su lista de fotos.
- `content/blog/`: una entrada del blog por archivo.
- `public/uploads/`: las imágenes.
- `src/`: diseño de la web y panel (`src/admin/`, `src/pages/admin.astro`).
- `.github/workflows/publicar.yml`: publica en GitHub Pages en cada push a `main`.
- `npm run imagenes`: deja todas las fotos de `public/uploads` del mismo tamaño.
