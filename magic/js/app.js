/**
 * Magic start! Character Maker — Main Application Logic
 *
 * Handles:
 *  - Form initialization & event binding
 *  - Two-way data sync (form ↔ character data)
 *  - LocalStorage auto-save / restore
 *  - JSON export / import
 *  - Dynamic add/remove for unique magic & weapons
 *  - Theme toggle
 *  - Derived skill recalculation
 */
const App = (() => {
  'use strict';

  const LS_KEY = 'magicstart_character_data';
  let charData = MagicStart.createDefault();

  /* ──────────────────────────────────────
     Toast
     ────────────────────────────────────── */
  let toastTimer = null;
  function showToast(message, type = 'success') {
    const el = document.getElementById('toast');
    const icon = document.getElementById('toast-icon');
    const msg = document.getElementById('toast-message');
    msg.textContent = message;
    el.className = `toast ${type}`;
    icon.textContent = type === 'success' ? 'check_circle' : 'error';
    clearTimeout(toastTimer);
    requestAnimationFrame(() => {
      el.classList.add('show');
    });
    toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  /* ──────────────────────────────────────
     LocalStorage
     ────────────────────────────────────── */
  function saveToLS() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(charData));
    } catch (e) { /* quota exceeded, silent */ }
  }

  function loadFromLS() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        charData = mergeDefaults(MagicStart.createDefault(), parsed);
        return true;
      }
    } catch (e) { /* corrupted, ignore */ }
    return false;
  }

  function clearLS() {
    localStorage.removeItem(LS_KEY);
  }

  /** Deep-merge saved data onto defaults so new fields are always present. */
  function mergeDefaults(defaults, saved) {
    const result = { ...defaults };
    for (const key of Object.keys(defaults)) {
      if (saved[key] === undefined) continue;
      if (defaults[key] !== null && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
        result[key] = mergeDefaults(defaults[key], saved[key]);
      } else {
        result[key] = saved[key];
      }
    }
    return result;
  }

  /* ──────────────────────────────────────
     Theme
     ────────────────────────────────────── */
  function initTheme() {
    const saved = localStorage.getItem('magicstart_theme') || 'light';
    setTheme(saved);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('magicstart_theme', theme);
    const icon = document.getElementById('theme-icon');
    icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  }

  let showGrowth = false;
  function initGrowthToggle() {
    const saved = localStorage.getItem('magicstart_show_growth') === 'true';
    setGrowthToggle(saved);
  }

  function setGrowthToggle(active) {
    showGrowth = active;
    localStorage.setItem('magicstart_show_growth', active ? 'true' : 'false');
    document.body.classList.toggle('show-growth', active);

    const icon = document.getElementById('growth-icon');
    const text = document.getElementById('growth-toggle-text');
    if (icon) icon.textContent = active ? 'trending_flat' : 'trending_up';
    if (text) text.textContent = active ? '成長を非表示' : '成長を表示';
  }

  function toggleGrowth() {
    setGrowthToggle(!showGrowth);
  }

  /* ──────────────────────────────────────
     Build Static UI Elements
     ────────────────────────────────────── */
  function buildStatsGrid() {
    const grid = document.getElementById('stats-grid');
    grid.innerHTML = '';
    MagicStart.STAT_KEYS.forEach(key => {
      const label = MagicStart.STAT_LABELS[key];
      const div = document.createElement('div');
      div.className = 'stat-card';
      div.setAttribute('data-stat', key);
      div.innerHTML = `
        <span class="stat-label">${label}</span>
        <input type="number" class="form-input-num" id="stat-${key}"
               min="0" max="30" value="${charData.stats[key]}"
               data-stat-key="${key}">
        <button class="btn btn-ghost btn-sm btn-icon" data-tooltip="5d6" data-roll-stat="${key}">
          <span class="material-symbols-outlined" style="font-size:16px;">casino</span>
        </button>
      `;
      grid.appendChild(div);
    });
  }

  function buildSpecialSkillsGrid() {
    const grid = document.getElementById('special-skills-grid');
    grid.innerHTML = '';
    MagicStart.SPECIAL_SKILL_DEFS.forEach(def => {
      const div = document.createElement('div');
      div.className = 'special-skill-row';
      const bonusLabel = def.bonus ? `+${MagicStart.STAT_LABELS[def.bonus]}` : '';
      div.innerHTML = `
        <span class="special-skill-label">${def.label}</span>
        <div style="margin-left:auto; display:flex; align-items:center;">
          <span style="font-size:0.72rem; color:var(--text-tertiary); margin-right:4px;">振分:</span>
          <input type="number" class="special-skill-input" id="sskill-${def.key}"
                 min="0" max="100" value="${charData.specialSkills[def.key]}"
                 data-sskill-key="${def.key}" style="width:40px; padding:3px 2px; height:26px;">
          <span class="special-skill-bonus" style="font-size:0.72rem; color:var(--text-secondary); min-width:32px; text-align:left; margin-left:4px;">${bonusLabel}</span>
          
          <div class="growth-adjuster" style="display:inline-flex; align-items:center;">
            <button type="button" class="btn-bonus-adjust" data-adjust-target="sskill-bonus-${def.key}" data-adjust-dir="down"
                    style="padding:0; height:26px; width:22px; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--border); border-right:none; background:var(--bg-secondary); color:var(--text-primary); cursor:pointer; font-size:12px; margin-left:4px;">
              <span class="material-symbols-outlined" style="font-size:12px; font-weight:700;">remove</span>
            </button>
            <input type="number" class="special-skill-input skill-bonus-input" id="sskill-bonus-${def.key}"
                   min="-99" max="99" value="${charData.specialSkillBonuses[def.key] || 0}"
                   data-sskill-bonus-key="${def.key}" 
                   style="width:30px; padding:0; height:26px; text-align:center; border:1px solid var(--border); background:var(--surface); color:var(--text-primary); outline:none; -moz-appearance:textfield; font-size:0.85rem;">
            <button type="button" class="btn-bonus-adjust" data-adjust-target="sskill-bonus-${def.key}" data-adjust-dir="up"
                    style="padding:0; height:26px; width:22px; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--border); border-left:none; background:var(--bg-secondary); color:var(--text-primary); cursor:pointer; font-size:12px;">
              <span class="material-symbols-outlined" style="font-size:12px; font-weight:700;">add</span>
            </button>
          </div>
          
          <span style="font-size:0.75rem; color:var(--text-secondary); margin-left:12px;">合計:</span>
          <span class="special-skill-total" id="sskill-total-${def.key}" style="min-width:28px; text-align:right; font-weight:700; color:var(--primary); font-size:0.95rem; margin-left:4px;">0</span>
        </div>
      `;
      grid.appendChild(div);
    });

    /* Render Custom Special Skills */
    charData.customSpecialSkills = charData.customSpecialSkills || [];
    charData.customSpecialSkills.forEach((s, idx) => {
      const div = document.createElement('div');
      div.className = 'special-skill-row';
      
      const statOptions = ['none', ...MagicStart.STAT_KEYS].map(key => {
        const label = key === 'none' ? '補正なし' : MagicStart.STAT_LABELS[key];
        return `<option value="${key}" ${s.bonusStat === key ? 'selected' : ''}>+${label}</option>`;
      }).join('');

      div.innerHTML = `
        <input type="text" class="form-input custom-sskill-name-input" value="${escapeHtml(s.name)}" placeholder="新技能名"
               data-custom-sskill-idx="${idx}" data-field="name"
               style="width:90px; height:26px; padding:2px 4px; font-size:0.8rem; border-radius:0; border:1px solid var(--border); background:var(--surface); color:var(--text-primary); outline:none;">
        
        <div style="margin-left:auto; display:flex; align-items:center;">
          <span style="font-size:0.72rem; color:var(--text-tertiary); margin-right:4px;">振分:</span>
          <input type="number" class="special-skill-input" value="${s.base}"
                 min="0" max="100" data-custom-sskill-idx="${idx}" data-field="base"
                 style="width:36px; padding:3px 2px; height:26px;">
                 
          <select class="form-select" data-custom-sskill-idx="${idx}" data-field="bonusStat"
                  style="font-size:0.72rem; padding:0 4px; height:26px; margin-left:6px; min-width:70px; width:auto; border-radius:0; border:1px solid var(--border); background:var(--surface); color:var(--text-primary); outline:none;">
            ${statOptions}
          </select>
          
          <div class="growth-adjuster" style="display:inline-flex; align-items:center;">
            <button type="button" class="btn-bonus-adjust" data-adjust-target="custom-sskill-bonus-${idx}" data-adjust-dir="down"
                    style="padding:0; height:26px; width:22px; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--border); border-right:none; background:var(--bg-secondary); color:var(--text-primary); cursor:pointer; font-size:12px; margin-left:4px;">
              <span class="material-symbols-outlined" style="font-size:12px; font-weight:700;">remove</span>
            </button>
            <input type="number" class="special-skill-input skill-bonus-input" id="custom-sskill-bonus-${idx}"
                   min="-99" max="99" value="${s.bonus || 0}"
                   data-custom-sskill-idx="${idx}" data-field="bonus" 
                   style="width:30px; padding:0; height:26px; text-align:center; border:1px solid var(--border); background:var(--surface); color:var(--text-primary); outline:none; -moz-appearance:textfield; font-size:0.85rem;">
            <button type="button" class="btn-bonus-adjust" data-adjust-target="custom-sskill-bonus-${idx}" data-adjust-dir="up"
                    style="padding:0; height:26px; width:22px; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--border); border-left:none; background:var(--bg-secondary); color:var(--text-primary); cursor:pointer; font-size:12px;">
              <span class="material-symbols-outlined" style="font-size:12px; font-weight:700;">add</span>
            </button>
          </div>
          
          <span style="font-size:0.75rem; color:var(--text-secondary); margin-left:12px;">合計:</span>
          <span class="special-skill-total" id="custom-sskill-total-${idx}" style="min-width:24px; text-align:right; font-weight:700; color:var(--primary); font-size:0.95rem; margin-left:4px;">0</span>
          
          <button type="button" class="btn btn-danger btn-sm btn-icon" data-remove-custom-sskill="${idx}"
                  style="margin-left:8px; padding:0; height:26px; width:24px; border-radius:0;">
            <span class="material-symbols-outlined" style="font-size:14px;">close</span>
          </button>
        </div>
      `;
      grid.appendChild(div);
    });
  }

  function buildBasicMagicGrid() {
    const grid = document.getElementById('magic-grid');
    grid.innerHTML = '';
    const labels = MagicStart.BASIC_MAGIC_LABELS;
    Object.keys(labels).forEach(key => {
      const div = document.createElement('div');
      div.className = 'magic-card';
      div.innerHTML = `
        <span class="magic-label">${labels[key]}</span>
        <input type="number" class="form-input-num" id="bmagic-${key}"
               min="0" max="100" value="${charData.basicMagic[key]}"
               data-bmagic-key="${key}">
      `;
      grid.appendChild(div);
    });
  }

  /* ──────────────────────────────────────
     Dynamic Lists — Unique Magic
     ────────────────────────────────────── */
  function renderUniqueMagicList() {
    const list = document.getElementById('unique-magic-list');
    list.innerHTML = '';
    charData.uniqueMagic.forEach((m, i) => {
      list.appendChild(createUniqueMagicItem(m, i));
    });
    updateMagicCount();
  }

  function createUniqueMagicItem(data, index) {
    const div = document.createElement('div');
    div.className = 'dynamic-item';
    div.setAttribute('data-magic-index', index);

    const categoryOptions = MagicStart.UNIQUE_MAGIC_CATEGORIES.map(c =>
      `<option value="${c.value}" ${data.category === c.value ? 'selected' : ''}>${c.label}</option>`
    ).join('');

    const isFixed = typeof Preset !== 'undefined' && Preset.getPresetData() && Preset.getPresetData().magicSlotsMode === 'fixed';
    const deleteBtn = isFixed ? '' : `
      <button class="btn btn-danger btn-sm btn-icon" data-remove-magic="${index}">
        <span class="material-symbols-outlined">close</span>
      </button>
    `;

    div.innerHTML = `
      <div class="dynamic-item-header">
        <span style="font-size:0.8rem; font-weight:600; color:var(--accent);">固有魔法 #${index + 1}</span>
        ${deleteBtn}
      </div>
      <div class="dynamic-item-fields">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">名前</label>
          <input type="text" class="form-input" data-magic-field="name" data-magic-idx="${index}"
                 value="${escapeHtml(data.name)}" placeholder="魔法名" maxlength="40">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">分類</label>
          <select class="form-select" data-magic-field="category" data-magic-idx="${index}">
            ${categoryOptions}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">消費MP</label>
          <input type="number" class="form-input-num" data-magic-field="mpCost" data-magic-idx="${index}"
                 min="0" max="999" value="${data.mpCost}" style="width:80px;">
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label">効果</label>
        <input type="text" class="form-input" data-magic-field="effect" data-magic-idx="${index}"
               value="${escapeHtml(data.effect)}" placeholder="効果の説明" maxlength="100">
      </div>
    `;
    return div;
  }

  function addUniqueMagic() {
    const maxSlots = typeof Preset !== 'undefined' ? Preset.getMaxMagicSlots() : MagicStart.MAX_UNIQUE_MAGIC;
    if (charData.uniqueMagic.length >= maxSlots) {
      showToast(`固有魔法は最大${maxSlots}個までです`, 'error');
      return;
    }
    charData.uniqueMagic.push({ name: '', category: '1', effect: '', mpCost: 0 });
    renderUniqueMagicList();
    saveToLS();
  }

  function addCustomSpecialSkill() {
    charData.customSpecialSkills = charData.customSpecialSkills || [];
    charData.customSpecialSkills.push({
      name: '',
      base: 0,
      bonusStat: 'none',
      bonus: 0
    });
    buildSpecialSkillsGrid();
    recalcAll();
    saveToLS();
  }

  function removeCustomSpecialSkill(index) {
    charData.customSpecialSkills = charData.customSpecialSkills || [];
    charData.customSpecialSkills.splice(index, 1);
    buildSpecialSkillsGrid();
    recalcAll();
    saveToLS();
  }

  function removeUniqueMagic(index) {
    charData.uniqueMagic.splice(index, 1);
    renderUniqueMagicList();
    saveToLS();
  }

  function updateMagicCount() {
    const maxSlots = typeof Preset !== 'undefined' ? Preset.getMaxMagicSlots() : MagicStart.MAX_UNIQUE_MAGIC;
    document.getElementById('magic-count').textContent = charData.uniqueMagic.length;
    const btn = document.getElementById('btn-add-magic');
    btn.disabled = charData.uniqueMagic.length >= maxSlots;
  }

  /* ──────────────────────────────────────
     Dynamic Lists — Weapons
     ────────────────────────────────────── */
  function renderWeaponsList() {
    const list = document.getElementById('weapons-list');
    list.innerHTML = '';
    charData.weapons.forEach((w, i) => {
      list.appendChild(createWeaponItem(w, i));
    });
    updateWeaponCount();
  }

  function createWeaponItem(data, index) {
    const div = document.createElement('div');
    div.className = 'dynamic-item';
    div.setAttribute('data-weapon-index', index);

    div.innerHTML = `
      <div class="dynamic-item-header">
        <span style="font-size:0.8rem; font-weight:600; color:var(--accent);">武器 #${index + 1}</span>
        <button class="btn btn-danger btn-sm btn-icon" data-remove-weapon="${index}">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="dynamic-item-fields">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">名前</label>
          <input type="text" class="form-input" data-weapon-field="name" data-weapon-idx="${index}"
                 value="${escapeHtml(data.name)}" placeholder="武器名" maxlength="40">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">種別</label>
          <select class="form-select" data-weapon-field="weaponType" data-weapon-idx="${index}">
            <option value="melee" ${data.weaponType === 'melee' ? 'selected' : ''}>近接</option>
            <option value="ranged" ${data.weaponType === 'ranged' ? 'selected' : ''}>遠距離</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">ダメージ</label>
          <input type="text" class="form-input" data-weapon-field="damage" data-weapon-idx="${index}"
                 value="${escapeHtml(data.damage)}" placeholder="例: 筋力x1d3" maxlength="40">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">その他 (耐久/射程等)</label>
          <input type="text" class="form-input" data-weapon-field="extra" data-weapon-idx="${index}"
                 value="${escapeHtml(data.extra || '')}" placeholder="例: 耐久50 射程1" maxlength="60">
        </div>
      </div>
    `;
    return div;
  }

  function addWeapon() {
    if (charData.weapons.length >= MagicStart.MAX_WEAPONS) {
      showToast('武器は最大6個までです', 'error');
      return;
    }
    charData.weapons.push({ name: '', weaponType: 'melee', damage: '', extra: '' });
    renderWeaponsList();
    saveToLS();
  }

  function removeWeapon(index) {
    charData.weapons.splice(index, 1);
    renderWeaponsList();
    saveToLS();
  }

  function updateWeaponCount() {
    document.getElementById('weapon-count').textContent = charData.weapons.length;
    const btn = document.getElementById('btn-add-weapon');
    btn.disabled = charData.weapons.length >= MagicStart.MAX_WEAPONS;
  }

  /* ──────────────────────────────────────
     Dynamic Lists — Combat & Exploration Skills
     ────────────────────────────────────── */
  function buildCombatSkillsGrid() {
    const grid = document.getElementById('combat-skills-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const combat = MagicStart.getCombatSkills(charData.stats, charData.combatSkillBonuses);
    combat.forEach(s => {
      const row = document.createElement('div');
      row.className = 'special-skill-row';
      row.innerHTML = `
        <span class="special-skill-label">${s.label}</span>
        <div style="margin-left:auto; display:flex; align-items:center;">
          <div class="growth-adjuster" style="display:inline-flex; align-items:center;">
            <button type="button" class="btn-bonus-adjust" data-adjust-target="combat-bonus-${s.key}" data-adjust-dir="down"
                    style="padding:0; height:26px; width:24px; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--border); border-right:none; background:var(--bg-secondary); color:var(--text-primary); cursor:pointer; font-size:12px;">
              <span class="material-symbols-outlined" style="font-size:14px; font-weight:700;">remove</span>
            </button>
            <input type="number" class="special-skill-input skill-bonus-input" id="combat-bonus-${s.key}"
                   min="-99" max="99" value="${charData.combatSkillBonuses[s.key] || 0}"
                   data-combat-bonus-key="${s.key}" 
                   style="width:36px; padding:0; height:26px; text-align:center; border:1px solid var(--border); background:var(--surface); color:var(--text-primary); outline:none; -moz-appearance:textfield;">
            <button type="button" class="btn-bonus-adjust" data-adjust-target="combat-bonus-${s.key}" data-adjust-dir="up"
                    style="padding:0; height:26px; width:24px; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--border); border-left:none; background:var(--bg-secondary); color:var(--text-primary); cursor:pointer; font-size:12px;">
              <span class="material-symbols-outlined" style="font-size:14px; font-weight:700;">add</span>
            </button>
          </div>
          <span style="font-size:0.78rem; color:var(--text-secondary); margin-left:12px;">合計:</span>
          <span class="special-skill-total" id="combat-total-${s.key}" style="min-width:28px; text-align:right; font-weight:700; color:var(--primary); font-size:0.95rem; margin-left:4px;">${s.value}</span>
        </div>
      `;
      grid.appendChild(row);
    });
  }

  function buildExploreSkillsGrid() {
    const grid = document.getElementById('explore-skills-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const explore = MagicStart.getExplorationSkills(charData.stats, charData.exploreSkillBonuses);
    explore.forEach(s => {
      const row = document.createElement('div');
      row.className = 'special-skill-row';
      row.innerHTML = `
        <span class="special-skill-label">${s.label}</span>
        <div style="margin-left:auto; display:flex; align-items:center;">
          <div class="growth-adjuster" style="display:inline-flex; align-items:center;">
            <button type="button" class="btn-bonus-adjust" data-adjust-target="explore-bonus-${s.key}" data-adjust-dir="down"
                    style="padding:0; height:26px; width:24px; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--border); border-right:none; background:var(--bg-secondary); color:var(--text-primary); cursor:pointer; font-size:12px;">
              <span class="material-symbols-outlined" style="font-size:14px; font-weight:700;">remove</span>
            </button>
            <input type="number" class="special-skill-input skill-bonus-input" id="explore-bonus-${s.key}"
                   min="-99" max="99" value="${charData.exploreSkillBonuses[s.key] || 0}"
                   data-explore-bonus-key="${s.key}" 
                   style="width:36px; padding:0; height:26px; text-align:center; border:1px solid var(--border); background:var(--surface); color:var(--text-primary); outline:none; -moz-appearance:textfield;">
            <button type="button" class="btn-bonus-adjust" data-adjust-target="explore-bonus-${s.key}" data-adjust-dir="up"
                    style="padding:0; height:26px; width:24px; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--border); border-left:none; background:var(--bg-secondary); color:var(--text-primary); cursor:pointer; font-size:12px;">
              <span class="material-symbols-outlined" style="font-size:14px; font-weight:700;">add</span>
            </button>
          </div>
          <span style="font-size:0.78rem; color:var(--text-secondary); margin-left:12px;">合計:</span>
          <span class="special-skill-total" id="explore-total-${s.key}" style="min-width:28px; text-align:right; font-weight:700; color:var(--primary); font-size:0.95rem; margin-left:4px;">${s.value}</span>
        </div>
      `;
      grid.appendChild(row);
    });
  }

  function recalcCombatSkills() {
    const combat = MagicStart.getCombatSkills(charData.stats, charData.combatSkillBonuses);
    combat.forEach(s => {
      const el = document.getElementById(`combat-total-${s.key}`);
      if (el) el.textContent = s.value;
    });
  }

  function recalcExploreSkills() {
    const explore = MagicStart.getExplorationSkills(charData.stats, charData.exploreSkillBonuses);
    explore.forEach(s => {
      const el = document.getElementById(`explore-total-${s.key}`);
      if (el) el.textContent = s.value;
    });
  }

  function updateChatPaletteText() {
    const el = document.getElementById('ccf-palette-text');
    if (el) {
      el.value = Cocofolia.buildChatPalette(charData);
    }
  }

  /* ──────────────────────────────────────
     Recalculate Derived Values & Update UI
     ────────────────────────────────────── */
  function recalcAll() {
    recalcCombatSkills();
    recalcExploreSkills();
    recalcSpecialSkillTotals();
    recalcStatPoints();
    recalcSpecialPoints();
    recalcMagicPoints();
    updateHPMax();
    updateMPMax();
    updateChatPaletteText();
  }

  function recalcSpecialSkillTotals() {
    const totals = MagicStart.getSpecialSkillTotals(charData.specialSkills, charData.stats, charData.specialSkillBonuses);
    totals.forEach(s => {
      const el = document.getElementById(`sskill-total-${s.key}`);
      if (el) el.textContent = s.total;
    });

    const customTotals = MagicStart.getCustomSpecialSkillTotals(charData.customSpecialSkills, charData.stats);
    customTotals.forEach(s => {
      const el = document.getElementById(`custom-sskill-total-${s.index}`);
      if (el) el.textContent = s.total;
    });
  }

  function recalcStatPoints() {
    const used = MagicStart.getStatPointsUsed(charData.stats);
    const totalPool = typeof Preset !== 'undefined' ? Preset.getEffectiveStatPool(charData) : MagicStart.STAT_POOL;
    const remaining = totalPool - used;
    const el = document.getElementById('stat-points-remaining');
    if (el) el.textContent = remaining;
    const indicator = document.getElementById('stat-points-indicator');
    if (indicator) indicator.classList.toggle('over-budget', remaining < 0);
  }

  function recalcSpecialPoints() {
    const used = MagicStart.getSpecialSkillPointsUsed(charData.specialSkills, charData.customSpecialSkills);
    const remaining = MagicStart.SPECIAL_SKILL_POOL - used;
    const el = document.getElementById('special-points-remaining');
    el.textContent = remaining;
    const indicator = document.getElementById('special-points-indicator');
    indicator.classList.toggle('over-budget', remaining < 0);
  }

  function recalcMagicPoints() {
    const pool = charData.magicAptitudePool;
    const used = MagicStart.getBasicMagicPointsUsed(charData.basicMagic);
    const remaining = pool - used;
    document.getElementById('magic-points-remaining').textContent = remaining;
    document.getElementById('magic-pool-display').textContent = pool;
    const indicator = document.getElementById('magic-points-indicator');
    indicator.classList.toggle('over-budget', remaining < 0);
  }

  function updateHPMax() {
    const hp = charData.hp;
    document.getElementById('stat-hp-max').textContent = hp;
  }

  function updateMPMax() {
    const mp = charData.mp;
    document.getElementById('stat-mp-max').textContent = mp;
  }

  /* ──────────────────────────────────────
     Form → Data Sync
     ────────────────────────────────────── */
  function syncFormToData() {
    charData.name = document.getElementById('char-name').value;
    charData.memo = document.getElementById('char-memo').value;

    const typeRadio = document.querySelector('input[name="char-type"]:checked');
    charData.type = typeRadio ? typeRadio.value : 'ancestor';

    MagicStart.STAT_KEYS.forEach(key => {
      const input = document.getElementById(`stat-${key}`);
      charData.stats[key] = parseInt(input.value) || 0;
    });

    charData.hp = parseInt(document.getElementById('stat-hp').value) || 0;
    charData.mp = parseInt(document.getElementById('stat-mp').value) || 0;
    charData.emotion = parseInt(document.getElementById('stat-emotion').value) || 0;

    MagicStart.SPECIAL_SKILL_DEFS.forEach(def => {
      const input = document.getElementById(`sskill-${def.key}`);
      charData.specialSkills[def.key] = parseInt(input.value) || 0;
    });

    charData.magicAptitudePool = parseInt(document.getElementById('magic-pool').value) || 0;
    Object.keys(MagicStart.BASIC_MAGIC_LABELS).forEach(key => {
      const input = document.getElementById(`bmagic-${key}`);
      charData.basicMagic[key] = parseInt(input.value) || 0;
    });

    /* Skill Bonuses */
    const combatBonuses = {};
    document.querySelectorAll('input[data-combat-bonus-key]').forEach(input => {
      combatBonuses[input.dataset.combatBonusKey] = parseInt(input.value) || 0;
    });
    charData.combatSkillBonuses = combatBonuses;

    const exploreBonuses = {};
    document.querySelectorAll('input[data-explore-bonus-key]').forEach(input => {
      exploreBonuses[input.dataset.exploreBonusKey] = parseInt(input.value) || 0;
    });
    charData.exploreSkillBonuses = exploreBonuses;

    const specialBonuses = {};
    document.querySelectorAll('input[data-sskill-bonus-key]').forEach(input => {
      specialBonuses[input.dataset.sskillBonusKey] = parseInt(input.value) || 0;
    });
    charData.specialSkillBonuses = specialBonuses;

    /* Custom Special Skills */
    const customSkillsList = [];
    document.querySelectorAll('.special-skills-grid .special-skill-row').forEach(row => {
      const nameInput = row.querySelector('.custom-sskill-name-input');
      if (nameInput) {
        const idx = parseInt(nameInput.dataset.customSskillIdx);
        const baseInput = row.querySelector(`input[data-custom-sskill-idx="${idx}"][data-field="base"]`);
        const statSelect = row.querySelector(`select[data-custom-sskill-idx="${idx}"][data-field="bonusStat"]`);
        const bonusInput = row.querySelector(`input[data-custom-sskill-idx="${idx}"][data-field="bonus"]`);
        
        customSkillsList.push({
          name: nameInput.value,
          base: baseInput ? parseInt(baseInput.value) || 0 : 0,
          bonusStat: statSelect ? statSelect.value : 'none',
          bonus: bonusInput ? parseInt(bonusInput.value) || 0 : 0
        });
      }
    });
    charData.customSpecialSkills = customSkillsList;
  }

  /** Data → Form (for loading saved data) */
  function syncDataToForm() {
    /* Fallbacks for older files */
    charData.combatSkillBonuses = charData.combatSkillBonuses || { fist: 0, kick: 0, dodge: 0, counter: 0, parry: 0 };
    charData.exploreSkillBonuses = charData.exploreSkillBonuses || { observe: 0, analyze: 0, luck: 0, know: 0, senses: 0, track: 0 };
    charData.specialSkillBonuses = charData.specialSkillBonuses || { disguise: 0, voiceChange: 0, negotiation: 0, authority: 0, charm: 0, psychology: 0, theft: 0, shooting: 0, jump: 0 };
    charData.customSpecialSkills = charData.customSpecialSkills || [];

    document.getElementById('char-name').value = charData.name;
    document.getElementById('char-memo').value = charData.memo;

    const typeId = charData.type === 'ancestor' ? 'type-ancestor' : 'type-kin';
    const typeRadio = document.getElementById(typeId);
    if (typeRadio) typeRadio.checked = true;

    const smRadio = document.getElementById('stat-mode-' + (charData.statMode || 'random'));
    if (smRadio) smRadio.checked = true;

    const mmRadio = document.getElementById('magic-mode-' + (charData.magicMode || 'random'));
    if (mmRadio) mmRadio.checked = true;

    MagicStart.STAT_KEYS.forEach(key => {
      const el = document.getElementById(`stat-${key}`);
      if (el) el.value = charData.stats[key];
    });

    document.getElementById('stat-hp').value = charData.hp;
    document.getElementById('stat-mp').value = charData.mp;
    document.getElementById('stat-emotion').value = charData.emotion;

    MagicStart.SPECIAL_SKILL_DEFS.forEach(def => {
      const el = document.getElementById(`sskill-${def.key}`);
      if (el) el.value = charData.specialSkills[def.key];
    });

    document.getElementById('magic-pool').value = charData.magicAptitudePool;
    Object.keys(MagicStart.BASIC_MAGIC_LABELS).forEach(key => {
      const el = document.getElementById(`bmagic-${key}`);
      if (el) el.value = charData.basicMagic[key];
    });

    /* Rebuild input grids */
    buildCombatSkillsGrid();
    buildExploreSkillsGrid();
    buildSpecialSkillsGrid();

    /* Image */
    if (charData.imageData) {
      const imgEl = document.getElementById('image-preview-img');
      imgEl.src = charData.imageData;
      imgEl.style.display = 'block';
      document.getElementById('image-preview').classList.add('has-image');
      document.getElementById('btn-remove-image').style.display = '';
    } else {
      document.getElementById('image-preview-img').style.display = 'none';
      document.getElementById('image-preview').classList.remove('has-image');
      document.getElementById('btn-remove-image').style.display = 'none';
    }

    renderUniqueMagicList();
    renderWeaponsList();
    if (typeof Preset !== 'undefined') {
      Preset.updateModeUI();
    }
    recalcAll();
  }

  /* ──────────────────────────────────────
     Event Handlers
     ────────────────────────────────────── */
  function onFormChange() {
    syncFormToData();
    recalcAll();
    saveToLS();
  }

  function bindEvents() {
    /* ── Global form input changes ── */
    document.querySelector('.app-main').addEventListener('input', (e) => {
      const target = e.target;

      /* Custom special skill inputs */
      if (target.dataset.customSskillIdx !== undefined) {
        const idx = parseInt(target.dataset.customSskillIdx);
        const field = target.dataset.field;
        if (charData.customSpecialSkills[idx]) {
          const val = target.value;
          charData.customSpecialSkills[idx][field] = (field === 'base' || field === 'bonus') ? (parseInt(val) || 0) : val;
          recalcSpecialSkillTotals();
          recalcSpecialPoints();
          updateChatPaletteText();
          saveToLS();
        }
        return;
      }

      /* Combat skill bonuses */
      if (target.dataset.combatBonusKey) {
        charData.combatSkillBonuses[target.dataset.combatBonusKey] = parseInt(target.value) || 0;
        recalcCombatSkills();
        updateChatPaletteText();
        saveToLS();
        return;
      }

      /* Explore skill bonuses */
      if (target.dataset.exploreBonusKey) {
        charData.exploreSkillBonuses[target.dataset.exploreBonusKey] = parseInt(target.value) || 0;
        recalcExploreSkills();
        updateChatPaletteText();
        saveToLS();
        return;
      }

      /* Special skill bonuses */
      if (target.dataset.sskillBonusKey) {
        charData.specialSkillBonuses[target.dataset.sskillBonusKey] = parseInt(target.value) || 0;
        recalcSpecialSkillTotals();
        updateChatPaletteText();
        saveToLS();
        return;
      }

      /* Stat inputs */
      if (target.dataset.statKey) {
        charData.stats[target.dataset.statKey] = parseInt(target.value) || 0;
        if (charData.statSources) {
          charData.statSources[target.dataset.statKey] = 'manual';
        }
        recalcAll();
        saveToLS();
        return;
      }

      /* Special skill inputs */
      if (target.dataset.sskillKey) {
        charData.specialSkills[target.dataset.sskillKey] = parseInt(target.value) || 0;
        recalcSpecialSkillTotals();
        recalcSpecialPoints();
        saveToLS();
        return;
      }

      /* Basic magic inputs */
      if (target.dataset.bmagicKey) {
        charData.basicMagic[target.dataset.bmagicKey] = parseInt(target.value) || 0;
        charData.magicSource = 'manual';
        recalcMagicPoints();
        saveToLS();
        return;
      }

      /* Unique magic fields */
      if (target.dataset.magicField !== undefined) {
        const idx = parseInt(target.dataset.magicIdx);
        const field = target.dataset.magicField;
        if (charData.uniqueMagic[idx]) {
          charData.uniqueMagic[idx][field] = field === 'mpCost' ? (parseInt(target.value) || 0) : target.value;
          saveToLS();
        }
        return;
      }

      /* Weapon fields */
      if (target.dataset.weaponField !== undefined) {
        const idx = parseInt(target.dataset.weaponIdx);
        const field = target.dataset.weaponField;
        if (charData.weapons[idx]) {
          charData.weapons[idx][field] = target.value;
          saveToLS();
        }
        return;
      }

      /* Other inputs (name, memo, hp, mp, emotion, magic pool) */
      if (target.id === 'magic-pool') {
        charData.magicSource = 'manual';
      }
      onFormChange();
    });

    /* ── Change events (for selects and radios) ── */
    document.querySelector('.app-main').addEventListener('change', (e) => {
      const target = e.target;

      /* Custom special skill bonusStat select */
      if (target.dataset.customSskillIdx !== undefined) {
        const idx = parseInt(target.dataset.customSskillIdx);
        const field = target.dataset.field;
        if (charData.customSpecialSkills[idx]) {
          charData.customSpecialSkills[idx][field] = target.value;
          recalcSpecialSkillTotals();
          recalcSpecialPoints();
          updateChatPaletteText();
          saveToLS();
        }
        return;
      }

      /* Magic category select */
      if (target.dataset.magicField !== undefined) {
        const idx = parseInt(target.dataset.magicIdx);
        const field = target.dataset.magicField;
        if (charData.uniqueMagic[idx]) {
          charData.uniqueMagic[idx][field] = target.value;
          saveToLS();
        }
        return;
      }

      /* Weapon type select */
      if (target.dataset.weaponField !== undefined) {
        const idx = parseInt(target.dataset.weaponIdx);
        const field = target.dataset.weaponField;
        if (charData.weapons[idx]) {
          charData.weapons[idx][field] = target.value;
          saveToLS();
        }
        return;
      }

      onFormChange();
    });

    /* ── Click events (buttons) ── */
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button') || e.target.closest('.btn-bonus-adjust') || e.target.closest('[data-roll-stat]');
      if (!btn) return;

      /* Bonus button adjuster */
      if (btn.classList.contains('btn-bonus-adjust')) {
        const targetId = btn.dataset.adjustTarget;
        const dir = btn.dataset.adjustDir;
        const input = document.getElementById(targetId);
        if (input) {
          let val = parseInt(input.value) || 0;
          val = dir === 'up' ? val + 1 : val - 1;
          input.value = val;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }

      /* Roll individual stat */
      if (btn.dataset.rollStat) {
        const key = btn.dataset.rollStat;
        const val = MagicStart.rollStat();
        charData.stats[key] = val;
        charData.randomRollCount = (charData.randomRollCount || 0) + 1;
        if (charData.statSources) {
          charData.statSources[key] = 'dice';
        }
        document.getElementById(`stat-${key}`).value = val;
        recalcAll();
        saveToLS();
        return;
      }

      /* Remove magic */
      if (btn.dataset.removeMagic !== undefined) {
        removeUniqueMagic(parseInt(btn.dataset.removeMagic));
        return;
      }

      /* Remove custom special skill */
      if (btn.dataset.removeCustomSskill !== undefined) {
        removeCustomSpecialSkill(parseInt(btn.dataset.removeCustomSskill));
        return;
      }

      /* Remove weapon */
      if (btn.dataset.removeWeapon !== undefined) {
        removeWeapon(parseInt(btn.dataset.removeWeapon));
        return;
      }

      /* Specific buttons by ID */
      switch (btn.id) {
        case 'btn-roll-all-stats': {
          const stats = MagicStart.rollAllStats();
          Object.assign(charData.stats, stats);
          charData.randomRollCount = (charData.randomRollCount || 0) + 1;
          MagicStart.STAT_KEYS.forEach(k => {
            document.getElementById(`stat-${k}`).value = stats[k];
            if (charData.statSources) {
              charData.statSources[k] = 'dice';
            }
          });
          /* Auto-calc HP */
          charData.hp = MagicStart.calcHP(stats.strength);
          document.getElementById('stat-hp').value = charData.hp;
          recalcAll();
          saveToLS();
          showToast('全ステータスをランダム生成しました');
          break;
        }

        case 'btn-calc-hp': {
          const hp = MagicStart.calcHP(charData.stats.strength);
          charData.hp = hp;
          document.getElementById('stat-hp').value = hp;
          updateHPMax();
          saveToLS();
          showToast(`HP = ${charData.stats.strength} + 50 = ${hp}`);
          break;
        }

        case 'btn-roll-mp': {
          const mp = MagicStart.rollMP(charData.type);
          charData.mp = mp;
          charData.randomRollCount = (charData.randomRollCount || 0) + 1;
          document.getElementById('stat-mp').value = mp;
          updateMPMax();
          saveToLS();
          const formula = charData.type === 'ancestor' ? '1d100+20' : '1d100-1';
          showToast(`MP (${formula}) = ${mp}`);
          break;
        }

        case 'btn-roll-emotion': {
          const emo = MagicStart.rollEmotion();
          charData.emotion = emo;
          charData.randomRollCount = (charData.randomRollCount || 0) + 1;
          document.getElementById('stat-emotion').value = emo;
          saveToLS();
          showToast(`感情値 (10d6) = ${emo}`);
          break;
        }

        case 'btn-roll-magic-pool': {
          const pool = MagicStart.rollMagicAptitude();
          charData.magicAptitudePool = pool;
          charData.randomRollCount = (charData.randomRollCount || 0) + 1;
          charData.magicSource = 'dice';
          document.getElementById('magic-pool').value = pool;
          recalcMagicPoints();
          saveToLS();
          showToast(`基礎魔法適性 (1d100) = ${pool}`);
          break;
        }

        case 'btn-add-magic':
          addUniqueMagic();
          break;

        case 'btn-add-custom-sskill':
          addCustomSpecialSkill();
          break;

        case 'btn-add-weapon':
          addWeapon();
          break;

        case 'btn-toggle-growth':
          toggleGrowth();
          break;

        case 'btn-theme':
          toggleTheme();
          break;

        case 'btn-upload-image':
          document.getElementById('image-file-input').click();
          break;

        case 'btn-remove-image':
          charData.imageData = null;
          document.getElementById('image-preview-img').style.display = 'none';
          document.getElementById('image-preview').classList.remove('has-image');
          btn.style.display = 'none';
          document.getElementById('image-file-input').value = '';
          saveToLS();
          showToast('画像を削除しました');
          break;

        case 'btn-preview-sheet': {
          syncFormToData();
          const mode = document.querySelector('input[name="sheet-mode"]:checked').value;
          showToast('プレビューを生成中...');
          SheetRenderer.renderToImage(charData, mode)
            .then(dataUrl => {
              const previewImg = document.getElementById('sheet-preview-image');
              const previewContainer = document.getElementById('sheet-preview-container');
              if (previewImg && previewContainer) {
                previewImg.src = dataUrl;
                previewContainer.style.display = 'block';
                showToast('プレビューを作成しました');
                previewContainer.scrollIntoView({ behavior: 'smooth' });
              }
            })
            .catch(err => showToast('プレビュー生成に失敗しました: ' + err.message, 'error'));
          break;
        }

        case 'btn-download-sheet': {
          syncFormToData();
          const mode = document.querySelector('input[name="sheet-mode"]:checked').value;
          showToast('シートを生成中...');
          SheetRenderer.downloadPNG(charData, mode)
            .then(() => showToast('シートをダウンロードしました'))
            .catch(err => showToast('シート生成に失敗しました: ' + err.message, 'error'));
          break;
        }

        case 'btn-generate-palette': {
          syncFormToData();
          updateChatPaletteText();
          const card = document.getElementById('ccf-palette-card');
          if (card) {
            card.style.display = 'flex';
            showToast('チャットパレットを生成しました');
            card.scrollIntoView({ behavior: 'smooth' });
          }
          break;
        }

        case 'btn-copy-palette': {
          const el = document.getElementById('ccf-palette-text');
          if (el) {
            navigator.clipboard.writeText(el.value)
              .then(() => showToast('チャットパレットをクリップボードにコピーしました'))
              .catch(() => {
                el.select();
                document.execCommand('copy');
                showToast('チャットパレットをクリップボードにコピーしました');
              });
          }
          break;
        }

        case 'btn-ccf-clipboard': {
          syncFormToData();
          Cocofolia.copyToClipboard(charData)
            .then(() => showToast('ココフォリアデータをクリップボードにコピーしました'))
            .catch(err => showToast('コピーに失敗しました: ' + err.message, 'error'));
          break;
        }

        case 'btn-ccf-download': {
          syncFormToData();
          Cocofolia.downloadJSON(charData);
          showToast('ココフォリアJSONをダウンロードしました');
          break;
        }

        case 'btn-save-json':
          saveJSON();
          break;

        case 'btn-load-json':
          document.getElementById('json-file-input').click();
          break;

        case 'btn-reset':
          if (confirm('全てのデータをリセットしますか?')) {
            const presetBackup = typeof Preset !== 'undefined' ? Preset.getPresetData() : null;
            charData = MagicStart.createDefault();
            charData.randomRollCount = 0;
            clearLS();
            if (presetBackup) {
              Preset.applyPreset(presetBackup);
            }
            syncDataToForm();
            showToast('リセットしました');
          }
          break;
      }
    });

    /* ── Image preview click = trigger upload ── */
    document.getElementById('image-preview').addEventListener('click', () => {
      document.getElementById('image-file-input').click();
    });

    /* ── Image file input ── */
    document.getElementById('image-file-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await ImageProcessor.processFile(file);
        charData.imageData = dataUrl;
        const imgEl = document.getElementById('image-preview-img');
        imgEl.src = dataUrl;
        imgEl.style.display = 'block';
        document.getElementById('image-preview').classList.add('has-image');
        document.getElementById('btn-remove-image').style.display = '';
        saveToLS();
        showToast('画像を読み込みました');
      } catch (err) {
        showToast('画像の処理に失敗しました: ' + err.message, 'error');
      }
    });

    /* ── JSON file input ── */
    document.getElementById('json-file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          charData = mergeDefaults(MagicStart.createDefault(), parsed);
          syncDataToForm();
          saveToLS();
          showToast('JSONファイルを読み込みました');
        } catch (err) {
          showToast('JSONの読み込みに失敗しました', 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  /* ──────────────────────────────────────
     JSON Export
     ────────────────────────────────────── */
  function saveJSON() {
    syncFormToData();
    const json = JSON.stringify(charData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${charData.name || 'character'}_data.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('JSONファイルを保存しました');
  }

  /* ──────────────────────────────────────
     Utility
     ────────────────────────────────────── */
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ──────────────────────────────────────
     Init
     ────────────────────────────────────── */
  function init() {
    initTheme();
    initGrowthToggle();

    /* Build static grids */
    buildStatsGrid();
    buildSpecialSkillsGrid();
    buildBasicMagicGrid();

    /* Load saved data or start fresh */
    loadFromLS();
    syncDataToForm();

    if (typeof Preset !== 'undefined') {
      Preset.init();
    }

    /* Bind events */
    bindEvents();
  }

  /* Start when DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    charData: () => charData,
    showToast,
    recalcAll,
    recalcMagicPoints,
    saveToLS,
    syncDataToForm
  };
})();
