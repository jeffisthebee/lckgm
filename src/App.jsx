import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import playerList from './data/players.json';
import championList from './data/champions.json';

// ==========================================
// 0. 시뮬레이션 엔진 (BO3 시스템 도입)
// ==========================================

const GAME_CONSTANTS = {
  DRAGONS: {
    TYPES: ['화학공학', '바람', '대지', '화염', '바다', '마법공학'],
    BUFFS: {
      '화학공학': { description: '강인함 UP' },
      '바람': { description: '이속 UP' },
      '대지': { description: '방어력 UP' },
      '화염': { description: '공격력 UP' },
      '바다': { description: '체력젠 UP' },
      '마법공학': { description: '스킬가속 UP' }
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
  VAR_RANGE: 0.15 // 변수 폭 확대 (이변 발생 가능성)
};

// 가상 숙련도 데이터
const MASTERY_MAP = playerList.reduce((acc, player) => {
  acc[player.이름] = { id: player.이름, pool: [] };
  return acc;
}, {});

// --- 단판 승부 (One Set) 시뮬레이션 ---
function simulateSet(teamA, teamB, setNumber) {
  const log = [];
  let scoreA = 0;
  let scoreB = 0;

  // 1. 드래곤 & 밴픽
  const dragonType = GAME_CONSTANTS.DRAGONS.TYPES[Math.floor(Math.random() * GAME_CONSTANTS.DRAGONS.TYPES.length)];
  const picksA = draftTeam(teamA.roster);
  const picksB = draftTeam(teamB.roster);

  log.push(`🔹 [SET ${setNumber}] 전장: ${dragonType} 협곡`);

  // 2. 페이즈 계산 (점수 누적)
  const phases = ['EARLY', 'MID', 'LATE'];
  let currentBonusTeam = null;
  let currentBonusVal = 1.0;

  phases.forEach(phase => {
      const result = calculatePhase(phase, teamA, teamB, picksA, picksB, currentBonusTeam, currentBonusVal);
      scoreA += result.scoreA;
      scoreB += result.scoreB;
      
      // 페이즈 승자가 다음 페이즈 보너스 획득
      if (result.scoreA > result.scoreB) { currentBonusTeam = 'A'; currentBonusVal = 1.1; }
      else { currentBonusTeam = 'B'; currentBonusVal = 1.1; }
      
      log.push(result.log);
  });

  // 3. 세트 승자 결정
  const winner = scoreA > scoreB ? teamA.name : teamB.name;
  return { winner, log, picks: { A: picksA, B: picksB } };
}

// --- 다전제 (Best of 3) 시뮬레이션 ---
function simulateSeries(teamA, teamB) {
  let winsA = 0;
  let winsB = 0;
  let sets = [];
  
  // 최대 3세트 진행
  for (let i = 1; i <= 3; i++) {
    if (winsA === 2 || winsB === 2) break; // 2선승제 종료

    const setResult = simulateSet(teamA, teamB, i);
    if (setResult.winner === teamA.name) winsA++;
    else winsB++;
    
    sets.push(setResult);
  }

  return {
    winner: winsA > winsB ? teamA.name : teamB.name,
    scoreA: winsA,
    scoreB: winsB,
    scoreDisplay: `${winsA} : ${winsB}`, // 현실적인 스코어 (예: 2 : 1)
    sets: sets
  };
}

function draftTeam(roster) {
  return roster.map(player => {
    const metaPool = championList.filter(c => c.role === player.포지션 && c.tier <= 2);
    // 랜덤 픽 로직
    const selected = metaPool[Math.floor(Math.random() * metaPool.length)] || { name: "Unknown", tier: 3 };
    return { champName: selected.name, tier: selected.tier || 3 };
  });
}

function calculatePhase(phase, tA, tB, picksA, picksB, bonusTeam, bonusVal) {
  let powerA = 0;
  let powerB = 0;

  for (let i = 0; i < 5; i++) {
    const pA = tA.roster[i] || tA.roster[0]; // 안전장치
    const pB = tB.roster[i] || tB.roster[0];

    // 스탯 기반 점수
    let statA = getPhaseStat(phase, pA);
    let statB = getPhaseStat(phase, pB);
    
    // 메타 가중치
    statA *= SIM_CONSTANTS.META_COEFF.STANDARD[picksA[i].tier] || 1;
    statB *= SIM_CONSTANTS.META_COEFF.STANDARD[picksB[i].tier] || 1;

    // 랜덤 변수 (컨디션)
    powerA += statA * (1 + (Math.random() * SIM_CONSTANTS.VAR_RANGE * 2 - SIM_CONSTANTS.VAR_RANGE));
    powerB += statB * (1 + (Math.random() * SIM_CONSTANTS.VAR_RANGE * 2 - SIM_CONSTANTS.VAR_RANGE));
  }

  if (bonusTeam === 'A') powerA *= bonusVal;
  if (bonusTeam === 'B') powerB *= bonusVal;

  return { scoreA: powerA, scoreB: powerB, log: generateLog(phase, powerA, powerB, tA.name, tB.name) };
}

function getPhaseStat(phase, player) {
  const s = player.상세 || { 라인전: 80, 무력: 80, 운영: 80, 성장: 80, 한타: 80, 안정성: 80 };
  if (phase === 'EARLY') return (s.라인전 * 0.6) + (s.무력 * 0.4);
  if (phase === 'MID') return (s.운영 * 0.5) + (s.성장 * 0.3) + (s.한타 * 0.2);
  return (s.한타 * 0.5) + (s.무력 * 0.3) + (s.안정성 * 0.2);
}

function generateLog(phase, sA, sB, nA, nB) {
  const diff = sA - sB;
  const leader = diff > 0 ? nA : nB;
  if (Math.abs(diff) < 20) return `⚖️ [${phase === 'EARLY' ? '초반' : phase === 'MID' ? '중반' : '후반'}] 양 팀이 팽팽하게 맞섭니다.`;
  
  if (phase === 'EARLY') return diff > 0 ? `⚔️ [초반] ${leader}, 강력한 라인전으로 리드!` : `⚔️ [초반] ${leader} 정글러의 날카로운 갱킹!`;
  else if (phase === 'MID') return diff > 0 ? `🗺️ [중반] ${leader}, 운영으로 상대를 흔듭니다.` : `🗺️ [중반] ${leader}, 오브젝트 한타 대승!`;
  else return diff > 0 ? `💥 [후반] ${leader}, 바론 버프 획득 후 진격!` : `💥 [후반] ${leader}, 장로 드래곤의 힘으로 압박!`;
}

// ==========================================
// 1. 데이터 및 설정
// ==========================================

const teams = [
  { id: 1, name: 'GEN', fullName: '젠지', power: 94, colors: { primary: '#D4AF37', secondary: '#000000' } },
  { id: 2, name: 'HLE', fullName: '한화생명', power: 93, colors: { primary: '#FF6B00', secondary: '#FFFFFF' } },
  { id: 3, name: 'KT', fullName: 'KT 롤스터', power: 87, colors: { primary: '#FF4444', secondary: '#FFFFFF' } },
  { id: 4, name: 'T1', fullName: 'T1', power: 93, colors: { primary: '#E2012E', secondary: '#000000' } },
  { id: 5, name: 'DK', fullName: '디플러스 기아', power: 84, colors: { primary: '#00D9C4', secondary: '#FFFFFF' } },
  { id: 6, name: 'BNK', fullName: 'BNK 피어엑스', power: 82, colors: { primary: '#FFB800', secondary: '#000000' } },
  { id: 7, name: 'NS', fullName: '농심 레드포스', power: 85, colors: { primary: '#DC143C', secondary: '#FFFFFF' } },
  { id: 8, name: 'BRO', fullName: 'OK저축은행 브리온', power: 79, colors: { primary: '#166534', secondary: '#FFFFFF' } },
  { id: 9, name: 'DRX', fullName: 'DRX', power: 80, colors: { primary: '#3848A2', secondary: '#000000' } },
  { id: 10, name: 'DNS', fullName: 'DN 수퍼스', power: 82, colors: { primary: '#1E3A8A', secondary: '#FFFFFF' } },
];

const teamFinanceData = {
  "T1": { "total_expenditure": 135.0, "cap_expenditure": 76.0, "luxury_tax": 9.0 },
  "GEN": { "total_expenditure": 110.0, "cap_expenditure": 64.5, "luxury_tax": 6.125 },
  "HLE": { "total_expenditure": 102.0, "cap_expenditure": 94.5, "luxury_tax": 17.25 },
  // ... (나머지 생략, 이전과 동일)
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

// --- 스케줄러 (날짜 그룹화 로직 추가) ---
const generateSchedule = (baronIds, elderIds) => {
  const daysList = [
      '1.14 (수)', '1.15 (목)', '1.16 (금)', '1.17 (토)', '1.18 (일)',
      '1.21 (수)', '1.22 (목)', '1.23 (금)', '1.24 (토)', '1.25 (일)'
  ];
  
  // 간단한 라운드 로빈 매칭 생성
  let matches = [];
  const allTeams = [...baronIds, ...elderIds];
  
  // Baron 내부 매치
  for(let i=0; i<baronIds.length; i++) {
      for(let j=i+1; j<baronIds.length; j++) {
          matches.push({ t1: baronIds[i], t2: baronIds[j], group: 'baron' });
      }
  }
  // Elder 내부 매치
  for(let i=0; i<elderIds.length; i++) {
      for(let j=i+1; j<elderIds.length; j++) {
          matches.push({ t1: elderIds[i], t2: elderIds[j], group: 'elder' });
      }
  }
  // 인터리그 (일부)
  for(let i=0; i<5; i++) {
      matches.push({ t1: baronIds[i], t2: elderIds[i], group: 'inter' });
  }

  // 셔플 및 날짜 할당
  matches.sort(() => Math.random() - 0.5);
  
  let scheduledMatches = [];
  let matchIdx = 0;
  
  daysList.forEach(day => {
      // 하루에 2~3경기 배정
      for(let k=0; k<2; k++) { 
          if(matchIdx < matches.length) {
              scheduledMatches.push({
                  id: Date.now() + Math.random(),
                  t1: matches[matchIdx].t1,
                  t2: matches[matchIdx].t2,
                  date: day,
                  time: k===0 ? '17:00' : '19:30',
                  type: 'regular',
                  status: 'pending',
                  format: 'BO3'
              });
              matchIdx++;
          }
      }
  });

  return scheduledMatches;
};


// --- 컴포넌트 ---

function LeagueManager() {
  const [leagues, setLeagues] = useState(getLeagues());
  const navigate = useNavigate();
  useEffect(() => setLeagues(getLeagues()), []);
  
  const handleClearData = () => {
    if(window.confirm('저장된 데이터를 초기화하시겠습니까?')){
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
              <div key={l.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-500 transition flex justify-between items-center group">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-white shadow-md text-lg" style={{backgroundColor:t.colors.primary}}>{t.name}</div>
                  <div><h2 className="text-xl font-bold group-hover:text-blue-600 transition">{t.fullName}</h2><p className="text-gray-500 font-medium text-sm">{l.leagueName}</p></div>
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
  const navigate = useNavigate();
  const current = teams[idx];

  const handleStart = () => {
    const newId = Date.now().toString();
    addLeague({
      id: newId,
      leagueName: `2026 LCK 컵 - ${current.name}`,
      team: current,
      difficulty: 'normal',
      createdAt: new Date().toISOString(),
      lastPlayed: new Date().toISOString(),
      groups: { baron: [], elder: [] },
      matches: [],
      currentDateIndex: 0, // 날짜 진행용 인덱스
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
          <div className="flex flex-col items-center">
            <div className="w-40 h-40 rounded-full flex items-center justify-center text-5xl font-black text-white shadow-xl mb-6 ring-4 ring-white" style={{backgroundColor:current.colors.primary}}>{current.name}</div>
            <h3 className="text-3xl font-bold text-gray-800">{current.fullName}</h3>
            <div className="mt-3 inline-block bg-gray-100 px-4 py-1.5 rounded-full text-sm font-bold border border-gray-200">종합 전력: <span className="text-blue-600 text-lg">{current.power}</span></div>
          </div>
          <button onClick={()=>setIdx(i=>i===teams.length-1?0:i+1)} className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition">▶</button>
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

  // 드래프트 상태
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftPool, setDraftPool] = useState([]);
  const [draftGroups, setDraftGroups] = useState({ baron: [], elder: [] });
  const [draftTurn, setDraftTurn] = useState('user');
  const draftTimeoutRef = useRef(null);

  // 시뮬레이션 결과 모달
  const [simReport, setSimReport] = useState(null); // 사용자 팀 경기 결과 보고서

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

  if (!league) return <div className="flex h-screen items-center justify-center font-bold text-gray-500">로딩 중...</div>;
  
  const myTeam = teams.find(t => String(t.id) === String(league.team.id)) || league.team;
  const viewingTeam = teams.find(t => String(t.id) === String(viewingTeamId)) || myTeam;
  const currentRoster = (playerList || []).filter(p => p.팀 === viewingTeam.name);
  
  const isCaptain = myTeam.id === 1 || myTeam.id === 2; 
  const hasDrafted = league.groups && league.groups.baron && league.groups.baron.length > 0;
  
  // 날짜 계산 로직
  const uniqueDates = league.matches ? [...new Set(league.matches.map(m => m.date))] : [];
  const currentDate = uniqueDates[league.currentDateIndex] || "시즌 종료";
  const nextDate = uniqueDates[league.currentDateIndex + 1];

  // --- 날짜 진행 및 시뮬레이션 (수정된 부분) ---
  const handleProceedDay = () => {
    if (!league.matches) return;
    
    // 현재 날짜의 모든 경기 찾기 (pending 상태인 것만)
    const todaysMatches = league.matches.filter(m => m.date === currentDate && m.status === 'pending');
    
    if (todaysMatches.length === 0) {
        // 남은 경기가 없으면 날짜만 이동
        const nextIdx = league.currentDateIndex + 1;
        if(nextIdx < uniqueDates.length) {
            updateLeague(league.id, { currentDateIndex: nextIdx });
            setLeague(prev => ({ ...prev, currentDateIndex: nextIdx }));
        } else {
            alert("모든 일정이 종료되었습니다.");
        }
        return;
    }

    let userMatchResult = null;
    const newMatches = [...league.matches];
    const newStandings = { ...(league.standings || {}) };

    todaysMatches.forEach(match => {
        const t1 = teams.find(t => t.id === match.t1);
        const t2 = teams.find(t => t.id === match.t2);
        
        // 로스터 구성 (포지션 순서)
        const getRoster = (teamName) => {
            const players = playerList.filter(p => p.팀 === teamName);
            return ['TOP','JGL','MID','ADC','SUP'].map(pos => players.find(p => p.포지션 === pos) || players[0]);
        };

        const result = simulateSeries(
            { id: t1.id, name: t1.name, roster: getRoster(t1.name) },
            { id: t2.id, name: t2.name, roster: getRoster(t2.name) }
        );

        // 결과 기록
        const matchIndex = newMatches.findIndex(m => m.id === match.id);
        newMatches[matchIndex] = {
            ...match,
            status: 'finished',
            result: { winner: result.winner, score: result.scoreDisplay }
        };

        // 순위표 갱신
        const updateStanding = (tid, win, scoreDiff) => {
            if(!newStandings[tid]) newStandings[tid] = { w: 0, l: 0, diff: 0 };
            if(win) newStandings[tid].w++; else newStandings[tid].l++;
            newStandings[tid].diff += scoreDiff;
        };
        
        const scoreDiff = Math.abs(result.scoreA - result.scoreB); // 세트 득실
        updateStanding(t1.id, result.winner === t1.name, result.winner === t1.name ? scoreDiff : -scoreDiff);
        updateStanding(t2.id, result.winner === t2.name, result.winner === t2.name ? scoreDiff : -scoreDiff);

        // 사용자 팀 경기라면 결과 팝업 저장
        if (t1.id === myTeam.id || t2.id === myTeam.id) {
            userMatchResult = result;
            userMatchResult.opponent = t1.id === myTeam.id ? t2.name : t1.name;
        }
    });

    // DB 저장 및 상태 업데이트
    const nextIdx = league.currentDateIndex + 1;
    updateLeague(league.id, { matches: newMatches, standings: newStandings, currentDateIndex: nextIdx });
    setLeague(prev => ({ ...prev, matches: newMatches, standings: newStandings, currentDateIndex: nextIdx }));

    if (userMatchResult) {
        setSimReport(userMatchResult);
    } else {
        alert(`${currentDate} 경기가 모두 시뮬레이션 되었습니다.`);
    }
  };

  // --- 드래프트 & 스케줄링 로직 ---
  const handleDraftStart = () => {
    setIsDrafting(true);
    setDraftPool(teams.filter(t => t.id !== 1 && t.id !== 2));
    setDraftGroups({ baron: [1], elder: [2] }); 
    if (isCaptain) {
        if (myTeam.id === 1) { setDraftTurn('user'); } 
        else { setDraftTurn('cpu'); triggerCpuPick(teams.filter(t=>t.id!==1&&t.id!==2), { baron: [1], elder: [2] }); }
    } else {
        handleAutoDraft(teams.filter(t => t.id !== 1 && t.id !== 2));
    }
  };

  const pickComputerTeam = (pool) => {
    const sorted = [...pool].sort((a, b) => b.power - a.power);
    return Math.random() < 0.8 ? sorted[0] : sorted[1] || sorted[0]; // 강팀 선호
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
    const updated = updateLeague(league.id, { groups, matches, currentDateIndex: 0 });
    setLeague(updated);
    setIsDrafting(false);
    setActiveTab('standings');
    alert("조 추첨 및 일정 생성이 완료되었습니다!");
  };

  // UI Helpers
  const nextMatch = league.matches ? league.matches.find(m => m.status === 'pending' && (m.t1 === myTeam.id || m.t2 === myTeam.id)) : null;
  const oppRecord = nextMatch ? (nextMatch.t1 === myTeam.id ? (league.standings[nextMatch.t2] || {w:0,l:0}) : (league.standings[nextMatch.t1] || {w:0,l:0})) : { w: 0, l: 0 }; 
  const myRecord = league.standings && league.standings[myTeam.id] ? league.standings[myTeam.id] : { w: 0, l: 0 };
  const finance = teamFinanceData[viewingTeam.name] || { total_expenditure: 0, cap_expenditure: 0, luxury_tax: 0 };

  // 1번 수정사항: 날짜 포맷팅 함수 (2026년년 문제 해결)
  const formatContract = (contractVal) => {
      const strVal = String(contractVal).replace('년', ''); // '년' 제거
      return `${strVal}년`; // 다시 붙임
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans relative">
      
      {/* Simulation Report Modal */}
      {simReport && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="text-center border-b pb-4 mb-4">
                    <h2 className="text-xl font-bold text-gray-500 mb-1">VS {simReport.opponent}</h2>
                    <div className="text-5xl font-black text-gray-900 my-2 tracking-tighter">
                        {simReport.scoreDisplay}
                    </div>
                    <div className="text-lg font-bold">
                        {simReport.winner === myTeam.name ? <span className="text-blue-600">VICTORY</span> : <span className="text-red-500">DEFEAT</span>}
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-4 px-2">
                    {simReport.sets.map((set, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-lg p-3 border">
                            <div className="flex justify-between font-bold text-sm mb-2 border-b pb-1">
                                <span>SET {idx + 1}</span>
                                <span className={set.winner === myTeam.name ? 'text-blue-600' : 'text-red-500'}>{set.winner} 승리</span>
                            </div>
                            <div className="text-xs text-gray-500 space-y-1">
                                {set.log.map((l, i) => <div key={i}>{l}</div>)}
                            </div>
                        </div>
                    ))}
                </div>

                <button onClick={() => setSimReport(null)} className="mt-6 w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition">
                    확인
                </button>
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
           {/* 사이드바 메뉴 */}
           {[{id:'dashboard',icon:'📊',name:'대시보드'},{id:'roster',icon:'👥',name:'로스터'},{id:'standings',icon:'🏆',name:'순위표'},{id:'finance',icon:'💰',name:'재정'},{id:'schedule',icon:'📅',name:'일정'}].map(item => (
            <button key={item.id} onClick={() => {setActiveTab(item.id); if(item.id==='dashboard') setViewingTeamId(myTeam.id);}} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === item.id ? 'bg-blue-600 text-white shadow-md translate-x-1' : 'hover:bg-gray-800 hover:text-white hover:translate-x-1'}`}><span>{item.icon}</span> {item.name}</button>
          ))}
        </div>
        <div className="p-4 border-t border-gray-700 bg-gray-800"><button onClick={() => navigate('/')} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition"><span>🚪</span> 메인으로 나가기</button></div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b h-16 flex items-center justify-between px-6 shadow-sm z-10 flex-shrink-0">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">📅</span> {currentDate}</div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">🏆</span> {myRecord.w}승 {myRecord.l}패 ({myRecord.diff > 0 ? `+${myRecord.diff}`: myRecord.diff})</div>
          </div>

          {/* 4번 수정사항: 버튼 위치 및 기능 변경 */}
          <div className="flex items-center gap-3">
             {!hasDrafted ? (
                 <button onClick={handleDraftStart} className="px-6 py-2 rounded-lg font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white animate-pulse shadow-md transition">
                    🎲 조 추첨 시작하기
                 </button>
             ) : (
                 <button onClick={handleProceedDay} disabled={currentDate === "시즌 종료"} className={`px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-md transition ${currentDate === "시즌 종료" ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
                    <span>▶</span> {currentDate} 경기 전체 진행
                 </button>
             )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-7xl mx-auto">
            
            {activeTab === 'dashboard' && (
              <div className="grid grid-cols-12 gap-6">
                {/* 다음 경기 카드 */}
                <div className="col-span-12 lg:col-span-8 bg-white rounded-lg border shadow-sm p-6 relative overflow-hidden">
                   <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span className="text-blue-500">📅</span> 다음 경기 일정</h3>
                   <div className="bg-gray-50 rounded-xl p-6 border flex items-center justify-between">
                      <div className="text-center w-1/3"><div className="text-3xl font-black text-gray-800 mb-1">{myTeam.name}</div><div className="text-sm font-bold text-gray-500">{myRecord.w}승 {myRecord.l}패</div></div>
                      <div className="text-center w-1/3">
                        {nextMatch ? (
                            <>
                                <div className="text-sm font-bold text-blue-600 mb-2">{nextMatch.date} {nextMatch.time}</div>
                                <div className="text-4xl font-black text-gray-300">VS</div>
                            </>
                        ) : <div className="text-sm font-bold text-gray-400">일정 종료</div>}
                      </div>
                      <div className="text-center w-1/3">
                        {nextMatch ? (
                            <>
                                <div className="text-3xl font-black text-gray-800 mb-1">{nextMatch.t1 === myTeam.id ? teams.find(t=>t.id===nextMatch.t2)?.name : teams.find(t=>t.id===nextMatch.t1)?.name}</div>
                                <div className="text-sm font-bold text-gray-500">상대 전적 {oppRecord.w}승 {oppRecord.l}패</div>
                            </>
                        ) : <div className="text-3xl font-black text-gray-300">TBD</div>}
                      </div>
                   </div>
                </div>

                {/* 미니 순위표 */}
                <div className="col-span-12 lg:col-span-4 bg-white rounded-lg border shadow-sm p-4 h-[300px] overflow-y-auto">
                   <h3 className="font-bold text-gray-700 mb-3 text-sm">🏆 실시간 순위</h3>
                   <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500 border-b"><tr><th className="p-2 w-8">#</th><th className="p-2 text-left">팀</th><th className="p-2 text-center">승패</th><th className="p-2 text-center">득실</th></tr></thead>
                      <tbody>
                        {hasDrafted && league.groups ? 
                            [...league.groups.baron, ...league.groups.elder]
                            .map(tid => ({t: teams.find(x=>x.id===tid), r: league.standings[tid] || {w:0,l:0,diff:0}}))
                            .sort((a,b) => b.r.w - a.r.w || b.r.diff - a.r.diff)
                            .map((item, idx) => (
                                <tr key={item.t.id} className="border-b last:border-0 hover:bg-gray-50">
                                    <td className="p-2 text-center font-bold text-gray-500">{idx+1}</td>
                                    <td className={`p-2 font-bold ${item.t.id === myTeam.id ? 'text-blue-600' : 'text-gray-800'}`}>{item.t.name}</td>
                                    <td className="p-2 text-center">{item.r.w} - {item.r.l}</td>
                                    <td className="p-2 text-center text-gray-400">{item.r.diff > 0 ? `+${item.r.diff}` : item.r.diff}</td>
                                </tr>
                            ))
                        : <tr><td colSpan="4" className="p-4 text-center text-gray-400">시즌 시작 전</td></tr>}
                      </tbody>
                   </table>
                </div>

                {/* 로스터 요약 */}
                <div className="col-span-12 bg-white rounded-lg border shadow-sm overflow-hidden">
                  <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">👥 로스터 현황</h3>
                    <button onClick={()=>setActiveTab('roster')} className="text-xs font-bold text-blue-600 hover:underline">자세히 보기</button>
                  </div>
                  <div className="p-0 overflow-x-auto">
                    {/* 2번 수정사항: table-fixed 및 whitespace-normal 적용 */}
                    <table className="w-full text-sm table-fixed min-w-[600px]">
                        <thead className="bg-white text-gray-400 text-xs uppercase font-bold border-b">
                            <tr>
                                <th className="py-3 px-4 text-left w-16">POS</th>
                                <th className="py-3 px-4 text-left w-32">NAME</th>
                                <th className="py-3 px-4 text-center w-16">OVR</th>
                                <th className="py-3 px-4 text-center">POT</th>
                                <th className="py-3 px-4 text-center">CONTRACT</th>
                                <th className="py-3 px-4 text-center">SALARY</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {currentRoster.map((p, i) => (
                                <tr key={i} className="hover:bg-gray-50 transition">
                                    <td className="py-3 px-4 font-bold text-gray-400">{p.포지션}</td>
                                    <td className="py-3 px-4 font-bold text-gray-800 truncate">{p.이름} <span className="text-gray-400 font-normal text-xs">({p.실명})</span></td>
                                    <td className="py-3 px-4 text-center"><span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td>
                                    <td className="py-3 px-4 text-center"><span className={`text-xs font-bold ${getPotBadgeStyle(p.잠재력)}`}>{p.잠재력}</span></td>
                                    <td className="py-3 px-4 text-center text-xs text-gray-500">{formatContract(p.계약)} 만료</td>
                                    <td className="py-3 px-4 text-center font-bold text-gray-700">{p.연봉}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'roster' && (
              <div className="bg-white rounded-lg border shadow-sm flex flex-col">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h2 className="text-2xl font-black text-gray-900">{viewingTeam.fullName} 로스터</h2>
                    <div className="text-2xl font-black text-blue-600">{viewingTeam.power} <span className="text-sm text-gray-400 font-normal">TEAM OVR</span></div>
                </div>
                <div className="overflow-x-auto">
                    {/* 2번 수정사항: 전체 로스터 뷰 스타일 개선 */}
                    <table className="w-full text-sm table-fixed min-w-[800px]">
                        <thead className="bg-white text-gray-500 text-xs uppercase font-bold border-b">
                            <tr>
                                <th className="py-4 px-4 text-left w-16 bg-gray-50">POS</th>
                                <th className="py-4 px-4 text-left w-40 bg-gray-50">PLAYER</th>
                                <th className="py-4 px-2 text-center w-14">OVR</th>
                                <th className="py-4 px-2 text-center w-14">AGE</th>
                                <th className="py-4 px-2 text-center hidden md:table-cell">CAREER</th>
                                <th className="py-4 px-2 text-center bg-gray-50 border-l">LINE</th>
                                <th className="py-4 px-2 text-center bg-gray-50">ATK</th>
                                <th className="py-4 px-2 text-center bg-gray-50">TF</th>
                                <th className="py-4 px-2 text-center bg-gray-50">GRO</th>
                                <th className="py-4 px-2 text-center bg-gray-50">OPR</th>
                                <th className="py-4 px-4 text-center border-l w-24">POTENTIAL</th>
                                <th className="py-4 px-4 text-center w-24">CONTRACT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {currentRoster.map((p, i) => (
                                <tr key={i} className="hover:bg-blue-50/30 transition">
                                    <td className="py-4 px-4 font-bold text-gray-400 bg-gray-50/30">{p.포지션}</td>
                                    <td className="py-4 px-4 bg-gray-50/30">
                                        <div className="font-bold text-gray-900 text-base leading-tight">{p.이름}</div>
                                        <div className="text-xs text-gray-400 truncate">{p.실명}</div>
                                    </td>
                                    <td className="py-4 px-2 text-center"><span className={`inline-block px-2 py-1 rounded text-xs font-black border ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td>
                                    <td className="py-4 px-2 text-center text-gray-600">{p.나이}</td>
                                    <td className="py-4 px-2 text-center text-gray-500 hidden md:table-cell">{p.경력}</td>
                                    <td className="py-4 px-2 text-center border-l font-medium text-gray-600">{p.상세?.라인전}</td>
                                    <td className="py-4 px-2 text-center font-medium text-gray-600">{p.상세?.무력}</td>
                                    <td className="py-4 px-2 text-center font-medium text-gray-600">{p.상세?.한타}</td>
                                    <td className="py-4 px-2 text-center font-medium text-gray-600">{p.상세?.성장}</td>
                                    <td className="py-4 px-2 text-center font-medium text-gray-600">{p.상세?.운영}</td>
                                    <td className="py-4 px-4 text-center border-l font-bold text-purple-600">{p.잠재력}</td>
                                    <td className="py-4 px-4 text-center">
                                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">{formatContract(p.계약)}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </div>
            )}

            {/* 나머지 탭들 (Standings, Schedule, Finance)은 기존 구조 유지하되 데이터 연결 확인 */}
            {activeTab === 'standings' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {hasDrafted && ['baron', 'elder'].map(grp => (
                        <div key={grp} className="bg-white rounded-lg border shadow-sm overflow-hidden">
                            <div className={`p-4 border-b flex items-center gap-2 ${grp==='baron'?'bg-purple-50 border-purple-100':'bg-red-50 border-red-100'}`}>
                                <span className="text-xl">{grp==='baron'?'🟣':'🔴'}</span>
                                <h3 className={`font-black text-lg capitalize ${grp==='baron'?'text-purple-900':'text-red-900'}`}>{grp} Group</h3>
                            </div>
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-bold border-b"><tr><th className="p-3 w-10">#</th><th className="p-3 text-left">Team</th><th className="p-3 text-center">W</th><th className="p-3 text-center">L</th><th className="p-3 text-center">Diff</th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {league.groups[grp].map(tid => ({t:teams.find(x=>x.id===tid), r:league.standings[tid]||{w:0,l:0,diff:0}}))
                                    .sort((a,b) => b.r.w - a.r.w || b.r.diff - a.r.diff)
                                    .map((item, idx) => (
                                        <tr key={item.t.id} className="hover:bg-gray-50">
                                            <td className="p-3 text-center font-bold text-gray-500">{idx+1}</td>
                                            <td className="p-3 font-bold text-gray-800">{item.t.fullName}</td>
                                            <td className="p-3 text-center font-bold text-blue-600">{item.r.w}</td>
                                            <td className="p-3 text-center font-bold text-red-600">{item.r.l}</td>
                                            <td className="p-3 text-center text-gray-500">{item.r.diff}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                    {!hasDrafted && <div className="col-span-2 text-center py-20 text-gray-400">시즌 시작 전입니다.</div>}
                </div>
            )}

            {activeTab === 'schedule' && (
                <div className="bg-white rounded-lg border shadow-sm p-6">
                    <h2 className="text-xl font-bold mb-4">📅 전체 경기 일정</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {league.matches && league.matches.map((m, i) => {
                            const t1 = teams.find(t=>t.id===m.t1);
                            const t2 = teams.find(t=>t.id===m.t2);
                            const isDone = m.status === 'finished';
                            return (
                                <div key={i} className={`p-4 rounded-lg border flex flex-col gap-2 ${isDone ? 'bg-gray-50 opacity-80' : 'bg-white'}`}>
                                    <div className="flex justify-between text-xs font-bold text-gray-500">
                                        <span>{m.date}</span>
                                        <span className={isDone ? 'text-green-600' : 'text-blue-500'}>{isDone ? '종료' : '예정'}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                        <div className={`font-bold ${isDone && m.result.winner===t1.name ? 'text-blue-600':'text-gray-700'}`}>{t1.name}</div>
                                        <div className="font-black text-lg bg-gray-100 px-3 py-1 rounded">
                                            {isDone ? m.result.score : 'VS'}
                                        </div>
                                        <div className={`font-bold ${isDone && m.result.winner===t2.name ? 'text-blue-600':'text-gray-700'}`}>{t2.name}</div>
                                    </div>
                                </div>
                            );
                        })}
                        {!league.matches && <div className="text-gray-400">일정이 없습니다.</div>}
                    </div>
                </div>
            )}

             {activeTab === 'finance' && (
              <div className="bg-white rounded-lg border shadow-sm flex flex-col p-6">
                 <h2 className="text-2xl font-black text-gray-900 mb-6">{viewingTeam.fullName} 재정</h2>
                 <div className="grid grid-cols-2 gap-8">
                     <div className="bg-gray-50 p-6 rounded-xl border">
                        <h3 className="font-bold text-gray-700 mb-2">총 지출</h3>
                        <div className="text-3xl font-black text-blue-600">{finance.total_expenditure}억</div>
                     </div>
                     <div className="bg-gray-50 p-6 rounded-xl border">
                        <h3 className="font-bold text-gray-700 mb-2">사치세</h3>
                        <div className="text-3xl font-black text-red-600">{finance.luxury_tax}억</div>
                     </div>
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