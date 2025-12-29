// Game State
const gameState = {
  gold: 0,
  dps: 0,
  level: 1,
  kills: 0,
  goldPerClick: 10,
  goldUpgradeCost: 50,
  dpsPerUpgrade: 1,
  dpsUpgradeCost: 30,
};

// DOM Elements
const goldDisplay = document.getElementById('goldDisplay');
const dpsDisplay = document.getElementById('dpsDisplay');
const levelDisplay = document.getElementById('levelDisplay');
const killsDisplay = document.getElementById('killsDisplay');
const attackBtn = document.getElementById('attackBtn');
const upgradeGoldBtn = document.getElementById('upgradeGoldBtn');
const upgradeDpsBtn = document.getElementById('upgradeDpsBtn');
const upgradeCostGold = document.getElementById('upgradeCostGold');
const upgradeCostDps = document.getElementById('upgradeCostDps');

// Load game state from localStorage
function loadGame() {
  const saved = localStorage.getItem('idleRpgState');
  if (saved) {
    const loaded = JSON.parse(saved);
    Object.assign(gameState, loaded);
  }
}

// Save game state to localStorage
function saveGame() {
  localStorage.setItem('idleRpgState', JSON.stringify(gameState));
}

// Update UI
function updateUI() {
  goldDisplay.textContent = formatNumber(gameState.gold);
  dpsDisplay.textContent = formatNumber(gameState.dps);
  levelDisplay.textContent = gameState.level;
  killsDisplay.textContent = gameState.kills;
  upgradeCostGold.textContent = `Cost: ${formatNumber(gameState.goldUpgradeCost)}`;
  upgradeCostDps.textContent = `Cost: ${formatNumber(gameState.dpsUpgradeCost)}`;

  // Update button states
  upgradeGoldBtn.disabled = gameState.gold < gameState.goldUpgradeCost;
  upgradeDpsBtn.disabled = gameState.gold < gameState.dpsUpgradeCost;
}

// Format large numbers
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return Math.floor(num).toString();
}

// Attack action
function attack() {
  gameState.gold += gameState.goldPerClick;
  gameState.kills += 1;

  // Show damage popup
  showDamagePopup(event);

  // Check for level up
  if (gameState.kills % 10 === 0) {
    levelUp();
  }

  updateUI();
  saveGame();
}

// Show floating damage number
function showDamagePopup(event) {
  const popup = document.createElement('div');
  popup.className = 'damage-popup animate';
  popup.textContent = '+' + gameState.goldPerClick;

  const rect = attackBtn.getBoundingClientRect();
  popup.style.left = rect.left + rect.width / 2 - 20 + 'px';
  popup.style.top = rect.top + 'px';

  document.body.appendChild(popup);

  setTimeout(() => {
    popup.remove();
  }, 600);
}

// Level up
function levelUp() {
  gameState.level += 1;
  // Bonus for level up
  gameState.dps += 0.5;
}

// Upgrade gold production
function upgradeGold() {
  if (gameState.gold >= gameState.goldUpgradeCost) {
    gameState.gold -= gameState.goldUpgradeCost;
    gameState.goldPerClick += 5;
    gameState.goldUpgradeCost = Math.floor(gameState.goldUpgradeCost * 1.15);
    updateUI();
    saveGame();
  }
}

// Upgrade DPS
function upgradeDps() {
  if (gameState.gold >= gameState.dpsUpgradeCost) {
    gameState.gold -= gameState.dpsUpgradeCost;
    gameState.dps += gameState.dpsPerUpgrade;
    gameState.dpsUpgradeCost = Math.floor(gameState.dpsUpgradeCost * 1.15);
    updateUI();
    saveGame();
  }
}

// Passive income tick (every second)
function tick() {
  gameState.gold += gameState.dps;
  updateUI();
  saveGame();
}

// Event listeners
attackBtn.addEventListener('click', attack);
upgradeGoldBtn.addEventListener('click', upgradeGold);
upgradeDpsBtn.addEventListener('click', upgradeDps);

// Initialize
loadGame();
updateUI();

// Start passive income
setInterval(tick, 1000);

// Auto-save every 5 seconds
setInterval(saveGame, 5000);
