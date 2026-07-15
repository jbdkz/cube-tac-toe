import * as THREE from 'three';

const CLICK_DISTANCE_PX = 5;
const CLICK_MAX_MS = 300;

export function setupInteraction(sceneRefs, { onStickerClick }) {
  const dom = sceneRefs.renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();

  let downInfo = null;

  dom.addEventListener('pointerdown', (e) => {
    downInfo = { x: e.clientX, y: e.clientY, t: performance.now() };
  });

  dom.addEventListener('pointerup', (e) => {
    if (!downInfo) return;
    const dx = e.clientX - downInfo.x;
    const dy = e.clientY - downInfo.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dt = performance.now() - downInfo.t;
    downInfo = null;

    if (dist > CLICK_DISTANCE_PX || dt > CLICK_MAX_MS) return;

    const rect = dom.getBoundingClientRect();
    pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointerNDC, sceneRefs.camera);
    const intersects = raycaster.intersectObjects(sceneRefs.stickerMeshes, false);
    if (intersects.length > 0) {
      onStickerClick(intersects[0].object);
    }
  });
}
