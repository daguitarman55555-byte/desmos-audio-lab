import { mkdir, rm, cp } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist", "desmos-audio-lab");
await rm(resolve(root, "dist"), { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const item of ["manifest.json", "src", "README.md", "LICENSE"]) {
  await cp(resolve(root, item), resolve(output, item), { recursive: true });
}
console.log(`Packed extension at ${output}`);
