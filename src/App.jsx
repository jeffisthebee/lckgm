import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import playerList from './data/players.json';
import championList from './data/champions.json';

// ==========================================
// 0. 시뮬레이션 엔진 (Simulation Engine)
// ==========================================

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
  OTP_SCORE_THRESHOLD: 80,
  OTP_TIER_BOOST: 2,
  VAR_RANGE: 0.12
};

// Mock Data Creation
const MASTERY_MAP = playerList.reduce((acc, player) => {
  acc[player.이름] = { id: player.이름, pool: [] };
  return acc;
}, {});

// --- [Core] Single Game Simulation ---
function simulateSingleGame(teamA, teamB) {
  let scoreA = 0;
  let scoreB = 0;
  const log = [];

  // 1. Environmental Factors
  const dragonType = GAME_CONSTANTS.DRAGONS.TYPES[Math.floor(Math.random() * GAME_CONSTANTS.DRAGONS.TYPES.length)];
  
  // 2. Draft
  const picksA = draftTeam(teamA.roster);
  const picksB = draftTeam(teamB.roster);

  log.push(`🐉 전장: ${dragonType} 드래곤`);

  // 3. Phase Calculation
  const p1 = calculatePhase('EARLY', teamA, teamB, picksA, picksB, null, 1.0);
  scoreA += p1.scoreA; scoreB += p1.scoreB;
  
  const midBonusTeam = p1.scoreA > p1.scoreB ? 'A' : 'B';
  const p2 = calculatePhase('MID', teamA, teamB, picksA, picksB, midBonusTeam, 1.1);
  scoreA += p2.scoreA; scoreB += p2.scoreB;

  const lateBonusTeam = p2.scoreA > p2.scoreB ? 'A' : 'B';
  const p3 = calculatePhase('LATE', teamA, teamB, picksA, picksB, lateBonusTeam, 1.15);
  scoreA += p3.scoreA; scoreB += p3.scoreB;

  return {
    winner: scoreA > scoreB ? teamA.name : teamB.name,
    scoreA: Math.round(scoreA),
    scoreB: Math.round(scoreB),
    picks: { A: picksA, B: picksB },
    shortLog: `[${dragonType}] ${scoreA > scoreB ? teamA.name : teamB.name} 승리`
  };
}

// --- [Core] BO3/BO5 Series Simulation ---
function simulateSeries(teamA, teamB, format = 'BO3') {
  const targetWins = format === 'BO5' ? 3 : 2;
  let winsA = 0;
  let winsB = 0;
  const gameLogs = [];
  const fullLogs = [];
  let lastPicks = null;

  fullLogs.push(`📢 [매치 시작] ${teamA.name} vs ${teamB.name} (${format})`);

  while (winsA < targetWins && winsB < targetWins) {
    const setNum = winsA + winsB + 1;
    const gameResult = simulateSingleGame(teamA, teamB);
    
    if (gameResult.winner === teamA.name) winsA++;
    else winsB++;

    lastPicks = gameResult.picks;
    gameLogs.push(`${setNum}세트: ${gameResult.winner} 승`);
    fullLogs.push(`SET ${setNum}: ${gameResult.shortLog} (점수: ${gameResult.scoreA} vs ${gameResult.scoreB})`);
  }

  const winner = winsA > winsB ? teamA.name : teamB.name;
  const loser = winsA > winsB ? teamB.name : teamA.name;
  
  fullLogs.push(`🎉 최종 결과: ${winner} 승리 (${winsA}:${winsB})`);

  return {
    winner: winner,
    loser: loser,
    scoreA: winsA, // Sets won
    scoreB: winsB, // Sets won
    displayScore: `${winsA}:${winsB}`,
    logs: fullLogs,
    picks: lastPicks // Show picks from the last game played
  };
}

// --- Helper Functions ---
function draftTeam(roster) {
  return roster.map(player => {
    const metaPool = championList.filter(c => c.role === player.포지션 && c.tier <= 2);
    const playerData = MASTERY_MAP[player.이름];
    let masteryPool = playerData && playerData.pool ? playerData.pool : [];

    let finalPick = null;
    if (masteryPool.length > 0 && Math.random() < 0.7) {
      const selectedMastery = masteryPool[Math.floor(Math.random() * masteryPool.length)];
      const champInfo = championList.find(c => c.name === selectedMastery.name) || { name: selectedMastery.name, tier: 3 };
      finalPick = { ...champInfo, mastery: selectedMastery };
    } else {
      const selectedMeta = metaPool[Math.floor(Math.random() * metaPool.length)] || { name: "Unknown Champion", tier: 3 };
      finalPick = { ...selectedMeta, mastery: null };
    }

    return { champName: finalPick.name, tier: finalPick.tier || 3, mastery: finalPick.mastery };
  });
}

function calculatePhase(phase, tA, tB, picksA, picksB, bonusTeam, bonusVal) {
  let powerA = 0;
  let powerB = 0;

  for (let i = 0; i < 5; i++) {
    const pA = tA.roster[i]; const pB = tB.roster[i];
    const pickA = picksA[i]; const pickB = picksB[i];

    let statA = getPhaseStat(phase, pA);
    let statB = getPhaseStat(phase, pB);

    if (phase === 'LATE') {
      if (pA.포지션 === 'TOP') statA *= GAME_CONSTANTS.ROLE_QUEST_BONUS.TOP.effect.splitPushPower;
      if (pB.포지션 === 'TOP') statB *= GAME_CONSTANTS.ROLE_QUEST_BONUS.TOP.effect.splitPushPower;
      if (pA.포지션 === 'ADC') statA *= GAME_CONSTANTS.ROLE_QUEST_BONUS.ADC.effect.damageMultiplier;
      if (pB.포지션 === 'ADC') statB *= GAME_CONSTANTS.ROLE_QUEST_BONUS.ADC.effect.damageMultiplier;
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

  return { scoreA: powerA, scoreB: powerB };
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
  return Math.min(100, baseScore + (Math.log10(games + 1) * 5));
}

function getMetaScore(position, tier, masteryScore) {
  let finalTier = tier;
  if (masteryScore >= SIM_CONSTANTS.OTP_SCORE_THRESHOLD) finalTier = Math.max(1, tier - SIM_CONSTANTS.OTP_TIER_BOOST);
  let coeff = position === 'ADC' ? SIM_CONSTANTS.META_COEFF.ADC[Math.max(1, Math.min(3, finalTier))] : SIM_CONSTANTS.META_COEFF.STANDARD[Math.max(1, Math.min(5, finalTier))];
  return 100 * coeff;
}

// ==========================================
// 1. 데이터 및 설정 (Data & Config)
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

// --- Utilities ---
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

// --- Schedule Generator ---
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

  // Simple scheduling algorithm (omitted complex logic for brevity, using simple filler)
  const days = [...week1Days, ...week2Days];
  const finalSchedule = [];
  allMatches = allMatches.sort(() => Math.random() - 0.5); // Shuffle
  
  allMatches.forEach((m, i) => {
    if(i < days.length * 2) {
       finalSchedule.push({...m, date: days[Math.floor(i/2)], time: i%2===0?'17:00':'19:30'});
    } else {
       // Overflow matches just in case
       finalSchedule.push({...m, date: 'TBD', time: 'TBD'}); 
    }
  });

  // Sort by Date
  finalSchedule.sort((a, b) => {
    const dayA = parseFloat(a.date.split(' ')[0]);
    const dayB = parseFloat(b.date.split(' ')[0]);
    if (dayA !== dayB) return dayA - dayB;
    return a.time === '17:00' ? -1 : 1;
  });

  // Add Finals Placeholder
  week3Days.forEach(day => {
    finalSchedule.push({ id: Date.now() + Math.random(), t1: null, t2: null, date: day, time: '17:00', type: 'tbd', format: 'BO5', status: 'pending' });
  });

  return finalSchedule;
};

// ==========================================
// 2. 컴포넌트 (Components)
// ==========================================

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
      matches: [],
      standings: {}
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
  const [prizeMoney, setPrizeMoney] = useState(0.0);

  // Draft
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftPool, setDraftPool] = useState([]);
  const [draftGroups, setDraftGroups] = useState({ baron: [], elder: [] });
  const [draftTurn, setDraftTurn] = useState('user');
  const draftTimeoutRef = useRef(null);

  // Meta
  const [metaRole, setMetaRole] = useState('TOP');

  // Match Result Modal
  const [matchResult, setMatchResult] = useState(null); 

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

  if (!league) return <div className="flex h-screen items-center justify-center font-bold text-gray-500">데이터 로딩 중...</div>;
   
  const myTeam = teams.find(t => String(t.id) === String(league.team.id)) || league.team;
  const viewingTeam = teams.find(t => String(t.id) === String(viewingTeamId)) || myTeam;
  const currentRoster = (playerList || []).filter(p => p.팀 === viewingTeam.name);
  const isCaptain = myTeam.id === 1 || myTeam.id === 2; 
  const hasDrafted = league.groups && league.groups.baron && league.groups.baron.length > 0;
  
  // Date & Match Logic
  const nextGlobalMatch = league.matches.find(m => m.status === 'pending');
  const currentDateDisplay = nextGlobalMatch ? nextGlobalMatch.date : (hasDrafted ? '시즌 종료' : '2026 프리시즌');
  const isMyNextMatch = nextGlobalMatch ? (nextGlobalMatch.t1 === myTeam.id || nextGlobalMatch.t2 === myTeam.id) : false;

  const t1 = nextGlobalMatch ? teams.find(t=>t.id===nextGlobalMatch.t1) : null;
  const t2 = nextGlobalMatch ? teams.find(t=>t.id===nextGlobalMatch.t2) : null;
  const myRecord = league.standings && league.standings[myTeam.id] ? league.standings[myTeam.id] : { w: 0, l: 0 };
  const finance = teamFinanceData[viewingTeam.name] || { total_expenditure: 0, cap_expenditure: 0, luxury_tax: 0 };

  // --- Functions ---
  const getTeamRoster = (teamName) => {
    const positions = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
    const players = playerList.filter(p => p.팀 === teamName);
    return positions.map(pos => players.find(p => p.포지션 === pos) || players[0]);
  };

  const applyMatchResult = (targetMatch, result) => {
    const updatedMatches = league.matches.map(m => {
        if (m.id === targetMatch.id) {
            return { ...m, status: 'finished', result: { winner: result.winner, score: result.displayScore } };
        }
        return m;
    });

    // Standings Update (Set Score Based)
    const newStandings = { ...(league.standings || {}) };
    const winnerTeam = teams.find(t => t.name === result.winner);
    const loserTeam = teams.find(t => t.name === result.loser);
    
    if(!newStandings[winnerTeam.id]) newStandings[winnerTeam.id] = { w: 0, l: 0, diff: 0 };
    if(!newStandings[loserTeam.id]) newStandings[loserTeam.id] = { w: 0, l: 0, diff: 0 };

    newStandings[winnerTeam.id].w += 1;
    newStandings[winnerTeam.id].diff += (result.scoreA - result.scoreB); // Set Differential
    newStandings[loserTeam.id].l += 1;
    newStandings[loserTeam.id].diff -= (result.scoreA - result.scoreB); // Set Differential

    updateLeague(league.id, { matches: updatedMatches, standings: newStandings });
    setLeague(prev => ({ ...prev, matches: updatedMatches, standings: newStandings }));
  };

  // Header Button Logic (Draft or Next Match)
  const handleHeaderAction = () => {
    if (!hasDrafted) {
        handleDraftStart();
        return;
    }
    if (nextGlobalMatch) {
        if (isMyNextMatch) {
            // Do nothing, visual cue is enough, or scroll to dashboard
            alert("대시보드 중앙의 [경기 시작] 버튼을 눌러주세요!");
        } else {
            // CPU Simulation
            const rt1 = teams.find(t => t.id === nextGlobalMatch.t1);
            const rt2 = teams.find(t => t.id === nextGlobalMatch.t2);
            const result = simulateSeries(
                { name: rt1.name, roster: getTeamRoster(rt1.name) },
                { name: rt2.name, roster: getTeamRoster(rt2.name) },
                nextGlobalMatch.format
            );
            applyMatchResult(nextGlobalMatch, result);
        }
    }
  };

  // Dashboard Button Logic (My Match)
  const handleMyMatchStart = () => {
    const rt1 = teams.find(t => t.id === nextGlobalMatch.t1);
    const rt2 = teams.find(t => t.id === nextGlobalMatch.t2);
    const result = simulateSeries(
        { name: rt1.name, roster: getTeamRoster(rt1.name) },
        { name: rt2.name, roster: getTeamRoster(rt2.name) },
        nextGlobalMatch.format
    );
    setMatchResult(result);
    applyMatchResult(nextGlobalMatch, result);
  };

  // Draft Logic
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
    if (Math.random() < 0.7) return sorted[0];
    return available[Math.floor(Math.random() * available.length)];
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
    setLeague(updated);
    setTimeout(() => { setIsDrafting(false); setActiveTab('standings'); alert("팀 구성 완료!"); }, 500);
  };

  const handlePrevTeam = () => { const idx = teams.findIndex(t => t.id === viewingTeam.id); setViewingTeamId(teams[(idx - 1 + teams.length) % teams.length].id); };
  const handleNextTeam = () => { const idx = teams.findIndex(t => t.id === viewingTeam.id); setViewingTeamId(teams[(idx + 1) % teams.length].id); };

  const getSortedGroup = (groupIds) => {
    return groupIds.sort((a, b) => {
      const recA = league.standings && league.standings[a] ? league.standings[a] : { w: 0, diff: 0 };
      const recB = league.standings && league.standings[b] ? league.standings[b] : { w: 0, diff: 0 };
      if (recA.w !== recB.w) return recB.w - recA.w;
      return recB.diff - recA.diff;
    });
  };

  const menuItems = [
    { id: 'dashboard', name: '대시보드', icon: '📊' },
    { id: 'roster', name: '로스터', icon: '👥' },
    { id: 'standings', name: '순위표', icon: '🏆' },
    { id: 'finance', name: '재정', icon: '💰' }, 
    { id: 'schedule', name: '일정', icon: '📅' },
    { id: 'team_schedule', name: '팀 일정', icon: '📅' },
    { id: 'meta', name: '메타', icon: '📈' }, 
  ];

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans relative">
      
      {/* Simulation Result Modal */}
      {matchResult && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="text-center border-b pb-4 mb-4">
                    <h2 className="text-2xl font-black mb-1">경기 종료</h2>
                    <div className="text-4xl font-black text-blue-600 my-4">
                        {matchResult.displayScore}
                    </div>
                    <div className="text-lg font-bold">
                        Winner: <span className="text-blue-600">{matchResult.winner}</span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 px-2">
                    <div className="bg-gray-100 p-4 rounded-lg text-sm space-y-2">
                        {matchResult.logs.map((log, idx) => (
                            <div key={idx} className="border-b border-gray-200 last:border-0 pb-1 last:pb-0 font-medium">{log}</div>
                        ))}
                    </div>
                </div>
                <button onClick={() => setMatchResult(null)} className="mt-6 w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition">닫기</button>
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
                    <p className="text-gray-500">조 추첨 진행 중...</p>
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
                    <div className="grid grid-cols-4 gap-3 overflow-y-auto max-h-[300px] p-2">
                        {draftPool.map(t => (
                            <button key={t.id} onClick={() => handleUserPick(t.id)} disabled={draftTurn !== 'user'}
                                className={`p-4 rounded-xl border-2 transition flex flex-col items-center gap-2 hover:shadow-md ${draftTurn === 'user' ? 'bg-white border-gray-200 hover:border-blue-500 cursor-pointer' : 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'}`}>
                                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-sm" style={{backgroundColor:t.colors.primary}}>{t.name}</div>
                                <div className="font-bold text-sm">{t.fullName}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
          </div>
        </div>
      )}

      {/* Sidebar */}
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
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">🏆</span> {myRecord.w}승 {myRecord.l}패 ({myRecord.diff > 0 ? `+${myRecord.diff}` : myRecord.diff})</div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">💰</span> 상금: {prizeMoney.toFixed(1)}억</div>
          </div>
          <button 
            onClick={handleHeaderAction} 
            disabled={!hasDrafted ? false : (nextGlobalMatch ? (isMyNextMatch ? true : false) : true)}
            className={`px-6 py-1.5 rounded-full font-bold text-sm shadow-sm transition flex items-center gap-2 
                ${!hasDrafted 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white animate-pulse' 
                    : (nextGlobalMatch 
                        ? (isMyNextMatch 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : 'bg-green-600 hover:bg-green-700 text-white') 
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed')}`}
          >
            <span>▶</span> 
            {!hasDrafted ? "LCK 컵 조 추첨/선정" : 
                (nextGlobalMatch 
                    ? (isMyNextMatch ? "👇 대시보드에서 경기 시작" : `다음 경기 진행 (${t1?.name} vs ${t2?.name})`) 
                    : "모든 일정 종료")}
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
                      <div className="text-center w-1/3"><div className="text-4xl font-black text-gray-800 mb-2">{t1 ? t1.name : '?'}</div></div>
                      <div className="text-center w-1/3 flex flex-col items-center">
                        <div className="text-xs font-bold text-gray-400 uppercase">VS</div><div className="text-3xl font-bold text-gray-300 my-2">@</div>
                        {nextGlobalMatch ? (
                          <div className="mt-1 flex flex-col items-center">
                            <span className="text-base font-black text-blue-600">{nextGlobalMatch.date}</span>
                            <span className="text-sm font-bold text-gray-600">{nextGlobalMatch.time}</span>
                            <span className="mt-2 text-xs font-bold text-white bg-blue-600 px-3 py-1 rounded-full shadow-sm">{nextGlobalMatch.format}</span>
                            
                            {/* 내 경기일 때만 버튼 표시 */}
                            {isMyNextMatch && (
                                <button onClick={handleMyMatchStart} className="mt-3 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transform transition hover:-translate-y-1">
                                    ⚔️ 경기 시작
                                </button>
                            )}
                            
                            {!isMyNextMatch && (
                                <div className="mt-4 text-xs font-bold text-gray-400 animate-pulse">
                                    상단 '다음 경기 진행' 버튼을 눌러주세요
                                </div>
                            )}

                          </div>
                        ) : <div className="text-xs font-bold text-blue-600">모든 일정 종료</div>}
                      </div>
                      <div className="text-center w-1/3">
                          <div className="text-4xl font-black text-gray-800 mb-2">{t2 ? t2.name : '?'}</div>
                      </div>
                   </div>
                </div>
                
                {/* --- 우측 순위표 --- */}
                <div className="col-span-12 lg:col-span-4 flex flex-col h-full max-h-[500px]">
                   {hasDrafted ? (
                     <div className="bg-white rounded-lg border shadow-sm p-4 h-full overflow-y-auto">
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-2 border-b pb-2">
                                <span className="text-lg">🟣</span><span className="font-black text-sm text-gray-700">바론 그룹</span>
                            </div>
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 text-gray-400"><tr><th className="p-2 w-6">#</th><th className="p-2 text-left">팀</th><th className="p-2 text-center">승</th><th className="p-2 text-center">패</th><th className="p-2 text-center">득실</th></tr></thead>
                              <tbody>
                                {getSortedGroup(league.groups.baron || []).map((id, idx) => {
                                   const t = teams.find(team => team.id === id); if(!t) return null;
                                   const rec = league.standings && league.standings[id] ? league.standings[id] : {w:0, l:0, diff:0};
                                   return (
                                     <tr key={id} className="border-b">
                                       <td className="p-2 text-center font-bold text-gray-500">{idx+1}</td>
                                       <td className="p-2 font-bold text-gray-800">{t.fullName}</td>
                                       <td className="p-2 text-center">{rec.w}</td><td className="p-2 text-center">{rec.l}</td><td className="p-2 text-center text-gray-400">{rec.diff > 0 ? `+${rec.diff}` : rec.diff}</td>
                                     </tr>
                                   );
                                })}
                              </tbody>
                            </table>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2 border-b pb-2">
                                <span className="text-lg">🔴</span><span className="font-black text-sm text-gray-700">장로 그룹</span>
                            </div>
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 text-gray-400"><tr><th className="p-2 w-6">#</th><th className="p-2 text-left">팀</th><th className="p-2 text-center">승</th><th className="p-2 text-center">패</th><th className="p-2 text-center">득실</th></tr></thead>
                              <tbody>
                                {getSortedGroup(league.groups.elder || []).map((id, idx) => {
                                   const t = teams.find(team => team.id === id); if(!t) return null;
                                   const rec = league.standings && league.standings[id] ? league.standings[id] : {w:0, l:0, diff:0};
                                   return (
                                     <tr key={id} className="border-b">
                                       <td className="p-2 text-center font-bold text-gray-500">{idx+1}</td>
                                       <td className="p-2 font-bold text-gray-800">{t.fullName}</td>
                                       <td className="p-2 text-center">{rec.w}</td><td className="p-2 text-center">{rec.l}</td><td className="p-2 text-center text-gray-400">{rec.diff > 0 ? `+${rec.diff}` : rec.diff}</td>
                                     </tr>
                                   );
                                })}
                              </tbody>
                            </table>
                        </div>
                     </div>
                   ) : <div className="p-4 bg-white rounded-lg border text-center text-gray-400">프리시즌 대기중</div>}
                </div>

                <div className="col-span-12 bg-white rounded-lg border shadow-sm flex flex-col min-h-[500px]">
                  <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-sm" style={{backgroundColor: viewingTeam.colors.primary}}>{viewingTeam.name}</div><div><h2 className="text-2xl font-black text-gray-800">{viewingTeam.fullName}</h2><p className="text-xs font-bold text-gray-500 uppercase tracking-wide">로스터 요약</p></div></div>
                    <button onClick={()=>setActiveTab('roster')} className="text-sm font-bold text-blue-600 hover:underline">상세 정보 보기 →</button>
                  </div>
                  <div className="p-0 overflow-x-auto">
                    <table className="w-full text-xs text-left table-fixed">
                        <thead className="bg-white text-gray-400 uppercase font-bold border-b">
                            <tr>
                                <th className="py-2 px-1 w-[8%] text-center">라인</th>
                                <th className="py-2 px-1 w-[20%]">이름</th>
                                <th className="py-2 px-1 w-[8%] text-center">OVR</th>
                                <th className="py-2 px-1 w-[6%] text-center">나이</th>
                                <th className="py-2 px-1 w-[8%] text-center">경력</th>
                                <th className="py-2 px-1 w-[10%] text-center">소속</th>
                                <th className="py-2 px-1 w-[12%] text-center">연봉</th>
                                <th className="py-2 px-1 w-[10%] text-center">POT</th>
                                <th className="py-2 px-1 w-[18%] text-left">계약</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {currentRoster.map((p, i) => (
                                <tr key={i} className="hover:bg-gray-50 transition">
                                    <td className="py-2 px-1 font-bold text-gray-400 text-center">{p.포지션}</td>
                                    <td className="py-2 px-1 font-bold text-gray-800 truncate">{p.이름}</td>
                                    <td className="py-2 px-1 text-center"><span className={`inline-flex items-center justify-center w-8 h-6 rounded font-black text-xs shadow-sm border ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td>
                                    <td className="py-2 px-1 text-center text-gray-600">{p.나이 || '-'}</td>
                                    <td className="py-2 px-1 text-center text-gray-600">{p.경력 || '-'}</td>
                                    <td className="py-2 px-1 text-center text-gray-700">{p['팀 소속기간'] || '-'}</td>
                                    <td className="py-2 px-1 text-center text-gray-700 font-bold truncate">{p.연봉 || '-'}</td>
                                    <td className="py-2 px-1 text-center"><span className={`text-[10px] ${getPotBadgeStyle(p.잠재력)}`}>{p.잠재력}</span></td>
                                    <td className="py-2 px-1 text-gray-500 font-medium truncate">{p.계약}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Standings Tab */}
            {activeTab === 'standings' && (
               <div className="flex flex-col gap-6">
                 <h2 className="text-2xl font-black text-gray-900">🏆 2026 LCK 컵 순위표</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {/* Baron Group */}
                     <div className="bg-white rounded-lg border shadow-sm">
                         <div className="p-4 bg-purple-50 border-b border-purple-100 flex items-center gap-2"><span className="text-2xl">🟣</span><h3 className="font-black text-lg text-purple-900">바론 그룹</h3></div>
                         <table className="w-full text-sm">
                           <thead className="bg-gray-50 text-gray-500 font-bold border-b"><tr><th className="py-3 text-center">#</th><th className="py-3 text-left">팀</th><th className="py-3 text-center">승</th><th className="py-3 text-center">패</th><th className="py-3 text-center">세트 득실</th></tr></thead>
                           <tbody className="divide-y divide-gray-100">
                             {getSortedGroup(league.groups.baron || []).map((id, idx) => {
                               const t = teams.find(team => team.id === id);
                               const rec = league.standings && league.standings[id] ? league.standings[id] : {w:0, l:0, diff:0};
                               return <tr key={id}><td className="py-3 text-center font-bold text-gray-600">{idx+1}</td><td className="py-3 font-bold">{t.fullName}</td><td className="py-3 text-center text-blue-600">{rec.w}</td><td className="py-3 text-center text-red-600">{rec.l}</td><td className="py-3 text-center text-gray-500">{rec.diff > 0 ? `+${rec.diff}` : rec.diff}</td></tr>
                             })}
                           </tbody>
                         </table>
                     </div>
                     {/* Elder Group */}
                     <div className="bg-white rounded-lg border shadow-sm">
                         <div className="p-4 bg-red-50 border-b border-red-100 flex items-center gap-2"><span className="text-2xl">🔴</span><h3 className="font-black text-lg text-red-900">장로 그룹</h3></div>
                         <table className="w-full text-sm">
                           <thead className="bg-gray-50 text-gray-500 font-bold border-b"><tr><th className="py-3 text-center">#</th><th className="py-3 text-left">팀</th><th className="py-3 text-center">승</th><th className="py-3 text-center">패</th><th className="py-3 text-center">세트 득실</th></tr></thead>
                           <tbody className="divide-y divide-gray-100">
                             {getSortedGroup(league.groups.elder || []).map((id, idx) => {
                               const t = teams.find(team => team.id === id);
                               const rec = league.standings && league.standings[id] ? league.standings[id] : {w:0, l:0, diff:0};
                               return <tr key={id}><td className="py-3 text-center font-bold text-gray-600">{idx+1}</td><td className="py-3 font-bold">{t.fullName}</td><td className="py-3 text-center text-blue-600">{rec.w}</td><td className="py-3 text-center text-red-600">{rec.l}</td><td className="py-3 text-center text-gray-500">{rec.diff > 0 ? `+${rec.diff}` : rec.diff}</td></tr>
                             })}
                           </tbody>
                         </table>
                     </div>
                 </div>
               </div>
            )}

            {/* Other Tabs (Finance, Roster, Meta, Schedule) */}
            {activeTab === 'finance' && (
              <div className="bg-white rounded-lg border shadow-sm p-8">
                  <h3 className="text-lg font-bold text-gray-700 mb-4">💰 지출 현황 (단위: 억)</h3>
                  <div className="flex items-end gap-8 h-48 bg-gray-50 p-6 rounded-xl border">
                      <div className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                          <span className="font-bold text-blue-600 text-xl">{finance.total_expenditure}억</span>
                          <div className="w-full bg-blue-500 rounded-t-lg" style={{height: `${Math.min(finance.total_expenditure / 1.5, 100)}%`}}></div>
                          <span className="font-bold text-gray-600">총 지출</span>
                      </div>
                      <div className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                          <span className="font-bold text-purple-600 text-xl">{finance.cap_expenditure}억</span>
                          <div className="w-full bg-purple-500 rounded-t-lg" style={{height: `${Math.min(finance.cap_expenditure / 1.5, 100)}%`}}></div>
                          <span className="font-bold text-gray-600">샐러리캡 반영</span>
                      </div>
                  </div>
              </div>
            )}

            {activeTab === 'roster' && (
                <div className="bg-white p-8 rounded-lg border shadow-sm">로스터 상세 보기 화면입니다. (대시보드 요약 참고)</div>
            )}
            
            {(activeTab === 'schedule' || activeTab === 'team_schedule') && (
              <div className="bg-white rounded-lg border shadow-sm p-8 min-h-[600px] flex flex-col">
                <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">📅 경기 일정</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
                    {league.matches.filter(m => activeTab === 'schedule' || (m.t1 === myTeam.id || m.t2 === myTeam.id)).map((m, i) => {
                      const t1 = m.t1 ? teams.find(t => t.id === m.t1) : { name: 'TBD' };
                      const t2 = m.t2 ? teams.find(t => t.id === m.t2) : { name: 'TBD' };
                      return (
                        <div key={i} className={`p-4 rounded-lg border flex flex-col gap-2 ${m.status === 'finished' ? 'bg-gray-50' : 'bg-white'}`}>
                          <div className="flex justify-between text-xs font-bold text-gray-500"><span>{m.date} {m.time}</span><span>{m.format}</span></div>
                          <div className="flex justify-between items-center mt-2">
                             <span className={`font-bold ${m.result?.winner === t1.name ? 'text-blue-600' : ''}`}>{t1.name}</span>
                             <span className="font-black text-lg">{m.status === 'finished' ? m.result.score : 'VS'}</span>
                             <span className={`font-bold ${m.result?.winner === t2.name ? 'text-blue-600' : ''}`}>{t2.name}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {activeTab === 'meta' && <div className="bg-white p-8 rounded-lg border shadow-sm">메타 분석 화면 (챔피언 데이터 참고)</div>}

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