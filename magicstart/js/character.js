/**
 * Magic start! Character Data Model & Calculations
 */
const MagicStart = (() => {
  'use strict';

  /* ── Dice helpers ── */
  function rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
  }

  function rollDice(count, sides) {
    let total = 0;
    for (let i = 0; i < count; i++) total += rollDie(sides);
    return total;
  }

  /* ── Stat labels (Japanese) ── */
  const STAT_LABELS = {
    strength:   '筋力',
    accuracy:   '正確性',
    agility:    '俊敏性',
    knowledge:  '知識',
    thinking:   '思考力',
    appearance: '容姿',
    luck:       '幸運',
  };

  const STAT_KEYS = Object.keys(STAT_LABELS);

  const SPECIAL_SKILL_DEFS = [
    { key: 'disguise',    label: '変装',   bonus: null },
    { key: 'voiceChange', label: '変声',   bonus: 'accuracy' },
    { key: 'negotiation', label: '交渉',   bonus: null },
    { key: 'authority',   label: '権威',   bonus: null },
    { key: 'charm',       label: '魅了',   bonus: 'appearance' },
    { key: 'psychology',  label: '心理学', bonus: 'thinking' },
    { key: 'theft',       label: '盗み',   bonus: 'accuracy' },
    { key: 'shooting',    label: '射撃',   bonus: null },
    { key: 'jump',        label: '跳躍',   bonus: 'strength' },
  ];

  const BASIC_MAGIC_LABELS = {
    heat:         '熱魔法',
    bodyEnhance:  '身体強化魔法',
    manipulation: '操作魔法',
  };

  const UNIQUE_MAGIC_CATEGORIES = [
    { value: '1',  label: 'No.1 変身魔法' },
    { value: '2',  label: 'No.2 変化魔法' },
    { value: '3',  label: 'No.3 創造魔法' },
    { value: '4',  label: 'No.4 命令魔法' },
    { value: '5',  label: 'No.5 回復魔法' },
    { value: '6',  label: 'No.6 光魔法' },
    { value: '7',  label: 'No.7 結界魔法' },
    { value: '8',  label: 'No.8 異常発達' },
    { value: '9',  label: 'No.9 冒涜者' },
    { value: '10', label: 'No.10 召喚魔法' },
  ];

  const MAX_UNIQUE_MAGIC = 6;
  const MAX_WEAPONS = 6;
  const STAT_POOL = 140;
  const SPECIAL_SKILL_POOL = 100;

  /* ── Default data ── */
  function createDefault() {
    return {
      name: '',
      type: 'ancestor',   // 'ancestor'=始祖, 'kin'=眷属
      imageData: null,     // base64 data-url
      memo: '',
      statMode: 'random',  // 'random' or 'fixed'
      statPool: 140,
      magicMode: 'random', // 'random' or 'fixed'
      randomRollCount: 0,
      statSources: {
        strength: 'dice',
        accuracy: 'dice',
        agility: 'dice',
        knowledge: 'dice',
        thinking: 'dice',
        appearance: 'dice',
        luck: 'dice',
      },
      magicSource: 'dice', // 'dice' or 'manual'

      stats: {
        strength: 0,
        accuracy: 0,
        agility: 0,
        knowledge: 0,
        thinking: 0,
        appearance: 0,
        luck: 0,
      },

      combatSkillBonuses: {
        fist: 0,
        kick: 0,
        dodge: 0,
        counter: 0,
        parry: 0,
      },
      exploreSkillBonuses: {
        observe: 0,
        analyze: 0,
        luck: 0,
        know: 0,
        senses: 0,
        track: 0,
      },

      emotion: 0,
      mp: 0,
      hp: 0,

      specialSkills: {
        disguise: 0,
        voiceChange: 0,
        negotiation: 0,
        authority: 0,
        charm: 0,
        psychology: 0,
        theft: 0,
        shooting: 0,
        jump: 0,
      },
      specialSkillBonuses: {
        disguise: 0,
        voiceChange: 0,
        negotiation: 0,
        authority: 0,
        charm: 0,
        psychology: 0,
        theft: 0,
        shooting: 0,
        jump: 0,
      },
      customSpecialSkills: [],

      magicAptitudePool: 0,
      basicMagic: {
        heat: 0,
        bodyEnhance: 0,
        manipulation: 0,
      },

      uniqueMagic: [],
      weapons: [],
    };
  }

  /* ── Random generators ── */
  function rollStat() { return rollDice(5, 6); }            // 5d6 → 5‒30
  function rollEmotion() { return rollDice(10, 6); }        // 10d6 → 10‒60
  function rollMPAncestor() { return rollDice(1, 100) + 20; } // 1d100+20 → 21‒120
  function rollMPKin() { return rollDice(1, 100) - 1; }       // 1d100-1 → 0‒99
  function rollMagicAptitude() { return rollDice(1, 100); }    // 1d100

  function rollAllStats() {
    const s = {};
    STAT_KEYS.forEach(k => { s[k] = rollStat(); });
    return s;
  }

  function rollMP(type) {
    return type === 'ancestor' ? rollMPAncestor() : rollMPKin();
  }

  /* ── Derived calculations ── */
  function calcHP(strength) { return strength + 50; }

  function getCombatSkills(stats, bonuses = {}) {
    const a = stats.accuracy;
    const ag = stats.agility;
    const fistBonus = bonuses.fist || 0;
    const kickBonus = bonuses.kick || 0;
    const dodgeBonus = bonuses.dodge || 0;
    const counterBonus = bonuses.counter || 0;
    const parryBonus = bonuses.parry || 0;

    return [
      { key: 'fist',    label: '拳',         value: a + 60 + fistBonus,                 damage: '筋力x1/2', range: 1 },
      { key: 'kick',    label: '蹴り',       value: a + 30 + kickBonus,                 damage: '筋力',     range: 1 },
      { key: 'dodge',   label: '回避',       value: Math.min(a + ag, 90) + dodgeBonus,   damage: null,        range: null },
      { key: 'counter', label: 'カウンター', value: Math.min(a, 90) + counterBonus,        damage: '相手攻撃x1/2', range: 1 },
      { key: 'parry',   label: '弾き',       value: a + parryBonus,                      damage: null,        range: null },
    ];
  }

  function getExplorationSkills(stats, bonuses = {}) {
    const observeBonus = bonuses.observe || 0;
    const analyzeBonus = bonuses.analyze || 0;
    const luckBonus = bonuses.luck || 0;
    const knowBonus = bonuses.know || 0;
    const sensesBonus = bonuses.senses || 0;
    const trackBonus = bonuses.track || 0;

    return [
      { key: 'observe', label: '観察', value: stats.accuracy + 40 + observeBonus },
      { key: 'analyze', label: '分析', value: stats.thinking + 30 + analyzeBonus },
      { key: 'luck',    label: '幸運', value: stats.luck + luckBonus },
      { key: 'know',    label: '知識', value: stats.knowledge * 3 + knowBonus },
      { key: 'senses',  label: '五感', value: stats.accuracy * 3 + sensesBonus },
      { key: 'track',   label: '追跡', value: stats.agility + stats.accuracy + stats.luck + trackBonus },
    ];
  }

  function getSpecialSkillTotals(baseSkills, stats, bonuses = {}) {
    const result = [];
    SPECIAL_SKILL_DEFS.forEach(def => {
      const base = baseSkills[def.key] || 0;
      const bonus = def.bonus ? (stats[def.bonus] || 0) : 0;
      const extraBonus = bonuses[def.key] || 0;
      result.push({
        key: def.key,
        label: def.label,
        base,
        bonus,
        bonusStat: def.bonus ? STAT_LABELS[def.bonus] : null,
        extraBonus,
        total: base + bonus + extraBonus,
      });
    });
    return result;
  }

  function getCustomSpecialSkillTotals(customSkills = [], stats) {
    return customSkills.map((s, index) => {
      const base = s.base || 0;
      const bonusStat = s.bonusStat && s.bonusStat !== 'none' ? s.bonusStat : null;
      const statVal = bonusStat ? (stats[bonusStat] || 0) : 0;
      const bonus = s.bonus || 0;
      return {
        index,
        name: s.name || '',
        base,
        bonusStat: s.bonusStat || 'none',
        statVal,
        bonus,
        total: base + statVal + bonus,
      };
    });
  }

  function getSpecialSkillPointsUsed(baseSkills, customSkills = []) {
    let total = 0;
    Object.values(baseSkills).forEach(v => { total += (v || 0); });
    customSkills.forEach(s => { total += (s.base || 0); });
    return total;
  }

  function getBasicMagicPointsUsed(basicMagic) {
    return (basicMagic.heat || 0) + (basicMagic.bodyEnhance || 0) + (basicMagic.manipulation || 0);
  }

  function getStatPointsUsed(stats) {
    let total = 0;
    STAT_KEYS.forEach(k => { total += (stats[k] || 0); });
    return total;
  }

  /* ── Public API ── */
  return {
    rollDice,
    rollDie,
    rollStat,
    rollEmotion,
    rollMP,
    rollMagicAptitude,
    rollAllStats,
    calcHP,
    getCombatSkills,
    getExplorationSkills,
    getSpecialSkillTotals,
    getCustomSpecialSkillTotals,
    getSpecialSkillPointsUsed,
    getBasicMagicPointsUsed,
    getStatPointsUsed,
    createDefault,
    STAT_LABELS,
    STAT_KEYS,
    SPECIAL_SKILL_DEFS,
    BASIC_MAGIC_LABELS,
    UNIQUE_MAGIC_CATEGORIES,
    MAX_UNIQUE_MAGIC,
    MAX_WEAPONS,
    STAT_POOL,
    SPECIAL_SKILL_POOL,
  };
})();
