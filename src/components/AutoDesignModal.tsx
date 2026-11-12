import React, { useState } from 'react';
import { AutoDesignWizardInput, VenuePurpose } from '../types/audio';
import { Sparkles, Wand2, X } from 'lucide-react';

interface AutoDesignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunAutoDesign: (input: AutoDesignWizardInput) => void;
}

export const AutoDesignModal: React.FC<AutoDesignModalProps> = ({
  isOpen,
  onClose,
  onRunAutoDesign,
}) => {
  const [purpose, setPurpose] = useState<VenuePurpose>('auditorium');
  const [lengthMeters, setLengthMeters] = useState(18);
  const [widthMeters, setWidthMeters] = useState(12);
  const [heightMeters, setHeightMeters] = useState(4.5);
  const [wirelessMicCount, setWirelessMicCount] = useState(4);
  const [wiredMicCount, setWiredMicCount] = useState(2);
  const [bgmSourceCount, setBgmSourceCount] = useState(1);
  const [includeSubwoofer, setIncludeSubwoofer] = useState(true);
  const [systemTopology, setSystemTopology] = useState<'auto' | 'low_z' | 'high_z_100v'>('auto');
  const [useDanteNetwork, setUseDanteNetwork] = useState(false);
  const [budgetTier, setBudgetTier] = useState<'standard' | 'premium'>('standard');

  if (!isOpen) return null;

  const applyPreset = (p: VenuePurpose) => {
    setPurpose(p);
    if (p === 'auditorium') {
      setLengthMeters(20);
      setWidthMeters(14);
      setHeightMeters(5.0);
      setWirelessMicCount(4);
      setWiredMicCount(2);
      setIncludeSubwoofer(true);
      setSystemTopology('low_z');
    } else if (p === 'church') {
      setLengthMeters(18);
      setWidthMeters(12);
      setHeightMeters(5.5);
      setWirelessMicCount(4);
      setWiredMicCount(4);
      setIncludeSubwoofer(true);
      setSystemTopology('low_z');
      setBudgetTier('premium');
    } else if (p === 'conference') {
      setLengthMeters(12);
      setWidthMeters(8);
      setHeightMeters(3.2);
      setWirelessMicCount(2);
      setWiredMicCount(2);
      setIncludeSubwoofer(false);
      setSystemTopology('low_z');
    } else if (p === 'cafe_retail') {
      setLengthMeters(15);
      setWidthMeters(10);
      setHeightMeters(3.2);
      setWirelessMicCount(1);
      setWiredMicCount(0);
      setIncludeSubwoofer(false);
      setSystemTopology('high_z_100v');
    } else if (p === 'live_club') {
      setLengthMeters(24);
      setWidthMeters(15);
      setHeightMeters(6.0);
      setWirelessMicCount(4);
      setWiredMicCount(6);
      setIncludeSubwoofer(true);
      setSystemTopology('low_z');
      setUseDanteNetwork(true);
    } else if (p === 'classroom') {
      setLengthMeters(10);
      setWidthMeters(7.5);
      setHeightMeters(3.0);
      setWirelessMicCount(2);
      setWiredMicCount(1);
      setIncludeSubwoofer(false);
      setSystemTopology('low_z');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRunAutoDesign({
      purpose,
      lengthMeters,
      widthMeters,
      heightMeters,
      wirelessMicCount,
      wiredMicCount,
      bgmSourceCount,
      includeSubwoofer,
      systemTopology,
      useDanteNetwork,
      budgetTier,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-cyan-500/40 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">AI 자동설계</h2>
          </div>
          <button
            onClick={onClose}
            data-tooltip="닫기"
            data-tooltip-pos="bottom"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
          {/* Venue Purpose Selector */}
          <div className="space-y-2">
            <label className="font-bold text-cyan-300 block">
              1. 설치공간 용도 선택(클릭 시 표준 공간치수 프리셋 자동입력)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'auditorium', title: '강당/다목적홀', desc: '고출력 메인+딜레이/서브' },
                { id: 'church', title: '교회/예배당', desc: '컬럼어레이·정밀 지향제어' },
                { id: 'conference', title: '대회의실/세미나실', desc: '음성명료도(STI) 중심 설계' },
                { id: 'cafe_retail', title: '카페/상업매장', desc: '100V 하이임피던스 다중분산' },
                { id: 'live_club', title: '공연장/라이브홀', desc: '15" 메인+듀얼서브+Dante' },
                { id: 'classroom', title: '강의실/시청각실', desc: '컴팩트 8"~10" 스테레오 구성' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => applyPreset(item.id as VenuePurpose)}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    purpose === item.id
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold whitespace-nowrap">{item.title}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Room Dimensions */}
          <div className="space-y-2">
            <label className="font-bold text-cyan-300 block">
              2. 공간치수 입력(거리감쇠 및 필요 앰프출력 산출 기준)
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="space-y-1">
                <span className="text-slate-400 whitespace-nowrap block">무대~후방 깊이 L(m)</span>
                <input
                  type="number"
                  min={4}
                  max={100}
                  step="0.1"
                  value={lengthMeters}
                  onChange={(e) => setLengthMeters(Number(e.target.value))}
                  className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-1.5 font-mono text-sm text-cyan-300"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400 whitespace-nowrap block">좌~우 가로폭 W(m)</span>
                <input
                  type="number"
                  min={3}
                  max={80}
                  step="0.1"
                  value={widthMeters}
                  onChange={(e) => setWidthMeters(Number(e.target.value))}
                  className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-1.5 font-mono text-sm text-cyan-300"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400 whitespace-nowrap block">천장높이 H(m)</span>
                <input
                  type="number"
                  min={2.2}
                  max={25}
                  step="0.1"
                  value={heightMeters}
                  onChange={(e) => setHeightMeters(Number(e.target.value))}
                  className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-1.5 font-mono text-sm text-cyan-300"
                />
              </label>
            </div>
          </div>

          {/* Input Channels & System Topology */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <label className="space-y-1">
              <span className="text-slate-400 whitespace-nowrap block">필요 무선마이크 수(본)</span>
              <input
                type="number"
                min={0}
                max={16}
                value={wirelessMicCount}
                onChange={(e) => setWirelessMicCount(Number(e.target.value))}
                className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-1.5 font-mono text-slate-100"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-400 whitespace-nowrap block">필요 유선·구즈넥마이크(본)</span>
              <input
                type="number"
                min={0}
                max={16}
                value={wiredMicCount}
                onChange={(e) => setWiredMicCount(Number(e.target.value))}
                className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-1.5 font-mono text-slate-100"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-400 whitespace-nowrap block">미디어·PC 음원입력(조)</span>
              <input
                type="number"
                min={1}
                max={6}
                value={bgmSourceCount}
                onChange={(e) => setBgmSourceCount(Number(e.target.value))}
                className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-1.5 font-mono text-slate-100"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <label className="space-y-1">
              <span className="text-slate-400 whitespace-nowrap block">임피던스 매칭방식</span>
              <select
                value={systemTopology}
                onChange={(e) => setSystemTopology(e.target.value as typeof systemTopology)}
                className="w-full rounded bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-slate-200"
              >
                <option value="auto">공간 용도별 자동선택</option>
                <option value="low_z">프로오디오 저임피던스(4Ω/8Ω)</option>
                <option value="high_z_100v">상업·전관 고임피던스(100V)</option>
              </select>
            </label>

            <label className="flex items-center gap-2 pt-5 cursor-pointer text-slate-200 whitespace-nowrap">
              <input
                type="checkbox"
                checked={includeSubwoofer}
                onChange={(e) => setIncludeSubwoofer(e.target.checked)}
                className="accent-orange-500 w-4 h-4"
              />
              18" 서브우퍼 및 전용앰프 포함
            </label>

            <label className="flex items-center gap-2 pt-5 cursor-pointer text-slate-200 whitespace-nowrap">
              <input
                type="checkbox"
                checked={useDanteNetwork}
                onChange={(e) => setUseDanteNetwork(e.target.checked)}
                className="accent-purple-500 w-4 h-4"
              />
              Dante 네트워크 스위치 구성
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-2 shadow-lg shadow-cyan-500/25"
            >
              <Sparkles className="w-4 h-4" /> 최적 시스템 자동구성·결선·배치 실행
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
