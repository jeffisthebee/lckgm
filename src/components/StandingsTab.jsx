// src/components/StandingsTab.jsx
import React from 'react';
import { sortGroupByStandings } from '../engine/BracketManager';

const StandingsTab = ({ 
    league, 
    teams, 
    myTeam, 
    computedStandings, 
    setViewingTeamId, 
    hasDrafted, 
    baronTotalWins, 
    elderTotalWins 
}) => {
    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">🏆 2026 LCK 컵 순위표</h2>
            {hasDrafted ? (
                <div className="flex flex-col gap-3 sm:gap-4">
                    {/* Scoreboard - responsive text and padding */}
                    <div className="bg-gray-800 text-white rounded-lg p-3 sm:p-4 text-center font-bold text-sm sm:text-lg shadow-sm">
                        🔥 그룹 대항전 스코어: <span className="text-purple-400 text-lg sm:text-2xl mx-1 sm:mx-2">{baronTotalWins}</span> (Baron) vs <span className="text-red-400 text-lg sm:text-2xl mx-1 sm:mx-2">{elderTotalWins}</span> (Elder)
                    </div>
                    
                    {/* Grid - Stacks on portrait, side-by-side on wide screens (landscape phone/desktop) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        {[
                            { id: 'baron', name: 'Baron Group', color: 'purple' },
                            { id: 'elder', name: 'Elder Group', color: 'red' }
                        ].map(group => (
                            <div key={group.id} className="bg-white rounded-lg border shadow-sm overflow-hidden">
                                <div className={`p-3 sm:p-4 bg-${group.color}-50 border-b border-${group.color}-100 flex items-center gap-2`}>
                                    <h3 className={`font-black text-base sm:text-lg text-${group.color}-900`}>{group.name}</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs sm:text-sm">
                                        <thead className="bg-gray-50 text-gray-500 font-bold border-b">
                                            <tr>
                                                <th className="py-2 px-2 sm:py-3 sm:px-4 text-center whitespace-nowrap">순위</th>
                                                <th className="py-2 px-2 sm:py-3 sm:px-4 text-left w-full">팀</th>
                                                <th className="py-2 px-2 sm:py-3 sm:px-4 text-center whitespace-nowrap">승</th>
                                                <th className="py-2 px-2 sm:py-3 sm:px-4 text-center whitespace-nowrap">패</th>
                                                <th className="py-2 px-2 sm:py-3 sm:px-4 text-center whitespace-nowrap">득실</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {sortGroupByStandings(league.groups[group.id] || [], computedStandings).map((id, idx) => {
                                                const t = teams.find(team => team.id === id);
                                                const isMyTeam = myTeam.id === id;
                                                const rec = computedStandings[id] || { w: 0, l: 0, diff: 0 };

                                                let statusBadge = null;
                                                if (league.seasonSummary) {
                                                    const summary = league.seasonSummary;
                                                    const poInfo = summary.poTeams.find(pt => pt.id === id);
                                                    const piInfo = summary.playInTeams.find(pit => pit.id === id);

                                                    if (poInfo) statusBadge = <span className="block sm:inline text-[10px] sm:text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded sm:ml-2 mt-1 sm:mt-0 font-bold w-fit">PO {poInfo.seed}시드</span>;
                                                    else if (piInfo) statusBadge = <span className="block sm:inline text-[10px] sm:text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded sm:ml-2 mt-1 sm:mt-0 font-bold w-fit">PI {piInfo.seed}시드</span>;
                                                    else if (summary.eliminated === id) statusBadge = <span className="block sm:inline text-[10px] sm:text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded sm:ml-2 mt-1 sm:mt-0 font-bold w-fit">탈락</span>;
                                                }

                                                return (
                                                    <tr key={id} onClick={() => setViewingTeamId(id)} className={`cursor-pointer hover:bg-gray-50 transition ${isMyTeam ? `bg-${group.color}-50` : ''}`}>
                                                        <td className="py-2 px-2 sm:py-3 sm:px-4 text-center font-bold text-gray-600">{idx + 1}</td>
                                                        <td className="py-2 px-2 sm:py-3 sm:px-4 font-bold text-gray-800">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full text-white text-[10px] flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: t.colors.primary }}>{t.name}</div>
                                                                <span className="truncate">{t.fullName}</span>
                                                            </div>
                                                            {statusBadge}
                                                        </td>
                                                        <td className="py-2 px-2 sm:py-3 sm:px-4 text-center font-bold text-blue-600">{rec.w}</td>
                                                        <td className="py-2 px-2 sm:py-3 sm:px-4 text-center font-bold text-red-600">{rec.l}</td>
                                                        <td className="py-2 px-2 sm:py-3 sm:px-4 text-center text-gray-500">{rec.diff > 0 ? `+${rec.diff}` : rec.diff}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-lg border shadow-sm p-4 sm:p-8 text-center text-gray-500 text-sm sm:text-base">
                    아직 시즌이 시작되지 않았습니다. 조 추첨을 완료해주세요.
                </div>
            )}
        </div>
    );
};

export default StandingsTab;