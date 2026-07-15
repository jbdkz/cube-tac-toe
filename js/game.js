import { checkWinsAndDraw } from './state.js';
import { setStickerMark } from './scene.js';

export function createGame(sceneRefs, ui) {
  let turnPhase = 'PLACE'; // PLACE | MUST_MOVE | ANIMATING | GAME_OVER
  let activePlayer = 'X';

  function updateUI() {
    ui.setActivePlayer(activePlayer);
    switch (turnPhase) {
      case 'PLACE':
        ui.setPhaseText('Place your mark on any empty sticker');
        break;
      case 'MUST_MOVE':
        ui.setPhaseText('Now make exactly one cube move');
        break;
      case 'ANIMATING':
        ui.setPhaseText('Turning the cube…');
        break;
      case 'GAME_OVER':
        ui.setPhaseText('Game over — restart to play again');
        break;
    }
    ui.setMoveButtonsEnabled(turnPhase === 'MUST_MOVE');
  }

  function placeMark(stickerMesh) {
    if (turnPhase !== 'PLACE') return;
    if (stickerMesh.userData.mark !== null) return;

    setStickerMark(stickerMesh, activePlayer, false);
    turnPhase = 'MUST_MOVE';
    updateUI();
  }

  function performMove(moveStr) {
    if (turnPhase !== 'MUST_MOVE') return;
    if (sceneRefs.isAnimating()) return;

    turnPhase = 'ANIMATING';
    updateUI();

    sceneRefs.animateMove(moveStr, () => {
      resolveAfterMove();
    });
  }

  function highlightLines(lines) {
    for (const line of lines) {
      for (const [r, c] of line.cells) {
        const mesh = sceneRefs.meshLookup[line.face][r][c];
        setStickerMark(mesh, mesh.userData.mark, true);
      }
    }
  }

  function resolveAfterMove() {
    const state = sceneRefs.readLogicalState();
    const result = checkWinsAndDraw(state);

    if (result.result === 'win') {
      highlightLines(result.lines);
      turnPhase = 'GAME_OVER';
      ui.showBanner(`Player ${result.winner} wins!`);
      updateUI();
      return;
    }

    if (result.result === 'draw') {
      if (result.lines.length) highlightLines(result.lines);
      turnPhase = 'GAME_OVER';
      ui.showBanner(
        result.reason === 'simultaneous'
          ? 'Draw — both players completed a line at once'
          : 'Draw — the cube is full'
      );
      updateUI();
      return;
    }

    activePlayer = activePlayer === 'X' ? 'O' : 'X';
    turnPhase = 'PLACE';
    updateUI();
  }

  function restart() {
    sceneRefs.resetCube();
    activePlayer = 'X';
    turnPhase = 'PLACE';
    ui.hideBanner();
    updateUI();
  }

  updateUI();

  return { placeMark, performMove, restart, getPhase: () => turnPhase };
}
