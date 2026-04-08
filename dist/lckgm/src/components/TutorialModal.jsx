import React, { useState } from 'react';

const tutorialSteps = [
  {
    title: "LCK 매니저 2026",
    content: "2026년 LCK의 단장이 되어 팀을 이끄는 시뮬레이션 게임입니다. 여러분의 선택이 팀의 운명을 결정합니다.",
    icon: "👋"
  },
  {
    title: "새로운 시즌 시작",
    content: "'+ 새로운 시즌 시작하기' 버튼을 눌러 게임을 시작하세요. 원하는 팀을 선택하고 난이도를 설정할 수 있습니다.",
    icon: "🏆"
  },
  {
    title: "드래프트 시스템",
    content: "시즌은 '바론'과 '장로' 그룹으로 나뉩니다. 젠지와 한화생명을 제외한 팀들은 드래프트를 통해 그룹이 결정됩니다.",
    icon: "🎲"
  },
  {
    title: "밴픽과 전략 (수동 모드)",
    content: "수동 모드에선 정교한 밴픽 순서(블루 1픽 등), 챔피언 티어, 그리고 조합 시너지가 승패를 가릅니다. 당신의 전략으로 전력 차이를 극복하세요.",
    icon: "⚔️"
  },
  {
    title: "재정과 상금",
    content: "구단 운영의 핵심은 자금입니다. 높은 순위를 기록해 상금을 획득하고, 이를 통해 선수단과 팀을 유지해야 합니다. 파산에 주의하세요!",
    icon: "💰"
  }
];

export default function TutorialModal({ onClose, onDoNotShowAgain }) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onClose(); 
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const step = tutorialSteps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      {/* max-h-[85vh] ensures it fits on landscape phones, flex-col for layout */}
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full flex flex-col max-h-[85vh] animate-fade-in-up overflow-hidden">
        
        {/* Header - Fixed */}
        <div className="bg-blue-600 p-4 sm:p-5 text-white flex justify-between items-center shrink-0">
          <h2 className="text-lg sm:text-xl font-black">가이드 ({currentStep + 1}/{tutorialSteps.length})</h2>
          <button onClick={onClose} className="text-blue-200 hover:text-white font-bold px-2">✕</button>
        </div>

        {/* Body - Scrollable (Critical for horizontal mode) */}
        <div className="p-6 sm:p-8 flex flex-col items-center text-center flex-1 overflow-y-auto">
          <div className="text-5xl sm:text-6xl mb-4 sm:mb-6 bg-blue-50 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center shadow-inner shrink-0">
            {step.icon}
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3">{step.title}</h3>
          <p className="text-gray-600 leading-relaxed word-keep-all text-sm sm:text-base">
            {step.content}
          </p>
        </div>

        {/* Footer - Fixed */}
        <div className="p-4 border-t bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          
          {/* The "Don't show again" button */}
          <button 
            onClick={onDoNotShowAgain} 
            className="text-xs text-gray-400 underline hover:text-gray-600 order-2 sm:order-1"
          >
            일단 꺼놓기 (다시 보지 않음)
          </button>

          <div className="flex gap-2 w-full sm:w-auto justify-end order-1 sm:order-2">
            <button 
              onClick={handlePrev} 
              disabled={currentStep === 0}
              className={`px-3 py-2 rounded-lg font-bold text-sm transition ${currentStep === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200'}`}
            >
              이전
            </button>

            <button 
              onClick={handleNext} 
              className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 shadow-md transition transform active:scale-95"
            >
              {currentStep === tutorialSteps.length - 1 ? "시작하기" : "다음"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}