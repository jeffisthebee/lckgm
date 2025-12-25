import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import playerList from './data/players.json';
import championList from './data/champions.json';

// --- [데이터] 팀 정보 ---
const teams = [
  { id: 1, name: 'GEN', fullName: '젠지 (Gen.G)', power: 94, description: '안정적인 운영', colors: { primary: '#D4AF37', secondary: '#000000' } },
  { id: 2, name: 'HLE', fullName: '한화생명 (HLE)', power: 93, description: '성장 가능성', colors: { primary: '#FF6B00', secondary: '#FFFFFF' } },
  { id: 3, name: 'KT', fullName: '케이티 (KT)', power: 87, description: '공격적인 스타일', colors: { primary: '#FF4444', secondary: '#FFFFFF' } },
  { id: 4, name: 'T1', fullName: '티원 (T1)', power: 93, description: 'LCK의 최강팀', colors: { primary: '#E2012E', secondary: '#000000' } },
  { id: 5, name: 'DK', fullName: '디플러스 기아', power: 84, description: '전략적 플레이', colors: { primary: '#00D9C4', secondary: '#FFFFFF' } },
  { id: 6, name: 'BNK', fullName: 'BNK 피어엑스', power: 82, description: '젊은 패기', colors: { primary: '#FFB800', secondary: '#000000' } },
  { id: 7, name: 'NS', fullName: '농심 레드포스', power: 85, description: '매운맛', colors: { primary: '#DC143C', secondary: '#FFFFFF' } },
  { id: 8, name: 'BRO', fullName: '브리온', power: 79, description: '끈끈한 팀워크', colors: { primary: '#166534', secondary: '#FFFFFF' } },
  { id: 9, name: 'DRX', fullName: '디알엑스', power: 80, description: '도전적인 팀', colors: { primary: '#3848A2', secondary: '#000000' } },
  { id: 10, name: 'DNS', fullName: 'DN 수퍼스', power: 82, description: '신생 팀', colors: { primary: '#1E3A8A', secondary: '#FFFFFF' } },
];

const difficulties = [
  { value: 'easy', label: '쉬움', color: 'green' },
  { value: 'normal', label: '보통', color: 'blue' },
  { value: 'hard', label: '어려움', color: 'orange' },
  { value: 'insane', label: '극악', color: 'red' },
];

// --- [유틸리티] 안전한 로컬 스토리지 관리 ---
const getLeagues = () => {
  try {
    const s = localStorage.getItem('lckgm_leagues');
    return s ? JSON.parse(s) : [];
  } catch (e) {
    console.error("데이터 로드 실패:", e);
    return [];
  }
};

const saveLeagues = (l) => {
  try {
    localStorage.setItem('lckgm_leagues', JSON.stringify(l));
  } catch (e) {
    alert("저장 공간이 부족합니다.");
  }
};

const addLeague = (newLeague) => {
  const list = getLeagues();
  list.push(newLeague);
  saveLeagues(list);
};

const updateLeague = (id, updates) => {
  const leagues = getLeagues();
  const index = leagues.findIndex(l => String(l.id) === String(id));
  if (index !== -1) {
    leagues[index] = { ...leagues[index], ...updates };
    saveLeagues(leagues);
    return leagues[index];
  }
  return null;
};

const deleteLeague = (id) => {
  const l = getLeagues().filter(x => String(x.id) !== String(id));
  saveLeagues(l);
  return l;
};

const getLeagueById = (id) => getLeagues().find(l => String(l.id) === String(id));

// --- [스타일] 배지 스타일 ---
const getOvrBadgeStyle = (ovr) => {
  if (ovr >= 95) return 'bg-red-100 text-red-700 border-red-300';
  if (ovr >= 90) return 'bg-orange-100 text-orange-700 border-orange-300';
  if (ovr >= 85) return 'bg-purple-100 text-purple-700 border-purple-300';
  return 'bg-green-100 text-green-700 border-green-300';
};
const getPotBadgeStyle = (pot) => (pot >= 95 ? 'text-purple-600 font-black' : 'text-gray-500 font-medium');

// --- [핵심] 절대 멈추지 않는 스케줄러 (Round Robin) ---
const generateSchedule = (baronIds, elderIds) => {
  const week1Days = ['1.14 (수)', '1.15 (목)', '1.16 (금)', '1.17 (토)', '1.18 (일)'];
  const week2Days = ['1.21 (수)', '1.22 (목)', '1.23 (금)', '1.24 (토)', '1.25 (일)'];
  const allDays = [...week1Days, ...week2Days];
  
  let matches = [];
  
  // 바론팀 vs 엘더팀 교차 매칭 (총 20경기 생성)
  // i번째 바론팀은 i, i+1, i+2, i+3 번째 엘더팀과 경기 (i+4번째는 스킵)
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 4; j++) {
      const baronTeam = baronIds[i];
      const elderTeam = elderIds[(i + j) % 5];
      matches.push({ t1: baronTeam, t2: elderTeam, type: 'regular', status: 'pending', format: 'BO3' });
    }
  }

  // 경기 섞기
  matches.sort(() => Math.random() - 0.5);

  // 날짜 배정 (하루 2경기 고정)
  const finalSchedule = [];
  let dayIdx = 0;
  
  for (let i = 0; i < matches.length; i += 2) {
    if (dayIdx >= 10) break;
    if (matches[i]) finalSchedule.push({ ...matches[i], date: allDays[dayIdx], time: '17:00' });
    if (matches[i+1]) finalSchedule.push({ ...matches[i+1], date: allDays[dayIdx], time: '19:30' });
    dayIdx++;
  }

  // 3주차 TBD
  const week3Days = ['1.28 (수)', '1.29 (목)', '1.30 (금)', '1.31 (토)', '2.1 (일)'];
  week3Days.forEach(day => {
    finalSchedule.push({ t1: null, t2: null, date: day, time: '17:00', type: 'tbd', format: 'BO5' });
  });

  return finalSchedule;
};


// --- [페이지] 리그 관리자 (홈) ---
function LeagueManager() {
  const [leagues, setLeagues] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    setLeagues(getLeagues());
  }, []);

  const handleClearData = () => {
    if (window.confirm("정말 모든 데이터를 삭제하고 초기화하시겠습니까? (오류 해결용)")) {
      localStorage.removeItem('lckgm_leagues');
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-black text-gray-800">LCK 매니저 2026</h1>
          <button onClick={handleClearData} className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-200">
            ⚠️ 데이터 초기화 (접속 안될 때 클릭)
          </button>
        </div>

        <div className="grid gap-4">
          {leagues.length === 0 ? (
            <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-xl">생성된 리그가 없습니다.</div>
          ) : leagues.map(l => {
            const t = teams.find(team => String(team.id) === String(l.team.id));
            if (!t) return null;
            return (
              <div key={l.id} className="bg-white p-6 rounded-xl shadow-sm border flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-md" style={{ backgroundColor: t.colors.primary }}>{t.name}</div>
                  <div>
                    <h2 className="text-xl font-bold">{t.fullName}</h2>
                    <p className="text-sm text-gray-500">{l.leagueName}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { updateLeague(l.id, { lastPlayed: new Date().toISOString() }); navigate(`/league/${l.id}`); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700">접속</button>
                  <button onClick={() => { deleteLeague(l.id); setLeagues(getLeagues()); }} className="bg-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-300">삭제</button>
                </div>
              </div>
            );
          })}
        </div>
        
        <button onClick={() => navigate('/new-league')} className="w-full mt-6 bg-white border-2 border-dashed border-gray-300 py-6 rounded-xl text-gray-400 hover:text-blue-600 hover:border-blue-500 font-bold text-xl transition flex items-center justify-center gap-2">
          + 새로운 시즌 시작하기
        </button>
      </div>
    </div>
  );
}

// --- [페이지] 팀 선택 ---
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
      groups: { baron: [], elder: [] }, // 초기값 필수
      matches: []
    };
    
    addLeague(newLeague);
    // 데이터 저장 시간 확보 후 이동
    setTimeout(() => navigate(`/league/${newId}`), 100);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50" style={{ backgroundColor: `${current.colors.primary}10` }}>
      <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-2xl w-full text-center border-t-8" style={{ borderColor: current.colors.primary }}>
        <h2 className="text-3xl font-black mb-8">팀 선택</h2>
        
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => setIdx(i => i === 0 ? teams.length - 1 : i - 1)} className="p-3 bg-gray-100 rounded-full">◀</button>
          <div className="flex flex-col items-center">
            <div className="w-40 h-40 rounded-full flex items-center justify-center text-5xl font-black text-white shadow-xl mb-4" style={{ backgroundColor: current.colors.primary }}>{current.name}</div>
            <h3 className="text-3xl font-bold">{current.fullName}</h3>
            <span className="mt-2 bg-gray-100 px-3 py-1 rounded text-sm font-bold text-blue-600">전력: {current.power}</span>
          </div>
          <button onClick={() => setIdx(i => i === teams.length - 1 ? 0 : i + 1)} className="p-3 bg-gray-100 rounded-full">▶</button>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-6">
          {difficulties.map(d => (
            <button key={d.value} onClick={() => setDiff(d.value)} className={`py-2 rounded-lg font-bold border-2 ${diff === d.value ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-400'}`}>{d.label}</button>
          ))}
        </div>

        <div className="bg-gray-50 p-4 rounded-lg mb-8 text-sm text-gray-600">
            난이도가 높을수록 승률과 재계약 확률이 낮아집니다. <br/>
            {diff === 'insane' && <span className="text-red-600 font-bold">⚠️ 극악 난이도는 정말 어렵습니다!</span>}
        </div>

        <button onClick={handleStart} className="w-full py-4 rounded-xl font-bold text-xl text-white shadow-lg hover:opacity-90 transition" style={{ backgroundColor: current.colors.primary }}>
          시작하기
        </button>
      </div>
    </div>
  );
}

// --- [페이지] 대시보드 ---
function Dashboard() {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const [league, setLeague] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [viewingTeamId, setViewingTeamId] = useState(null);

  // 드래프트 관련 상태
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftPool, setDraftPool] = useState([]);
  const [draftGroups, setDraftGroups] = useState({ baron: [], elder: [] });
  const [draftTurn, setDraftTurn] = useState('user');
  const draftTimeoutRef = useRef(null);
  const [metaRole, setMetaRole] = useState('TOP');

  // 데이터 로드
  useEffect(() => {
    const found = getLeagueById(leagueId);
    if (!found) {
      alert("데이터를 찾을 수 없습니다. 메인으로 이동합니다.");
      navigate('/');
      return;
    }
    setLeague(found);
    if (!viewingTeamId) setViewingTeamId(found.team.id);
  }, [leagueId, navigate]);

  if (!league) return <div className="flex h-screen items-center justify-center">데이터 로딩 중...</div>;

  // 안전한 데이터 접근 (String 변환 필수)
  const myTeam = teams.find(t => String(t.id) === String(league.team.id)) || league.team;
  const viewingTeam = teams.find(t => String(t.id) === String(viewingTeamId)) || myTeam;
  const currentRoster = (playerList || []).filter(p => p.팀 === viewingTeam.name);
  
  const isCaptain = String(myTeam.id) === "1" || String(myTeam.id) === "2";
  const hasDrafted = league.groups && league.groups.baron && league.groups.baron.length > 0;
  const nextMatch = league.matches && league.matches.length > 0 
    ? league.matches.find(m => m.type !== 'tbd' && (String(m.t1) === String(myTeam.id) || String(m.t2) === String(myTeam.id))) 
    : null;

  // --- 드래프트 로직 ---
  const startDraft = () => {
    if (hasDrafted) return;
    setIsDrafting(true);
    // GEN(1), HLE(2) 제외
    const pool = teams.filter(t => String(t.id) !== "1" && String(t.id) !== "2");
    setDraftPool(pool);
    setDraftGroups({ baron: [1], elder: [2] });

    if (isCaptain) {
      if (String(myTeam.id) === "1") setDraftTurn('user');
      else { setDraftTurn('cpu'); cpuPick(pool, { baron: [1], elder: [2] }); }
    } else {
      autoDraft(pool);
    }
  };

  const cpuPick = (pool, groups) => {
    draftTimeoutRef.current = setTimeout(() => {
      if (pool.length === 0) { finishDraft(groups); return; }
      const sorted = [...pool].sort((a, b) => b.power - a.power);
      const picked = sorted[0]; // 가장 센 팀 픽
      const newPool = pool.filter(t => t.id !== picked.id);
      
      const newGroups = { ...groups };
      if (String(myTeam.id) === "1") newGroups.elder.push(picked.id);
      else newGroups.baron.push(picked.id);

      setDraftPool(newPool);
      setDraftGroups(newGroups);
      setDraftTurn('user');

      if (newPool.length === 0) finishDraft(newGroups);
    }, 500);
  };

  const userPick = (teamId) => {
    if (draftTurn !== 'user') return;
    const picked = teams.find(t => t.id === teamId);
    const newPool = draftPool.filter(t => t.id !== teamId);
    
    const newGroups = { ...draftGroups };
    if (String(myTeam.id) === "1") newGroups.baron.push(picked.id);
    else newGroups.elder.push(picked.id);

    setDraftPool(newPool);
    setDraftGroups(newGroups);
    setDraftTurn('cpu');

    if (newPool.length === 0) finishDraft(newGroups);
    else cpuPick(newPool, newGroups);
  };

  const autoDraft = (pool) => {
    let currentPool = [...pool];
    let baron = [1];
    let elder = [2];
    let turn = 0; 
    
    while(currentPool.length > 0) {
      const sorted = currentPool.sort((a, b) => b.power - a.power);
      const picked = sorted[0];
      currentPool = currentPool.filter(t => t.id !== picked.id);
      
      if (turn === 0) baron.push(picked.id);
      else elder.push(picked.id);
      turn = 1 - turn;
    }
    finishDraft({ baron, elder });
  };

  const finishDraft = (groups) => {
    const matches = generateSchedule(groups.baron, groups.elder);
    const updated = updateLeague(league.id, { groups, matches });
    
    // 강제 상태 업데이트
    setLeague({ ...updated });
    setIsDrafting(false);
    setActiveTab('standings');
    alert("조 추첨이 완료되었습니다!");
  };

  // --- UI 헬퍼 ---
  const safeTeam = (id) => teams.find(t => String(t.id) === String(id)) || { name: '?', fullName: 'Unknown' };

  return (
    <div className="flex h-screen bg-gray-100 font-sans relative overflow-hidden">
      
      {/* 드래프트 모달 */}
      {isDrafting && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full text-center shadow-2xl">
            <h2 className="text-3xl font-black mb-4">{isCaptain ? "팀 드래프트" : "자동 조 추첨 중..."}</h2>
            {!isCaptain ? (
               <div className="text-gray-500 animate-pulse">상위 시드 팀들이 팀을 고르고 있습니다...</div>
            ) : (
               <div className="grid grid-cols-4 gap-4 max-h-[400px] overflow-y-auto">
                 {draftPool.map(t => (
                   <button key={t.id} onClick={() => userPick(t.id)} disabled={draftTurn !== 'user'} className="p-4 border-2 rounded-xl hover:border-blue-500 disabled:opacity-50">
                     <div className="font-bold">{t.name}</div>
                     <div className="text-sm text-gray-500">전력 {t.power}</div>
                   </button>
                 ))}
               </div>
            )}
          </div>
        </div>
      )}

      {/* 사이드바 */}
      <aside className="w-64 bg-gray-900 text-white flex-shrink-0 flex flex-col">
        <div className="p-5 border-b border-gray-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-gray-900 shadow-lg" style={{backgroundColor: myTeam.colors.primary}}>{myTeam.name}</div>
          <div><div className="font-bold">{myTeam.fullName}</div><div className="text-xs text-gray-400">GM Mode</div></div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
           {[{id:'dashboard', name:'대시보드', icon:'📊'}, {id:'roster', name:'로스터', icon:'👥'}, {id:'standings', name:'순위표', icon:'🏆'}, {id:'schedule', name:'일정', icon:'📅'}, {id:'meta', name:'16.01 패치 메타', icon:'📈'}].map(item => (
             <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-3 ${activeTab === item.id ? 'bg-blue-600' : 'hover:bg-gray-800'}`}>
               <span>{item.icon}</span> {item.name}
             </button>
           ))}
        </nav>
        <div className="p-4 border-t border-gray-800"><button onClick={() => navigate('/')} className="w-full py-2 text-xs text-gray-400 hover:text-white">메인으로 나가기</button></div>
      </aside>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-6 flex-shrink-0">
           <div className="flex items-center gap-6 font-bold text-gray-600">
             <span>📅 {hasDrafted ? '2026년 1월 8일' : '2026년 1월 1일'}</span>
             <span className="h-4 w-px bg-gray-300"></span>
             <span>💰 상금: 0.0억</span>
           </div>
           <button onClick={startDraft} disabled={hasDrafted} className={`px-5 py-2 rounded-full font-bold text-sm text-white shadow-md ${hasDrafted ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 animate-pulse'}`}>
             {hasDrafted ? "시즌 진행 중" : (isCaptain ? "▶ 팀 드래프트 시작" : "▶ 조 추첨 확인")}
           </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
           <div className="max-w-7xl mx-auto">
             
             {/* [대시보드] */}
             {activeTab === 'dashboard' && (
               <div className="grid grid-cols-12 gap-6">
                 {/* 다음 경기 */}
                 <div className="col-span-8 bg-white p-6 rounded-xl border shadow-sm">
                   <h3 className="font-bold text-gray-800 mb-4 text-lg">다음 경기</h3>
                   {nextMatch ? (
                     <div className="flex items-center justify-between bg-gray-50 p-6 rounded-xl border">
                        <div className="text-center w-1/3"><div className="text-4xl font-black mb-2">{safeTeam(nextMatch.t1).name}</div></div>
                        <div className="text-center w-1/3">
                          <div className="text-blue-600 font-black text-lg">{nextMatch.date}</div>
                          <div className="text-gray-500 font-bold">{nextMatch.time}</div>
                          <div className="mt-2 inline-block bg-blue-600 text-white text-xs px-2 py-1 rounded">{nextMatch.format}</div>
                        </div>
                        <div className="text-center w-1/3"><div className="text-4xl font-black mb-2">{safeTeam(nextMatch.t2).name}</div></div>
                     </div>
                   ) : <div className="text-center py-10 text-gray-400">일정이 없습니다.</div>}
                 </div>
                 
                 {/* 미니 순위표 (분할) */}
                 <div className="col-span-4 bg-white p-4 rounded-xl border shadow-sm h-full overflow-y-auto">
                   {hasDrafted ? (
                     <div className="space-y-4">
                       <div>
                         <div className="text-xs font-bold text-gray-500 mb-2">바론 그룹</div>
                         <table className="w-full text-xs"><tbody>{league.groups.baron.map((id, i) => <tr key={id} className="border-b"><td className="p-1">{i+1}</td><td className="p-1 font-bold">{safeTeam(id).name}</td><td className="p-1 text-right">0-0</td></tr>)}</tbody></table>
                       </div>
                       <div>
                         <div className="text-xs font-bold text-gray-500 mb-2">장로 그룹</div>
                         <table className="w-full text-xs"><tbody>{league.groups.elder.map((id, i) => <tr key={id} className="border-b"><td className="p-1">{i+1}</td><td className="p-1 font-bold">{safeTeam(id).name}</td><td className="p-1 text-right">0-0</td></tr>)}</tbody></table>
                       </div>
                     </div>
                   ) : <div className="text-center text-gray-400 py-10">조 추첨 대기 중</div>}
                 </div>

                 {/* 로스터 */}
                 <div className="col-span-12 bg-white p-6 rounded-xl border shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4">로스터 현황 ({viewingTeam.name})</h3>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500 border-b">
                        <tr><th className="p-3 text-left">포지션</th><th className="p-3 text-left">이름</th><th className="p-3 text-center">나이</th><th className="p-3 text-center">경력</th><th className="p-3 text-center">OVR</th><th className="p-3 text-center">계약</th></tr>
                      </thead>
                      <tbody>
                        {currentRoster.map((p, i) => (
                          <tr key={i} className="border-b hover:bg-gray-50">
                            <td className="p-3 text-gray-500 font-bold">{p.포지션}</td>
                            <td className="p-3 font-bold">{p.이름} <span className="text-xs text-gray-400 font-normal">({p.실명})</span></td>
                            <td className="p-3 text-center text-gray-500">{p.나이}</td>
                            <td className="p-3 text-center text-gray-500">{p.경력}</td>
                            <td className="p-3 text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td>
                            <td className="p-3 text-center text-gray-500 font-bold">{p.계약}년</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
               </div>
             )}

             {/* [순위표] */}
             {activeTab === 'standings' && hasDrafted && (
               <div className="grid grid-cols-2 gap-8">
                 <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <h3 className="text-xl font-bold text-blue-800 mb-4 pb-2 border-b border-blue-100">바론 그룹</h3>
                    <table className="w-full text-sm text-center">
                      <thead className="bg-blue-50 text-blue-800"><tr><th className="p-3">순위</th><th className="p-3 text-left">팀</th><th className="p-3">승</th><th className="p-3">패</th><th className="p-3">득실</th></tr></thead>
                      <tbody>{league.groups.baron.map((id, i) => <tr key={id} className="border-b"><td className="p-3 font-bold">{i+1}</td><td className="p-3 text-left font-bold text-gray-700">{safeTeam(id).fullName}</td><td className="p-3">0</td><td className="p-3">0</td><td className="p-3 text-gray-400">0</td></tr>)}</tbody>
                    </table>
                 </div>
                 <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <h3 className="text-xl font-bold text-orange-800 mb-4 pb-2 border-b border-orange-100">장로 그룹</h3>
                    <table className="w-full text-sm text-center">
                      <thead className="bg-orange-50 text-orange-800"><tr><th className="p-3">순위</th><th className="p-3 text-left">팀</th><th className="p-3">승</th><th className="p-3">패</th><th className="p-3">득실</th></tr></thead>
                      <tbody>{league.groups.elder.map((id, i) => <tr key={id} className="border-b"><td className="p-3 font-bold">{i+1}</td><td className="p-3 text-left font-bold text-gray-700">{safeTeam(id).fullName}</td><td className="p-3">0</td><td className="p-3">0</td><td className="p-3 text-gray-400">0</td></tr>)}</tbody>
                    </table>
                 </div>
               </div>
             )}

             {/* [일정] */}
             {(activeTab === 'schedule' || activeTab === 'team_schedule') && hasDrafted && (
               <div className="grid grid-cols-3 gap-4">
                 {league.matches.map((m, i) => (
                   <div key={i} className="bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition">
                     <div className="flex justify-between text-xs font-bold text-gray-400 mb-2">
                       <span>{m.date} {m.time}</span>
                       <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{m.format}</span>
                     </div>
                     <div className="flex justify-between items-center">
                       <div className="w-1/3 text-center font-black text-lg">{safeTeam(m.t1).name}</div>
                       <div className="text-gray-300 font-bold">VS</div>
                       <div className="w-1/3 text-center font-black text-lg">{safeTeam(m.t2).name}</div>
                     </div>
                   </div>
                 ))}
               </div>
             )}

             {/* [메타] */}
             {activeTab === 'meta' && (
                <div className="bg-white p-8 rounded-xl border shadow-sm">
                    <div className="flex justify-between mb-6">
                        <h2 className="text-2xl font-black">16.01 패치 메타</h2>
                        <div className="flex gap-2">
                           {['TOP','JGL','MID','ADC','SUP'].map(r => <button key={r} onClick={()=>setMetaRole(r)} className={`px-4 py-2 rounded font-bold text-sm ${metaRole===r ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>{r}</button>)}
                        </div>
                    </div>
                    <div className="space-y-3">
                        {championList.filter(c=>c.role===metaRole).map((c, i) => (
                            <div key={i} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                                <div className="flex items-center gap-4">
                                    <span className="text-2xl font-black w-8 text-center text-gray-300">{i+1}</span>
                                    <div><div className="font-bold text-lg">{c.name}</div><span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">{c.tier} 티어</span></div>
                                </div>
                                <div className="text-right text-sm text-gray-500">
                                    <div className="text-xs font-bold mb-1">Counter Picks</div>
                                    <div>{c.counters.join(', ')}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
             )}

           </div>
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