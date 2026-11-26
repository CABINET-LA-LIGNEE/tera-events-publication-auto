const fs = require("node:fs");
const path = require("node:path");
const { faces, directory } = require("./prepare-fonts");

const fontCss = faces.map(({ family, file, style, weight }) => {
  const bytes = fs.readFileSync(path.join(directory, file));
  return `@font-face {font-family:"${family}";font-style:${style};font-weight:${weight};src:url(data:font/woff2;base64,${bytes.toString("base64")}) format("woff2");}`;
}).join("\n");

module.exports = { fontCss };
