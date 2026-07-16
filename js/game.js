import { checkWinsAndDraw } from './state.js';
import { setStickerMark } from './scene.js';
import { chooseCell, chooseMove } from './ai.js';

const AI_PLAYER = 'O';
const AI_THINK_DELAY_MS = 600;
const AI_MOVE_DELAY_MS = 700;

export function createGame(sceneRefs, ui) {
  let turnPhase = 'PLACE'; // PLACE | MUST_MOVE | ANIMATING | GAME_OVER
  let activePlayer = 'X';
  let aiEnabled = false;
  let aiTimeoutId = null;

  function isAiTurn() {
    return aiEnabled && activePlayer === AI_PLAYER;
  }

  function clearPendingAiTurn() {
    if (aiTimeoutId !== null) {
      clearTimeout(aiTimeoutId);
      aiTimeoutId = null;
    }
  }

  function updateUI() {
    ui.setActivePlayer(activePlayer);
    switch (turnPhase) {
      case 'PLACE':
        ui.setPhaseText(isAiTurn() ? 'AI is thinking…' : 'Place your mark on any empty sticker');
        break;
      case 'MUST_MOVE':
        ui.setPhaseText(isAiTurn() ? 'AI is choosing a move…' : 'Now make exactly one cube move');
        break;
      case 'ANIMATING':
        ui.setPhaseText('Turning the cube…');
        break;
      case 'GAME_OVER':
        ui.setPhaseText('Game over — restart to play again');
        break;
    }
    ui.setMoveButtonsEnabled(turnPhase === 'MUST_MOVE' && !isAiTurn());
  }

  function applyPlacement(stickerMesh) {
    if (turnPhase !== 'PLACE') return;
    if (stickerMesh.userData.mark !== null) return;

    setStickerMark(stickerMesh, activePlayer, false);
    turnPhase = 'MUST_MOVE';
    updateUI();
    maybeTriggerAiTurn();
  }

  function applyMove(moveStr) {
    if (turnPhase !== 'MUST_MOVE') return;
    if (sceneRefs.isAnimating()) return;

    turnPhase = 'ANIMATING';
    updateUI();

    sceneRefs.animateMove(moveStr, () => {
      resolveAfterMove();
    });
  }

  function placeMark(stickerMesh) {
    if (isAiTurn()) return;
    applyPlacement(stickerMesh);
  }

  function performMove(moveStr) {
    if (isAiTurn()) return;
    applyMove(moveStr);
  }

  function maybeTriggerAiTurn() {
    if (!isAiTurn()) return;

    if (turnPhase === 'PLACE') {
      aiTimeoutId = setTimeout(() => {
        aiTimeoutId = null;
        if (!isAiTurn() || turnPhase !== 'PLACE') return;
        const state = sceneRefs.readLogicalState();
        const cell = chooseCell(state, AI_PLAYER, 'X');
        const mesh = sceneRefs.meshLookup[cell.face][cell.row][cell.col];
        applyPlacement(mesh);
      }, AI_THINK_DELAY_MS);
    } else if (turnPhase === 'MUST_MOVE') {
      aiTimeoutId = setTimeout(() => {
        aiTimeoutId = null;
        if (!isAiTurn() || turnPhase !== 'MUST_MOVE') return;
        const moveStr = chooseMove(sceneRefs, AI_PLAYER, 'X');
        applyMove(moveStr);
      }, AI_MOVE_DELAY_MS);
    }
  }

  function setAiEnabled(enabled) {
    aiEnabled = enabled;
    clearPendingAiTurn();
    updateUI();
    maybeTriggerAiTurn();
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
    maybeTriggerAiTurn();
  }

  function restart() {
    clearPendingAiTurn();
    sceneRefs.resetCube();
    activePlayer = 'X';
    turnPhase = 'PLACE';
    ui.hideBanner();
    updateUI();
  }

  updateUI();

  return { placeMark, performMove, restart, setAiEnabled, getPhase: () => turnPhase };
}
