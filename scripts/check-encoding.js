const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0").filter(file => /(?:\.(?:js|json|md|txt|svg|yaml|yml|html|css|sh|ps1)|Dockerfile|\.gitignore|\.env\.example)$/i.test(file));
for (const file of files) {
  const bytes = readFileSync(file);
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    if (text.startsWith("\uFEFF") || text.includes("\uFFFD")) throw new Error();
  } catch {
    console.error(`Encodage UTF-8 invalide, BOM ou caractère de remplacement : ${file}`);
    process.exitCode = 1;
  }
}
