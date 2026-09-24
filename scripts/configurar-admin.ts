// Crea src/admin/credenciales.json con el usuario, la contraseña y el token de GitHub cifrados.
// Uso: npm run configurar-admin
import { createInterface } from "node:readline";
import { writeFileSync } from "node:fs";
import { cifrar } from "../src/admin/cripto.ts";

const rl = createInterface({ input: process.stdin });
const lineas = rl[Symbol.asyncIterator]();
const preguntar = async (texto: string) => {
  process.stdout.write(texto);
  const { value } = await lineas.next();
  return (value ?? "") as string;
};

console.log("\nConfiguración del acceso al panel de administración\n");
const usuario = (await preguntar("Usuario: ")).trim();
const clave = await preguntar("Contraseña: ");
const token = (await preguntar("Token de GitHub (déjalo vacío para usar solo en local): ")).trim();
const repo = (await preguntar("Repositorio [fotolucia/fotolucia.github.io]: ")).trim() || "fotolucia/fotolucia.github.io";
const rama = (await preguntar("Rama [main]: ")).trim() || "main";
rl.close();

if (!usuario || !clave) {
  console.error("\n✗ El usuario y la contraseña no pueden estar vacíos.");
  process.exit(1);
}

const cred = await cifrar({ token, repo, rama }, usuario, clave);
writeFileSync("src/admin/credenciales.json", JSON.stringify(cred, null, 2) + "\n");

console.log("\n✓ Guardado en src/admin/credenciales.json (cifrado).");
if (!token) console.log("  Sin token: el panel solo podrá guardar cambios con `npm run dev`.");
if (clave.length < 12) console.log("  Consejo: una contraseña de 12 caracteres o más es bastante más segura.");
