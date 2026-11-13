import React, { useState } from 'react';
import {
  getSupabaseConfig,
  SavedProjectPayload,
  saveSupabaseConfig,
  SUPABASE_SCHEMA_SQL,
} from '../services/cloudStorage';
import { Cloud, Copy, Download, Upload, X } from 'lucide-react';

interface CloudSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject: SavedProjectPayload;
  onLoadProjectPayload: (payload: SavedProjectPayload) => void;
  onTriggerCloudSync: () => void;
  syncStatusMessage: string;
}

export const CloudSettingsModal: React.FC<CloudSettingsModalProps> = ({
  isOpen,
  onClose,
  currentProject,
  onLoadProjectPayload,
  onTriggerCloudSync,
  syncStatusMessage,
}) => {
  const initialCfg = getSupabaseConfig();
  const [url, setUrl] = useState(initialCfg.url);
  const [anonKey, setAnonKey] = useState(initialCfg.anonKey);
  const [enabled, setEnabled] = useState(initialCfg.enabled);

  if (!isOpen) return null;

  const handleSaveCloud = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig({ url: url.trim(), anonKey: anonKey.trim(), enabled });
    onTriggerCloudSync();
  };

  const handleDownloadProjectJson = () => {
    const blob = new Blob([JSON.stringify(currentProject, null, 2)], {
      type: 'application/json',
    });
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = dlUrl;
    a.download = `${currentProject.meta.projectName}_audiocad_project.json`;
    a.click();
    URL.revokeObjectURL(dlUrl);
  };

  const handleImportProjectJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as SavedProjectPayload;
        if (parsed.nodes && parsed.room) {
          onLoadProjectPayload(parsed);
          onClose();
        }
      } catch {
        alert('유효한 프로젝트 JSON 파일이 아닙니다.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#161C2B] shadow-2xl shadow-black/60 overflow-hidden break-keep flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] bg-[#111622] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-400/15 border border-sky-400/25 flex items-center justify-center shrink-0">
              <Cloud className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white break-keep tracking-tight">
                클라우드DB 동기화설정(Supabase) 및 프로젝트백업
              </h2>
              <p className="text-[11px] text-slate-400 break-keep mt-0.5">
                어디서든 인터넷으로 동일한 장비카탈로그와 설계도면을 불러오도록 클라우드DB를 연동합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 hover:text-white transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Project File Export/Import */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-slate-100 break-keep">프로젝트파일(.json) 즉시 백업·불러오기</div>
              <div className="text-[11px] text-slate-400 mt-1 break-keep">
                현재 결선다이어그램, 공간SPL 배치, 산출내역서 전체를 파일 하나로 저장하거나 다른 PC에서 불러옵니다.
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadProjectJson}
                className="px-3.5 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-sky-300 font-medium flex items-center gap-1.5 whitespace-nowrap transition"
              >
                <Download className="w-3.5 h-3.5" /> 프로젝트 저장
              </button>
              <label className="px-3.5 py-2 rounded-full bg-sky-400/15 hover:bg-sky-400/25 border border-sky-400/35 text-sky-200 font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition">
                <Upload className="w-3.5 h-3.5" /> 프로젝트 열기
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportProjectJson}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Supabase Cloud Connection Form */}
          <form onSubmit={handleSaveCloud} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sky-300 whitespace-nowrap">Supabase 클라우드DB 연동</span>
              <label className="flex items-center gap-2 cursor-pointer text-slate-200 whitespace-nowrap px-3 py-1 rounded-full bg-[#0B0F17] border border-white/[0.08]">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="accent-sky-400"
                />
                <span>클라우드 실시간동기화 사용</span>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <label className="space-y-1.5">
                <span className="text-[11px] text-slate-400 block">Supabase Project URL</span>
                <input
                  type="url"
                  placeholder="https://your-project-id.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-xl bg-[#0B0F17] border border-white/10 px-3.5 py-2 font-mono text-slate-100 focus:border-sky-400/70 focus:outline-none transition"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] text-slate-400 block">Supabase Public Anon Key</span>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  className="w-full rounded-xl bg-[#0B0F17] border border-white/10 px-3.5 py-2 font-mono text-slate-100 focus:border-sky-400/70 focus:outline-none transition"
                />
              </label>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
              <span className="text-[11px] font-mono text-emerald-400">{syncStatusMessage}</span>
              <button
                type="submit"
                className="px-4 py-2 rounded-full bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold whitespace-nowrap shadow-sm transition"
              >
                클라우드연동 저장·동기화
              </button>
            </div>
          </form>

          {/* SQL Table Creation Helper */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400 break-keep">
                Supabase 최초 연결 시 아래 SQL을 SQL Editor에 붙여넣어 실행하세요:
              </span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL)}
                className="px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-[11px] text-sky-300 flex items-center gap-1 whitespace-nowrap transition"
              >
                <Copy className="w-3 h-3" /> SQL 복사
              </button>
            </div>
            <pre className="rounded-xl bg-[#0B0F17] border border-white/[0.08] p-3 font-mono text-[10px] text-slate-400 max-h-36 overflow-y-auto">
              {SUPABASE_SCHEMA_SQL}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
