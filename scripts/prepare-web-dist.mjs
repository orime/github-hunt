import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const rootDir = process.cwd();
const publicDir = resolve(rootDir, "web/public");
const distDir = resolve(rootDir, "web/dist");

await mkdir(distDir, { recursive: true });
await cp(publicDir, distDir, { recursive: true, force: true });

console.log(`静态发布资源已同步: ${publicDir} -> ${distDir}`);
