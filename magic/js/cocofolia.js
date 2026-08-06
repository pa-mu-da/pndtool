/**
 * Cocofolia (CCFOLIA) Token Data Generator
 *
 * Generates JSON conforming to the Cocofolia Clipboard API v1.19.0.
 * - Chat palette with all skills as 1d100<=XX SkillName
 * - Status with HP and MP (max = current)
 * - Params with all 7 base stats
 */
const Cocofolia = (() => {
  'use strict';

  /**
   * Build the chat palette string (commands).
   * Each line: 1d100<=VALUE SKILL_NAME
   * Lines are joined with \n (newline character).
   */
  function buildChatPalette(charData) {
    const lines = [];
    const stats = charData.stats;

    /* ── Combat Skills ── */
    lines.push('// --- 戦闘技能 ---');
    const combat = MagicStart.getCombatSkills(stats, charData.combatSkillBonuses);
    combat.forEach(s => {
      lines.push(`1d100<=${s.value} ${s.label}`);
    });

    /* ── Exploration Skills ── */
    lines.push('// --- 探索技能 ---');
    const explore = MagicStart.getExplorationSkills(stats, charData.exploreSkillBonuses);
    explore.forEach(s => {
      lines.push(`1d100<=${s.value} ${s.label}`);
    });

    /* ── Special Skills (only if allocated > 0) ── */
    const specials = MagicStart.getSpecialSkillTotals(charData.specialSkills, stats, charData.specialSkillBonuses);
    const activeSpecials = specials.filter(s => s.base > 0).map(s => ({ label: s.label, total: s.total }));

    const customSpecials = MagicStart.getCustomSpecialSkillTotals(charData.customSpecialSkills || [], stats);
    const activeCustomSpecials = customSpecials.filter(s => s.base > 0 && s.name.trim() !== '').map(s => ({ label: s.name, total: s.total }));

    const allActiveSpecials = [...activeSpecials, ...activeCustomSpecials];

    if (allActiveSpecials.length > 0) {
      lines.push('// --- 特殊技能 ---');
      allActiveSpecials.forEach(s => {
        lines.push(`1d100<=${s.total} ${s.label}`);
      });
    }

    /* ── Emotion check ── */
    lines.push('// --- 感情値 ---');
    lines.push(`1d100<=${charData.emotion} 感情値判定`);

    /* ── Basic Magic ── */
    lines.push('// --- 基礎魔法判定 ---');
    lines.push(`1d100<=${stats.accuracy + 50} 熱魔法判定`);
    lines.push(`1d100<=${stats.accuracy + 50} 身体強化判定`);
    lines.push(`1d100<=${stats.accuracy + 50} 操作魔法判定`);

    /* ── Damage rolls ── */
    lines.push('// --- ダメージ ---');
    const halfStr = Math.floor(stats.strength / 2);
    lines.push(`${halfStr} 拳ダメージ(筋力x1/2)`);
    lines.push(`${stats.strength} 蹴りダメージ(筋力)`);

    return lines.join('\n');
  }

  /**
   * Build memo text for the token.
   */
  function buildMemo(charData) {
    const parts = [];
    parts.push(`キャラクター名: ${charData.name || '名無し'}`);
    parts.push(`種別: ${charData.type === 'ancestor' ? '始祖' : '眷属'}`);
    return parts.join('\n');
  }

  /**
   * Generate the full Cocofolia character JSON object.
   */
  function generate(charData) {
    const stats = charData.stats;
    return {
      kind: 'character',
      data: {
        name: charData.name || '名無し',
        memo: buildMemo(charData),
        initiative: stats.agility,
        externalUrl: '',
        status: [
          { label: 'HP', value: charData.hp },
          { label: 'MP', value: charData.mp },
          { label: '感情値', value: charData.emotion },
        ],
        params: [
          { label: '筋力',   value: String(stats.strength) },
          { label: '正確性', value: String(stats.accuracy) },
          { label: '俊敏性', value: String(stats.agility) },
          { label: '知識',   value: String(stats.knowledge) },
          { label: '思考力', value: String(stats.thinking) },
          { label: '容姿',   value: String(stats.appearance) },
          { label: '幸運',   value: String(stats.luck) },
        ],
        commands: buildChatPalette(charData),
        width: 4,
        height: 4,
        active: true,
        secret: false,
        invisible: false,
        hideStatus: false,
        color: '#6B5CE7',
      },
    };
  }

  /**
   * Copy Cocofolia JSON to clipboard.
   */
  async function copyToClipboard(charData) {
    const json = JSON.stringify(generate(charData));
    await navigator.clipboard.writeText(json);
  }

  /**
   * Download Cocofolia JSON as file.
   */
  function downloadJSON(charData) {
    const json = JSON.stringify(generate(charData), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${charData.name || 'character'}_cocofolia.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { generate, copyToClipboard, downloadJSON, buildChatPalette };
})();
