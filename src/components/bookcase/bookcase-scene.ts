import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

import { BOOKCASE_SHELVES, type ShelfId } from "@/lib/shelves";
import {
  BOOK_COLOURS,
  compartmentShadowTexture,
  createBinMaterials,
  createBrassPlate,
  createWoodMaterials,
  pageEdgesTexture,
  plainCoverTexture,
  spineMaps,
} from "./bookcase-materials";

/**
 * A 3D bookcase rendered with three.js (no React in this file).
 *
 * Books stand on three shelves with their spines out; a "DNF" wastebasket
 * stands beside the case. When the page opens the books drop into place.
 * Hovering a book pulls it out and turns it to show its cover, clicking
 * opens it, and dragging moves it to another shelf or into the bin.
 *
 * Ideas taken from the three.js examples: webgl_interactive_cubes (raycast
 * picking), misc_controls_orbit (camera controls) and webgl_shadow_contact
 * (soft shadow under the case).
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
  /** The user’s 1-5 star rating; rated books get a gilded star on the spine. */
  rating: number | null;
  review: string | null;
}

export interface BookcaseCallbacks {
  /** A book was hovered (or tapped once on touch screens), or null when none is. */
  onHover(book: BookcaseBook | null, clientX: number, clientY: number): void;
  onOpen(book: BookcaseBook): void;
  /** A book was dragged onto another shelf or into the bin. The scene has already moved it. */
  onMove(book: BookcaseBook, from: ShelfId): void;
}

export interface BookcaseOptions {
  reducedMotion: boolean;
  /** CSS font-family used for text drawn onto spines and labels. */
  fontFamily: string;
}

export interface BookcaseHandle {
  /** Re-arranges the scene for an updated list of books; moved books glide to their new place. */
  setBooks(books: BookcaseBook[]): void;
  dispose(): void;
}

// ---- Dimensions & colours ---------------------------------------------------

const BOOK_DEPTH = 0.8;
const BOOK_GAP = 0.012;
const COMPARTMENT_HEIGHT = 1.5;
const PLANK = 0.1;
const SIDE = 0.16;
const TOP = 0.13;
const CASE_DEPTH = 1.05;
/** Radius of the bevelled edges on the case. */
const BEVEL = 0.025;
const SHELF_PADDING = 0.25; // space between the side panels and the first/last book
const MIN_INNER_WIDTH = 4;
const MAX_INNER_WIDTH = 14;

const BIN_RADIUS_TOP = 0.6;
const BIN_RADIUS_BOTTOM = 0.47;
const BIN_HEIGHT = 1.0;
const BIN_GAP = 0.7; // between the case and the bin
const BIN_BOOK_SCALE = 0.82;

/** Dragged books move on a plane this far in front of the case's centre. */
const DRAG_Z = CASE_DEPTH / 2 + 0.55;
/** Pointer travel (px) before a press on a book becomes a drag. */
const DRAG_THRESHOLD = 6;


/** How far a hovered book slides out, and the pull-out animation speed. */
const PULL_DISTANCE = 0.95;
const PULL_SPEED = 9;

interface BookState {
  book: BookcaseBook;
  mesh: THREE.Mesh;
  /**
   * Invisible copy of the book in its resting place, used for hover and
   * clicks. A hovered book lifts or slides out; without this it could move
   * out from under the pointer and flicker between hovered and not.
   */
  hitArea: THREE.Mesh;
  /** Spine material, redrawn when the book is rated or un-rated. */
  spine: THREE.MeshStandardMaterial;
  cloth: string;
  height: number;
  /** Where the book rests: on a shelf or in the bin. */
  home: THREE.Vector3;
  homeRotation: THREE.Euler;
  /** Animated resting position; glides towards `home` when the book is moved. */
  position: THREE.Vector3;
  /** 0 = resting, 1 = pulled out (shelf) or lifted (bin). */
  pull: number;
  /** Seconds after start when its drop-in animation begins. */
  dropDelay: number;
}

export function createBookcase(
  container: HTMLElement,
  initialBooks: BookcaseBook[],
  callbacks: BookcaseCallbacks,
  options: BookcaseOptions,
): BookcaseHandle {
  // Throws if WebGL is unavailable; the caller shows a fallback.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // Filmic-but-faithful colour response, so cloth and wood keep their hues.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.92;
  const canvas = renderer.domElement;
  container.appendChild(canvas);

  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  // On touch screens, keep vertical swipes for scrolling the page.
  canvas.style.touchAction = coarsePointer ? "pan-y" : "none";
  canvas.style.display = "block";

  const scene = new THREE.Scene();
  // A soft studio environment for reflections: it is what makes brass and gold foil shine.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.4;
  room.dispose();
  pmrem.dispose();

  /** Everything that sways together: the case, the bin and the books. */
  const world = new THREE.Group();
  scene.add(world);

  // ---- The bookcase ---------------------------------------------------------------

  const rowWidth = (books: BookcaseBook[]) => books.reduce((sum, book) => sum + thicknessOf(book) + BOOK_GAP, 0);
  const initialRows = BOOKCASE_SHELVES.map((shelf) => initialBooks.filter((book) => book.shelf === shelf.id));
  const innerWidth = THREE.MathUtils.clamp(
    Math.max(...initialRows.map(rowWidth)) + SHELF_PADDING * 2,
    MIN_INNER_WIDTH,
    MAX_INNER_WIDTH,
  );
  const innerHeight = BOOKCASE_SHELVES.length * COMPARTMENT_HEIGHT + (BOOKCASE_SHELVES.length - 1) * PLANK;
  const outerWidth = innerWidth + SIDE * 2;
  const outerHeight = innerHeight + TOP + PLANK;
  const bottomY = -outerHeight / 2;
  const caseFront = CASE_DEPTH / 2;

  // Walnut with bevelled edges: grain runs along the length of each board.
  const wood = createWoodMaterials();
  const addBoard = (width: number, height: number, depth: number, x: number, y: number, z: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 3, BEVEL), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    world.add(mesh);
    return mesh;
  };

  addBoard(SIDE, outerHeight, CASE_DEPTH, -outerWidth / 2 + SIDE / 2, 0, 0, wood.vertical); // left side
  addBoard(SIDE, outerHeight, CASE_DEPTH, outerWidth / 2 - SIDE / 2, 0, 0, wood.vertical); // right side
  addBoard(outerWidth, TOP, CASE_DEPTH + 0.04, 0, outerHeight / 2 - TOP / 2, 0.02, wood.horizontal); // top, slightly overhanging
  addBoard(innerWidth + 0.02, outerHeight - 0.02, 0.05, 0, 0, -CASE_DEPTH / 2 + 0.03, wood.back); // back panel

  // Shelf planks, top to bottom; each shelf's books stand on the plank below them.
  const shelfFloors = BOOKCASE_SHELVES.map((_, index) => {
    const floorTop = outerHeight / 2 - TOP - (index + 1) * COMPARTMENT_HEIGHT - index * PLANK;
    addBoard(innerWidth + 0.02, PLANK, CASE_DEPTH - 0.04, 0, floorTop - PLANK / 2, 0, wood.horizontal);
    return floorTop;
  });

  // Soft shadow on the back of each compartment, deepest under the shelf above, for depth.
  const compartmentShadow = new THREE.MeshBasicMaterial({ map: compartmentShadowTexture(), transparent: true, depthWrite: false });
  shelfFloors.forEach((floor) => {
    const shade = new THREE.Mesh(new THREE.PlaneGeometry(innerWidth, COMPARTMENT_HEIGHT), compartmentShadow);
    shade.position.set(0, floor + COMPARTMENT_HEIGHT / 2, -CASE_DEPTH / 2 + 0.056);
    world.add(shade);
  });

  // Riveted brass labels on the front of each shelf, e.g. "Reading · 3".
  const shelfLabels = BOOKCASE_SHELVES.map((_, index) => {
    const plate = createBrassPlate(1.6, 0.24, options.fontFamily);
    plate.group.position.set(0, shelfFloors[index] - PLANK / 2, caseFront + 0.0);
    world.add(plate.group);
    return plate;
  });

  // Glow shown on a shelf while a book is dragged over it.
  const shelfGlows = BOOKCASE_SHELVES.map((_, index) => {
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(innerWidth, COMPARTMENT_HEIGHT),
      new THREE.MeshBasicMaterial({ color: "#fff1cf", transparent: true, opacity: 0, depthWrite: false }),
    );
    glow.position.set(0, shelfFloors[index] + COMPARTMENT_HEIGHT / 2, caseFront + 0.01);
    world.add(glow);
    return glow;
  });

  // ---- The DNF bin: an open wastebasket beside the case -------------------------

  const binX = outerWidth / 2 + BIN_GAP + BIN_RADIUS_TOP;
  const binZ = 0.1;
  // Black textured metal with a rolled rim, darker inside.
  const binMaterials = createBinMaterials();
  const binMaterial = binMaterials.outside;
  const bin = new THREE.Group();
  bin.position.set(binX, bottomY, binZ);
  world.add(bin);

  const wallGeometry = new THREE.CylinderGeometry(BIN_RADIUS_TOP, BIN_RADIUS_BOTTOM, BIN_HEIGHT, 64, 1, true);
  const binWall = new THREE.Mesh(wallGeometry, binMaterial);
  binWall.position.y = BIN_HEIGHT / 2;
  binWall.castShadow = true;
  binWall.receiveShadow = true;
  const binInside = new THREE.Mesh(wallGeometry, binMaterials.inside);
  binInside.position.y = BIN_HEIGHT / 2;
  binInside.scale.setScalar(0.985);
  binInside.receiveShadow = true;
  const binFloor = new THREE.Mesh(
    new THREE.CircleGeometry(BIN_RADIUS_BOTTOM, 48),
    new THREE.MeshStandardMaterial({ color: "#151311", roughness: 0.85 }),
  );
  binFloor.rotation.x = -Math.PI / 2;
  binFloor.position.y = 0.015;
  const binRim = new THREE.Mesh(new THREE.TorusGeometry(BIN_RADIUS_TOP, 0.035, 16, 64), binMaterial);
  binRim.rotation.x = Math.PI / 2;
  binRim.position.y = BIN_HEIGHT;
  binRim.castShadow = true;
  bin.add(binWall, binInside, binFloor, binRim);

  // A riveted brass plate on the front, leaning back with the bin's taper.
  const binLabel = createBrassPlate(0.66, 0.2, options.fontFamily);
  const labelHeight = BIN_HEIGHT * 0.52;
  const radiusAtLabel = BIN_RADIUS_BOTTOM + (BIN_RADIUS_TOP - BIN_RADIUS_BOTTOM) * (labelHeight / BIN_HEIGHT);
  binLabel.group.position.set(0, labelHeight, radiusAtLabel + 0.006);
  binLabel.group.rotation.x = -Math.atan((BIN_RADIUS_TOP - BIN_RADIUS_BOTTOM) / BIN_HEIGHT);
  bin.add(binLabel.group);

  // ---- Lights, shadow catcher, camera, controls -------------------------------

  scene.add(new THREE.HemisphereLight("#fff4e6", "#5c4332", 0.75));
  // A soft light from the viewer's side, so the inside of the case isn't too dark.
  const fill = new THREE.DirectionalLight("#fff1dc", 0.7);
  fill.position.set(0, 1, 10);
  scene.add(fill);
  // Warm key light from the upper left, casting soft shadows.
  const sun = new THREE.DirectionalLight("#fff3e2", 2.6);
  sun.position.set(-4, 6, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  const compositionWidth = outerWidth + BIN_GAP + BIN_RADIUS_TOP * 2;
  const shadowExtent = Math.max(compositionWidth, outerHeight);
  Object.assign(sun.shadow.camera, { left: -shadowExtent, right: shadowExtent, top: shadowExtent, bottom: -shadowExtent });
  scene.add(sun);

  // Centre the case and bin together.
  world.position.x = -(BIN_GAP + BIN_RADIUS_TOP * 2) / 2;

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(compositionWidth * 3, 6), new THREE.ShadowMaterial({ opacity: 0.18 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = bottomY;
  ground.receiveShadow = true;
  scene.add(ground);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
  const controls = new OrbitControls(camera, canvas);
  controls.enableZoom = false; // never hijack page scrolling
  controls.enablePan = false;
  controls.enableRotate = !coarsePointer;
  controls.enableDamping = true;
  controls.minAzimuthAngle = -0.55;
  controls.maxAzimuthAngle = 0.55;
  controls.minPolarAngle = Math.PI / 2 - 0.35;
  controls.maxPolarAngle = Math.PI / 2 + 0.1;

  /** Places the camera so the case and bin fit the current canvas size. */
  function fitCamera() {
    const { clientWidth: width, clientHeight: height } = container;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    camera.aspect = width / height;
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const fitHeight = outerHeight / 2 / Math.tan(halfFov);
    const fitWidth = compositionWidth / 2 / (Math.tan(halfFov) * camera.aspect);
    // A small margin around the case, plus room for a book pulled out towards the viewer.
    const distance = Math.max(fitHeight, fitWidth) * 1.06 + caseFront + 0.35;
    camera.position.set(0, 0.35, distance);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.update();
  }

  // ---- Books -------------------------------------------------------------------

  const textureLoader = new THREE.TextureLoader();
  const pageEdges = pageEdgesTexture();
  const states = new Map<number, BookState>();
  let books = initialBooks;
  let elapsed = 0;
  let firstLayout = true;

  function createState(book: BookcaseBook): BookState {
    const height = 1.0 + random(book.id, 2) * 0.32;
    const cloth = BOOK_COLOURS[Math.floor(random(book.id, 3) * BOOK_COLOURS.length)];

    const pageMaterial = new THREE.MeshStandardMaterial({ map: pageEdges, roughness: 0.9 });
    const coverMaterial = new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.7 });
    if (book.coverSrc) {
      textureLoader.load(book.coverSrc, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        coverMaterial.map = texture;
        coverMaterial.color.set("#ffffff");
        coverMaterial.needsUpdate = true;
      });
    } else {
      coverMaterial.map = plainCoverTexture(book.title, book.author, cloth, options.fontFamily);
      coverMaterial.color.set("#ffffff");
    }
    // Cloth spine with gold foil: the metalness and roughness maps make only the foil shine.
    const spine = new THREE.MeshStandardMaterial({
      ...spineMaps(book.title, cloth, options.fontFamily, book.rating !== null),
      metalness: 1,
      roughness: 1,
    });

    // BoxGeometry face order: +x, -x, +y, -y, +z, -z.
    // The spine faces the viewer (+z); the front cover is on +x.
    const materials = [
      coverMaterial,
      new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.8 }),
      pageMaterial,
      pageMaterial,
      spine,
      pageMaterial,
    ];
    // Slightly rounded edges, like a real cloth-bound book.
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(thicknessOf(book), height, BOOK_DEPTH, 2, 0.014), materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    world.add(mesh);

    const hitArea = new THREE.Mesh(new THREE.BoxGeometry(thicknessOf(book), height, BOOK_DEPTH));
    hitArea.visible = false; // never drawn, but still found by the raycaster
    world.add(hitArea);

    return {
      book,
      mesh,
      hitArea,
      spine,
      cloth,
      height,
      home: new THREE.Vector3(),
      homeRotation: new THREE.Euler(),
      position: new THREE.Vector3(),
      pull: 0,
      dropDelay: 0,
    };
  }

  /** Works out where every book rests, creating and removing book meshes as needed. */
  function layout() {
    const seen = new Set<number>();

    BOOKCASE_SHELVES.forEach((shelf, shelfIndex) => {
      const row = books.filter((book) => book.shelf === shelf.id);
      const squeeze = Math.min(1, (innerWidth - SHELF_PADDING * 2) / Math.max(rowWidth(row), 0.001));
      let x = -innerWidth / 2 + SHELF_PADDING;

      row.forEach((book, indexInRow) => {
        const state = place(book, seen, shelfIndex * 0.25 + indexInRow * 0.06);
        const thickness = thicknessOf(book) * squeeze;
        state.mesh.scale.set(squeeze, 1, 1);
        state.home.set(x + thickness / 2, shelfFloors[shelfIndex] + state.height / 2, caseFront - 0.06 - BOOK_DEPTH / 2);
        // A slight, natural-looking lean for some books.
        state.homeRotation.set(0, 0, (random(book.id, 4) - 0.5) * 0.02);
        x += thickness + BOOK_GAP;
      });
    });

    // Books in the bin lean every which way, their tops poking out over the rim.
    // They are shown a little smaller so they fit inside the basket.
    books
      .filter((book) => book.shelf === "dnf")
      .forEach((book, index) => {
        const state = place(book, seen, BOOKCASE_SHELVES.length * 0.25 + index * 0.08);
        const angle = index * 2.39996; // golden angle, so books spread around the bin
        const radius = 0.04 + (index % 3) * 0.08;
        state.mesh.scale.setScalar(BIN_BOOK_SCALE);
        state.home.set(
          binX + Math.cos(angle) * radius,
          bottomY + 0.06 + (state.height * BIN_BOOK_SCALE) / 2,
          binZ + Math.sin(angle) * radius * 0.6,
        );
        state.homeRotation.set((random(book.id, 5) - 0.5) * 0.3, random(book.id, 6) * Math.PI, (random(book.id, 7) - 0.5) * 0.45);
      });

    for (const [id, state] of states) {
      if (!seen.has(id)) {
        world.remove(state.mesh, state.hitArea);
        disposeObject(state.mesh, pageEdges); // the page-edge texture is shared by all books
        state.hitArea.geometry.dispose();
        states.delete(id);
        continue;
      }
      // Keep the hover/click area on the book's resting place.
      state.hitArea.position.copy(state.home);
      state.hitArea.rotation.copy(state.homeRotation);
      state.hitArea.scale.copy(state.mesh.scale);
    }

    BOOKCASE_SHELVES.forEach((shelf, index) => {
      shelfLabels[index].setText(`${shelf.label} · ${books.filter((book) => book.shelf === shelf.id).length}`);
    });
    binLabel.setText(`DNF · ${books.filter((book) => book.shelf === "dnf").length}`);
    firstLayout = false;
  }

  /** Returns the state for a book, creating it (and its drop-in animation) if it is new. */
  function place(book: BookcaseBook, seen: Set<number>, initialDelay: number): BookState {
    let state = states.get(book.id);
    if (!state) {
      state = createState(book);
      state.dropDelay = firstLayout ? initialDelay : elapsed;
      states.set(book.id, state);
    }
    // Rated or un-rated since the last layout: redraw the spine (with or without the star).
    if ((state.book.rating === null) !== (book.rating === null)) {
      const maps = spineMaps(book.title, state.cloth, options.fontFamily, book.rating !== null);
      for (const key of ["map", "metalnessMap", "roughnessMap"] as const) {
        state.spine[key]?.dispose();
        state.spine[key] = maps[key];
      }
      state.spine.needsUpdate = true;
    }
    state.book = book;
    seen.add(book.id);
    return state;
  }

  layout();
  for (const state of states.values()) state.position.copy(state.home);

  // ---- Interaction: hover, click, drag & drop ------------------------------------

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -DRAG_Z);
  /** The front of the case: what the pointer is visually over decides the drop target. */
  const targetPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -caseFront);
  const inverseWorld = new THREE.Matrix4();
  const localRay = new THREE.Ray();
  const dragPoint = new THREE.Vector3();
  const targetPoint = new THREE.Vector3();

  let hovered: BookState | null = null;
  let press: { x: number; y: number; state: BookState | null } | null = null;
  let dragging: BookState | null = null;
  let dropTarget: ShelfId | null = null;

  function setPointerFrom(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  }

  /** The book under the pointer: either the book itself or its resting place. */
  function pick(event: PointerEvent): BookState | null {
    setPointerFrom(event);
    const owners = new Map<THREE.Object3D, BookState>();
    for (const state of states.values()) {
      owners.set(state.mesh, state);
      owners.set(state.hitArea, state);
    }
    const hit = raycaster.intersectObjects([...owners.keys()], false)[0];
    return hit ? (owners.get(hit.object) ?? null) : null;
  }

  /**
   * Follows the pointer during a drag (in the world group's coordinates): where
   * the dragged book floats, in front of the case, and the spot on the front of
   * the case that the pointer is over. The dragged book is closer to the camera,
   * so its own position would point at the wrong shelf.
   */
  function dragPointsFrom(event: PointerEvent): { book: THREE.Vector3; target: THREE.Vector3 } | null {
    setPointerFrom(event);
    inverseWorld.copy(world.matrixWorld).invert();
    localRay.copy(raycaster.ray).applyMatrix4(inverseWorld);
    const book = localRay.intersectPlane(dragPlane, dragPoint);
    const target = localRay.intersectPlane(targetPlane, targetPoint);
    return book && target ? { book, target } : null;
  }

  /** Which shelf (or the bin) a point on the drag plane is over. */
  function targetAt(point: THREE.Vector3): ShelfId | null {
    if (Math.abs(point.x - binX) < BIN_RADIUS_TOP + 0.35 && point.y < bottomY + BIN_HEIGHT + 0.9) return "dnf";
    if (Math.abs(point.x) > outerWidth / 2 + 0.2) return null;
    const index = shelfFloors.findIndex((floor) => point.y >= floor - PLANK && point.y <= floor + COMPARTMENT_HEIGHT);
    return index === -1 ? null : BOOKCASE_SHELVES[index].id;
  }

  function setHovered(state: BookState | null, event: PointerEvent) {
    hovered = state;
    canvas.style.cursor = state ? "grab" : "";
    callbacks.onHover(state?.book ?? null, event.clientX, event.clientY);
  }

  function onPointerDown(event: PointerEvent) {
    // The hovered book may have moved under the pointer (it lifts or slides out
    // when hovered); pressing still grabs the book the tooltip is showing.
    const state = pick(event) ?? (event.pointerType === "mouse" ? hovered : null);
    press = { x: event.clientX, y: event.clientY, state };
    // Pressing a book starts a possible drag, so the camera must not rotate.
    if (state) {
      controls.enabled = false;
      canvas.setPointerCapture(event.pointerId);
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (press?.state && !dragging && Math.hypot(event.clientX - press.x, event.clientY - press.y) > DRAG_THRESHOLD) {
      dragging = press.state;
      dragging.pull = 0;
      hovered = null;
      callbacks.onHover(null, event.clientX, event.clientY);
      canvas.style.cursor = "grabbing";
    }
    if (dragging) {
      const points = dragPointsFrom(event);
      if (points) {
        dragging.mesh.position.copy(points.book);
        dropTarget = targetAt(points.target);
      }
      return;
    }
    if (event.pointerType !== "touch") setHovered(pick(event), event);
  }

  function onPointerUp(event: PointerEvent) {
    controls.enabled = true;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);

    if (dragging) {
      finishDrag();
      press = null;
      return;
    }

    // A short press without movement is a click (or a tap).
    const pressed = press;
    press = null;
    if (!pressed || Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > DRAG_THRESHOLD) return;
    const state = pick(event);
    if (!state) {
      setHovered(null, event);
    } else if (event.pointerType === "touch" && hovered !== state) {
      setHovered(state, event); // first tap pulls the book out, second tap opens it
    } else {
      callbacks.onOpen(state.book);
    }
  }

  function onPointerCancel() {
    controls.enabled = true;
    press = null;
    if (dragging) {
      dropTarget = null;
      finishDrag();
    }
  }

  function onPointerLeave(event: PointerEvent) {
    if (event.pointerType !== "touch" && !dragging) setHovered(null, event);
  }

  /** Drops the dragged book: on a new shelf (or the bin) it moves, otherwise it flies back. */
  function finishDrag() {
    const state = dragging!;
    dragging = null;
    canvas.style.cursor = "";
    // Glide from where it was let go.
    state.position.copy(state.mesh.position);

    const target = dropTarget;
    dropTarget = null;
    if (!target || target === state.book.shelf) return;

    const from = state.book.shelf;
    const moved = { ...state.book, shelf: target };
    // Newest first, like the server's ordering, so the book lands at the left of its shelf.
    books = [moved, ...books.filter((book) => book.id !== moved.id)];
    layout();
    callbacks.onMove(moved, from);
  }

  canvas.addEventListener("pointerdown", onPointerDown, { capture: true }); // before OrbitControls sees it
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("pointerleave", onPointerLeave);

  // ---- Animation loop ------------------------------------------------------------

  let last = 0;

  function animate(time: number) {
    const delta = last ? Math.min((time - last) / 1000, 0.1) : 0;
    last = time;
    elapsed += delta;
    const ease = (speed: number) => (options.reducedMotion ? 1 : 1 - Math.exp(-delta * speed));

    for (const state of states.values()) {
      const { mesh } = state;
      const inBin = state.book.shelf === "dnf";

      if (state === dragging) {
        // Follows the pointer (position set in onPointerMove), held upright and tilted a little.
        mesh.rotation.set(0.12, 0, -0.12);
        mesh.visible = true;
        continue;
      }

      // Glide towards its resting place (after a drop or a re-arrangement).
      state.position.lerp(state.home, ease(7));

      // Drop-in: each book falls into place with a small bounce.
      const dropProgress = options.reducedMotion ? 1 : THREE.MathUtils.clamp((elapsed - state.dropDelay) / 0.7, 0, 1);
      const dropOffset = (1 - easeOutBack(dropProgress)) * 2.2;
      mesh.visible = dropProgress > 0;

      const target = state === hovered && !dragging ? 1 : 0;
      state.pull += (target - state.pull) * ease(PULL_SPEED);

      if (inBin) {
        // Books in the bin lift up and straighten when hovered.
        const lift = easeOutCubic(state.pull);
        mesh.position.set(state.position.x, state.position.y + dropOffset + lift * 0.45, state.position.z + lift * 0.3);
        mesh.rotation.set(
          state.homeRotation.x * (1 - lift),
          state.homeRotation.y * (1 - lift),
          state.homeRotation.z * (1 - lift),
        );
      } else {
        // On a shelf: slide out first, then turn to show the cover.
        const slide = easeOutCubic(Math.min(state.pull / 0.55, 1));
        const turn = easeInOutCubic(THREE.MathUtils.clamp((state.pull - 0.35) / 0.65, 0, 1));
        mesh.position.set(state.position.x, state.position.y + dropOffset + slide * 0.06, state.position.z + slide * PULL_DISTANCE);
        mesh.rotation.set(state.homeRotation.x, -turn * (Math.PI / 2) * 0.92, state.homeRotation.z);
      }
    }

    // Drop-target feedback: shelves glow, the bin glows and grows a little.
    BOOKCASE_SHELVES.forEach((shelf, index) => {
      const material = shelfGlows[index].material as THREE.MeshBasicMaterial;
      material.opacity += ((dropTarget === shelf.id ? 0.22 : 0) - material.opacity) * ease(12);
    });
    const binActive = dropTarget === "dnf" ? 1 : dragging ? 0.25 : 0;
    binMaterial.emissiveIntensity += (binActive * 0.55 - binMaterial.emissiveIntensity) * ease(10);
    bin.scale.setScalar(bin.scale.x + ((dropTarget === "dnf" ? 1.08 : 1) - bin.scale.x) * ease(12));

    // A gentle sway so the case feels alive (paused while dragging and for reduced motion).
    const sway = options.reducedMotion || dragging ? 0 : Math.sin(elapsed * 0.35) * 0.035;
    world.rotation.y += (sway - world.rotation.y) * ease(4);

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
    setBooks(next) {
      books = next;
      layout();
    },
    dispose() {
      renderer.setAnimationLoop(null);
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown, { capture: true });
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      controls.dispose();
      disposeObject(scene);
      environment.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}

// ---- Helpers -----------------------------------------------------------------------

/** A book's thickness; fixed per book so it always looks the same. */
function thicknessOf(book: BookcaseBook): number {
  return 0.17 + random(book.id, 1) * 0.15;
}

/** Deterministic pseudo-random number in [0, 1) for a book, so its look never changes. */
function random(id: number, salt: number): number {
  const value = Math.sin(id * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
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

/** Frees the GPU memory used by an object's meshes, materials and textures (except `keep`). */
function disposeObject(root: THREE.Object3D, keep?: THREE.Texture) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture && value !== keep) value.dispose();
      }
      material.dispose();
    }
  });
}
