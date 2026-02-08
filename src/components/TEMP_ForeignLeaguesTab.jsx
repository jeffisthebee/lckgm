import React, { useState } from 'react';
import { FOREIGN_LEAGUES } from '../data/foreignLeagues';

// Hardcoded colors for the requested teams to avoid editing all JSON files
const TEAM_COLORS = {
  // LPL
  'BLG': '#E1689C', 'TES': '#D22F2F', 'AL': '#D83939', 'JDG': '#C52026', 
  'IG': '#000000', 'WBG': '#E60012', 'NIP': '#D4F13E', 'EDG': '#222222', 
  'WE': '#A21926', 'LGD': '#EE2327', 'UP': '#00A1E9', 'TT': '#00B0D8', 
  'LNG': '#005696', 'OMG': '#1A1A1A',
  // LEC
  'G2': '#000000', 'MKOI': '#EAB308', 'FNC': '#FF5900', 'KC': '#121F45', 
  'GX': '#292929', 'VIT': '#D0A85C', 'TH': '#C5A96A', 'SHFT': '#4A4A4A', 
  'SK': '#004C97', 'NAVI': '#FFF200', 'LR': '#888888', 'KCB': '#1F3F7A',
  // LCS
  'FLY': '#145A32', 'SEN': '#CE0037', 'SR': '#6CE5B8', 'C9': '#00AEEF', 
  'TL': '#0C2340', 'DSG': '#D9D9D9', 'DIG': '#FFC72C', 'LYON': '#C69C6D',
  // LCP
  'CFO': '#F05223', 'TSW': '#000000', 'GAM': '#FFD700', 'MVK': '#555555', 
  'DFM': '#58C4DD', 'SHG': '#FDB913', 'DCG': '#E60012', 'GZ': '#003366',
  // CBLOL
  'VKS': '#9B30FF', 'RED': '#FF0000', 'PAIN': '#000000', 'LOUD': '#00FF00', 
  'FUR': '#000000', 'LEV': '#4DA8D6', 'LOS': '#FF6600', 'FX': '#333333'
};

const ForeignLeaguesTab = () => {
  const regionKeys = Object.keys(FOREIGN_LEAGUES); // ['LPL', 'LEC', 'LCS', 'LCP', 'CBLOL']
  const [currentIndex, setCurrentIndex] = useState(0);

  const activeRegion = regionKeys[currentIndex];
  const currentTeams = FOREIGN_LEAGUES[activeRegion] || [];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % regionKeys.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + regionKeys.length) % regionKeys.length);
  };

  const getTeamColor = (name) => {
    return TEAM_COLORS[name] || '#9CA3AF'; // Default gray
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 flex flex-col h-full min-h-[500px]">
      
      {/* Header with Navigation */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl sm:text-2xl font-black text-gray-800 flex items-center gap-2">
          🌍 해외 리그 현황
        </h2>
        
        <div className="flex items-center gap-4 bg-gray-100 p-1.5 rounded-full shadow-inner">
          <button 
            onClick={handlePrev}
            className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-white rounded-full shadow-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition font-bold text-lg"
          >
            &lt;
          </button>
          
          <span className="font-black text-lg sm:text-xl text-gray-800 min-w-[80px] text-center tracking-tight">
            {activeRegion}
          </span>
          
          <button 
            onClick={handleNext}
            className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-white rounded-full shadow-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition font-bold text-lg"
          >
            &gt;
          </button>
        </div>
      </div>

      {/* Standings Table */}
      <div className="flex-1 overflow-hidden bg-gray-50 rounded-xl border border-gray-200">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-gray-100 text-gray-500 text-xs sm:text-sm uppercase tracking-wider border-b border-gray-200">
                        <th className="p-3 sm:p-4 text-center font-bold w-16">순위</th>
                        <th className="p-3 sm:p-4 font-bold">팀</th>
                        <th className="p-3 sm:p-4 text-center font-bold w-24">승패</th>
                        <th className="p-3 sm:p-4 text-center font-bold w-20 hidden sm:table-cell">승률</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                    {currentTeams.map((team, index) => (
                        <tr key={team.id} className="hover:bg-blue-50 transition-colors group">
                            <td className="p-3 sm:p-4 text-center font-bold text-gray-500 group-hover:text-blue-600">
                                {index + 1}
                            </td>
                            <td className="p-3 sm:p-4">
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <div 
                                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-[10px] sm:text-xs shadow-sm border border-gray-100"
                                        style={{ backgroundColor: getTeamColor(team.name) }}
                                    >
                                        {team.name}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-gray-800 text-sm sm:text-base truncate group-hover:text-blue-700">
                                            {team.fullName}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            전력 {team.power}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="p-3 sm:p-4 text-center font-bold text-gray-700 text-sm sm:text-base">
                                0 - 0
                            </td>
                            <td className="p-3 sm:p-4 text-center text-gray-400 text-sm hidden sm:table-cell">
                                0%
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        
        {currentTeams.length === 0 && (
            <div className="p-8 text-center text-gray-400 font-bold">
                등록된 팀 데이터가 없습니다.
            </div>
        )}
      </div>
    </div>
  );
};

export default ForeignLeaguesTab;