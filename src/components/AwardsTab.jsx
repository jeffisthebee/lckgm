import React, { useMemo } from 'react';
import { computeAwards } from '../engine/statsManager';

const RoleBadge = ({ role }) => {
    const colors = {
        TOP: 'bg-red-100 text-red-700',
        JGL: 'bg-green-100 text-green-700',
        MID: 'bg-purple-100 text-purple-700',
        ADC: 'bg-blue-100 text-blue-700',
        SUP: 'bg-yellow-100 text-yellow-700'
    };
    return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors[role] || 'bg-gray-100'}`}>{role}</span>;
};

const PlayerCard = ({ player, rank, teamColor }) => {
    if (!player) return <div className="h-full bg-gray-50 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">N/A</div>;
    
    // Rank Styles
    const rankStyles = {
        1: 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-white ring-1 ring-yellow-200',
        2: 'border-gray-300 bg-gradient-to-br from-gray-50 to-white',
        3: 'border-orange-200 bg-gradient-to-br from-orange-50 to-white'
    };

    const medal = { 1: '🥇', 2: '🥈', 3: '🥉' };

    return (
        <div className={`relative p-3 rounded-xl border shadow-sm flex flex-col items-center gap-2 ${rankStyles[rank]}`}>
            <div className="absolute top-2 left-2 text-lg">{medal[rank]}</div>
            
            {/* Team Logo / Color */}
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md mt-1" 
                 style={{ backgroundColor: player.teamObj?.colors?.primary || '#333' }}>
                {player.teamObj?.name || 'FA'}
            </div>

            <div className="text-center">
                <div className="font-black text-gray-800 text-sm">{player.playerName}</div>
                <div className="text-[10px] text-gray-500 font-medium">Score: {player.finalScore.toFixed(1)}</div>
            </div>

            {/* Breakdown Tooltip (Hover logic can be added, simple display for now) */}
            <div className="w-full grid grid-cols-3 gap-1 text-[8px] text-center text-gray-400 mt-1 border-t pt-1">
                <div>
                    <span className="block font-bold text-gray-600">{player.pogCount * 10}</span>
                    POG
                </div>
                <div>
                    <span className="block font-bold text-gray-600">{player.rankPoints}</span>
                    Team
                </div>
                <div>
                    <span className="block font-bold text-gray-600">{player.avgScore.toFixed(0)}</span>
                    Stat
                </div>
            </div>
        </div>
    );
};

export default function AwardsTab({ league, teams }) {
    // Recalculate only when tab opens or league changes
    const { seasonMvp, allProTeams } = useMemo(() => computeAwards(league, teams), [league, teams]);
    
    // Helper to find team object for MVP
    const mvpTeam = seasonMvp ? teams.find(t => seasonMvp.teams.includes(t.name)) : null;

    return (
        <div className="space-y-8 p-2 lg:p-4">
            {/* Header */}
            <div className="text-center mb-8">
                <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">2026 Season Awards</h2>
                <p className="text-gray-500 text-sm">Based on POG Points & Comprehensive Performance Metrics</p>
            </div>

            {/* MVP Section */}
            <div className="flex justify-center mb-12">
                <div className="relative bg-gradient-to-b from-gray-900 to-black text-white p-8 rounded-2xl shadow-2xl border-2 border-yellow-500 max-w-md w-full text-center overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.8)]"></div>
                    <div className="absolute -right-10 -top-10 text-9xl opacity-10 rotate-12 select-none">🏆</div>
                    
                    <div className="uppercase text-yellow-500 font-bold tracking-[0.3em] text-xs mb-2">Regular Season MVP</div>
                    
                    {seasonMvp ? (
                        <>
                            <div className="w-24 h-24 mx-auto bg-gray-800 rounded-full border-4 border-yellow-500 flex items-center justify-center text-2xl font-black shadow-lg mb-4 relative z-10"
                                 style={{backgroundColor: mvpTeam?.colors?.primary}}>
                                {mvpTeam?.name}
                            </div>
                            <h1 className="text-4xl font-black mb-1">{seasonMvp.playerName}</h1>
                            <div className="text-gray-400 font-bold text-sm mb-6">{mvpTeam?.fullName}</div>
                            
                            <div className="flex justify-center gap-8 text-center">
                                <div>
                                    <div className="text-3xl font-black text-white">{seasonMvp.pogs}</div>
                                    <div className="text-[10px] text-gray-500 uppercase font-bold">POG Points</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-black text-white">{seasonMvp.lastScore ? seasonMvp.lastScore.toFixed(1) : '-'}</div>
                                    <div className="text-[10px] text-gray-500 uppercase font-bold">Last Rating</div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="py-10 text-gray-500">Not enough data yet</div>
                    )}
                </div>
            </div>

            {/* All-Pro Teams Grid */}
            <div>
                <h3 className="text-xl font-black text-gray-800 mb-4 flex items-center gap-2">
                    <span className="text-yellow-600">★</span> All-LCK Pro Teams
                </h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
                    {/* Column Headers (Roles) */}
                    <div className="hidden lg:flex flex-col gap-4 pt-12">
                        <div className="h-full flex items-center justify-center font-black text-yellow-600 bg-yellow-50 rounded-lg border border-yellow-200">1st Team</div>
                        <div className="h-full flex items-center justify-center font-bold text-gray-600 bg-gray-50 rounded-lg border border-gray-200">2nd Team</div>
                        <div className="h-full flex items-center justify-center font-bold text-orange-700 bg-orange-50 rounded-lg border border-orange-200">3rd Team</div>
                    </div>

                    {/* Roles Columns */}
                    {['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map(role => (
                        <div key={role} className="flex flex-col gap-4">
                            <div className="text-center font-black text-gray-400 text-sm uppercase mb-1">{role}</div>
                            
                            {/* 1st Team Player */}
                            <PlayerCard player={allProTeams[1][role]} rank={1} />
                            
                            {/* 2nd Team Player */}
                            <PlayerCard player={allProTeams[2][role]} rank={2} />
                            
                            {/* 3rd Team Player */}
                            <PlayerCard player={allProTeams[3][role]} rank={3} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}