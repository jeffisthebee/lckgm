// src/components/ScheduleTab.jsx
import React from 'react';

const ScheduleTab = ({ 
    activeTab, 
    league, 
    teams, 
    myTeam, 
    hasDrafted, 
    formatTeamName,
    onMatchClick 
}) => {
    return (
        <div className="bg-white rounded-lg border shadow-sm p-4 lg:p-8 min-h-[300px] lg:min-h-[600px] flex flex-col h-full lg:h-auto overflow-y-auto">
            <h2 className="text-lg lg:text-2xl font-black text-gray-900 mb-4 lg:mb-6 flex items-center gap-2 shrink-0">
                📅 {activeTab === 'team_schedule' ? `${myTeam.name} 경기 일정` : '2026 LCK 컵 전체 일정'}
            </h2>
            {hasDrafted ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 pb-4">
                    {league.matches
                        .filter(m => activeTab === 'schedule' || (m.t1 === myTeam.id || m.t2 === myTeam.id))
                        .map((m, i) => {
                            const t1 = m.t1 ? teams.find(t => t.id === m.t1) : { name: 'TBD' };
                            const t2 = m.t2 ? teams.find(t => t.id === m.t2) : { name: 'TBD' };
                            const isMyMatch = myTeam.id === m.t1 || myTeam.id === m.t2;
                            const isFinished = m.status === 'finished';
                            
                            const t1Name = formatTeamName ? formatTeamName(m.t1, m.type) : t1.name;
                            const t2Name = formatTeamName ? formatTeamName(m.t2, m.type) : t2.name;

                            let badgeColor = 'text-gray-500';
                            let badgeText = '정규시즌';
                            if (m.type === 'super') { badgeColor = 'text-purple-600'; badgeText = '🔥 슈퍼위크'; }
                            else if (m.type === 'playin') { badgeColor = 'text-indigo-600'; badgeText = m.label || '플레이-인'; }
                            else if (m.type === 'playoff') { badgeColor = 'text-yellow-600'; badgeText = m.label || '플레이오프'; }

                            return (
                                <div key={i} className={`p-3 lg:p-4 rounded-lg border flex flex-col gap-1 lg:gap-2 ${isMyMatch ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-white border-gray-200'}`}>
                                    <div className="flex justify-between text-[10px] lg:text-xs font-bold text-gray-500">
                                        <span>{m.date} {m.time}</span>
                                        <span className={`font-bold ${badgeColor}`}>
                                            {badgeText}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center mt-1 lg:mt-2">
                                        <div className="flex flex-col items-center w-1/3">
                                            <span className={`font-bold text-xs lg:text-base text-center break-keep leading-tight ${isMyMatch && myTeam.id === m.t1 ? 'text-blue-600' : 'text-gray-800'}`}>{t1Name}</span>
                                            {isFinished && m.result.winner === t1.name && <span className="text-[10px] lg:text-xs text-blue-500 font-bold mt-1">WIN</span>}
                                        </div>
                                        <div className="text-center font-bold flex flex-col items-center shrink-0 w-1/4">
                                        {isFinished ? (
                                            <div className="flex flex-col items-center">
                                                <span className="text-lg lg:text-xl text-gray-800">{m.result.score}</span>
                                                {/* VIEW DETAILS BUTTON */}
                                                <button 
                                                    onClick={() => onMatchClick && onMatchClick(m)}
                                                    className="mt-1 text-[9px] lg:text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300 px-1.5 lg:px-2 py-0.5 rounded transition flex items-center gap-1 whitespace-nowrap"
                                                >
                                                    <span>📊</span> <span className="hidden sm:inline">상세보기</span><span className="sm:hidden">기록</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 text-sm lg:text-base">VS</span>
                                        )}
                                        </div>
                                        <div className="flex flex-col items-center w-1/3">
                                            <span className={`font-bold text-xs lg:text-base text-center break-keep leading-tight ${isMyMatch && myTeam.id === m.t2 ? 'text-blue-600' : 'text-gray-800'}`}>{t2Name}</span>
                                            {isFinished && m.result.winner === t2.name && <span className="text-[10px] lg:text-xs text-blue-500 font-bold mt-1">WIN</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10">
                    <div className="text-2xl lg:text-4xl mb-2 lg:mb-4">🗳️</div>
                    <div className="text-lg lg:text-xl font-bold">일정이 생성되지 않았습니다</div>
                    <p className="mt-1 lg:mt-2 text-xs lg:text-base">먼저 조 추첨을 진행해주세요.</p>
                </div>
            )}
        </div>
    );
};

export default ScheduleTab;