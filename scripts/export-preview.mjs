import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const root = process.cwd();
let html = readFileSync(path.join(root, "dist/index.html"), "utf8");
html = html.replace(
  /<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g,
  (_, src) =>
    `<script type="module">${readFileSync(path.join(root, "dist", src.replace(/^\//, "")), "utf8").replace(/<\/script/gi, "<\\/script")}</script>`,
);
html = html.replace(
  /<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
  (_, href) => {
    let css = readFileSync(
      path.join(root, "dist", href.replace(/^\//, "")),
      "utf8",
    );
    css = css.replace(
      /url\((['"]?)(\/fonts\/[^)'"\s]+)\1\)/g,
      (_, quote, font) =>
        `url(data:font/ttf;base64,${readFileSync(path.join(root, "dist", font.slice(1))).toString("base64")})`,
    );
    return `<style>${css}</style>`;
  },
);
html = html.replace('<link rel="icon" href="/favicon.svg"/>', "");
writeFileSync(path.join(root, "vista-previa.html"), html);
console.log("Creada vista-previa.html: demostración local sin servidor.");
