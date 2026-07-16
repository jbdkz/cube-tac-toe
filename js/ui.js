export function initUI({ onMoveButton, onRestart, onMoveHover, onMoveHoverEnd, onModeChosen }) {
  const moveButtons = {};
  document.querySelectorAll('#move-panel button[data-move]').forEach((btn) => {
    const move = btn.dataset.move;
    moveButtons[move] = btn;
    btn.addEventListener('click', () => onMoveButton(move));
    btn.addEventListener('mouseenter', () => {
      if (!btn.disabled) onMoveHover(move);
    });
    btn.addEventListener('mouseleave', () => onMoveHoverEnd());
  });

  document.getElementById('restart-button').addEventListener('click', onRestart);
  document.getElementById('banner-restart').addEventListener('click', onRestart);

  const activePlayerEl = document.getElementById('active-player');
  const phaseEl = document.getElementById('phase-indicator');
  const bannerEl = document.getElementById('banner');
  const bannerTextEl = document.getElementById('banner-text');

  // Mode-selection modal — gates play until a mode is picked.
  const modalEl = document.getElementById('mode-modal');
  const modeScreenEl = document.getElementById('mode-screen');
  const difficultyScreenEl = document.getElementById('difficulty-screen');
  const backButtonEl = document.getElementById('mode-back-button');
  const modeCards = Array.from(document.querySelectorAll('.option-card[data-mode]'));
  const difficultyCards = Array.from(document.querySelectorAll('.option-card[data-difficulty]'));

  function highlightSelected(cards, datasetKey, value) {
    for (const card of cards) {
      card.classList.toggle('selected', card.dataset[datasetKey] === value);
    }
  }

  modeCards.forEach((card) => {
    card.addEventListener('click', () => {
      highlightSelected(modeCards, 'mode', card.dataset.mode);
      if (card.dataset.mode === 'pvp') {
        onModeChosen({ aiEnabled: false, difficulty: 'medium' });
      } else {
        modeScreenEl.classList.add('hidden');
        difficultyScreenEl.classList.remove('hidden');
      }
    });
  });

  difficultyCards.forEach((card) => {
    card.addEventListener('click', () => {
      highlightSelected(difficultyCards, 'difficulty', card.dataset.difficulty);
      onModeChosen({ aiEnabled: true, difficulty: card.dataset.difficulty });
    });
  });

  backButtonEl.addEventListener('click', () => {
    difficultyScreenEl.classList.add('hidden');
    modeScreenEl.classList.remove('hidden');
  });

  return {
    setActivePlayer(player) {
      activePlayerEl.textContent = player;
    },
    setPhaseText(text) {
      phaseEl.textContent = text;
    },
    // `allowedMoves` is a Set of move strings (e.g. "U", "U'", "U2") that
    // should be enabled; an empty Set disables every button.
    setMoveButtonsEnabled(allowedMoves) {
      for (const [move, btn] of Object.entries(moveButtons)) {
        btn.disabled = !allowedMoves.has(move);
      }
    },
    showBanner(text) {
      bannerTextEl.textContent = text;
      bannerEl.classList.remove('hidden');
    },
    hideBanner() {
      bannerEl.classList.add('hidden');
    },
    showModeModal({ aiEnabled, difficulty }) {
      modeScreenEl.classList.remove('hidden');
      difficultyScreenEl.classList.add('hidden');
      highlightSelected(modeCards, 'mode', aiEnabled ? 'ai' : 'pvp');
      highlightSelected(difficultyCards, 'difficulty', difficulty);
      modalEl.classList.remove('hidden');
    },
    hideModeModal() {
      modalEl.classList.add('hidden');
    },
  };
}
