/**
 * Character Sheet PNG Renderer
 *
 * Builds an off-screen DOM element at 2000x2000,
 * populates it with character data, then captures via html2canvas.
 */
const SheetRenderer = (() => {
  'use strict';

  const SHEET_SIZE = 2000;

  /**
   * Truncate text to maxLen characters, appending "..." if truncated.
   */
  function truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.slice(0, maxLen - 1) + '...' : str;
  }

  /**
   * Build the sheet DOM inside the given container element.
   * @param {HTMLElement} container  - the .char-sheet div
   * @param {Object} charData       - full character data object
   * @param {'light'|'dark'} mode
   */
  function populateSheet(container, charData, mode) {
    container.className = `char-sheet sheet-${mode}`;

    const stats = charData.stats;
    const combat = MagicStart.getCombatSkills(stats, charData.combatSkillBonuses);
    const explore = MagicStart.getExplorationSkills(stats, charData.exploreSkillBonuses);
    const specials = MagicStart.getSpecialSkillTotals(charData.specialSkills, stats, charData.specialSkillBonuses);
    const activeSpecials = specials.filter(s => s.base > 0);

    const customSpecials = MagicStart.getCustomSpecialSkillTotals(charData.customSpecialSkills, stats);
    const activeCustomSpecials = customSpecials.filter(s => s.base > 0 && s.name.trim() !== '');

    const allActiveSpecials = [
      ...activeSpecials.map(s => ({ label: s.label, total: s.total })),
      ...activeCustomSpecials.map(s => ({ label: s.name, total: s.total }))
    ];

    /* ── Image HTML ── */
    let imageHTML;
    if (charData.imageData) {
      imageHTML = `<img src="${charData.imageData}" alt="character">`;
    } else {
      imageHTML = `<div class="sheet-image-placeholder">No Image</div>`;
    }

    /* ── Stat cards ── */
    const statKeys = MagicStart.STAT_KEYS;
    const statLabels = MagicStart.STAT_LABELS;
    const statsHTML = statKeys.map(k =>
      `<div class="sheet-stat-card">
        <div class="sheet-stat-label">${statLabels[k]}</div>
        <div class="sheet-stat-val">${stats[k] || 0}</div>
      </div>`
    ).join('');

    /* ── Combat skills ── */
    const combatHTML = combat.map(s =>
      `<div class="sheet-skill-chip">
        <span class="sheet-skill-name">${s.label}</span>
        <span class="sheet-skill-val">${s.value}</span>
      </div>`
    ).join('');

    /* ── Exploration skills ── */
    const exploreHTML = explore.map(s =>
      `<div class="sheet-skill-chip">
        <span class="sheet-skill-name">${s.label}</span>
        <span class="sheet-skill-val">${s.value}</span>
      </div>`
    ).join('');

    /* ── Special skills ── */
    const specialHTML = allActiveSpecials.map(s =>
      `<div class="sheet-skill-chip">
        <span class="sheet-skill-name">${s.label}</span>
        <span class="sheet-skill-val">${s.total}</span>
      </div>`
    ).join('') || '<div style="font-size:18px;opacity:0.5;">-- 未習得 --</div>';

    /* ── Basic magic ── */
    const magicLabels = MagicStart.BASIC_MAGIC_LABELS;
    const basicMagicHTML = Object.keys(magicLabels).map(k =>
      `<div class="sheet-stat-card sheet-magic-apt-card">
        <div class="sheet-stat-label">${magicLabels[k]}</div>
        <div class="sheet-stat-val">${charData.basicMagic[k] || 0}</div>
      </div>`
    ).join('');

    /* ── Unique magic ── */
    let uniqueMagicHTML = '';
    if (charData.uniqueMagic.length > 0) {
      uniqueMagicHTML = charData.uniqueMagic.map(m => {
        const cat = MagicStart.UNIQUE_MAGIC_CATEGORIES.find(c => c.value === m.category);
        const catLabel = cat ? cat.label : '';
        return `<div class="sheet-magic-list-item">
          <div class="sheet-magic-item-name">${truncate(m.name, 20)}</div>
          <div class="sheet-magic-item-detail">${truncate(catLabel, 16)} / ${truncate(m.effect, 30)}</div>
          <div class="sheet-magic-item-cost">MP: ${m.mpCost}</div>
        </div>`;
      }).join('');
    } else {
      uniqueMagicHTML = '<div style="font-size:18px;opacity:0.5;padding:10px;">-- None --</div>';
    }

    /* ── Weapons ── */
    let weaponsHTML = '';
    if (charData.weapons.length > 0) {
      weaponsHTML = charData.weapons.map(w =>
        `<div class="sheet-magic-list-item">
          <div class="sheet-magic-item-name">${truncate(w.name, 20)}</div>
          <div class="sheet-magic-item-detail">${w.weaponType === 'melee' ? '近接' : '遠距離'} / ${truncate(w.damage, 20)}</div>
          <div class="sheet-magic-item-cost">${truncate(w.extra, 30)}</div>
        </div>`
      ).join('');
    } else {
      weaponsHTML = '<div style="font-size:18px;opacity:0.5;padding:10px;">-- None --</div>';
    }

    /* ── Easter egg helper ── */
    function getEasterEggText(cd) {
      const rollCount = cd.randomRollCount || 0;
      const preset = typeof Preset !== 'undefined' ? Preset.getPresetData() : null;
      let violated = false;

      if (preset) {
        // GMがステータスをランダム指定しているとき
        if (preset.statMode === 'random') {
          // 固定値モードに切り替えた、またはランダムモードのまま個別に手入力された値がある場合
          const hasManualStat = Object.keys(cd.stats).some(k => (cd.statSources && cd.statSources[k] === 'manual'));
          if (cd.statMode === 'fixed' || hasManualStat) {
            violated = true;
          }
        }
        // GMが魔法をランダム指定しているとき
        if (preset.magicMode === 'random') {
          // 固定値モードに切り替えた、または手入力された場合
          if (cd.magicMode === 'fixed' || (cd.magicSource === 'manual')) {
            violated = true;
          }
        }
      }

      if (violated) {
        return `X${rollCount}`;
      }
      if (rollCount === 0) {
        return 'P';
      }
      return String(rollCount);
    }

    /* ── Assemble ── */
    container.innerHTML = `
      <div class="sheet-header">
        <div>
          <div class="sheet-header-title">MAGIC START!</div>
          <div class="sheet-header-sub">Character Sheet</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:20px;font-weight:500;opacity:0.7;">${charData.type === 'ancestor' ? '始祖 / Ancestor' : '眷属 / Kin'}</div>
        </div>
      </div>
      <div class="sheet-body">
        <div class="sheet-profile-row">
          <div class="sheet-image-frame">${imageHTML}</div>
          <div class="sheet-profile-info">
            <div class="sheet-name">${truncate(charData.name || '名無し', 24)}</div>
            <div class="sheet-emotion">感情値: ${charData.emotion}</div>
            <div class="sheet-memo">${truncate(charData.memo, 120)}</div>
          </div>
        </div>

        <div>
          <div class="sheet-section-title">BASIC STATUS</div>
          <div class="sheet-stats-row">${statsHTML}</div>
          <div class="sheet-hpmp-row" style="margin-top:14px;">
            <div class="sheet-hpmp-bar">
              <span class="sheet-hpmp-label">HP</span>
              <span class="sheet-hpmp-val">${charData.hp}</span>
              <span class="sheet-hpmp-sep">/</span>
              <span class="sheet-hpmp-val">${charData.hp}</span>
            </div>
            <div class="sheet-hpmp-bar">
              <span class="sheet-hpmp-label">MP</span>
              <span class="sheet-hpmp-val">${charData.mp}</span>
              <span class="sheet-hpmp-sep">/</span>
              <span class="sheet-hpmp-val">${charData.mp}</span>
            </div>
          </div>
        </div>

        <div class="sheet-two-col">
          <div>
            <div class="sheet-section-title">COMBAT SKILLS</div>
            <div class="sheet-skills-grid">${combatHTML}</div>
          </div>
          <div>
            <div class="sheet-section-title">EXPLORATION SKILLS</div>
            <div class="sheet-skills-grid">${exploreHTML}</div>
          </div>
        </div>

        <div>
          <div class="sheet-section-title">SPECIAL SKILLS</div>
          <div class="sheet-special-grid">${specialHTML}</div>
        </div>

        <div>
          <div class="sheet-section-title">BASIC MAGIC (${charData.magicAptitudePool}pt)</div>
          <div class="sheet-magic-apt-row">${basicMagicHTML}</div>
        </div>

        <div class="sheet-two-col">
          <div>
            <div class="sheet-section-title">UNIQUE MAGIC</div>
            <div class="sheet-magic-list">${uniqueMagicHTML}</div>
          </div>
          <div>
            <div class="sheet-section-title">WEAPONS</div>
            <div class="sheet-weapon-list">${weaponsHTML}</div>
          </div>
        </div>
      </div>
      <div class="sheet-footer" style="display:flex; justify-content:space-between; align-items:center;">
        <span>Magic start! Character Maker</span>
        <span class="sheet-easter-egg" style="font-size:10px; font-family:monospace; user-select:none;">${getEasterEggText(charData)}</span>
      </div>
    `;
  }

  /**
   * Render the off-screen sheet to a Canvas and return the PNG data URL.
   * @param {Object} charData
   * @param {'light'|'dark'} mode
   * @returns {Promise<string>} dataUrl
   */
  async function renderToImage(charData, mode) {
    let wrapper = document.getElementById('sheet-offscreen-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'sheet-offscreen-wrapper';
      wrapper.className = 'sheet-offscreen';
      document.body.appendChild(wrapper);
    }

    let container = document.getElementById('sheet-render-target');
    if (!container) {
      container = document.createElement('div');
      container.id = 'sheet-render-target';
      wrapper.appendChild(container);
    }

    /* Populate */
    populateSheet(container, charData, mode);

    /* Wait a frame for rendering, then capture */
    await new Promise(r => setTimeout(r, 600));

    const canvas = await html2canvas(container, {
      width: SHEET_SIZE,
      height: SHEET_SIZE,
      scale: 1,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
    });

    return canvas.toDataURL('image/png');
  }

  /**
   * Generate and download the character sheet PNG.
   * @param {Object} charData
   * @param {'light'|'dark'} mode
   */
  async function downloadPNG(charData, mode) {
    const dataUrl = await renderToImage(charData, mode);
    const link = document.createElement('a');
    link.download = `${charData.name || 'character'}_sheet_${mode}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return { downloadPNG, renderToImage, populateSheet, SHEET_SIZE };
})();
