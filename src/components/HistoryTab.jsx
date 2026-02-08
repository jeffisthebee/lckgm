import React, { useState } from 'react';
import { teams } from '../data/teams';
import playerList from '../data/players.json';

// --- Helper Components ---

// 1. Badge Helper
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

// 2. All-Pro Team Row (Fixed to prevent crashes)
const AllProTeamRow = ({ title, players = [] }) => (
    <div className="mb-4">
        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 border-b pb-1">{title}</h4>
        <div className="grid grid-cols-5 gap-2">
            {['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map(role => {
                // Safe check: players might be undefined, defaulted to [] above
                const p = players && Array.isArray(players) ? players.find(x => x && x.role === role) : null;
                
                if (!p) return (
                    <div key={role} className="bg-gray-50 rounded p-2 text-center text-xs text-gray-400 flex flex-col items-center justify-center min-h-[80px]">
                        <RoleBadge role={role} />
                        <span className="mt-1">-</span>
                    </div>
                );
                
                const teamObj = teams.find(t => t.name === p.team);
                return (
                    <div key={role} className="bg-white border rounded-lg p-2 flex flex-col items-center shadow-sm">
                        <RoleBadge role={role} />
                        <div className="font-bold text-gray-800 text-xs mt-1 truncate w-full text-center">{p.name}</div>
                        <div className="text-[10px] text-gray-500 font-bold flex items-center gap-1 mt-1">
                             <div className="w-3 h-3 rounded-full border border-gray-200" style={{backgroundColor: teamObj?.colors?.primary || '#333'}}></div>
                             {p.team}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

const HistoryTab = ({ league }) => {
  // 1. Safe Access to History
  const history = league?.history || [];
  const [currentIndex, setCurrentIndex] = useState(history.length > 0 ? history.length - 1 : 0);

  // If no history exists
  if (history.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-[500px] text-gray-400">
              <div className="text-4xl mb-4">📜</div>
              <div className="font-bold text-lg">아직 기록된 시즌 역사가 없습니다.</div>
              <p className="text-sm">시즌이 종료되면 상단의 [💾 시즌 기록 저장] 버튼을 눌러주세요.</p>
          </div>
      );
  }

  const record = history[currentIndex];

  // Crash Prevention: If record is undefined for some reason
  if (!record) return <div>Data Error</div>;

  // Navigation Handlers
  const handlePrev = () => setCurrentIndex(prev => (prev - 1 + history.length) % history.length);
  const handleNext = () => setCurrentIndex(prev => (prev + 1) % history.length);

  // Helper to safely get color
  const championColor = record.champion?.colors?.primary || record.champion?.color || '#333';

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10">
      
      {/* 1. HEADER & NAVIGATION */}
      <div className="bg-gray-900 text-white rounded-xl p-6 flex items-center justify-between shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          
          <button onClick={handlePrev} className="z-10 w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center font-bold text-xl transition">
              &lt;
          </button>
          
          <div className="z-10 text-center">
              <h2 className="text-3xl lg:text-4xl font-black tracking-tighter text-yellow-400 drop-shadow-md">
                  {record.year} {record.seasonName}
              </h2>
              <div className="text-gray-400 font-bold text-sm mt-1 uppercase tracking-widest">Season Archive</div>
          </div>

          <button onClick={handleNext} className="z-10 w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center font-bold text-xl transition">
              &gt;
          </button>
      </div>

      {/* 2. CHAMPION & MVP SHOWCASE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Champion Card */}
          <div className="lg:col-span-2 bg-gradient-to-br from-yellow-50 to-white border border-yellow-200 rounded-xl p-6 shadow-sm flex items-center gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl">🏆</div>
              <div className="w-24 h-24 lg:w-32 lg:h-32 rounded-full shadow-lg flex items-center justify-center text-white font-black text-2xl lg:text-4xl border-4 border-yellow-400 z-10"
                   style={{backgroundColor: championColor}}>
                  {record.champion?.name || 'TBD'}
              </div>
              <div className="z-10">
                  <div className="text-yellow-600 font-bold text-sm uppercase tracking-wide mb-1">Season Champion</div>
                  <div className="text-3xl lg:text-5xl font-black text-gray-900">{record.champion?.fullName || 'Unknown Team'}</div>
                  <div className="text-gray-500 font-bold mt-2">
                      우승 상금: <span className="text-gray-800">0.5억</span>
                  </div>
              </div>
          </div>

          {/* MVP Card */}
          <div className="bg-white border rounded-xl p-4 shadow-sm flex flex-col justify-center relative overflow-hidden">
             <div className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-bl-lg">SEASON MVP</div>
             {record.awards?.mvp ? (
                 <div className="flex items-center gap-4 mt-2">
                     <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-2xl border-2 border-red-100">
                         🧑‍🚀
                     </div>
                     <div>
                         <div className="text-2xl font-black text-gray-800">{record.awards.mvp.name}</div>
                         <div className="text-sm text-gray-500 font-bold">{record.awards.mvp.team} · {record.awards.mvp.role}</div>
                         <div className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded inline-block mt-1 font-bold">
                             POG {record.awards.mvp.points || 0} pts
                         </div>
                     </div>
                 </div>
             ) : (
                 <div className="text-center text-gray-400 font-bold py-4">MVP 데이터 없음</div>
             )}
          </div>
      </div>

      {/* 3. FINAL STANDINGS (Top 4) */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
          <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-xl">🏅</span> 최종 순위 (Top 4)
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
                          record.finalStandings.slice(0, 4).map((item, idx) => (
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

      {/* 4. AWARDS GRID (All-Pro) */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
          <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-xl">🎖️</span> 시즌 어워드 (All-Pro Teams)
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
              {record.awards?.allPro ? (
                  <>
                    <AllProTeamRow title="1st All-Pro Team" players={record.awards.allPro[1]} />
                    <AllProTeamRow title="2nd All-Pro Team" players={record.awards.allPro[2]} />
                    <AllProTeamRow title="3rd All-Pro Team" players={record.awards.allPro[3]} />
                  </>
              ) : (
                  <div className="text-center text-gray-400 font-bold py-10 bg-gray-50 rounded">
                      수상 데이터가 없습니다.
                  </div>
              )}
          </div>
      </div>

      {/* 5. GROUP STANDINGS SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {['baron', 'elder'].map(groupKey => (
              <div key={groupKey} className="bg-white rounded-xl border shadow-sm p-4">
                  <h4 className={`text-sm font-black uppercase mb-3 pb-2 border-b flex justify-between ${groupKey === 'baron' ? 'text-purple-600 border-purple-100' : 'text-red-600 border-red-100'}`}>
                      {groupKey} Group
                  </h4>
                  <table className="w-full text-xs">
                      <thead className="text-gray-400 bg-gray-50">
                          <tr>
                              <th className="p-2 text-left">팀</th>
                              <th className="p-2 text-center">W-L</th>
                              <th className="p-2 text-center">득실</th>
                          </tr>
                      </thead>
                      <tbody>
                          {record.groupStandings?.[groupKey] ? (
                              record.groupStandings[groupKey].map((row, idx) => (
                                  <tr key={idx} className="border-b last:border-0">
                                      <td className="p-2 font-bold text-gray-700 flex items-center gap-2">
                                          <span className="text-gray-400 w-3">{idx + 1}</span>
                                          {row.teamName}
                                      </td>
                                      <td className="p-2 text-center font-bold">{row.w}-{row.l}</td>
                                      <td className="p-2 text-center text-gray-500">{row.diff}</td>
                                  </tr>
                              ))
                          ) : (
                              <tr><td colSpan="3" className="p-4 text-center text-gray-400">기록 없음</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          ))}
      </div>

    </div>
  );
};

export default HistoryTab;