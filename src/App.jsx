import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import playerList from './data/players.json';
import championList from './data/champions.json';

// --- 데이터 (팀 ID는 숫자형) ---
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

// --- 유틸리티 ---
const getLeagues = () => { 
    try {
        const s = localStorage.getItem('lckgm_leagues'); 
        return s ? JSON.parse(s) : []; 
    } catch(e) { return []; }
};
const saveLeagues = (l) => localStorage.setItem('lckgm_leagues', JSON.stringify(l));
const addLeague = (l) => { const list = getLeagues(); list.push(l); saveLeagues(list); return list; };
const updateLeague = (id, u) => { 
  const leagues = getLeagues(); 
  const index = leagues.findIndex(l => String(l.id) === String(id)); 
  if (index !== -1) { 
    // 깊은 복사 대신 spread로 얕은 복사 후 병합 (React 상태 갱신 유도)
    const newLeague = { ...leagues[index], ...u };
    leagues[index] = newLeague; 
    saveLeagues(leagues); 
    return newLeague;
  }
  return null;
};
const deleteLeague = (id) => { const l = getLeagues().filter(x => String(x.id) !== String(id)); saveLeagues(l); return l; };
const getLeagueById = (id) => getLeagues().find(l => String(l.id) === String(id));
function getTextColor(hex) { 
    if(!hex) return '#000000';
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); 
    return (r*299+g*587+b*114)/1000>128?'#000000':'#FFFFFF'; 
}

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

// --- 스케줄러 (로테이션 알고리즘: 절대 멈추지 않음) ---
const generateSchedule = (baronIds, elderIds) => {
  const week1Days = ['1.14 (수)', '1.15 (목)', '1.16 (금)', '1.17 (토)', '1.18 (일)'];
  const week2Days = ['1.21 (수)', '1.22 (목)', '1.23 (금)', '1.24 (토)', '1.25 (일)'];
  const allDays = [...week1Days, ...week2Days];
  const week3Days = ['1.28 (수)', '1.29 (목)', '1.30 (금)', '1.31 (토)', '2.1 (일)'];

  // 로테이션을 위한 배열 복사
  const barons = [...baronIds]; // B1, B2, B3, B4, B5
  const elders = [...elderIds]; // E1, E2, E3, E4, E5 (초기)

  let matches = [];
  
  // 각 바론 팀은 4개의 엘더 팀과 경기해야 함 (총 20경기)
  // Round 1: i vs i
  // Round 2: i vs (i+1)%5
  // Round 3: i vs (i+2)%5
  // Round 4: i vs (i+3)%5
  // (i+4)%5 는 스킵 (상대 안 함)
  
  // 4라운드로 나누어 매치 생성
  for (let r = 0; r < 4; r++) {
      for (let i = 0; i < 5; i++) {
          const b = barons[i];
          const e = elders[(i + r) % 5];
          matches.push({ t1: b, t2: e, type: 'regular', status: 'pending', format: 'BO3' });
      }
  }

  // 이제 20개의 경기가 생성됨.
  // 하루에 2경기씩 순차적으로 배정하면 자연스럽게 팀이 섞임 (위 로직이 순차적이기 때문)
  // 하지만 더 확실한 분산을 위해 약간 섞되, 날짜 순서는 지킴.
  
  // 간단하게 순서대로 배치하되, 5경기 단위(한 라운드)를 2.5일에 걸쳐 배치
  // Day 1: M1, M2
  // Day 2: M3, M4
  // Day 3: M5, M6 (여기서 M6은 Round 2의 첫 경기)
  // 이렇게 하면 같은 팀이 2-3일 간격으로 경기하게 됨 (연전 방지 자동 해결)

  const finalSchedule = [];
  let dayIdx = 0;
  
  for (let i = 0; i < matches.length; i += 2) {
      if (dayIdx >= 10) break;
      
      const m1 = matches[i];
      const m2 = matches[i+1];
      
      if (m1) finalSchedule.push({ ...m1, date: allDays[dayIdx], time: '17:00' });
      if (m2) finalSchedule.push({ ...m2, date: allDays[dayIdx], time: '19:30' });
      
      dayIdx++;
  }

  // 3주차 TBD
  week3Days.forEach(day => {
    finalSchedule.push({ t1: null, t2: null, date: day, time: '17:00', type: 'tbd', format: 'BO5' });
  });

  return finalSchedule;
};


// --- 컴포넌트 ---

function LeagueManager() {
  const [leagues, setLeagues] = useState([]);
  const navigate = useNavigate();
  
  useEffect(() => {
    setLeagues(getLeagues());
  }, []);
  
  const handleClearData = () => {
    if(window.confirm('오류 해결을 위해 데이터를 초기화하시겠습니까?')){
        localStorage.removeItem('lckgm_leagues');
        window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-black text-gray-800 tracking-tight">LCK 매니저 2026</h1>
            <button onClick={handleClearData} className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 text-sm font-bold transition">⚠️ 데이터 초기화 (오류 해결)</button>
        </div>
        
        <div className="grid gap-4">
          {leagues.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">생성된 시즌이 없습니다. 시작하기를 눌러주세요!</div>
          ) : leagues.map(l => {
            // 안전장치: 팀 정보가 없으면 렌더링 안함
            const t = teams.find(x => String(x.id) === String(l.team.id));
            if (!t) return null; 
            
            return (
              <div key={l.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-500 hover:shadow-md transition flex justify-between items-center group">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-white shadow-md text-lg" style={{backgroundColor:t.colors.primary}}>{t.name}</div>
                  <div><h2 className="text-xl font-bold group-hover:text-blue-600 transition">{t.fullName}</h2><p className="text-gray-500 font-medium text-sm">{l.leagueName} · {l.difficulty.toUpperCase()}</p></div>
                </div>
                <div className="flex gap-3">
                  <button onClick={()=>{updateLeague(l.id,{lastPlayed:new Date().toISOString()});navigate(`/league/${l.id}`)}} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition">접속하기</button>
                  <button onClick={()=>{if(window.confirm('정말 삭제하시겠습니까?')){deleteLeague(l.id);setLeagues(getLeagues())}}} className="bg-gray-100 text-gray-600 px-4 py-2.5 rounded-lg font-bold hover:bg-gray-200 transition">삭제</button>
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
    const newLeague = {
      id: newId,
      leagueName: `2026 LCK 컵 - ${current.name}`,
      team: current,
      difficulty: diff,
      createdAt: new Date().toISOString(),
      lastPlayed: new Date().toISOString(),
      groups: { baron: [], elder: [] },
      matches: []
    };
    
    // 저장 후 이동
    addLeague(newLeague);
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
  const [prizeMoney, setPrizeMoney] = useState(0.0); // 상금 0.0억 초기화

  // 드래프트 상태
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftPool, setDraftPool] = useState([]);
  const [draftGroups, setDraftGroups] = useState({ baron: [], elder: [] });
  const [draftTurn, setDraftTurn] = useState('user');
  const draftTimeoutRef = useRef(null);
  const [metaRole, setMetaRole] = useState('TOP');

  useEffect(() => {
    const found = getLeagueById(leagueId);
    if (found) {
      setLeague(found);
      // viewingTeamId가 없을 때만 초기화 (새로고침 시 유지)
      if (!viewingTeamId) {
          setViewingTeamId(found.team.id);
      }
    } else {
        // 데이터가 없으면 홈으로 (안전장치)
    }
  }, [leagueId]);

  const handleMenuClick = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'dashboard' && league) {
      setViewingTeamId(league.team.id);
    }
  };

  const handleStandingsTeamClick = (teamId) => {
    setViewingTeamId(teamId);
    setActiveTab('dashboard');
  };

  // 안전장치
  if (!league) return <div className="flex h-screen items-center justify-center font-bold text-gray-500">데이터 로딩 중...</div>;
  
  // Team Lookup (안전장치: String 비교)
  const safeTeam = (id) => teams.find(t => String(t.id) === String(id)) || { name: 'Unknown', fullName: 'Unknown Team', colors: { primary: '#999' } };
  
  const myTeam = safeTeam(league.team.id);
  const viewingTeam = safeTeam(viewingTeamId || myTeam.id);
  const currentRoster = (playerList || []).filter(p => p.팀 === viewingTeam.name);
  const isCaptain = String(myTeam.id) === "1" || String(myTeam.id) === "2"; 
  const hasDrafted = league.groups && league.groups.baron && league.groups.baron.length > 0;
  const currentDateDisplay = hasDrafted ? '2026년 1월 8일' : '2026년 1월 1일';

  // --- 드래프트 로직 ---
  const handleDraftStart = () => {
    if (hasDrafted) return;
    setIsDrafting(true);
    // GEN(1), HLE(2) 제외한 풀
    const pool = teams.filter(t => String(t.id) !== "1" && String(t.id) !== "2");
    setDraftPool(pool);
    setDraftGroups({ baron: [1], elder: [2] }); 

    if (isCaptain) {
        if (String(myTeam.id) === "1") { setDraftTurn('user'); } 
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
        if (String(myTeam.id) === "1") newGroups.elder.push(picked.id); else newGroups.baron.push(picked.id);
        setDraftPool(newPool); setDraftGroups(newGroups); setDraftTurn('user');
        if (newPool.length === 0) finalizeDraft(newGroups);
    }, 800);
  };

  const handleUserPick = (teamId) => {
    if (draftTurn !== 'user') return;
    const picked = teams.find(t => t.id === teamId);
    const newPool = draftPool.filter(t => t.id !== teamId);
    let newGroups = { ...draftGroups };
    if (String(myTeam.id) === "1") newGroups.baron.push(picked.id); else newGroups.elder.push(picked.id);
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
    
    // 1. LocalStorage 업데이트
    const updated = updateLeague(league.id, { groups, matches });
    
    // 2. React State 강제 업데이트 (새로고침 없이 화면 전환 핵심)
    if (updated) {
        setLeague({ ...updated });
        setIsDrafting(false);
        setActiveTab('standings'); // 순위표 탭으로 이동
        alert("팀 구성 및 일정이 완료되었습니다!");
    } else {
        alert("저장 중 오류가 발생했습니다.");
        setIsDrafting(false);
    }
  };

  const handlePrevTeam = () => { const idx = teams.findIndex(t => t.id === viewingTeam.id); setViewingTeamId(teams[(idx - 1 + teams.length) % teams.length].id); };
  const handleNextTeam = () => { const idx = teams.findIndex(t => t.id === viewingTeam.id); setViewingTeamId(teams[(idx + 1) % teams.length].id); };

  const nextMatch = league.matches ? league.matches.find(m => m.type !== 'tbd' && (String(m.t1) === String(myTeam.id) || String(m.t2) === String(myTeam.id))) : null;
  const t1 = nextMatch ? safeTeam(nextMatch.t1) : null;
  const t2 = nextMatch ? safeTeam(nextMatch.t2) : null;
  const opponentId = nextMatch ? (nextMatch.t1 === myTeam.id ? nextMatch.t2 : nextMatch.t1) : null;
  const oppRecord = { w: 0, l: 0 }; 

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans relative">
      
      {/* Draft Modal */}
      {isDrafting && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full text-center shadow-2xl flex flex-col min-h-[500px]">
            <h2 className="text-3xl font-black mb-2">{isCaptain ? "팀 드래프트 진행" : "조 추첨 진행 중..."}</h2>
            {!isCaptain ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-500">젠지와 한화생명이 팀을 고르고 있습니다...</p>
                </div>
            ) : (
                <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center bg-gray-100 p-4 rounded-lg mb-6">
                        <div className={`w-1/3 p-3 rounded-lg ${draftTurn === (String(myTeam.id)==="1"?'user':'cpu') ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-white'}`}>
                            <span className="font-bold text-lg block mb-1">GEN (Baron)</span>
                            <div className="flex flex-wrap gap-1 justify-center">{draftGroups.baron.map(id => <span key={id} className="text-xs bg-gray-800 text-white px-2 py-1 rounded">{safeTeam(id).name}</span>)}</div>
                        </div>
                        <div className="w-1/3 text-xl font-bold text-gray-400">VS</div>
                        <div className={`w-1/3 p-3 rounded-lg ${draftTurn === (String(myTeam.id)==="2"?'user':'cpu') ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-white'}`}>
                            <span className="font-bold text-lg block mb-1">HLE (Elder)</span>
                            <div className="flex flex-wrap gap-1 justify-center">{draftGroups.elder.map(id => <span key={id} className="text-xs bg-gray-800 text-white px-2 py-1 rounded">{safeTeam(id).name}</span>)}</div>
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
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b h-14 flex items-center justify-between px-6 shadow-sm z-10 flex-shrink-0">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">📅</span> {currentDateDisplay}</div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">🏆</span> 0승 0패</div>
            <div className="h-4 w-px bg-gray-300"></div>
            {/* 상금 표시 */}
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
                      <div className="text-center w-1/3"><div className="text-4xl font-black text-gray-800 mb-2">{myTeam.name}</div><div className="text-sm font-bold text-gray-500">0 - 0</div></div>
                      <div className="text-center w-1/3">
                        <div className="text-xs font-bold text-gray-400 uppercase">VS</div><div className="text-3xl font-bold text-gray-300 my-2">@</div>
                        {nextMatch ? (
                          <div className="mt-1 flex flex-col items-center">
                            {/* BO 표시 및 폰트 수정 */}
                            <span className="text-lg font-black text-blue-600">{nextMatch.date}</span>
                            <span className="text-sm font-bold text-gray-600">{nextMatch.time}</span>
                            <span className="mt-2 text-xs font-bold text-white bg-blue-600 px-3 py-1 rounded-full shadow-sm">{nextMatch.format}</span>
                          </div>
                        ) : <div className="text-xs font-bold text-blue-600">LCK 컵 1R</div>}
                      </div>
                      <div className="text-center w-1/3">
                        {nextMatch ? (
                          <>
                            <div className="text-4xl font-black text-gray-800 mb-2">{String(nextMatch.t1) === String(myTeam.id) ? safeTeam(nextMatch.t2).name : safeTeam(nextMatch.t1).name}</div>
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
                
                <div className="col-span-12 lg:col-span-4 flex flex-col h-full max-h-[300px]">
                   {/* 순위표 분리 복구 */}
                   {hasDrafted ? (
                     <div className="bg-white rounded-lg border shadow-sm p-3 h-full overflow-y-auto">
                        <div className="text-xs font-bold text-gray-500 mb-2 bg-gray-50 p-1 rounded">바론 그룹 (Baron)</div>
                        <table className="w-full text-xs mb-4">
                          <thead className="bg-gray-50 text-gray-400"><tr><th className="p-1 text-center w-6">#</th><th className="p-1 text-left">팀</th><th className="p-1 text-center">승</th><th className="p-1 text-center">패</th><th className="p-1 text-center">득실</th></tr></thead>
                          <tbody>{league.groups.baron.map((id, idx) => { const t = safeTeam(id); return (<tr key={id} onClick={() => setViewingTeamId(id)} className={`cursor-pointer border-b last:border-0 ${String(myTeam.id) === String(id) ? 'bg-blue-100 border-l-4 border-blue-600' : 'hover:bg-gray-50'}`}><td className="p-2 text-center font-bold">{idx+1}</td><td className="p-2 font-bold text-blue-600 hover:underline">{t.fullName}</td><td className="p-2 text-center">0</td><td className="p-2 text-center">0</td><td className="p-2 text-center text-gray-400">0</td></tr>); })}</tbody>
                        </table>
                        <div className="text-xs font-bold text-gray-500 mb-2 bg-gray-50 p-1 rounded">장로 그룹 (Elder)</div>
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 text-gray-400"><tr><th className="p-1 text-center w-6">#</th><th className="p-1 text-left">팀</th><th className="p-1 text-center">승</th><th className="p-1 text-center">패</th><th className="p-1 text-center">득실</th></tr></thead>
                          <tbody>{league.groups.elder.map((id, idx) => { const t = safeTeam(id); return (<tr key={id} onClick={() => setViewingTeamId(id)} className={`cursor-pointer border-b last:border-0 ${String(myTeam.id) === String(id) ? 'bg-blue-100 border-l-4 border-blue-600' : 'hover:bg-gray-50'}`}><td className="p-2 text-center font-bold">{idx+1}</td><td className="p-2 font-bold text-blue-600 hover:underline">{t.fullName}</td><td className="p-2 text-center">0</td><td className="p-2 text-center">0</td><td className="p-2 text-center text-gray-400">0</td></tr>); })}</tbody>
                        </table>
                     </div>
                   ) : (
                     <div className="bg-white rounded-lg border shadow-sm p-0 flex-1 flex flex-col">
                       <div className="p-3 border-b bg-gray-50 font-bold text-sm text-gray-700 flex justify-between"><span>순위표</span><span onClick={()=>setActiveTab('standings')} className="text-xs text-blue-600 cursor-pointer hover:underline">전체 보기</span></div>
                       <div className="flex-1 overflow-y-auto p-0"><table className="w-full text-xs"><tbody>{teams.map((t, i) => { const isMyTeam = myTeam.id === t.id; return (<tr key={t.id} onClick={() => setViewingTeamId(t.id)} className={`cursor-pointer border-b last:border-0 transition-colors duration-150 ${isMyTeam ? 'bg-blue-100 border-l-4 border-blue-600' : 'hover:bg-gray-50'}`}><td className="p-2 font-bold text-gray-500 text-center w-8">{i + 1}</td><td className="p-2 font-bold"><span className="text-blue-600 hover:text-blue-800 hover:underline decoration-blue-400 decoration-2 underline-offset-2">{t.fullName}</span>{isMyTeam && <span className="ml-1 text-xs text-gray-500 font-normal">(선택됨)</span>}</td><td className="p-2 text-right text-gray-500">0-0</td></tr>); })}</tbody></table></div>
                     </div>
                   )}
                </div>

                <div className="col-span-12 bg-white rounded-lg border shadow-sm flex flex-col min-h-[500px]">
                  <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-sm" style={{backgroundColor: viewingTeam.colors.primary}}>{viewingTeam.name}</div><div><h2 className="text-2xl font-black text-gray-800">{viewingTeam.fullName}</h2><p className="text-xs font-bold text-gray-500 uppercase tracking-wide">로스터 요약</p></div></div>
                    <button onClick={()=>setActiveTab('roster')} className="text-sm font-bold text-blue-600 hover:underline">상세 정보 보기 →</button>
                  </div>
                  <div className="p-0 overflow-x-auto">
                    {/* 연차, 나이 포함된 로스터 테이블 */}
                    <table className="w-full text-sm"><thead className="bg-white text-gray-400 text-xs uppercase font-bold border-b"><tr><th className="py-3 px-6 text-left">포지션</th><th className="py-3 px-6 text-left">이름</th><th className="py-3 px-6 text-center">나이</th><th className="py-3 px-6 text-center">경력</th><th className="py-3 px-6 text-center">종합</th><th className="py-3 px-6 text-center">잠재력</th><th className="py-3 px-6 text-left">계약</th></tr></thead><tbody className="divide-y divide-gray-100">{currentRoster.length > 0 ? currentRoster.map((p, i) => (<tr key={i} className="hover:bg-gray-50 transition"><td className="py-3 px-6 font-bold text-gray-400 w-16">{p.포지션}</td><td className="py-3 px-6 font-bold text-gray-800">{p.이름} <span className="text-gray-400 font-normal text-xs ml-1">({p.실명})</span> {p.주장 && <span className="ml-1 text-yellow-500" title="주장">👑</span>}</td><td className="py-3 px-6 text-center text-gray-600">{p.나이 || '-'}</td><td className="py-3 px-6 text-center text-gray-600">{p.경력 || '-'}</td><td className="py-3 px-6 text-center"><span className={`inline-flex items-center justify-center w-8 h-6 rounded font-bold text-xs ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td><td className="py-3 px-6 text-center"><span className={`text-xs ${getPotBadgeStyle(p.잠재력)}`}>{p.잠재력}</span></td><td className="py-3 px-6 text-gray-500 text-xs">{p.계약}년</td></tr>)) : <tr><td colSpan="7" className="py-10 text-center text-gray-300">데이터 없음</td></tr>}</tbody></table>
                  </div>
                </div>
              </div>
            )}

            {/* View: Roster (상세 보기에도 연차, 나이 추가) */}
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
                <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-white text-gray-500 text-xs uppercase font-bold border-b"><tr><th className="py-4 px-6 bg-gray-50 sticky left-0 z-10">정보</th><th className="py-4 px-4 text-center">나이</th><th className="py-4 px-4 text-center">경력</th><th className="py-4 px-4 text-center">종합</th><th className="py-4 px-4 text-center bg-gray-50 border-l">라인전</th><th className="py-4 px-4 text-center bg-gray-50">무력</th><th className="py-4 px-4 text-center bg-gray-50">한타</th><th className="py-4 px-4 text-center bg-gray-50">성장</th><th className="py-4 px-4 text-center bg-gray-50">안정성</th><th className="py-4 px-4 text-center bg-gray-50">운영</th><th className="py-4 px-4 text-center bg-gray-50 border-l text-purple-600">잠재력</th><th className="py-4 px-6 text-left bg-gray-50 border-l">계약 정보</th></tr></thead><tbody className="divide-y divide-gray-100">{currentRoster.map((p, i) => (<tr key={i} className="hover:bg-blue-50/30 transition group"><td className="py-4 px-6 sticky left-0 bg-white group-hover:bg-blue-50/30"><div className="flex items-center gap-3"><span className="font-bold text-gray-400 w-8">{p.포지션}</span><div><div className="font-bold text-gray-900 text-base">{p.이름} <span className="text-gray-400 font-normal text-xs ml-1">({p.실명})</span> {p.주장 && <span className="ml-1 text-yellow-500" title="주장">👑</span>}</div><div className="text-xs text-gray-400">{p.특성}</div></div></div></td><td className="py-4 px-4 text-center text-gray-600">{p.나이 || '-'}</td><td className="py-4 px-4 text-center text-gray-600">{p.경력 || '-'}</td><td className="py-4 px-4 text-center"><span className={`inline-flex items-center justify-center w-10 h-8 rounded-lg font-black text-sm shadow-sm border ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td><td className="py-4 px-4 text-center border-l font-medium text-gray-600">{p.상세?.라인전 || '-'}</td><td className="py-4 px-4 text-center font-medium text-gray-600">{p.상세?.무력 || '-'}</td><td className="py-4 px-4 text-center font-medium text-gray-600">{p.상세?.한타 || '-'}</td><td className="py-4 px-4 text-center font-medium text-gray-600">{p.상세?.성장 || '-'}</td><td className="py-4 px-4 text-center font-medium text-gray-600">{p.상세?.안정성 || '-'}</td><td className="py-4 px-4 text-center font-medium text-gray-600">{p.상세?.운영 || '-'}</td><td className="py-4 px-4 text-center border-l"><span className={`font-bold ${getPotBadgeStyle(p.잠재력)}`}>{p.잠재력}</span></td><td className="py-4 px-6 border-l"><span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">{p.계약}년 만료</span></td></tr>))}</tbody></table></div>
              </div>
            )}
            
            {/* View: Standings */}
            {activeTab === 'standings' && (
              <div className="bg-white rounded-lg border shadow-sm p-8 min-h-[600px]">
                <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2"><span className="text-yellow-500">🏆</span> 2026 LCK 컵 순위표</h2>
                {hasDrafted ? (
                  <div className="grid grid-cols-2 gap-8">
                    <div><h3 className="text-lg font-bold text-gray-700 mb-3 border-b pb-2">바론 그룹 (Baron)</h3><table className="w-full text-sm border-collapse"><thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold"><tr><th className="py-3 px-4 text-center">#</th><th className="py-3 px-4 text-left">팀</th><th className="py-3 px-4 text-center">승</th><th className="py-3 px-4 text-center">패</th><th className="py-3 px-4 text-center">득실</th></tr></thead><tbody className="divide-y divide-gray-200">{league.groups.baron.map((id, idx) => { const t = safeTeam(id); return (<tr key={id} onClick={() => handleStandingsTeamClick(id)} className={`cursor-pointer transition-colors ${String(myTeam.id) === String(id) ? 'bg-blue-100 border-l-4 border-blue-600' : 'hover:bg-white bg-white/50'}`}><td className="py-4 px-4 text-center">{idx + 1}</td><td className="py-4 px-4 font-bold text-gray-800">{t.fullName}</td><td className="py-4 px-4 text-center font-bold">0</td><td className="py-4 px-4 text-center font-bold">0</td><td className="py-4 px-4 text-center text-gray-500 font-bold">0</td></tr>); })}</tbody></table></div>
                    <div><h3 className="text-lg font-bold text-gray-700 mb-3 border-b pb-2">장로 그룹 (Elder)</h3><table className="w-full text-sm border-collapse"><thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold"><tr><th className="py-3 px-4 text-center">#</th><th className="py-3 px-4 text-left">팀</th><th className="py-3 px-4 text-center">승</th><th className="py-3 px-4 text-center">패</th><th className="py-3 px-4 text-center">득실</th></tr></thead><tbody className="divide-y divide-gray-200">{league.groups.elder.map((id, idx) => { const t = safeTeam(id); return (<tr key={id} onClick={() => handleStandingsTeamClick(id)} className={`cursor-pointer transition-colors ${String(myTeam.id) === String(id) ? 'bg-blue-100 border-l-4 border-blue-600' : 'hover:bg-white bg-white/50'}`}><td className="py-4 px-4 text-center">{idx + 1}</td><td className="py-4 px-4 font-bold text-gray-800">{t.fullName}</td><td className="py-4 px-4 text-center font-bold">0</td><td className="py-4 px-4 text-center font-bold">0</td><td className="py-4 px-4 text-center text-gray-500 font-bold">0</td></tr>); })}</tbody></table></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto"><table className="w-full text-sm border-collapse"><thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold"><tr><th className="py-4 px-6 text-left rounded-tl-lg">순위</th><th className="py-4 px-6 text-left">팀</th><th className="py-4 px-6 text-center">승</th><th className="py-4 px-6 text-center">패</th><th className="py-4 px-6 text-center">득실차</th><th className="py-4 px-6 text-center rounded-tr-lg">승률</th></tr></thead><tbody className="divide-y divide-gray-200">{teams.map((t, idx) => { const isMyTeam = myTeam.id === t.id; return (<tr key={t.id} onClick={() => handleStandingsTeamClick(t.id)} className={`cursor-pointer transition-colors duration-150 ${isMyTeam ? 'bg-blue-100 border-l-4 border-blue-600' : 'hover:bg-gray-50'}`}><td className="py-4 px-6 font-bold text-gray-500 text-lg">{idx + 1}</td><td className="py-4 px-6"><span className="text-lg font-bold text-blue-600">{t.fullName}</span>{isMyTeam && <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-1 rounded font-bold">(선택됨)</span>}</td><td className="py-4 px-6 text-center">0</td><td className="py-4 px-6 text-center">0</td><td className="py-4 px-6 text-center">0</td><td className="py-4 px-6 text-center">0</td><td className="py-4 px-6 text-center font-bold text-gray-800">-</td></tr>); })}</tbody></table></div>
                )}
              </div>
            )}
            
            {/* View: Meta Analysis (16.01 패치 메타로 수정) */}
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

            {/* View: Schedule (BO3, BO5 표시) */}
             {(activeTab === 'schedule' || activeTab === 'team_schedule') && (
              <div className="bg-white rounded-lg border shadow-sm p-8 min-h-[600px] flex flex-col">
                <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
                  📅 {activeTab === 'team_schedule' ? `${myTeam.name} 경기 일정` : '2026 LCK 컵 전체 일정'}
                </h2>
                {hasDrafted ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto">
                    {league.matches
                      .filter(m => activeTab === 'schedule' || (String(m.t1) === String(myTeam.id) || String(m.t2) === String(myTeam.id)))
                      .map((m, i) => {
                      const t1 = safeTeam(m.t1);
                      const t2 = safeTeam(m.t2);
                      const isMyMatch = String(myTeam.id) === String(m.t1) || String(myTeam.id) === String(m.t2);
                      return (
                        <div key={i} className={`p-5 rounded-lg border-2 flex flex-col gap-3 transition-transform hover:scale-[1.02] ${isMyMatch ? 'bg-blue-50 border-blue-400 shadow-md' : 'bg-white border-gray-100'}`}>
                          <div className="flex justify-between items-center text-gray-500">
                            <span className="text-sm font-black text-gray-800">{m.date}</span>
                            <span className="text-sm font-bold text-gray-600">{m.time}</span>
                            <span className={`text-xs font-black px-2 py-1 rounded-lg ${m.format === 'BO5' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'}`}>{m.format}</span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <div className="flex flex-col items-center w-1/3"><span className={`font-black text-lg ${isMyMatch && String(myTeam.id) === String(m.t1) ? 'text-blue-600' : 'text-gray-800'}`}>{t1.name}</span></div>
                            <div className="text-gray-300 font-black italic text-xl">VS</div>
                            <div className="flex flex-col items-center w-1/3"><span className={`font-black text-lg ${isMyMatch && String(myTeam.id) === String(m.t2) ? 'text-blue-600' : 'text-gray-800'}`}>{t2.name}</span></div>
                          </div>
                          <div className="text-center text-xs font-bold text-blue-600 bg-white border border-blue-200 py-1 rounded-full w-full">LIVE 예정</div>
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
}