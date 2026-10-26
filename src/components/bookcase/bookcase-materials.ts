import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/**
 * Procedural materials for the 3D bookcase, drawn on canvases so no image
 * files are needed: walnut wood with grain, brass plates with rivets and
 * engraved text, cloth book spines with gold foil, page edges, and the
 * black textured DNF bin.
 */

/** Cloth colours for book spines: creams, dusty pinks, deep reds, greens and browns. */
export const BOOK_COLOURS = ["#d6bfa3", "#c48f80", "#82201f", "#2b4532", "#52321f", "#93601f", "#352b26", "#a97350", "#661c1c", "#cbb08e"];

const GOLD = "#d4ad57";
const GOLD_SHADE = "#9c7a30";
/** Brass for the label plates: deeper than the foil, so it reads as metal rather than paint. */
const BRASS = "#b48c3c";

// ---- Wood -----------------------------------------------------------------------

export interface WoodMaterials {
  /** Grain running left to right: top, planks. */
  horizontal: THREE.MeshStandardMaterial;
  /** Grain running up and down: side panels. */
  vertical: THREE.MeshStandardMaterial;
  /** Darker panel for the back of the case. */
  back: THREE.MeshStandardMaterial;
}

export function createWoodMaterials(): WoodMaterials {
  const grain = woodGrainTexture();
  const make = (rotation: number, repeat: [number, number], tint: string) => {
    const map = grain.clone();
    map.center.set(0.5, 0.5);
    map.rotation = rotation;
    map.repeat.set(...repeat);
    map.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.6, color: tint, roughness: 0.62 });
  };
  return {
    horizontal: make(0, [2, 1], "#ffffff"),
    vertical: make(Math.PI / 2, [2, 1], "#ffffff"),
    back: make(Math.PI / 2, [3, 2], "#9a8270"),
  };
}

/** Walnut: warm brown with long, slightly wavy darker and lighter grain lines. */
function woodGrainTexture(): THREE.CanvasTexture {
  const { canvas, context } = createCanvas(1024, 512);
  const base = context.createLinearGradient(0, 0, 0, canvas.height);
  base.addColorStop(0, "#4a2913");
  base.addColorStop(0.5, "#56321a");
  base.addColorStop(1, "#472712");
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const random = seededRandom(7);
  for (let line = 0; line < 170; line++) {
    const y0 = random() * canvas.height;
    const amplitude = 2 + random() * 7;
    const frequency = 0.004 + random() * 0.01;
    const phase = random() * Math.PI * 2;
    const dark = random() > 0.35;
    context.strokeStyle = dark ? `rgba(30, 14, 5, ${0.1 + random() * 0.25})` : `rgba(140, 88, 48, ${0.08 + random() * 0.16})`;
    context.lineWidth = 0.6 + random() * 2.4;
    context.beginPath();
    for (let x = 0; x <= canvas.width; x += 8) {
      const y = y0 + Math.sin(x * frequency + phase) * amplitude + Math.sin(x * 0.031 + phase) * 1.2;
      if (x === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
  // Fine pores.
  for (let i = 0; i < 9000; i++) {
    context.fillStyle = `rgba(40, 20, 8, ${random() * 0.12})`;
    context.fillRect(random() * canvas.width, random() * canvas.height, 2 + random() * 6, 1);
  }
  return toTexture(canvas, true);
}

// ---- Brass label plates ---------------------------------------------------------

export interface BrassPlate {
  group: THREE.Group;
  setText(text: string): void;
}

const brassMaterial = () => new THREE.MeshStandardMaterial({ color: BRASS, metalness: 1, roughness: 0.38 });

/** A rounded brass plate with a rivet at each end and engraved text. */
export function createBrassPlate(width: number, height: number, fontFamily: string): BrassPlate {
  const group = new THREE.Group();
  const depth = 0.024;

  const body = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 2, Math.min(height * 0.2, 0.02)), brassMaterial());
  body.castShadow = true;
  group.add(body);

  const rivetGeometry = new THREE.SphereGeometry(height * 0.12, 16, 8);
  for (const side of [-1, 1]) {
    const rivet = new THREE.Mesh(rivetGeometry, brassMaterial());
    rivet.scale.z = 0.45;
    rivet.position.set(side * (width / 2 - height * 0.32), 0, depth / 2);
    group.add(rivet);
  }

  const engravingMaterial = new THREE.MeshStandardMaterial({
    transparent: true,
    metalness: 0.2,
    roughness: 0.7,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const engraving = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.78, height * 0.9), engravingMaterial);
  engraving.position.z = depth / 2 + 0.001;
  group.add(engraving);

  return {
    group,
    setText(text) {
      engravingMaterial.map?.dispose();
      engravingMaterial.map = engravedTextTexture(text, width * 0.78, height * 0.9, fontFamily);
      engravingMaterial.needsUpdate = true;
    },
  };
}

/** Dark lettering with a light lower edge, so it reads as cut into the metal. */
function engravedTextTexture(text: string, width: number, height: number, fontFamily: string): THREE.CanvasTexture {
  const pixelsPerUnit = 800;
  const { canvas, context } = createCanvas(Math.round(width * pixelsPerUnit), Math.round(height * pixelsPerUnit));
  const fontSize = canvas.height * 0.6;
  context.font = `700 ${fontSize}px ${fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const label = fitText(context, text, canvas.width * 0.96);
  const x = canvas.width / 2;
  const y = canvas.height / 2 + fontSize * 0.04;
  context.fillStyle = "rgba(255, 236, 190, 0.6)";
  context.fillText(label, x, y + Math.max(1.5, fontSize * 0.05));
  context.fillStyle = "#24170a";
  context.fillText(label, x, y);
  return toTexture(canvas);
}

// ---- Books ------------------------------------------------------------------------

export interface SpineMaps {
  map: THREE.CanvasTexture;
  /** White where there is gold foil, so only the foil is metallic. */
  metalnessMap: THREE.CanvasTexture;
  /** Shiny foil, matte cloth. */
  roughnessMap: THREE.CanvasTexture;
}

type SpineLayer = "colour" | "metal" | "rough";

/**
 * Cloth spine with gold bands, a small ornament and the title (gold on dark
 * cloth). Rated books also get a gilded star near the top.
 */
export function spineMaps(title: string, cloth: string, fontFamily: string, rated: boolean): SpineMaps {
  const draw = (layer: SpineLayer) => {
    const { canvas, context } = createCanvas(128, 1024);
    drawSpine(context, layer, title, cloth, fontFamily, rated);
    return toTexture(canvas, layer === "colour");
  };
  return { map: draw("colour"), metalnessMap: draw("metal"), roughnessMap: draw("rough") };
}

function drawSpine(
  context: CanvasRenderingContext2D,
  layer: SpineLayer,
  title: string,
  cloth: string,
  fontFamily: string,
  rated: boolean,
) {
  const { width, height } = context.canvas;
  const darkCloth = isDark(cloth);
  // In the metal and roughness layers, "gold" is white (metal) / dark grey (shiny).
  const gold = layer === "colour" ? GOLD : layer === "metal" ? "#ffffff" : "#555555";
  const background = layer === "colour" ? cloth : layer === "metal" ? "#000000" : "#dddddd";

  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  if (layer === "colour") {
    // Cloth weave and a soft shadow at the rounded edges of the spine.
    const random = seededRandom(title.length * 31 + 3);
    for (let i = 0; i < 1400; i++) {
      context.fillStyle = random() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)";
      context.fillRect(random() * width, random() * height, 1 + random() * 3, 1);
    }
    const edges = context.createLinearGradient(0, 0, width, 0);
    edges.addColorStop(0, "rgba(0,0,0,0.28)");
    edges.addColorStop(0.18, "rgba(0,0,0,0)");
    edges.addColorStop(0.82, "rgba(0,0,0,0)");
    edges.addColorStop(1, "rgba(0,0,0,0.28)");
    context.fillStyle = edges;
    context.fillRect(0, 0, width, height);
  }

  // Gold bands near the top and bottom.
  context.fillStyle = gold;
  for (const [y, h] of [[58, 6], [72, 3], [height - 75, 3], [height - 64, 6]]) context.fillRect(12, y, width - 24, h);
  // Small diamond ornaments inside the bands.
  for (const y of [100, height - 100]) {
    context.beginPath();
    context.moveTo(width / 2, y - 10);
    context.lineTo(width / 2 + 9, y);
    context.lineTo(width / 2, y + 10);
    context.lineTo(width / 2 - 9, y);
    context.closePath();
    context.fill();
  }

  // A gilded star under the top ornament marks a book the user has rated.
  const starSpace = rated ? 70 : 0;
  if (rated) drawStar(context, width / 2, 150, 24, gold);

  // Title, running top to bottom: gold foil on dark cloth, dark ink on light cloth.
  const titleIsGold = darkCloth;
  if (layer !== "colour" && !titleIsGold) return;
  context.save();
  context.translate(width / 2, height / 2 + starSpace / 2);
  context.rotate(Math.PI / 2);
  context.font = `600 50px ${fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const label = fitText(context, title, height - 290 - starSpace);
  if (layer === "colour" && titleIsGold) {
    context.fillStyle = GOLD_SHADE; // a slight shadow gives the foil some depth
    context.fillText(label, 1.5, 1.5);
  }
  context.fillStyle = titleIsGold ? gold : "#3b2416";
  context.fillText(label, 0, 0);
  context.restore();
}

/** A five-pointed star centred on (x, y). */
function drawStar(context: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string) {
  context.beginPath();
  for (let point = 0; point < 10; point++) {
    const r = point % 2 === 0 ? radius : radius * 0.45;
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    context.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  }
  context.closePath();
  context.fillStyle = fill;
  context.fill();
}

/** Cream page edges with fine lines, for the top, bottom and fore-edge of a book. */
export function pageEdgesTexture(): THREE.CanvasTexture {
  const { canvas, context } = createCanvas(256, 256);
  context.fillStyle = "#f1e6d2";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const random = seededRandom(11);
  for (let y = 0; y < canvas.height; y += 2) {
    context.fillStyle = `rgba(120, 95, 60, ${0.04 + random() * 0.1})`;
    context.fillRect(0, y, canvas.width, 1);
  }
  return toTexture(canvas, true);
}

/** A typographic front cover for books without a cover image. */
export function plainCoverTexture(title: string, author: string, cloth: string, fontFamily: string): THREE.CanvasTexture {
  const { canvas, context } = createCanvas(512, 720);
  const ink = isDark(cloth) ? GOLD : "#3b2416";
  context.fillStyle = cloth;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = ink;
  context.lineWidth = 5;
  context.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);
  context.fillStyle = ink;
  context.textAlign = "center";
  context.font = `700 46px ${fontFamily}`;
  wrapText(context, title, canvas.width / 2, 250, canvas.width - 120, 56, 4);
  context.font = `400 30px ${fontFamily}`;
  context.fillText(fitText(context, author, canvas.width - 120), canvas.width / 2, canvas.height - 110);
  return toTexture(canvas);
}

// ---- The DNF bin ------------------------------------------------------------------

/** Black powder-coated metal with a fine, leathery texture. */
export function createBinMaterials(): { outside: THREE.MeshStandardMaterial; inside: THREE.MeshStandardMaterial } {
  const { canvas, context } = createCanvas(512, 512);
  context.fillStyle = "#808080";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const random = seededRandom(5);
  for (let i = 0; i < 26000; i++) {
    const shade = 100 + random() * 60;
    context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.5)`;
    context.beginPath();
    context.arc(random() * canvas.width, random() * canvas.height, 0.6 + random() * 1.8, 0, Math.PI * 2);
    context.fill();
  }
  const bump = toTexture(canvas);
  bump.repeat.set(4, 2);
  return {
    outside: new THREE.MeshStandardMaterial({
      color: "#2a2623",
      roughness: 0.62,
      metalness: 0.25,
      bumpMap: bump,
      bumpScale: 1.2,
      emissive: "#e0a060",
      emissiveIntensity: 0,
    }),
    inside: new THREE.MeshStandardMaterial({ color: "#1b1816", roughness: 0.8, side: THREE.BackSide, bumpMap: bump, bumpScale: 0.8 }),
  };
}

// ---- Shadows inside the case ----------------------------------------------------

/** Soft darkening for the back of a compartment: deeper under the shelf above and in the corners. */
export function compartmentShadowTexture(): THREE.CanvasTexture {
  const { canvas, context } = createCanvas(256, 256);
  const vertical = context.createLinearGradient(0, 0, 0, canvas.height);
  vertical.addColorStop(0, "rgba(0,0,0,0.55)");
  vertical.addColorStop(0.35, "rgba(0,0,0,0.12)");
  vertical.addColorStop(1, "rgba(0,0,0,0.25)");
  context.fillStyle = vertical;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const horizontal = context.createLinearGradient(0, 0, canvas.width, 0);
  horizontal.addColorStop(0, "rgba(0,0,0,0.35)");
  horizontal.addColorStop(0.12, "rgba(0,0,0,0)");
  horizontal.addColorStop(0.88, "rgba(0,0,0,0)");
  horizontal.addColorStop(1, "rgba(0,0,0,0.35)");
  context.fillStyle = horizontal;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return toTexture(canvas);
}

// ---- Helpers ------------------------------------------------------------------------

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas, context: canvas.getContext("2d")! };
}

function toTexture(canvas: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Small deterministic random generator, so textures look the same on every visit. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

export function isDark(hex: string): boolean {
  const colour = new THREE.Color(hex);
  return colour.r * 0.299 + colour.g * 0.587 + colour.b * 0.114 < 0.5;
}

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (context.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && context.measureText(`${text.slice(0, end)}…`).width > maxWidth) end--;
  return `${text.slice(0, end).trimEnd()}…`;
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((text, index, shown) => {
    const isLast = index === shown.length - 1 && lines.length > maxLines;
    context.fillText(isLast ? fitText(context, `${text}…`, maxWidth) : text, x, y + index * lineHeight);
  });
}
