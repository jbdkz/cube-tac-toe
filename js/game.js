import { checkWinsAndDraw } from './state.js';
import { setStickerMark, getCubiePosition } from './scene.js';
import { movesIncludingCubie } from './moves.js';
import { chooseCell, chooseMove } from './ai.js';

const AI_PLAYER = 'O';
const AI_THINK_DELAY_MS = 600;
const AI_MOVE_DELAY_MS = 700;
const NO_MOVES = new Set();

function other(player) {
  return player === 'X' ? 'O' : 'X';
}

export function createGame(sceneRefs, ui) {
  let turnPhase = 'PLACE'; // PLACE | MUST_MOVE | ANIMATING | GAME_OVER
  let activePlayer = 'X'; // the player whose mark was (or is about to be) placed this round
  let legalMoves = NO_MOVES; // moves the rotator may choose from, once a mark is placed
  let aiEnabled = false;
  let aiTimeoutId = null;

  // During PLACE, activePlayer places. During MUST_MOVE, the *other* player
  // rotates — that's the rule: your opponent's mark dictates your move.
  function currentActor() {
    return turnPhase === 'MUST_MOVE' ? other(activePlayer) : activePlayer;
  }

  function isAiActing() {
    return aiEnabled && currentActor() === AI_PLAYER;
  }

  function clearPendingAiTurn() {
    if (aiTimeoutId !== null) {
      clearTimeout(aiTimeoutId);
      aiTimeoutId = null;
    }
  }

  function updateUI() {
    ui.setActivePlayer(currentActor());
    switch (turnPhase) {
      case 'PLACE':
        ui.setPhaseText(isAiActing() ? 'AI is thinking…' : 'Place your mark on any empty sticker');
        break;
      case 'MUST_MOVE':
        ui.setPhaseText(
          isAiActing() ? 'AI is choosing a move…' : 'Rotate a face that includes the marked cube'
        );
        break;
      case 'ANIMATING':
        ui.setPhaseText('Turning the cube…');
        break;
      case 'GAME_OVER':
        ui.setPhaseText('Game over — restart to play again');
        break;
    }
    ui.setMoveButtonsEnabled(turnPhase === 'MUST_MOVE' && !isAiActing() ? legalMoves : NO_MOVES);
  }

  function applyPlacement(stickerMesh) {
    if (turnPhase !== 'PLACE') return;
    if (stickerMesh.userData.mark !== null) return;

    setStickerMark(stickerMesh, activePlayer, false);
    const pos = getCubiePosition(stickerMesh);
    legalMoves = new Set(movesIncludingCubie(pos.x, pos.y, pos.z));
    turnPhase = 'MUST_MOVE';
    updateUI();
    maybeTriggerAiTurn();
  }

  function applyMove(moveStr) {
    if (turnPhase !== 'MUST_MOVE') return;
    if (!legalMoves.has(moveStr)) return;
    if (sceneRefs.isAnimating()) return;

    turnPhase = 'ANIMATING';
    updateUI();

    sceneRefs.animateMove(moveStr, () => {
      resolveAfterMove();
    });
  }

  function placeMark(stickerMesh) {
    if (isAiActing()) return;
    applyPlacement(stickerMesh);
  }

  function performMove(moveStr) {
    if (isAiActing()) return;
    applyMove(moveStr);
  }

  function maybeTriggerAiTurn() {
    if (!isAiActing()) return;

    if (turnPhase === 'PLACE') {
      aiTimeoutId = setTimeout(() => {
        aiTimeoutId = null;
        if (!isAiActing() || turnPhase !== 'PLACE') return;
        const state = sceneRefs.readLogicalState();
        const cell = chooseCell(state, AI_PLAYER, other(AI_PLAYER));
        const mesh = sceneRefs.meshLookup[cell.face][cell.row][cell.col];
        applyPlacement(mesh);
      }, AI_THINK_DELAY_MS);
    } else if (turnPhase === 'MUST_MOVE') {
      aiTimeoutId = setTimeout(() => {
        aiTimeoutId = null;
        if (!isAiActing() || turnPhase !== 'MUST_MOVE') return;
        const moveStr = chooseMove(sceneRefs, AI_PLAYER, other(AI_PLAYER), legalMoves);
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

    activePlayer = other(activePlayer);
    turnPhase = 'PLACE';
    legalMoves = NO_MOVES;
    updateUI();
    maybeTriggerAiTurn();
  }

  function restart() {
    clearPendingAiTurn();
    sceneRefs.resetCube();
    activePlayer = 'X';
    turnPhase = 'PLACE';
    legalMoves = NO_MOVES;
    ui.hideBanner();
    updateUI();
  }

  updateUI();

  return { placeMark, performMove, restart, setAiEnabled, getPhase: () => turnPhase };
}
