// Simple heuristic AI: win > block > random for placement; win > safe > random for the cube move.
import { FACES, checkWinsAndDraw } from './state.js';
import { ALL_MOVES, inverseMove } from './moves.js';

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

export function chooseCell(state, aiMark, opponentMark) {
  const cells = emptyCells(state);
  const winCell = cells.find((cell) => wouldWin(state, cell, aiMark));
  if (winCell) return winCell;
  const blockCell = cells.find((cell) => wouldWin(state, cell, opponentMark));
  if (blockCell) return blockCell;
  return pickRandom(cells);
}

// Simulates each candidate move on the live scene (instant, no animation),
// inspects the resulting logical state, then reverts — the cube never
// actually moves during evaluation.
export function chooseMove(sceneRefs, aiMark, opponentMark) {
  const evaluations = ALL_MOVES.map((moveStr) => {
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
