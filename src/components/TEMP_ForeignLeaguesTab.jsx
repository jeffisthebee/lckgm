import React, { useState } from 'react';
import { FOREIGN_LEAGUES } from '../data/foreignLeagues';

// [NEW] Hardcoded colors for visual enhancement (You can eventually move this to JSON)
const TEAM_COLORS = {
  // LPL
  'BLG': '#e04e9c', 'TES': '#d32f2f', 'AL': '#ff5722', 'JDG': '#c62828', 
  'IG': '#000000', 'WBG': '#e040fb', 'NIP': '#fdd835', 'EDG': '#212121', 
  'WE': '#d50000', 'LGD': '#ef5350', 'UP': '#2962ff', 'TT': '#00b0ff', 
  'LNG': '#1565c0', 'OMG': '#5d4037',
  // LEC
  'G2': '#000000', 'FNC': '#ff9800', 'KC': '#1a237e', 'VIT': '#fbc02d',
  // LCS
  'C9': '#00b0ff', 'TL': '#1a237e', 'FLY': '#004d40',
  // Defaults
  'DEFAULT': '#607d8b'
};

const ForeignLeaguesTab = () => {
  const leagueKeys = ['LPL', 'LEC', 'LCS', 'LCP', 'CBLOL'];
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const activeRegion = leagueKeys[currentIndex];
  const teams = FOREIGN_LEAGUES[activeRegion] || [];

  // Navigation Handlers
  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + leagueKeys.length) % leagueKeys.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % leagueKeys.length);
  };

  // Helper to get color
  const getColor = (name) => TEAM_COLORS[name] || TEAM_COLORS['DEFAULT'];

  // [NEW] LPL Group Logic
  const getLPLGroups = (allTeams) => {
    const groups = {
      '등봉조': ['AL', 'BLG', 'WBG', 'JDG', 'TES', 'IG'],
      '인내조': ['NIP', 'WE', 'EDG', 'TT'],
      '열반조': ['LNG', 'OMG', 'LGD', 'UP']
    };

    const result = { '등봉조': [], '인내조': [], '열반조': [] };

    allTeams.forEach(t => {
      if (groups['등봉조'].includes(t.name)) result['등봉조'].push(t);
      else if (groups['인내조'].includes(t.name)) result['인내조'].push(t);
      else if (groups['열반조'].includes(t.name)) result['열반조'].push(t);
      else result['열반조'].push(t); // Fallback
    });

    return result;
  };

  // Render a Standings Table
  const renderTable = (teamList, title = null) => (
    <div className="mb-6">
      {title && (
        <div className="flex items-center gap-2 mb-2 px-2">
            <div className={`w-2 h-8 rounded ${
                title === '등봉조' ? 'bg-red-500' : 
                title === '인내조' ? 'bg-yellow-500' : 'bg-gray-500'
            }`}></div>
            <h3 className="text-lg font-bold text-gray-700">{title}</h3>
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-bold border-b">
                <tr>
                    <th className="p-3 text-center w-12">#</th>
                    <th className="p-3">팀</th>
                    <th className="p-3 text-center w-24">승패</th>
                    <th className="p-3 text-center w-20">득실</th>
                </tr>
            </thead>
            <tbody className="divide-y">
                {teamList.map((t, idx) => (
                    <tr key={t.id} className="hover:bg-gray-50 transition">
                        <td className="p-3 text-center font-bold text-gray-400">{idx + 1}</td>
                        <td className="p-3 flex items-center gap-3">
                            <div 
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm"
                                style={{backgroundColor: getColor(t.name)}}
                            >
                                {t.name}
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-gray-800">{t.fullName}</span>
                                <span className="text-[10px] text-gray-400">전력 {t.power}</span>
                            </div>
                        </td>
                        <td className="p-3 text-center font-bold text-gray-600">0승 0패</td>
                        <td className="p-3 text-center font-bold text-gray-400">0</td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-6">
      
      {/* Header with Navigation */}
      <div className="flex justify-between items-center mb-6">
        <button 
            onClick={handlePrev}
            className="w-10 h-10 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition shadow-sm font-bold text-gray-600"
        >
            &lt;
        </button>
        
        <div className="flex flex-col items-center">
            <h2 className="text-3xl font-black text-gray-800 tracking-tight">{activeRegion}</h2>
            <span className="text-xs font-bold text-gray-400 mt-1">SUMMER SPLIT</span>
        </div>

        <button 
            onClick={handleNext}
            className="w-10 h-10 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition shadow-sm font-bold text-gray-600"
        >
            &gt;
        </button>
      </div>

      {/* Content Area */}
      {activeRegion === 'LPL' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* LPL Special Grouping */}
            {(() => {
                const groups = getLPLGroups(teams);
                return (
                    <>
                        {renderTable(groups['등봉조'], '등봉조')}
                        {renderTable(groups['인내조'], '인내조')}
                        {renderTable(groups['열반조'], '열반조')}
                    </>
                );
            })()}
        </div>
      ) : (
        /* Standard Standings for other regions */
        renderTable(teams)
      )}

    </div>
  );
};

export default ForeignLeaguesTab;