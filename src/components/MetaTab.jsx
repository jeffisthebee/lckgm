// src/components/MetaTab.jsx
import React from 'react';

const MetaTab = ({ league, championList, metaRole, setMetaRole }) => {
    // Safe fallback for the list
    const currentList = league.currentChampionList || championList;

    return (
        <div className="bg-white rounded-lg border shadow-sm p-4 sm:p-6 lg:p-8 min-h-[50vh] flex flex-col">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6 gap-4">
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
                    <span className="text-purple-600">📈</span> {league.metaVersion || '16.01'} 패치 메타
                </h2>
                {/* Role Selector - Scrollable on very small screens */}
                <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto no-scrollbar justify-center sm:justify-start">
                    {['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map(role => (
                        <button
                            key={role}
                            onClick={() => setMetaRole(role)}
                            className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-bold whitespace-nowrap transition ${metaRole === role ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {role}
                        </button>
                    ))}
                </div>
            </div>

            {/* Champion List */}
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
                {currentList
                    .filter(c => c.role === metaRole)
                    .sort((a, b) => a.tier - b.tier) // Sort by Tier (1 -> 5)
                    .map((champ, idx) => (
                        <div key={champ.id} className="border rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-gray-50 transition group gap-3 sm:gap-4">
                            
                            {/* Rank & Name */}
                            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-1/4">
                                <span className={`text-xl sm:text-2xl font-black w-8 sm:w-10 text-center flex-shrink-0 ${champ.tier === 1 ? 'text-yellow-500' : 'text-gray-300'}`}>{idx + 1}</span>
                                <div>
                                    <div className="font-bold text-base sm:text-lg text-gray-800">{champ.name}</div>
                                    <span className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded ${champ.tier === 1 ? 'bg-purple-100 text-purple-600' : champ.tier === 2 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                        {champ.tier} 티어
                                    </span>
                                </div>
                            </div>

                            {/* Stats Bars */}
                            <div className="w-full sm:flex-1 sm:px-4">
                                <div className="flex justify-between text-[10px] sm:text-xs text-gray-500 mb-1 font-medium">
                                    <span>초반 {champ.stats.early}</span>
                                    <span>중반 {champ.stats.mid}</span>
                                    <span>후반 {champ.stats.late}</span>
                                </div>
                                <div className="h-2 sm:h-2.5 bg-gray-100 rounded-full flex overflow-hidden w-full">
                                    <div className="bg-green-400 h-full" style={{ width: `${champ.stats.early * 10}%` }} />
                                    <div className="bg-yellow-400 h-full" style={{ width: `${champ.stats.mid * 10}%` }} />
                                    <div className="bg-red-400 h-full" style={{ width: `${champ.stats.late * 10}%` }} />
                                </div>
                            </div>

                            {/* Counters */}
                            <div className="w-full sm:w-1/3 text-left sm:text-right mt-1 sm:mt-0">
                                <div className="text-[10px] sm:text-xs font-bold text-gray-400 mb-0.5 uppercase tracking-wide">Counter Picks</div>
                                <div className="text-xs sm:text-sm font-medium text-gray-700 truncate">{champ.counters.join(', ')}</div>
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    );
};

export default MetaTab;