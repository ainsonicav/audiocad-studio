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
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#161C2B] shadow-2xl shadow-black/60 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] bg-[#111622] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-400/15 border border-sky-400/25 flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">AI 자동설계</h2>
              <p className="text-[11px] text-slate-400">공간 용도와 치수에 맞춰 최적의 장비·결선·배치를 자동 구성합니다</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-tooltip="닫기"
            data-tooltip-pos="bottom"
            className="p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Venue Purpose Selector */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-sky-300 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-sky-400/15 text-sky-300 font-mono text-[11px] flex items-center justify-center">1</span>
              설치공간 용도 선택 (클릭 시 표준 공간치수 프리셋 자동입력)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
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
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    purpose === item.id
                      ? 'bg-sky-400/15 border-sky-400/60 text-white shadow-sm shadow-sky-500/10'
                      : 'bg-white/[0.02] border-white/[0.08] text-slate-300 hover:bg-white/[0.05] hover:border-white/15'
                  }`}
                >
                  <div className="font-semibold whitespace-nowrap">{item.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Room Dimensions */}
          <div className="space-y-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <label className="text-xs font-semibold text-sky-300 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-sky-400/15 text-sky-300 font-mono text-[11px] flex items-center justify-center">2</span>
              공간치수 입력 (거리감쇠 및 필요 앰프출력 산출 기준)
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="space-y-1.5">
                <span className="text-[11px] text-slate-400 whitespace-nowrap block">무대~후방 깊이 L(m)</span>
                <input
                  type="number"
                  min={4}
                  max={100}
                  step="0.1"
                  value={lengthMeters}
                  onChange={(e) => setLengthMeters(Number(e.target.value))}
                  className="w-full rounded-xl bg-[#0B0F17] border border-white/10 px-3 py-2 font-mono text-sm text-sky-300 focus:border-sky-400/70 focus:outline-none transition"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] text-slate-400 whitespace-nowrap block">좌~우 가로폭 W(m)</span>
                <input
                  type="number"
                  min={3}
                  max={80}
                  step="0.1"
                  value={widthMeters}
                  onChange={(e) => setWidthMeters(Number(e.target.value))}
                  className="w-full rounded-xl bg-[#0B0F17] border border-white/10 px-3 py-2 font-mono text-sm text-sky-300 focus:border-sky-400/70 focus:outline-none transition"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] text-slate-400 whitespace-nowrap block">천장높이 H(m)</span>
                <input
                  type="number"
                  min={2.2}
                  max={25}
                  step="0.1"
                  value={heightMeters}
                  onChange={(e) => setHeightMeters(Number(e.target.value))}
                  className="w-full rounded-xl bg-[#0B0F17] border border-white/10 px-3 py-2 font-mono text-sm text-sky-300 focus:border-sky-400/70 focus:outline-none transition"
                />
              </label>
            </div>
          </div>

          {/* Input Channels & System Topology */}
          <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <label className="space-y-1.5">
                <span className="text-[11px] text-slate-400 whitespace-nowrap block">필요 무선마이크 수(본)</span>
                <input
                  type="number"
                  min={0}
                  max={16}
                  value={wirelessMicCount}
                  onChange={(e) => setWirelessMicCount(Number(e.target.value))}
                  className="w-full rounded-xl bg-[#0B0F17] border border-white/10 px-3 py-2 font-mono text-slate-100 focus:border-sky-400/70 focus:outline-none transition"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] text-slate-400 whitespace-nowrap block">필요 유선·구즈넥마이크(본)</span>
                <input
                  type="number"
                  min={0}
                  max={16}
                  value={wiredMicCount}
                  onChange={(e) => setWiredMicCount(Number(e.target.value))}
                  className="w-full rounded-xl bg-[#0B0F17] border border-white/10 px-3 py-2 font-mono text-slate-100 focus:border-sky-400/70 focus:outline-none transition"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] text-slate-400 whitespace-nowrap block">미디어·PC 음원입력(조)</span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={bgmSourceCount}
                  onChange={(e) => setBgmSourceCount(Number(e.target.value))}
                  className="w-full rounded-xl bg-[#0B0F17] border border-white/10 px-3 py-2 font-mono text-slate-100 focus:border-sky-400/70 focus:outline-none transition"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 items-end">
              <label className="space-y-1.5">
                <span className="text-[11px] text-slate-400 whitespace-nowrap block">임피던스 매칭방식</span>
                <select
                  value={systemTopology}
                  onChange={(e) => setSystemTopology(e.target.value as typeof systemTopology)}
                  className="w-full rounded-xl bg-[#0B0F17] border border-white/10 px-3 py-2 text-slate-200 focus:border-sky-400/70 focus:outline-none transition"
                >
                  <option value="auto">공간 용도별 자동선택</option>
                  <option value="low_z">프로오디오 저임피던스(4Ω/8Ω)</option>
                  <option value="high_z_100v">상업·전관 고임피던스(100V)</option>
                </select>
              </label>

              <label className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#0B0F17] border border-white/[0.08] hover:border-white/15 cursor-pointer text-slate-200 whitespace-nowrap transition">
                <input
                  type="checkbox"
                  checked={includeSubwoofer}
                  onChange={(e) => setIncludeSubwoofer(e.target.checked)}
                  className="accent-orange-400 w-4 h-4 rounded"
                />
                <span className="text-xs">18" 서브우퍼 및 전용앰프</span>
              </label>

              <label className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#0B0F17] border border-white/[0.08] hover:border-white/15 cursor-pointer text-slate-200 whitespace-nowrap transition">
                <input
                  type="checkbox"
                  checked={useDanteNetwork}
                  onChange={(e) => setUseDanteNetwork(e.target.checked)}
                  className="accent-indigo-400 w-4 h-4 rounded"
                />
                <span className="text-xs">Dante 네트워크 스위치</span>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-slate-300 font-medium transition"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-full bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold flex items-center gap-2 shadow-lg shadow-sky-400/20 transition"
            >
              <Sparkles className="w-4 h-4" /> 최적 시스템 자동구성·결선·배치 실행
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
