import React, { useState } from 'react';
import { FOREIGN_LEAGUES } from '../data/foreignLeagues';

const ForeignLeaguesTab = () => {
  const [activeRegion, setActiveRegion] = useState('LPL');
  const regions = Object.keys(FOREIGN_LEAGUES);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-gray-800">🌍 해외 리그 현황</h2>
        
        {/* Region Selector */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          {regions.map(region => (
            <button
              key={region}
              onClick={() => setActiveRegion(region)}
              className={`px-4 py-1.5 rounded-md font-bold text-sm transition ${
                activeRegion === region 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {region}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {FOREIGN_LEAGUES[activeRegion].map((team) => (
          <div key={team.id} className="p-4 rounded-lg border border-gray-100 bg-gray-50 flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600">
               {team.name}
             </div>
             <div>
               <div className="font-bold text-gray-800">{team.fullName}</div>
               <div className="text-xs text-gray-500">전력: {team.power}</div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ForeignLeaguesTab;