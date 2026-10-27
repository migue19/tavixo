import { readFile, writeFile, mkdir, stat, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vault = resolve(process.argv[2] ?? resolve(homedir(), "Documents/Development"));
if (!(await stat(resolve(vault, ".obsidian"))).isDirectory()) throw new Error("La ruta no es una bóveda Obsidian existente");
const output = resolve(vault, "Tavixo/Documentación sincronizada");
await mkdir(output, { recursive: true });
// Explicitly allow public documentation only. Never traverse work, secrets or backups.
const roots = (await readdir(repo)).filter(name => /^(README|AGENTS|DEPLOYMENT|TEST_RESULTS|[A-Z0-9_]+_RESULTS)\.md$/.test(name));
const docs = ["MANUAL_USUARIO.md", "MEJORAS_FUTURAS.md", "PERSONALIZACION.md", "OBSIDIAN.md", "IDENTIDAD_TAVIXO.md"];
const files = [...roots, ...docs.map(name => `docs/${name}`)];
const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
for (const relative of files) {
  const source = resolve(repo, relative);
  let body = await readFile(source, "utf8");
  // Flatten generated documentation while retaining valid relative links.
  body = body.replace(/\]\(([^)\n]+)\)/g, (match, target) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) return match;
    const [local, anchor] = target.split("#");
    const absolute = resolve(dirname(source), local);
    const copied = files.find(file => resolve(repo, file) === absolute);
    const destination = copied ? copied.split("/").at(-1) : pathToFileURL(absolute).href;
    return `](${destination}${anchor ? "#" + anchor : ""})`;
  });
  const name = relative.split("/").at(-1);
  await writeFile(resolve(output, name), `> Copia de consulta. Fuente: [repositorio](${pathToFileURL(source).href}).\n> Sincronizado: ${new Date().toISOString()} · HEAD ${commit}; puede incluir cambios locales. Editar el original y volver a sincronizar.\n\n${body}`);
}
console.log(`Sincronizados ${files.length} archivos públicos en ${output}`);
