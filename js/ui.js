export function initUI({ onMoveButton, onRestart }) {
  const moveButtons = {};
  document.querySelectorAll('#move-panel button[data-move]').forEach((btn) => {
    const move = btn.dataset.move;
    moveButtons[move] = btn;
    btn.addEventListener('click', () => onMoveButton(move));
  });

  document.getElementById('restart-button').addEventListener('click', onRestart);
  document.getElementById('banner-restart').addEventListener('click', onRestart);

  const activePlayerEl = document.getElementById('active-player');
  const phaseEl = document.getElementById('phase-indicator');
  const bannerEl = document.getElementById('banner');
  const bannerTextEl = document.getElementById('banner-text');

  return {
    setActivePlayer(player) {
      activePlayerEl.textContent = player;
    },
    setPhaseText(text) {
      phaseEl.textContent = text;
    },
    setMoveButtonsEnabled(enabled) {
      for (const btn of Object.values(moveButtons)) btn.disabled = !enabled;
    },
    showBanner(text) {
      bannerTextEl.textContent = text;
      bannerEl.classList.remove('hidden');
    },
    hideBanner() {
      bannerEl.classList.add('hidden');
    },
  };
}
