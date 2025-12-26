import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import playerList from './data/players.json';
import championList from './data/champions.json';
// ★ 숙련도 데이터 import (경로가 정확해야 합니다)
import allMasteryRaw from './data/player_mastery/index'; 

// ==========================================
// 1. 데이터 전처리 (Data Pre-processing)
// ==========================================
// 배열 형태의 숙련도 데이터를 { "PlayerID": { ... } } 형태의 맵으로 변환 (검색 속도 최적화)
const MASTERY_MAP = (allMasteryRaw || []).reduce((acc, player) => {
  if (player.id) {
    acc[player.id] = player;
  }
  return acc;
}, {});

// ==========================================
// 2. 상수 및 설정 (Constants)
// ==========================================
const teams = [
  { id: 1, name: 'GEN', fullName: '젠지 (Gen.G)', power: 94, colors: { primary: '#D4AF37', secondary: '#000000' } },
  { id: 2, name: 'HLE', fullName: '한화생명 (HLE)', power: 93, colors: { primary: '#FF6B00', secondary: '#FFFFFF' } },
  { id: 3, name: 'KT', fullName: '케이티 (KT)', power: 87, colors: { primary: '#FF4444', secondary: '#FFFFFF' } },
  { id: 4, name: 'T1', fullName: '티원 (T1)', power: 93, colors: { primary: '#E2012E', secondary: '#000000' } },
  { id: 5, name: 'DK', fullName: '디플러스 기아 (DK)', power: 84, colors: { primary: '#00D9C4', secondary: '#FFFFFF' } },
  { id: 6, name: 'BNK', fullName: 'BNK 피어엑스 (BNK)', power: 82, colors: { primary: '#FFB800', secondary: '#000000' } },
  { id: 7, name: 'NS', fullName: '농심 레드포스 (NS)', power: 85, colors: { primary: '#DC143C', secondary: '#FFFFFF' } },
  { id: 8, name: 'BRO', fullName: '브리온 (BRO)', power: 79, colors: { primary: '#166534', secondary: '#FFFFFF' } },
  { id: 9, name: 'DRX', fullName: '디알엑스 (DRX)', power: 80, colors: { primary: '#3848A2', secondary: '#000000' } },
  { id: 10, name: 'DNS', fullName: 'DN 수퍼스 (DNS)', power: 82, colors: { primary: '#1E3A8A', secondary: '#FFFFFF' } },
];

const difficulties = [
  { value: 'easy', label: '쉬움', color: 'green' },
  { value: 'normal', label: '보통', color: 'blue' },
  { value: 'hard', label: '어려움', color: 'orange' },
  { value: 'insane', label: '극악', color: 'red' },
];

// 게임 룰 상수
const GAME_CONSTANTS = {
  PHASE: { EARLY: 14, MID: 25, LATE: 999 },
  DRAGONS: {
    TYPES: ['CLOUD', 'MOUNTAIN', 'INFERNAL', 'OCEAN', 'HEXTECH', 'CHEMTECH'],
    BUFFS: {
      CLOUD: { description: "이속 증가 및 둔화 저항" },
      MOUNTAIN: { description: "방어력 및 마법 저항력 증가" },
      INFERNAL: { description: "공격력 및 주문력 증가" },
      OCEAN: { description: "체력 지속 회복" },
      HEXTECH: { description: "스킬 가속 및 공속 증가" },
      CHEMTECH: { description: "강인함 및 체력 회복 효과" },
    }
  },
  ROLE_QUEST_BONUS: {
    TOP: { condition: 'LEVEL_16', effect: { splitPushPower: 1.5 } },
    MID: { condition: 'TIME_10', effect: { roamingSpeed: 1.4 } },
    ADC: { condition: 'FULL_ITEMS', effect: { damageMultiplier: 1.35 } }
  }
};

// 시뮬레이션 가중치 설정
const SIM_CONSTANTS = {
  WEIGHTS: { STATS: 0.55, META: 0.25, MASTERY: 0.20 },
  META_COEFF: {
    STANDARD: { 1: 1.0, 2: 0.95, 3: 0.90, 4: 0.85, 5: 0.80 },
    ADC:      { 1: 1.0, 2: 0.92, 3: 0.84 }
  },
  LOW_SAMPLE_THRESHOLD: 5,
  OTP_THRESHOLD: 90,
  OTP_TIER_BOOST: 2,
  VAR_RANGE: 0.12
};

// 재정 데이터 (임시)
const teamFinanceData = {
  "T1": { total_expenditure: 135.0, cap_expenditure: 76.0, luxury_tax: 9.0 },
  "GEN": { total_expenditure: 110.0, cap_expenditure: 64.5, luxury_tax: 6.125 },
  "HLE": { total_expenditure: 102.0, cap_expenditure: 94.5, luxury_tax: 17.25 },
  "KT": { total_expenditure: 48.0, cap_expenditure: 40.4, luxury_tax: 0.1 },
  "DK": { total_expenditure: 35.5, cap_expenditure: 26.5, luxury_tax: 0.0 },
  "NS": { total_expenditure: 51.0, cap_expenditure: 50.0, luxury_tax: 2.5 },
  "BNK": { total_expenditure: 15.5, cap_expenditure: 14.15, luxury_tax: 0.0 },
  "BRO": { total_expenditure: 16.0, cap_expenditure: 16.0, luxury_tax: 0.0 },
  "DRX": { total_expenditure: 19.0, cap_expenditure: 19.0, luxury_tax: 0.0 },
  "DNS": { total_expenditure: 29.5, cap_expenditure: 25.5, luxury_tax: 0.0 }
};

// ==========================================
// 3. 내부 로직 함수들 (Engine Functions)
// ==========================================

// --- 유틸리티 ---
const getLeagues = () => { const s = localStorage.getItem('lckgm_leagues'); return s ? JSON.parse(s) : []; };
const saveLeagues = (l) => localStorage.setItem('lckgm_leagues', JSON.stringify(l));
const addLeague = (l) => { const list = getLeagues(); list.push(l); saveLeagues(list); return list; };
const updateLeague = (id, u) => { 
  const leagues = getLeagues(); 
  const index = leagues.findIndex(l => l.id === id); 
  if (index !== -1) { leagues[index] = { ...leagues[index], ...u }; saveLeagues(leagues); return leagues[index]; }
  return null;
};
const deleteLeague = (id) => { const l = getLeagues().filter(x => x.id !== id); saveLeagues(l); return l; };
const getLeagueById = (id) => getLeagues().find(l => l.id === id);
const getTextColor = (hex) => { const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return (r*299+g*587+b*114)/1000>128?'#000000':'#FFFFFF'; };

// 스타일 관련
const getOvrBadgeStyle = (ovr) => {
  if (ovr >= 95) return 'bg-red-100 text-red-700 border-red-300 ring-red-200';
  if (ovr >= 90) return 'bg-orange-100 text-orange-700 border-orange-300 ring-orange-200';
  if (ovr >= 85) return 'bg-purple-100 text-purple-700 border-purple-300 ring-purple-200';
  return 'bg-blue-100 text-blue-700 border-blue-300 ring-blue-200';
};
const getPotBadgeStyle = (pot) => (pot >= 95 ? 'text-purple-600 font-black' : (pot >= 90 ? 'text-blue-600 font-bold' : 'text-gray-500 font-medium'));

const calculateTax = (capSum) => {
  if (capSum >= 80) return 10 + (capSum - 80) * 0.5;
  if (capSum > 40) return (capSum - 40) * 0.25;
  return 0;
};

// --- 스케줄러 ---
const generateSchedule = (baronIds, elderIds) => {
  const week1Days = ['1.14 (수)', '1.15 (목)', '1.16 (금)', '1.17 (토)', '1.18 (일)'];
  const week2Days = ['1.21 (수)', '1.22 (목)', '1.23 (금)', '1.24 (토)', '1.25 (일)'];
  const week3Days = ['1.28 (수)', '1.29 (목)', '1.30 (금)', '1.31 (토)', '2.1 (일)'];
  let allMatches = [];
  
  for (let i = 0; i < 5; i++) {
    const baronTeam = baronIds[i];
    for (let j = 0; j < 5; j++) {
      const elderTeam = elderIds[j];
      allMatches.push({ t1: baronTeam, t2: elderTeam, type: 'regular', status: 'pending', format: 'BO3' });
    }
  }
  const days = [...week1Days, ...week2Days];
  const finalSchedule = allMatches.map((m, i) => ({
      ...m,
      date: days[Math.floor(i/2) % days.length] || 'TBD',
      time: i % 2 === 0 ? '17:00' : '19:30'
  }));
  week3Days.forEach(day => {
    finalSchedule.push({ t1: null, t2: null, date: day, time: '17:00', type: 'tbd', format: 'BO5' });
  });
  return finalSchedule;
};

// --- ★ 시뮬레이션 엔진 로직 (통합됨) ★ ---

function draftTeam(roster) {
  return roster.map(player => {
    const metaPool = championList.filter(c => c.role === player.포지션 && c.tier <= 2);
    const playerData = MASTERY_MAP[player.id];
    let masteryPool = [];
    
    if (playerData && playerData.pool) {
      const seasonPicks = playerData.pool.filter(p => p.category === 'Season 2025').slice(0, 3);
      const careerPicks = playerData.pool.filter(p => p.category === 'Career').slice(0, 3);
      masteryPool = [...seasonPicks, ...careerPicks];
    }

    let finalPick = null;
    if (masteryPool.length > 0 && Math.random() < 0.7) {
      const selectedMastery = masteryPool[Math.floor(Math.random() * masteryPool.length)];
      const champInfo = championList.find(c => c.name === selectedMastery.name) || { name: selectedMastery.name, tier: 3 };
      finalPick = { ...champInfo, mastery: selectedMastery };
    } else {
      const selectedMeta = metaPool[Math.floor(Math.random() * metaPool.length)] || { name: "Unknown", tier: 3 };
      let masteryInfo = null;
      if (playerData && playerData.pool) {
        masteryInfo = playerData.pool.find(p => p.name === selectedMeta.name);
      }
      finalPick = { ...selectedMeta, mastery: masteryInfo };
    }
    return {
      champName: finalPick.name,
      tier: finalPick.tier || 3,
      mastery: finalPick.mastery
    };
  });
}

function getPhaseStat(phase, player) {
  const s = player.상세;
  if (phase === 'EARLY') return (s.라인전 * 0.6) + (s.무력 * 0.4);
  if (phase === 'MID') return (s.운영 * 0.5) + (s.성장 * 0.3) + (s.한타 * 0.2);
  return (s.한타 * 0.5) + (s.무력 * 0.3) + (s.안정성 * 0.2);
}

function calculateMasteryScore(player, masteryData) {
  if (!masteryData) return player.종합 * 0.8;
  const { games, winRate, kda } = masteryData;
  let baseScore = (winRate * 0.5) + (kda * 10) + 20;
  const volumeBonus = Math.log10(games + 1) * 5;
  return Math.min(100, baseScore + volumeBonus);
}

function getMetaScore(position, tier, masteryScore) {
  let finalTier = tier;
  if (masteryScore >= SIM_CONSTANTS.OTP_THRESHOLD) {
    finalTier = Math.max(1, tier - SIM_CONSTANTS.OTP_TIER_BOOST);
  }
  let coeff = 1.0;
  if (position === 'ADC') {
    const t = Math.max(1, Math.min(3, finalTier));
    coeff = SIM_CONSTANTS.META_COEFF.ADC[t];
  } else {
    const t = Math.max(1, Math.min(5, finalTier));
    coeff = SIM_CONSTANTS.META_COEFF.STANDARD[t];
  }
  return 100 * coeff;
}

function generateLog(phase, sA, sB, nA, nB) {
  const diff = sA - sB;
  const leader = diff > 0 ? nA : nB;
  if (phase === 'EARLY') return diff > 0 ? `⚔️ [초반] ${leader}, 라인전 압살하며 주도권 확보!` : `⚔️ [초반] ${leader} 정글러의 갱킹이 적중했습니다.`;
  if (phase === 'MID') return diff > 0 ? `🗺️ [중반] ${leader}, 운영으로 상대를 흔들며 이득을 봅니다.` : `🗺️ [중반] ${leader}, 잘라먹기로 변수를 만듭니다.`;
  return diff > 0 ? `💥 [후반] ${leader}, 한타 대승! 넥서스로 진격합니다.` : `💥 [후반] ${leader}의 기적적인 역전승!`;
}

function calculatePhaseScore(phase, tA, tB, picksA, picksB, bonusTeam, bonusVal) {
  let powerA = 0, powerB = 0;
  for (let i = 0; i < 5; i++) {
    const pA = tA.roster[i], pB = tB.roster[i];
    const pickA = picksA[i], pickB = picksB[i];

    let statA = getPhaseStat(phase, pA);
    let statB = getPhaseStat(phase, pB);

    if (pA.포지션 === 'ADC') statA += getPhaseStat(phase, tA.roster[4]) * 0.3;
    if (pB.포지션 === 'ADC') statB += getPhaseStat(phase, tB.roster[4]) * 0.3;

    if (phase === 'LATE') {
      if (pA.포지션 === 'TOP') statA *= GAME_CONSTANTS.ROLE_QUEST_BONUS.TOP.effect.splitPushPower;
      if (pB.포지션 === 'TOP') statB *= GAME_CONSTANTS.ROLE_QUEST_BONUS.TOP.effect.splitPushPower;
      if (pA.포지션 === 'ADC') statA *= GAME_CONSTANTS.ROLE_QUEST_BONUS.ADC.effect.damageMultiplier;
      if (pB.포지션 === 'ADC') statB *= GAME_CONSTANTS.ROLE_QUEST_BONUS.ADC.effect.damageMultiplier;
    } else if (phase === 'MID') {
      if (pA.포지션 === 'MID') statA *= GAME_CONSTANTS.ROLE_QUEST_BONUS.MID.effect.roamingSpeed;
      if (pB.포지션 === 'MID') statB *= GAME_CONSTANTS.ROLE_QUEST_BONUS.MID.effect.roamingSpeed;
    }

    const mastA = calculateMasteryScore(pA, pickA.mastery);
    const mastB = calculateMasteryScore(pB, pickB.mastery);
    const metaA = getMetaScore(pA.포지션, pickA.tier, mastA);
    const metaB = getMetaScore(pB.포지션, pickB.tier, mastB);

    const scoreA = (statA * SIM_CONSTANTS.WEIGHTS.STATS) + (mastA * SIM_CONSTANTS.WEIGHTS.MASTERY) + (metaA * SIM_CONSTANTS.WEIGHTS.META);
    const scoreB = (statB * SIM_CONSTANTS.WEIGHTS.STATS) + (mastB * SIM_CONSTANTS.WEIGHTS.MASTERY) + (metaB * SIM_CONSTANTS.WEIGHTS.META);

    powerA += scoreA * (1 + (Math.random() * SIM_CONSTANTS.VAR_RANGE * 2 - SIM_CONSTANTS.VAR_RANGE));
    powerB += scoreB * (1 + (Math.random() * SIM_CONSTANTS.VAR_RANGE * 2 - SIM_CONSTANTS.VAR_RANGE));
  }
  if (bonusTeam === 'A') powerA *= bonusVal;
  if (bonusTeam === 'B') powerB *= bonusVal;
  return { scoreA: powerA, scoreB: powerB, log: generateLog(phase, powerA, powerB, tA.name, tB.name) };
}

function runFullSimulation(teamA, teamB) {
  const log = [];
  let scoreA = 0, scoreB = 0;
  const dragonType = GAME_CONSTANTS.DRAGONS.TYPES[Math.floor(Math.random() * GAME_CONSTANTS.DRAGONS.TYPES.length)];
  const picksA = draftTeam(teamA.roster);
  const picksB = draftTeam(teamB.roster);

  log.push(`📢 [경기 시작] ${teamA.name} vs ${teamB.name}`);
  log.push(`🐉 전장: ${dragonType} 드래곤`);
  log.push(`✨ Key Matchup: ${picksA[2].champName} vs ${picksB[2].champName}`);

  const p1 = calculatePhaseScore('EARLY', teamA, teamB, picksA, picksB, null, 1.0);
  scoreA += p1.scoreA; scoreB += p1.scoreB; log.push(p1.log);

  const midBonusTeam = p1.scoreA > p1.scoreB ? 'A' : 'B';
  const p2 = calculatePhaseScore('MID', teamA, teamB, picksA, picksB, midBonusTeam, 1.1);
  scoreA += p2.scoreA; scoreB += p2.scoreB; log.push(p2.log);

  const lateBonusTeam = p2.scoreA > p2.scoreB ? 'A' : 'B';
  const p3 = calculatePhaseScore('LATE', teamA, teamB, picksA, picksB, lateBonusTeam, 1.15);
  scoreA += p3.scoreA; scoreB += p3.scoreB; log.push(p3.log);

  return {
    winner: scoreA > scoreB ? teamA.name : teamB.name,
    loser: scoreA > scoreB ? teamB.name : teamA.name,
    scoreA: Math.round(scoreA),
    scoreB: Math.round(scoreB),
    logs: log,
    picks: { A: picksA, B: picksB }
  };
}

// =========================================================================
// 4. 컴포넌트 (Components)
// =========================================================================

function LeagueManager() {
  const [leagues, setLeagues] = useState(getLeagues());
  const navigate = useNavigate();
  useEffect(() => setLeagues(getLeagues()), []);
  
  const handleClearData = () => {
    if(window.confirm('저장된 모든 데이터를 초기화하시겠습니까?')){
        localStorage.removeItem('lckgm_leagues');
        window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-black text-gray-800 tracking-tight">LCK 매니저 2026</h1>
            <button onClick={handleClearData} className="text-xs text-red-500 underline hover:text-red-700">데이터 초기화</button>
        </div>
        <div className="grid gap-4">
          {leagues.map(l => {
            const t = teams.find(x => x.id === l.team.id);
            if (!t) return null;
            return (
              <div key={l.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-500 hover:shadow-md transition flex justify-between items-center group">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-white shadow-md text-lg" style={{backgroundColor:t.colors.primary}}>{t.name}</div>
                  <div><h2 className="text-xl font-bold group-hover:text-blue-600 transition">{t.fullName}</h2><p className="text-gray-500 font-medium text-sm">{l.leagueName} · {l.difficulty.toUpperCase()}</p></div>
                </div>
                <div className="flex gap-3">
                  <button onClick={()=>{updateLeague(l.id,{lastPlayed:new Date().toISOString()});navigate(`/league/${l.id}`)}} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition">접속하기</button>
                  <button onClick={()=>{if(window.confirm('삭제하시겠습니까?')){deleteLeague(l.id);setLeagues(getLeagues())}}} className="bg-gray-100 text-gray-600 px-4 py-2.5 rounded-lg font-bold hover:bg-gray-200 transition">삭제</button>
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={() => navigate('/new-league')} className="w-full mt-6 bg-white border-2 border-dashed border-gray-300 py-6 rounded-xl text-gray-400 hover:border-blue-500 hover:text-blue-500 font-bold text-xl transition flex items-center justify-center gap-2"><span>+</span> 새로운 시즌 시작하기</button>
      </div>
    </div>
  );
}

function TeamSelection() {
  const [idx, setIdx] = useState(0);
  const [diff, setDiff] = useState('normal');
  const navigate = useNavigate();
  const current = teams[idx];

  const handleStart = () => {
    const newId = Date.now().toString();
    addLeague({
      id: newId,
      leagueName: `2026 LCK 컵 - ${current.name}`,
      team: current,
      difficulty: diff,
      createdAt: new Date().toISOString(),
      lastPlayed: new Date().toISOString(),
      groups: { baron: [], elder: [] },
      matches: []
    });
    setTimeout(() => navigate(`/league/${newId}`), 50);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 transition-colors duration-500" style={{backgroundColor:`${current.colors.primary}10`}}>
      <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-2xl w-full text-center border-t-8" style={{borderColor:current.colors.primary}}>
        <h2 className="text-3xl font-black mb-2">팀 선택</h2>
        <div className="flex items-center justify-between mb-8 mt-8">
          <button onClick={()=>setIdx(i=>i===0?teams.length-1:i-1)} className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition">◀</button>
          <div className="flex flex-col items-center transform transition duration-300">
            <div className="w-40 h-40 rounded-full flex items-center justify-center text-5xl font-black text-white shadow-xl mb-6 ring-4 ring-white" style={{backgroundColor:current.colors.primary}}>{current.name}</div>
            <h3 className="text-3xl font-bold text-gray-800">{current.fullName}</h3>
            <div className="mt-3 inline-block bg-gray-100 px-4 py-1.5 rounded-full text-sm font-bold border border-gray-200">종합 전력: <span className="text-blue-600 text-lg">{current.power}</span></div>
          </div>
          <button onClick={()=>setIdx(i=>i===teams.length-1?0:i+1)} className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition">▶</button>
        </div>
        <div className="grid grid-cols-4 gap-3 mb-4">{difficulties.map(d=><button key={d.value} onClick={()=>setDiff(d.value)} className={`py-3 rounded-xl border-2 font-bold transition ${diff===d.value?'bg-gray-800 text-white border-gray-800':'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}>{d.label}</button>)}</div>
        <button onClick={handleStart} className="w-full py-5 rounded-2xl font-black text-xl text-white shadow-lg hover:shadow-xl hover:opacity-90 transition transform hover:-translate-y-1" style={{backgroundColor:current.colors.primary,color:getTextColor(current.colors.primary)}}>2026 시즌 시작하기</button>
      </div>
    </div>
  );
}

function Dashboard() {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const [league, setLeague] = useState(null);
  const [viewingTeamId, setViewingTeamId] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftPool, setDraftPool] = useState([]);
  const [draftGroups, setDraftGroups] = useState({ baron: [], elder: [] });
  const [draftTurn, setDraftTurn] = useState('user');
  const [matchResult, setMatchResult] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [metaRole, setMetaRole] = useState('TOP');
  const draftTimeoutRef = useRef(null);

  const getFullRoster = (teamId) => {
    const t = teams.find(team => team.id === teamId);
    if (!t) return [];
    const teamPlayers = playerList.filter(p => p.팀 === t.name);
    const positions = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
    return positions.map(pos => teamPlayers.find(p => p.포지션 === pos) || { 이름: '공석', 포지션: pos, 종합: 70, 상세: { 라인전:70, 무력:70, 한타:70, 성장:70, 안정성:70, 운영:70 } });
  };

  useEffect(() => {
    const loadData = () => {
      const found = getLeagueById(leagueId);
      if (found) { setLeague(found); setViewingTeamId(found.team.id); }
    };
    loadData();
  }, [leagueId]);

  const handleMenuClick = (tabId) => { setActiveTab(tabId); if (tabId === 'dashboard' && league) setViewingTeamId(league.team.id); };

  if (!league) return <div className="flex h-screen items-center justify-center font-bold text-gray-500">데이터 로딩 중...</div>;
  
  const myTeam = teams.find(t => String(t.id) === String(league.team.id));
  const viewingTeam = teams.find(t => String(t.id) === String(viewingTeamId));
  const currentRoster = (playerList || []).filter(p => p.팀 === viewingTeam.name);
  const isCaptain = myTeam.id === 1 || myTeam.id === 2; 
  const hasDrafted = league.groups && league.groups.baron && league.groups.baron.length > 0;
  const currentDateDisplay = hasDrafted ? '2026년 1월 8일' : '2026년 1월 1일';
  const fin = teamFinanceData[viewingTeam.name] || { total_expenditure: 0, cap_expenditure: 0 };
  const luxuryTax = calculateTax(fin.cap_expenditure);

  // 드래프트 로직
  const handleDraftStart = () => {
    if (hasDrafted) return;
    setIsDrafting(true);
    setDraftPool(teams.filter(t => t.id !== 1 && t.id !== 2));
    setDraftGroups({ baron: [1], elder: [2] }); 
    if (isCaptain) {
        if (myTeam.id === 1) { setDraftTurn('user'); } 
        else { setDraftTurn('cpu'); triggerCpuPick(teams.filter(t=>t.id!==1&&t.id!==2), { baron:[1], elder:[2] }, 'cpu'); }
    } else { handleAutoDraft(teams.filter(t=>t.id!==1&&t.id!==2)); }
  };

  const pickComputerTeam = (available) => {
    const sorted = [...available].sort((a, b) => b.power - a.power);
    return Math.random() < 0.8 ? sorted[0] : sorted[1] || sorted[0];
  };

  const triggerCpuPick = (currentPool, currentGroups) => {
    draftTimeoutRef.current = setTimeout(() => {
        if (currentPool.length === 0) { finalizeDraft(currentGroups); return; }
        const picked = pickComputerTeam(currentPool);
        const newPool = currentPool.filter(t => t.id !== picked.id);
        let newGroups = { ...currentGroups };
        if (myTeam.id === 1) newGroups.elder.push(picked.id); else newGroups.baron.push(picked.id);
        setDraftPool(newPool); setDraftGroups(newGroups); setDraftTurn('user');
        if (newPool.length === 0) finalizeDraft(newGroups);
    }, 800);
  };

  const handleUserPick = (teamId) => {
    if (draftTurn !== 'user') return;
    const picked = teams.find(t => t.id === teamId);
    const newPool = draftPool.filter(t => t.id !== teamId);
    let newGroups = { ...draftGroups };
    if (myTeam.id === 1) newGroups.baron.push(picked.id); else newGroups.elder.push(picked.id);
    setDraftPool(newPool); setDraftGroups(newGroups); setDraftTurn('cpu'); 
    if (newPool.length === 0) finalizeDraft(newGroups); else triggerCpuPick(newPool, newGroups);
  };

  const handleAutoDraft = (pool) => {
    let currentPool = [...pool];
    let baron = [1]; let elder = [2];
    let turn = 0; 
    while (currentPool.length > 0) {
        const picked = pickComputerTeam(currentPool);
        currentPool = currentPool.filter(t => t.id !== picked.id);
        if (turn === 0) baron.push(picked.id); else elder.push(picked.id);
        turn = 1 - turn;
    }
    finalizeDraft({ baron, elder });
  };

  const finalizeDraft = (groups) => {
    const matches = generateSchedule(groups.baron, groups.elder);
    const updated = updateLeague(league.id, { groups, matches });
    if (updated) { setLeague(updated); setTimeout(() => { setIsDrafting(false); setActiveTab('standings'); alert("조 추첨 완료!"); }, 500); }
  };

  // 경기 시뮬레이션
  const handleSimulateMatch = () => {
    const nextMatchIdx = league.matches.findIndex(m => m.status === 'pending');
    if (nextMatchIdx === -1) { alert("진행할 경기가 없습니다."); return; }
    
    const match = league.matches[nextMatchIdx];
    const t1 = teams.find(t => t.id === match.t1);
    const t2 = teams.find(t => t.id === match.t2);
    const teamA = { ...t1, roster: getFullRoster(t1.id) };
    const teamB = { ...t2, roster: getFullRoster(t2.id) };

    setIsSimulating(true);
    setTimeout(() => {
      const result = runFullSimulation(teamA, teamB); // 내부 통합 엔진 호출
      
      const updatedMatches = [...league.matches];
      updatedMatches[nextMatchIdx] = { ...match, status: 'finished', result: result };
      
      const updatedLeague = { ...league, matches: updatedMatches };
      updateLeague(league.id, { matches: updatedMatches });
      setLeague(updatedLeague);
      setMatchResult(result);
      setIsSimulating(false);
    }, 1000);
  };

  const handlePrevTeam = () => { const idx = teams.findIndex(t => t.id === viewingTeam.id); setViewingTeamId(teams[(idx - 1 + teams.length) % teams.length].id); };
  const handleNextTeam = () => { const idx = teams.findIndex(t => t.id === viewingTeam.id); setViewingTeamId(teams[(idx + 1) % teams.length].id); };
  const nextMatch = league.matches ? league.matches.find(m => m.status === 'pending') : null;
  const nextTeam1 = nextMatch ? teams.find(t=>t.id===nextMatch.t1) : null;
  const nextTeam2 = nextMatch ? teams.find(t=>t.id===nextMatch.t2) : null;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans relative">
      {/* 1. 경기 결과 모달 */}
      {matchResult && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full text-center shadow-2xl">
            <h2 className="text-3xl font-black mb-4">경기 결과</h2>
            <div className="flex justify-center items-center gap-8 mb-6">
              <div className="text-center">
                 <div className="text-xl font-bold text-gray-600 mb-2">{matchResult.winner === matchResult.scoreA > matchResult.scoreB ? 'WIN' : 'LOSE'}</div>
                 <div className={`text-6xl font-black ${matchResult.scoreA > matchResult.scoreB ? 'text-blue-600' : 'text-gray-300'}`}>{matchResult.scoreA}</div>
              </div>
              <div className="text-2xl text-gray-300 font-bold">VS</div>
              <div className="text-center">
                 <div className="text-xl font-bold text-gray-600 mb-2">{matchResult.winner === matchResult.scoreB > matchResult.scoreA ? 'WIN' : 'LOSE'}</div>
                 <div className={`text-6xl font-black ${matchResult.scoreB > matchResult.scoreA ? 'text-red-600' : 'text-gray-300'}`}>{matchResult.scoreB}</div>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-left text-sm text-gray-700 space-y-2 mb-6 max-h-60 overflow-y-auto border border-gray-200">
              {matchResult.logs.map((log, i) => <div key={i} className="border-b border-gray-200 pb-2 last:border-0">{log}</div>)}
            </div>
            <button onClick={() => setMatchResult(null)} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 transition">확인</button>
          </div>
        </div>
      )}

      {/* 2. 드래프트 모달 */}
      {isDrafting && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full text-center shadow-2xl overflow-hidden relative min-h-[500px] flex flex-col">
            <h2 className="text-3xl font-black mb-4">조 추첨 진행</h2>
            {!isCaptain ? <div className="flex-1 flex flex-col justify-center items-center text-xl text-gray-500 animate-pulse">자동 추첨 중...</div> : (
               <div className="flex-1">
                  <div className="flex justify-between items-center mb-6">
                     <div className="w-1/3 bg-purple-50 p-4 rounded-lg"><h3 className="font-bold mb-2 text-purple-700">Baron</h3>{draftGroups.baron.map(id=><div key={id}>{teams.find(t=>t.id===id).name}</div>)}</div>
                     <div className="text-xl font-bold">VS</div>
                     <div className="w-1/3 bg-red-50 p-4 rounded-lg"><h3 className="font-bold mb-2 text-red-700">Elder</h3>{draftGroups.elder.map(id=><div key={id}>{teams.find(t=>t.id===id).name}</div>)}</div>
                  </div>
                  <div className="text-left font-bold mb-2">{draftTurn === 'user' ? "팀을 선택하세요:" : "상대가 선택 중..."}</div>
                  <div className="grid grid-cols-4 gap-2">
                     {draftPool.map(t => (
                        <button key={t.id} onClick={() => handleUserPick(t.id)} disabled={draftTurn !== 'user'} className="p-3 border rounded hover:bg-blue-50 transition">{t.name}</button>
                     ))}
                  </div>
               </div>
            )}
          </div>
        </div>
      )}

      {/* 사이드바 */}
      <aside className="w-64 bg-gray-900 text-gray-300 flex flex-col">
        <div className="p-5 font-bold text-white border-b border-gray-700 flex items-center gap-3">
           <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-lg" style={{backgroundColor: myTeam.colors.primary}}>{myTeam.name}</div>
           <span>GM 모드</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map(item => (
            <button key={item.id} onClick={() => handleMenuClick(item.id)} className={`w-full text-left p-3 rounded-lg font-bold transition flex items-center gap-3 ${activeTab===item.id?'bg-blue-600 text-white':'hover:bg-gray-800'}`}><span>{item.icon}</span> {item.name}</button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700 bg-gray-800"><button onClick={() => navigate('/')} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition">🚪 메인으로 나가기</button></div>
      </aside>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-8 max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-12 gap-6">
               <div className="col-span-12 lg:col-span-8 bg-white rounded-lg border shadow-sm p-6 relative overflow-hidden">
                  <h3 className="text-xl font-black text-gray-800 mb-4">다음 경기 일정</h3>
                  {nextMatch ? (
                    <div className="flex flex-col items-center">
                        <div className="flex items-center justify-between w-full mb-6 px-10">
                            <div className="text-center w-1/3"><div className="text-4xl font-black text-gray-800 mb-2">{nextTeam1?.name}</div><span className="text-xs font-bold text-white bg-blue-600 px-2 py-1 rounded">HOME</span></div>
                            <div className="text-center w-1/3"><div className="text-xs font-bold text-gray-400 mb-1">VS</div><div className="text-2xl font-black text-gray-300">@</div></div>
                            <div className="text-center w-1/3"><div className="text-4xl font-black text-gray-800 mb-2">{nextTeam2?.name}</div><span className="text-xs font-bold text-white bg-red-600 px-2 py-1 rounded">AWAY</span></div>
                        </div>
                        <button onClick={handleSimulateMatch} disabled={isSimulating} className={`px-10 py-4 rounded-full font-black text-lg shadow-lg transition transform hover:-translate-y-1 flex items-center gap-2 ${isSimulating ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'}`}>{isSimulating ? '⚡ 경기 진행 중...' : '▶ 경기 시작'}</button>
                    </div>
                  ) : (
                    <div className="text-center py-20 text-gray-400 font-bold"><div>🎉 모든 일정이 종료되었습니다!</div><div className="mt-6"><button onClick={handleDraftStart} disabled={hasDrafted} className={`px-4 py-2 rounded text-sm font-bold ${hasDrafted ? 'bg-gray-200 text-gray-400 hidden' : 'bg-green-600 text-white animate-pulse'}`}>조 추첨 시작하기</button></div></div>
                  )}
               </div>
               <div className="col-span-12 lg:col-span-4 bg-white rounded-lg border shadow-sm p-4 flex flex-col h-full max-h-[500px]">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b"><h3 className="font-bold text-gray-700">순위표</h3><button onClick={()=>setActiveTab('standings')} className="text-xs text-blue-600 font-bold hover:underline">전체 보기</button></div>
                  {hasDrafted ? (
                     <div className="flex-1 overflow-y-auto space-y-4">
                        <div><div className="font-bold text-purple-700 mb-1 text-sm">Baron</div>{league.groups.baron.map((id,i)=><div key={id} className="text-xs flex justify-between p-1 border-b last:border-0"><span>{i+1}. {teams.find(t=>t.id===id).name}</span><span className="font-bold">0-0</span></div>)}</div>
                        <div><div className="font-bold text-red-700 mb-1 text-sm">Elder</div>{league.groups.elder.map((id,i)=><div key={id} className="text-xs flex justify-between p-1 border-b last:border-0"><span>{i+1}. {teams.find(t=>t.id===id).name}</span><span className="font-bold">0-0</span></div>)}</div>
                     </div>
                  ) : <div className="text-center text-gray-400 py-10">데이터 없음</div>}
               </div>
            </div>
          )}

          {activeTab === 'roster' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                <div className="flex items-center gap-4">
                  <button onClick={handlePrevTeam} className="p-2 hover:bg-gray-200 rounded-full transition">◀</button>
                  <h2 className="text-2xl font-black">{viewingTeam.fullName} 로스터</h2>
                  <button onClick={handleNextTeam} className="p-2 hover:bg-gray-200 rounded-full transition">▶</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-gray-100 text-gray-600 font-bold"><tr><th className="p-4 pl-6">Info</th><th className="p-4 text-center">OVR</th><th className="p-4 text-center">Age</th><th className="p-4 text-center">Career</th><th className="p-4 text-center">Team</th><th className="p-4 text-center">Salary</th><th className="p-4 text-center border-l">Line</th><th className="p-4 text-center">Combat</th><th className="p-4 text-center">TF</th><th className="p-4 text-center">Macro</th></tr></thead>
                  <tbody className="divide-y">{currentRoster.map((p, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-4 pl-6 font-bold text-gray-800">{p.포지션} {p.이름}</td>
                        <td className="p-4 text-center"><span className={`px-2 py-1 rounded font-black ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td>
                        <td className="p-4 text-center text-gray-500">{p.나이?.split('(')[0]}</td>
                        <td className="p-4 text-center text-gray-500">{p.경력?.split('(')[0]}</td>
                        <td className="p-4 text-center text-gray-700">{p['팀 소속기간']}</td>
                        <td className="p-4 text-center font-bold text-gray-800">{p.연봉}</td>
                        <td className="p-4 text-center border-l text-gray-500">{p.상세?.라인전}</td>
                        <td className="p-4 text-center text-gray-500">{p.상세?.무력}</td>
                        <td className="p-4 text-center text-gray-500">{p.상세?.한타}</td>
                        <td className="p-4 text-center text-gray-500">{p.상세?.운영}</td>
                      </tr>
                    ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'finance' && (
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
               <div className="flex justify-between mb-8 pb-4 border-b">
                  <div className="flex items-center gap-4"><button onClick={handlePrevTeam} className="text-xl">◀</button><h2 className="text-2xl font-black">{viewingTeam.fullName} 재정</h2><button onClick={handleNextTeam} className="text-xl">▶</button></div>
                  <div className="text-right"><p className="text-xs text-gray-500 font-bold">Luxury Tax</p><p className={`text-3xl font-black ${luxuryTax > 0 ? 'text-red-600':'text-green-600'}`}>{luxuryTax.toFixed(1)}억</p></div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                      <div><div className="flex justify-between mb-2 font-bold text-sm"><span>총 지출</span><span className="text-blue-600">{fin.total_expenditure}억</span></div><div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden"><div className="bg-blue-500 h-full" style={{width: `${Math.min((fin.total_expenditure/150)*100, 100)}%`}}></div></div></div>
                      <div><div className="flex justify-between mb-2 font-bold text-sm"><span>샐러리캡 반영</span><span className="text-purple-600">{fin.cap_expenditure}억 / 80억</span></div><div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden relative"><div className={`h-full ${fin.cap_expenditure>80?'bg-red-500':'bg-purple-500'}`} style={{width: `${Math.min((fin.cap_expenditure/150)*100, 100)}%`}}></div><div className="absolute top-0 left-[53.3%] w-0.5 h-full bg-black border-l border-dashed border-white"></div></div></div>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-lg border">
                    <ul className="space-y-3 text-sm">
                      <li className="flex justify-between"><span>운영 예산</span><span className="font-bold">200.0억</span></li>
                      <li className="flex justify-between"><span>연봉 지출</span><span className="font-bold text-red-500">-{fin.total_expenditure}억</span></li>
                      <li className="flex justify-between border-t pt-2"><span>잔여 예산</span><span className="font-black text-blue-600">{(200 - fin.total_expenditure - luxuryTax).toFixed(2)}억</span></li>
                    </ul>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'meta' && (
              <div className="bg-white rounded-lg border shadow-sm p-8 min-h-[600px] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2"><span className="text-purple-600">📈</span> 16.01 패치 메타</h2>
                  <div className="flex bg-gray-100 p-1 rounded-lg">{['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map(role => (<button key={role} onClick={() => setMetaRole(role)} className={`px-4 py-2 rounded-md text-sm font-bold transition ${metaRole === role ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{role}</button>))}</div>
                </div>
                <div className="grid grid-cols-1 gap-4">{championList.filter(c => c.role === metaRole).map((champ, idx) => (<div key={champ.id} className="border rounded-xl p-4 flex items-center justify-between hover:bg-gray-50 transition group"><div className="flex items-center gap-4 w-1/4"><span className={`text-2xl font-black w-10 text-center ${idx < 3 ? 'text-yellow-500' : 'text-gray-300'}`}>{idx + 1}</span><div><div className="font-bold text-lg text-gray-800">{champ.name}</div><span className={`text-xs font-bold px-2 py-0.5 rounded ${champ.tier === 1 ? 'bg-purple-100 text-purple-600' : champ.tier === 2 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>{champ.tier} 티어</span></div></div><div className="flex-1 px-8"><div className="flex justify-between text-xs text-gray-500 mb-1 font-medium"><span>초반 {champ.stats.early}</span><span>중반 {champ.stats.mid}</span><span>후반 {champ.stats.late}</span></div><div className="h-2.5 bg-gray-100 rounded-full flex overflow-hidden"><div className="bg-green-400 h-full" style={{width: `${champ.stats.early * 10}%`}} /><div className="bg-yellow-400 h-full" style={{width: `${champ.stats.mid * 10}%`}} /><div className="bg-red-400 h-full" style={{width: `${champ.stats.late * 10}%`}} /></div></div><div className="w-1/3 text-right"><div className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-wide">Counter Picks</div><div className="text-sm font-medium text-gray-700">{champ.counters.join(', ')}</div></div></div>))}</div>
              </div>
          )}

          {(activeTab === 'standings' || activeTab === 'schedule' || activeTab === 'team_schedule') && (
             <div className="bg-white p-10 rounded-xl shadow-sm border text-center text-gray-400">
                <h3 className="text-xl font-bold mb-2">준비 중인 기능입니다.</h3>
                {activeTab === 'standings' && hasDrafted && (
                    <div className="mt-4 grid grid-cols-2 gap-4 text-left">
                        <div className="bg-purple-50 p-4 rounded h-40 overflow-y-auto"><h4 className="font-bold text-purple-700 mb-2">Baron Group</h4>{league.groups.baron.map((id,i)=><div key={id} className="text-sm py-1 border-b last:border-0">{i+1}. {teams.find(t=>t.id===id).name}</div>)}</div>
                        <div className="bg-red-50 p-4 rounded h-40 overflow-y-auto"><h4 className="font-bold text-red-700 mb-2">Elder Group</h4>{league.groups.elder.map((id,i)=><div key={id} className="text-sm py-1 border-b last:border-0">{i+1}. {teams.find(t=>t.id===id).name}</div>)}</div>
                    </div>
                )}
             </div>
          )}
        </div>
      </main>
    </div>
  );
}