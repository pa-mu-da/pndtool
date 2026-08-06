/**
 * Preset & Mode Management
 *
 * - Random / Fixed mode toggling for stats & magic aptitude
 * - GM preset URL generation & reading
 */
const Preset = (() => {
  'use strict';

  let presetData = null;

  /* ────────────────────────────────────── */
  /*  Init                                  */
  /* ────────────────────────────────────── */
  function init() {
    const preset = readURLParams();
    if (preset) {
      presetData = preset;
      applyPreset(preset);
    }
    initModeToggles();
    updateModeUI();
    initURLGenerator();
  }

  /* ────────────────────────────────────── */
  /*  URL Parameter Reading                 */
  /* ────────────────────────────────────── */
  function readURLParams() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('preset')) return null;
    return {
      type:           params.get('type') || 'ancestor',
      statMode:       params.get('statMode') || 'random',
      statPool:       parseInt(params.get('statPool')) || 140,
      magicMode:      params.get('magicMode') || 'random',
      magicPool:      parseInt(params.get('magicPool')) || 50,
      magicSlotsMode: params.get('magicSlotsMode') || 'none', // 'fixed' or 'none'
      magicSlots:     Math.min(6, Math.max(1, parseInt(params.get('magicSlots') ?? '2'))),
      memo:           params.get('memo') ? decodeURIComponent(params.get('memo')) : null,
    };
  }

  /* ────────────────────────────────────── */
  /*  Apply Preset                          */
  /* ────────────────────────────────────── */
  function applyPreset(preset) {
    const cd = App.charData();

    /* Memo pre-fill */
    if (preset.memo !== null) {
      cd.memo = preset.memo;
    }

    /* Type */
    cd.type = preset.type;
    const typeId = preset.type === 'ancestor' ? 'type-ancestor' : 'type-kin';
    const typeRadio = document.getElementById(typeId);
    if (typeRadio) typeRadio.checked = true;
    document.querySelectorAll('input[name="char-type"]').forEach(r => r.disabled = true);
    lockGroup(document.querySelector('#section-basic .radio-group'));

    /* Stat mode */
    cd.statMode = preset.statMode;
    if (preset.statMode === 'fixed') {
      cd.statPool = preset.statPool;
    }
    const smEl = document.getElementById('stat-mode-' + preset.statMode);
    if (smEl) smEl.checked = true;
    document.querySelectorAll('input[name="stat-mode"]').forEach(r => r.disabled = true);
    lockGroup(document.getElementById('stat-mode-toggle'));

    /* Magic mode */
    cd.magicMode = preset.magicMode;
    if (preset.magicMode === 'fixed') {
      cd.magicAptitudePool = preset.magicPool;
      const mp = document.getElementById('magic-pool');
      if (mp) { mp.value = preset.magicPool; mp.disabled = true; }
    }
    const mmEl = document.getElementById('magic-mode-' + preset.magicMode);
    if (mmEl) mmEl.checked = true;
    document.querySelectorAll('input[name="magic-mode"]').forEach(r => r.disabled = true);
    lockGroup(document.getElementById('magic-mode-toggle'));

    /* Unique Magic Slots Lock */
    if (preset.magicSlotsMode === 'fixed') {
      // Force unique magic array to match slot count
      while (cd.uniqueMagic.length < preset.magicSlots) {
        cd.uniqueMagic.push({ name: '', category: 'offensive', mpCost: 0, effect: '' });
      }
      if (cd.uniqueMagic.length > preset.magicSlots) {
        cd.uniqueMagic.splice(preset.magicSlots);
      }
      // Hide add button
      const addBtn = document.getElementById('btn-add-magic');
      if (addBtn) addBtn.style.display = 'none';
    }

    /* Show banner */
    document.getElementById('preset-banner').style.display = 'flex';

    // Synchronize to UI and save state
    App.syncDataToForm();
  }

  function lockGroup(el) {
    if (el) el.classList.add('preset-locked');
  }

  /* ────────────────────────────────────── */
  /*  Mode Toggles                          */
  /* ────────────────────────────────────── */
  function initModeToggles() {
    document.querySelectorAll('input[name="stat-mode"]').forEach(r => {
      r.addEventListener('change', e => handleStatModeChange(e.target.value));
    });
    document.querySelectorAll('input[name="magic-mode"]').forEach(r => {
      r.addEventListener('change', e => handleMagicModeChange(e.target.value));
    });
  }

  function handleStatModeChange(newMode) {
    const cd = App.charData();
    const oldMode = cd.statMode;
    if (newMode === oldMode) return;

    const label = newMode === 'fixed' ? '固定値割り振り' : 'ランダム (5d6)';
    if (!confirm(label + 'モードに切り替えます。\n現在の能力値とHPはリセットされます。よろしいですか?')) {
      document.getElementById('stat-mode-' + oldMode).checked = true;
      return;
    }

    cd.statMode = newMode;
    MagicStart.STAT_KEYS.forEach(k => {
      cd.stats[k] = 0;
      if (cd.statSources) {
        cd.statSources[k] = newMode === 'fixed' ? 'manual' : 'dice';
      }
      const el = document.getElementById('stat-' + k);
      if (el) el.value = 0;
    });
    cd.hp = MagicStart.calcHP(0);
    document.getElementById('stat-hp').value = cd.hp;

    updateModeUI();
    App.recalcAll();
    App.saveToLS();
    App.showToast(label + 'モードに切り替えました');
  }

  function handleMagicModeChange(newMode) {
    const cd = App.charData();
    const oldMode = cd.magicMode;
    if (newMode === oldMode) return;

    const label = newMode === 'fixed' ? '固定値' : 'ランダム (1d100)';
    if (!confirm(label + 'モードに切り替えます。\n基礎魔法の適性値と振り分けはリセットされます。よろしいですか?')) {
      document.getElementById('magic-mode-' + oldMode).checked = true;
      return;
    }

    cd.magicMode = newMode;
    cd.magicSource = newMode === 'fixed' ? 'manual' : 'dice';
    cd.magicAptitudePool = 0;
    cd.basicMagic.heat = 0;
    cd.basicMagic.bodyEnhance = 0;
    cd.basicMagic.manipulation = 0;

    document.getElementById('magic-pool').value = 0;
    Object.keys(MagicStart.BASIC_MAGIC_LABELS).forEach(k => {
      const el = document.getElementById('bmagic-' + k);
      if (el) el.value = 0;
    });

    updateModeUI();
    App.recalcMagicPoints();
    App.saveToLS();
    App.showToast(label + 'モードに切り替えました');
  }

  /* ────────────────────────────────────── */
  /*  Update UI based on mode               */
  /* ────────────────────────────────────── */
  function updateModeUI() {
    const cd = App.charData();

    /* Stats */
    const statMode = cd.statMode || 'random';
    const statsSection = document.getElementById('section-stats');
    if (statsSection) statsSection.setAttribute('data-mode', statMode);

    const smRadio = document.getElementById('stat-mode-' + statMode);
    if (smRadio) smRadio.checked = true;

    const rTool = document.getElementById('stat-toolbar-random');
    const fTool = document.getElementById('stat-toolbar-fixed');
    if (rTool) rTool.style.display = statMode === 'random' ? '' : 'none';
    if (fTool) fTool.style.display = statMode === 'fixed'  ? '' : 'none';

    /* Update fixed pool display */
    const poolDisplay = document.getElementById('stat-pool-display');
    if (poolDisplay) poolDisplay.textContent = cd.statPool || MagicStart.STAT_POOL;

    /* Magic */
    const magicMode = cd.magicMode || 'random';
    const magicSection = document.getElementById('section-magic');
    if (magicSection) magicSection.setAttribute('data-mode', magicMode);

    const mmRadio = document.getElementById('magic-mode-' + magicMode);
    if (mmRadio) mmRadio.checked = true;

    const rollBtn = document.getElementById('btn-roll-magic-pool');
    if (rollBtn) rollBtn.style.display = magicMode === 'random' ? '' : 'none';
  }

  /* ────────────────────────────────────── */
  /*  URL Generator                         */
  /* ────────────────────────────────────── */
  function initURLGenerator() {
    /* Show / hide pool inputs */
    document.querySelectorAll('input[name="url-stat-mode"]').forEach(r => {
      r.addEventListener('change', e => {
        const row = document.getElementById('url-stat-pool-row');
        if (row) row.style.display = e.target.value === 'fixed' ? '' : 'none';
      });
    });
    document.querySelectorAll('input[name="url-magic-mode"]').forEach(r => {
      r.addEventListener('change', e => {
        const row = document.getElementById('url-magic-pool-row');
        if (row) row.style.display = e.target.value === 'fixed' ? '' : 'none';
      });
    });
    document.querySelectorAll('input[name="url-magic-slots-mode"]').forEach(r => {
      r.addEventListener('change', e => {
        const row = document.getElementById('url-magic-slots-count-row');
        if (row) row.style.display = e.target.value === 'fixed' ? 'flex' : 'none';
      });
    });

    const genBtn = document.getElementById('btn-generate-url');
    if (genBtn) genBtn.addEventListener('click', generatePresetURL);

    const copyBtn = document.getElementById('btn-copy-url');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = document.getElementById('url-output-text').value;
        navigator.clipboard.writeText(text)
          .then(() => App.showToast('URLをコピーしました'))
          .catch(() => {
            document.getElementById('url-output-text').select();
            document.execCommand('copy');
            App.showToast('URLをコピーしました');
          });
      });
    }

    const clearBtn = document.getElementById('btn-clear-preset');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        presetData = null;
        document.getElementById('preset-banner').style.display = 'none';
        document.querySelectorAll('.preset-locked').forEach(el => el.classList.remove('preset-locked'));
        document.querySelectorAll('input[name="char-type"], input[name="stat-mode"], input[name="magic-mode"]')
          .forEach(r => r.disabled = false);
        const mp = document.getElementById('magic-pool');
        if (mp) mp.disabled = false;
        
        // Re-display magic add button
        const addBtn = document.getElementById('btn-add-magic');
        if (addBtn) addBtn.style.display = '';

        window.history.replaceState({}, '', window.location.pathname);
        App.showToast('プリセットを解除しました');

        // Re-synchronize data to form (will restore delete buttons)
        App.syncDataToForm();
      });
    }
  }

  function generatePresetURL() {
    const type      = document.querySelector('input[name="url-type"]:checked')?.value || 'ancestor';
    const statMode  = document.querySelector('input[name="url-stat-mode"]:checked')?.value || 'random';
    const statPool  = parseInt(document.getElementById('url-stat-pool')?.value) || 140;
    const magicMode = document.querySelector('input[name="url-magic-mode"]:checked')?.value || 'random';
    const magicPool = parseInt(document.getElementById('url-magic-pool')?.value) || 50;
    const slotsMode = document.querySelector('input[name="url-magic-slots-mode"]:checked')?.value || 'none';
    const slotsCount = Math.min(6, Math.max(1, parseInt(document.getElementById('url-magic-slots')?.value) || 2));
    const memoText   = document.getElementById('url-memo')?.value || '';

    const base = window.location.href.split('?')[0];
    const p = new URLSearchParams();
    p.set('preset', '1');
    p.set('type', type);
    p.set('statMode', statMode);
    if (statMode === 'fixed') p.set('statPool', String(statPool));
    p.set('magicMode', magicMode);
    if (magicMode === 'fixed') p.set('magicPool', String(magicPool));
    
    p.set('magicSlotsMode', slotsMode);
    if (slotsMode === 'fixed') p.set('magicSlots', String(slotsCount));
    if (memoText.trim()) p.set('memo', encodeURIComponent(memoText.trim()));

    const url = base + '?' + p.toString();
    document.getElementById('url-output-text').value = url;
    document.getElementById('url-output').style.display = '';
    App.showToast('プリセットURLを生成しました');
  }

  /* ────────────────────────────────────── */
  /*  Public API                            */
  /* ────────────────────────────────────── */
  function getMaxMagicSlots() {
    if (presetData) {
      if (presetData.magicSlotsMode === 'fixed') {
        return presetData.magicSlots;
      }
    }
    return MagicStart.MAX_UNIQUE_MAGIC;
  }

  function isPreset() {
    return presetData !== null;
  }

  function getEffectiveStatPool(charData) {
    return charData.statPool || MagicStart.STAT_POOL;
  }

  function getPresetData() {
    return presetData;
  }

  return { init, updateModeUI, getMaxMagicSlots, isPreset, getEffectiveStatPool, getPresetData, applyPreset };
})();
