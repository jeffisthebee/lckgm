// src/components/FinalStandingsModal.jsx
import React from 'react';
import { calculateFinalStandings } from '../engine/BracketManager';

const FinalStandingsModal = ({ league, onClose }) => {
    // Safety check
    if (!league) return null;

    try {
        const standings = calculateFinalStandings(league);
        
        return (
            <div className="absolute inset-0 z-[999] bg-black/90 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="bg-gray-900 p-4 sm:p-6 text-center relative flex-shrink-0">
                        <h2 className="text-xl sm:text-3xl font-black text-yellow-400">🏆 2026 LCK CUP FINAL</h2>
                        <button 
                            onClick={onClose}
                            className="absolute top-4 right-4 sm:top-6 sm:right-6 text-gray-400 hover:text-white font-bold text-sm sm:text-base"
                        >
                            ✕ 닫기
                        </button>
                    </div>

                    {/* Content - Scrollable */}
                    <div className="overflow-y-auto bg-white flex-1">
                        <table className="w-full text-left">
                            <thead className="bg-gray-100 border-b sticky top-0 z-10">
                                <tr>
                                    <th className="p-3 sm:p-4 text-center w-12 sm:w-20 text-xs sm:text-base font-bold text-gray-600">순위</th>
                                    <th className="p-3 sm:p-4 text-xs sm:text-base font-bold text-gray-600">팀</th>
                                    <th className="p-3 sm:p-4 text-right text-xs sm:text-base font-bold text-gray-600">상금 (확정)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {standings.length > 0 ? standings.map((item) => (
                                    <tr key={item.team.id} className={`${item.rank === 1 ? 'bg-yellow-50' : 'bg-white'}`}>
                                        <td className="p-2 sm:p-4 text-center">
                                            {item.rank === 1 ? <span className="text-xl sm:text-2xl">🥇</span> : 
                                             item.rank === 2 ? <span className="text-xl sm:text-2xl">🥈</span> : 
                                             item.rank === 3 ? <span className="text-xl sm:text-2xl">🥉</span> : 
                                             <span className="font-bold text-gray-500 text-sm sm:text-lg">{item.rank}위</span>}
                                        </td>
                                        <td className="p-2 sm:p-4 flex items-center gap-2 sm:gap-4">
                                            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-bold shadow-sm text-xs sm:text-lg flex-shrink-0" 
                                                 style={{backgroundColor: item.team.colors?.primary || '#333'}}>
                                                {item.team.name}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-black text-sm sm:text-xl text-gray-800 flex items-center gap-1 sm:gap-2 flex-wrap">
                                                    <span className="truncate">{item.team.fullName}</span>
                                                    {item.rank <= 2 && (
                                                        <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded shadow-sm animate-pulse whitespace-nowrap">
                                                            FST 진출
                                                        </span>
                                                    )}
                                                </div>
                                                {item.rank === 1 && <div className="text-[10px] sm:text-xs font-bold text-yellow-600 bg-yellow-100 inline-block px-1.5 py-0.5 rounded mt-0.5 sm:mt-1">CHAMPION</div>}
                                            </div>
                                        </td>
                                        <td className="p-2 sm:p-4 text-right font-bold text-gray-600 text-xs sm:text-base whitespace-nowrap">
                                            {item.rank === 1 ? '0.5억' : 
                                             item.rank === 2 ? '0.25억' : 
                                             item.rank === 3 ? '0.2억' : '0.1억'}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="3" className="p-8 text-center text-gray-500">순위 데이터 계산 중 오류가 발생했습니다.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="p-3 sm:p-4 bg-gray-50 text-center border-t flex-shrink-0">
                        <button onClick={onClose} className="px-6 sm:px-8 py-2 sm:py-3 bg-gray-800 text-white font-bold text-sm sm:text-base rounded-xl hover:bg-gray-700 shadow-lg transition transform hover:-translate-y-0.5 active:translate-y-0">
                            확인
                        </button>
                    </div>
                </div>
            </div>
        );
    } catch (err) {
        console.error(err);
        return null; 
    }
};

export default FinalStandingsModal;