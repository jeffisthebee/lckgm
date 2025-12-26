import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import playerList from './data/players.json';
import championList from './data/champions.json';

// ==========================================
// 0. 시뮬레이션 엔진 및 상수 (Simulation Engine)
// ==========================================

// 0-1. 시뮬레이션 상수
const GAME_CONSTANTS = {
  DRAGONS: {
    TYPES: ['화학공학', '바람', '대지', '화염', '바다', '마법공학'],
    BUFFS: {
      '화학공학': { description: '강인함 및 회복 효과 증가' },
      '바람': { description: '궁극기 가속 및 이동 속도' },
      '대지': { description: '방어력 및 마법 저항력' },
      '화염': { description: '공격력 및 주문력' },
      '바다': { description: '체력 재생' },
      '마법공학': { description: '스킬 가속 및 공속' }
    }
  },
  ROLE_QUEST_BONUS: {
    TOP: { effect: { splitPushPower: 1.1 } },
    MID: { effect: { roamingSpeed: 1.1 } },
    ADC: { effect: { damageMultiplier: 1.15 } }
  }
};

const SIM_CONSTANTS = {
  WEIGHTS: { STATS: 0.55, META: 0.25, MASTERY: 0.20 },
  META_COEFF: {
    STANDARD: { 1: 1.0, 2: 0.95, 3: 0.90, 4: 0.85, 5: 0.80 },
    ADC: { 1: 1.0, 2: 0.92, 3: 0.84 }
  },
  LOW_SAMPLE_THRESHOLD: 5,
  OTP_SCORE_THRESHOLD: 80,
  OTP_TIER_BOOST: 2,
  VAR_RANGE: 0.12
};

// 0-2. 데이터 전처리 (숙련도 맵핑 - 실제 파일이 없으므로 Mock 생성)
const MASTERY_MAP = playerList.reduce((acc, player) => {
  // 실제 데이터가 없으므로 빈 pool 생성 (시뮬레이션 로직이 메타 챔피언을 선택하도록 유도)
  acc[player.이름] = { id: player.이름, pool: [] };
  return acc;
}, {});

// 0-3. 핵심 시뮬레이션 함수
function simulateMatch(teamA, teamB) {
  const log = [];
  let scoreA = 0;
  let scoreB = 0;

  // 1. 드래곤 속성
  const dragonType = GAME_CONSTANTS.DRAGONS.TYPES[Math.floor(Math.random() * GAME_CONSTANTS.DRAGONS.TYPES.length)];
  const dragonBuff = GAME_CONSTANTS.DRAGONS.BUFFS[dragonType];
  
  // 2. 밴픽
  const picksA = draftTeam(teamA.roster);
  const picksB = draftTeam(teamB.roster);

  log.push(`📢 [경기 시작] ${teamA.name} vs ${teamB.name}`);
  log.push(`🐉 전장: ${dragonType} 드래곤 협곡 (${dragonBuff.description})`);
  log.push(`✨ Key Matchup (MID): ${picksA[2].champName} vs ${picksB[2].champName}`);

  // 3. 페이즈 계산
  const p1 = calculatePhase('EARLY', teamA, teamB, picksA, picksB, null, 1.0);
  scoreA += p1.scoreA; scoreB += p1.scoreB;
  log.push(p1.log);

  const midBonusTeam = p1.scoreA > p1.scoreB ? 'A' : 'B';
  const p2 = calculatePhase('MID', teamA, teamB, picksA, picksB, midBonusTeam, 1.1);
  scoreA += p2.scoreA; scoreB += p2.scoreB;
  log.push(p2.log);

  const lateBonusTeam = p2.scoreA > p2.scoreB ? 'A' : 'B';
  const p3 = calculatePhase('LATE', teamA, teamB, picksA, picksB, lateBonusTeam, 1.15);
  scoreA += p3.scoreA; scoreB += p3.scoreB;
  log.push(p3.log);

  // 4. 결과
  const winner = scoreA > scoreB ? teamA : teamB;
  const loser = scoreA > scoreB ? teamB : teamA;

  return {
    winner: winner.name,
    loser: loser.name,
    scoreA: Math.round(scoreA),
    scoreB: Math.round(scoreB),
    logs: log,
    picks: { A: picksA, B: picksB }
  };
}

function draftTeam(roster) {
  return roster.map(player => {
    const metaPool = championList.filter(c => c.role === player.포지션 && c.tier <= 2);
    const playerData = MASTERY_MAP[player.이름];
    let masteryPool = [];
    
    if (playerData && playerData.pool) {
       // Mock logic for pool setup
       masteryPool = playerData.pool; 
    }

    let finalPick = null;
    if (masteryPool.length > 0 && Math.random() < 0.7) {
      const selectedMastery = masteryPool[Math.floor(Math.random() * masteryPool.length)];
      const champInfo = championList.find(c => c.name === selectedMastery.name) || { name: selectedMastery.name, tier: 3 };
      finalPick = { ...champInfo, mastery: selectedMastery };
    } else {
      const selectedMeta = metaPool[Math.floor(Math.random() * metaPool.length)] || { name: "Unknown Champion", tier: 3 };
      finalPick = { ...selectedMeta, mastery: null };
    }

    return {
      champName: finalPick.name,
      tier: finalPick.tier || 3,
      mastery: finalPick.mastery
    };
  });
}

function calculatePhase(phase, tA, tB, picksA, picksB, bonusTeam, bonusVal) {
  let powerA = 0;
  let powerB = 0;

  for (let i = 0; i < 5; i++) {
    const pA = tA.roster[i];
    const pB = tB.roster[i];
    const pickA = picksA[i];
    const pickB = picksB[i];

    let statA = getPhaseStat(phase, pA);
    let statB = getPhaseStat(phase, pB);

    if (pA.포지션 === 'ADC' && tA.roster[4]) statA += getPhaseStat(phase, tA.roster[4]) * 0.3;
    if (pB.포지션 === 'ADC' && tB.roster[4]) statB += getPhaseStat(phase, tB.roster[4]) * 0.3;

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

  return {
    scoreA: powerA,
    scoreB: powerB,
    log: generateLog(phase, powerA, powerB, tA.name, tB.name)
  };
}

function getPhaseStat(phase, player) {
  const s = player.상세 || { 라인전: 80, 무력: 80, 운영: 80, 성장: 80, 한타: 80, 안정성: 80 };
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
  if (masteryScore >= SIM_CONSTANTS.OTP_SCORE_THRESHOLD) {
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
  if (phase === 'EARLY') {
    return diff > 0 ? `⚔️ [초반] ${leader}, 강력한 라인전으로 주도권을 잡습니다.` : `⚔️ [초반] ${leader} 정글러의 갱킹이 적중했습니다.`;
  } else if (phase === 'MID') {
    return diff > 0 ? `🗺️ [중반] ${leader}, 운영 단계에서 상대를 압도합니다.` : `🗺️ [중반] ${leader}, 잘라먹기 플레이로 이득을 봅니다.`;
  } else {
    return diff > 0 ? `💥 [후반] ${leader}, 한타 대승! 넥서스를 파괴합니다.` : `💥 [후반] ${leader}의 기적적인 역전승!`;
  }
}

// ==========================================
// 1. 기존 데이터 및 설정 (Original Data)
// ==========================================

const teams = [
  { id: 1, name: 'GEN', fullName: '젠지 (Gen.G)', power: 94, description: '안정적인 운영과 강력한 라인전', colors: { primary: '#D4AF37', secondary: '#000000' } },
  { id: 2, name: 'HLE', fullName: '한화생명 (HLE)', power: 93, description: '성장 가능성이 높은 팀', colors: { primary: '#FF6B00', secondary: '#FFFFFF' } },
  { id: 3, name: 'KT', fullName: '케이티 (KT)', power: 87, description: '공격적인 플레이 스타일', colors: { primary: '#FF4444', secondary: '#FFFFFF' } },
  { id: 4, name: 'T1', fullName: '티원 (T1)', power: 93, description: 'LCK의 최강팀', colors: { primary: '#E2012E', secondary: '#000000' } },
  { id: 5, name: 'DK', fullName: '디플러스 기아 (DK)', power: 84, description: '전략적 플레이와 팀워크', colors: { primary: '#00D9C4', secondary: '#FFFFFF' } },
  { id: 6, name: 'BNK', fullName: 'BNK 피어엑스 (BNK)', power: 82, description: '젊은 선수들의 잠재력', colors: { primary: '#FFB800', secondary: '#000000' } },
  { id: 7, name: 'NS', fullName: '농심 레드포스 (NS)', power: 85, description: '재건 중인 팀', colors: { primary: '#DC143C', secondary: '#FFFFFF' } },
  { id: 8, name: 'BRO', fullName: '브리온 (BRO)', power: 79, description: '기본기에 충실한 팀', colors: { primary: '#166534', secondary: '#FFFFFF' } },
  { id: 9, name: 'DRX', fullName: '디알엑스 (DRX)', power: 80, description: '변화를 추구하는 팀', colors: { primary: '#3848A2', secondary: '#000000' } },
  { id: 10, name: 'DNS', fullName: 'DN 수퍼스 (DNS)', power: 82, description: '신생 팀, 도전 정신', colors: { primary: '#1E3A8A', secondary: '#FFFFFF' } },
];

const teamFinanceData = {
  "T1": { "total_expenditure": 135.0, "cap_expenditure": 76.0, "luxury_tax": 9.0 },
  "GEN": { "total_expenditure": 110.0, "cap_expenditure": 64.5, "luxury_tax": 6.125 },
  "HLE": { "total_expenditure": 102.0, "cap_expenditure": 94.5, "luxury_tax": 17.25 },
  "KT": { "total_expenditure": 48.0, "cap_expenditure": 40.4, "luxury_tax": 0.1 },
  "DK": { "total_expenditure": 35.5, "cap_expenditure": 26.5, "luxury_tax": 0.0 },
  "NS": { "total_expenditure": 51.0, "cap_expenditure": 50.0, "luxury_tax": 2.5 },
  "BNK": { "total_expenditure": 15.5, "cap_expenditure": 14.15, "luxury_tax": 0.0 },
  "BRO": { "total_expenditure": 16.0, "cap_expenditure": 16.0, "luxury_tax": 0.0 },
  "DRX": { "total_expenditure": 19.0, "cap_expenditure": 19.0, "luxury_tax": 0.0 },
  "DNS": { "total_expenditure": 29.5, "cap_expenditure": 25.5, "luxury_tax": 0.0 }
};

const difficulties = [
  { value: 'easy', label: '쉬움', color: 'green' },
  { value: 'normal', label: '보통', color: 'blue' },
  { value: 'hard', label: '어려움', color: 'orange' },
  { value: 'insane', label: '극악', color: 'red' },
];

// --- 유틸리티 ---
const getLeagues = () => { const s = localStorage.getItem('lckgm_leagues'); return s ? JSON.parse(s) : []; };
const saveLeagues = (l) => localStorage.setItem('lckgm_leagues', JSON.stringify(l));
const addLeague = (l) => { const list = getLeagues(); list.push(l); saveLeagues(list); return list; };
const updateLeague = (id, u) => { 
  const leagues = getLeagues(); 
  const index = leagues.findIndex(l => l.id === id); 
  if (index !== -1) { 
    leagues[index] = { ...leagues[index], ...u }; 
    saveLeagues(leagues); 
    return leagues[index];
  }
  return null;
};
const deleteLeague = (id) => { const l = getLeagues().filter(x => x.id !== id); saveLeagues(l); return l; };
const getLeagueById = (id) => getLeagues().find(l => l.id === id);
function getTextColor(hex) { const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return (r*299+g*587+b*114)/1000>128?'#000000':'#FFFFFF'; }

const getOvrBadgeStyle = (ovr) => {
  if (ovr >= 95) return 'bg-red-100 text-red-700 border-red-300 ring-red-200';
  if (ovr >= 90) return 'bg-orange-100 text-orange-700 border-orange-300 ring-orange-200';
  if (ovr >= 85) return 'bg-purple-100 text-purple-700 border-purple-300 ring-purple-200';
  if (ovr >= 80) return 'bg-blue-100 text-blue-700 border-blue-300 ring-blue-200';
  return 'bg-green-100 text-green-700 border-green-300 ring-green-200';
};

const getPotBadgeStyle = (pot) => {
  if (pot >= 95) return 'text-purple-600 font-black'; 
  if (pot >= 90) return 'text-blue-600 font-bold'; 
  return 'text-gray-500 font-medium';
};

// --- 스케줄러 ---
const generateSchedule = (baronIds, elderIds) => {
  const week1Days = ['1.14 (수)', '1.15 (목)', '1.16 (금)', '1.17 (토)', '1.18 (일)'];
  const week2Days = ['1.21 (수)', '1.22 (목)', '1.23 (금)', '1.24 (토)', '1.25 (일)'];
  const week3Days = ['1.28 (수)', '1.29 (목)', '1.30 (금)', '1.31 (토)', '2.1 (일)'];

  const shuffledElder = [...elderIds].sort(() => Math.random() - 0.5);
  let allMatches = [];
  
  for (let i = 0; i < 5; i++) {
    const baronTeam = baronIds[i];
    const skipElderTeam = shuffledElder[i]; 
    for (let j = 0; j < 5; j++) {
      const elderTeam = elderIds[j];
      if (elderTeam !== skipElderTeam) {
        allMatches.push({ id: Date.now() + Math.random(), t1: baronTeam, t2: elderTeam, type: 'regular', status: 'pending', format: 'BO3' });
      }
    }
  }

  const attemptFullSchedule = () => {
    const pool = [...allMatches].sort(() => Math.random() - 0.5);
    let week1Matches = [], week2Matches = [];
    const counts = {};
    
    for (const m of pool) {
      const c1 = counts[m.t1] || 0;
      const c2 = counts[m.t2] || 0;
      if (week1Matches.length < 10 && c1 < 2 && c2 < 2) {
        week1Matches.push(m);
        counts[m.t1] = c1 + 1;
        counts[m.t2] = c2 + 1;
      } else {
        week2Matches.push(m);
      }
    }
    
    if (week1Matches.length !== 10) return null;
    const w2Counts = {};
    week2Matches.forEach(m => { w2Counts[m.t1] = (w2Counts[m.t1] || 0) + 1; w2Counts[m.t2] = (w2Counts[m.t2] || 0) + 1; });
    if (Object.values(w2Counts).some(c => c !== 2)) return null;

    const assignDays = (matches, days) => {
      let schedule = [];
      let dayIdx = 0;
      let lastPlayed = {};
      let dailyPool = [...matches];

      while (dayIdx < 5) {
        let todays = [];
        for (let k = 0; k < 2; k++) {
          const matchIdx = dailyPool.findIndex(m => {
            if (todays.some(tm => tm.t1 === m.t1 || tm.t1 === m.t2 || tm.t2 === m.t1 || tm.t2 === m.t2)) return false;
            const p1 = lastPlayed[m.t1];
            const p2 = lastPlayed[m.t2];
            if (p1 !== undefined && dayIdx - p1 <= 1) return false;
            if (p2 !== undefined && dayIdx - p2 <= 1) return false;
            return true;
          });

          if (matchIdx !== -1) {
            const m = dailyPool.splice(matchIdx, 1)[0];
            todays.push(m);
            lastPlayed[m.t1] = dayIdx;
            lastPlayed[m.t2] = dayIdx;
          } else {
            return null;
          }
        }
        schedule.push({ ...todays[0], date: days[dayIdx], time: '17:00' });
        schedule.push({ ...todays[1], date: days[dayIdx], time: '19:30' });
        dayIdx++;
      }
      return schedule;
    };

    const s1 = assignDays(week1Matches, week1Days);
    if (!s1) return null;
    const s2 = assignDays(week2Matches, week2Days);
    if (!s2) return null;

    return [...s1, ...s2];
  };

  let finalSchedule = null;
  let attempts = 0;
  while (!finalSchedule && attempts < 100) {
    finalSchedule = attemptFullSchedule();
    attempts++;
  }
  
  if (!finalSchedule) {
      finalSchedule = [];
      const days = [...week1Days, ...week2Days];
      allMatches.forEach((m, i) => {
          if(i < days.length * 2) {
             finalSchedule.push({...m, date: days[Math.floor(i/2)], time: i%2===0?'17:00':'19:30'});
          }
      });
  }

  week3Days.forEach(day => {
    finalSchedule.push({ id: Date.now() + Math.random(), t1: null, t2: null, date: day, time: '17:00', type: 'tbd', format: 'BO5', status: 'pending' });
  });

  return finalSchedule;
};


// --- 컴포넌트 ---

function LeagueManager() {
  const [leagues, setLeagues] = useState(getLeagues());
  const navigate = useNavigate();
  useEffect(() => setLeagues(getLeagues()), []);
  
  const handleClearData = () => {
    if(window.confirm('저장된 모든 데이터를 초기화하시겠습니까? 실행 후 접속 오류가 해결됩니다.')){
        localStorage.removeItem('lckgm_leagues');
        window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-black text-gray-800 tracking-tight">LCK 매니저 2026</h1>
            <button onClick={handleClearData} className="text-xs text-red-500 underline hover:text-red-700">데이터 초기화 (오류 해결)</button>
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
      matches: [],
      standings: {} // 팀별 승패 기록용
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
        <div className="bg-gray-50 rounded-lg p-4 mb-8 text-sm leading-relaxed border border-gray-100">
          <p className="text-gray-600 font-medium">ℹ️ 난이도가 상승할수록 승리 확률 감소, 재계약 확률 감소, 선수의 기복이 증가하여 전체적으로 운영이 어려워집니다.</p>
          {diff === 'insane' && <p className="text-red-600 font-bold mt-2 animate-pulse">⚠️ 극악 난이도는 운과 실력이 모두 필요한 최악의 시나리오입니다.</p>}
        </div>
        <button onClick={handleStart} className="w-full py-5 rounded-2xl font-black text-xl text-white shadow-lg hover:shadow-xl hover:opacity-90 transition transform hover:-translate-y-1" style={{backgroundColor:current.colors.primary,color:getTextColor(current.colors.primary)}}>2026 시즌 시작하기</button>
      </div>
    </div>
  );
}

// --- Dashboard ---
function Dashboard() {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const [league, setLeague] = useState(null);
  const [viewingTeamId, setViewingTeamId] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [prizeMoney, setPrizeMoney] = useState(0.0);

  // 드래프트 상태
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftPool, setDraftPool] = useState([]);
  const [draftGroups, setDraftGroups] = useState({ baron: [], elder: [] });
  const [draftTurn, setDraftTurn] = useState('user');
  const draftTimeoutRef = useRef(null);

  // 메타 분석 탭 상태
  const [metaRole, setMetaRole] = useState('TOP');

  // 시뮬레이션 결과 모달 상태
  const [matchResult, setMatchResult] = useState(null); // { winner, scoreA, scoreB, logs, picks }

  useEffect(() => {
    const loadData = () => {
      const found = getLeagueById(leagueId);
      if (found) {
        setLeague(found);
        updateLeague(leagueId, { lastPlayed: new Date().toISOString() });
        setViewingTeamId(found.team.id);
      }
    };
    loadData();
  }, [leagueId]);

  const handleMenuClick = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'dashboard' && league) {
      setViewingTeamId(league.team.id);
    }
  };

  if (!league) return <div className="flex h-screen items-center justify-center font-bold text-gray-500">데이터 로딩 중... (응답이 없으면 메인에서 초기화해주세요)</div>;
  
  const myTeam = teams.find(t => String(t.id) === String(league.team.id)) || league.team;
  const viewingTeam = teams.find(t => String(t.id) === String(viewingTeamId)) || myTeam;
  const currentRoster = (playerList || []).filter(p => p.팀 === viewingTeam.name);
  
  const isCaptain = myTeam.id === 1 || myTeam.id === 2; 
  const hasDrafted = league.groups && league.groups.baron && league.groups.baron.length > 0;
  const currentDateDisplay = hasDrafted ? '2026년 1월 8일' : '2026년 1월 1일';

  // --- 경기 시뮬레이션 핸들러 ---
  const handleSimulateMatch = () => {
    const nextMatch = league.matches.find(m => m.status === 'pending' && (m.t1 === myTeam.id || m.t2 === myTeam.id));
    if (!nextMatch) {
      alert("진행할 경기가 없습니다.");
      return;
    }

    const t1 = teams.find(t => t.id === nextMatch.t1);
    const t2 = teams.find(t => t.id === nextMatch.t2);

    // 실제 로스터 가져오기 (players.json 기반) - 포지션 정렬 필요 (TOP, JGL, MID, ADC, SUP 순서라고 가정)
    const positions = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
    const getRoster = (teamName) => {
      const players = playerList.filter(p => p.팀 === teamName);
      return positions.map(pos => players.find(p => p.포지션 === pos) || players[0]); // fallback
    };

    const rosterA = getRoster(t1.name);
    const rosterB = getRoster(t2.name);

    // 시뮬레이션 실행
    const result = simulateMatch(
      { name: t1.name, roster: rosterA },
      { name: t2.name, roster: rosterB }
    );

    setMatchResult(result);

    // 결과 저장 및 상태 업데이트
    const updatedMatches = league.matches.map(m => {
        if (m === nextMatch) {
            return { ...m, status: 'finished', result: { winner: result.winner, score: `${result.scoreA} : ${result.scoreB}` } };
        }
        return m;
    });

    // 순위표 업데이트 로직 (간단 구현: standings 객체에 승패 저장)
    const newStandings = { ...(league.standings || {}) };
    const winnerId = result.winner === t1.name ? t1.id : t2.id;
    const loserId = result.winner === t1.name ? t2.id : t1.id;
    
    if(!newStandings[winnerId]) newStandings[winnerId] = { w: 0, l: 0, diff: 0 };
    if(!newStandings[loserId]) newStandings[loserId] = { w: 0, l: 0, diff: 0 };

    newStandings[winnerId].w += 1;
    newStandings[winnerId].diff += (Math.abs(result.scoreA - result.scoreB));
    newStandings[loserId].l += 1;
    newStandings[loserId].diff -= (Math.abs(result.scoreA - result.scoreB));

    updateLeague(league.id, { matches: updatedMatches, standings: newStandings });
    setLeague(prev => ({ ...prev, matches: updatedMatches, standings: newStandings }));
  };

  const closeMatchResult = () => {
    setMatchResult(null);
  };

  // --- 드래프트 로직 ---
  const handleDraftStart = () => {
    if (hasDrafted) return;
    setIsDrafting(true);
    const pool = teams.filter(t => t.id !== 1 && t.id !== 2);
    setDraftPool(pool);
    setDraftGroups({ baron: [1], elder: [2] }); 

    if (isCaptain) {
        if (myTeam.id === 1) { setDraftTurn('user'); } 
        else { setDraftTurn('cpu'); triggerCpuPick(pool, { baron: [1], elder: [2] }, 'cpu'); }
    } else {
        handleAutoDraft(pool);
    }
  };

  const pickComputerTeam = (available) => {
    const sorted = [...available].sort((a, b) => b.power - a.power);
    const topTeam = sorted[0];
    const topPower = topTeam.power;
    let chance = 0.5;
    if (topPower >= 84) chance = 0.90; else if (topPower >= 80) chance = 0.70;
    if (Math.random() < chance) return topTeam;
    if (available.length > 1) {
        const others = available.filter(t => t.id !== topTeam.id);
        return others[Math.floor(Math.random() * others.length)];
    }
    return topTeam;
  };

  const triggerCpuPick = (currentPool, currentGroups, turn) => {
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
    if (newPool.length === 0) finalizeDraft(newGroups); else triggerCpuPick(newPool, newGroups, 'cpu');
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
    if (updated) {
      setLeague(updated);
      setTimeout(() => { setIsDrafting(false); setActiveTab('standings'); alert("팀 구성 및 일정이 완료되었습니다!"); }, 500);
    }
  };

  const handlePrevTeam = () => { const idx = teams.findIndex(t => t.id === viewingTeam.id); setViewingTeamId(teams[(idx - 1 + teams.length) % teams.length].id); };
  const handleNextTeam = () => { const idx = teams.findIndex(t => t.id === viewingTeam.id); setViewingTeamId(teams[(idx + 1) % teams.length].id); };

  const menuItems = [
    { id: 'dashboard', name: '대시보드', icon: '📊' },
    { id: 'roster', name: '로스터', icon: '👥' },
    { id: 'standings', name: '순위표', icon: '🏆' },
    { id: 'finance', name: '재정', icon: '💰' }, 
    { id: 'schedule', name: '일정', icon: '📅' },
    { id: 'team_schedule', name: '팀 일정', icon: '📅' },
    { id: 'meta', name: '메타', icon: '📈' }, 
  ];

  const nextMatch = league.matches ? league.matches.find(m => m.status === 'pending' && (m.t1 === myTeam.id || m.t2 === myTeam.id)) : null;
  const t1 = nextMatch ? teams.find(t=>t.id===nextMatch.t1) : null;
  const t2 = nextMatch ? teams.find(t=>t.id===nextMatch.t2) : null;
  const opponentId = nextMatch ? (nextMatch.t1 === myTeam.id ? nextMatch.t2 : nextMatch.t1) : null;
  const oppRecord = opponentId && league.standings && league.standings[opponentId] ? league.standings[opponentId] : { w: 0, l: 0 }; 
  const myRecord = league.standings && league.standings[myTeam.id] ? league.standings[myTeam.id] : { w: 0, l: 0 };

  // 재정 탭 데이터
  const finance = teamFinanceData[viewingTeam.name] || { total_expenditure: 0, cap_expenditure: 0, luxury_tax: 0 };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans relative">
      
      {/* Simulation Result Modal */}
      {matchResult && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="text-center border-b pb-4 mb-4">
                    <h2 className="text-2xl font-black mb-1">경기 결과</h2>
                    <div className="text-4xl font-black text-blue-600 my-4">
                        {matchResult.scoreA} : {matchResult.scoreB}
                    </div>
                    <div className="text-lg font-bold">
                        Winner: <span className="text-blue-600">{matchResult.winner}</span>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-4 px-2">
                    {/* 밴픽 정보 */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <h4 className="font-bold text-gray-500 mb-2 text-center">블루 팀 Pick</h4>
                            {matchResult.picks.A.map((p, i) => (
                                <div key={i} className="flex justify-between bg-blue-50 p-2 rounded mb-1">
                                    <span>{p.champName}</span>
                                    <span className="text-xs text-gray-400">{p.tier}티어</span>
                                </div>
                            ))}
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-500 mb-2 text-center">레드 팀 Pick</h4>
                            {matchResult.picks.B.map((p, i) => (
                                <div key={i} className="flex justify-between bg-red-50 p-2 rounded mb-1">
                                    <span>{p.champName}</span>
                                    <span className="text-xs text-gray-400">{p.tier}티어</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 로그 */}
                    <div className="bg-gray-100 p-4 rounded-lg text-sm space-y-2">
                        {matchResult.logs.map((log, idx) => (
                            <div key={idx} className="border-b border-gray-200 last:border-0 pb-1 last:pb-0">{log}</div>
                        ))}
                    </div>
                </div>

                <button onClick={closeMatchResult} className="mt-6 w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition">
                    닫기
                </button>
            </div>
        </div>
      )}

      {/* Draft Modal */}
      {isDrafting && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full text-center shadow-2xl overflow-hidden relative min-h-[500px] flex flex-col">
            <h2 className="text-3xl font-black mb-2">{isCaptain ? "팀 드래프트 진행" : "조 추첨 진행 중..."}</h2>
            {!isCaptain ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-500">젠지와 한화생명이 팀을 고르고 있습니다...</p>
                </div>
            ) : (
                <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center bg-gray-100 p-4 rounded-lg mb-6">
                        <div className={`w-1/3 p-3 rounded-lg ${draftTurn === (myTeam.id===1?'user':'cpu') ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-white'}`}>
                            <span className="font-bold text-lg block mb-1">GEN (Baron)</span>
                            <div className="flex flex-wrap gap-1 justify-center">{draftGroups.baron.map(id => <span key={id} className="text-xs bg-gray-800 text-white px-2 py-1 rounded">{teams.find(t=>t.id===id)?.name}</span>)}</div>
                        </div>
                        <div className="w-1/3 text-xl font-bold text-gray-400">VS</div>
                        <div className={`w-1/3 p-3 rounded-lg ${draftTurn === (myTeam.id===2?'user':'cpu') ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-white'}`}>
                            <span className="font-bold text-lg block mb-1">HLE (Elder)</span>
                            <div className="flex flex-wrap gap-1 justify-center">{draftGroups.elder.map(id => <span key={id} className="text-xs bg-gray-800 text-white px-2 py-1 rounded">{teams.find(t=>t.id===id)?.name}</span>)}</div>
                        </div>
                    </div>
                    <div className="text-left mb-2 font-bold text-gray-700">{draftTurn === 'user' ? "👉 영입할 팀을 선택하세요!" : "🤖 상대가 고민 중입니다..."}</div>
                    <div className="grid grid-cols-4 gap-3 overflow-y-auto max-h-[300px] p-2">
                        {draftPool.map(t => (
                            <button key={t.id} onClick={() => handleUserPick(t.id)} disabled={draftTurn !== 'user'}
                                className={`p-4 rounded-xl border-2 transition flex flex-col items-center gap-2 hover:shadow-md ${draftTurn === 'user' ? 'bg-white border-gray-200 hover:border-blue-500 cursor-pointer' : 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'}`}>
                                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-sm" style={{backgroundColor:t.colors.primary}}>{t.name}</div>
                                <div className="font-bold text-sm">{t.fullName}</div>
                                <div className="text-xs bg-gray-100 px-2 py-1 rounded">전력 {t.power}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
          </div>
        </div>
      )}

      {/* Sidebar (Left Menu) */}
      <aside className="w-64 bg-gray-900 text-gray-300 flex-shrink-0 flex flex-col shadow-xl z-20">
        <div className="p-5 bg-gray-800 border-b border-gray-700 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-lg" style={{backgroundColor: myTeam.colors.primary}}>{myTeam.name}</div>
          <div><div className="text-white font-bold text-sm leading-tight">{myTeam.fullName}</div><div className="text-xs text-gray-400">GM 모드</div></div>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {menuItems.map(item => (
            <button key={item.id} onClick={() => handleMenuClick(item.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === item.id ? 'bg-blue-600 text-white shadow-md translate-x-1' : 'hover:bg-gray-800 hover:text-white hover:translate-x-1'}`}><span>{item.icon}</span> {item.name}</button>
          ))}
        </div>
        <div className="p-4 border-t border-gray-700 bg-gray-800"><button onClick={() => navigate('/')} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition"><span>🚪</span> 메인으로 나가기</button></div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b h-14 flex items-center justify-between px-6 shadow-sm z-10 flex-shrink-0">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">📅</span> {currentDateDisplay}</div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">🏆</span> {myRecord.w}승 {myRecord.l}패</div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">💰</span> 상금: {prizeMoney.toFixed(1)}억</div>
          </div>
          <button onClick={handleDraftStart} disabled={hasDrafted} className={`px-6 py-1.5 rounded-full font-bold text-sm shadow-sm transition flex items-center gap-2 ${hasDrafted ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white animate-pulse'}`}>
            <span>▶</span> {hasDrafted ? "다음 경기 대기 중" : (isCaptain ? "LCK 컵 팀 선정하기" : "LCK 컵 조 확인하기")}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-7xl mx-auto">
            
            {activeTab === 'dashboard' && (
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-8 bg-white rounded-lg border shadow-sm p-5 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl">📅</div>
                   <h3 className="text-lg font-bold text-gray-800 mb-2">다음 경기 일정</h3>
                   <div className="flex items-center justify-between bg-gray-50 rounded-xl p-6 border">
                      <div className="text-center w-1/3"><div className="text-4xl font-black text-gray-800 mb-2">{myTeam.name}</div><div className="text-sm font-bold text-gray-500">{myRecord.w} - {myRecord.l}</div></div>
                      <div className="text-center w-1/3 flex flex-col items-center">
                        <div className="text-xs font-bold text-gray-400 uppercase">VS</div><div className="text-3xl font-bold text-gray-300 my-2">@</div>
                        {nextMatch ? (
                          <div className="mt-1 flex flex-col items-center">
                            <span className="text-base font-black text-blue-600">{nextMatch.date}</span>
                            <span className="text-sm font-bold text-gray-600">{nextMatch.time}</span>
                            <span className="mt-2 text-xs font-bold text-white bg-blue-600 px-3 py-1 rounded-full shadow-sm">{nextMatch.format}</span>
                            <button onClick={handleSimulateMatch} className="mt-3 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg shadow animate-bounce">
                                ⚔️ 경기 시작 (시뮬레이션)
                            </button>
                          </div>
                        ) : <div className="text-xs font-bold text-blue-600">모든 일정 종료 또는 대기 중</div>}
                      </div>
                      <div className="text-center w-1/3">
                        {nextMatch ? (
                          <>
                            <div className="text-4xl font-black text-gray-800 mb-2">{myTeam.id === t1.id ? t2.name : t1.name}</div>
                            <div className="text-sm font-bold text-gray-500">상대팀 <span className="text-xs font-normal text-gray-400">({oppRecord.w}승 {oppRecord.l}패)</span></div>
                          </>
                        ) : (
                          <>
                            <div className="text-4xl font-black text-gray-300 mb-2">미정</div>
                            <div className="text-sm font-bold text-gray-400">상대팀</div>
                          </>
                        )}
                      </div>
                   </div>
                </div>
                
                {/* --- 대시보드 우측 미니 순위표 --- */}
                <div className="col-span-12 lg:col-span-4 flex flex-col h-full max-h-[500px]">
                   {hasDrafted ? (
                     <div className="bg-white rounded-lg border shadow-sm p-4 h-full overflow-y-auto">
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-2 border-b pb-2">
                                <span className="text-lg">🟣</span>
                                <span className="font-black text-sm text-gray-700">바론 그룹 (Baron)</span>
                            </div>
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 text-gray-400">
                                <tr><th className="p-2 text-center w-8">#</th><th className="p-2 text-left">팀</th><th className="p-2 text-center w-8">승</th><th className="p-2 text-center w-8">패</th><th className="p-2 text-center w-10">득실</th></tr>
                              </thead>
                              <tbody>
                                {(league.groups.baron || []).map((id, idx) => {
                                   const t = teams.find(team => team.id === id);
                                   if(!t) return null;
                                   const isMyTeam = myTeam.id === id;
                                   const rec = league.standings && league.standings[id] ? league.standings[id] : {w:0, l:0, diff:0};
                                   return (
                                     <tr key={id} onClick={() => setViewingTeamId(id)} className={`cursor-pointer border-b last:border-0 transition-colors ${isMyTeam ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-50'}`}>
                                       <td className="p-2 text-center font-bold text-gray-500">{idx+1}</td>
                                       <td className="p-2 font-bold"><span className={`${isMyTeam ? 'text-blue-700' : 'text-gray-800'} hover:underline`}>{t.fullName}</span></td>
                                       <td className="p-2 text-center">{rec.w}</td><td className="p-2 text-center">{rec.l}</td><td className="p-2 text-center text-gray-400">{rec.diff}</td>
                                     </tr>
                                   );
                                })}
                              </tbody>
                            </table>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-2 border-b pb-2">
                                <span className="text-lg">🔴</span>
                                <span className="font-black text-sm text-gray-700">장로 그룹 (Elder)</span>
                            </div>
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 text-gray-400">
                                <tr><th className="p-2 text-center w-8">#</th><th className="p-2 text-left">팀</th><th className="p-2 text-center w-8">승</th><th className="p-2 text-center w-8">패</th><th className="p-2 text-center w-10">득실</th></tr>
                              </thead>
                              <tbody>
                                {(league.groups.elder || []).map((id, idx) => {
                                   const t = teams.find(team => team.id === id);
                                   if(!t) return null;
                                   const isMyTeam = myTeam.id === id;
                                   const rec = league.standings && league.standings[id] ? league.standings[id] : {w:0, l:0, diff:0};
                                   return (
                                     <tr key={id} onClick={() => setViewingTeamId(id)} className={`cursor-pointer border-b last:border-0 transition-colors ${isMyTeam ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-50'}`}>
                                       <td className="p-2 text-center font-bold text-gray-500">{idx+1}</td>
                                       <td className="p-2 font-bold"><span className={`${isMyTeam ? 'text-blue-700' : 'text-gray-800'} hover:underline`}>{t.fullName}</span></td>
                                       <td className="p-2 text-center">{rec.w}</td><td className="p-2 text-center">{rec.l}</td><td className="p-2 text-center text-gray-400">{rec.diff}</td>
                                     </tr>
                                   );
                                })}
                              </tbody>
                            </table>
                        </div>
                     </div>
                   ) : (
                     <div className="bg-white rounded-lg border shadow-sm p-0 flex-1 flex flex-col">
                       <div className="p-3 border-b bg-gray-50 font-bold text-sm text-gray-700 flex justify-between"><span>순위표 (프리시즌)</span><span onClick={()=>setActiveTab('standings')} className="text-xs text-blue-600 cursor-pointer hover:underline">전체 보기</span></div>
                       <div className="flex-1 overflow-y-auto p-0">
                         <table className="w-full text-xs">
                           <thead className="bg-gray-50 text-gray-400">
                             <tr><th className="p-2 text-center w-8">#</th><th className="p-2 text-left">팀</th><th className="p-2 text-right">기록</th></tr>
                           </thead>
                           <tbody>
                             {teams.map((t, i) => { 
                               const isMyTeam = myTeam.id === t.id; 
                               return (
                                 <tr key={t.id} onClick={() => setViewingTeamId(t.id)} className={`cursor-pointer border-b last:border-0 transition-colors duration-150 ${isMyTeam ? 'bg-blue-100 border-l-4 border-blue-600' : 'hover:bg-gray-50'}`}>
                                   <td className="p-2 font-bold text-gray-500 text-center w-8">{i + 1}</td>
                                   <td className="p-2 font-bold">
                                     <span className="text-blue-600 hover:text-blue-800 hover:underline decoration-blue-400 decoration-2 underline-offset-2">{t.fullName}</span>
                                     {isMyTeam && <span className="ml-1 text-xs text-gray-500 font-normal">(선택됨)</span>}
                                   </td>
                                   <td className="p-2 text-right text-gray-500">0-0</td>
                                 </tr>
                               ); 
                             })}
                           </tbody>
                         </table>
                       </div>
                     </div>
                   )}
                </div>

                <div className="col-span-12 bg-white rounded-lg border shadow-sm flex flex-col min-h-[500px]">
                  <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-sm" style={{backgroundColor: viewingTeam.colors.primary}}>{viewingTeam.name}</div><div><h2 className="text-2xl font-black text-gray-800">{viewingTeam.fullName}</h2><p className="text-xs font-bold text-gray-500 uppercase tracking-wide">로스터 요약</p></div></div>
                    <button onClick={()=>setActiveTab('roster')} className="text-sm font-bold text-blue-600 hover:underline">상세 정보 보기 →</button>
                  </div>
                  <div className="p-0 overflow-x-auto">
                    {/* 대시보드 로스터 테이블 수정: 순서 변경 및 CSS 개선 */}
                    <table className="w-full text-sm whitespace-nowrap"><thead className="bg-white text-gray-400 text-xs uppercase font-bold border-b"><tr><th className="py-3 px-6 text-left">포지션</th><th className="py-3 px-6 text-left">이름</th><th className="py-3 px-6 text-center">종합</th><th className="py-3 px-6 text-center">나이</th><th className="py-3 px-6 text-center">경력</th><th className="py-3 px-6 text-center">소속</th><th className="py-3 px-6 text-center">연봉</th><th className="py-3 px-6 text-center">잠재력</th><th className="py-3 px-6 text-left">계약</th></tr></thead><tbody className="divide-y divide-gray-100">{currentRoster.length > 0 ? currentRoster.map((p, i) => (<tr key={i} className="hover:bg-gray-50 transition"><td className="py-3 px-6 font-bold text-gray-400 w-16">{p.포지션}</td><td className="py-3 px-6 font-bold text-gray-800">{p.이름} <span className="text-gray-400 font-normal text-xs ml-1">({p.실명})</span> {p.주장 && <span className="ml-1 text-yellow-500" title="주장">👑</span>}</td><td className="py-3 px-6 text-center"><span className={`inline-flex items-center justify-center w-10 h-8 rounded-lg font-black text-sm shadow-sm border ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td><td className="py-3 px-6 text-center text-gray-600">{p.나이 || '-'}</td><td className="py-3 px-6 text-center text-gray-600">{p.경력 || '-'}</td><td className="py-3 px-6 text-center text-gray-700">{p['팀 소속기간'] || '-'}</td><td className="py-3 px-6 text-center text-gray-700 font-bold">{p.연봉 || '-'}</td><td className="py-3 px-6 text-center"><span className={`text-xs ${getPotBadgeStyle(p.잠재력)}`}>{p.잠재력}</span></td><td className="py-3 px-6 text-gray-500 text-xs">{p.계약}년 만료</td></tr>)) : <tr><td colSpan="9" className="py-10 text-center text-gray-300">데이터 없음</td></tr>}</tbody></table>
                  </div>
                </div>
              </div>
            )}

            {/* --- (수정됨) 메인 순위표 페이지 --- */}
            {activeTab === 'standings' && (
               <div className="flex flex-col gap-6">
                 <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                   🏆 2026 LCK 컵 순위표
                 </h2>
                 {hasDrafted ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                           <div className="p-4 bg-purple-50 border-b border-purple-100 flex items-center gap-2">
                              <span className="text-2xl">🟣</span>
                              <h3 className="font-black text-lg text-purple-900">바론 그룹 (Baron Group)</h3>
                           </div>
                           <table className="w-full text-sm">
                              <thead className="bg-gray-50 text-gray-500 font-bold border-b">
                                <tr>
                                  <th className="py-3 px-4 text-center">순위</th>
                                  <th className="py-3 px-4 text-left">팀</th>
                                  <th className="py-3 px-4 text-center">승</th>
                                  <th className="py-3 px-4 text-center">패</th>
                                  <th className="py-3 px-4 text-center">득실</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {league.groups.baron.map((id, idx) => {
                                  const t = teams.find(team => team.id === id);
                                  const isMyTeam = myTeam.id === id;
                                  const rec = league.standings && league.standings[id] ? league.standings[id] : {w:0, l:0, diff:0};
                                  return (
                                    <tr key={id} onClick={() => setViewingTeamId(id)} className={`cursor-pointer hover:bg-gray-50 transition ${isMyTeam ? 'bg-purple-50' : ''}`}>
                                      <td className="py-3 px-4 text-center font-bold text-gray-600">{idx + 1}</td>
                                      <td className="py-3 px-4 font-bold text-gray-800 flex items-center gap-2">
                                         <div className="w-6 h-6 rounded-full text-white text-[10px] flex items-center justify-center" style={{backgroundColor: t.colors.primary}}>{t.name}</div>
                                         {t.fullName}
                                      </td>
                                      <td className="py-3 px-4 text-center font-bold text-blue-600">{rec.w}</td>
                                      <td className="py-3 px-4 text-center font-bold text-red-600">{rec.l}</td>
                                      <td className="py-3 px-4 text-center text-gray-500">{rec.diff}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                           </table>
                        </div>

                        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                           <div className="p-4 bg-red-50 border-b border-red-100 flex items-center gap-2">
                              <span className="text-2xl">🔴</span>
                              <h3 className="font-black text-lg text-red-900">장로 그룹 (Elder Group)</h3>
                           </div>
                           <table className="w-full text-sm">
                              <thead className="bg-gray-50 text-gray-500 font-bold border-b">
                                <tr>
                                  <th className="py-3 px-4 text-center">순위</th>
                                  <th className="py-3 px-4 text-left">팀</th>
                                  <th className="py-3 px-4 text-center">승</th>
                                  <th className="py-3 px-4 text-center">패</th>
                                  <th className="py-3 px-4 text-center">득실</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {league.groups.elder.map((id, idx) => {
                                  const t = teams.find(team => team.id === id);
                                  const isMyTeam = myTeam.id === id;
                                  const rec = league.standings && league.standings[id] ? league.standings[id] : {w:0, l:0, diff:0};
                                  return (
                                    <tr key={id} onClick={() => setViewingTeamId(id)} className={`cursor-pointer hover:bg-gray-50 transition ${isMyTeam ? 'bg-red-50' : ''}`}>
                                      <td className="py-3 px-4 text-center font-bold text-gray-600">{idx + 1}</td>
                                      <td className="py-3 px-4 font-bold text-gray-800 flex items-center gap-2">
                                         <div className="w-6 h-6 rounded-full text-white text-[10px] flex items-center justify-center" style={{backgroundColor: t.colors.primary}}>{t.name}</div>
                                         {t.fullName}
                                      </td>
                                      <td className="py-3 px-4 text-center font-bold text-blue-600">{rec.w}</td>
                                      <td className="py-3 px-4 text-center font-bold text-red-600">{rec.l}</td>
                                      <td className="py-3 px-4 text-center text-gray-500">{rec.diff}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                           </table>
                        </div>
                    </div>
                 ) : (
                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                       <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                          <h3 className="font-bold text-gray-700">전체 팀 현황 (Pre-Season)</h3>
                          <span className="text-xs font-bold text-gray-400">총 10개 팀</span>
                       </div>
                       <table className="w-full text-sm">
                          <thead className="bg-white text-gray-500 font-bold border-b">
                            <tr>
                              <th className="py-4 px-6 text-center w-16">순위</th>
                              <th className="py-4 px-6 text-left">팀 정보</th>
                              <th className="py-4 px-6 text-center">승</th>
                              <th className="py-4 px-6 text-center">패</th>
                              <th className="py-4 px-6 text-center">득실</th>
                              <th className="py-4 px-6 text-center">최근 5경기</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                             {teams.map((t, idx) => {
                               const isMyTeam = myTeam.id === t.id;
                               return (
                                 <tr key={t.id} onClick={() => setViewingTeamId(t.id)} className={`cursor-pointer hover:bg-blue-50 transition ${isMyTeam ? 'bg-blue-50' : ''}`}>
                                    <td className="py-4 px-6 text-center font-bold text-gray-600">{idx + 1}</td>
                                    <td className="py-4 px-6">
                                       <div className="flex items-center gap-4">
                                          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-md" style={{backgroundColor: t.colors.primary}}>{t.name}</div>
                                          <div>
                                             <div className="font-bold text-gray-900 text-base">{t.fullName}</div>
                                             <div className="text-xs text-gray-400">{t.description}</div>
                                          </div>
                                       </div>
                                    </td>
                                    <td className="py-4 px-6 text-center font-bold text-gray-400">-</td>
                                    <td className="py-4 px-6 text-center font-bold text-gray-400">-</td>
                                    <td className="py-4 px-6 text-center font-bold text-gray-400">-</td>
                                    <td className="py-4 px-6 text-center text-xs text-gray-400">기록 없음</td>
                                 </tr>
                               );
                             })}
                          </tbody>
                       </table>
                    </div>
                 )}
               </div>
            )}

            {/* --- (추가됨) 재정 탭 --- */}
            {activeTab === 'finance' && (
              <div className="bg-white rounded-lg border shadow-sm flex flex-col">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                  <div className="flex items-center gap-4">
                    <button onClick={handlePrevTeam} className="p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition">◀</button>
                    <div className="flex items-center gap-4"><div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-white shadow-lg text-xl" style={{backgroundColor: viewingTeam.colors.primary}}>{viewingTeam.name}</div><div><h2 className="text-3xl font-black text-gray-900">{viewingTeam.fullName}</h2><p className="text-sm font-bold text-gray-500 mt-1">2026 시즌 재정 현황</p></div></div>
                    <button onClick={handleNextTeam} className="p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition">▶</button>
                  </div>
                </div>
                <div className="p-8">
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div className="bg-gray-50 p-6 rounded-xl border">
                            <h3 className="text-lg font-bold text-gray-700 mb-4">💰 지출 현황 (단위: 억)</h3>
                            <div className="flex items-end gap-8 h-48">
                                <div className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                                    <span className="font-bold text-blue-600 text-xl">{finance.total_expenditure}억</span>
                                    <div className="w-full bg-blue-500 rounded-t-lg transition-all duration-500" style={{height: `${Math.min(finance.total_expenditure / 1.5, 100)}%`}}></div>
                                    <span className="font-bold text-gray-600">총 지출 (추정)</span>
                                </div>
                                <div className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                                    <span className="font-bold text-purple-600 text-xl">{finance.cap_expenditure}억</span>
                                    <div className="w-full bg-purple-500 rounded-t-lg transition-all duration-500" style={{height: `${Math.min(finance.cap_expenditure / 1.5, 100)}%`}}></div>
                                    <span className="font-bold text-gray-600">샐러리캡 반영</span>
                                </div>
                                <div className="flex flex-col items-center gap-2 flex-1 h-full justify-end relative">
                                    <div className="absolute top-10 border-b-2 border-dashed border-red-400 w-full text-center text-xs text-red-400 font-bold">상한선 80억</div>
                                    <span className="font-bold text-gray-400 text-xl">80억</span>
                                    <div className="w-full bg-gray-200 rounded-t-lg" style={{height: '53%'}}></div>
                                    <span className="font-bold text-gray-400">규정 상한선</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-50 p-6 rounded-xl border flex flex-col justify-center items-center">
                            <h3 className="text-lg font-bold text-gray-700 mb-2">💸 사치세 (Luxury Tax)</h3>
                            <div className="text-5xl font-black text-red-600 my-4">{finance.luxury_tax > 0 ? `${finance.luxury_tax}억` : '없음'}</div>
                            <div className="text-sm text-gray-500 text-center">
                                {finance.luxury_tax > 0 ? (
                                    finance.cap_expenditure >= 80 
                                    ? <span>상한선(80억) 초과!<br/>기본 10억 + 초과분({(finance.cap_expenditure - 80).toFixed(1)}억)의 50% 부과</span>
                                    : <span>균형 지출 구간(40~80억) 초과<br/>초과분({(finance.cap_expenditure - 40).toFixed(1)}억)의 25% 부과</span>
                                ) : (
                                    <span className="text-green-600 font-bold">건전한 재정 상태입니다.</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'roster' && (
              <div className="bg-white rounded-lg border shadow-sm flex flex-col">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                  <div className="flex items-center gap-4">
                    <button onClick={handlePrevTeam} className="p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition">◀</button>
                    <div className="flex items-center gap-4"><div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-white shadow-lg text-xl" style={{backgroundColor: viewingTeam.colors.primary}}>{viewingTeam.name}</div><div><h2 className="text-3xl font-black text-gray-900">{viewingTeam.fullName}</h2><p className="text-sm font-bold text-gray-500 mt-1">상세 로스터 및 계약 현황</p></div></div>
                    <button onClick={handleNextTeam} className="p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition">▶</button>
                  </div>
                  <div className="text-right"><div className="text-2xl font-black text-blue-600">{viewingTeam.power} <span className="text-sm text-gray-400 font-normal">TEAM OVR</span></div></div>
                </div>
                <div className="overflow-x-auto">
                    {/* 로스터 표시 순서 변경 및 한 줄 표시 (whitespace-nowrap) */}
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-white text-gray-500 text-xs uppercase font-bold border-b">
                            <tr>
                                <th className="py-4 px-6 bg-gray-50 sticky left-0 z-10">정보</th>
                                <th className="py-4 px-4 text-center">종합</th>
                                <th className="py-4 px-4 text-center">나이</th>
                                <th className="py-4 px-4 text-center">경력</th>
                                <th className="py-4 px-4 text-center">소속</th>
                                <th className="py-4 px-4 text-center">연봉</th>
                                <th className="py-4 px-4 text-center bg-gray-50 border-l">라인전</th>
                                <th className="py-4 px-4 text-center bg-gray-50">무력</th>
                                <th className="py-4 px-4 text-center bg-gray-50">한타</th>
                                <th className="py-4 px-4 text-center bg-gray-50">성장</th>
                                <th className="py-4 px-4 text-center bg-gray-50">안정성</th>
                                <th className="py-4 px-4 text-center bg-gray-50">운영</th>
                                <th className="py-4 px-4 text-center bg-gray-50 border-l text-purple-600">잠재력</th>
                                <th className="py-4 px-6 text-left bg-gray-50 border-l">계약 정보</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {currentRoster.map((p, i) => (
                                <tr key={i} className="hover:bg-blue-50/30 transition group">
                                    <td className="py-4 px-6 sticky left-0 bg-white group-hover:bg-blue-50/30">
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-gray-400 w-8">{p.포지션}</span>
                                            <div>
                                                <div className="font-bold text-gray-900 text-base">{p.이름} <span className="text-gray-400 font-normal text-xs ml-1">({p.실명})</span> {p.주장 && <span className="ml-1 text-yellow-500" title="주장">👑</span>}</div>
                                                <div className="text-xs text-gray-400">{p.특성}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-center"><span className={`inline-flex items-center justify-center w-10 h-8 rounded-lg font-black text-sm shadow-sm border ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td>
                                    <td className="py-4 px-4 text-center text-gray-600">{p.나이 || '-'}</td>
                                    <td className="py-4 px-4 text-center text-gray-600">{p.경력 || '-'}</td>
                                    <td className="py-4 px-4 text-center text-gray-700">{p['팀 소속기간'] || '-'}</td>
                                    <td className="py-4 px-4 text-center font-bold text-gray-800">{p.연봉 || '-'}</td>
                                    <td className="py-4 px-4 text-center border-l font-medium text-gray-600">{p.상세?.라인전 || '-'}</td>
                                    <td className="py-4 px-4 text-center font-medium text-gray-600">{p.상세?.무력 || '-'}</td>
                                    <td className="py-4 px-4 text-center font-medium text-gray-600">{p.상세?.한타 || '-'}</td>
                                    <td className="py-4 px-4 text-center font-medium text-gray-600">{p.상세?.성장 || '-'}</td>
                                    <td className="py-4 px-4 text-center font-medium text-gray-600">{p.상세?.안정성 || '-'}</td>
                                    <td className="py-4 px-4 text-center font-medium text-gray-600">{p.상세?.운영 || '-'}</td>
                                    <td className="py-4 px-4 text-center border-l"><span className={`font-bold ${getPotBadgeStyle(p.잠재력)}`}>{p.잠재력}</span></td>
                                    <td className="py-4 px-6 border-l"><span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">{p.계약}년 만료</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </div>
            )}

            {activeTab === 'meta' && (
              <div className="bg-white rounded-lg border shadow-sm p-8 min-h-[600px] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                    <span className="text-purple-600">📈</span> 16.01 패치 메타
                  </h2>
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    {['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map(role => (
                      <button
                        key={role}
                        onClick={() => setMetaRole(role)}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition ${metaRole === role ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {championList
                    .filter(c => c.role === metaRole)
                    .map((champ, idx) => (
                      <div key={champ.id} className="border rounded-xl p-4 flex items-center justify-between hover:bg-gray-50 transition group">
                        <div className="flex items-center gap-4 w-1/4">
                          <span className={`text-2xl font-black w-10 text-center ${idx < 3 ? 'text-yellow-500' : 'text-gray-300'}`}>{idx + 1}</span>
                          <div>
                            <div className="font-bold text-lg text-gray-800">{champ.name}</div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${champ.tier === 1 ? 'bg-purple-100 text-purple-600' : champ.tier === 2 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                              {champ.tier} 티어
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex-1 px-8">
                          <div className="flex justify-between text-xs text-gray-500 mb-1 font-medium">
                            <span>초반 {champ.stats.early}</span>
                            <span>중반 {champ.stats.mid}</span>
                            <span>후반 {champ.stats.late}</span>
                          </div>
                          <div className="h-2.5 bg-gray-100 rounded-full flex overflow-hidden">
                            <div className="bg-green-400 h-full" style={{width: `${champ.stats.early * 10}%`}} />
                            <div className="bg-yellow-400 h-full" style={{width: `${champ.stats.mid * 10}%`}} />
                            <div className="bg-red-400 h-full" style={{width: `${champ.stats.late * 10}%`}} />
                          </div>
                        </div>

                        <div className="w-1/3 text-right">
                          <div className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-wide">Counter Picks</div>
                          <div className="text-sm font-medium text-gray-700">{champ.counters.join(', ')}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {(activeTab === 'schedule' || activeTab === 'team_schedule') && (
              <div className="bg-white rounded-lg border shadow-sm p-8 min-h-[600px] flex flex-col">
                <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
                  📅 {activeTab === 'team_schedule' ? `${myTeam.name} 경기 일정` : '2026 LCK 컵 전체 일정'}
                </h2>
                {hasDrafted ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
                    {league.matches
                      .filter(m => activeTab === 'schedule' || (m.t1 === myTeam.id || m.t2 === myTeam.id))
                      .map((m, i) => {
                      const t1 = m.t1 ? teams.find(t => t.id === m.t1) : { name: 'TBD' };
                      const t2 = m.t2 ? teams.find(t => t.id === m.t2) : { name: 'TBD' };
                      const isMyMatch = myTeam.id === m.t1 || myTeam.id === m.t2;
                      const isFinished = m.status === 'finished';
                      return (
                        <div key={i} className={`p-4 rounded-lg border flex flex-col gap-2 ${isMyMatch ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-white border-gray-200'}`}>
                          <div className="flex justify-between text-xs font-bold text-gray-500">
                            <span>{m.date} {m.time}</span>
                            <span>{m.type === 'super' ? '🔥 슈퍼위크' : (m.type === 'tbd' ? '🔒 미정' : '정규시즌')}</span>
                          </div>
                          <div className="flex justify-between items-center mt-2">
                            <div className="flex flex-col items-center w-1/3">
                                <span className={`font-bold ${isMyMatch && myTeam.id === m.t1 ? 'text-blue-600' : 'text-gray-800'}`}>{t1.name}</span>
                                {isFinished && m.result.winner === t1.name && <span className="text-xs text-blue-500 font-bold">WIN</span>}
                            </div>
                            <div className="text-center font-bold">
                                {isFinished ? (
                                    <span className="text-xl text-gray-800">{m.result.score}</span>
                                ) : (
                                    <span className="text-gray-400">VS</span>
                                )}
                            </div>
                            <div className="flex flex-col items-center w-1/3">
                                <span className={`font-bold ${isMyMatch && myTeam.id === m.t2 ? 'text-blue-600' : 'text-gray-800'}`}>{t2.name}</span>
                                {isFinished && m.result.winner === t2.name && <span className="text-xs text-blue-500 font-bold">WIN</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400"><div className="text-4xl mb-4">🗳️</div><div className="text-xl font-bold">일정이 생성되지 않았습니다</div><p className="mt-2">먼저 조 추첨을 진행해주세요.</p></div>
                )}
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LeagueManager />} />
      <Route path="/new-league" element={<TeamSelection />} />
      <Route path="/league/:leagueId" element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import playerList from './data/players.json';
import championList from './data/champions.json';

// ==========================================
// 0. 시뮬레이션 엔진 및 상수
// ==========================================

const GAME_CONSTANTS = {
  DRAGONS: {
    TYPES: ['화학공학', '바람', '대지', '화염', '바다', '마법공학'],
    BUFFS: {
      '화학공학': { description: '강인함 및 회복' },
      '바람': { description: '이속 증가' },
      '대지': { description: '방어력 증가' },
      '화염': { description: '공격력 증가' },
      '바다': { description: '체력 재생' },
      '마법공학': { description: '스킬 가속' }
    }
  },
  ROLE_QUEST_BONUS: {
    TOP: { effect: { splitPushPower: 1.1 } },
    MID: { effect: { roamingSpeed: 1.1 } },
    ADC: { effect: { damageMultiplier: 1.15 } }
  }
};

const SIM_CONSTANTS = {
  WEIGHTS: { STATS: 0.55, META: 0.25, MASTERY: 0.20 },
  META_COEFF: {
    STANDARD: { 1: 1.0, 2: 0.95, 3: 0.90, 4: 0.85, 5: 0.80 },
    ADC: { 1: 1.0, 2: 0.92, 3: 0.84 }
  },
  VAR_RANGE: 0.12
};

// Mock 숙련도 데이터
const MASTERY_MAP = playerList.reduce((acc, player) => {
  acc[player.이름] = { id: player.이름, pool: [] };
  return acc;
}, {});

// 핵심 시뮬레이션 함수 (단판)
function simulateSet(teamA, teamB) {
  const log = [];
  let rawScoreA = 0;
  let rawScoreB = 0;

  // 1. 드래곤 & 밴픽
  const dragonType = GAME_CONSTANTS.DRAGONS.TYPES[Math.floor(Math.random() * GAME_CONSTANTS.DRAGONS.TYPES.length)];
  const picksA = draftTeam(teamA.roster);
  const picksB = draftTeam(teamB.roster);

  log.push(`📢 [Start] ${teamA.name} vs ${teamB.name} (${dragonType} 용)`);

  // 2. 페이즈 계산 (rawScore 누적)
  const p1 = calculatePhase('EARLY', teamA, teamB, picksA, picksB, null, 1.0);
  rawScoreA += p1.scoreA; rawScoreB += p1.scoreB;
  
  const midBonusTeam = p1.scoreA > p1.scoreB ? 'A' : 'B';
  const p2 = calculatePhase('MID', teamA, teamB, picksA, picksB, midBonusTeam, 1.1);
  rawScoreA += p2.scoreA; rawScoreB += p2.scoreB;

  const lateBonusTeam = p2.scoreA > p2.scoreB ? 'A' : 'B';
  const p3 = calculatePhase('LATE', teamA, teamB, picksA, picksB, lateBonusTeam, 1.15);
  rawScoreA += p3.scoreA; rawScoreB += p3.scoreB;

  // 3. 점수 현실화 (Kills 변환)
  // 기존 점수(약 1300~1500)를 75~90으로 나누어 킬 스코어(10~20)로 변환
  const divisor = 75; 
  let killsA = Math.floor(rawScoreA / divisor) + Math.floor(Math.random() * 5);
  let killsB = Math.floor(rawScoreB / divisor) + Math.floor(Math.random() * 5);

  // 승자 결정 (점수가 높은 쪽이 이기되, 킬이 적다면 보정)
  const winnerTeam = rawScoreA > rawScoreB ? teamA : teamB;
  
  if (winnerTeam === teamA && killsA <= killsB) killsA = killsB + Math.floor(Math.random() * 3) + 1;
  if (winnerTeam === teamB && killsB <= killsA) killsB = killsA + Math.floor(Math.random() * 3) + 1;

  // 핵심 로그 3줄만 추출
  const summaryLog = [p1.log, p2.log, p3.log];

  return {
    winner: winnerTeam.name,
    scoreA: killsA,
    scoreB: killsB,
    rawScoreA,
    rawScoreB,
    logs: summaryLog,
    picks: { A: picksA, B: picksB }
  };
}

// BO3 시뮬레이션
function simulateMatchBO3(teamA, teamB) {
    let setsA = 0;
    let setsB = 0;
    const setDetails = [];

    // 최대 3세트 진행
    while (setsA < 2 && setsB < 2) {
        const result = simulateSet(teamA, teamB);
        setDetails.push(result);
        if (result.winner === teamA.name) setsA++;
        else setsB++;
    }

    return {
        winner: setsA > setsB ? teamA.name : teamB.name,
        loser: setsA > setsB ? teamB.name : teamA.name,
        scoreString: `${setsA} : ${setsB}`, // 세트 스코어
        sets: setDetails, // 각 세트별 킬 스코어 및 로그
        diff: Math.abs(setsA - setsB) // 득실차 계산용
    };
}

function draftTeam(roster) {
  return roster.map(player => {
    // 1~2티어 챔피언만 메타픽으로 간주
    const metaPool = championList.filter(c => c.role === player.포지션 && c.tier <= 2);
    // 랜덤 픽
    const selected = metaPool[Math.floor(Math.random() * metaPool.length)] || { name: "Unknown", tier: 3 };
    return {
      champName: selected.name,
      tier: selected.tier || 3
    };
  });
}

function calculatePhase(phase, tA, tB, picksA, picksB, bonusTeam, bonusVal) {
  let powerA = 0;
  let powerB = 0;
  // 간단한 스탯 합산
  for (let i = 0; i < 5; i++) {
    powerA += getPhaseStat(phase, tA.roster[i]);
    powerB += getPhaseStat(phase, tB.roster[i]);
  }
  // 가중치 및 랜덤성
  powerA = powerA * (1 + (Math.random() * 0.2 - 0.1)); 
  powerB = powerB * (1 + (Math.random() * 0.2 - 0.1));

  if (bonusTeam === 'A') powerA *= bonusVal;
  if (bonusTeam === 'B') powerB *= bonusVal;

  return {
    scoreA: powerA,
    scoreB: powerB,
    log: generateLog(phase, powerA, powerB, tA.name, tB.name)
  };
}

function getPhaseStat(phase, player) {
  const s = player.상세 || { 라인전: 80, 무력: 80, 운영: 80, 성장: 80, 한타: 80, 안정성: 80 };
  if (phase === 'EARLY') return (s.라인전 * 0.7) + (s.무력 * 0.3);
  if (phase === 'MID') return (s.운영 * 0.5) + (s.성장 * 0.5);
  return (s.한타 * 0.6) + (s.안정성 * 0.4);
}

function generateLog(phase, sA, sB, nA, nB) {
  const leader = sA > sB ? nA : nB;
  if (phase === 'EARLY') return `⚔️ [초반] ${leader}, 라인전 우위 점령`;
  if (phase === 'MID') return `🗺️ [중반] ${leader}, 오브젝트 한타 승리`;
  return `💥 [후반] ${leader}, 넥서스 파괴!`;
}


// ==========================================
// 1. 기존 데이터 및 설정
// ==========================================

const teams = [
  { id: 1, name: 'GEN', fullName: '젠지 (Gen.G)', power: 94, description: '안정적인 운영', colors: { primary: '#D4AF37', secondary: '#000000' } },
  { id: 2, name: 'HLE', fullName: '한화생명 (HLE)', power: 93, description: '높은 성장성', colors: { primary: '#FF6B00', secondary: '#FFFFFF' } },
  { id: 3, name: 'KT', fullName: '케이티 (KT)', power: 87, description: '공격적 플레이', colors: { primary: '#FF4444', secondary: '#FFFFFF' } },
  { id: 4, name: 'T1', fullName: '티원 (T1)', power: 93, description: 'LCK의 황제', colors: { primary: '#E2012E', secondary: '#000000' } },
  { id: 5, name: 'DK', fullName: '디플러스 (DK)', power: 84, description: '전략적 팀워크', colors: { primary: '#00D9C4', secondary: '#FFFFFF' } },
  { id: 6, name: 'BNK', fullName: '피어엑스 (BNK)', power: 82, description: '젊은 잠재력', colors: { primary: '#FFB800', secondary: '#000000' } },
  { id: 7, name: 'NS', fullName: '농심 (NS)', power: 85, description: '매운맛 육성', colors: { primary: '#DC143C', secondary: '#FFFFFF' } },
  { id: 8, name: 'BRO', fullName: '브리온 (BRO)', power: 79, description: '끈끈한 팀워크', colors: { primary: '#166534', secondary: '#FFFFFF' } },
  { id: 9, name: 'DRX', fullName: '디알엑스 (DRX)', power: 80, description: '도전적인 팀', colors: { primary: '#3848A2', secondary: '#000000' } },
  { id: 10, name: 'DNS', fullName: 'DN 수퍼스 (DNS)', power: 82, description: '신생 패기', colors: { primary: '#1E3A8A', secondary: '#FFFFFF' } },
];

const teamFinanceData = {
  "T1": { "total_expenditure": 135.0, "cap_expenditure": 76.0, "luxury_tax": 9.0 },
  "GEN": { "total_expenditure": 110.0, "cap_expenditure": 64.5, "luxury_tax": 6.125 },
  "HLE": { "total_expenditure": 102.0, "cap_expenditure": 94.5, "luxury_tax": 17.25 },
  "KT": { "total_expenditure": 48.0, "cap_expenditure": 40.4, "luxury_tax": 0.1 },
  "DK": { "total_expenditure": 35.5, "cap_expenditure": 26.5, "luxury_tax": 0.0 },
  "NS": { "total_expenditure": 51.0, "cap_expenditure": 50.0, "luxury_tax": 2.5 },
  "BNK": { "total_expenditure": 15.5, "cap_expenditure": 14.15, "luxury_tax": 0.0 },
  "BRO": { "total_expenditure": 16.0, "cap_expenditure": 16.0, "luxury_tax": 0.0 },
  "DRX": { "total_expenditure": 19.0, "cap_expenditure": 19.0, "luxury_tax": 0.0 },
  "DNS": { "total_expenditure": 29.5, "cap_expenditure": 25.5, "luxury_tax": 0.0 }
};

const difficulties = [
  { value: 'easy', label: '쉬움', color: 'green' },
  { value: 'normal', label: '보통', color: 'blue' },
  { value: 'hard', label: '어려움', color: 'orange' },
  { value: 'insane', label: '극악', color: 'red' },
];

const getLeagues = () => { const s = localStorage.getItem('lckgm_leagues'); return s ? JSON.parse(s) : []; };
const saveLeagues = (l) => localStorage.setItem('lckgm_leagues', JSON.stringify(l));
const addLeague = (l) => { const list = getLeagues(); list.push(l); saveLeagues(list); return list; };
const updateLeague = (id, u) => { 
  const leagues = getLeagues(); 
  const index = leagues.findIndex(l => l.id === id); 
  if (index !== -1) { 
    leagues[index] = { ...leagues[index], ...u }; 
    saveLeagues(leagues); 
    return leagues[index];
  }
  return null;
};
const deleteLeague = (id) => { const l = getLeagues().filter(x => x.id !== id); saveLeagues(l); return l; };
const getLeagueById = (id) => getLeagues().find(l => l.id === id);
function getTextColor(hex) { const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return (r*299+g*587+b*114)/1000>128?'#000000':'#FFFFFF'; }
const getOvrBadgeStyle = (ovr) => ovr >= 90 ? 'bg-orange-100 text-orange-700' : (ovr >= 85 ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700');

// 스케줄러 (동일)
const generateSchedule = (baronIds, elderIds) => {
  const week1Days = ['1.14 (수)', '1.15 (목)', '1.16 (금)', '1.17 (토)', '1.18 (일)'];
  const week2Days = ['1.21 (수)', '1.22 (목)', '1.23 (금)', '1.24 (토)', '1.25 (일)'];
  const week3Days = ['1.28 (수)', '1.29 (목)', '1.30 (금)', '1.31 (토)', '2.1 (일)'];

  const shuffledElder = [...elderIds].sort(() => Math.random() - 0.5);
  let allMatches = [];
  
  for (let i = 0; i < 5; i++) {
    const baronTeam = baronIds[i];
    const skipElderTeam = shuffledElder[i]; 
    for (let j = 0; j < 5; j++) {
      const elderTeam = elderIds[j];
      if (elderTeam !== skipElderTeam) {
        allMatches.push({ id: Date.now() + Math.random(), t1: baronTeam, t2: elderTeam, type: 'regular', status: 'pending', format: 'BO3' });
      }
    }
  }
  // 간단한 스케줄링 (2경기씩 배치)
  let finalSchedule = [];
  const days = [...week1Days, ...week2Days];
  allMatches = allMatches.sort(() => Math.random() - 0.5);
  
  allMatches.forEach((m, i) => {
      if(i < days.length * 2) {
         finalSchedule.push({...m, date: days[Math.floor(i/2)], time: i%2===0?'17:00':'19:30'});
      }
  });

  week3Days.forEach(day => {
    finalSchedule.push({ id: Date.now() + Math.random(), t1: null, t2: null, date: day, time: '17:00', type: 'tbd', format: 'BO5', status: 'pending' });
  });

  return finalSchedule;
};


// --- 컴포넌트 ---

function LeagueManager() {
  const [leagues, setLeagues] = useState(getLeagues());
  const navigate = useNavigate();
  useEffect(() => setLeagues(getLeagues()), []);
  const handleClearData = () => { if(window.confirm('초기화하시겠습니까?')){ localStorage.removeItem('lckgm_leagues'); window.location.reload(); } };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-black text-gray-800 tracking-tight">LCK 매니저 2026</h1>
            <button onClick={handleClearData} className="text-xs text-red-500 underline">데이터 초기화</button>
        </div>
        <div className="grid gap-4">
          {leagues.map(l => {
            const t = teams.find(x => x.id === l.team.id);
            if (!t) return null;
            return (
              <div key={l.id} className="bg-white p-6 rounded-xl shadow-sm border flex justify-between items-center">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-white shadow-md text-lg" style={{backgroundColor:t.colors.primary}}>{t.name}</div>
                  <div><h2 className="text-xl font-bold">{t.fullName}</h2><p className="text-gray-500 font-medium text-sm">{l.leagueName}</p></div>
                </div>
                <div className="flex gap-3">
                  <button onClick={()=>{updateLeague(l.id,{lastPlayed:new Date().toISOString()});navigate(`/league/${l.id}`)}} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700">접속하기</button>
                  <button onClick={()=>{if(window.confirm('삭제하시겠습니까?')){deleteLeague(l.id);setLeagues(getLeagues())}}} className="bg-gray-100 text-gray-600 px-4 py-2.5 rounded-lg font-bold">삭제</button>
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={() => navigate('/new-league')} className="w-full mt-6 bg-white border-2 border-dashed border-gray-300 py-6 rounded-xl text-gray-400 font-bold text-xl hover:border-blue-500 hover:text-blue-500 transition">+ 새 시즌 시작</button>
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
      id: newId, leagueName: `2026 LCK 컵 - ${current.name}`, team: current, difficulty: diff,
      createdAt: new Date().toISOString(), lastPlayed: new Date().toISOString(),
      groups: { baron: [], elder: [] }, matches: [], standings: {}
    });
    setTimeout(() => navigate(`/league/${newId}`), 50);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50" style={{backgroundColor:`${current.colors.primary}10`}}>
      <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-2xl w-full text-center border-t-8" style={{borderColor:current.colors.primary}}>
        <h2 className="text-3xl font-black mb-8">팀 선택</h2>
        <div className="flex items-center justify-between mb-8">
          <button onClick={()=>setIdx(i=>i===0?teams.length-1:i-1)} className="p-3 bg-gray-100 rounded-full">◀</button>
          <div className="flex flex-col items-center">
            <div className="w-40 h-40 rounded-full flex items-center justify-center text-5xl font-black text-white shadow-xl mb-6" style={{backgroundColor:current.colors.primary}}>{current.name}</div>
            <h3 className="text-3xl font-bold">{current.fullName}</h3>
            <p className="text-blue-600 font-bold mt-2 text-xl">{current.power} OVR</p>
          </div>
          <button onClick={()=>setIdx(i=>i===teams.length-1?0:i+1)} className="p-3 bg-gray-100 rounded-full">▶</button>
        </div>
        <button onClick={handleStart} className="w-full py-5 rounded-2xl font-black text-xl text-white shadow-lg transition transform hover:-translate-y-1" style={{backgroundColor:current.colors.primary,color:getTextColor(current.colors.primary)}}>시작하기</button>
      </div>
    </div>
  );
}

// --- Dashboard ---
function Dashboard() {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const [league, setLeague] = useState(null);
  const [viewingTeamId, setViewingTeamId] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // 드래프트 상태
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftPool, setDraftPool] = useState([]);
  const [draftGroups, setDraftGroups] = useState({ baron: [], elder: [] });
  const [draftTurn, setDraftTurn] = useState('user');
  const draftTimeoutRef = useRef(null);

  // 시뮬레이션 결과 모달 상태 (내 경기용)
  const [matchResult, setMatchResult] = useState(null); 

  useEffect(() => {
    const found = getLeagueById(leagueId);
    if (found) {
      setLeague(found);
      setViewingTeamId(found.team.id);
    }
  }, [leagueId]);

  if (!league) return <div className="flex h-screen items-center justify-center font-bold text-gray-500">로딩 중...</div>;
  
  const myTeam = teams.find(t => String(t.id) === String(league.team.id)) || league.team;
  const viewingTeam = teams.find(t => String(t.id) === String(viewingTeamId)) || myTeam;
  const currentRoster = (playerList || []).filter(p => p.팀 === viewingTeam.name);
  const hasDrafted = league.groups && league.groups.baron && league.groups.baron.length > 0;

  // 다음 진행 가능한 날짜 찾기
  const pendingMatches = (league.matches || []).filter(m => m.status === 'pending');
  const nextDate = pendingMatches.length > 0 ? pendingMatches[0].date : null;
  const currentDateDisplay = nextDate || (hasDrafted ? '모든 일정 종료' : '프리시즌');

  // --- 날짜 진행 (일괄 시뮬레이션) ---
  const handleProceedDay = () => {
      if (!nextDate) { alert("진행할 경기가 없습니다."); return; }

      // 오늘 날짜의 모든 경기 찾기
      const todaysMatches = pendingMatches.filter(m => m.date === nextDate);
      
      let newMatches = [...league.matches];
      let newStandings = { ...league.standings };
      let myGameResult = null;

      // 각 경기 시뮬레이션
      todaysMatches.forEach(match => {
          const t1 = teams.find(t => t.id === match.t1);
          const t2 = teams.find(t => t.id === match.t2);
          const rosterA = playerList.filter(p => p.팀 === t1.name); // 간소화된 로스터 로드
          const rosterB = playerList.filter(p => p.팀 === t2.name);

          // BO3 시뮬레이션
          const result = simulateMatchBO3(
              { name: t1.name, roster: rosterA },
              { name: t2.name, roster: rosterB }
          );

          // 내 경기라면 결과창을 띄우기 위해 저장
          if (t1.id === myTeam.id || t2.id === myTeam.id) {
              myGameResult = result;
          }

          // 순위표 업데이트
          const winnerId = result.winner === t1.name ? t1.id : t2.id;
          const loserId = result.winner === t1.name ? t2.id : t1.id;
          if(!newStandings[winnerId]) newStandings[winnerId] = { w: 0, l: 0, diff: 0 };
          if(!newStandings[loserId]) newStandings[loserId] = { w: 0, l: 0, diff: 0 };
          newStandings[winnerId].w += 1;
          newStandings[winnerId].diff += result.diff;
          newStandings[loserId].l += 1;
          newStandings[loserId].diff -= result.diff;

          // 매치 상태 업데이트
          const matchIndex = newMatches.findIndex(m => m.id === match.id);
          if(matchIndex !== -1) {
              newMatches[matchIndex] = { 
                  ...match, 
                  status: 'finished', 
                  result: { 
                      winner: result.winner, 
                      score: result.scoreString 
                  } 
              };
          }
      });

      // 데이터 저장
      updateLeague(league.id, { matches: newMatches, standings: newStandings });
      setLeague(prev => ({ ...prev, matches: newMatches, standings: newStandings }));

      if (myGameResult) {
          setMatchResult(myGameResult);
      } else {
          alert(`${nextDate}의 모든 경기가 시뮬레이션 되었습니다.`);
      }
  };

  // --- 드래프트 ---
  const handleDraftStart = () => {
    setIsDrafting(true);
    const pool = teams.filter(t => t.id !== 1 && t.id !== 2);
    setDraftPool(pool);
    setDraftGroups({ baron: [1], elder: [2] }); 
    if (myTeam.id === 1 || myTeam.id === 2) {
       setDraftTurn(myTeam.id === 1 ? 'user' : 'cpu');
       if(myTeam.id === 2) triggerCpuPick(pool, { baron: [1], elder: [2] });
    } else {
       handleAutoDraft(pool);
    }
  };

  const pickComputerTeam = (available) => available.sort((a,b) => b.power - a.power + (Math.random()*10 - 5))[0];

  const triggerCpuPick = (pool, groups) => {
    draftTimeoutRef.current = setTimeout(() => {
        if (pool.length === 0) { finalizeDraft(groups); return; }
        const picked = pickComputerTeam(pool);
        const newPool = pool.filter(t => t.id !== picked.id);
        let newGroups = { ...groups };
        if (myTeam.id === 1) newGroups.elder.push(picked.id); else newGroups.baron.push(picked.id);
        setDraftPool(newPool); setDraftGroups(newGroups); setDraftTurn('user');
        if (newPool.length === 0) finalizeDraft(newGroups);
    }, 500);
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
    updateLeague(league.id, { groups, matches });
    setLeague(prev => ({...prev, groups, matches}));
    setIsDrafting(false);
    alert("시즌 일정이 생성되었습니다!");
  };

  const nextMatch = league.matches ? league.matches.find(m => m.status === 'pending' && (m.t1 === myTeam.id || m.t2 === myTeam.id)) : null;
  const oppId = nextMatch ? (nextMatch.t1 === myTeam.id ? nextMatch.t2 : nextMatch.t1) : null;
  const oppRecord = league.standings && oppId && league.standings[oppId] ? league.standings[oppId] : {w:0, l:0};
  const myRecord = league.standings && league.standings[myTeam.id] ? league.standings[myTeam.id] : {w:0, l:0};

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans relative">
      
      {/* 경기 결과 모달 */}
      {matchResult && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-center">
                <h2 className="text-2xl font-black mb-4">경기 결과 (BO3)</h2>
                <div className="text-5xl font-black text-blue-600 mb-2">{matchResult.scoreString}</div>
                <div className="text-xl font-bold mb-4">{matchResult.winner === myTeam.name ? "VICTORY" : "DEFEAT"}</div>
                
                <div className="flex-1 overflow-y-auto space-y-4 bg-gray-50 p-4 rounded-xl text-left text-sm">
                    {matchResult.sets.map((set, i) => (
                        <div key={i} className="bg-white p-3 rounded shadow-sm">
                            <div className="font-bold mb-1 border-b pb-1">SET {i+1} - Winner: {set.winner} (Kills: {set.scoreA}:{set.scoreB})</div>
                            <div className="text-xs text-gray-500 space-y-1">
                                {set.logs.map((l, j) => <div key={j}>{l}</div>)}
                            </div>
                        </div>
                    ))}
                </div>
                <button onClick={()=>setMatchResult(null)} className="mt-4 w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700">확인</button>
            </div>
        </div>
      )}

      {/* 드래프트 모달 */}
      {isDrafting && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full text-center shadow-2xl relative">
            <h2 className="text-3xl font-black mb-6">팀 구성 진행 중...</h2>
            {draftTurn === 'user' ? (
                <div>
                   <div className="grid grid-cols-4 gap-3 mb-4">{draftPool.map(t=><button key={t.id} onClick={()=>handleUserPick(t.id)} className="p-4 border rounded hover:border-blue-500 font-bold">{t.name}</button>)}</div>
                   <p className="text-blue-600 font-bold">팀을 선택하세요!</p>
                </div>
            ) : <div className="text-gray-500 font-bold animate-pulse">상대가 선택 중입니다...</div>}
          </div>
        </div>
      )}

      {/* 사이드바 */}
      <aside className="w-64 bg-gray-900 text-gray-300 flex-shrink-0 flex flex-col shadow-xl z-20">
        <div className="p-5 bg-gray-800 border-b border-gray-700 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs" style={{backgroundColor: myTeam.colors.primary}}>{myTeam.name}</div>
          <div className="text-white font-bold text-sm">{myTeam.fullName}</div>
        </div>
        <div className="flex-1 py-4 px-2 space-y-1">
          {['dashboard', 'roster', 'standings', 'schedule'].map(id => (
            <button key={id} onClick={() => {setActiveTab(id); setViewingTeamId(league.team.id);}} className={`w-full text-left px-3 py-2.5 rounded-md text-sm font-medium ${activeTab===id?'bg-blue-600 text-white':'hover:bg-gray-800'}`}>{id.toUpperCase()}</button>
          ))}
        </div>
        <div className="p-4 bg-gray-800"><button onClick={() => navigate('/')} className="w-full text-xs font-bold text-gray-400 hover:text-white">나가기</button></div>
      </aside>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b h-14 flex items-center justify-between px-6 shadow-sm z-10">
          <div className="flex items-center gap-6 text-sm font-bold text-gray-700">
            <div>📅 {currentDateDisplay}</div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div>🏆 {myRecord.w}승 {myRecord.l}패</div>
          </div>
          {/* 4. 시뮬레이션 버튼 헤더 우측 상단으로 이동 */}
          {hasDrafted ? (
             <button onClick={handleProceedDay} className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-sm shadow animate-pulse">
                {nextDate ? `▶ ${nextDate} 일정 진행 (전체 시뮬레이션)` : "모든 일정 종료"}
             </button>
          ) : (
             <button onClick={handleDraftStart} className="px-5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-full font-bold text-sm shadow">
                팀 추첨 시작
             </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-gray-100">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && (
              <div className="grid grid-cols-12 gap-6">
                {/* 다음 경기 카드 */}
                <div className="col-span-12 lg:col-span-8 bg-white rounded-lg border shadow-sm p-6">
                   <h3 className="text-lg font-bold text-gray-800 mb-4">다음 경기 정보</h3>
                   <div className="flex items-center justify-between bg-gray-50 rounded-xl p-8 border">
                      <div className="text-center w-1/3"><div className="text-3xl font-black mb-2">{myTeam.name}</div><div className="text-sm font-bold text-gray-500">{myRecord.w}승 {myRecord.l}패</div></div>
                      <div className="text-center w-1/3"><div className="text-gray-400 font-bold mb-2">VS</div>{nextMatch ? <div className="text-blue-600 font-black">{nextMatch.time}</div> : "-"}</div>
                      <div className="text-center w-1/3">
                        {nextMatch ? <><div className="text-3xl font-black mb-2">{teams.find(t=>t.id===(nextMatch.t1===myTeam.id?nextMatch.t2:nextMatch.t1)).name}</div><div className="text-sm font-bold text-gray-500">{oppRecord.w}승 {oppRecord.l}패</div></> : <div className="text-gray-400 font-bold">대기 중</div>}
                      </div>
                   </div>
                </div>

                {/* 미니 순위표 */}
                <div className="col-span-12 lg:col-span-4 bg-white rounded-lg border shadow-sm p-4 h-full">
                   <h3 className="text-sm font-bold text-gray-700 mb-3">내 그룹 순위</h3>
                   <table className="w-full text-xs">
                     <thead className="bg-gray-50 text-gray-500"><tr><th className="p-2">#</th><th className="p-2 text-left">팀</th><th className="p-2">승</th><th className="p-2">패</th><th className="p-2">득실</th></tr></thead>
                     <tbody>
                        {(league.groups.baron.includes(myTeam.id) ? league.groups.baron : league.groups.elder).map((id,i) => {
                           const t = teams.find(x=>x.id===id);
                           const r = league.standings[id] || {w:0,l:0,diff:0};
                           return <tr key={id} className={`border-b ${id===myTeam.id?'bg-blue-50':''}`}><td className="p-2 text-center">{i+1}</td><td className="p-2 font-bold">{t.name}</td><td className="p-2 text-center">{r.w}</td><td className="p-2 text-center">{r.l}</td><td className="p-2 text-center text-gray-400">{r.diff}</td></tr>
                        })}
                     </tbody>
                   </table>
                </div>

                {/* 로스터 요약 (수정됨: 가로 스크롤 제거, 계약일 오류 수정) */}
                <div className="col-span-12 bg-white rounded-lg border shadow-sm p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">선수단 현황</h3>
                  <div className="overflow-hidden"> {/* 스크롤 제거 */}
                    <table className="w-full text-sm table-fixed"> {/* table-fixed로 너비 고정 */}
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                            <tr>
                                <th className="py-3 w-16 text-center">포지션</th>
                                <th className="py-3 text-left pl-4">이름</th>
                                <th className="py-3 w-16 text-center">OVR</th>
                                <th className="py-3 w-20 text-center">연봉</th>
                                <th className="py-3 w-24 text-center">계약</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {currentRoster.map((p, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    <td className="py-3 text-center font-bold text-gray-400">{p.포지션}</td>
                                    <td className="py-3 font-bold text-gray-800 pl-4 truncate">{p.이름} <span className="text-gray-400 text-xs font-normal">({p.실명})</span></td>
                                    <td className="py-3 text-center"><span className={`px-2 py-1 rounded text-xs font-black ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td>
                                    <td className="py-3 text-center text-gray-600 font-medium">{p.연봉}억</td>
                                    <td className="py-3 text-center">
                                        {/* 1. 계약 만료 텍스트 오류 수정: 숫자만 표시 */}
                                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">
                                            {p.계약 ? p.계약.replace(/[^0-9]/g, '') : '-'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            
            {/* 다른 탭들 (간략화) */}
            {activeTab === 'roster' && (
                <div className="bg-white p-6 rounded-lg border shadow-sm">
                    <h2 className="text-xl font-bold mb-4">{viewingTeam.fullName} 로스터</h2>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b">
                            <tr><th className="p-3">POS</th><th className="p-3">이름</th><th className="p-3">종합</th><th className="p-3">계약</th><th className="p-3">잠재력</th></tr>
                        </thead>
                        <tbody>
                            {currentRoster.map((p,i)=>(
                                <tr key={i} className="border-b hover:bg-gray-50">
                                    <td className="p-3 font-bold text-gray-400">{p.포지션}</td>
                                    <td className="p-3 font-bold">{p.이름}</td>
                                    <td className="p-3 font-black text-blue-600">{p.종합}</td>
                                    {/* 상세 로스터에서도 계약일 수정 */}
                                    <td className="p-3">{p.계약.replace(/[^0-9]/g, '')}년</td> 
                                    <td className="p-3">{p.잠재력}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            
            {activeTab === 'standings' && (
                <div className="grid grid-cols-2 gap-6">
                    {['baron', 'elder'].map(g => (
                        <div key={g} className="bg-white p-4 rounded-lg border shadow-sm">
                            <h3 className="font-bold text-lg mb-4 capitalize text-center">{g} Group</h3>
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b"><tr><th className="p-2">#</th><th className="p-2 text-left">팀</th><th className="p-2">승</th><th className="p-2">패</th><th className="p-2">득실</th></tr></thead>
                                <tbody>
                                    {(league.groups[g]||[]).map((id,i)=>{
                                        const r = league.standings[id] || {w:0,l:0,diff:0};
                                        return <tr key={id} className="border-b"><td className="p-2 text-center">{i+1}</td><td className="p-2 font-bold">{teams.find(t=>t.id===id).name}</td><td className="p-2 text-center font-bold text-blue-600">{r.w}</td><td className="p-2 text-center text-red-500">{r.l}</td><td className="p-2 text-center text-gray-400">{r.diff}</td></tr>
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'schedule' && (
                <div className="bg-white p-6 rounded-lg border shadow-sm">
                    <h2 className="text-xl font-bold mb-4">전체 일정</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {league.matches.map((m,i)=>(
                            <div key={i} className={`border p-3 rounded flex justify-between items-center ${m.status==='finished'?'bg-gray-50 opacity-70':''}`}>
                                <div className="text-xs font-bold text-gray-500 w-24">{m.date}</div>
                                <div className="flex-1 flex justify-center gap-4 font-bold">
                                    <span className={m.result?.winner===teams.find(t=>t.id===m.t1).name?'text-blue-600':''}>{teams.find(t=>t.id===m.t1).name}</span>
                                    <span className="text-gray-400">vs</span>
                                    <span className={m.result?.winner===teams.find(t=>t.id===m.t2).name?'text-blue-600':''}>{teams.find(t=>t.id===m.t2).name}</span>
                                </div>
                                <div className="w-20 text-right font-black text-gray-800">{m.result ? m.result.score : '-'}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LeagueManager />} />
      <Route path="/new-league" element={<TeamSelection />} />
      <Route path="/league/:leagueId" element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}