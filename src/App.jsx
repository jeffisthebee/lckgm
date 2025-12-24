import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
// 선수 데이터 임포트
import playerList from './data/players.json';

const teams = [
  { id: 1, name: 'GEN', fullName: '젠지 (Gen.G)', power: 94, description: '안정적인 운영과 강력한 라인전', colors: { primary: '#FFD700', secondary: '#000000' } },
  { id: 2, name: 'HLE', fullName: '한화생명 (HLE)', power: 93, description: '성장 가능성이 높은 팀', colors: { primary: '#FF6B00', secondary: '#FFFFFF' } },
  { id: 3, name: 'KT', fullName: '케이티 (KT)', power: 87, description: '공격적인 플레이 스타일', colors: { primary: '#FF4444', secondary: '#FFFFFF' } },
  { id: 4, name: 'T1', fullName: '티원 (T1)', power: 93, description: 'LCK의 최강팀, 세계 챔피언십 우승 경력', colors: { primary: '#E2012E', secondary: '#000000' } },
  { id: 5, name: 'DK', fullName: '디플러스 기아 (DK)', power: 84, description: '전략적 플레이와 팀워크', colors: { primary: '#00D9C4', secondary: '#FFFFFF' } },
  { id: 6, name: 'BNK', fullName: 'BNK 피어엑스 (BNK)', power: 82, description: '젊은 선수들의 잠재력', colors: { primary: '#FFB800', secondary: '#000000' } },
  { id: 7, name: 'NS', fullName: '농심 레드포스 (NS)', power: 85, description: '재건 중인 팀', colors: { primary: '#DC143C', secondary: '#FFFFFF' } },
  { id: 8, name: 'BRO', fullName: '브리온 (BRO)', power: 79, description: '기본기에 충실한 팀', colors: { primary: '#166534', secondary: '#FFFFFF' } },
  { id: 9, name: 'DRX', fullName: '디알엑스 (DRX)', power: 80, description: '변화를 추구하는 팀', colors: { primary: '#87CEEB', secondary: '#000000' } },
  { id: 10, name: 'DNS', fullName: 'DN 수퍼스 (DNS)', power: 82, description: '신생 팀, 도전 정신', colors: { primary: '#1E3A8A', secondary: '#FFFFFF' } },
];

const difficulties = [
  { value: 'easy', label: '쉬움', color: 'green' },
  { value: 'normal', label: '보통', color: 'blue' },
  { value: 'hard', label: '어려움', color: 'orange' },
  { value: 'insane', label: '극악', color: 'red' },
];

// localStorage 관리 함수들
const getLeagues = () => {
  const stored = localStorage.getItem('lckgm_leagues');
  return stored ? JSON.parse(stored) : [];
};
const saveLeagues = (leagues) => localStorage.setItem('lckgm_leagues', JSON.stringify(leagues));
const addLeague = (league) => { const l = getLeagues(); l.push(league); saveLeagues(l); return l; };
const updateLeague = (id, updates) => {
  const leagues = getLeagues();
  const index = leagues.findIndex(l => l.id === id);
  if (index !== -1) { leagues[index] = { ...leagues[index], ...updates }; saveLeagues(leagues); }
  return leagues;
};
const deleteLeague = (id) => { const l = getLeagues(); const f = l.filter(x => x.id !== id); saveLeagues(f); return f; };
const getLeagueById = (id) => getLeagues().find(l => l.id === id);

// 유틸리티 함수
function getTextColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? '#000000' : '#FFFFFF';
}
function formatDate(d) { return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }); }

// --- 컴포넌트: 리그 목록 ---
function LeagueManager() {
  const [leagues, setLeagues] = useState(getLeagues());
  const navigate = useNavigate();

  useEffect(() => setLeagues(getLeagues()), []);
  const handleDelete = (id) => { if(window.confirm('삭제하시겠습니까?')) { deleteLeague(id); setLeagues(getLeagues()); }};
  const handleContinue = (league) => { updateLeague(league.id, { lastPlayed: new Date().toISOString() }); navigate(`/league/${league.id}`); };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">LCK GM 매니저</h1>
        <div className="grid gap-4">
          {leagues.map(l => {
            const t = teams.find(team => team.id === l.team.id);
            return (
              <div key={l.id} className="bg-white p-6 rounded-lg shadow-sm border hover:border-blue-500 transition flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-sm" style={{backgroundColor: t.colors.primary}}>{t.name}</div>
                  <div>
                    <h2 className="text-xl font-bold">{l.leagueName}</h2>
                    <p className="text-gray-500">{t.fullName} · {l.difficulty}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleContinue(l)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">계속하기</button>
                  <button onClick={() => handleDelete(l.id)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">삭제</button>
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={() => navigate('/new-league')} className="w-full mt-6 bg-white border-2 border-dashed border-gray-300 py-4 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 font-bold text-lg transition">
          + 새로운 리그 생성
        </button>
      </div>
    </div>
  );
}

// --- 컴포넌트: 팀 선택 ---
function TeamSelection() {
  const [idx, setIdx] = useState(0);
  const [diff, setDiff] = useState('normal');
  const navigate = useNavigate();
  const current = teams[idx];

  const handleStart = () => {
    const newLeague = {
      id: Date.now().toString(),
      leagueName: `LCK 2026 - ${current.name}`,
      team: current,
      difficulty: diff,
      createdAt: new Date().toISOString(),
      lastPlayed: new Date().toISOString()
    };
    addLeague(newLeague);
    navigate(`/league/${newLeague.id}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 transition-colors duration-500" style={{backgroundColor: `${current.colors.primary}20`}}>
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-2xl w-full text-center border-t-8" style={{borderColor: current.colors.primary}}>
        <h2 className="text-3xl font-bold mb-2">팀 선택</h2>
        <p className="text-gray-500 mb-8">2026 시즌을 함께할 팀을 선택하세요</p>
        
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => setIdx(i => i === 0 ? teams.length-1 : i-1)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">◀</button>
          <div className="flex flex-col items-center">
            <div className="w-32 h-32 rounded-full flex items-center justify-center text-4xl font-bold text-white shadow-lg mb-4" style={{backgroundColor: current.colors.primary}}>
              {current.name}
            </div>
            <h3 className="text-2xl font-bold">{current.fullName}</h3>
            <div className="mt-2 inline-block bg-gray-100 px-3 py-1 rounded text-sm font-semibold">전력: <span className="text-blue-600">{current.power}</span></div>
          </div>
          <button onClick={() => setIdx(i => i === teams.length-1 ? 0 : i+1)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">▶</button>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-8">
          {difficulties.map(d => (
            <button key={d.value} onClick={() => setDiff(d.value)} className={`py-2 rounded border font-bold ${diff === d.value ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200'}`}>{d.label}</button>
          ))}
        </div>

        <button onClick={handleStart} className="w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg hover:opacity-90 transition" style={{backgroundColor: current.colors.primary, color: getTextColor(current.colors.primary)}}>
          게임 시작
        </button>
      </div>
    </div>
  );
}

// --- 컴포넌트: 대시보드 (핵심 기능 업데이트됨) ---
function Dashboard() {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const [league, setLeague] = useState(null);
  
  // 1. 현재 보고 있는 팀 ID를 저장하는 State 추가 (기본값: 내 팀 아님, 로딩 후 설정)
  const [viewingTeamId, setViewingTeamId] = useState(null);

  useEffect(() => {
    const found = getLeagueById(leagueId);
    if (found) {
      setLeague(found);
      updateLeague(leagueId, { lastPlayed: new Date().toISOString() });
      // 처음 로드될 때 '내 팀'을 바라보도록 설정
      setViewingTeamId(found.team.id);
    }
  }, [leagueId]);

  if (!league) return <div className="text-center py-20">로딩 중...</div>;

  const myTeam = teams.find(t => t.id === league.team.id);
  
  // 2. 현재 보고 있는 팀(viewingTeamId)의 정보 찾기
  const viewingTeam = teams.find(t => t.id === viewingTeamId) || myTeam;

  // 3. 로스터 필터링: '내 팀'이 아니라 '지금 보고 있는 팀' 기준
  const currentRoster = playerList.filter(p => p.팀 === viewingTeam.name);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단바 */}
      <nav className="bg-white border-b px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-black font-bold">← 나가기</button>
          <span className="text-xl font-bold">
            <span style={{color: myTeam.colors.primary}}>{myTeam.name}</span> 매니지먼트
          </span>
        </div>
        <div className="flex gap-4">
           <button onClick={() => setViewingTeamId(myTeam.id)} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 font-medium text-sm">내 팀 보기</button>
           <button className="px-6 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 shadow-md">다음 경기 진행</button>
        </div>
      </nav>

      <div className="p-8 max-w-7xl mx-auto grid grid-cols-12 gap-6">
        
        {/* 좌측: 순위표 (클릭 가능하도록 수정됨) */}
        <div className="col-span-4 bg-white rounded-lg border shadow-sm p-5 h-[600px] flex flex-col">
          <h3 className="font-bold text-lg mb-4 border-b pb-2">LCK 팀 목록</h3>
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="p-2 text-left">순위</th>
                  <th className="p-2 text-left">팀</th>
                  <th className="p-2 text-center">승</th>
                  <th className="p-2 text-center">패</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t, idx) => {
                  // 현재 보고 있는 팀인지 확인 (강조 표시용)
                  const isViewing = viewingTeamId === t.id;
                  const isMyTeam = myTeam.id === t.id;
                  
                  return (
                    <tr 
                      key={t.id} 
                      // 4. 클릭 시 viewingTeamId 변경
                      onClick={() => setViewingTeamId(t.id)}
                      className={`cursor-pointer transition border-b last:border-0 
                        ${isViewing ? 'bg-blue-50' : 'hover:bg-gray-50'}
                        ${isMyTeam ? 'font-bold' : ''}
                      `}
                    >
                      <td className="p-3">{idx + 1}</td>
                      <td className="p-3 flex items-center gap-2">
                        {/* 보고 있는 팀이면 왼쪽에 파란색 바 표시 */}
                        {isViewing && <div className="w-1 h-4 bg-blue-500 rounded-full mr-1"></div>}
                        <span>{t.name}</span>
                        {isMyTeam && <span className="text-xs bg-gray-200 px-1 rounded text-gray-600">MY</span>}
                      </td>
                      <td className="p-3 text-center">0</td>
                      <td className="p-3 text-center">0</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">팀을 클릭하여 로스터를 확인하세요.</p>
        </div>

        {/* 중앙: 로스터 뷰어 (선택된 팀에 따라 바뀜) */}
        <div className="col-span-8 bg-white rounded-lg border shadow-sm p-5 h-[600px] flex flex-col">
          <div className="flex justify-between items-end mb-4 border-b pb-2">
            <div>
              <span className="text-sm text-gray-500">Selected Team</span>
              <h2 className="text-2xl font-bold flex items-center gap-2" style={{color: viewingTeam.colors.primary}}>
                {viewingTeam.fullName} 
                <span className="text-lg text-black font-normal opacity-50">로스터</span>
              </h2>
            </div>
            <div className="text-right">
               <span className="text-sm font-bold text-gray-600">팀 전력: {viewingTeam.power}</span>
               <p className="text-xs text-gray-400">{viewingTeam.description}</p>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 text-gray-500 text-sm">
                <tr>
                  <th className="py-2 px-4 text-left">POS</th>
                  <th className="py-2 px-4 text-left">NAME</th>
                  <th className="py-2 px-4 text-center">OVR</th>
                  <th className="py-2 px-4 text-left">TRAIT</th>
                </tr>
              </thead>
              <tbody>
                {currentRoster.length > 0 ? (
                  currentRoster.map((p, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50 transition">
                      <td className="py-4 px-4 font-bold text-gray-400 w-20">{p.포지션}</td>
                      <td className="py-4 px-4 font-bold text-lg">{p.이름}</td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-block w-10 py-1 rounded font-bold text-sm ${p.종합 >= 90 ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                          {p.종합}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-500">{p.특성}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="py-20 text-center text-gray-400">
                      로스터 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

// 라우터 설정
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