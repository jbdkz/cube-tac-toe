// Pure logical state + win/draw checking — no Three.js / DOM dependency.
export const FACES = ['U', 'D', 'L', 'R', 'F', 'B'];

export function createEmptyState() {
  const state = {};
  for (const f of FACES) {
    state[f] = [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ];
  }
  return state;
}

export function countEmpty(state) {
  let n = 0;
  for (const f of FACES) {
    for (const row of state[f]) {
      for (const cell of row) {
        if (cell === null) n++;
      }
    }
  }
  return n;
}

function buildLines() {
  const lines = [];
  for (let r = 0; r < 3; r++) lines.push([[r, 0], [r, 1], [r, 2]]);
  for (let c = 0; c < 3; c++) lines.push([[0, c], [1, c], [2, c]]);
  lines.push([[0, 0], [1, 1], [2, 2]]);
  lines.push([[0, 2], [1, 1], [2, 0]]);
  return lines;
}

const LINES = buildLines();

export function checkWinsAndDraw(state) {
  const winLines = [];
  for (const face of FACES) {
    const grid = state[face];
    for (const line of LINES) {
      const [a, b, c] = line.map(([r, cc]) => grid[r][cc]);
      if (a !== null && a === b && b === c) {
        winLines.push({ player: a, face, cells: line });
      }
    }
  }
  const xWins = winLines.filter((l) => l.player === 'X');
  const oWins = winLines.filter((l) => l.player === 'O');

  if (xWins.length > 0 && oWins.length > 0) {
    return { result: 'draw', reason: 'simultaneous', lines: winLines };
  }
  if (xWins.length > 0) return { result: 'win', winner: 'X', lines: xWins };
  if (oWins.length > 0) return { result: 'win', winner: 'O', lines: oWins };
  if (countEmpty(state) === 0) return { result: 'draw', reason: 'boardFull', lines: [] };
  return { result: 'continue', lines: [] };
}
