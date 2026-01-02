// src/data/constants.js
import rawChampionList from './champions.json'; // Make sure this path matches your json file

export const championList = rawChampionList;

export const SIDES = { BLUE: 'BLUE', RED: 'RED' };
export const MAP_LANES = ['TOP', 'MID', 'BOT'];

export const SIM_CONSTANTS = {
  WEIGHTS: { STATS: 0.55, META: 0.25, MASTERY: 0.20 },
  META_COEFF: {
    STANDARD: { 1: 1.0, 2: 0.95, 3: 0.90, 4: 0.85, 5: 0.80 },
    ADC: { 1: 1.0, 2: 0.95, 3: 0.90, 4: 0.85, 5: 0.80 }
  },
  OTP_SCORE_THRESHOLD: 80,
  OTP_TIER_BOOST: 2,
  VAR_RANGE: 0.12,
  DIFFICULTY_MULTIPLIERS: {
    easy: 0.8, normal: 1.0, hard: 1.05, insane: 1.1    
  },
  POSITION_WEIGHTS: {
      EARLY: { TOP: 0.25, JGL: 0.30, MID: 0.30, ADC: 0.10, SUP: 0.05 },
      MID:   { TOP: 0.20, JGL: 0.25, MID: 0.25, ADC: 0.20, SUP: 0.10 },
      LATE:  { TOP: 0.15, JGL: 0.20, MID: 0.25, ADC: 0.30, SUP: 0.10 }
  },
  BASE_INCOME: {
      XP:   { TOP: 475, JGL: 460, MID: 475, ADC: 450, SUP: 350 },
      GOLD: { TOP: 375, JGL: 325, MID: 425, ADC: 455, SUP: 260 }
  }
};

export const GAME_RULES = {
  CHAMPION_CLASSES: {
    ASSASSIN: '암살자', FIGHTER: '전사', MAGE: '마법사',
    MARKSMAN: '원거리', TANK: '탱커', SUPPORT: '서포터',
  },
  DRAGON_BUFFS: {
    '화염': { '원거리': 0.03, '마법사': 0.03, '전사': 0.05, '탱커': 0.01, '서포터': 0.01, '암살자': 0.01 },
    '대지': { '탱커': 0.03, '전사': 0.02, '서포터': 0.02, '원거리': 0.01, '마법사': 0.01, '암살자': 0.01 },
    '바람': { '암살자': 0.04, '탱커': 0.02, '서포터': 0.02, '전사': 0.01, '원거리': 0.05, '마법사': 0.05 },
    '바다': { '탱커': 0.03, '전사': 0.03, '마법사': 0.015, '서포터': 0.015, '암살자': 0.01, '원거리': 0.01 },
    '마법공학': { '원거리': 0.03, '마법사': 0.02, '암살자': 0.015, '전사': 0.015, '탱커': 0.01, '서포터': 0.01 },
    '화학공학': { '전사': 0.04, '탱커': 0.03, '서포터': 0.02, '암살자': 0.01, '원거리': 0.01, '마법사': 0.01 },
  },
  DRAGON_SOULS: {
    '화염': { '원거리': 0.25, '마법사': 0.25, '암살자': 0.22, '전사': 0.15, '탱커': 0.08, '서포터': 0.08 },
    '대지': { '탱커': 0.25, '전사': 0.22, '원거리': 0.15, '마법사': 0.15, '암살자': 0.12, '서포터': 0.10 },
    '바람': { '전사': 0.22, '탱커': 0.22, '암살자': 0.20, '서포터': 0.15, '원거리': 0.12, '마법사': 0.12 },
    '바다': { '전사': 0.25, '탱커': 0.25, '마법사': 0.18, '원거리': 0.15, '서포터': 0.10, '암살자': 0.05 },
    '마법공학': { '원거리': 0.24, '마법사': 0.20, '전사': 0.20, '탱커': 0.15, '암살자': 0.15, '서포터': 0.10 },
    '화학공학': { '전사': 0.28, '탱커': 0.22, '암살자': 0.15, '원거리': 0.10, '마법사': 0.10, '서포터': 0.10 },
  },
  COUNTERS: {
    '마법사': ['탱커', '전사'], '원거리': ['탱커', '전사'],
    '탱커': ['암살자'], '전사': ['암살자'], '암살자': ['마법사', '원거리'],
  },
  DEFAULT_ROLES: {
    TOP: '전사', JGL: '전사', MID: '마법사', ADC: '원거리', SUP: '서포터',
  },
  WEIGHTS: {
    PHASE: {
      EARLY: { laning: 0.45, mechanics: 0.30, growth: 0.15, stability: 0.10, macro: 0, teamfight: 0 },
      MID: { macro: 0.35, growth: 0.25, mechanics: 0.20, stability: 0.10, teamfight: 0.10, laning: 0 },
      LATE: { teamfight: 0.45, stability: 0.25, mechanics: 0.20, macro: 0.10, laning: 0, growth: 0 },
    },
  },
  OBJECTIVES: {
    GRUBS: { time: 7, count: 3, gold: 300 }, 
    HERALD: { time: 15, gold: 300 },
    BARON: { spawn: 20, duration: 3, gold: 1500, combat_bonus: 1.3 }, 
    ELDER: { spawn_after_soul: 6, duration: 3, combat_bonus: 1.6 },
    DRAGON: { initial_spawn: 5, respawn: 5, gold: 100 },
    PLATES: { start_time: 4, end_time: 14, count: 6 }
  },
  GOLD: {
    START: 500, KILL: 300, ASSIST: 150, 
    TURRET: { 
        OUTER_PLATE: { local: 250, team: 50 },
        INNER_MID: { local: 425, team: 25 },
        INNER_SIDE: { local: 675, team: 25 }, 
        INHIB_TURRET: { local: 375, team: 25 }
    },
  },
};

export const DRAFT_SEQUENCE = [
  { type: 'BAN', side: 'BLUE', label: '블루 1밴', order: 1 },
  { type: 'BAN', side: 'RED', label: '레드 1밴', order: 2 },
  { type: 'BAN', side: 'BLUE', label: '블루 2밴', order: 3 },
  { type: 'BAN', side: 'RED', label: '레드 2밴', order: 4 },
  { type: 'BAN', side: 'BLUE', label: '블루 3밴', order: 5 },
  { type: 'BAN', side: 'RED', label: '레드 3밴', order: 6 },
  { type: 'PICK', side: 'BLUE', label: '블루 1픽', order: 7 },
  { type: 'PICK', side: 'RED', label: '레드 1픽', order: 8 },
  { type: 'PICK', side: 'RED', label: '레드 2픽', order: 9 },
  { type: 'PICK', side: 'BLUE', label: '블루 2픽', order: 10 },
  { type: 'PICK', side: 'BLUE', label: '블루 3픽', order: 11 },
  { type: 'PICK', side: 'RED', label: '레드 3픽', order: 12 },
  { type: 'BAN', side: 'RED', label: '레드 4밴', order: 13 },
  { type: 'BAN', side: 'BLUE', label: '블루 4밴', order: 14 },
  { type: 'BAN', side: 'RED', label: '레드 5밴', order: 15 },
  { type: 'BAN', side: 'BLUE', label: '블루 5밴', order: 16 },
  { type: 'PICK', side: 'RED', label: '레드 4픽', order: 17 },
  { type: 'PICK', side: 'BLUE', label: '블루 4픽', order: 18 },
  { type: 'PICK', side: 'BLUE', label: '블루 5픽', order: 19 },
  { type: 'PICK', side: 'RED', label: '레드 5픽', order: 20 }
];

export const difficulties = [
  { value: 'easy', label: '쉬움', color: 'green' },
  { value: 'normal', label: '보통', color: 'blue' },
  { value: 'hard', label: '어려움', color: 'orange' },
  { value: 'insane', label: '극악', color: 'red' },
];