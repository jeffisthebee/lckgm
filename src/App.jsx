import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import playerList from './data/players.json';

// --- 데이터 ---
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
const getLeagues = () => { const s = localStorage.getItem('lckgm_leagues'); return s ? JSON.parse(s) : []; };
const saveLeagues = (l) => localStorage.setItem('lckgm_leagues', JSON.stringify(l));
const addLeague = (l) => { const list = getLeagues(); list.push(l); saveLeagues(list); return list; };
const updateLeague = (id, u) => { 
  const leagues = getLeagues(); 
  const index = leagues.findIndex(l => l.id === id); 
  if (index !== -1) { 
    leagues[index] = { ...leagues[index], ...u }; 
    saveLeagues(leagues); 
    return leagues[index]; // 업데이트된 리그 반환
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

// --- 컴포넌트 ---

function LeagueManager() {
  const [leagues, setLeagues] = useState(getLeagues());
  const navigate = useNavigate();
  useEffect(() => setLeagues(getLeagues()), []);
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-black mb-8 text-gray-800 tracking-tight">LCK 매니저 2026</h1>
        <div className="grid gap-4">
          {leagues.map(l => {
            const t = teams.find(x => x.id === l.team.id);
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
        <button onClick={()=>{addLeague({id:Date.now().toString(),leagueName:`2026 LCK 컵 - ${current.name}`,team:current,difficulty:diff,createdAt:new Date().toISOString(),lastPlayed:new Date().toISOString()});navigate(`/league/${Date.now().toString()}`)}} className="w-full py-5 rounded-2xl font-black text-xl text-white shadow-lg hover:shadow-xl hover:opacity-90 transition transform hover:-translate-y-1" style={{backgroundColor:current.colors.primary,color:getTextColor(current.colors.primary)}}>2026 시즌 시작하기</button>
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
  const [isDrafting, setIsDrafting] = useState(false); // 드래프트 모달 상태

  useEffect(() => {
    const found = getLeagueById(leagueId);
    if (found) {
      setLeague(found);
      updateLeague(leagueId, { lastPlayed: new Date().toISOString() });
      setViewingTeamId(found.team.id);
    }
  }, [leagueId]);

  if (!league) return <div className="flex h-screen items-center justify-center font-bold text-gray-500">데이터 로딩 중...</div>;

  const myTeam = teams.find(t => t.id === league.team.id);
  const viewingTeam = teams.find(t => t.id === viewingTeamId) || myTeam;
  const currentRoster = playerList.filter(p => p.팀 === viewingTeam.name);
  const isCaptain = myTeam.id === 1 || myTeam.id === 2; // GEN(1) or HLE(2)
  const hasDrafted = league.groups !== undefined;

  // --- 드래프트 로직 ---
  const handleDraftStart = () => {
    if (!hasDrafted) setIsDrafting(true);
  };

  const handleAutoDraft = () => {
    // 1. GEN(1)과 HLE(2)를 각 그룹의 수장으로 고정
    const leaders = { baron: 1, elder: 2 }; // GEN=Baron, HLE=Elder (기본)
    const pool = teams.filter(t => t.id !== 1 && t.id !== 2);
    
    // 2. 나머지 8팀 셔플
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    
    // 3. 4팀씩 배분
    const baronGroup = [leaders.baron, ...shuffled.slice(0, 4).map(t => t.id)];
    const elderGroup = [leaders.elder, ...shuffled.slice(4, 8).map(t => t.id)];

    // 4. 저장 및 종료
    const updated = updateLeague(league.id, { groups: { baron: baronGroup, elder: elderGroup } });
    setLeague(updated);
    setIsDrafting(false);
    setActiveTab('standings'); // 순위표로 이동
    alert(isCaptain ? "팀 선정이 완료되었습니다!" : "조 추첨이 완료되었습니다!");
  };

  // --- 순위표 렌더링 헬퍼 ---
  const renderRankTable = (groupIds, title) => {
    const groupTeams = groupIds.map(id => teams.find(t => t.id === id));
    return (
      <div className="bg-white rounded-lg border shadow-sm p-0 flex flex-col h-full mb-6">
        <div className="p-3 border-b bg-gray-50 font-bold text-sm text-gray-700 flex justify-between">
          <span>{title}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-0">
          <table className="w-full text-xs">
            <thead className="bg-gray-100 text-gray-500">
              <tr><th className="p-2 text-center w-8">#</th><th className="p-2 text-left">팀</th><th className="p-2 text-center">승</th><th className="p-2 text-center">패</th></tr>
            </thead>
            <tbody>
              {groupTeams.map((t, i) => {
                const isMyTeam = myTeam.id === t.id;
                const isViewing = viewingTeamId === t.id;
                return (
                  <tr key={t.id} onClick={() => setViewingTeamId(t.id)} 
                      className={`cursor-pointer border-b last:border-0 transition-colors duration-150 
                        ${isMyTeam ? 'bg-blue-100 border-l-4 border-blue-600' : (isViewing ? 'bg-gray-100' : 'hover:bg-gray-50')}
                      `}>
                    <td className="p-2 font-bold text-gray-500 text-center">{i + 1}</td>
                    <td className="p-2 font-bold">
                      <span className="text-blue-600 hover:underline">{t.fullName}</span>
                      {isMyTeam && <span className="ml-2 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">ME</span>}
                    </td>
                    <td className="p-2 text-center">0</td>
                    <td className="p-2 text-center">0</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const menuItems = [
    { id: 'dashboard', name: '대시보드', icon: '📊' },
    { id: 'roster', name: '로스터', icon: '👥' },
    { id: 'standings', name: '순위표', icon: '🏆' },
    { id: 'schedule', name: '일정', icon: '📅' },
  ];

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans relative">
      
      {/* --- 드래프트 모달 (간소화된 버전) --- */}
      {isDrafting && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full text-center shadow-2xl animate-fade-in-up">
            <h2 className="text-3xl font-black mb-4">{isCaptain ? "팀 선정 진행" : "조 추첨 진행"}</h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              {isCaptain 
                ? "귀하는 시드권자입니다. 2026 LCK 컵의 조 편성을 진행합니다." 
                : "2026 LCK 컵 조 추첨이 진행 중입니다. 잠시만 기다려주세요."}
            </p>
            
            {/* 시각적 효과를 위한 애니메이션 아이콘 (생략 가능) */}
            <div className="flex justify-center gap-4 mb-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-2xl animate-bounce">🎲</div>
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-2xl animate-bounce delay-100">⚖️</div>
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-2xl animate-bounce delay-200">⚔️</div>
            </div>

            <button onClick={handleAutoDraft} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-lg">
              {isCaptain ? "자동 추첨으로 진행하기" : "추첨 결과 확인"}
            </button>
            <p className="text-xs text-gray-400 mt-4">* 현재 버전에서는 빠른 진행을 위해 자동 추첨만 지원합니다.</p>
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
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === item.id ? 'bg-blue-600 text-white shadow-md translate-x-1' : 'hover:bg-gray-800 hover:text-white hover:translate-x-1'}`}>
              <span>{item.icon}</span> {item.name}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-gray-700 bg-gray-800"><button onClick={() => navigate('/')} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition"><span>🚪</span> 메인으로 나가기</button></div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b h-14 flex items-center justify-between px-6 shadow-sm z-10 flex-shrink-0">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">📅</span> 2026 LCK 컵 대회</div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">🏆</span> 0승 0패</div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2 font-bold text-green-600"><span className="text-gray-400">💰</span> 100억 원</div>
          </div>
          {/* 상단 버튼 분기 */}
          <button onClick={handleDraftStart} disabled={hasDrafted}
            className={`px-6 py-1.5 rounded-full font-bold text-sm shadow-sm transition flex items-center gap-2 
              ${hasDrafted ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white animate-pulse'}
            `}>
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
                      <div className="text-center w-1/3"><div className="text-xs font-bold text-gray-400 uppercase">VS</div><div className="text-3xl font-bold text-gray-300 my-2">@</div><div className="text-xs font-bold text-blue-600">LCK 컵 1R</div></div>
                      <div className="text-center w-1/3"><div className="text-4xl font-black text-gray-300 mb-2">미정</div><div className="text-sm font-bold text-gray-400">상대팀</div></div>
                   </div>
                </div>

                <div className="col-span-12 lg:col-span-4 flex flex-col h-full max-h-[300px]">
                   {/* 순위표 (분기 처리) */}
                   {hasDrafted ? (
                     <div className="bg-white rounded-lg border shadow-sm p-3 h-full overflow-y-auto">
                        <div className="text-xs font-bold text-gray-500 mb-2">바론 그룹</div>
                        {renderRankTable(league.groups.baron, "")}
                        <div className="text-xs font-bold text-gray-500 mb-2 mt-4">장로 그룹</div>
                        {renderRankTable(league.groups.elder, "")}
                     </div>
                   ) : (
                     <div className="bg-white rounded-lg border shadow-sm p-0 flex-1 flex flex-col">
                       <div className="p-3 border-b bg-gray-50 font-bold text-sm text-gray-700 flex justify-between"><span>순위표</span><span onClick={()=>setActiveTab('standings')} className="text-xs text-blue-600 cursor-pointer hover:underline">전체 보기</span></div>
                       <div className="flex-1 overflow-y-auto p-0">
                          {/* 드래프트 전에는 전체 목록 보여줌 */}
                          <table className="w-full text-xs">
                            <tbody>
                              {teams.map((t, i) => {
                                const isMyTeam = myTeam.id === t.id;
                                return (
                                  <tr key={t.id} onClick={() => setViewingTeamId(t.id)} 
                                      className={`cursor-pointer border-b last:border-0 transition-colors duration-150 ${isMyTeam ? 'bg-blue-100 border-l-4 border-blue-600' : 'hover:bg-gray-50'}`}>
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
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-sm" style={{backgroundColor: viewingTeam.colors.primary}}>{viewingTeam.name}</div>
                      <div><h2 className="text-2xl font-black text-gray-800">{viewingTeam.fullName}</h2><p className="text-xs font-bold text-gray-500 uppercase tracking-wide">로스터 요약</p></div>
                    </div>
                    <button onClick={()=>setActiveTab('roster')} className="text-sm font-bold text-blue-600 hover:underline">상세 정보 보기 →</button>
                  </div>
                  <div className="p-0 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-white text-gray-400 text-xs uppercase font-bold border-b">
                        <tr><th className="py-3 px-6 text-left">포지션</th><th className="py-3 px-6 text-left">이름</th><th className="py-3 px-6 text-center">종합</th><th className="py-3 px-6 text-center">잠재력</th><th className="py-3 px-6 text-left">계약</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {currentRoster.length > 0 ? currentRoster.map((p, i) => (
                          <tr key={i} className="hover:bg-gray-50 transition">
                            <td className="py-3 px-6 font-bold text-gray-400 w-16">{p.포지션}</td>
                            <td className="py-3 px-6 font-bold text-gray-800">{p.이름} <span className="text-gray-400 font-normal text-xs ml-1">({p.실명})</span></td>
                            <td className="py-3 px-6 text-center"><span className={`inline-flex items-center justify-center w-8 h-6 rounded font-bold text-xs ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td>
                            <td className="py-3 px-6 text-center"><span className={`text-xs ${getPotBadgeStyle(p.잠재력)}`}>{p.잠재력}</span></td>
                            <td className="py-3 px-6 text-gray-500 text-xs">{p.계약}년</td>
                          </tr>
                        )) : <tr><td colSpan="5" className="py-10 text-center text-gray-300">데이터 없음</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'roster' && (
              <div className="bg-white rounded-lg border shadow-sm flex flex-col">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                  <div className="flex items-center gap-4">
                    <button onClick={() => {
                        const currentIdx = teams.findIndex(t => t.id === viewingTeam.id);
                        setViewingTeamId(teams[(currentIdx - 1 + teams.length) % teams.length].id);
                    }} className="p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition">◀</button>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-white shadow-lg text-xl" style={{backgroundColor: viewingTeam.colors.primary}}>{viewingTeam.name}</div>
                      <div><h2 className="text-3xl font-black text-gray-900">{viewingTeam.fullName}</h2><p className="text-sm font-bold text-gray-500 mt-1">상세 로스터 및 계약 현황</p></div>
                    </div>
                    <button onClick={() => {
                        const currentIdx = teams.findIndex(t => t.id === viewingTeam.id);
                        setViewingTeamId(teams[(currentIdx + 1) % teams.length].id);
                    }} className="p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition">▶</button>
                  </div>
                  <div className="text-right"><div className="text-2xl font-black text-blue-600">{viewingTeam.power} <span className="text-sm text-gray-400 font-normal">TEAM OVR</span></div></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-white text-gray-500 text-xs uppercase font-bold border-b">
                      <tr>
                        <th className="py-4 px-6 bg-gray-50 sticky left-0 z-10">정보</th>
                        <th className="py-4 px-4 text-center bg-gray-50">종합</th>
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
                              <div><div className="font-bold text-gray-900 text-base">{p.이름} <span className="text-gray-400 font-normal text-xs ml-1">({p.실명})</span></div><div className="text-xs text-gray-400">{p.특성}</div></div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center"><span className={`inline-flex items-center justify-center w-10 h-8 rounded-lg font-black text-sm shadow-sm border ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td>
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

            {/* 순위표 (큰 화면) */}
            {activeTab === 'standings' && (
              <div className="bg-white rounded-lg border shadow-sm p-8 min-h-[600px]">
                <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2"><span className="text-yellow-500">🏆</span> 2026 LCK 컵 순위표</h2>
                
                {hasDrafted ? (
                  <div className="grid grid-cols-2 gap-8">
                    {/* 바론 그룹 */}
                    <div>
                      <h3 className="text-lg font-bold text-gray-700 mb-3 border-b pb-2">바론 그룹 (Baron)</h3>
                      <table className="w-full text-sm border-collapse">
                        <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                          <tr><th className="py-3 px-4 text-center">#</th><th className="py-3 px-4 text-left">팀</th><th className="py-3 px-4 text-center">승</th><th className="py-3 px-4 text-center">패</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {league.groups.baron.map(id => teams.find(t => t.id === id)).map((t, idx) => {
                            const isMyTeam = myTeam.id === t.id;
                            return (
                              <tr key={t.id} onClick={() => setViewingTeamId(t.id)} className={`cursor-pointer ${isMyTeam ? 'bg-blue-100 border-l-4 border-blue-600' : 'hover:bg-gray-50'}`}>
                                <td className="py-3 px-4 font-bold text-center">{idx + 1}</td>
                                <td className="py-3 px-4 font-bold text-blue-600">{t.fullName} {isMyTeam && <span className="ml-1 text-[10px] bg-blue-600 text-white px-1 rounded">ME</span>}</td>
                                <td className="py-3 px-4 text-center">0</td>
                                <td className="py-3 px-4 text-center">0</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* 장로 그룹 */}
                    <div>
                      <h3 className="text-lg font-bold text-gray-700 mb-3 border-b pb-2">장로 그룹 (Elder)</h3>
                      <table className="w-full text-sm border-collapse">
                        <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                          <tr><th className="py-3 px-4 text-center">#</th><th className="py-3 px-4 text-left">팀</th><th className="py-3 px-4 text-center">승</th><th className="py-3 px-4 text-center">패</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {league.groups.elder.map(id => teams.find(t => t.id === id)).map((t, idx) => {
                            const isMyTeam = myTeam.id === t.id;
                            return (
                              <tr key={t.id} onClick={() => setViewingTeamId(t.id)} className={`cursor-pointer ${isMyTeam ? 'bg-blue-100 border-l-4 border-blue-600' : 'hover:bg-gray-50'}`}>
                                <td className="py-3 px-4 font-bold text-center">{idx + 1}</td>
                                <td className="py-3 px-4 font-bold text-blue-600">{t.fullName} {isMyTeam && <span className="ml-1 text-[10px] bg-blue-600 text-white px-1 rounded">ME</span>}</td>
                                <td className="py-3 px-4 text-center">0</td>
                                <td className="py-3 px-4 text-center">0</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  // 드래프트 전 전체 순위표
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                        <tr><th className="py-4 px-6 text-left rounded-tl-lg">순위</th><th className="py-4 px-6 text-left">팀</th><th className="py-4 px-6 text-center">승</th><th className="py-4 px-6 text-center">패</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {teams.map((t, idx) => {
                          const isMyTeam = myTeam.id === t.id;
                          return (
                            <tr key={t.id} onClick={() => setViewingTeamId(t.id)} className={`cursor-pointer ${isMyTeam ? 'bg-blue-100 border-l-4 border-blue-600' : 'hover:bg-gray-50'}`}>
                              <td className="py-4 px-6 font-bold text-lg">{idx + 1}</td>
                              <td className="py-4 px-6">
                                <span className="text-lg font-bold text-blue-600">{t.fullName}</span>
                                {isMyTeam && <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-1 rounded font-bold">(선택됨)</span>}
                              </td>
                              <td className="py-4 px-6 text-center">0</td>
                              <td className="py-4 px-6 text-center">0</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'schedule' && (
              <div className="flex flex-col items-center justify-center h-[500px] bg-white rounded-lg border border-dashed border-gray-300 text-gray-400">
                <div className="text-4xl mb-4">🚧</div>
                <div className="text-xl font-bold">기능 준비 중입니다</div>
                <p className="mt-2">다음 업데이트를 기다려주세요!</p>
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