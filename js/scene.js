import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FACES, createEmptyState } from './state.js';
import { parseMove } from './moves.js';

const CUBIE_SIZE = 0.95;
const STICKER_SIZE = 0.8;
const STICKER_OFFSET = CUBIE_SIZE / 2 + 0.001;
const MOVE_DURATION_MS = 250;
const LAYER_PREVIEW_COLOR = 0xffcc33;
const AXIS_VECTORS = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const OTHER_AXES = { x: ['y', 'z'], y: ['x', 'z'], z: ['x', 'y'] };

const LOCAL_DIRS = {
  px: new THREE.Vector3(1, 0, 0),
  nx: new THREE.Vector3(-1, 0, 0),
  py: new THREE.Vector3(0, 1, 0),
  ny: new THREE.Vector3(0, -1, 0),
  pz: new THREE.Vector3(0, 0, 1),
  nz: new THREE.Vector3(0, 0, -1),
};

function faceFromWorldNormal(nx, ny, nz) {
  if (ny === 1) return 'U';
  if (ny === -1) return 'D';
  if (nx === -1) return 'L';
  if (nx === 1) return 'R';
  if (nz === 1) return 'F';
  if (nz === -1) return 'B';
  return null;
}

// Pure, fixed convention mapping a cubie's grid coords (each in {-1,0,1}) to a
// row/col on that face's 3x3 grid. Used both at init and after every move, so
// it is the single consistent source of truth for logical sticker position.
function computeRowCol(face, x, y, z) {
  switch (face) {
    case 'U': return { row: 1 - z, col: x + 1 };
    case 'D': return { row: z + 1, col: x + 1 };
    case 'L': return { row: 1 - y, col: 1 - z };
    case 'R': return { row: 1 - y, col: z + 1 };
    case 'F': return { row: 1 - y, col: x + 1 };
    case 'B': return { row: 1 - y, col: 1 - x };
    default: throw new Error(`unknown face ${face}`);
  }
}

function drawStickerCanvas(ctx, size, mark, highlight) {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#f5f5f0';
  ctx.fillRect(0, 0, size, size);

  if (highlight) {
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = size * 0.06;
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, size - ctx.lineWidth, size - ctx.lineWidth);
  }

  const pad = size * 0.22;
  ctx.lineCap = 'round';
  ctx.lineWidth = size * 0.14;

  if (mark === 'X') {
    ctx.strokeStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(size - pad, size - pad);
    ctx.moveTo(size - pad, pad);
    ctx.lineTo(pad, size - pad);
    ctx.stroke();
  } else if (mark === 'O') {
    ctx.strokeStyle = '#2c5aa0';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - pad, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function createStickerMaterial() {
  const canvasSize = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d');
  drawStickerCanvas(ctx, canvasSize, null, false);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture });
  return { material, texture, canvas, ctx, canvasSize };
}

export function setStickerMark(mesh, mark, highlight = false) {
  const { ctx, canvasSize, texture } = mesh.userData;
  drawStickerCanvas(ctx, canvasSize, mark, highlight);
  texture.needsUpdate = true;
  mesh.userData.mark = mark;
  mesh.userData.highlight = highlight;
}

function snapObjectRotation(object3D) {
  const m = new THREE.Matrix4().makeRotationFromQuaternion(object3D.quaternion);
  const e = m.elements;
  const round = (v) => Math.round(v);
  const snapped = new THREE.Matrix4();
  // Matrix4.elements is column-major; snap the 3x3 rotation part to {-1,0,1}.
  snapped.set(
    round(e[0]), round(e[4]), round(e[8]), 0,
    round(e[1]), round(e[5]), round(e[9]), 0,
    round(e[2]), round(e[6]), round(e[10]), 0,
    0, 0, 0, 1
  );
  object3D.quaternion.setFromRotationMatrix(snapped);
}

export function createCubeTacToeScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );
  camera.position.set(5, 4.5, 6);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.minDistance = 4;
  controls.maxDistance = 14;

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(4, 8, 6);
  scene.add(dirLight);
  const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
  dirLight2.position.set(-4, -6, -4);
  scene.add(dirLight2);

  const cubeGroup = new THREE.Group();
  scene.add(cubeGroup);

  const cubieGeometry = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE);
  const cubieMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
  const stickerGeometry = new THREE.PlaneGeometry(STICKER_SIZE, STICKER_SIZE);
  const glowGeometry = new THREE.BoxGeometry(CUBIE_SIZE * 1.12, CUBIE_SIZE * 1.12, CUBIE_SIZE * 1.12);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: LAYER_PREVIEW_COLOR,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });

  const allCubies = [];
  const stickerMeshes = [];

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const cubie = new THREE.Mesh(cubieGeometry, cubieMaterial);
        cubie.position.set(x, y, z);
        cubeGroup.add(cubie);
        allCubies.push(cubie);

        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.visible = false;
        glow.renderOrder = 1;
        cubie.add(glow);
        cubie.userData.glow = glow;

        const exteriorDirs = [];
        if (x === 1) exteriorDirs.push('px');
        if (x === -1) exteriorDirs.push('nx');
        if (y === 1) exteriorDirs.push('py');
        if (y === -1) exteriorDirs.push('ny');
        if (z === 1) exteriorDirs.push('pz');
        if (z === -1) exteriorDirs.push('nz');

        for (const dirKey of exteriorDirs) {
          const { material, texture, canvas, ctx, canvasSize } = createStickerMaterial();
          const sticker = new THREE.Mesh(stickerGeometry, material);
          const dir = LOCAL_DIRS[dirKey];
          sticker.position.copy(dir).multiplyScalar(STICKER_OFFSET);
          sticker.lookAt(dir.clone().multiplyScalar(2));
          sticker.userData = {
            localDir: dirKey,
            mark: null,
            highlight: false,
            texture,
            canvas,
            ctx,
            canvasSize,
          };
          cubie.add(sticker);
          stickerMeshes.push(sticker);
        }
      }
    }
  }

  const meshLookup = {};
  for (const f of FACES) {
    meshLookup[f] = [[null, null, null], [null, null, null], [null, null, null]];
  }

  function recomputeMeshLookup() {
    const worldNormal = new THREE.Vector3();
    for (const sticker of stickerMeshes) {
      const cubie = sticker.parent;
      const localDir = LOCAL_DIRS[sticker.userData.localDir];
      worldNormal.copy(localDir).applyQuaternion(cubie.quaternion).round();

      const face = faceFromWorldNormal(worldNormal.x, worldNormal.y, worldNormal.z);
      const x = Math.round(cubie.position.x);
      const y = Math.round(cubie.position.y);
      const z = Math.round(cubie.position.z);
      const { row, col } = computeRowCol(face, x, y, z);

      sticker.userData.face = face;
      sticker.userData.row = row;
      sticker.userData.col = col;
      meshLookup[face][row][col] = sticker;
    }
  }

  recomputeMeshLookup();

  function readLogicalState() {
    const state = createEmptyState();
    for (const f of FACES) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          state[f][r][c] = meshLookup[f][r][c].userData.mark;
        }
      }
    }
    return state;
  }

  function clearAllHighlights() {
    for (const sticker of stickerMeshes) {
      if (sticker.userData.highlight) {
        setStickerMark(sticker, sticker.userData.mark, false);
      }
    }
  }

  function resetCube() {
    clearMovePreview();
    for (const sticker of stickerMeshes) {
      setStickerMark(sticker, null, false);
    }
    let i = 0;
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const cubie = allCubies[i++];
          if (cubie.parent !== cubeGroup) cubeGroup.attach(cubie);
          cubie.position.set(x, y, z);
          cubie.quaternion.identity();
        }
      }
    }
    recomputeMeshLookup();
  }

  let previewState = null;
  let previewArrowGroup = null;

  function setLayerGlow(axis, layerCoord, visible) {
    for (const cubie of allCubies) {
      if (Math.round(cubie.position[axis]) === layerCoord) {
        cubie.userData.glow.visible = visible;
      }
    }
  }

  function buildDirectionArrows(axis, layerCoord, angle) {
    const group = new THREE.Group();
    const axisVec = AXIS_VECTORS[axis];
    const [axisAName, axisBName] = OTHER_AXES[axis];
    const axisAVec = AXIS_VECTORS[axisAName];
    const axisBVec = AXIS_VECTORS[axisBName];
    const radius = 2.05;
    const sign = Math.sign(angle) || 1;
    const arrowLength = 0.7;

    for (const theta of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      const radial = axisAVec.clone().multiplyScalar(Math.cos(theta)).add(axisBVec.clone().multiplyScalar(Math.sin(theta)));
      const point = radial.clone().multiplyScalar(radius);
      point[axis] = layerCoord;

      const tangent = axisVec.clone().cross(radial).multiplyScalar(sign).normalize();
      const origin = point.clone().sub(tangent.clone().multiplyScalar(arrowLength / 2));
      const arrow = new THREE.ArrowHelper(tangent, origin, arrowLength, LAYER_PREVIEW_COLOR, arrowLength * 0.4, arrowLength * 0.3);
      group.add(arrow);
    }
    return group;
  }

  function previewMove(moveStr) {
    if (animating) return;
    clearMovePreview();

    const { axis, layerCoord, angle } = parseMove(moveStr);
    setLayerGlow(axis, layerCoord, true);
    previewState = { axis, layerCoord };

    previewArrowGroup = buildDirectionArrows(axis, layerCoord, angle);
    scene.add(previewArrowGroup);
  }

  function clearMovePreview() {
    if (previewState) {
      setLayerGlow(previewState.axis, previewState.layerCoord, false);
      previewState = null;
    }
    if (previewArrowGroup) {
      scene.remove(previewArrowGroup);
      previewArrowGroup.traverse((obj) => {
        if (obj.material) obj.material.dispose();
      });
      previewArrowGroup = null;
    }
  }

  let animating = false;

  function animateMove(moveStr, onComplete, { instant = false } = {}) {
    if (animating) return;
    clearMovePreview();
    animating = true;

    const { axis, layerCoord, angle } = parseMove(moveStr);
    const cubiesInLayer = allCubies.filter(
      (c) => Math.round(c.position[axis]) === layerCoord
    );

    const pivot = new THREE.Group();
    cubeGroup.add(pivot);
    for (const c of cubiesInLayer) pivot.attach(c);

    const finish = () => {
      for (const c of cubiesInLayer) {
        cubeGroup.attach(c);
        c.position.set(
          Math.round(c.position.x),
          Math.round(c.position.y),
          Math.round(c.position.z)
        );
        snapObjectRotation(c);
      }
      cubeGroup.remove(pivot);
      recomputeMeshLookup();
      animating = false;
      onComplete();
    };

    if (instant) {
      pivot.rotation[axis] = angle;
      finish();
      return;
    }

    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / MOVE_DURATION_MS);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      pivot.rotation[axis] = angle * eased;
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        finish();
      }
    }
    requestAnimationFrame(tick);
  }

  function isAnimating() {
    return animating;
  }

  function render() {
    controls.update();
    renderer.render(scene, camera);
  }

  function handleResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  return {
    scene,
    camera,
    renderer,
    controls,
    cubeGroup,
    allCubies,
    stickerMeshes,
    meshLookup,
    recomputeMeshLookup,
    readLogicalState,
    clearAllHighlights,
    resetCube,
    animateMove,
    previewMove,
    clearMovePreview,
    isAnimating,
    render,
    handleResize,
  };
}
