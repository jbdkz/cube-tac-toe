// Pure move definitions — no Three.js / DOM dependency.
// The 6 outer faces, each with a fixed rotation axis and the grid layer it turns.
export const FACES = ['U', 'D', 'L', 'R', 'F', 'B'];

export const AXIS_FOR_FACE = { U: 'y', D: 'y', L: 'x', R: 'x', F: 'z', B: 'z' };
export const LAYER_COORD_FOR_FACE = { U: 1, D: -1, L: -1, R: 1, F: 1, B: -1 };

// Sign of the rotation angle (about the face's shared axis) that produces a
// clockwise turn as seen by a viewer looking at that face from outside the cube.
export const CW_SIGN_FOR_FACE = { U: -1, D: 1, L: 1, R: -1, F: -1, B: 1 };

export const ALL_MOVES = FACES.flatMap((f) => [f, f + "'", f + '2']);

export function parseMove(moveStr) {
  const face = moveStr[0];
  const suffix = moveStr.slice(1);
  const axis = AXIS_FOR_FACE[face];
  const layerCoord = LAYER_COORD_FOR_FACE[face];
  const cwSign = CW_SIGN_FOR_FACE[face];
  const quarter = Math.PI / 2;
  let angle;
  if (suffix === '2') angle = cwSign * Math.PI;
  else if (suffix === "'") angle = -cwSign * quarter;
  else angle = cwSign * quarter;
  return { face, axis, layerCoord, angle };
}

export function inverseMove(moveStr) {
  const face = moveStr[0];
  const suffix = moveStr.slice(1);
  if (suffix === "'") return face;
  if (suffix === '2') return face + '2';
  return face + "'";
}
