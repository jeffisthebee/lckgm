// src/components/FinanceTab.jsx
import React from 'react';

const FinanceTab = ({ viewingTeam, finance, onPrevTeam, onNextTeam }) => {
    return (
        <div className="bg-white rounded-lg border shadow-sm flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                <div className="flex items-center gap-4">
                    <button onClick={onPrevTeam} className="p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition">◀</button>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-white shadow-lg text-lg" style={{backgroundColor: viewingTeam.colors.primary}}>
                            {viewingTeam.name}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900">{viewingTeam.fullName}</h2>
                            <p className="text-sm font-bold text-gray-500">재정 및 샐러리캡 현황</p>
                        </div>
                    </div>
                    <button onClick={onNextTeam} className="p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition">▶</button>
                </div>
            </div>

            <div className="p-8">
                <div className="grid grid-cols-2 gap-8 mb-8">
                    <div className="bg-gray-50 p-6 rounded-xl border">
                        <h3 className="text-lg font-bold text-gray-700 mb-4">💰 지출 현황 (단위: 억)</h3>
                        <div className="flex items-end gap-8 h-64">
                            {/* Total Spend */}
                            <div className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                                <span className="font-bold text-blue-600 text-xl">{finance.total_expenditure}억</span>
                                <div className="w-full bg-blue-500 rounded-t-lg transition-all duration-500" style={{height: `${Math.min(finance.total_expenditure / 1.5, 100)}%`}}></div>
                                <span className="font-bold text-gray-600 text-xs">총 지출</span>
                            </div>
                            {/* Cap Spend */}
                            <div className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                                <span className="font-bold text-purple-600 text-xl">{finance.cap_expenditure}억</span>
                                <div className="w-full bg-purple-500 rounded-t-lg transition-all duration-500" style={{height: `${Math.min(finance.cap_expenditure / 1.5, 100)}%`}}></div>
                                <span className="font-bold text-gray-600 text-xs">샐러리캡 반영</span>
                            </div>
                            
                            <div className="flex flex-col items-center gap-2 flex-1 h-full justify-end relative group">
                                {/* Markers */}
                                <div className="absolute w-full border-t-2 border-dashed border-red-600 z-10" style={{bottom: '66.6%'}}></div>
                                <div className="absolute right-0 text-[10px] text-red-700 font-bold bg-white px-1 border border-red-200 rounded -mb-3 z-20" style={{bottom: '66.6%'}}>100억 (3차)</div>

                                <div className="absolute w-full border-t-2 border-dashed border-orange-500 z-10" style={{bottom: '53.3%'}}></div>
                                <div className="absolute right-0 text-[10px] text-orange-600 font-bold bg-white px-1 border border-orange-200 rounded -mb-3 z-20" style={{bottom: '53.3%'}}>80억 (2차)</div>
                                
                                <div className="absolute w-full border-t-2 border-dashed border-green-600 z-10" style={{bottom: '26.6%'}}></div>
                                <div className="absolute right-0 text-[10px] text-green-700 font-bold bg-white px-1 border border-green-200 rounded -mb-3 z-20" style={{bottom: '26.6%'}}>40억 (1차)</div>

                                <div className="w-full bg-gray-200 rounded-t-lg relative overflow-hidden h-full opacity-50">
                                    <div className="absolute bottom-0 w-full bg-green-100 h-[26.6%]"></div>
                                    <div className="absolute bottom-[26.6%] w-full bg-orange-50 h-[26.7%]"></div>
                                    <div className="absolute bottom-[53.3%] w-full bg-red-50 h-[13.3%]"></div>
                                    <div className="absolute bottom-[66.6%] w-full bg-red-200 h-[33.4%]"></div>
                                </div>
                                <span className="font-bold text-gray-600 text-xs">규정 상한선</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 p-6 rounded-xl border flex flex-col justify-center items-center">
                        <h3 className="text-lg font-bold text-gray-700 mb-2">💸 사치세 (Luxury Tax)</h3>
                        <div className="text-5xl font-black text-red-600 my-4">{finance.luxury_tax > 0 ? `${finance.luxury_tax}억` : '없음'}</div>
                        <div className="text-sm text-gray-500 text-center">
                            {finance.luxury_tax > 0 ? (
                                finance.cap_expenditure >= 80 
                                ? <span>상한선(80억) 초과!<br/>기본 10억 + 초과분({(finance.cap_expenditure - 80).toFixed(1)}억)의 50% 부과</span>
                                : <span>균형 지출 구간(40~80억) 초과<br/>초과분({(finance.cap_expenditure - 40).toFixed(1)}억)의 25% 부과</span>
                            ) : (
                                <span className="text-green-600 font-bold">건전한 재정 상태입니다.</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinanceTab;