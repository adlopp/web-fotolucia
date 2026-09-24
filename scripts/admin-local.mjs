// Solo en `npm run dev`: permite que el panel de administración guarde los cambios
// directamente en los archivos del ordenador. En la web publicada el panel guarda en GitHub.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

const RAIZ = process.cwd();
const PERMITIDAS = ["content", "public/uploads"].map((c) => resolve(RAIZ, c) + sep);

function rutaSegura(ruta) {
  const abs = resolve(RAIZ, ruta);
  if (!PERMITIDAS.some((p) => abs.startsWith(p))) throw new Error(`Ruta no permitida: ${ruta}`);
  return abs;
}

function leerCuerpo(req) {
  return new Promise((ok, mal) => {
    const trozos = [];
    req.on("data", (t) => trozos.push(t));
    req.on("end", () => ok(Buffer.concat(trozos).toString("utf8")));
    req.on("error", mal);
  });
}

export function adminLocal() {
  return {
    name: "admin-local",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__admin", async (req, res) => {
        const responder = (codigo, datos) => {
          res.statusCode = codigo;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(datos));
        };
        try {
          const url = new URL(req.url, "http://x");

          // Lista los archivos de una carpeta con su contenido de texto
          if (req.method === "GET" && url.pathname === "/listar") {
            const dir = rutaSegura(url.searchParams.get("dir"));
            const archivos = existsSync(dir)
              ? readdirSync(dir)
                  .filter((f) => /\.(json|md)$/.test(f))
                  .map((f) => ({
                    ruta: `${url.searchParams.get("dir")}/${f}`,
                    contenido: readFileSync(resolve(dir, f), "utf8"),
                  }))
              : [];
            return responder(200, archivos);
          }

          // Aplica una lista de cambios: { ruta, base64 } crea o reemplaza, { ruta, base64: null } borra
          if (req.method === "POST" && url.pathname === "/guardar") {
            const { cambios } = JSON.parse(await leerCuerpo(req));
            for (const c of cambios) {
              const abs = rutaSegura(c.ruta);
              if (c.base64 === null) {
                rmSync(abs, { force: true });
                // Si la carpeta de fotos se queda vacía, se borra también (como pasa en GitHub)
                const dir = dirname(abs);
                if (dir.startsWith(PERMITIDAS[1]) && existsSync(dir) && !readdirSync(dir).length) rmSync(dir, { recursive: true });
              } else {
                mkdirSync(dirname(abs), { recursive: true });
                writeFileSync(abs, Buffer.from(c.base64, "base64"));
              }
            }
            return responder(200, { ok: true });
          }

          responder(404, { error: "No encontrado" });
        } catch (e) {
          responder(400, { error: e.message });
        }
      });
    },
  };
}
