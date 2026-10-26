import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { SHELVES, type ShelfId } from "@/lib/shelves";

/**
 * A 3D bookcase rendered with three.js (no React in this file).
 *
 * Books stand on three shelves with their spines out. When the page opens
 * they drop into place; hovering a book pulls it out and turns it to show its
 * cover; clicking opens it. Ideas taken from the three.js examples:
 * webgl_interactive_cubes (raycast picking), misc_controls_orbit (camera
 * controls) and webgl_shadow_contact (soft shadow under the case).
 *
 * Units are roughly decimetres: a book is about 1.1 tall and 0.8 deep.
 */

export interface BookcaseBook {
  id: number;
  title: string;
  author: string;
  shelf: ShelfId;
  /** Same-origin cover image URL (WebGL cannot use cross-origin images), or null. */
  coverSrc: string | null;
}

export interface BookcaseCallbacks {
  /** A book was hovered (or tapped once on touch screens), or null when none is. */
  onHover(book: BookcaseBook | null, clientX: number, clientY: number): void;
  onOpen(book: BookcaseBook): void;
}

export interface BookcaseOptions {
  reducedMotion: boolean;
  /** CSS font-family used for text drawn onto spines and shelf labels. */
  fontFamily: string;
}

export interface BookcaseHandle {
  dispose(): void;
}

// ---- Dimensions & colours ---------------------------------------------------

const BOOK_DEPTH = 0.8;
const COMPARTMENT_HEIGHT = 1.5;
const PLANK = 0.09;
const SIDE = 0.14;
const CASE_DEPTH = 1.05;
const SHELF_PADDING = 0.25; // space between the side panels and the first/last book
const MIN_INNER_WIDTH = 4;
const MAX_INNER_WIDTH = 14;

const WOOD = "#6b4c36";
const WOOD_DARK = "#5e4331";
const PAGES = "#f4ead8";
const SPINE_COLOURS = ["#7a2e2a", "#9e3a33", "#52201c", "#5c4332", "#5f6f45", "#2f4858", "#8a5a3c", "#c9a089", "#3e5641", "#a8763e"];

/** How far a hovered book slides out, and the pull-out animation speed. */
const PULL_DISTANCE = 0.95;
const PULL_SPEED = 9;

interface BookState {
  book: BookcaseBook;
  mesh: THREE.Mesh;
  base: THREE.Vector3;
  /** 0 = on the shelf, 1 = pulled out and turned to show the cover. */
  pull: number;
  /** Seconds after start when its drop-in animation begins. */
  dropDelay: number;
}

export function createBookcase(
  container: HTMLElement,
  books: BookcaseBook[],
  callbacks: BookcaseCallbacks,
  options: BookcaseOptions,
): BookcaseHandle {
  // Throws if WebGL is unavailable; the caller shows a fallback.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  // On touch screens, keep vertical swipes for scrolling the page.
  renderer.domElement.style.touchAction = coarsePointer ? "pan-y" : "none";
  renderer.domElement.style.display = "block";

  const scene = new THREE.Scene();
  const caseGroup = new THREE.Group();
  scene.add(caseGroup);

  // ---- Layout: work out how wide the case must be ---------------------------

  const byShelf = SHELVES.map((shelf) => books.filter((book) => book.shelf === shelf.id));
  const thicknessOf = (book: BookcaseBook) => 0.17 + random(book.id, 1) * 0.15;
  const rowWidths = byShelf.map((row) => row.reduce((sum, book) => sum + thicknessOf(book) + 0.012, 0));
  const innerWidth = THREE.MathUtils.clamp(Math.max(...rowWidths) + SHELF_PADDING * 2, MIN_INNER_WIDTH, MAX_INNER_WIDTH);
  const innerHeight = SHELVES.length * COMPARTMENT_HEIGHT + (SHELVES.length - 1) * PLANK;
  const outerWidth = innerWidth + SIDE * 2;
  const outerHeight = innerHeight + PLANK * 2;

  // ---- The bookcase itself ----------------------------------------------------

  const woodMaterial = new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.75 });
  const backMaterial = new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.9 });

  const addPanel = (width: number, height: number, depth: number, x: number, y: number, z: number, material = woodMaterial) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    caseGroup.add(mesh);
    return mesh;
  };

  const bottomY = -outerHeight / 2;
  addPanel(SIDE, outerHeight, CASE_DEPTH, -outerWidth / 2 + SIDE / 2, 0, 0); // left side
  addPanel(SIDE, outerHeight, CASE_DEPTH, outerWidth / 2 - SIDE / 2, 0, 0); // right side
  addPanel(innerWidth, PLANK, CASE_DEPTH, 0, outerHeight / 2 - PLANK / 2, 0); // top
  addPanel(outerWidth, outerHeight, 0.05, 0, 0, -CASE_DEPTH / 2 + 0.025, backMaterial); // back

  // Shelf planks, top to bottom. Each shelf's books stand on the plank below them.
  const shelfFloors: number[] = [];
  for (let index = 0; index < SHELVES.length; index++) {
    const floorTop = outerHeight / 2 - PLANK - (index + 1) * COMPARTMENT_HEIGHT - index * PLANK;
    addPanel(innerWidth, PLANK, CASE_DEPTH, 0, floorTop - PLANK / 2, 0);
    shelfFloors.push(floorTop);
  }

  // A brass label on the front edge of each shelf, e.g. "Reading · 3".
  SHELVES.forEach((shelf, index) => {
    const label = `${shelf.label} · ${byShelf[index].length}`;
    const texture = textTexture(label, options.fontFamily);
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.2),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.45, metalness: 0.35 }),
    );
    plate.position.set(0, shelfFloors[index] - PLANK / 2, CASE_DEPTH / 2 + 0.002);
    caseGroup.add(plate);
  });

  // ---- Books -------------------------------------------------------------------

  const textureLoader = new THREE.TextureLoader();
  const states: BookState[] = [];
  const caseFront = CASE_DEPTH / 2;

  byShelf.forEach((row, shelfIndex) => {
    const available = innerWidth - SHELF_PADDING * 2;
    const squeeze = Math.min(1, available / Math.max(rowWidths[shelfIndex], 0.001));
    let x = -innerWidth / 2 + SHELF_PADDING;

    row.forEach((book, indexInRow) => {
      const thickness = thicknessOf(book) * squeeze;
      const height = 1.0 + random(book.id, 2) * 0.32;
      const spineColour = SPINE_COLOURS[Math.floor(random(book.id, 3) * SPINE_COLOURS.length)];

      const pageMaterial = new THREE.MeshStandardMaterial({ color: PAGES, roughness: 0.9 });
      const coverMaterial = new THREE.MeshStandardMaterial({ color: spineColour, roughness: 0.6 });
      if (book.coverSrc) {
        textureLoader.load(book.coverSrc, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          coverMaterial.map = texture;
          coverMaterial.color.set("#ffffff");
          coverMaterial.needsUpdate = true;
        });
      } else {
        coverMaterial.map = coverTexture(book, spineColour, options.fontFamily);
        coverMaterial.color.set("#ffffff");
      }

      // BoxGeometry face order: +x, -x, +y, -y, +z, -z.
      // The spine faces the viewer (+z); the front cover is on +x.
      const materials = [
        coverMaterial,
        new THREE.MeshStandardMaterial({ color: spineColour, roughness: 0.6 }),
        pageMaterial,
        pageMaterial,
        new THREE.MeshStandardMaterial({ map: spineTexture(book, spineColour, options.fontFamily), roughness: 0.55 }),
        pageMaterial,
      ];
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, BOOK_DEPTH), materials);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const base = new THREE.Vector3(x + thickness / 2, shelfFloors[shelfIndex] + height / 2, caseFront - 0.06 - BOOK_DEPTH / 2);
      mesh.position.copy(base);
      // A slight, natural-looking lean for some books.
      mesh.rotation.z = (random(book.id, 4) - 0.5) * 0.02;
      caseGroup.add(mesh);

      states.push({ book, mesh, base, pull: 0, dropDelay: shelfIndex * 0.25 + indexInRow * 0.06 });
      x += thickness + 0.012;
    });
  });

  // ---- Lights, shadow catcher, camera, controls -------------------------------

  scene.add(new THREE.HemisphereLight("#fff4e6", "#5c4332", 1.8));
  // A soft light from the viewer's side, so the inside of the case isn't too dark.
  const fill = new THREE.DirectionalLight("#fff1dc", 0.9);
  fill.position.set(0, 1, 10);
  scene.add(fill);
  const sun = new THREE.DirectionalLight("#ffffff", 2.2);
  sun.position.set(-4, 6, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 4;
  const shadowExtent = Math.max(outerWidth, outerHeight);
  Object.assign(sun.shadow.camera, { left: -shadowExtent, right: shadowExtent, top: shadowExtent, bottom: -shadowExtent });
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(outerWidth * 3, 6), new THREE.ShadowMaterial({ opacity: 0.18 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = bottomY;
  ground.receiveShadow = true;
  scene.add(ground);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false; // never hijack page scrolling
  controls.enablePan = false;
  controls.enableRotate = !coarsePointer;
  controls.enableDamping = true;
  controls.minAzimuthAngle = -0.55;
  controls.maxAzimuthAngle = 0.55;
  controls.minPolarAngle = Math.PI / 2 - 0.35;
  controls.maxPolarAngle = Math.PI / 2 + 0.1;

  /** Places the camera so the whole case fits the current canvas size. */
  function fitCamera() {
    const { clientWidth: width, clientHeight: height } = container;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = width / height;
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const fitHeight = (outerHeight / 2) / Math.tan(halfFov);
    const fitWidth = (outerWidth / 2) / (Math.tan(halfFov) * camera.aspect);
    const distance = Math.max(fitHeight, fitWidth) * 1.12 + caseFront + PULL_DISTANCE;
    camera.position.set(0, 0.35, distance);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.update();
  }

  // ---- Interaction ---------------------------------------------------------------

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const meshes = states.map((state) => state.mesh);
  let hovered: BookState | null = null;
  let pressedAt: { x: number; y: number } | null = null;

  function pick(event: PointerEvent): BookState | null {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit ? (states.find((state) => state.mesh === hit.object) ?? null) : null;
  }

  function setHovered(state: BookState | null, event: PointerEvent) {
    hovered = state;
    renderer.domElement.style.cursor = state ? "pointer" : "";
    callbacks.onHover(state?.book ?? null, event.clientX, event.clientY);
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerType === "touch") return; // touch uses tap-to-select instead
    setHovered(pick(event), event);
  }

  function onPointerDown(event: PointerEvent) {
    pressedAt = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent) {
    // Ignore drags (rotating the view) – only treat short presses as clicks.
    if (!pressedAt || Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) > 6) return;
    pressedAt = null;
    const state = pick(event);
    if (!state) {
      setHovered(null, event);
    } else if (event.pointerType === "touch" && hovered !== state) {
      setHovered(state, event); // first tap pulls the book out, second tap opens it
    } else {
      callbacks.onOpen(state.book);
    }
  }

  function onPointerLeave(event: PointerEvent) {
    if (event.pointerType !== "touch") setHovered(null, event);
  }

  const canvas = renderer.domElement;
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);

  // ---- Animation loop ------------------------------------------------------------

  let last = 0;
  let elapsed = 0;

  function animate(time: number) {
    const delta = last ? Math.min((time - last) / 1000, 0.1) : 0;
    last = time;
    elapsed += delta;

    for (const state of states) {
      // Drop-in: each book falls onto its shelf with a small bounce.
      const dropProgress = options.reducedMotion ? 1 : THREE.MathUtils.clamp((elapsed - state.dropDelay) / 0.7, 0, 1);
      const dropOffset = (1 - easeOutBack(dropProgress)) * 2.2;

      // Pull-out: slide out first, then turn to show the cover.
      const target = state === hovered ? 1 : 0;
      state.pull += (target - state.pull) * (1 - Math.exp(-delta * (options.reducedMotion ? 30 : PULL_SPEED)));
      const slide = easeOutCubic(Math.min(state.pull / 0.55, 1));
      const turn = easeInOutCubic(THREE.MathUtils.clamp((state.pull - 0.35) / 0.65, 0, 1));

      state.mesh.position.set(state.base.x, state.base.y + dropOffset + slide * 0.06, state.base.z + slide * PULL_DISTANCE);
      state.mesh.rotation.y = -turn * (Math.PI / 2) * 0.92;
      state.mesh.visible = dropProgress > 0;
    }

    // A gentle sway so the case feels alive (skipped for reduced motion).
    caseGroup.rotation.y = options.reducedMotion ? 0 : Math.sin(elapsed * 0.35) * 0.035;

    controls.update();
    renderer.render(scene, camera);
  }

  fitCamera();
  const resizeObserver = new ResizeObserver(fitCamera);
  resizeObserver.observe(container);

  // Only animate while the bookcase is on screen.
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    last = 0;
    renderer.setAnimationLoop(entry?.isIntersecting ? animate : null);
  });
  visibilityObserver.observe(container);

  return {
    dispose() {
      renderer.setAnimationLoop(null);
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      controls.dispose();
      disposeScene(scene);
      renderer.dispose();
      canvas.remove();
    },
  };
}

// ---- Textures drawn on a canvas --------------------------------------------------

/** The spine: coloured cloth with gilt bands and the title running top to bottom. */
function spineTexture(book: BookcaseBook, colour: string, fontFamily: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 1024;
  const context = canvas.getContext("2d")!;
  const ink = isDark(colour) ? "#f6e7c8" : "#3b2a20";

  context.fillStyle = colour;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = ink;
  for (const y of [60, 80, canvas.height - 90, canvas.height - 70]) context.fillRect(10, y, canvas.width - 20, 6);

  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(Math.PI / 2);
  context.font = `600 52px ${fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(fitText(context, book.title, canvas.height - 260), 0, 0);
  context.restore();

  return finishTexture(canvas);
}

/** A typographic front cover for books without a cover image. */
function coverTexture(book: BookcaseBook, colour: string, fontFamily: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 720;
  const context = canvas.getContext("2d")!;
  const ink = isDark(colour) ? "#f6e7c8" : "#3b2a20";

  context.fillStyle = colour;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = ink;
  context.lineWidth = 6;
  context.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);
  context.fillStyle = ink;
  context.textAlign = "center";
  context.font = `700 48px ${fontFamily}`;
  wrapText(context, book.title, canvas.width / 2, 260, canvas.width - 120, 58, 4);
  context.font = `400 32px ${fontFamily}`;
  context.fillText(fitText(context, book.author, canvas.width - 120), canvas.width / 2, canvas.height - 110);

  return finishTexture(canvas);
}

/** Text on a brass-coloured plate. */
function textTexture(text: string, fontFamily: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 102;
  const context = canvas.getContext("2d")!;
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#d8b878");
  gradient.addColorStop(1, "#a8823f");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#3b2a20";
  context.font = `600 52px ${fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(fitText(context, text, canvas.width - 40), canvas.width / 2, canvas.height / 2 + 2);
  return finishTexture(canvas);
}

function finishTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
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

// ---- Helpers -----------------------------------------------------------------------

/** Deterministic pseudo-random number in [0, 1) for a book, so its look never changes. */
function random(id: number, salt: number): number {
  const value = Math.sin(id * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function isDark(hex: string): boolean {
  const colour = new THREE.Color(hex);
  return colour.r * 0.299 + colour.g * 0.587 + colour.b * 0.114 < 0.55;
}

function easeOutBack(t: number): number {
  const c = 1.4;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function disposeScene(scene: THREE.Scene) {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}
