import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
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

const getLeagues = () => { const s = localStorage.getItem('lckgm_leagues'); return s ? JSON.parse(s) : []; };
const saveLeagues = (l) => localStorage.setItem('lckgm_leagues', JSON.stringify(l));
const addLeague = (l) => { const list = getLeagues(); list.push(l); saveLeagues(list); return list; };
const updateLeague = (id, u) => { const l = getLeagues(); const i = l.findIndex(x => x.id === id); if(i!==-1){ l[i]={...l[i],...u}; saveLeagues(l); } return l; };
const deleteLeague = (id) => { const l = getLeagues().filter(x => x.id !== id); saveLeagues(l); return l; };
const getLeagueById = (id) => getLeagues().find(l => l.id === id);

function getTextColor(hex) { const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return (r*299+g*587+b*114)/1000>128?'#000000':'#FFFFFF'; }
function formatDate(d) { return new Date(d).toLocaleDateString('ko-KR', {year:'numeric',month:'long',day:'numeric'}); }

// 리그 목록 컴포넌트
function LeagueManager() {
  const [leagues, setLeagues] = useState(getLeagues());
  const navigate = useNavigate();
  useEffect(() => setLeagues(getLeagues()), []);
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">LCK GM 매니저</h1>
        <div className="grid gap-4">
          {leagues.map(l => {
            const t = teams.find(x => x.id === l.team.id);
            return (
              <div key={l.id} className="bg-white p-6 rounded-lg shadow-sm border hover:border-blue-500 transition flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-sm" style={{backgroundColor:t.colors.primary}}>{t.name}</div>
                  <div><h2 className="text-xl font-bold">{l.leagueName}</h2><p className="text-gray-500">{t.fullName} · {l.difficulty}</p></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>{updateLeague(l.id,{lastPlayed:new Date().toISOString()});navigate(`/league/${l.id}`)}} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">계속하기</button>
                  <button onClick={()=>{if(window.confirm('삭제?')){deleteLeague(l.id);setLeagues(getLeagues())}}} className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">삭제</button>
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={() => navigate('/new-league')} className="w-full mt-6 bg-white border-2 border-dashed border-gray-300 py-4 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 font-bold text-lg transition">+ 새로운 리그 생성</button>
      </div>
    </div>
  );
}

// 팀 선택 컴포넌트
function TeamSelection() {
  const [idx, setIdx] = useState(0);
  const [diff, setDiff] = useState('normal');
  const navigate = useNavigate();
  const current = teams[idx];
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 transition-colors duration-500" style={{backgroundColor:`${current.colors.primary}20`}}>
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-2xl w-full text-center border-t-8" style={{borderColor:current.colors.primary}}>
        <h2 className="text-3xl font-bold mb-2">팀 선택</h2>
        <div className="flex items-center justify-between mb-8 mt-6">
          <button onClick={()=>setIdx(i=>i===0?teams.length-1:i-1)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">◀</button>
          <div className="flex flex-col items-center">
            <div className="w-32 h-32 rounded-full flex items-center justify-center text-4xl font-bold text-white shadow-lg mb-4" style={{backgroundColor:current.colors.primary}}>{current.name}</div>
            <h3 className="text-2xl font-bold">{current.fullName}</h3>
            <div className="mt-2 inline-block bg-gray-100 px-3 py-1 rounded text-sm font-semibold">전력: <span className="text-blue-600">{current.power}</span></div>
          </div>
          <button onClick={()=>setIdx(i=>i===teams.length-1?0:i+1)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">▶</button>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-8">{difficulties.map(d=><button key={d.value} onClick={()=>setDiff(d.value)} className={`py-2 rounded border font-bold ${diff===d.value?'bg-gray-800 text-white border-gray-800':'bg-white text-gray-500 border-gray-200'}`}>{d.label}</button>)}</div>
        <button onClick={()=>{addLeague({id:Date.now().toString(),leagueName:`LCK 2026 - ${current.name}`,team:current,difficulty:diff,createdAt:new Date().toISOString(),lastPlayed:new Date().toISOString()});navigate(`/league/${Date.now().toString()}`)}} className="w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg hover:opacity-90 transition" style={{backgroundColor:current.colors.primary,color:getTextColor(current.colors.primary)}}>게임 시작</button>
      </div>
    </div>
  );
}

// 대시보드 컴포넌트
function Dashboard() {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const [league, setLeague] = useState(null);
  const [viewingTeamId, setViewingTeamId] = useState(null);

  useEffect(() => {
    const found = getLeagueById(leagueId);
    if (found) {
      setLeague(found);
      updateLeague(leagueId, { lastPlayed: new Date().toISOString() });
      setViewingTeamId(found.team.id);
    }
  }, [leagueId]);

  if (!league) return <div className="text-center py-20">로딩 중...</div>;

  const myTeam = teams.find(t => t.id === league.team.id);
  const viewingTeam = teams.find(t => t.id === viewingTeamId) || myTeam;
  const currentRoster = playerList.filter(p => p.팀 === viewingTeam.name);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-black font-bold">← 나가기</button>
          <span className="text-xl font-bold"><span style={{color: myTeam.colors.primary}}>{myTeam.name}</span> 매니지먼트</span>
        </div>
        <div className="flex gap-4">
           <button onClick={() => setViewingTeamId(myTeam.id)} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 font-medium text-sm transition">내 팀 보기</button>
           <button className="px-6 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 shadow-md transition transform hover:scale-105">다음 경기 진행</button>
        </div>
      </nav>

      <div className="p-8 max-w-7xl mx-auto grid grid-cols-12 gap-6">
        {/* 순위표 (팀 클릭 네비게이션) */}
        <div className="col-span-4 bg-white rounded-lg border shadow-sm p-5 h-[650px] flex flex-col">
          <h3 className="font-bold text-lg mb-4 border-b pb-2">LCK 팀 목록</h3>
          <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr><th className="p-3 text-left text-gray-500">순위</th><th className="p-3 text-left text-gray-500">팀</th><th className="p-3 text-center text-gray-500">승/패</th></tr>
              </thead>
              <tbody>
                {teams.map((t, idx) => {
                  const isViewing = viewingTeamId === t.id;
                  const isMyTeam = myTeam.id === t.id;
                  return (
                    <tr key={t.id} onClick={() => setViewingTeamId(t.id)} 
                        className={`cursor-pointer transition duration-150 border-b last:border-0 group
                          ${isViewing ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}
                        `}>
                      <td className="p-3 font-medium text-gray-600">{idx + 1}</td>
                      <td className="p-3 flex items-center gap-2">
                        <span className={`font-bold ${isViewing ? 'text-blue-700' : 'text-gray-800'}`}>{t.name}</span>
                        {isMyTeam && <span className="text-[10px] bg-gray-800 text-white px-1.5 py-0.5 rounded font-bold">MY</span>}
                        {isViewing && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded ml-auto">선택됨</span>}
                      </td>
                      <td className="p-3 text-center text-gray-500">0 - 0</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 로스터 뷰어 */}
        <div className="col-span-8 bg-white rounded-lg border shadow-sm p-0 h-[650px] flex flex-col overflow-hidden relative">
          <div className="p-6 border-b bg-white z-10">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Roster</span>
                <h2 className="text-3xl font-black mt-1 flex items-center gap-3" style={{color: viewingTeam.colors.primary}}>
                  {viewingTeam.fullName}
                  {viewingTeam.id === myTeam.id && <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-bold border">MY TEAM</span>}
                </h2>
              </div>
              <div className="text-right">
                 <div className="text-2xl font-bold text-gray-800">{viewingTeam.power} <span className="text-sm text-gray-400 font-normal">OVR</span></div>
                 <p className="text-xs text-gray-400 mt-1 max-w-[200px] leading-tight">{viewingTeam.description}</p>
              </div>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 text-gray-500 text-xs uppercase tracking-wider font-semibold z-10 border-b">
                <tr>
                  <th className="py-3 px-6 text-left w-24">Pos</th>
                  <th className="py-3 px-6 text-left">Name</th>
                  <th className="py-3 px-6 text-center w-20">OVR</th>
                  <th className="py-3 px-6 text-left">Key Trait</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentRoster.length > 0 ? (
                  currentRoster.map((p, i) => (
                    <tr key={i} className="hover:bg-blue-50/50 transition duration-150 group">
                      <td className="py-4 px-6 font-bold text-gray-400 group-hover:text-blue-500 transition-colors">{p.포지션}</td>
                      <td className="py-4 px-6 font-bold text-lg text-gray-800">{p.이름}</td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center justify-center w-10 h-8 rounded-lg font-bold text-sm shadow-sm
                          ${p.종합 >= 94 ? 'bg-red-100 text-red-600 border border-red-200' : 
                            p.종합 >= 90 ? 'bg-orange-100 text-orange-600 border border-orange-200' : 
                            'bg-gray-100 text-gray-600 border border-gray-200'}
                        `}>
                          {p.종합}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-500 font-medium">
                        <span className="bg-gray-50 px-2 py-1 rounded border border-gray-100 text-xs text-gray-600">{p.특성}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="4" className="py-32 text-center text-gray-300">로스터 정보가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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