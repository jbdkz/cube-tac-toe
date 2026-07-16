import { createCubeTacToeScene } from './scene.js';
import { setupInteraction } from './interaction.js';
import { initUI } from './ui.js';
import { createGame } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');
  const sceneRefs = createCubeTacToeScene(container);

  const ui = initUI({
    onMoveButton: (move) => game.performMove(move),
    onRestart: () => game.restart(),
    onMoveHover: (move) => sceneRefs.previewMove(move),
    onMoveHoverEnd: () => sceneRefs.clearMovePreview(),
    onAiToggle: (enabled) => game.setAiEnabled(enabled),
    onAiDifficultyChange: (difficulty) => game.setAiDifficulty(difficulty),
  });

  const game = createGame(sceneRefs, ui);

  setupInteraction(sceneRefs, {
    onStickerClick: (mesh) => game.placeMark(mesh),
  });

  window.addEventListener('resize', () => sceneRefs.handleResize());

  function loop() {
    sceneRefs.render();
    requestAnimationFrame(loop);
  }
  loop();

  // Dev/debug hook — inspect state or trigger self-tests from the console.
  window.__cubeTacToe = { sceneRefs, game };
});
