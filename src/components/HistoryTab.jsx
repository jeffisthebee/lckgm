// src/components/HistoryTab.jsx
import React, { useState, useEffect } from 'react';
import { teams } from '../data/teams';

// [NEW] Custom League Titles
const LEAGUE_TITLES = {
    'LCK': '컵',
    'LPL': '스플릿 1',
    'LCP': '스플릿 1',
    'LEC': '버서스',
    'LCS': '락 인',
    'CBLOL': '레전드 컵'
};

// --- Helper Components ---

const RoleBadge = ({ role }) => {
    const icons = { TOP: '⚔️', JGL: '🌲', MID: '🧙', ADC: '🏹', SUP: '🛡️' };
    const colors = {
        TOP: 'bg-red-100 text-red-700 border-red-200',
        JGL: 'bg-green-100 text-green-700 border-green-200',
        MID: 'bg-purple-100 text-purple-700 border-purple-200',
        ADC: 'bg-blue-100 text-blue-700 border-blue-200',
        SUP: 'bg-yellow-100 text-yellow-700 border-yellow-200'
    };
    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${colors[role] || 'bg-gray-100'}`}>
            <span>{icons[role] || '•'}</span> {role}
        </span>
    );
};

const AllProTeamRow = ({ title, players }) => (
    <div className="mb-4">
        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 border-b pb-1">{title}</h4>
        <div className="grid grid-cols-5 gap-2">
            {['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map(role => {
                let p = null;
                if (players) {
                    if (Array.isArray(players)) {
                        p = players.find(x => x && x.role === role);
                    } else {
                        p = players[role];
                    }
                }
                
                if (!p) return (
                    <div key={role} className="bg-gray-50 rounded p-2 text-center text-xs text-gray-400 flex flex-col items-center justify-center min-h-[80px]">
                        <RoleBadge role={role} />
                        <span className="mt-1">-</span>
                    </div>
                );
                
                const displayName = p.실명 || p.playerName || p.name || "Unknown";
                
                let teamName = "FA";
                if (p.teamObj && p.teamObj.name) teamName = p.teamObj.name;
                else if (p.team) teamName = p.team;
                else if (p.teams && p.teams.length > 0) teamName = p.teams[0];

                const teamObj = teams.find(t => t.name === teamName);
                const teamColor = teamObj?.colors?.primary || '#999';

                return (
                    <div key={role} className="bg-white border rounded-lg p-2 flex flex-col items-center shadow-sm">
                        <RoleBadge role={role} />
                        <div className="font-bold text-gray-800 text-xs mt-1 truncate w-full text-center">{displayName}</div>
                        <div className="text-[10px] text-gray-500 font-bold flex items-center gap-1 mt-1">
                             <div className="w-3 h-3 rounded-full border border-gray-200" style={{backgroundColor: teamColor}}></div>
                             {teamName}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

const SmallMvpCard = ({ title, player, colorClass }) => {
    if (!player) return null;

    const displayName = player.실명 || player.playerName || player.name || "Unknown";
    
    let teamName = "LCK";
    if (player.teamObj && player.teamObj.name) teamName = player.teamObj.name;
    else if (player.team) teamName = player.team;
    else if (Array.isArray(player.teams) && player.teams.length > 0) teamName = player.teams[0];

    const role = player.role || 'Player';

    return (
        <div className="bg-white border rounded-xl p-3 shadow-sm flex items-center gap-3 relative overflow-hidden">
            <div className={`absolute top-0 right-0 text-[10px] font-bold px-2 py-1 rounded-bl-lg text-white ${colorClass}`}>
                {title}
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg border-2 ${colorClass.replace('bg-', 'border-').replace('text-white','')}`}>
                🧑‍🚀
            </div>
            <div>
                <div className="text-sm font-black text-gray-800">{displayName}</div>
                <div className="text-[10px] text-gray-500 font-bold">{teamName} · {role}</div>
            </div>
        </div>
    );
};

const HistoryTab = ({ league }) => {
  // [NEW] League Switcher Memory
  const [currentLeague, setCurrentLeague] = useState('LCK');
  
  // [NEW] Smart History Targeter
  const history = currentLeague === 'LCK' 
      ? (league?.history || []) 
      : (league?.foreignHistory?.[currentLeague] || []);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState('regular'); // 'regular' or 'playoff'

  // [NEW] Auto-reset to latest season when switching leagues
  useEffect(() => {
      setCurrentIndex(history.length > 0 ? history.length - 1 : 0);
  }, [currentLeague, history.length]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10">
      
      {/* [NEW] The League Switcher Buttons - Placed outside the "Empty History" check so they don't disappear! */}
      <div className="flex gap-2 p-3 border-b bg-gray-100 overflow-x-auto shrink-0 sticky top-0 z-50 rounded-lg">
          {['LCK', 'LPL', 'LEC', 'LCS', 'LCP', 'CBLOL'].map(lg => (
              <button
                  key={lg}
                  onClick={() => setCurrentLeague(lg)}
                  className={`px-5 py-2 rounded-full font-bold text-xs lg:text-sm transition-all whitespace-nowrap shadow-sm active:scale-95 ${
                      currentLeague === lg
                      ? 'bg-blue-600 text-white ring-2 ring-blue-300 transform scale-105'
                      : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-300'
                  }`}
              >
                  {lg}
              </button>
          ))}
      </div>

      {history.length === 0 ? (
          // [NEW] Empty State tailored to the current league
          <div className="flex flex-col items-center justify-center h-[400px] text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <div className="text-4xl mb-4">📜</div>
              <div className="font-bold text-xl mb-2">2026 {currentLeague} {LEAGUE_TITLES[currentLeague]} 기록이 없습니다.</div>
              <p className="text-sm text-gray-500 font-medium">시즌이 종료되면 상단의 [💾 시즌 기록 저장] 버튼을 눌러 역사에 기록하세요.</p>
          </div>
      ) : (
          // The actual History Record Rendering
          (() => {
              const record = history[currentIndex];
              if (!record) return <div>Data Error</div>;

              const handlePrev = () => setCurrentIndex(prev => (prev - 1 + history.length) % history.length);
              const handleNext = () => setCurrentIndex(prev => (prev + 1) % history.length);

              const isNewFormat = record.awards?.regular !== undefined;
              
              const regularMvp = isNewFormat ? record.awards.regular?.mvp : record.awards?.mvp;
              const regularAllPro = isNewFormat ? record.awards.regular?.allPro : record.awards?.allPro;
              
              const finalsMvp = isNewFormat ? record.awards.playoff?.finalsMvp : null;
              const playoffMvp = isNewFormat ? record.awards.playoff?.playoffMvp : null;
              const playoffAllPro = isNewFormat ? record.awards.playoff?.allPro : null;

              const finalsMvpName = finalsMvp?.실명 || finalsMvp?.playerName || finalsMvp?.name || "";
              const championColor = record.champion?.colors?.primary || record.champion?.color || '#333';

              return (
                  <>
                      {/* 1. HEADER & NAVIGATION */}
                      <div className="bg-gray-900 text-white rounded-xl p-6 flex items-center justify-between shadow-lg relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                          <button onClick={handlePrev} className="z-10 w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center font-bold text-xl transition">&lt;</button>
                          <div className="z-10 text-center">
                              <h2 className="text-3xl lg:text-4xl font-black tracking-tighter text-yellow-400 drop-shadow-md">
                                  {record.year} {currentLeague} {LEAGUE_TITLES[currentLeague]}
                              </h2>
                              <div className="text-gray-400 font-bold text-sm mt-1 uppercase tracking-widest">Season Archive</div>
                          </div>
                          <button onClick={handleNext} className="z-10 w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center font-bold text-xl transition">&gt;</button>
                      </div>

                      {/* 2. CHAMPION & KEY MVPS */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          <div className="lg:col-span-2 bg-gradient-to-br from-yellow-50 to-white border border-yellow-200 rounded-xl p-6 shadow-sm flex items-center gap-6 relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl">🏆</div>
                              <div className="w-24 h-24 lg:w-32 lg:h-32 rounded-full shadow-lg flex items-center justify-center text-white font-black text-2xl lg:text-4xl border-4 border-yellow-400 z-10"
                                   style={{backgroundColor: championColor}}>
                                  {record.champion?.name || 'TBD'}
                              </div>
                              <div className="z-10">
                                  <div className="text-yellow-600 font-bold text-sm uppercase tracking-wide mb-1">Season Champion</div>
                                  <div className="text-3xl lg:text-5xl font-black text-gray-900">{record.champion?.fullName || 'Unknown Team'}</div>
                                  <div className="flex gap-2 mt-2">
                                       {finalsMvpName && (
                                           <div className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-lg border border-blue-200">
                                               FMVP: {finalsMvpName}
                                           </div>
                                       )}
                                  </div>
                              </div>
                          </div>

                          <div className="flex flex-col gap-2">
                             <SmallMvpCard title="SEASON MVP" player={regularMvp} colorClass="bg-yellow-500" />
                             {playoffMvp && <SmallMvpCard title="PLAYOFF MVP" player={playoffMvp} colorClass="bg-green-500" />}
                             {finalsMvp && <SmallMvpCard title="FINALS MVP" player={finalsMvp} colorClass="bg-blue-500" />}
                          </div>
                      </div>

                      {/* 3. AWARDS SECTION (With Toggle) */}
                      <div className="bg-white rounded-xl border shadow-sm p-5">
                          <div className="flex items-center justify-between mb-4">
                             <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                                 <span className="text-xl">🎖️</span> 시즌 어워드
                             </h3>
                             <div className="flex bg-gray-100 p-1 rounded-lg">
                                 <button 
                                    onClick={() => setViewMode('regular')}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition ${viewMode === 'regular' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                                 >
                                     정규 시즌
                                 </button>
                                 <button 
                                    onClick={() => setViewMode('playoff')}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition ${viewMode === 'playoff' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                                 >
                                     플레이오프
                                 </button>
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
                              {viewMode === 'regular' ? (
                                  regularAllPro ? (
                                    <>
                                        <AllProTeamRow title="1st All-Pro Team" players={regularAllPro[1]} />
                                        <AllProTeamRow title="2nd All-Pro Team" players={regularAllPro[2]} />
                                        <AllProTeamRow title="3rd All-Pro Team" players={regularAllPro[3]} />
                                    </>
                                  ) : <div className="text-center text-gray-400 py-4">정규 시즌 수상 내역이 없습니다.</div>
                              ) : (
                                  playoffAllPro ? (
                                    <>
                                        <AllProTeamRow title="Playoff 1st Team" players={playoffAllPro[1]} />
                                        <AllProTeamRow title="Playoff 2nd Team" players={playoffAllPro[2]} />
                                        <AllProTeamRow title="Playoff 3rd Team" players={playoffAllPro[3]} />
                                    </>
                                  ) : <div className="text-center text-gray-400 py-4">플레이오프 수상 내역이 없습니다.</div>
                              )}
                          </div>
                      </div>

                      {/* 4. FINAL STANDINGS (FULL LIST) */}
                      <div className="bg-white rounded-xl border shadow-sm p-5">
                          <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                              <span className="text-xl">🏅</span> 최종 순위
                          </h3>
                          <div className="overflow-x-auto">
                              <table className="w-full text-sm text-left">
                                  <thead className="bg-gray-50 text-gray-500 border-b">
                                      <tr>
                                          <th className="p-3 w-16 text-center">순위</th>
                                          <th className="p-3">팀</th>
                                          <th className="p-3 text-right">상금</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {record.finalStandings && Array.isArray(record.finalStandings) ? (
                                          record.finalStandings.map((item, idx) => (
                                              <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                                  <td className="p-3 text-center font-bold">
                                                      {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : item.rank}
                                                  </td>
                                                  <td className="p-3 font-bold flex items-center gap-2">
                                                      {item.team && (
                                                          <div className="w-6 h-6 rounded-full text-[10px] flex items-center justify-center text-white" 
                                                               style={{backgroundColor: item.team.colors?.primary || '#999'}}>
                                                              {item.team.name}
                                                          </div>
                                                      )}
                                                      {item.team?.fullName || 'Unknown'}
                                                  </td>
                                                  <td className="p-3 text-right font-medium text-gray-600">
                                                      {item.rank === 1 ? '0.5억' : item.rank === 2 ? '0.25억' : item.rank === 3 ? '0.2억' : '0.1억'}
                                                  </td>
                                              </tr>
                                          ))
                                      ) : (
                                          <tr><td colSpan="3" className="p-4 text-center text-gray-400">순위 데이터가 없습니다.</td></tr>
                                      )}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </>
              );
          })()
      )}
    </div>
  );
};

export default HistoryTab;