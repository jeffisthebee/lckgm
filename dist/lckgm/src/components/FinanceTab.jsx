// src/components/FinanceTab.jsx
import React from 'react';

const FinanceTab = ({ viewingTeam, finance, onPrevTeam, onNextTeam }) => {
    return (
        <div className="bg-white rounded-lg border shadow-sm flex flex-col h-full lg:h-auto overflow-y-auto">
            {/* Header Section */}
            <div className="p-3 lg:p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-lg shrink-0">
                <div className="flex items-center gap-2 lg:gap-4 w-full justify-between lg:justify-start">
                    <button 
                        onClick={onPrevTeam} 
                        className="p-2 lg:p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition active:scale-95"
                    >
                        ◀
                    </button>
                    
                    <div className="flex items-center gap-3 lg:gap-4">
                        <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-full flex items-center justify-center font-bold text-white shadow-lg text-xs lg:text-lg shrink-0" style={{backgroundColor: viewingTeam.colors.primary}}>
                            {viewingTeam.name}
                        </div>
                        <div>
                            <h2 className="text-lg lg:text-2xl font-black text-gray-900 leading-tight">{viewingTeam.fullName}</h2>
                            <p className="text-xs lg:text-sm font-bold text-gray-500">재정 및 샐러리캡 현황</p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={onNextTeam} 
                        className="p-2 lg:p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition active:scale-95"
                    >
                        ▶
                    </button>
                </div>
            </div>

            {/* Content Section */}
            <div className="p-3 lg:p-8 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8 mb-4 lg:mb-8">
                    
                    {/* 1. Expenditure Chart */}
                    <div className="bg-gray-50 p-4 lg:p-6 rounded-xl border">
                        <h3 className="text-sm lg:text-lg font-bold text-gray-700 mb-2 lg:mb-4">💰 지출 현황 (단위: 억)</h3>
                        
                        {/* Dynamic Height: Shorter on mobile (h-48), Taller on desktop (h-64) */}
                        <div className="flex items-end gap-4 lg:gap-8 h-48 lg:h-64">
                            
                            {/* Total Spend */}
                            <div className="flex flex-col items-center gap-1 lg:gap-2 flex-1 h-full justify-end">
                                <span className="font-bold text-blue-600 text-sm lg:text-xl">{finance.total_expenditure}억</span>
                                <div className="w-full bg-blue-500 rounded-t-lg transition-all duration-500" style={{height: `${Math.min(finance.total_expenditure / 1.5, 100)}%`}}></div>
                                <span className="font-bold text-gray-600 text-[10px] lg:text-xs whitespace-nowrap">총 지출</span>
                            </div>

                            {/* Cap Spend */}
                            <div className="flex flex-col items-center gap-1 lg:gap-2 flex-1 h-full justify-end">
                                <span className="font-bold text-purple-600 text-sm lg:text-xl">{finance.cap_expenditure}억</span>
                                <div className="w-full bg-purple-500 rounded-t-lg transition-all duration-500" style={{height: `${Math.min(finance.cap_expenditure / 1.5, 100)}%`}}></div>
                                <span className="font-bold text-gray-600 text-[10px] lg:text-xs whitespace-nowrap">샐러리캡</span>
                            </div>
                            
                            {/* Reference Bars */}
                            <div className="flex flex-col items-center gap-1 lg:gap-2 flex-1 h-full justify-end relative group">
                                {/* Markers */}
                                <div className="absolute w-full border-t-2 border-dashed border-red-600 z-10" style={{bottom: '66.6%'}}></div>
                                <div className="absolute right-0 text-[9px] lg:text-[10px] text-red-700 font-bold bg-white px-1 border border-red-200 rounded -mb-2 lg:-mb-3 z-20 whitespace-nowrap" style={{bottom: '66.6%'}}>100억</div>

                                <div className="absolute w-full border-t-2 border-dashed border-orange-500 z-10" style={{bottom: '53.3%'}}></div>
                                <div className="absolute right-0 text-[9px] lg:text-[10px] text-orange-600 font-bold bg-white px-1 border border-orange-200 rounded -mb-2 lg:-mb-3 z-20 whitespace-nowrap" style={{bottom: '53.3%'}}>80억</div>
                                
                                <div className="absolute w-full border-t-2 border-dashed border-green-600 z-10" style={{bottom: '26.6%'}}></div>
                                <div className="absolute right-0 text-[9px] lg:text-[10px] text-green-700 font-bold bg-white px-1 border border-green-200 rounded -mb-2 lg:-mb-3 z-20 whitespace-nowrap" style={{bottom: '26.6%'}}>40억</div>

                                {/* Background Ranges */}
                                <div className="w-full bg-gray-200 rounded-t-lg relative overflow-hidden h-full opacity-50">
                                    <div className="absolute bottom-0 w-full bg-green-100 h-[26.6%]"></div>
                                    <div className="absolute bottom-[26.6%] w-full bg-orange-50 h-[26.7%]"></div>
                                    <div className="absolute bottom-[53.3%] w-full bg-red-50 h-[13.3%]"></div>
                                    <div className="absolute bottom-[66.6%] w-full bg-red-200 h-[33.4%]"></div>
                                </div>
                                <span className="font-bold text-gray-600 text-[10px] lg:text-xs whitespace-nowrap">규정</span>
                            </div>
                        </div>
                    </div>

                    {/* 2. Luxury Tax Card */}
                    <div className="bg-gray-50 p-4 lg:p-6 rounded-xl border flex flex-col justify-center items-center h-auto min-h-[150px] lg:min-h-0">
                        <h3 className="text-sm lg:text-lg font-bold text-gray-700 mb-2">💸 사치세 (Luxury Tax)</h3>
                        <div className="text-3xl lg:text-5xl font-black text-red-600 my-2 lg:my-4">
                            {finance.luxury_tax > 0 ? `${finance.luxury_tax}억` : '없음'}
                        </div>
                        <div className="text-xs lg:text-sm text-gray-500 text-center leading-relaxed">
                            {finance.luxury_tax > 0 ? (
                                finance.cap_expenditure >= 80 
                                ? <span><strong className="text-red-600">상한선(80억) 초과!</strong><br/>기본 10억 + 초과분({(finance.cap_expenditure - 80).toFixed(1)}억)의 50%</span>
                                : <span><strong className="text-orange-600">균형 지출(40~80억) 초과</strong><br/>초과분({(finance.cap_expenditure - 40).toFixed(1)}억)의 25%</span>
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