// Heuristic AI with three difficulty tiers:
//   easy   - random placement, random move.
//   medium - win > block > random placement; win > safe > random move,
//            but with a chance of skipping straight to random so it's
//            beatable — a perfect blocker is really a "hard" AI.
//   hard   - the medium logic with no mistakes, plus placement also
//            avoids cells whose forced rotation would hand the
//            opponent an immediate win.
import { FACES, checkWinsAndDraw } from './state.js';
import { inverseMove, movesIncludingCubie } from './moves.js';
import { setStickerMark, getCubiePosition } from './scene.js';

const MEDIUM_MISTAKE_CHANCE = 0.35;

function cloneState(state) {
  const clone = {};
  for (const f of FACES) clone[f] = state[f].map((row) => row.slice());
  return clone;
}

function emptyCells(state) {
  const cells = [];
  for (const f of FACES) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (state[f][r][c] === null) cells.push({ face: f, row: r, col: c });
      }
    }
  }
  return cells;
}

function wouldWin(state, cell, mark) {
  const clone = cloneState(state);
  clone[cell.face][cell.row][cell.col] = mark;
  return checkWinsAndDraw(clone).result === 'win';
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Temporarily places `aiMark` on the cell, checks whether any of the
// resulting forced-rotation choices would let the opponent win, then
// restores the board — the live scene is left exactly as it was.
function cellExposesOpponentWin(sceneRefs, cell, aiMark, opponentMark) {
  const mesh = sceneRefs.meshLookup[cell.face][cell.row][cell.col];
  setStickerMark(mesh, aiMark, false);

  const pos = getCubiePosition(mesh);
  const legalMoves = movesIncludingCubie(pos.x, pos.y, pos.z);
  const exposed = legalMoves.some((moveStr) => {
    sceneRefs.animateMove(moveStr, () => {}, { instant: true });
    const outcome = checkWinsAndDraw(sceneRefs.readLogicalState());
    sceneRefs.animateMove(inverseMove(moveStr), () => {}, { instant: true });
    return outcome.result === 'win' && outcome.winner === opponentMark;
  });

  setStickerMark(mesh, null, false);
  return exposed;
}

export function chooseCell(state, aiMark, opponentMark, sceneRefs, difficulty) {
  const cells = emptyCells(state);

  if (difficulty === 'easy') {
    return pickRandom(cells);
  }

  if (difficulty === 'medium' && Math.random() < MEDIUM_MISTAKE_CHANCE) {
    return pickRandom(cells);
  }

  const winCell = cells.find((cell) => wouldWin(state, cell, aiMark));
  if (winCell) return winCell;
  const blockCell = cells.find((cell) => wouldWin(state, cell, opponentMark));
  if (blockCell) return blockCell;

  if (difficulty === 'hard') {
    const safeCells = cells.filter((cell) => !cellExposesOpponentWin(sceneRefs, cell, aiMark, opponentMark));
    if (safeCells.length) return pickRandom(safeCells);
  }

  return pickRandom(cells);
}

// Simulates each candidate move on the live scene (instant, no animation),
// inspects the resulting logical state, then reverts — the cube never
// actually moves during evaluation. `legalMoves` restricts the candidates
// to the moves allowed under the current turn's constraint.
export function chooseMove(sceneRefs, aiMark, opponentMark, legalMoves, difficulty) {
  if (difficulty === 'easy') {
    return pickRandom(Array.from(legalMoves));
  }

  if (difficulty === 'medium' && Math.random() < MEDIUM_MISTAKE_CHANCE) {
    return pickRandom(Array.from(legalMoves));
  }

  const evaluations = Array.from(legalMoves).map((moveStr) => {
    sceneRefs.animateMove(moveStr, () => {}, { instant: true });
    const state = sceneRefs.readLogicalState();
    const outcome = checkWinsAndDraw(state);
    const aiWins = outcome.result === 'win' && outcome.winner === aiMark;
    const opponentCanWinNext = emptyCells(state).some((cell) => wouldWin(state, cell, opponentMark));
    sceneRefs.animateMove(inverseMove(moveStr), () => {}, { instant: true });
    return { moveStr, aiWins, opponentCanWinNext };
  });

  const winning = evaluations.filter((e) => e.aiWins);
  if (winning.length) return pickRandom(winning).moveStr;

  const safe = evaluations.filter((e) => !e.opponentCanWinNext);
  if (safe.length) return pickRandom(safe).moveStr;

  return pickRandom(evaluations).moveStr;
}
