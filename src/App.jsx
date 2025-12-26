import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import playerList from './data/players.json';
import championList from './data/champions.json';

// ★ 시뮬레이션 엔진 2.3 import (상대 경로 확인!)
import { simulateMatch } from './utils/simulationEngine'; 

// --- 기존 데이터 유지 (팀 정보) ---
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

const difficulties = [
  { value: 'easy', label: '쉬움', color: 'green' },
  { value: 'normal', label: '보통', color: 'blue' },
  { value: 'hard', label: '어려움', color: 'orange' },
  { value: 'insane', label: '극악', color: 'red' },
];

// --- 재정 데이터 (기존 유지) ---
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

const calculateTax = (capSum) => {
  if (capSum >= 80) return 10 + (capSum - 80) * 0.5;
  if (capSum > 40) return (capSum - 40) * 0.25;
  return 0;
};

// --- 유틸리티 함수 (기존 유지) ---
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
  return 'bg-blue-100 text-blue-700 border-blue-300 ring-blue-200';
};
const getPotBadgeStyle = (pot) => (pot >= 95 ? 'text-purple-600 font-black' : (pot >= 90 ? 'text-blue-600 font-bold' : 'text-gray-500 font-medium'));

// --- 스케줄러 (기존 유지) ---
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
        allMatches.push({ t1: baronTeam, t2: elderTeam, type: 'regular', status: 'pending', format: 'BO3' });
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
    finalSchedule.push({ t1: null, t2: null, date: day, time: '17:00', type: 'tbd', format: 'BO5' });
  });

  return finalSchedule;
};


// --- 메인 페이지 컴포넌트 (LeagueManager) ---
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

// --- 팀 선택 컴포넌트 (TeamSelection) ---
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
        <div className="bg-gray-50 rounded-lg p-4 mb-8 text-sm leading-relaxed border border-gray-100">
          <p className="text-gray-600 font-medium">ℹ️ 난이도가 상승할수록 승리 확률 감소, 재계약 확률 감소, 선수의 기복이 증가하여 전체적으로 운영이 어려워집니다.</p>
          {diff === 'insane' && <p className="text-red-600 font-bold mt-2 animate-pulse">⚠️ 극악 난이도는 운과 실력이 모두 필요한 최악의 시나리오입니다.</p>}
        </div>
        <button onClick={handleStart} className="w-full py-5 rounded-2xl font-black text-xl text-white shadow-lg hover:shadow-xl hover:opacity-90 transition transform hover:-translate-y-1" style={{backgroundColor:current.colors.primary,color:getTextColor(current.colors.primary)}}>2026 시즌 시작하기</button>
      </div>
    </div>
  );
}

// =========================================================================
// 4. Dashboard (게임 대시보드) - 시뮬레이션 연결됨
// =========================================================================
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
  
  // 시뮬레이션 상태
  const [isSimulating, setIsSimulating] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const draftTimeoutRef = useRef(null);

  // 메타 분석 탭 상태
  const [metaRole, setMetaRole] = useState('TOP');

  // 로스터 정보 가져오기 Helper
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
  const currentDateDisplay = hasDrafted ? '2026년 1월 8일' : '2026년 1월 1일';

  // --- 드래프트 로직 (기존 유지) ---
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

  // --- ★ 경기 시뮬레이션 연결부 (NEW) ---
  const handleSimulateMatch = () => {
    const nextMatchIdx = league.matches.findIndex(m => m.status === 'pending');
    if (nextMatchIdx === -1) {
      alert("진행할 경기가 없습니다.");
      return;
    }
    const match = league.matches[nextMatchIdx];
    
    // 엔진에 보낼 팀 정보 구성 (getFullRoster 사용)
    const t1 = teams.find(t => t.id === match.t1);
    const t2 = teams.find(t => t.id === match.t2);
    const teamA = { ...t1, roster: getFullRoster(t1.id) };
    const teamB = { ...t2, roster: getFullRoster(t2.id) };

    setIsSimulating(true);

    setTimeout(() => {
      // 2.3 버전 엔진 실행 (인자 2개)
      const result = simulateMatch(teamA, teamB); 
      
      const updatedMatches = [...league.matches];
      updatedMatches[nextMatchIdx] = { 
        ...match, 
        status: 'finished', 
        result: result 
      };

      // 순위 업데이트 (간소화: 승자에게 승점 부여 로직은 추후 추가 가능)
      // 여기선 matches 배열만 업데이트
      const updatedLeague = { ...league, matches: updatedMatches };
      updateLeague(league.id, { matches: updatedMatches });
      setLeague(updatedLeague);
      
      setMatchResult(result);
      setIsSimulating(false);
    }, 1000);
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

  const nextMatch = league.matches ? league.matches.find(m => m.status === 'pending') : null;
  const nextTeam1 = nextMatch ? teams.find(t=>t.id===nextMatch.t1) : null;
  const nextTeam2 = nextMatch ? teams.find(t=>t.id===nextMatch.t2) : null;
  const oppRecord = { w: 0, l: 0 }; 

  // 재정 데이터
  const fin = teamFinanceData[viewingTeam.name] || { total_expenditure: 0, cap_expenditure: 0, luxury_tax: 0 };
  const luxuryTax = calculateTax(fin.cap_expenditure);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans relative">
      
      {/* 1. 경기 결과 모달 */}
      {matchResult && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full text-center shadow-2xl animate-fade-in-up">
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
              {matchResult.logs.map((log, i) => (
                <div key={i} className="border-b border-gray-200 pb-2 last:border-0">{log}</div>
              ))}
            </div>
            <button onClick={() => setMatchResult(null)} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 transition">확인</button>
          </div>
        </div>
      )}

      {/* 2. 드래프트 모달 */}
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

      {/* 사이드바 */}
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

      {/* 메인 컨텐츠 */}
      <main className="flex-1 overflow-y-auto p-6 scroll-smooth bg-gray-50">
        <div className="max-w-7xl mx-auto">
          
          {/* A. 대시보드 탭 */}
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-12 gap-6">
               <div className="col-span-12 lg:col-span-8 bg-white rounded-lg border shadow-sm p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 text-9xl select-none">📅</div>
                  <h3 className="text-xl font-black text-gray-800 mb-4">다음 경기 일정</h3>
                  
                  {nextMatch ? (
                    <div className="flex flex-col items-center">
                        <div className="flex items-center justify-between w-full mb-6 px-10">
                            <div className="text-center w-1/3">
                                <div className="text-4xl font-black text-gray-800 mb-2">{nextTeam1?.name}</div>
                                <div className="text-xs font-bold text-white bg-blue-600 px-2 py-1 rounded inline-block">HOME</div>
                            </div>
                            <div className="text-center w-1/3">
                                <div className="text-xs font-bold text-gray-400 mb-1">VS</div>
                                <div className="text-2xl font-black text-gray-300">@</div>
                            </div>
                            <div className="text-center w-1/3">
                                <div className="text-4xl font-black text-gray-800 mb-2">{nextTeam2?.name}</div>
                                <div className="text-xs font-bold text-white bg-red-600 px-2 py-1 rounded inline-block">AWAY</div>
                            </div>
                        </div>
                        <button 
                            onClick={handleSimulateMatch} 
                            disabled={isSimulating}
                            className={`px-10 py-4 rounded-full font-black text-lg shadow-lg transition transform hover:-translate-y-1 flex items-center gap-2 ${isSimulating ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                        >
                            {isSimulating ? '⚡ 경기 진행 중...' : '▶ 경기 시작'}
                        </button>
                        <div className="mt-6 text-xs font-bold text-gray-400 bg-gray-100 px-4 py-2 rounded-full">
                            {nextMatch.date} {nextMatch.time} · {nextMatch.format} · 치지직 롤파크
                        </div>
                    </div>
                  ) : (
                    <div className="text-center py-20 text-gray-400 font-bold">
                        <div>🎉 모든 일정이 종료되었습니다!</div>
                        <div className="text-sm font-normal mt-2">순위표에서 최종 결과를 확인하세요.</div>
                    </div>
                  )}
                  {/* 드래프트 버튼 (아직 안했으면 노출) */}
                  <div className="mt-6 text-center">
                     <button onClick={handleDraftStart} disabled={hasDrafted} className={`px-4 py-2 rounded text-sm font-bold ${hasDrafted ? 'bg-gray-200 text-gray-400 hidden' : 'bg-green-600 text-white animate-pulse'}`}>조 추첨 시작하기</button>
                  </div>
               </div>

               {/* 우측 순위표 (간략) */}
               <div className="col-span-12 lg:col-span-4 bg-white rounded-lg border shadow-sm p-4 flex flex-col h-full max-h-[500px]">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b">
                      <h3 className="font-bold text-gray-700">순위표</h3>
                      <button onClick={()=>setActiveTab('standings')} className="text-xs text-blue-600 font-bold hover:underline">전체 보기</button>
                  </div>
                  {/* ... (기존 순위표 로직) ... */}
                  {hasDrafted ? (
                     <div className="flex-1 overflow-y-auto">
                        <div className="mb-4"><div className="font-bold text-purple-700 mb-1">Baron</div>{league.groups.baron.map((id,i)=><div key={id} className="text-xs flex justify-between p-1 border-b"><span>{i+1}. {teams.find(t=>t.id===id).name}</span><span>0-0</span></div>)}</div>
                        <div><div className="font-bold text-red-700 mb-1">Elder</div>{league.groups.elder.map((id,i)=><div key={id} className="text-xs flex justify-between p-1 border-b"><span>{i+1}. {teams.find(t=>t.id===id).name}</span><span>0-0</span></div>)}</div>
                     </div>
                  ) : (
                     <div className="text-center text-gray-400 py-10">데이터 없음</div>
                  )}
               </div>
            </div>
          )}

          {/* B. 로스터 탭 (개선됨) */}
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
                  <thead className="bg-gray-100 text-gray-600 font-bold">
                    <tr>
                      <th className="p-4">선수</th>
                      <th className="p-4 text-center">종합</th>
                      <th className="p-4 text-center">나이</th>
                      <th className="p-4 text-center">경력</th>
                      <th className="p-4 text-center">소속</th>
                      <th className="p-4 text-center">연봉</th>
                      <th className="p-4 text-center border-l">라인전</th>
                      <th className="p-4 text-center">무력</th>
                      <th className="p-4 text-center">한타</th>
                      <th className="p-4 text-center">운영</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {currentRoster.map((p, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-4 font-bold">{p.포지션} {p.이름}</td>
                        <td className="p-4 text-center"><span className={`px-2 py-1 rounded font-black ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td>
                        <td className="p-4 text-center text-gray-500">{p.나이?.split('(')[0]}</td>
                        <td className="p-4 text-center text-gray-500">{p.경력?.split('(')[0]}</td>
                        <td className="p-4 text-center text-gray-500">{p['팀 소속기간']}</td>
                        <td className="p-4 text-center font-bold text-blue-600">{p.연봉}</td>
                        <td className="p-4 text-center border-l text-gray-400">{p.상세?.라인전}</td>
                        <td className="p-4 text-center text-gray-400">{p.상세?.무력}</td>
                        <td className="p-4 text-center text-gray-400">{p.상세?.한타}</td>
                        <td className="p-4 text-center text-gray-400">{p.상세?.운영}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* C. 재정 탭 (개선됨) */}
          {activeTab === 'finance' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-4">
                    <button onClick={handlePrevTeam} className="text-xl">◀</button>
                    <h2 className="text-2xl font-black">{viewingTeam.fullName} 재정 보고서</h2>
                    <button onClick={handleNextTeam} className="text-xl">▶</button>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 font-bold">부과 사치세</p>
                    <p className="text-3xl font-black text-red-600">{luxuryTax.toFixed(2)}억</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div>
                      <div className="flex justify-between mb-2 font-bold"><span>총 지출</span><span className="text-blue-600">{fin.total_expenditure}억</span></div>
                      <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden"><div className="bg-blue-500 h-full" style={{width: `${(fin.total_expenditure / 150) * 100}%`}}></div></div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2 font-bold"><span>샐러리캡 반영</span><span className="text-purple-600">{fin.cap_expenditure}억 / 80억</span></div>
                      <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden relative">
                        <div className={`h-full ${fin.cap_expenditure > 80 ? 'bg-red-500' : 'bg-purple-500'}`} style={{width: `${(fin.cap_expenditure / 150) * 100}%`}}></div>
                        <div className="absolute top-0 left-[53.3%] w-0.5 h-full bg-black border-l border-dashed border-white"></div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <h3 className="font-bold text-gray-700 mb-4">재정 요약</h3>
                    <ul className="space-y-3 text-sm">
                      <li className="flex justify-between"><span>운영 예산:</span> <span className="font-bold">200.0억</span></li>
                      <li className="flex justify-between"><span>선수 연봉 지출:</span> <span className="font-bold text-red-500">-{fin.total_expenditure}억</span></li>
                      <li className="flex justify-between border-t pt-2"><span>예상 잔여 예산:</span> <span className="font-black text-blue-600">{(200 - fin.total_expenditure - luxuryTax).toFixed(2)}억</span></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* D. 기타 탭 (Placeholder) */}
          {(activeTab === 'standings' || activeTab === 'schedule' || activeTab === 'team_schedule' || activeTab === 'meta') && (
             <div className="bg-white p-10 rounded-xl shadow-sm border text-center text-gray-400">
                <h3 className="text-xl font-bold mb-2">준비 중인 기능입니다.</h3>
                {activeTab === 'standings' && hasDrafted && (
                    <div className="mt-4 grid grid-cols-2 gap-4 text-left">
                        {/* 상세 순위표 구현 가능 영역 */}
                        <div className="bg-purple-50 p-4 rounded">Baron Group 상세...</div>
                        <div className="bg-red-50 p-4 rounded">Elder Group 상세...</div>
                    </div>
                )}
             </div>
          )}

        </div>
      </main>
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