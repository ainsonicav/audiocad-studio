import React, { useEffect, useRef, useState } from 'react';
import {
  AmpChannelLoadAnalysis,
  AudioProduct,
  CableConnection,
  ProjectMeta,
  RoomConfig,
  SpeakerPlacement,
  SPLSimulationSummary,
  SystemNode,
} from '../types/audio';
import {
  buildOrthogonalCablePath,
  CABLE_TYPE_LEGEND,
  calculatePointSplAt3D,
  estimateNodeRenderedHeight,
  getCableVisualStyle,
  getPortPinColor,
  routeAllCablesWithJumpOvers,
} from '../engine/audioPhysics';
import { splToRgba } from './AcousticRoomSimulator';
import { DeviceSvgArtwork } from './DeviceSvgArtwork';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  RefreshCw,
  Sliders,
} from 'lucide-react';

interface BomAndCadReportViewProps {
  meta: ProjectMeta;
  room: RoomConfig;
  catalog: AudioProduct[];
  catalogMap: Map<string, AudioProduct>;
  nodes: SystemNode[];
  connections: CableConnection[];
  placements: SpeakerPlacement[];
  ampLoads: AmpChannelLoadAnalysis[];
  splSummary: SPLSimulationSummary;
  onUpdateMeta: (patch: Partial<ProjectMeta>) => void;
  onSwapProductEverywhere: (oldProductId: string, newProductId: string) => void;
}

interface AggregatedBomItem {
  product: AudioProduct;
  quantity: number;
  nodeLabels: string[];
  subtotalKrw: number;
}

export const BomAndCadReportView: React.FC<BomAndCadReportViewProps> = ({
  meta,
  room,
  catalog,
  catalogMap,
  nodes,
  connections,
  placements,
  ampLoads,
  splSummary,
  onUpdateMeta,
  onSwapProductEverywhere,
}) => {
  const reportSplCanvasRef = useRef<HTMLCanvasElement>(null);
  const [showMetaEditor, setShowMetaEditor] = useState(false);

  // Aggregate BOM items from active SystemNodes
  const bomMap = new Map<string, AggregatedBomItem>();
  for (const node of nodes) {
    const prod = catalogMap.get(node.productId);
    if (!prod) continue;
    const existing = bomMap.get(prod.id);
    if (existing) {
      existing.quantity += 1;
      existing.nodeLabels.push(node.customLabel);
      existing.subtotalKrw = existing.quantity * prod.unitPriceKrw;
    } else {
      bomMap.set(prod.id, {
        product: prod,
        quantity: 1,
        nodeLabels: [node.customLabel],
        subtotalKrw: prod.unitPriceKrw,
      });
    }
  }
  const bomItems = Array.from(bomMap.values());

  // Automatically calculate cables & connectors summary from CableConnections
  const signalCables = connections.filter((c) => c.cableCategory === 'signal');
  const speakerCables = connections.filter((c) => c.cableCategory === 'speaker');
  const networkCables = connections.filter((c) => c.cableCategory === 'network');

  const totalSignalMeters = signalCables.reduce((acc, c) => acc + c.estimatedLengthMeters, 0);
  const totalSpeakerMeters = speakerCables.reduce((acc, c) => acc + c.estimatedLengthMeters, 0);
  const totalNetworkMeters = networkCables.reduce((acc, c) => acc + c.estimatedLengthMeters, 0);

  const cableCostKrw =
    totalSignalMeters * 3500 +
    totalSpeakerMeters * 5500 +
    totalNetworkMeters * 2800 +
    connections.length * 12000;

  const equipmentSubtotalKrw = bomItems.reduce((acc, item) => acc + item.subtotalKrw, 0);
  const installationFeeKrw = Math.round(
    (equipmentSubtotalKrw + cableCostKrw) * (meta.installationFeePercent / 100)
  );
  const grossTotalKrw = equipmentSubtotalKrw + cableCostKrw + installationFeeKrw;
  const discountKrw = Math.round(grossTotalKrw * (meta.discountPercent / 100));
  const finalTotalKrw = grossTotalKrw - discountKrw;

  // Render 2D CAD SPL Coverage Canvas for Sheet DWG-03
  useEffect(() => {
    const canvas = reportSplCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const wPx = canvas.width;
    const hPx = canvas.height;
    ctx.clearRect(0, 0, wPx, hPx);

    const gridW = 96;
    const gridH = 56;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = gridW;
    offCanvas.height = gridH;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    const imgData = offCtx.createImageData(gridW, gridH);
    const data = imgData.data;

    for (let gy = 0; gy < gridH; gy++) {
      const yMeters = ((gy + 0.5) / gridH) * room.widthMeters;
      for (let gx = 0; gx < gridW; gx++) {
        const xMeters = ((gx + 0.5) / gridW) * room.lengthMeters;
        const spl = calculatePointSplAt3D(
          xMeters,
          yMeters,
          room.earHeightMeters,
          placements,
          catalogMap,
          splSummary.speakerDriveMap
        );
        const [r, g, b] = splToRgba(spl, 230);
        const idx = (gy * gridW + gx) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 225;
      }
    }

    offCtx.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offCanvas, 0, 0, wPx, hPx);

    // CAD Meter Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 0.8;
    for (let xm = 2; xm < room.lengthMeters; xm += 2) {
      const px = (xm / room.lengthMeters) * wPx;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, hPx);
      ctx.stroke();
    }
    for (let ym = 2; ym < room.widthMeters; ym += 2) {
      const py = (ym / room.widthMeters) * hPx;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(wPx, py);
      ctx.stroke();
    }

    // Draw Speaker Symbols & Dispersion Cones on CAD Sheet
    for (const spk of placements) {
      if (spk.muted) continue;
      const prod = catalogMap.get(spk.productId);
      if (!prod || !prod.speaker) continue;

      const sx = (spk.xMeters / room.lengthMeters) * wPx;
      const sy = (spk.yMeters / room.widthMeters) * hPx;

      if (prod.speaker.dispersionHorizontalDeg < 350 && spk.tiltDownDeg < 80) {
        const halfRad = ((prod.speaker.dispersionHorizontalDeg / 2) * Math.PI) / 180;
        const aimRad = (spk.azimuthDeg * Math.PI) / 180;
        const reachPx = wPx * 0.65;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(aimRad - halfRad) * reachPx, sy + Math.sin(aimRad - halfRad) * reachPx);
        ctx.lineTo(sx + Math.cos(aimRad + halfRad) * reachPx, sy + Math.sin(aimRad + halfRad) * reachPx);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(sx, sy, 38, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Speaker CAD Symbol (Rotated Trapezoidal Cabinet or Ceiling/Sub Icon)
      const aimRad = (spk.azimuthDeg * Math.PI) / 180;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(aimRad);

      if (prod.enclosureShape === 'ceiling') {
        ctx.fillStyle = '#090d16';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (prod.enclosureShape === 'subwoofer') {
        ctx.fillStyle = '#090d16';
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        ctx.fillRect(-9, -11, 18, 22);
        ctx.strokeRect(-9, -11, 18, 22);
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Trapezoidal Loudspeaker CAD Wedge
        ctx.fillStyle = '#090d16';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-9, -6);
        ctx.lineTo(7, -11);
        ctx.lineTo(7, 11);
        ctx.lineTo(-9, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Aiming Axis Arrow
        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(7, 0);
        ctx.lineTo(18, 0);
        ctx.stroke();
      }
      ctx.restore();

      // Smart non-clipping label pill placement on CAD Floorplan
      const labelText = `${spk.label}(${prod.model})`;
      ctx.font = 'bold 10px monospace';
      const textW = ctx.measureText(labelText).width;
      const isNearRight = sx > wPx * 0.72;
      const isNearBottom = sy > hPx * 0.82;
      const lx = isNearRight ? sx - textW - 18 : sx + 14;
      const ly = isNearBottom ? sy - 14 : sy + 4;

      ctx.fillStyle = 'rgba(9, 13, 22, 0.86)';
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.8)';
      ctx.lineWidth = 1;
      ctx.fillRect(lx - 4, ly - 10, textW + 8, 14);
      ctx.strokeRect(lx - 4, ly - 10, textW + 8, 14);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, lx, ly);
    }
  }, [room, placements, catalogMap, splSummary]);

  const handleExportCsv = () => {
    const headers = ['순번', '구분', '브랜드', '모델명', '품명 및 규격', '수량', '단가(KRW)', '합계금액(KRW)', '비고(배치위치)'];
    const rows = bomItems.map((item, idx) => [
      idx + 1,
      item.product.category.toUpperCase(),
      item.product.brand,
      item.product.model,
      `"${item.product.name}"`,
      item.quantity,
      item.product.unitPriceKrw,
      item.subtotalKrw,
      `"${item.nodeLabels.join(', ')}"`,
    ]);
    rows.push([
      bomItems.length + 1,
      'CABLE/ACC',
      'Standard',
      'CABLE-KIT',
      `"신호선(${totalSignalMeters}m) + 스피커선(${totalSpeakerMeters}m) + 네트워크선(${totalNetworkMeters}m) 및 커넥터 일체"`,
      1,
      cableCostKrw,
      cableCostKrw,
      '"자동 산출 배선 자재"',
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meta.projectName}_산출내역서.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  // Compute exact bounding box for 2D CAD Schematic scaling on Sheet DWG-02
  const minX = nodes.length > 0 ? Math.min(...nodes.map((n) => n.x)) - 40 : 0;
  const maxX = nodes.length > 0 ? Math.max(...nodes.map((n) => n.x + 264)) + 50 : 1980;
  const minY = nodes.length > 0 ? Math.min(...nodes.map((n) => n.y)) - 40 : 0;
  const maxY =
    nodes.length > 0
      ? Math.max(
          ...nodes.map((n) => n.y + estimateNodeRenderedHeight(catalogMap.get(n.productId)))
        ) + 50
      : 900;
  const viewBoxW = Math.max(1100, maxX - minX);
  const viewBoxH = Math.max(520, maxY - minY);

  // Common CAD Title Block Footer Component
  const renderCadTitleBlock = (sheetNo: string, sheetTitle: string) => (
    <div className="border-t border-white/[0.1] print:border-t-2 print:border-black bg-[#111622] print:bg-slate-100 grid grid-cols-12 text-[11px] font-mono text-slate-200 print:text-black">
      <div className="col-span-3 border-r border-white/[0.08] print:border-black px-3 py-2.5">
        <div className="text-[9px] text-slate-400 print:text-slate-600">PROJECT NAME(공사·프로젝트명)</div>
        <div className="font-semibold truncate">{meta.projectName}</div>
      </div>
      <div className="col-span-2 border-r border-white/[0.08] print:border-black px-3 py-2.5">
        <div className="text-[9px] text-slate-400 print:text-slate-600">CLIENT / VENUE(발주처·설치장소)</div>
        <div className="font-semibold truncate">
          {meta.clientName}({room.lengthMeters}×{room.widthMeters}×{room.heightMeters}m)
        </div>
      </div>
      <div className="col-span-3 border-r border-white/[0.08] print:border-black px-3 py-2.5">
        <div className="text-[9px] text-slate-400 print:text-slate-600">DRAWING TITLE(도면명)</div>
        <div className="font-semibold text-sky-300 print:text-black truncate">{sheetTitle}</div>
      </div>
      <div className="col-span-2 border-r border-white/[0.08] print:border-black px-3 py-2.5">
        <div className="text-[9px] text-slate-400 print:text-slate-600">DESIGNED BY(설계·시공)</div>
        <div className="truncate">
          {meta.companyName} · {meta.designerName}
        </div>
      </div>
      <div className="col-span-2 px-3 py-2.5 flex items-center justify-between">
        <div>
          <div className="text-[9px] text-slate-400 print:text-slate-600">DWG NO.</div>
          <div className="font-semibold">{sheetNo}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-slate-400 print:text-slate-600">DATE</div>
          <div>{meta.updatedAt.slice(0, 10)}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full w-full overflow-y-auto bg-[#0B0F17] p-4 sm:p-6 space-y-6 print:p-0 print:bg-white print:space-y-0">
      {/* Print Stylesheet for clean 2D Engineering CAD PDF Output */}
      <style>{`
        @media print {
          @page {
            size: A3 landscape;
            margin: 8mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .cad-print-sheet {
            page-break-after: always;
            break-after: page;
            border: 2px solid #000 !important;
            border-radius: 0 !important;
            margin-bottom: 0 !important;
          }
        }
      `}</style>

      {/* TOP CONTROL BAR (Material 3 Studio Action Bar — Hidden when printing PDF) */}
      <div className="no-print max-w-7xl mx-auto rounded-2xl border border-white/[0.08] bg-[#111622] px-5 py-3.5 space-y-3.5 shadow-lg shadow-black/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              data-tooltip="내역서에서 제품 모델을 변경하면 견적금액·신호계통도·SPL 음압분포도가 동시에 자동 갱신됩니다"
              data-tooltip-pos="bottom"
              className="px-2.5 py-0.5 rounded-full bg-emerald-400/12 border border-emerald-400/25 text-emerald-300 font-mono text-[11px] font-semibold whitespace-nowrap cursor-help"
            >
              양방향 연동
            </span>
            <h2 className="text-sm font-semibold text-white whitespace-nowrap tracking-tight">
              산출내역서 · 2D CAD 도면(3매)
            </h2>
            <span className="text-xs font-mono text-slate-400 hidden sm:inline">
              ({meta.projectName} · ₩{finalTotalKrw.toLocaleString()})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMetaEditor((v) => !v)}
              data-tooltip="공사명, 발주처, 설계자, 시공비율, 할인율 등 도면 표제란 정보 편집"
              data-tooltip-pos="bottom"
              className={`px-3.5 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition ${
                showMetaEditor
                  ? 'bg-sky-400/15 border-sky-400/40 text-sky-200'
                  : 'bg-[#1E2638] border-white/[0.08] text-slate-200 hover:bg-white/[0.1]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-sky-400" /> 도면정보 편집
            </button>

            <label
              data-tooltip="제출용 내역서에서 단가 및 합계금액 컬럼 표시/숨김 전환"
              data-tooltip-pos="bottom"
              className="flex items-center gap-2 text-xs text-slate-200 bg-[#1E2638] px-3.5 py-1.5 rounded-full border border-white/[0.08] hover:border-white/[0.14] cursor-pointer whitespace-nowrap transition"
            >
              <input
                type="checkbox"
                checked={meta.showPricingInReport}
                onChange={(e) => onUpdateMeta({ showPricingInReport: e.target.checked })}
                className="accent-sky-400"
              />
              금액표시
            </label>

            <button
              onClick={handleExportCsv}
              data-tooltip="산출내역서(BOM) 및 배선 물량을 엑셀 호환 CSV 파일로 다운로드합니다"
              data-tooltip-pos="bottom"
              className="px-3.5 py-1.5 rounded-full bg-[#1E2638] hover:bg-white/[0.1] border border-white/[0.08] text-slate-100 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> CSV 다운로드
            </button>

            <button
              onClick={handlePrintPdf}
              data-tooltip="산출내역서(DWG-01) + 신호계통도(DWG-02) + 음압평면도(DWG-03) A3 가로 3매 PDF 인쇄/저장"
              data-tooltip-pos="bottom"
              className="px-4 py-1.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-semibold flex items-center gap-1.5 shadow-sm whitespace-nowrap transition"
            >
              <Printer className="w-3.5 h-3.5" /> PDF 출력(3매)
            </button>
          </div>
        </div>

        {/* Collapsible Project Title Block Metadata Quick Editor */}
        {showMetaEditor && (
          <div className="w-full grid grid-cols-2 md:grid-cols-6 gap-2.5 pt-3 border-t border-white/[0.08] text-xs">
            <label className="space-y-1">
              <span className="text-[10px] text-slate-400 whitespace-nowrap block">프로젝트명</span>
              <input
                type="text"
                value={meta.projectName}
                onChange={(e) => onUpdateMeta({ projectName: e.target.value })}
                className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.1] px-2.5 py-1.5 text-slate-100 focus:border-sky-400/70 focus:outline-none transition"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-slate-400 whitespace-nowrap block">발주처</span>
              <input
                type="text"
                value={meta.clientName}
                onChange={(e) => onUpdateMeta({ clientName: e.target.value })}
                className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.1] px-2.5 py-1.5 text-slate-100 focus:border-sky-400/70 focus:outline-none transition"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-slate-400 whitespace-nowrap block">설계업체</span>
              <input
                type="text"
                value={meta.companyName}
                onChange={(e) => onUpdateMeta({ companyName: e.target.value })}
                className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.1] px-2.5 py-1.5 text-slate-100 focus:border-sky-400/70 focus:outline-none transition"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-slate-400 whitespace-nowrap block">설계자</span>
              <input
                type="text"
                value={meta.designerName}
                onChange={(e) => onUpdateMeta({ designerName: e.target.value })}
                className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.1] px-2.5 py-1.5 text-slate-100 focus:border-sky-400/70 focus:outline-none transition"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-slate-400 whitespace-nowrap block">시공비율(%)</span>
              <input
                type="number"
                min={0}
                max={50}
                value={meta.installationFeePercent}
                onChange={(e) => onUpdateMeta({ installationFeePercent: Number(e.target.value) })}
                className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.1] px-2.5 py-1.5 font-mono text-sky-300 focus:border-sky-400/70 focus:outline-none transition"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-slate-400 whitespace-nowrap block">할인율(%)</span>
              <input
                type="number"
                min={0}
                max={50}
                value={meta.discountPercent}
                onChange={(e) => onUpdateMeta({ discountPercent: Number(e.target.value) })}
                className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.1] px-2.5 py-1.5 font-mono text-emerald-300 focus:border-sky-400/70 focus:outline-none transition"
              />
            </label>
          </div>
        )}
      </div>

      {/* MATERIAL 3 TONAL SUMMARY CARDS (Hidden when printing PDF) */}
      <div className="no-print max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-white/[0.08] bg-[#161C2B] p-4 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400">총 투입 장비 · 품목</span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-semibold font-mono text-white">{nodes.length}대</span>
            <span className="text-[11px] font-mono text-sky-300">({bomItems.length}개 모델)</span>
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#161C2B] p-4 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400">자동 산출 배선 물량</span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-semibold font-mono text-white">
              {totalSignalMeters + totalSpeakerMeters + totalNetworkMeters}m
            </span>
            <span className="text-[11px] font-mono text-slate-400">({connections.length}회선)</span>
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#161C2B] p-4 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400">음향 성능 예측</span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-semibold font-mono text-amber-300">{splSummary.avgSplDb}dB</span>
            <span className="text-[11px] font-mono text-slate-400">
              커버리지 {splSummary.targetCoveragePercent}% · STI {splSummary.estimatedSti}
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-emerald-300/90">최종 제안 합계 (VAT 별도)</span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-semibold font-mono text-emerald-300">
              ₩{finalTotalKrw.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          SHEET 1 (DWG-01): BILL OF MATERIALS & SYSTEM SPECIFICATION SCHEDULE
         ===================================================================== */}
      <section className="cad-print-sheet max-w-7xl mx-auto rounded-2xl border border-white/[0.08] bg-[#161C2B] print:bg-white print:text-black overflow-hidden shadow-2xl shadow-black/40">
        <div className="p-6 space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-white/[0.08] print:border-b-2 print:border-black pb-4">
            <div>
              <span className="text-xs font-mono text-sky-400 print:text-slate-700 font-semibold">
                SHEET 01/03 — EQUIPMENT BILL OF MATERIALS(산출내역서)
              </span>
              <h3 className="text-xl font-semibold text-white print:text-black mt-1 tracking-tight">
                {meta.projectName} — 음향시스템 장비 산출내역서 및 사양서
              </h3>
            </div>
            <div className="text-right font-mono text-xs text-slate-300 print:text-black whitespace-nowrap space-y-0.5">
              <div>대상공간: {room.lengthMeters}m(L)×{room.widthMeters}m(W)×{room.heightMeters}m(H)</div>
              <div>
                예상 평균음압: <strong className="text-amber-300 print:text-black">{splSummary.avgSplDb}dB</strong>(커버리지 {splSummary.targetCoveragePercent}%, STI {splSummary.estimatedSti})
              </div>
            </div>
          </div>

          {/* Interactive BOM Table (Changing product dropdown updates everything automatically!) */}
          <div className="overflow-x-auto rounded-xl border border-white/[0.08] print:border-none">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#111622] print:bg-slate-200 text-slate-300 print:text-black border-b border-white/[0.08] print:border-y print:border-black font-mono whitespace-nowrap">
                  <th className="py-2.5 px-2.5 text-center w-10">NO</th>
                  <th className="py-2.5 px-3 text-left w-28">분류</th>
                  <th className="py-2.5 px-3 text-left w-72">
                    제품모델 선택(변경 시 전체 결과 자동반영)
                  </th>
                  <th className="py-2.5 px-3 text-left">핵심 기술사양(임피던스·출력·지향각·포트)</th>
                  <th className="py-2.5 px-2.5 text-center w-16">수량</th>
                  {meta.showPricingInReport && (
                    <>
                      <th className="py-2.5 px-3 text-right w-28">단가(₩)</th>
                      <th className="py-2.5 px-3 text-right w-32">합계금액(₩)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] print:divide-slate-300">
                {bomItems.map((item, idx) => {
                  const p = item.product;
                  const sameCat = catalog.filter((c) => c.category === p.category);
                  let specSummary = p.description;
                  if (p.speaker) {
                    specSummary = `${
                      p.speaker.impedanceOhms ? `${p.speaker.impedanceOhms}Ω` : '100V High-Z'
                    } | 정격 ${p.speaker.rmsWatts}W(Peak ${p.speaker.peakWatts}W) | 감도 ${
                      p.speaker.sensitivityDb
                    }dB | 지향각 ${p.speaker.dispersionHorizontalDeg}°H×${
                      p.speaker.dispersionVerticalDeg
                    }°V`;
                  } else if (p.amplifier) {
                    specSummary = `${p.amplifier.channels}CH 파워앰프 | ${p.amplifier.watts8OhmPerCh}W@8Ω / ${p.amplifier.watts4OhmPerCh}W@4Ω${
                      p.amplifier.supports100v ? ` / 100V ${p.amplifier.watts100vPerCh}W` : ''
                    }`;
                  } else if (p.mixer) {
                    specSummary = `${p.mixer.isDigital ? '디지털' : '아날로그'}콘솔 | 마이크·라인 ${
                      p.mixer.micLineInputs
                    }CH | 메인 ${p.mixer.mainOutputs}OUT / AUX ${p.mixer.auxOutputs}OUT`;
                  }

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-white/[0.03] print:hover:bg-transparent text-slate-200 print:text-black transition"
                    >
                      <td className="py-2.5 px-2.5 text-center font-mono whitespace-nowrap text-slate-400 print:text-black">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] uppercase whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-sky-400/12 text-sky-300 print:bg-transparent print:text-black print:p-0 font-semibold">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {/* Interactive Product Replacement Dropdown in Final Output */}
                        <select
                          value={p.id}
                          onChange={(e) => onSwapProductEverywhere(p.id, e.target.value)}
                          className="w-full rounded-xl bg-[#0B0F17] print:bg-transparent border border-sky-400/35 print:border-none px-2.5 py-1.5 text-xs font-mono font-semibold text-white print:text-black focus:border-sky-400 focus:outline-none cursor-pointer transition"
                        >
                          {sameCat.map((cand) => (
                            <option key={cand.id} value={cand.id}>
                              [{cand.brand}] {cand.model} — {cand.name}
                            </option>
                          ))}
                        </select>
                        <div className="text-[10px] text-slate-400 print:text-slate-600 mt-1 truncate">
                          적용위치: {item.nodeLabels.join(', ')}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] font-mono text-slate-300 print:text-slate-800 whitespace-nowrap">
                        {specSummary}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-mono font-semibold text-sm whitespace-nowrap">
                        {item.quantity}EA
                      </td>
                      {meta.showPricingInReport && (
                        <>
                          <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                            {p.unitPriceKrw.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-sky-300 print:text-black whitespace-nowrap">
                            {item.subtotalKrw.toLocaleString()}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}

                {/* Auto-Calculated Cable & Connector Package Row */}
                <tr className="bg-[#111622]/70 print:bg-slate-50 text-slate-300 print:text-black">
                  <td className="py-2.5 px-2.5 text-center font-mono whitespace-nowrap text-slate-400 print:text-black">{bomItems.length + 1}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/12 text-amber-300 print:bg-transparent print:text-black print:p-0 font-semibold">
                      CABLE & ACC
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold whitespace-nowrap">
                    음향 신호·스피커·네트워크 배선 및 커넥터 자재 일식(자동산출)
                  </td>
                  <td className="py-2.5 px-3 text-[11px] font-mono break-keep">
                    마이크·라인 신호선 {signalCables.length}회선({totalSignalMeters}m) · 무산소동 스피커선 {speakerCables.length}회선({totalSpeakerMeters}m) · Cat6 네트워크선 {networkCables.length}회선({totalNetworkMeters}m) · Neutrik XLR/NL4 커넥터 포함
                  </td>
                  <td className="py-2.5 px-2.5 text-center font-mono font-semibold whitespace-nowrap">1식</td>
                  {meta.showPricingInReport && (
                    <>
                      <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                        {cableCostKrw.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-sky-300 print:text-black whitespace-nowrap">
                        {cableCostKrw.toLocaleString()}
                      </td>
                    </>
                  )}
                </tr>
              </tbody>

              {meta.showPricingInReport && (
                <tfoot className="border-t border-white/[0.1] print:border-t-2 print:border-black bg-[#111622] print:bg-slate-100 font-mono text-xs whitespace-nowrap">
                  <tr>
                    <td colSpan={5} className="py-2 px-3 text-right text-slate-400 print:text-black">
                      장비 및 자재 소계(Equipment & Cable Subtotal)
                    </td>
                    <td colSpan={2} className="py-2 px-3 text-right font-semibold">
                      ₩{(equipmentSubtotalKrw + cableCostKrw).toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="py-2 px-3 text-right text-slate-400 print:text-black">
                      시스템 설치·결선·음향튜닝 인건비({meta.installationFeePercent}%)
                    </td>
                    <td colSpan={2} className="py-2 px-3 text-right font-semibold">
                      ₩{installationFeeKrw.toLocaleString()}
                    </td>
                  </tr>
                  {meta.discountPercent > 0 && (
                    <tr>
                      <td colSpan={5} className="py-2 px-3 text-right text-emerald-400 print:text-black">
                        제안 특별할인({meta.discountPercent}%)
                      </td>
                      <td colSpan={2} className="py-2 px-3 text-right text-emerald-400 print:text-black">
                        -₩{discountKrw.toLocaleString()}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t border-white/[0.08] print:border-black text-sm font-bold text-white print:text-black">
                    <td colSpan={5} className="py-3 px-3 text-right">
                      최종 제안 합계금액(VAT 별도)
                    </td>
                    <td colSpan={2} className="py-3 px-3 text-right text-emerald-300 print:text-black">
                      ₩{finalTotalKrw.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {renderCadTitleBlock('DWG-01', 'BILL OF MATERIALS & SYSTEM SPECIFICATION')}
      </section>

      {/* =====================================================================
          SHEET 2 (DWG-02): 2D CAD AUDIO SIGNAL FLOW SCHEMATIC DIAGRAM
         ===================================================================== */}
      <section className="cad-print-sheet max-w-7xl mx-auto rounded-2xl border border-white/[0.08] bg-[#161C2B] print:bg-white print:text-black overflow-hidden shadow-2xl shadow-black/40">
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] print:border-b-2 print:border-black pb-3">
            <div>
              <span className="text-xs font-mono text-sky-400 print:text-slate-700 font-semibold">
                SHEET 02/03 — 2D CAD AUDIO SIGNAL FLOW DIAGRAM(음향신호 계통도)
              </span>
              <h3 className="text-lg font-semibold text-white print:text-black mt-0.5 tracking-tight">
                포인트투포인트 입출력 결선 및 신호흐름 다이어그램
              </h3>
            </div>

            {/* Multi-Color CAD Cable Type Legend */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono border border-white/[0.08] print:border-black rounded-full px-4 py-1.5 bg-[#111622] print:bg-slate-100 whitespace-nowrap">
              {CABLE_TYPE_LEGEND.map((item) => (
                <span
                  key={item.id}
                  className="flex items-center gap-1.5 print:text-black"
                  style={{ color: item.color }}
                >
                  <span
                    className="w-5 inline-block rounded"
                    style={{
                      height: item.isThick ? 3.5 : 2,
                      backgroundColor: item.isDashed ? 'transparent' : item.color,
                      borderBottom: item.isDashed ? `2px dashed ${item.color}` : undefined,
                    }}
                  />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          {/* 2D Vector CAD Schematic Drawing */}
          <div className="w-full rounded-xl border border-white/[0.08] print:border-black bg-[#0B0F17] print:bg-slate-950 p-2 overflow-hidden">
            <svg
              viewBox={`${minX} ${minY} ${viewBoxW} ${viewBoxH}`}
              className="w-full h-[420px] block"
            >
              {/* CAD Blueprint Fine Grid */}
              <defs>
                <pattern id="cad-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.08)"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect x={minX} y={minY} width={viewBoxW} height={viewBoxH} fill="url(#cad-grid)" />

              {/* Orthogonal 90-Degree Connections with Semicircular Bridge Hop-Overs (`⌒`) */}
              {(() => {
                const routedMap = routeAllCablesWithJumpOvers(connections, nodes, catalogMap, 256, 24);

                return connections.map((conn) => {
                  const routed = routedMap.get(conn.id);
                  if (!routed) return null;
                  const { pathD } = routed;
                  const style = getCableVisualStyle(conn, nodes, catalogMap, true);

                  return (
                    <g key={conn.id}>
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#090d16"
                        strokeWidth={style.strokeWidth + 2.8}
                        strokeLinejoin="round"
                      />
                      <path
                        d={pathD}
                        fill="none"
                        stroke={style.color}
                        strokeWidth={style.strokeWidth}
                        strokeLinejoin="round"
                        strokeDasharray={style.dashArray}
                      />
                    </g>
                  );
                });
              })()}

              {/* CAD Blocks for Each Node */}
              {nodes.map((node) => {
                const prod = catalogMap.get(node.productId);
                if (!prod) return null;
                const inPorts = prod.ports.filter((p) => p.direction === 'in');
                const outPorts = prod.ports.filter((p) => p.direction === 'out');
                const rows = Math.max(inPorts.length, outPorts.length, 1);
                const headerH = prod.category === 'speaker' ? 144 : 114;
                const boxH = headerH + rows * 24 + 12;

                return (
                  <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                    <rect
                      x={0}
                      y={0}
                      width={256}
                      height={boxH}
                      rx={5}
                      fill="#0f172a"
                      stroke="#64748b"
                      strokeWidth={1.6}
                    />
                    <rect x={0} y={0} width={256} height={46} rx={5} fill="#020617" />
                    <text x={10} y={18} fill="#38bdf8" fontSize={11} fontWeight="bold" fontFamily="monospace">
                      {node.customLabel}
                    </text>
                    <text x={10} y={35} fill="#f8fafc" fontSize={10} fontFamily="monospace">
                      [{prod.brand}] {prod.model}
                    </text>

                    {/* Model-Specific Device SVG Artwork inside CAD Node Block */}
                    <foreignObject x={10} y={48} width={236} height={headerH - 54}>
                      <DeviceSvgArtwork
                        product={prod}
                        width={236}
                        height={prod.category === 'speaker' ? 82 : 52}
                        compact
                      />
                    </foreignObject>

                    {/* Center Divider between IN and OUT columns */}
                    <line
                      x1={128}
                      y1={headerH - 4}
                      x2={128}
                      y2={boxH - 6}
                      stroke="#1e293b"
                      strokeWidth={1}
                    />

                    {/* Ports (Truncated to prevent left/right text collision) */}
                    {inPorts.map((p, idx) => (
                      <g key={p.id} transform={`translate(0, ${headerH + idx * 24})`}>
                        <circle cx={0} cy={12} r={4} fill={getPortPinColor(p)} />
                        <text x={8} y={15} fill="#cbd5e1" fontSize={9} fontFamily="monospace">
                          {p.label.length > 17 ? `${p.label.slice(0, 16)}…` : p.label}
                        </text>
                      </g>
                    ))}
                    {outPorts.map((p, idx) => (
                      <g key={p.id} transform={`translate(256, ${headerH + idx * 24})`}>
                        <circle cx={0} cy={12} r={4} fill={getPortPinColor(p)} />
                        <text
                          x={-8}
                          y={15}
                          textAnchor="end"
                          fill="#cbd5e1"
                          fontSize={9}
                          fontFamily="monospace"
                        >
                          {p.label.length > 17 ? `${p.label.slice(0, 16)}…` : p.label}
                        </text>
                      </g>
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Amplifier-Speaker Impedance & Power Matching Verification Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {ampLoads
              .filter((l) => l.mode !== 'unconnected')
              .map((load) => (
                <div
                  key={`${load.ampNodeId}_${load.portId}`}
                  className="rounded-xl border border-white/[0.08] print:border-black bg-[#111622] print:bg-slate-100 p-3 text-xs font-mono"
                >
                  <div className="font-semibold text-sky-300 print:text-black">
                    {load.ampLabel} ({load.ampProduct.model}) — {load.portLabel}
                  </div>
                  <div className="text-[11px] text-slate-300 print:text-black mt-1">
                    {load.statusMessage}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {renderCadTitleBlock('DWG-02', 'AUDIO SIGNAL FLOW & WIRING SCHEMATIC')}
      </section>

      {/* =====================================================================
          SHEET 3 (DWG-03): 2D ACOUSTIC LAYOUT & SPL COVERAGE DISTRIBUTION MAP
         ===================================================================== */}
      <section className="cad-print-sheet max-w-7xl mx-auto rounded-2xl border border-white/[0.08] bg-[#161C2B] print:bg-white print:text-black overflow-hidden shadow-2xl shadow-black/40">
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] print:border-b-2 print:border-black pb-3">
            <div>
              <span className="text-xs font-mono text-amber-400 print:text-slate-700 font-semibold">
                SHEET 03/03 — ACOUSTIC LAYOUT & SPL COVERAGE SIMULATION(공간 음압분포도)
              </span>
              <h3 className="text-lg font-semibold text-white print:text-black mt-0.5 tracking-tight">
                스피커 배치좌표·지향각 투사 및 공간음압(dB SPL) 분포도면
              </h3>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs whitespace-nowrap bg-[#111622] print:bg-transparent px-3 py-1.5 rounded-full border border-white/[0.08] print:border-none">
              <span>70dB</span>
              <div
                className="w-36 h-3 rounded-full border border-white/20 print:border-slate-600"
                style={{
                  background:
                    'linear-gradient(90deg, #1d4ed8 0%, #06b6d4 28%, #22c55e 54%, #eab308 78%, #ef4444 100%)',
                }}
              />
              <span>105dB+</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left 8 Cols: 2D Floorplan SPL Heatmap */}
            <div className="lg:col-span-8 rounded-xl border border-white/[0.08] print:border-black bg-[#0B0F17] p-2.5 flex flex-col items-center">
              <canvas
                ref={reportSplCanvasRef}
                width={760}
                height={420}
                className="w-full h-auto max-h-[380px] rounded-lg block"
              />
              <div className="w-full flex justify-between text-[11px] font-mono text-slate-400 pt-2 px-1 whitespace-nowrap">
                <span>무대 기준점(0, 0)</span>
                <span>
                  공간치수: 깊이 {room.lengthMeters}m×폭 {room.widthMeters}m×천장고 {room.heightMeters}m(청취귀높이 {room.earHeightMeters}m)
                </span>
              </div>
            </div>

            {/* Right 4 Cols: Speaker Schedule & Acoustic Metrics */}
            <div className="lg:col-span-4 space-y-3">
              <div className="rounded-xl border border-white/[0.08] print:border-black bg-[#111622] print:bg-slate-100 p-4 space-y-2 font-mono text-xs whitespace-nowrap">
                <div className="font-semibold text-emerald-400 print:text-black border-b border-white/[0.08] print:border-black pb-1.5">
                  예상 음향성능 요약(ACOUSTIC SUMMARY)
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 print:text-slate-700">객석 평균음압:</span>
                  <strong>{splSummary.avgSplDb}dB</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 print:text-slate-700">최대/최소 음압:</span>
                  <strong>
                    {splSummary.maxSplDb}/{splSummary.minSplDb}dB
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 print:text-slate-700">공간 음압균일도:</span>
                  <strong>±{splSummary.uniformityPlusMinusDb}dB</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 print:text-slate-700">
                    목표음압({room.targetSplDb}dB) 달성률:
                  </span>
                  <strong>{splSummary.targetCoveragePercent}%</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 print:text-slate-700">예상 음성명료도(STI):</span>
                  <strong>
                    {splSummary.estimatedSti}({splSummary.stiGrade})
                  </strong>
                </div>
              </div>

              {/* Speaker Coordinates & Aiming Schedule Table */}
              <div className="rounded-xl border border-white/[0.08] print:border-black overflow-hidden">
                <table className="w-full text-[11px] font-mono">
                  <thead className="bg-[#111622] print:bg-slate-200 text-slate-300 print:text-black whitespace-nowrap">
                    <tr>
                      <th className="py-2 px-2.5 text-left">스피커 호칭</th>
                      <th className="py-2 px-1.5 text-center">모델</th>
                      <th className="py-2 px-1.5 text-center">좌표(X,Y,Z)</th>
                      <th className="py-2 px-1.5 text-center">지향/틸트</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] print:divide-slate-300 bg-[#0B0F17]/60 print:bg-white whitespace-nowrap">
                    {placements.map((pl) => {
                      const prod = catalogMap.get(pl.productId);
                      return (
                        <tr key={pl.id}>
                          <td className="py-2 px-2.5 font-semibold">{pl.label}</td>
                          <td className="py-2 px-1.5 text-center text-sky-300 print:text-black">
                            {prod?.model}
                          </td>
                          <td className="py-2 px-1.5 text-center">
                            {pl.xMeters},{pl.yMeters},{pl.zHeightMeters}m
                          </td>
                          <td className="py-2 px-1.5 text-center">
                            {pl.azimuthDeg}°/-{pl.tiltDownDeg}°
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {renderCadTitleBlock('DWG-03', 'ACOUSTIC LAYOUT & SPL COVERAGE DISTRIBUTION')}
      </section>
    </div>
  );
};
