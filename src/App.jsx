import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import playerList from './data/players.json';

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

const getLeagues = () => { const s = localStorage.getItem('lckgm_leagues'); return s ? JSON.parse(s) : []; };
const saveLeagues = (l) => localStorage.setItem('lckgm_leagues', JSON.stringify(l));
const addLeague = (l) => { const list = getLeagues(); list.push(l); saveLeagues(list); return list; };
const updateLeague = (id, u) => { const l = getLeagues(); const i = l.findIndex(x => x.id === id); if(i!==-1){ l[i]={...l[i],...u}; saveLeagues(l); } return l; };
const deleteLeague = (id) => { const l = getLeagues().filter(x => x.id !== id); saveLeagues(l); return l; };
const getLeagueById = (id) => getLeagues().find(l => l.id === id);
function getTextColor(hex) { const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return (r*299+g*587+b*114)/1000>128?'#000000':'#FFFFFF'; }

// OVR 색상 (BBGM 스타일)
const getOvrBadgeStyle = (ovr) => {
  if (ovr >= 95) return 'bg-red-100 text-red-700 border-red-300 ring-red-200'; // 월클
  if (ovr >= 90) return 'bg-orange-100 text-orange-700 border-orange-300 ring-orange-200'; // S급
  if (ovr >= 80) return 'bg-blue-100 text-blue-700 border-blue-300 ring-blue-200'; // A급
  if (ovr >= 70) return 'bg-green-100 text-green-700 border-green-300 ring-green-200'; // B급
  return 'bg-gray-100 text-gray-600 border-gray-300 ring-gray-200';
};

// 잠재력 색상
const getPotBadgeStyle = (pot) => {
  if (pot >= 95) return 'text-purple-600 font-black'; 
  if (pot >= 90) return 'text-blue-600 font-bold'; 
  return 'text-gray-500 font-medium';
};

// --- 컴포넌트들 ---

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
                  <div><h2 className="text-xl font-bold group-hover:text-blue-600 transition">{l.leagueName}</h2><p className="text-gray-500 font-medium">{t.fullName} · {l.difficulty.toUpperCase()}</p></div>
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
        <div className="grid grid-cols-4 gap-3 mb-8">{difficulties.map(d=><button key={d.value} onClick={()=>setDiff(d.value)} className={`py-3 rounded-xl border-2 font-bold transition ${diff===d.value?'bg-gray-800 text-white border-gray-800':'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}>{d.label}</button>)}</div>
        <button onClick={()=>{addLeague({id:Date.now().toString(),leagueName:`2026 LCK 컵 - ${current.name}`,team:current,difficulty:diff,createdAt:new Date().toISOString(),lastPlayed:new Date().toISOString()});navigate(`/league/${Date.now().toString()}`)}} className="w-full py-5 rounded-2xl font-black text-xl text-white shadow-lg hover:shadow-xl hover:opacity-90 transition transform hover:-translate-y-1" style={{backgroundColor:current.colors.primary,color:getTextColor(current.colors.primary)}}>2026 시즌 시작하기</button>
      </div>
    </div>
  );
}

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

  if (!league) return <div className="flex h-screen items-center justify-center font-bold text-gray-500">데이터 로딩 중...</div>;

  const myTeam = teams.find(t => t.id === league.team.id);
  const viewingTeam = teams.find(t => t.id === viewingTeamId) || myTeam;
  const currentRoster = playerList.filter(p => p.팀 === viewingTeam.name);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      <aside className="w-64 bg-gray-900 text-gray-300 flex-shrink-0 flex flex-col shadow-xl z-20">
        <div className="p-5 bg-gray-800 border-b border-gray-700 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-lg" style={{backgroundColor: myTeam.colors.primary}}>{myTeam.name}</div>
          <div><div className="text-white font-bold text-sm leading-tight">{myTeam.fullName}</div><div className="text-xs text-gray-400">GM 모드</div></div>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {['대시보드','로스터','순위표','일정','FA 시장','파워 랭킹','기록실'].map(n=><button key={n} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${n==='대시보드'?'bg-blue-600 text-white shadow-md':'hover:bg-gray-800 hover:text-white'}`}>{n}</button>)}
        </div>
        <div className="p-4 border-t border-gray-700 bg-gray-800"><button onClick={() => navigate('/')} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition"><span>🚪</span> 메인으로 나가기</button></div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b h-14 flex items-center justify-between px-6 shadow-sm z-10 flex-shrink-0">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">📅</span> 2026 LCK 컵 대회</div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">🏆</span> 0승 0패 (1위)</div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2 font-bold text-green-600"><span className="text-gray-400">💰</span> 100억 원</div>
          </div>
          <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-1.5 rounded-full font-bold text-sm shadow-sm transition flex items-center gap-2"><span>▶</span> 다음 경기 진행</button>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-12 gap-6 max-w-7xl mx-auto">
            
            {/* 위젯 1: 다음 상대 */}
            <div className="col-span-12 lg:col-span-8 bg-white rounded-lg border shadow-sm p-5 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl">📅</div>
               <h3 className="text-lg font-bold text-gray-800 mb-2">다음 경기 일정</h3>
               <div className="flex items-center justify-between bg-gray-50 rounded-xl p-6 border">
                  <div className="text-center w-1/3"><div className="text-4xl font-black text-gray-800 mb-2">{myTeam.name}</div><div className="text-sm font-bold text-gray-500">0 - 0</div></div>
                  <div className="text-center w-1/3"><div className="text-xs font-bold text-gray-400 uppercase">VS</div><div className="text-3xl font-bold text-gray-300 my-2">@</div><div className="text-xs font-bold text-blue-600">LCK 컵 1R</div></div>
                  <div className="text-center w-1/3"><div className="text-4xl font-black text-gray-300 mb-2">미정</div><div className="text-sm font-bold text-gray-400">상대팀</div></div>
               </div>
            </div>

            {/* 위젯 2: 순위표 */}
            <div className="col-span-12 lg:col-span-4 bg-white rounded-lg border shadow-sm p-0 flex flex-col h-full max-h-[300px]">
               <div className="p-3 border-b bg-gray-50 font-bold text-sm text-gray-700 flex justify-between"><span>순위표</span><span className="text-xs text-blue-600 cursor-pointer">전체 보기</span></div>
               <div className="flex-1 overflow-y-auto p-0">
                  <table className="w-full text-xs">
                    <tbody>
                      {teams.map((t, i) => (
                        <tr key={t.id} onClick={() => setViewingTeamId(t.id)} className={`cursor-pointer border-b last:border-0 ${viewingTeamId === t.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                          <td className="p-2 font-bold text-gray-500 text-center w-8">{i + 1}</td>
                          <td className="p-2 font-bold">{t.fullName}</td>
                          <td className="p-2 text-right text-gray-500">0-0</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>

            {/* 위젯 3: 로스터 뷰어 */}
            <div className="col-span-12 bg-white rounded-lg border shadow-sm flex flex-col min-h-[500px]">
              <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-sm" style={{backgroundColor: viewingTeam.colors.primary}}>
                    {viewingTeam.name}
                  </div>
                  <div><h2 className="text-2xl font-black text-gray-800">{viewingTeam.fullName}</h2><p className="text-xs font-bold text-gray-500 uppercase tracking-wide">로스터 정보</p></div>
                </div>
                <div className="text-right"><div className="text-xl font-black text-blue-600">{viewingTeam.power} <span className="text-xs text-gray-400">OVR</span></div></div>
              </div>

              <div className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white text-gray-400 text-xs uppercase font-bold border-b">
                    <tr>
                      <th className="py-3 px-6 text-left">포지션</th>
                      <th className="py-3 px-6 text-left">선수 이름</th>
                      <th className="py-3 px-6 text-center">종합</th>
                      <th className="py-3 px-6 text-center">잠재력</th>
                      <th className="py-3 px-6 text-left">핵심 특성</th>
                      <th className="py-3 px-6 text-left">계약</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentRoster.length > 0 ? (
                      currentRoster.map((p, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition duration-150 group">
                          <td className="py-3 px-6 font-bold text-gray-400 w-16">{p.포지션}</td>
                          <td className="py-3 px-6">
                            <div className="font-bold text-gray-800 text-base">{p.이름}</div>
                            <div className="text-xs text-gray-400">{viewingTeam.name}</div>
                          </td>
                          <td className="py-3 px-6 text-center">
                            <span className={`inline-flex items-center justify-center w-10 h-8 rounded-lg font-black text-sm shadow-sm border ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span>
                          </td>
                          <td className="py-3 px-6 text-center">
                            <span className={`text-sm ${getPotBadgeStyle(p.잠재력)}`}>{p.잠재력}</span>
                          </td>
                          <td className="py-3 px-6"><span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-medium border border-gray-200">{p.특성}</span></td>
                          <td className="py-3 px-6">
                            <div className="flex gap-2 text-xs font-medium text-gray-500">
                              <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100">{p.계약}년까지</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="6" className="py-20 text-center text-gray-300">로스터 정보가 없습니다.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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