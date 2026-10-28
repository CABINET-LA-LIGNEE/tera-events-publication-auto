const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { chromium } = require("playwright");
const { layouts } = require("./layouts");

const PORT = process.env.PORT || 3000;
const AUTH_TOKEN = process.env.RENDER_AUTH_TOKEN || "";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "";
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, "generated");
fs.mkdirSync(STORAGE_DIR, { recursive: true });

const fileDataUris = {};
function loadFile(name) {
  if (fileDataUris[name]) return fileDataUris[name];
  const filePath = path.join(__dirname, "backgrounds", name);
  const buf = fs.readFileSync(filePath);
  const mime = path.extname(name).toLowerCase() === ".svg" ? "image/svg+xml" : "image/png";
  const uri = `data:${mime};base64,` + buf.toString("base64");
  fileDataUris[name] = uri;
  return uri;
}
function preload(cfg) {
  if (cfg.background) loadFile(cfg.background);
  if (cfg.logoImage) loadFile(cfg.logoImage.file);
  walk(cfg.root, n => {
    if (n.type === "image") loadFile(n.file);
  });
}
function walk(node, fn) {
  if (!node) return;
  fn(node);
  (node.children || []).forEach(c => walk(c, fn));
}
for (const cfg of Object.values(layouts)) preload(cfg);

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br>");
}

function resolveText(n, data) {
  if (n.static !== undefined) return n.static;
  const value = data[n.data];
  return value !== undefined && value !== null ? value : "";
}

// ---------------------------------------------------------------------------------------------
// Moteur de rendu par arbre de groupes flexbox (reproduit l'auto-layout Figma : gap, direction,
// alignement) plutôt que des positions absolues figées par champ — nécessaire pour que
// l'espacement s'adapte au texte réellement généré exactement comme dans le fichier source.
// ---------------------------------------------------------------------------------------------
function renderNode(n, data) {
  if (!n) return "";

  if (n.type === "text") {
    const text = resolveText(n, data);
    if (!text) return "";
    // Les paragraphes utiles doivent rester lisibles lorsque le visuel est ramen� � la largeur
    // d'un t�l�phone. Les titres, badges et mentions de navigation conservent leur hi�rarchie.
    const isReadableBody = /^(texte|insight|body|moment\d+_texte|conseil\d+_texte)$/i.test(n.data || "");
    const mobileMinSize = isReadableBody ? (n.mobileMinSize || 30) : 0;
    const renderedSize = Math.max(n.size, mobileMinSize);
    const rotate = n.rotate ? `transform:rotate(${n.rotate}deg);` : "";
    const shadow = n.shadow ? `text-shadow:${n.shadow};` : "";
    const whiteSpace = n.nowrap ? "nowrap" : "pre-wrap";
    const w = n.w ? `width:${n.w}px;` : "";
    const textAlign = n.align === "center" ? "center" : n.align === "right" ? "right" : "left";
    // Un champ court destiné à rester sur une ligne (nowrap) garde sa taille naturelle
    // (flex-shrink:0) ; un champ de texte long doit au contraire pouvoir rétrécir sous sa largeur
    // naturelle pour retourner à la ligne à l'intérieur d'une rangée (icône + texte, barre
    // d'accent + texte...), d'où min-width:0 qui lève la limite par défaut de flexbox.
    const flex = n.nowrap ? "flex-shrink:0;" : "flex:1 1 0%; min-width:0;";
    const underline = n.underline ? "text-decoration:underline;" : "";
    const balance = n.balance ? "text-wrap:balance;" : "";
    const position = n.x !== undefined ? `position:absolute; left:${n.x}px; top:${n.y}px;` : "";
    const shouldAutoFit = n.fit || (!n.nowrap && n.static === undefined && n.data);
    const minReadableSize = isReadableBody ? 30 : Math.min(n.size, 34);
    const fit = shouldAutoFit
      ? `data-fit-text="1" data-field="${escapeHtml(n.data || "texte")}" data-max-width="${n.fit?.maxWidth || n.w || 0}" data-max-height="${n.fit?.maxHeight || 0}" data-max-lines="${n.fit?.maxLines || 3}" data-min-size="${Math.max(n.fit?.minSize || minReadableSize, mobileMinSize)}"`
      : "";
    return `<div ${fit} style="${position} font-family:'${n.font}', sans-serif; font-weight:${n.weight}; font-size:${renderedSize}px; line-height:${n.lineHeight || 1.2}; font-style:${n.italic ? "italic" : "normal"}; color:${n.color}; text-align:${textAlign}; text-transform:${n.uppercase ? "uppercase" : "none"}; white-space:${whiteSpace}; word-wrap:break-word; ${w} ${rotate} ${shadow} ${underline} ${balance} ${flex}">${escapeHtml(text)}</div>`;
  }

  // Titre bicolore : le début en couleur normale, la fin en italique/couleur accent — reproduit
  // le motif exact "Coordination complète" / "Le Jour J seul" des slides Déclic (un seul bloc de
  // texte avec deux segments, pour que le retour à la ligne reste naturel).
  if (n.type === "titleTwoTone") {
    const normal = resolveText({ data: n.dataNormal }, data);
    const accent = resolveText({ data: n.dataAccent }, data);
    if (!normal && !accent) return "";
    return `<div data-fit-text="1" data-field="titre" data-max-lines="3" data-min-size="34" style="font-family:'${n.font}', serif; font-weight:${n.weight}; font-size:${n.size}px; line-height:${n.lineHeight || 1.15}; color:${n.color}; width:100%; flex-shrink:0;">${escapeHtml(normal)} <span style="font-style:italic; font-weight:${n.accentWeight || n.weight}; color:${n.accentColor};">${escapeHtml(accent)}</span></div>`;
  }

  if (n.type === "quoteTwoTone") {
    const accent = resolveText({ data: n.dataAccent }, data);
    const main = resolveText({ data: n.dataMain }, data);
    if (!accent && !main) return "";
    return `<div data-fit-text="1" data-field="citation" data-max-width="${n.w}" data-max-lines="3" data-min-size="34" style="font-family:'${n.font}', serif; font-size:${n.size}px; line-height:${n.lineHeight}; width:${n.w}px; color:${n.color}; text-align:center; flex-shrink:0;"><span style="font-weight:700; font-style:normal; color:${n.accentColor};">${escapeHtml(accent)}</span><span style="font-weight:500; font-style:italic;">${accent && main ? " " : ""}${escapeHtml(main)}</span></div>`;
  }

  if (n.type === "image") {
    const position = n.x !== undefined ? `position:absolute; left:${n.x}px; top:${n.y}px;` : "";
    return `<img src="${loadFile(n.file)}" style="${position} width:${n.w}px; height:${n.h}px; object-fit:${n.fit || "contain"}; flex-shrink:0;" />`;
  }

  if (n.type === "line") {
    const position = n.x !== undefined ? `position:absolute; left:${n.x}px; top:${n.y}px;` : "";
    return `<div style="${position} width:${n.w}px; height:${n.h || 2}px; background:${n.color}; opacity:${n.opacity !== undefined ? n.opacity : 1}; border-radius:${n.rounded ? "999px" : "0"}; flex-shrink:0;"></div>`;
  }

  if (n.type === "circleBadge") {
    const text = resolveText(n, data);
    return `<div style="width:${n.size}px; height:${n.size}px; min-width:${n.size}px; border-radius:50%; background:${n.bg}; display:flex; align-items:center; justify-content:center; flex-shrink:0;"><div style="font-family:'${n.font}', sans-serif; font-weight:${n.weight}; font-size:${n.textSize}px; color:${n.textColor};">${escapeHtml(text)}</div></div>`;
  }

  if (n.type === "pill" || n.type === "outlinePill") {
    const bg = n.type === "pill" ? `background:${n.bg};` : `border:1.5px solid ${n.border};`;
    const rotate = n.rotate ? `transform:rotate(${n.rotate}deg);` : "";
    const w = n.w ? `width:${n.w}px;` : "";
    const h = n.h ? `height:${n.h}px;` : "";
    const shadow = n.shadow ? `box-shadow:${n.shadow};` : "";
    const inner = (n.children || []).map(c => renderNode(c, data)).join("");
    const position = n.x !== undefined ? `position:absolute; left:${n.x}px; top:${n.y}px;` : "";
    return `<div style="${position} display:inline-flex; ${bg} ${w} ${h} ${shadow} border-radius:999px; padding:${n.padding || "10px 22px"}; ${rotate} align-items:center; justify-content:center; flex-shrink:0; align-self:${n.alignSelf || "flex-start"};">${inner}</div>`;
  }

  if (n.type === "bar") {
    const text = resolveText(n, data);
    if (n.hideIfEmpty && !text) return "";
    return `<div style="display:flex; align-items:center; justify-content:space-between; width:100%; background:${n.bg}; border-radius:999px; padding:${n.padding || "20px 30px"}; box-sizing:border-box; flex-shrink:0;">${(n.children || []).map(c => renderNode(c, data)).join("")}</div>`;
  }

  if (n.type === "row" || n.type === "group") {
    const direction = n.direction || (n.type === "row" ? "row" : "column");
    const align = n.align === "center" ? "center" : n.align === "end" ? "flex-end" : "flex-start";
    const justify = n.justify === "between" ? "space-between" : n.justify === "center" ? "center" : "flex-start";
    const w = n.w ? `width:${n.w}px;` : "width:100%;";
    const h = n.h ? `height:${n.h}px;` : (n.fillHeight ? `height:100%;` : "");
    const padding = n.padding ? `padding:${n.padding};` : "";
    const marginTop = n.marginTop !== undefined ? `margin-top:${n.marginTop}px;` : "";
    const posStyle = n.x !== undefined ? `position:absolute; left:${n.x}px; top:${n.y}px;` : "";
    const inner = (n.children || []).map(c => renderNode(c, data)).filter(Boolean).join("");
    if (!inner) return "";
    const extra = n.style || "";
    return `<div style="${posStyle} display:flex; flex-direction:${direction}; gap:${n.gap || 0}px; align-items:${align}; justify-content:${justify}; ${w} ${h} ${padding} ${marginTop} box-sizing:border-box; ${extra}">${inner}</div>`;
  }

  // Pastilles de progression du carrousel (01 02 03 04 05), l'actuelle pleine + colorée, les
  // autres atténuées — reproduit exactement le composant "footer-row" du Déclic Event Planning.
  if (n.type === "dots") {
    let inner = "";
    for (let i = 1; i <= n.count; i++) {
      const isActive = i === n.active;
      const numColor = isActive ? n.activeColor : "rgba(255,255,255,0.4)";
      const barColor = isActive ? n.activeColor : "rgba(255,255,255,0.2)";
      const weight = isActive ? 700 : 400;
      inner += `<div style="display:flex; flex-direction:column; gap:4px; align-items:center; width:24px;">`;
      inner += `<div style="font-family:'League Spartan', sans-serif; font-weight:${weight}; font-size:14px; color:${numColor};">${String(i).padStart(2, "0")}</div>`;
      inner += `<div style="width:24px; height:2px; background:${barColor};"></div>`;
      inner += `</div>`;
    }
    return `<div style="display:flex; gap:8px; flex-shrink:0;">${inner}</div>`;
  }

  return "";
}

function decorationHtml(d) {
  if (d.type === "image") {
    return `<img src="${loadFile(d.file)}" style="position:absolute; left:${d.x}px; top:${d.y}px; width:${d.w}px; height:${d.h}px; object-fit:${d.fit || "contain"};" />`;
  }
  if (d.type === "line") {
    return `<div style="position:absolute; left:${d.x}px; top:${d.y}px; width:${d.w}px; height:2px; background:${d.color}; opacity:${d.opacity !== undefined ? d.opacity : 1};"></div>`;
  }
  if (d.type === "circle") {
    return `<div style="position:absolute; left:${d.x}px; top:${d.y}px; width:${d.w}px; height:${d.w}px; border-radius:50%; background:${d.color}; opacity:${d.opacity !== undefined ? d.opacity : 1};"></div>`;
  }
  if (d.type === "arrow") {
    return `<svg style="position:absolute; left:${d.x}px; top:${d.y}px;" width="${d.w}" height="${d.w}" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.7486 21H33.2514M21 33.2514L33.2514 21L21 8.7486" stroke="${d.color}" stroke-linecap="round"/></svg>`;
  }
  if (d.type === "audiolines") {
    return `<svg style="position:absolute; left:${d.x}px; top:${d.y}px; opacity:${d.opacity !== undefined ? d.opacity : 1};" width="${d.w}" height="${d.h}" viewBox="0 0 157 143" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.0781 59.5833V77.4583M39.2469 35.75V101.292M65.4156 17.875V125.125M91.5844 47.6667V89.375M117.753 29.7917V107.25M143.922 59.5833V77.4583" stroke="${d.color}" stroke-linecap="round"/></svg>`;
  }
  return "";
}

function buildHtml(templateName, data) {
  const cfg = layouts[templateName];
  let canvasBackground;
  const dynamicBackground = data.background_image || data.backgroundImage;
  if (dynamicBackground) {
    const backgroundUrl = String(dynamicBackground).replace(/["'()\\\n\r]/g, encodeURIComponent);
    const backgroundPosition = String(data.background_position || "center").replace(/[^a-zA-Z0-9% .-]/g, "");
    canvasBackground = `background-image:url("${backgroundUrl}"); background-size:cover; background-position:${backgroundPosition};`;
  } else if (cfg.background) {
    canvasBackground = `background-image:url('${loadFile(cfg.background)}'); background-size:cover; background-position:center;`;
  } else if (cfg.radialGradient) {
    const g = cfg.radialGradient;
    canvasBackground = `background-color:${cfg.bgColor}; background-image:radial-gradient(ellipse ${g.rx}px ${g.ry}px at ${g.cx}px ${g.cy}px, ${g.stops.join(", ")});`;
  } else {
    canvasBackground = `background-color:${cfg.bgColor};`;
  }

  let boxesHtml = "";

  if (cfg.photoGradient) {
    const g = cfg.photoGradient;
    const layers = g.layers
      ? g.layers.map(layer => `linear-gradient(${layer.direction}, ${layer.stops.join(", ")})`).join(", ")
      : `linear-gradient(${g.direction}, ${g.stops.join(", ")})`;
    boxesHtml += `<div style="position:absolute; left:0; top:0; width:${cfg.width}px; height:${cfg.height}px; background-image:${layers};"></div>`;
  }

  for (const d of cfg.decorations || []) {
    boxesHtml += decorationHtml(d);
  }

  if (cfg.logoImage) {
    const l = cfg.logoImage;
    boxesHtml += `<img src="${loadFile(l.file)}" style="position:absolute; left:${l.x}px; top:${l.y}px; width:${l.w}px; height:${l.h}px; object-fit:contain;" />`;
  }

  if (cfg.root) {
    boxesHtml += renderNode(cfg.root, data);
  }

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500;1,600;1,700&family=Caveat:wght@600;700&family=DM+Serif+Display&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;0,9..40,800&family=League+Spartan:wght@400;700&family=Geist:wght@500;600&family=Inter:wght@600;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${cfg.width}px; height:${cfg.height}px; overflow:hidden; }
  .canvas { position:relative; width:${cfg.width}px; height:${cfg.height}px; ${canvasBackground} }
</style>
</head>
<body>
  <div class="canvas">
    ${boxesHtml}
  </div>
</body>
</html>`;
}

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  }
  return browserPromise;
}

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use("/images", express.static(STORAGE_DIR, { maxAge: "365d", immutable: true }));

app.get("/health", (req, res) => res.json({ ok: true, templates: Object.keys(layouts) }));

app.post("/render/:template", async (req, res) => {
  try {
    if (AUTH_TOKEN) {
      const provided = req.headers["x-render-token"];
      if (provided !== AUTH_TOKEN) return res.status(401).json({ error: "unauthorized" });
    }
    const templateName = req.params.template;
    const cfg = layouts[templateName];
    if (!cfg) return res.status(400).json({ error: "unknown template", known: Object.keys(layouts) });

    const html = buildHtml(templateName, req.body || {});

    if (req.query.debug === "html") {
      res.set("Content-Type", "text/plain; charset=utf-8");
      return res.send(html);
    }

    const browser = await getBrowser();
    const page = await browser.newPage({ viewport: { width: cfg.width, height: cfg.height } });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      await document.fonts.ready;

      // Les fonds générés par OpenAI arrivent sous forme de longues data URLs. Chromium peut
      // considérer la page comme inactive côté réseau alors que leur décodage et leur première
      // peinture ne sont pas encore terminés. Sans cette attente, la capture peut contenir de
      // grands aplats gris. On force donc le décodage du fond de la toile, puis deux frames de
      // rendu, avant de prendre la capture.
      const canvas = document.querySelector(".canvas");
      const backgroundImage = canvas ? getComputedStyle(canvas).backgroundImage : "";
      const match = backgroundImage.match(/^url\(["']?(.*?)["']?\)$/s);
      if (match?.[1]) {
        const background = new Image();
        background.src = match[1];
        try {
          await background.decode();
        } catch {
          await new Promise((resolve, reject) => {
            background.onload = resolve;
            background.onerror = reject;
          });
        }
      }

      for (const el of document.querySelectorAll("[data-fit-text]")) {
        const maxWidth = Number(el.dataset.maxWidth || 0);
        const maxHeight = Number(el.dataset.maxHeight || 0);
        const maxLines = Number(el.dataset.maxLines || 0);
        const minSize = Number(el.dataset.minSize || 12);
        let size = Number.parseFloat(getComputedStyle(el).fontSize);
        const overflows = () => {
          const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || size * 1.2;
          const lineCount = Math.ceil(el.scrollHeight / lineHeight);
          return (maxWidth > 0 && el.scrollWidth > maxWidth + 1) ||
            (maxHeight > 0 && el.scrollHeight > maxHeight + 1) ||
            (maxLines > 0 && lineCount > maxLines);
        };
        while (size > minSize && overflows()) {
          size -= 1;
          el.style.fontSize = `${size}px`;
        }
        if (overflows()) {
          throw new Error(`Le champ ${el.dataset.field || "texte"} dépasse encore ${maxLines || 3} lignes à la taille minimale lisible.`);
        }
      }

      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const buffer = await page.screenshot({ type: "png" });
    await page.close();

    const id = crypto.randomUUID() + ".png";
    fs.writeFileSync(path.join(STORAGE_DIR, id), buffer);
    const url = PUBLIC_BASE_URL + "/images/" + id;

    if (req.query.format === "png") {
      res.set("Content-Type", "image/png");
      return res.send(buffer);
    }

    res.json({ id, url, width: cfg.width, height: cfg.height });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.listen(PORT, () => console.log("TERA EVENTS render service listening on port " + PORT));
