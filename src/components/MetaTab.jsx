// src/components/MetaTab.jsx
import React from 'react';

const MetaTab = ({ league, championList, metaRole, setMetaRole }) => {
    // Safe fallback for the list
    const currentList = league.currentChampionList || championList;

    return (
        <div className="bg-white rounded-lg border shadow-sm p-8 min-h-[600px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                    <span className="text-purple-600">📈</span> {league.metaVersion || '16.01'} 패치 메타
                </h2>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    {['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map(role => (
                        <button
                            key={role}
                            onClick={() => setMetaRole(role)}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition ${metaRole === role ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {role}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {currentList
                    .filter(c => c.role === metaRole)
                    .sort((a, b) => a.tier - b.tier) // Sort by Tier (1 -> 5)
                    .map((champ, idx) => (
                        <div key={champ.id} className="border rounded-xl p-4 flex items-center justify-between hover:bg-gray-50 transition group">
                            <div className="flex items-center gap-4 w-1/4">
                                <span className={`text-2xl font-black w-10 text-center ${champ.tier === 1 ? 'text-yellow-500' : 'text-gray-300'}`}>{idx + 1}</span>
                                <div>
                                    <div className="font-bold text-lg text-gray-800">{champ.name}</div>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${champ.tier === 1 ? 'bg-purple-100 text-purple-600' : champ.tier === 2 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                        {champ.tier} 티어
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1 px-8">
                                <div className="flex justify-between text-xs text-gray-500 mb-1 font-medium">
                                    <span>초반 {champ.stats.early}</span>
                                    <span>중반 {champ.stats.mid}</span>
                                    <span>후반 {champ.stats.late}</span>
                                </div>
                                <div className="h-2.5 bg-gray-100 rounded-full flex overflow-hidden">
                                    <div className="bg-green-400 h-full" style={{ width: `${champ.stats.early * 10}%` }} />
                                    <div className="bg-yellow-400 h-full" style={{ width: `${champ.stats.mid * 10}%` }} />
                                    <div className="bg-red-400 h-full" style={{ width: `${champ.stats.late * 10}%` }} />
                                </div>
                            </div>

                            <div className="w-1/3 text-right">
                                <div className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-wide">Counter Picks</div>
                                <div className="text-sm font-medium text-gray-700">{champ.counters.join(', ')}</div>
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    );
};

export default MetaTab;