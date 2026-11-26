const { copyFileSync, mkdirSync } = require("node:fs");
const path = require("node:path");

const families = [
  ["Poppins", "poppins", [400, 500, 600, 700, 800], [400]],
  ["Playfair Display", "playfair-display", [400, 500, 600, 700], [400, 500, 600, 700]],
  ["Caveat", "caveat", [400, 600, 700], []],
  ["DM Serif Display", "dm-serif-display", [400], []],
  ["DM Sans", "dm-sans", [400, 600, 700, 800], []],
  ["League Spartan", "league-spartan", [400, 700], []],
  ["Inter", "inter", [600, 800], []],
  ["Geist", "geist", [500, 600], []],
];

const faces = families.flatMap(([family, slug, normal, italic]) =>
  [["normal", normal], ["italic", italic]].flatMap(([style, weights]) =>
    weights.map(weight => ({ family, slug, style, weight, file: `${slug}-latin-${weight}-${style}.woff2` }))
  )
);

const directory = path.join(__dirname, "fonts");
if (require.main === module) {
  mkdirSync(directory, { recursive: true });
  for (const { slug, file } of faces) {
    const source = path.join(__dirname, "node_modules", "@fontsource", slug, "files", file);
    copyFileSync(source, path.join(directory, file));
  }
}

module.exports = { faces, directory };
