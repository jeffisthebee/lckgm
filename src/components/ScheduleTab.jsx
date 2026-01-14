// src/components/ScheduleTab.jsx
import React from 'react';

const ScheduleTab = ({ 
    activeTab, 
    league, 
    teams, 
    myTeam, 
    hasDrafted, 
    formatTeamName 
}) => {
    return (
        <div className="bg-white rounded-lg border shadow-sm p-8 min-h-[600px] flex flex-col">
            <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
                📅 {activeTab === 'team_schedule' ? `${myTeam.name} 경기 일정` : '2026 LCK 컵 전체 일정'}
            </h2>
            {hasDrafted ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
                    {league.matches
                        .filter(m => activeTab === 'schedule' || (m.t1 === myTeam.id || m.t2 === myTeam.id))
                        .map((m, i) => {
                            // Safe lookups
                            const t1 = m.t1 ? teams.find(t => t.id === m.t1) : { name: 'TBD' };
                            const t2 = m.t2 ? teams.find(t => t.id === m.t2) : { name: 'TBD' };
                            
                            // Check if it involves user's team
                            const isMyMatch = myTeam.id === m.t1 || myTeam.id === m.t2;
                            const isFinished = m.status === 'finished';
                            
                            // Use the passed formatting function
                            const t1Name = formatTeamName ? formatTeamName(m.t1, m.type) : t1.name;
                            const t2Name = formatTeamName ? formatTeamName(m.t2, m.type) : t2.name;

                            // Badge Color Logic
                            let badgeColor = 'text-gray-500';
                            let badgeText = '정규시즌';
                            if (m.type === 'super') { badgeColor = 'text-purple-600'; badgeText = '🔥 슈퍼위크'; }
                            else if (m.type === 'playin') { badgeColor = 'text-indigo-600'; badgeText = m.label || '플레이-인'; }
                            else if (m.type === 'playoff') { badgeColor = 'text-yellow-600'; badgeText = m.label || '플레이오프'; }

                            return (
                                <div key={i} className={`p-4 rounded-lg border flex flex-col gap-2 ${isMyMatch ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-white border-gray-200'}`}>
                                    <div className="flex justify-between text-xs font-bold text-gray-500">
                                        <span>{m.date} {m.time}</span>
                                        <span className={`font-bold ${badgeColor}`}>
                                            {badgeText}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <div className="flex flex-col items-center w-1/3">
                                            <span className={`font-bold ${isMyMatch && myTeam.id === m.t1 ? 'text-blue-600' : 'text-gray-800'}`}>{t1Name}</span>
                                            {isFinished && m.result.winner === t1.name && <span className="text-xs text-blue-500 font-bold">WIN</span>}
                                        </div>
                                        <div className="text-center font-bold">
                                            {isFinished ? (
                                                <span className="text-xl text-gray-800">{m.result.score}</span>
                                            ) : (
                                                <span className="text-gray-400">VS</span>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-center w-1/3">
                                            <span className={`font-bold ${isMyMatch && myTeam.id === m.t2 ? 'text-blue-600' : 'text-gray-800'}`}>{t2Name}</span>
                                            {isFinished && m.result.winner === t2.name && <span className="text-xs text-blue-500 font-bold">WIN</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <div className="text-4xl mb-4">🗳️</div>
                    <div className="text-xl font-bold">일정이 생성되지 않았습니다</div>
                    <p className="mt-2">먼저 조 추첨을 진행해주세요.</p>
                </div>
            )}
        </div>
    );
};

export default ScheduleTab;