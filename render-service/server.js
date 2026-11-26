const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { chromium } = require("playwright");
const { layouts } = require("./layouts");
const { fontCss } = require("./font-css");
const { templates: templateSpecs } = require("./template-specs.json");

const PORT = process.env.PORT || 3000;
const AUTH_TOKEN = process.env.RENDER_AUTH_TOKEN || "";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "";
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, "generated");
fs.mkdirSync(STORAGE_DIR, { recursive: true });
const dayMs = 24 * 60 * 60 * 1000;
function purgeOldRenders() {
  const cutoff = Date.now() - 30 * dayMs;
  for (const entry of fs.readdirSync(STORAGE_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const file = path.join(STORAGE_DIR, entry.name);
    try {
      if (fs.statSync(file).mtimeMs < cutoff) fs.unlinkSync(file);
    } catch (error) {
      if (error.code !== "ENOENT") console.error(error);
    }
  }
}

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
function fitAttributes(field, specs, width, height) {
  const spec = specs[field];
  if (!spec) return "";
  return `data-fit-text="1" data-field="${escapeHtml(field)}" data-max-width="${width || 0}" data-max-height="${height || 0}" data-max-lines="${spec.maxLines}" data-min-size="${spec.minSize}"`;
}

function renderNode(n, data, specs) {
  if (!n) return "";

  if (n.type === "text") {
    const text = resolveText(n, data);
    if (!text) return "";
    const renderedSize = n.size;
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
    const fit = fitAttributes(n.data, specs, n.w || n.fit?.maxWidth, n.fit?.maxHeight);
    return `<div ${fit} style="${position} font-family:'${n.font}', sans-serif; font-weight:${n.weight}; font-size:${renderedSize}px; line-height:${n.lineHeight || 1.2}; font-style:${n.italic ? "italic" : "normal"}; color:${n.color}; text-align:${textAlign}; text-transform:${n.uppercase ? "uppercase" : "none"}; white-space:${whiteSpace}; word-wrap:break-word; ${w} ${rotate} ${shadow} ${underline} ${balance} ${flex}">${escapeHtml(text)}</div>`;
  }

  // Titre bicolore : le début en couleur normale, la fin en italique/couleur accent — reproduit
  // le motif exact "Coordination complète" / "Le Jour J seul" des slides Déclic (un seul bloc de
  // texte avec deux segments, pour que le retour à la ligne reste naturel).
  if (n.type === "titleTwoTone") {
    const normal = resolveText({ data: n.dataNormal }, data);
    const accent = resolveText({ data: n.dataAccent }, data);
    if (!normal && !accent) return "";
    return `<div ${fitAttributes(`${n.dataNormal}+${n.dataAccent}`, specs, n.w)} style="font-family:'${n.font}', serif; font-weight:${n.weight}; font-size:${n.size}px; line-height:${n.lineHeight || 1.15}; color:${n.color}; width:100%; flex-shrink:0;">${escapeHtml(normal)} <span style="font-style:italic; font-weight:${n.accentWeight || n.weight}; color:${n.accentColor};">${escapeHtml(accent)}</span></div>`;
  }

  if (n.type === "quoteTwoTone") {
    const accent = resolveText({ data: n.dataAccent }, data);
    const main = resolveText({ data: n.dataMain }, data);
    if (!accent && !main) return "";
    return `<div ${fitAttributes(`${n.dataAccent}+${n.dataMain}`, specs, n.w)} style="font-family:'${n.font}', serif; font-size:${n.size}px; line-height:${n.lineHeight}; width:${n.w}px; color:${n.color}; text-align:center; flex-shrink:0;"><span style="font-weight:700; font-style:normal; color:${n.accentColor};">${escapeHtml(accent)}</span><span style="font-weight:500; font-style:italic;">${accent && main ? " " : ""}${escapeHtml(main)}</span></div>`;
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
    return `<div style="width:${n.size}px; height:${n.size}px; min-width:${n.size}px; border-radius:50%; background:${n.bg}; display:flex; align-items:center; justify-content:center; flex-shrink:0;"><div ${fitAttributes(n.data, specs, n.size)} style="font-family:'${n.font}', sans-serif; font-weight:${n.weight}; font-size:${n.textSize}px; color:${n.textColor};">${escapeHtml(text)}</div></div>`;
  }

  if (n.type === "pill" || n.type === "outlinePill") {
    const bg = n.type === "pill" ? `background:${n.bg};` : `border:1.5px solid ${n.border};`;
    const rotate = n.rotate ? `transform:rotate(${n.rotate}deg);` : "";
    const w = n.w ? `width:${n.w}px;` : "";
    const h = n.h ? `height:${n.h}px;` : "";
    const shadow = n.shadow ? `box-shadow:${n.shadow};` : "";
    const inner = (n.children || []).map(c => renderNode(c, data, specs)).join("");
    const position = n.x !== undefined ? `position:absolute; left:${n.x}px; top:${n.y}px;` : "";
    return `<div style="${position} display:inline-flex; ${bg} ${w} ${h} ${shadow} border-radius:999px; padding:${n.padding || "10px 22px"}; ${rotate} align-items:center; justify-content:center; flex-shrink:0; align-self:${n.alignSelf || "flex-start"};">${inner}</div>`;
  }

  if (n.type === "bar") {
    const text = resolveText(n, data);
    if (n.hideIfEmpty && !text) return "";
    return `<div style="display:flex; align-items:center; justify-content:space-between; width:100%; background:${n.bg}; border-radius:999px; padding:${n.padding || "20px 30px"}; box-sizing:border-box; flex-shrink:0;">${(n.children || []).map(c => renderNode(c, data, specs)).join("")}</div>`;
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
    const inner = (n.children || []).map(c => renderNode(c, data, specs)).filter(Boolean).join("");
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
    boxesHtml += renderNode(cfg.root, data, templateSpecs[templateName].fields);
  }

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  ${fontCss}
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

async function closeBrowser() {
  const current = browserPromise;
  browserPromise = undefined;
  if (current) await (await current).close();
}

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use("/images", express.static(STORAGE_DIR, { maxAge: "365d", immutable: true }));

app.get("/health", (req, res) => res.json({ ok: true, templates: Object.keys(layouts) }));
app.get("/specs", (req, res) => {
  if (AUTH_TOKEN && req.headers["x-render-token"] !== AUTH_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return res.json(require("./template-specs.json"));
});

app.post("/render/:template", async (req, res) => {
  let page;
  try {
    if (AUTH_TOKEN) {
      const provided = req.headers["x-render-token"];
      if (provided !== AUTH_TOKEN) return res.status(401).json({ error: "unauthorized" });
    }
    const templateName = req.params.template;
    const cfg = layouts[templateName];
    if (!cfg) return res.status(400).json({ error: "unknown template", known: Object.keys(layouts) });

    const data = req.body || {};
    for (const [field, spec] of Object.entries(templateSpecs[templateName].fields)) {
      if (!spec.static) continue;
      const value = typeof data[field] === "string" ? data[field] : "";
      const length = Array.from(value).length;
      if ((spec.required && !value.trim()) || length > spec.maxChars || value.split(/\r\n|[\r\n]/).length > spec.maxLines) {
        return res.status(400).json({ error: "invalid_static_field", field, length, maxChars: spec.maxChars });
      }
    }
    const fields = templateSpecs[templateName].fields;
    const missing = Object.entries(fields).filter(([field, spec]) =>
      spec.required && !field.split("+").some(key => String(data[key] ?? "").trim())
    ).map(([field]) => field);
    if (missing.length) return res.status(400).json({ error: "missing_fields", fields: missing });
    const lengths = Object.fromEntries(Object.keys(fields).map(field => [
      field, field.split("+").reduce((sum, key) => sum + Array.from(String(data[key] ?? "")).length, 0)
    ]));
    const tooLong = Object.entries(fields).filter(([field, spec]) => lengths[field] > spec.maxChars)
      .map(([field, spec]) => ({
        field, reason: "width", lines: 0, maxLines: spec.maxLines, size: spec.size,
        minSize: spec.minSize, length: lengths[field], maxChars: spec.maxChars
      }));
    if (tooLong.length) return res.status(422).json({ error: "overflow", template: templateName, fields: tooLong });
    const html = buildHtml(templateName, data);

    if (req.query.debug === "html") {
      res.set("Content-Type", "text/plain; charset=utf-8");
      return res.send(html);
    }

    const browser = await getBrowser();
    page = await browser.newPage({ viewport: { width: cfg.width, height: cfg.height } });
    await page.setContent(html, { waitUntil: "networkidle" });
    const result = await page.evaluate(async () => {
      await document.fonts.ready;
      const fonts = new Set();
      for (const element of document.querySelectorAll(".canvas *")) {
        if (![...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) continue;
        if (!element.style.fontFamily && !element.parentElement.closest("[data-field]")) continue;
        const style = getComputedStyle(element);
        const family = style.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
        fonts.add(JSON.stringify([family, style.fontWeight, style.fontStyle]));
      }
      for (const font of fonts) {
        const [family, weight, style] = JSON.parse(font);
        const query = `${style} ${weight} 32px "${family}"`;
        if (!(await document.fonts.load(query)).length || !document.fonts.check(query)) {
          return { missingFont: `${family} ${weight}${style === "italic" ? " italic" : ""}` };
        }
      }

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

      const issues = [];
      const elements = [...document.querySelectorAll("[data-fit-text]")];
      for (const el of elements) {
        const maxWidth = Number(el.dataset.maxWidth || 0);
        const maxHeight = Number(el.dataset.maxHeight || 0);
        const maxLines = Number(el.dataset.maxLines || 0);
        const minSize = Number(el.dataset.minSize || 12);
        let size = Number.parseFloat(getComputedStyle(el).fontSize);
        const measure = () => {
          const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || size * 1.2;
          const lines = Math.max(1, Math.ceil((el.scrollHeight - 1) / lineHeight));
          const width = maxWidth || Math.min(el.clientWidth, el.parentElement.clientWidth);
          const reason = width > 0 && el.scrollWidth > width + 1 ? "width" :
            ((maxHeight > 0 && el.scrollHeight > maxHeight + 1) || lines > maxLines) ? "lines" : null;
          return { field: el.dataset.field, reason, lines, maxLines, size, minSize };
        };
        while (size > minSize && measure().reason) {
          size = Math.max(minSize, size - 1);
          el.style.fontSize = `${size}px`;
        }
        if (measure().reason) issues.push(measure());
      }

      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const bounds = canvas.getBoundingClientRect();
      const textBoxes = elements.map(el => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return { el, rects: [...range.getClientRects()] };
      });
      const flag = (el, reason) => {
        if (issues.some(issue => issue.field === el.dataset.field && issue.reason === reason)) return;
        const style = getComputedStyle(el);
        issues.push({
          field: el.dataset.field, reason,
          lines: Math.max(1, Math.ceil((el.scrollHeight - 1) / parseFloat(style.lineHeight))),
          maxLines: Number(el.dataset.maxLines), size: parseFloat(style.fontSize),
          minSize: Number(el.dataset.minSize)
        });
      };
      for (const [index, box] of textBoxes.entries()) {
        if (box.rects.some(r => r.left < bounds.left - 1 || r.top < bounds.top - 1 ||
          r.right > bounds.right + 1 || r.bottom > bounds.bottom + 1)) flag(box.el, "canvas");
        for (const other of textBoxes.slice(index + 1)) {
          if (box.rects.some(a => other.rects.some(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1))) {
            flag(box.el, "overlap");
            flag(other.el, "overlap");
          }
        }
      }
      return { issues };
    });
    if (result.missingFont) return res.status(500).json({ error: "font_missing", font: result.missingFont });
    const { issues } = result;
    if (issues.length) {
      const staticIssue = issues.find(issue => fields[issue.field].static);
      if (staticIssue) {
        const field = staticIssue.field;
        return res.status(400).json({ error: "invalid_static_field", field, length: lengths[field], maxChars: fields[field].maxChars });
      }
      return res.status(422).json({
        error: "overflow", template: templateName,
        fields: issues.map(issue => ({ ...issue, length: lengths[issue.field], maxChars: fields[issue.field].maxChars }))
      });
    }
    const buffer = await page.screenshot({ type: "png" });

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
  } finally {
    await page?.close().catch(() => {});
  }
});

if (require.main === module) {
  purgeOldRenders();
  setInterval(purgeOldRenders, dayMs).unref();
  app.listen(PORT, () => console.log("TERA EVENTS render service listening on port " + PORT));
}

module.exports = { app, buildHtml, closeBrowser };
