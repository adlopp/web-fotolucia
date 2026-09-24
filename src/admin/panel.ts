import credenciales from "./credenciales.json";
import { descifrar, type Credenciales, type Secreto } from "./cripto";
import { almacenGitHub, almacenLocal, textoABase64, type Almacen, type Cambio } from "./almacen";
import Sortable from "sortablejs";

type Foto = { imagen: string; titulo?: string | null; tituloEn?: string | null; pie?: string | null };
type Categoria = {
  slug: string;
  datos: {
    titulo: string;
    tituloEn?: string | null;
    descripcion?: string | null;
    descripcionEn?: string | null;
    portada?: string | null;
    orden?: number | null;
    fotos: Foto[];
  };
};
// Foto en edición: las nuevas llevan el archivo ya reducido, pendiente de guardar
type FotoEdicion = Foto & { nueva?: { base64: string; vista: string } };

const DIR_CATEGORIAS = "content/categorias";
const CLAVE_SESION = "panel-admin";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const LOCAL = import.meta.env.DEV;

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;

let almacen: Almacen;
let secreto: Secreto;
let categorias: Categoria[] = [];
let editando: { original: Categoria; fotos: FotoEdicion[] } | null = null;

// ---------- utilidades ----------

const slugify = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const escapar = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// "/uploads/x.jpg" → ruta dentro del repositorio
const rutaRepo = (imagen: string) => `public${imagen}`;

// Miniaturas: en la web publicada se leen de GitHub, porque las fotos recién subidas
// tardan un par de minutos en aparecer en la propia web
const urlImagen = (imagen: string) =>
  LOCAL || !secreto?.repo
    ? `${BASE}${imagen}`
    : `https://raw.githubusercontent.com/${secreto.repo}/${secreto.rama}/public${imagen}`;

function estado(texto: string, tipo: "" | "ok" | "mal" = "") {
  const e = $("#estado");
  e.textContent = texto;
  e.className = `estado ${tipo}`;
}

const MSG_PUBLICADO = LOCAL
  ? "✓ Guardado."
  : "✓ Guardado. La web se actualizará en 1–2 minutos (si no ves el cambio, recarga la página con Ctrl+F5).";

async function conEstado(texto: string, accion: () => Promise<void>) {
  document.querySelectorAll<HTMLButtonElement>("#panel button").forEach((b) => (b.dataset.bloq = String(b.disabled)));
  document.querySelectorAll<HTMLButtonElement>("#panel button").forEach((b) => (b.disabled = true));
  estado(texto);
  try {
    await accion();
    return true;
  } catch (e) {
    console.error(e);
    estado(`✗ No se ha podido completar: ${(e as Error).message}`, "mal");
    return false;
  } finally {
    document.querySelectorAll<HTMLButtonElement>("#panel button").forEach((b) => (b.disabled = b.dataset.bloq === "true"));
  }
}

// Reduce la foto en el navegador antes de subirla (máx. 2000 px, JPEG)
async function prepararImagen(archivo: File) {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const vista = canvas.toDataURL("image/jpeg", 0.85);
  return { vista, base64: vista.split(",")[1] };
}

const jsonCategoria = (c: Categoria["datos"]) => textoABase64(JSON.stringify(c, null, 2) + "\n");

// Traducción automática (botón «Traducir con IA»). Usa MyMemory, un servicio gratuito y sin
// clave: el texto se envía a su servidor para traducirlo, así que solo se usa al pulsar el botón.
async function traducirTexto(texto: string, idioma: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=es|${idioma}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("El traductor no responde.");
  const datos = await res.json();
  const traducido: string | undefined = datos?.responseData?.translatedText;
  if (!traducido || /MYMEMORY WARNING|INVALID/.test(traducido)) {
    throw new Error("No se ha podido traducir (puede que se haya agotado el límite gratuito de hoy).");
  }
  return traducido;
}

// Conecta cada botón «Traducir con IA» con su campo de origen (español) y destino
document.querySelectorAll<HTMLButtonElement>(".traducir-ia").forEach((boton) => {
  const origen = document.getElementById(boton.dataset.desde!) as HTMLInputElement | HTMLTextAreaElement;
  const destino = document.getElementById(boton.dataset.hacia!) as HTMLInputElement | HTMLTextAreaElement;
  const idioma = boton.dataset.idioma!;
  const tituloOriginal = boton.title;
  boton.addEventListener("click", async () => {
    const texto = origen.value.trim();
    if (!texto) return;
    boton.disabled = true;
    boton.classList.remove("error");
    boton.classList.add("cargando");
    try {
      destino.value = await traducirTexto(texto, idioma);
    } catch (e) {
      boton.classList.add("error");
      boton.title = (e as Error).message;
      setTimeout(() => {
        boton.classList.remove("error");
        boton.title = tituloOriginal;
      }, 4000);
    } finally {
      boton.classList.remove("cargando");
      boton.disabled = false;
    }
  });
});

// ---------- acceso ----------

async function entrar(s: Secreto) {
  secreto = s;
  almacen = LOCAL ? almacenLocal() : almacenGitHub(s);
  $("#login").hidden = true;
  $("#panel").hidden = false;
  $("#aviso-local").hidden = !LOCAL;
  if (!LOCAL && !s.token) {
    estado("✗ Falta configurar el token de GitHub (npm run configurar-admin). No se podrán guardar cambios.", "mal");
  }
  mostrarVista("categorias");
  await cargarCategorias();
}

// La pantalla de acceso también respeta el idioma elegido con la bandera (antes de entrar)
const enIngles = () => document.documentElement.dataset.idioma === "en";

$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget as HTMLFormElement;
  const datos = new FormData(form);
  const boton = form.querySelector("button")!;
  boton.disabled = true;
  boton.textContent = enIngles() ? "Checking…" : "Comprobando…";
  $("#error-login").textContent = "";
  const s = await descifrar(credenciales as Credenciales, String(datos.get("usuario")), String(datos.get("clave")));
  boton.disabled = false;
  boton.textContent = enIngles() ? "Log in" : "Entrar";
  if (!s) {
    $("#error-login").textContent = enIngles() ? "Incorrect username or password." : "Usuario o contraseña incorrectos.";
    return;
  }
  try {
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify(s));
  } catch {}
  form.reset();
  await entrar(s);
});

$("#cerrar-panel").addEventListener("click", () => {
  try {
    sessionStorage.removeItem(CLAVE_SESION);
  } catch {}
  location.href = `${BASE}/`;
});

// ---------- vistas ----------

function mostrarVista(nombre: string) {
  document.querySelectorAll<HTMLElement>(".vista").forEach((v) => (v.hidden = v.dataset.vista !== nombre));
  const pestana = nombre === "editar" ? "categorias" : nombre;
  document
    .querySelectorAll<HTMLButtonElement>(".pestanas [data-vista]")
    .forEach((b) => b.classList.toggle("activa", b.dataset.vista === pestana));
}

document.querySelectorAll<HTMLButtonElement>(".pestanas [data-vista]").forEach((b) =>
  b.addEventListener("click", () => {
    editando = null;
    estado("");
    mostrarVista(b.dataset.vista!);
  })
);

// ---------- categorías ----------

async function cargarCategorias() {
  const lista = $("#lista-categorias");
  lista.innerHTML = `<li class="suave">Cargando…</li>`;
  try {
    const archivos = await almacen.listar(DIR_CATEGORIAS);
    categorias = archivos
      .filter((a) => a.ruta.endsWith(".json"))
      .map((a) => {
        const datos = JSON.parse(a.contenido);
        datos.fotos ??= [];
        return { slug: a.ruta.split("/").pop()!.replace(/\.json$/, ""), datos };
      })
      .sort((a, b) => (a.datos.orden ?? 99) - (b.datos.orden ?? 99));
    pintarCategorias();
  } catch (e) {
    lista.innerHTML = "";
    estado(`✗ No se han podido cargar las categorías: ${(e as Error).message}`, "mal");
  }
}

function pintarCategorias() {
  const lista = $("#lista-categorias");
  if (!categorias.length) {
    lista.innerHTML = `<li class="suave">Todavía no hay categorías.</li>`;
    return;
  }
  lista.innerHTML = categorias
    .map((c, i) => {
      const portada = c.datos.fotos[0]?.imagen || c.datos.portada;
      const n = c.datos.fotos.length;
      return `<li>
        ${portada ? `<img src="${escapar(urlImagen(portada))}" alt="" loading="lazy" />` : `<span class="sin-foto"></span>`}
        <div class="info">
          <span class="nombre">${escapar(c.datos.titulo)}</span>
          <span class="contador">${n} ${n === 1 ? "foto" : "fotos"}</span>
        </div>
        <div class="botones">
          <button type="button" class="boton" data-editar="${i}">Modificar</button>
          <button type="button" class="boton" data-eliminar="${i}">Eliminar</button>
        </div>
      </li>`;
    })
    .join("");
  lista.querySelectorAll<HTMLButtonElement>("[data-editar]").forEach((b) =>
    b.addEventListener("click", () => abrirEdicion(categorias[Number(b.dataset.editar)]))
  );
  lista.querySelectorAll<HTMLButtonElement>("[data-eliminar]").forEach((b) =>
    b.addEventListener("click", () => eliminarCategoria(categorias[Number(b.dataset.eliminar)]))
  );
}

// Añadir
const dialogoNombre = $<HTMLDialogElement>("#dialogo-nombre");
$("#nueva-categoria").addEventListener("click", () => {
  dialogoNombre.querySelector("form")!.reset();
  $("#error-nombre").textContent = "";
  dialogoNombre.showModal();
});

dialogoNombre.querySelector("form")!.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombre = String(new FormData(e.currentTarget as HTMLFormElement).get("nombre")).trim();
  const slug = slugify(nombre);
  if (!slug) {
    $("#error-nombre").textContent = "Escribe un nombre.";
    return;
  }
  if (categorias.some((c) => c.slug === slug)) {
    $("#error-nombre").textContent = "Ya existe una categoría con ese nombre.";
    return;
  }
  dialogoNombre.close();
  const orden = Math.max(0, ...categorias.map((c) => c.datos.orden ?? 0)) + 1;
  const nueva: Categoria = { slug, datos: { titulo: nombre, descripcion: "", portada: "", orden, fotos: [] } };
  const ok = await conEstado("Creando categoría…", () =>
    almacen.guardar(
      [{ ruta: `${DIR_CATEGORIAS}/${slug}.json`, base64: jsonCategoria(nueva.datos) }],
      `Nueva categoría: ${nombre}`
    )
  );
  if (ok) {
    estado(`${MSG_PUBLICADO} Ahora puedes añadirle fotos.`, "ok");
    await cargarCategorias();
    abrirEdicion(categorias.find((c) => c.slug === slug) ?? nueva);
  }
});

// Eliminar
const dialogoConfirmar = $<HTMLDialogElement>("#dialogo-confirmar");
function confirmar(titulo: string, texto: string) {
  $("#confirmar-titulo").textContent = titulo;
  $("#confirmar-texto").textContent = texto;
  dialogoConfirmar.returnValue = "";
  dialogoConfirmar.showModal();
  return new Promise<boolean>((ok) => {
    dialogoConfirmar.addEventListener("close", () => ok(dialogoConfirmar.returnValue === "ok"), { once: true });
  });
}

async function eliminarCategoria(c: Categoria) {
  const n = c.datos.fotos.length;
  const seguro = await confirmar(
    `¿Estás segura de que quieres eliminar «${c.datos.titulo}»?`,
    n === 0
      ? "Se borrará la categoría. No se puede deshacer."
      : `Se borrarán la categoría y ${n === 1 ? "su foto" : `sus ${n} fotos`}. No se puede deshacer.`
  );
  if (!seguro) return;

  // Borra las fotos que no use ninguna otra categoría
  const usadas = new Set(
    categorias.filter((o) => o.slug !== c.slug).flatMap((o) => [o.datos.portada, ...o.datos.fotos.map((f) => f.imagen)])
  );
  const imagenes = [...new Set([c.datos.portada, ...c.datos.fotos.map((f) => f.imagen)])].filter(
    (i): i is string => !!i && i.startsWith("/uploads/") && !usadas.has(i)
  );
  const cambios: Cambio[] = [
    { ruta: `${DIR_CATEGORIAS}/${c.slug}.json`, base64: null },
    ...imagenes.map((i) => ({ ruta: rutaRepo(i), base64: null })),
  ];
  const ok = await conEstado("Eliminando…", () => almacen.guardar(cambios, `Eliminar categoría: ${c.datos.titulo}`));
  if (ok) {
    estado(`${MSG_PUBLICADO} «${c.datos.titulo}» eliminada.`, "ok");
    await cargarCategorias();
  }
}

// Modificar
function abrirEdicion(c: Categoria) {
  editando = { original: c, fotos: c.datos.fotos.map((f) => ({ ...f })) };
  $("#editar-titulo").textContent = c.datos.titulo;
  $<HTMLInputElement>("#editar-nombre").value = c.datos.titulo;
  $<HTMLInputElement>("#editar-nombre-en").value = c.datos.tituloEn ?? "";
  $<HTMLTextAreaElement>("#editar-descripcion").value = c.datos.descripcion ?? "";
  $<HTMLTextAreaElement>("#editar-descripcion-en").value = c.datos.descripcionEn ?? "";
  pintarFotos();
  mostrarVista("editar");
}

function pintarFotos() {
  if (!editando) return;
  const n = editando.fotos.length;
  $("#editar-contador").textContent = `(${n})`;
  const ul = $("#editar-fotos");
  ul.innerHTML = n
    ? editando.fotos
        .map((f, i) => {
          const etiquetas = [i === 0 ? "Portada" : "", f.nueva ? "Nueva" : ""].filter(Boolean);
          return `<li>
            <button type="button" class="miniatura" data-nombrar="${i}" title="Pulsa para ponerle nombre">
              <img src="${escapar(f.nueva?.vista ?? urlImagen(f.imagen))}" alt="${escapar(f.titulo ?? "")}" loading="lazy" />
            </button>
            <span class="etiquetas">${etiquetas.map((e) => `<span>${e}</span>`).join("")}</span>
            <button type="button" class="quitar" data-quitar="${i}" aria-label="Quitar foto" title="Quitar foto">✕</button>
            <span class="nombre-foto ${f.titulo ? "" : "vacio"}">${escapar(f.titulo || "Sin nombre")}</span>
          </li>`;
        })
        .join("")
    : `<li class="suave" style="cursor:auto">Aún no hay fotos. Añade algunas desde tu ordenador.</li>`;
  ul.querySelectorAll<HTMLButtonElement>("[data-quitar]").forEach((b) =>
    b.addEventListener("click", () => {
      editando!.fotos.splice(Number(b.dataset.quitar), 1);
      pintarFotos();
    })
  );
  ul.querySelectorAll<HTMLButtonElement>("[data-nombrar]").forEach((b) =>
    b.addEventListener("click", () => nombrarFoto(Number(b.dataset.nombrar)))
  );
}

// Arrastrar para cambiar el orden (funciona con ratón y con el dedo)
Sortable.create($("#editar-fotos"), {
  animation: 150,
  forceFallback: true,
  filter: ".quitar",
  preventOnFilter: false,
  ghostClass: "arrastrando",
  chosenClass: "elegida",
  delay: 150,
  delayOnTouchOnly: true,
  onEnd: ({ oldIndex, newIndex }) => {
    if (!editando || oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
    const [foto] = editando.fotos.splice(oldIndex, 1);
    editando.fotos.splice(newIndex, 0, foto);
    pintarFotos();
  },
});

// Pulsar una foto: ponerle nombre (si se deja vacío, se queda sin nombre)
const dialogoFoto = $<HTMLDialogElement>("#dialogo-foto");
let fotoNombrando = -1;
function nombrarFoto(i: number) {
  if (!editando) return;
  const f = editando.fotos[i];
  fotoNombrando = i;
  $<HTMLImageElement>("#foto-vista").src = f.nueva?.vista ?? urlImagen(f.imagen);
  dialogoFoto.querySelector<HTMLInputElement>("input[name=titulo]")!.value = f.titulo ?? "";
  dialogoFoto.querySelector<HTMLInputElement>("input[name=tituloEn]")!.value = f.tituloEn ?? "";
  dialogoFoto.showModal();
  dialogoFoto.querySelector<HTMLInputElement>("input[name=titulo]")!.focus();
}
dialogoFoto.querySelector("form")!.addEventListener("submit", (e) => {
  e.preventDefault();
  if (editando && editando.fotos[fotoNombrando]) {
    editando.fotos[fotoNombrando].titulo = dialogoFoto.querySelector<HTMLInputElement>("input[name=titulo]")!.value.trim();
    editando.fotos[fotoNombrando].tituloEn = dialogoFoto.querySelector<HTMLInputElement>("input[name=tituloEn]")!.value.trim();
    pintarFotos();
  }
  dialogoFoto.close();
});

$<HTMLInputElement>("#editar-subir").addEventListener("change", async (e) => {
  const input = e.currentTarget as HTMLInputElement;
  const archivos = [...(input.files ?? [])];
  input.value = "";
  if (!editando || !archivos.length) return;
  const carpeta = editando.original.slug;
  estado(`Preparando ${archivos.length} ${archivos.length === 1 ? "imagen" : "imágenes"}…`);
  let fallidas = 0;
  for (const archivo of archivos) {
    try {
      const nueva = await prepararImagen(archivo);
      const nombre = `${slugify(archivo.name.replace(/\.[^.]+$/, "")) || "foto"}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.jpg`;
      editando.fotos.push({ imagen: `/uploads/${carpeta}/${nombre}`, titulo: "", pie: "", nueva });
    } catch {
      fallidas++;
    }
  }
  pintarFotos();
  estado(
    fallidas
      ? `${fallidas} imagen(es) no se han podido leer (¿formato HEIC del iPhone? Prueba con JPG).`
      : "Imágenes añadidas. Pulsa «Guardar cambios» para publicarlas.",
    fallidas ? "mal" : ""
  );
});

$("#volver-categorias").addEventListener("click", salirEdicion);
$("#editar-cancelar").addEventListener("click", salirEdicion);

// ¿Ha cambiado algo (nombre, descripción, fotos, orden o nombres de fotos) desde que se abrió?
function hayCambios() {
  if (!editando) return false;
  const limpiar = (fotos: FotoEdicion[]) =>
    JSON.stringify(fotos.map((f) => [f.imagen, f.titulo ?? "", f.tituloEn ?? ""]));
  return (
    $<HTMLInputElement>("#editar-nombre").value.trim() !== editando.original.datos.titulo ||
    $<HTMLInputElement>("#editar-nombre-en").value.trim() !== (editando.original.datos.tituloEn ?? "") ||
    $<HTMLTextAreaElement>("#editar-descripcion").value.trim() !== (editando.original.datos.descripcion ?? "") ||
    $<HTMLTextAreaElement>("#editar-descripcion-en").value.trim() !== (editando.original.datos.descripcionEn ?? "") ||
    limpiar(editando.fotos) !== limpiar(editando.original.datos.fotos)
  );
}

function salirEdicion() {
  if (hayCambios() && !window.confirm("Hay cambios sin guardar. ¿Salir igualmente?")) return;
  editando = null;
  estado("");
  mostrarVista("categorias");
}

$("#editar-guardar").addEventListener("click", async () => {
  if (!editando) return;
  const { original, fotos } = editando;
  const titulo = $<HTMLInputElement>("#editar-nombre").value.trim();
  const tituloEn = $<HTMLInputElement>("#editar-nombre-en").value.trim();
  const descripcion = $<HTMLTextAreaElement>("#editar-descripcion").value.trim();
  const descripcionEn = $<HTMLTextAreaElement>("#editar-descripcion-en").value.trim();
  const slug = slugify(titulo);
  if (!slug) {
    estado("✗ El nombre no puede estar vacío.", "mal");
    return;
  }
  if (slug !== original.slug && categorias.some((c) => c.slug === slug)) {
    estado("✗ Ya existe otra categoría con ese nombre.", "mal");
    return;
  }

  const imagenesFinales = new Set(fotos.map((f) => f.imagen));
  const quitadas = original.datos.fotos
    .map((f) => f.imagen)
    .filter((i) => !imagenesFinales.has(i) && i.startsWith("/uploads/"));
  // La primera foto es la portada de la categoría
  const portada = fotos[0]?.imagen ?? "";

  const datos: Categoria["datos"] = {
    ...original.datos,
    titulo,
    tituloEn: tituloEn || "",
    descripcion: descripcion || "",
    descripcionEn: descripcionEn || "",
    portada,
    fotos: fotos.map(({ nueva, ...f }) => f),
  };
  const cambios: Cambio[] = [
    ...fotos.filter((f) => f.nueva).map((f) => ({ ruta: rutaRepo(f.imagen), base64: f.nueva!.base64 })),
    ...quitadas.map((i) => ({ ruta: rutaRepo(i), base64: null })),
    { ruta: `${DIR_CATEGORIAS}/${slug}.json`, base64: jsonCategoria(datos) },
    ...(slug !== original.slug ? [{ ruta: `${DIR_CATEGORIAS}/${original.slug}.json`, base64: null }] : []),
  ];

  const ok = await conEstado("Guardando…", () => almacen.guardar(cambios, `Modificar categoría: ${titulo}`));
  if (ok) {
    editando = null;
    await cargarCategorias();
    mostrarVista("categorias");
    estado(MSG_PUBLICADO, "ok");
  }
});

// Botones «Cancelar» de los diálogos
document.querySelectorAll<HTMLButtonElement>("[data-cerrar]").forEach((b) =>
  b.addEventListener("click", () => b.closest("dialog")!.close())
);

// En `npm run dev`, guardar archivos hace que la página se recargue sola y se perdería lo que
// se está haciendo en el panel. Aquí se ignoran esas recargas (solo en local).
if (import.meta.hot) {
  import.meta.hot.on("vite:beforeFullReload", (aviso: { path?: string }) => {
    aviso.path = "/__panel-sin-recarga.html";
  });
}

// ---------- inicio: si ya había sesión abierta en esta pestaña, entra directamente ----------
try {
  const guardado = sessionStorage.getItem(CLAVE_SESION);
  if (guardado) entrar(JSON.parse(guardado));
} catch {}
