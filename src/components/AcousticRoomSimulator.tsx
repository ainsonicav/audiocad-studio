import React, { useEffect, useRef, useState } from 'react';
import {
  AudioProduct,
  OptimizationProposal,
  RoomConfig,
  SpeakerPlacement,
  SPLSimulationSummary,
} from '../types/audio';
import {
  AcousticAnalysisBand,
  calculatePointAcousticFieldAt3D,
  calculatePointSplAt3D,
} from '../engine/audioPhysics';
import {
  CheckCircle2,
  Compass,
  Image as ImageIcon,
  Maximize2,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

interface AcousticRoomSimulatorProps {
  room: RoomConfig;
  placements: SpeakerPlacement[];
  catalog: AudioProduct[];
  catalogMap: Map<string, AudioProduct>;
  splSummary: SPLSimulationSummary;
  proposals: OptimizationProposal[];
  onUpdateRoom: (patch: Partial<RoomConfig>) => void;
  onUpdatePlacement: (id: string, patch: Partial<SpeakerPlacement>) => void;
  onSwapNodeProduct: (nodeId: string, newProductId: string) => void;
  onApplyProposal: (proposal: OptimizationProposal) => void;
}

/** Maps dB SPL (e.g. 65 ~ 110 dB) to a vivid engineering acoustic heatmap RGB color */
export function splToRgba(spl: number, alpha = 215): [number, number, number, number] {
  // Clamp between 65 dB and 108 dB
  const minDb = 68;
  const maxDb = 106;
  const t = Math.max(0, Math.min(1, (spl - minDb) / (maxDb - minDb)));

  // 5-stop color ramp: Deep Navy (68dB) -> Cyan (78dB) -> Emerald Green (86dB) -> Yellow (94dB) -> Orange/Red (104dB+)
  let r = 0;
  let g = 0;
  let b = 0;

  if (t < 0.25) {
    const k = t / 0.25;
    r = Math.round(15 + k * 0);
    g = Math.round(23 + k * 165);
    b = Math.round(65 + k * 175);
  } else if (t < 0.5) {
    const k = (t - 0.25) / 0.25;
    r = Math.round(15 + k * 20);
    g = Math.round(188 + k * 35);
    b = Math.round(240 - k * 145);
  } else if (t < 0.75) {
    const k = (t - 0.5) / 0.25;
    r = Math.round(35 + k * 215);
    g = Math.round(223 - k * 25);
    b = Math.round(95 - k * 75);
  } else {
    const k = (t - 0.75) / 0.25;
    r = Math.round(250);
    g = Math.round(198 - k * 155);
    b = Math.round(20 + k * 20);
  }

  return [r, g, b, alpha];
}

export const AcousticRoomSimulator: React.FC<AcousticRoomSimulatorProps> = ({
  room,
  placements,
  catalog,
  catalogMap,
  splSummary,
  proposals,
  onUpdateRoom,
  onUpdatePlacement,
  onSwapNodeProduct,
  onApplyProposal,
}) => {
  const topCanvasRef = useRef<HTMLCanvasElement>(null);
  const sideCanvasRef = useRef<HTMLCanvasElement>(null);

  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(
    placements[0]?.id || null
  );
  const [draggingSpkId, setDraggingSpkId] = useState<string | null>(null);
  const [showDispersionCones, setShowDispersionCones] = useState(true);
  const [showIsobars, setShowIsobars] = useState(true);
  const [showInterference, setShowInterference] = useState(true);
  const [analysisBand, setAnalysisBand] = useState<AcousticAnalysisBand>('broadband');
  const [showAdvisorPanel, setShowAdvisorPanel] = useState(true);
  const [appliedProposalBanner, setAppliedProposalBanner] = useState<string | null>(null);
  const [hoverProbe, setHoverProbe] = useState<{
    xMeters: number;
    yMeters: number;
    splDb: number;
    interferenceDeltaDb: number;
    overlapCount: number;
    state: 'normal' | 'boost' | 'dip' | 'overlap';
  } | null>(null);

  const targetUni = room.targetUniformityDb ?? 3.0;
  const isSplMet = splSummary.avgSplDb >= room.targetSplDb - 0.5;
  const isUniMet = splSummary.uniformityPlusMinusDb <= targetUni;

  const speakerCatalog = catalog.filter((p) => p.category === 'speaker');
  const selectedPlacement =
    placements.find((p) => p.id === selectedPlacementId) || placements[0] || null;

  // Render Top-View SPL Heatmap Canvas
  useEffect(() => {
    const canvas = topCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const wPx = canvas.width;
    const hPx = canvas.height;
    ctx.clearRect(0, 0, wPx, hPx);

    // Offscreen heatmap buffer (96 x 64 resolution for smooth bilinear upscale)
    const gridW = 110;
    const gridH = 72;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = gridW;
    offCanvas.height = gridH;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    const imgData = offCtx.createImageData(gridW, gridH);
    const data = imgData.data;

    const localBoostCandidates: { xMeters: number; yMeters: number; splDb: number; deltaDb: number }[] = [];
    const localDipCandidates: { xMeters: number; yMeters: number; splDb: number; deltaDb: number }[] = [];

    for (let gy = 0; gy < gridH; gy++) {
      const yMeters = ((gy + 0.5) / gridH) * room.widthMeters;
      for (let gx = 0; gx < gridW; gx++) {
        const xMeters = ((gx + 0.5) / gridW) * room.lengthMeters;
        const field = calculatePointAcousticFieldAt3D(
          xMeters,
          yMeters,
          room.earHeightMeters,
          placements,
          catalogMap,
          splSummary.speakerDriveMap,
          analysisBand,
          showInterference
        );
        const spl = field.splDb;

        if (
          showInterference &&
          xMeters > room.stageDepthMeters + 0.6 &&
          xMeters < room.lengthMeters - 0.6 &&
          yMeters > 0.6 &&
          yMeters < room.widthMeters - 0.6 &&
          gx % 3 === 0 &&
          gy % 3 === 0
        ) {
          if (field.state === 'boost' && field.interferenceDeltaDb >= 1.3) {
            localBoostCandidates.push({
              xMeters,
              yMeters,
              splDb: spl,
              deltaDb: field.interferenceDeltaDb,
            });
          } else if (field.state === 'dip' && field.interferenceDeltaDb <= -1.6) {
            localDipCandidates.push({
              xMeters,
              yMeters,
              splDb: spl,
              deltaDb: field.interferenceDeltaDb,
            });
          }
        }

        // Isobar contour lines every 3 dB if enabled
        const isContour =
          showIsobars && Math.abs((spl % 3) - 1.5) < 0.14 && xMeters > room.stageDepthMeters;

        // Subtle hatching on deep phase cancellation dips when showInterference is active
        const isDipHatch =
          showInterference &&
          field.state === 'dip' &&
          field.interferenceDeltaDb <= -2.0 &&
          (gx + gy) % 2 === 0;

        const [r, g, b, a] = splToRgba(spl, room.floorplanImageUrl ? 175 : 225);
        const idx = (gy * gridW + gx) * 4;
        if (isContour) {
          data[idx] = Math.min(255, r + 45);
          data[idx + 1] = Math.min(255, g + 45);
          data[idx + 2] = Math.min(255, b + 45);
          data[idx + 3] = 240;
        } else if (isDipHatch) {
          data[idx] = Math.max(0, r - 35);
          data[idx + 1] = Math.max(0, g - 35);
          data[idx + 2] = Math.min(255, b + 35);
          data[idx + 3] = a;
        } else {
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = a;
        }
      }
    }

    offCtx.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(offCanvas, 0, 0, wPx, hPx);

    // Draw 1m Engineering Grid Overlay
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let xm = 1; xm < room.lengthMeters; xm++) {
      const px = (xm / room.lengthMeters) * wPx;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, hPx);
      ctx.stroke();
    }
    for (let ym = 1; ym < room.widthMeters; ym++) {
      const py = (ym / room.widthMeters) * hPx;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(wPx, py);
      ctx.stroke();
    }

    // Draw Stage Boundary Zone
    const stagePx = (room.stageDepthMeters / room.lengthMeters) * wPx;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.fillRect(0, 0, stagePx, hPx);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(stagePx, 0);
    ctx.lineTo(stagePx, hPx);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(9, 13, 22, 0.82)';
    ctx.fillRect(6, 6, 114, 18);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.95)';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('STAGE (무대/전면)', 12, 18);

    // Draw Side-View Cross-Section Slice Indicator Line
    const slicePy = (room.sideViewSliceYMeters / room.widthMeters) * hPx;
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, slicePy);
    ctx.lineTo(wPx, slicePy);
    ctx.stroke();
    ctx.setLineDash([]);
    const sliceLabelY = slicePy < 26 ? slicePy + 15 : slicePy - 6;
    ctx.fillStyle = 'rgba(9, 13, 22, 0.82)';
    ctx.fillRect(wPx - 166, sliceLabelY - 11, 160, 15);
    ctx.fillStyle = '#fde047';
    ctx.font = '10px monospace';
    ctx.fillText(`단면 기준선 (Y=${room.sideViewSliceYMeters}m)`, wPx - 162, sliceLabelY);

    // Draw Dispersion Cones (-6dB Horizontal Beamwidth) for each Speaker
    if (showDispersionCones) {
      for (const spk of placements) {
        if (spk.muted) continue;
        const prod = catalogMap.get(spk.productId);
        if (!prod || !prod.speaker) continue;

        const sx = (spk.xMeters / room.lengthMeters) * wPx;
        const sy = (spk.yMeters / room.widthMeters) * hPx;

        // Ceiling / Subwoofers draw circular coverage ring
        if (spk.tiltDownDeg >= 80 || prod.speaker.dispersionHorizontalDeg >= 350) {
          const radiusMeters =
            spk.tiltDownDeg >= 80
              ? Math.max(1.5, (spk.zHeightMeters - room.earHeightMeters) * Math.tan(((prod.speaker.dispersionHorizontalDeg / 2) * Math.PI) / 180))
              : 4.0;
          const rx = (radiusMeters / room.lengthMeters) * wPx;
          const ry = (radiusMeters / room.widthMeters) * hPx;

          ctx.strokeStyle =
            selectedPlacement?.id === spk.id
              ? 'rgba(255, 255, 255, 0.95)'
              : 'rgba(251, 191, 36, 0.75)';
          ctx.lineWidth = selectedPlacement?.id === spk.id ? 2 : 1.3;
          ctx.setLineDash([5, 3]);
          ctx.beginPath();
          ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          // Directional Horizontal Beam Cone (-6dB angle)
          const halfAngleRad = ((prod.speaker.dispersionHorizontalDeg / 2) * Math.PI) / 180;
          const aimRad = (spk.azimuthDeg * Math.PI) / 180;
          const coneReachMeters = Math.min(room.lengthMeters * 0.85, 16);

          const reachPxX = (coneReachMeters / room.lengthMeters) * wPx;
          const reachPxY = (coneReachMeters / room.widthMeters) * hPx;

          const x1 = sx + Math.cos(aimRad - halfAngleRad) * reachPxX;
          const y1 = sy + Math.sin(aimRad - halfAngleRad) * reachPxY;
          const x2 = sx + Math.cos(aimRad + halfAngleRad) * reachPxX;
          const y2 = sy + Math.sin(aimRad + halfAngleRad) * reachPxY;
          const xAxis = sx + Math.cos(aimRad) * reachPxX * 0.9;
          const yAxis = sy + Math.sin(aimRad) * reachPxY * 0.9;

          ctx.fillStyle =
            selectedPlacement?.id === spk.id
              ? 'rgba(255, 255, 255, 0.14)'
              : 'rgba(255, 255, 255, 0.06)';
          ctx.strokeStyle =
            selectedPlacement?.id === spk.id
              ? 'rgba(255, 255, 255, 0.9)'
              : 'rgba(226, 232, 240, 0.55)';
          ctx.lineWidth = selectedPlacement?.id === spk.id ? 1.8 : 1.1;

          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // On-axis center aiming ray
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(xAxis, yAxis);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // Draw Constructive Boost (+dB) & Destructive Cancellation Dip (-dB) Markers on Top-View
    if (showInterference && placements.filter((p) => !p.muted).length >= 2) {
      const pickMarkers = (
        list: { xMeters: number; yMeters: number; splDb: number; deltaDb: number }[],
        isBoost: boolean,
        limit: number
      ) => {
        const sorted = [...list].sort((a, b) =>
          isBoost ? b.deltaDb - a.deltaDb : a.deltaDb - b.deltaDb
        );
        const picked: typeof list = [];
        for (const item of sorted) {
          if (picked.length >= limit) break;
          const nearSpeaker = placements.some(
            (s) => Math.hypot(s.xMeters - item.xMeters, s.yMeters - item.yMeters) < 2.0
          );
          if (nearSpeaker) continue;
          const nearExisting = picked.some(
            (p) => Math.hypot(p.xMeters - item.xMeters, p.yMeters - item.yMeters) < 3.0
          );
          if (!nearExisting) picked.push(item);
        }
        return picked;
      };

      const boostSpots = pickMarkers(localBoostCandidates, true, 2);
      const dipSpots = pickMarkers(localDipCandidates, false, 3);

      const drawHotspotMarker = (
        spot: { xMeters: number; yMeters: number; splDb: number; deltaDb: number },
        isBoost: boolean
      ) => {
        const px = (spot.xMeters / room.lengthMeters) * wPx;
        const py = (spot.yMeters / room.widthMeters) * hPx;

        // Pulsing/dashed acoustic interference ring
        ctx.save();
        ctx.strokeStyle = isBoost ? '#f43f5e' : '#38bdf8';
        ctx.fillStyle = isBoost ? 'rgba(244, 63, 94, 0.22)' : 'rgba(56, 189, 248, 0.22)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash(isBoost ? [] : [3, 2]);
        ctx.beginPath();
        ctx.arc(px, py, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        // Label badge
        const text = isBoost
          ? `▲부스트 +${spot.deltaDb.toFixed(1)}dB`
          : `▼딥 ${spot.deltaDb.toFixed(1)}dB`;
        ctx.font = 'bold 10px monospace';
        const tw = ctx.measureText(text).width + 10;
        const bx = Math.min(wPx - tw - 6, Math.max(6, px - tw / 2));
        const by = py > hPx - 28 ? py - 24 : py + 13;

        ctx.fillStyle = 'rgba(9, 13, 22, 0.88)';
        ctx.strokeStyle = isBoost ? '#fb7185' : '#38bdf8';
        ctx.lineWidth = 1;
        ctx.fillRect(bx, by, tw, 15);
        ctx.strokeRect(bx, by, tw, 15);

        ctx.fillStyle = isBoost ? '#fda4af' : '#7dd3fc';
        ctx.fillText(text, bx + 5, by + 11);
        ctx.restore();
      };

      boostSpots.forEach((b) => drawHotspotMarker(b, true));
      dipSpots.forEach((d) => drawHotspotMarker(d, false));
    }
  }, [
    room,
    placements,
    catalogMap,
    splSummary,
    showDispersionCones,
    showIsobars,
    showInterference,
    analysisBand,
    selectedPlacement,
  ]);

  // Render Side-View Vertical Elevation SPL Cross-Section Canvas
  useEffect(() => {
    const canvas = sideCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const wPx = canvas.width;
    const hPx = canvas.height;
    ctx.clearRect(0, 0, wPx, hPx);

    const gridW = 96;
    const gridH = 36;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = gridW;
    offCanvas.height = gridH;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    const imgData = offCtx.createImageData(gridW, gridH);
    const data = imgData.data;

    for (let gz = 0; gz < gridH; gz++) {
      // Top of canvas is ceiling (z = heightMeters), bottom is floor (z = 0)
      const zMeters = ((gridH - 1 - gz + 0.5) / gridH) * room.heightMeters;
      for (let gx = 0; gx < gridW; gx++) {
        const xMeters = ((gx + 0.5) / gridW) * room.lengthMeters;
        const pt = calculatePointAcousticFieldAt3D(
          xMeters,
          room.sideViewSliceYMeters,
          zMeters,
          placements,
          catalogMap,
          splSummary.speakerDriveMap,
          analysisBand,
          showInterference
        );
        const spl = pt.splDb;
        const [r, g, b, a] = splToRgba(spl, 210);
        const idx = (gz * gridW + gx) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;
      }
    }

    offCtx.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offCanvas, 0, 0, wPx, hPx);

    // Draw Listener Ear Height Line (e.g., 1.2m)
    const earPy = hPx - (room.earHeightMeters / room.heightMeters) * hPx;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, earPy);
    ctx.lineTo(wPx, earPy);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#bae6fd';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`청취 귀 높이 (Z=${room.earHeightMeters}m)`, 10, Math.max(12, earPy - 5));

    // Draw Vertical Dispersion Rays for Speakers
    for (const spk of placements) {
      if (spk.muted) continue;
      const prod = catalogMap.get(spk.productId);
      if (!prod || !prod.speaker) continue;

      const sx = (spk.xMeters / room.lengthMeters) * wPx;
      const sz = hPx - (spk.zHeightMeters / room.heightMeters) * hPx;

      const tiltRad = (spk.tiltDownDeg * Math.PI) / 180;
      const halfVRad = ((prod.speaker.dispersionVerticalDeg / 2) * Math.PI) / 180;
      const rayLen = wPx * 0.65;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1.2;

      ctx.beginPath();
      ctx.moveTo(sx, sz);
      ctx.lineTo(
        sx + Math.cos(tiltRad - halfVRad) * rayLen,
        sz + Math.sin(tiltRad - halfVRad) * rayLen
      );
      ctx.lineTo(
        sx + Math.cos(tiltRad + halfVRad) * rayLen,
        sz + Math.sin(tiltRad + halfVRad) * rayLen
      );
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Speaker dot in Side View
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(sx, sz, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [room, placements, catalogMap, splSummary, showInterference, analysisBand]);

  const handleTopViewMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const yRatio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const xMeters = Math.round(xRatio * room.lengthMeters * 10) / 10;
    const yMeters = Math.round(yRatio * room.widthMeters * 10) / 10;

    if (draggingSpkId) {
      onUpdatePlacement(draggingSpkId, { xMeters, yMeters });
    }

    setHoverProbe((prev) => {
      if (prev && prev.xMeters === xMeters && prev.yMeters === yMeters) {
        return prev;
      }
      const pt = calculatePointAcousticFieldAt3D(
        xMeters,
        yMeters,
        room.earHeightMeters,
        placements,
        catalogMap,
        splSummary.speakerDriveMap,
        analysisBand,
        showInterference
      );
      return {
        xMeters,
        yMeters,
        splDb: pt.splDb,
        interferenceDeltaDb: pt.interferenceDeltaDb,
        overlapCount: pt.overlapCount,
        state: pt.state,
      };
    });
  };

  const handleFloorplanUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateRoom({ floorplanImageUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#0B0F17] text-slate-100">
      {/* LEFT ROOM & SPEAKER PLACEMENT CONTROL RAIL */}
      <aside className="w-80 shrink-0 border-r border-white/[0.08] bg-[#111622] flex flex-col overflow-y-auto p-3.5 space-y-3.5">
        {/* Room Dimensions & Acoustic Target */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#161C2B] p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-cyan-400/15 border border-cyan-400/25 flex items-center justify-center text-cyan-300">
                <Maximize2 className="w-3.5 h-3.5" />
              </span>
              공간 규격
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[10px] font-mono text-slate-300">
              {(room.lengthMeters * room.widthMeters).toFixed(0)}㎡
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <label className="space-y-1" data-tooltip="무대~후방 공간 깊이(m)" data-tooltip-pos="bottom">
              <span className="text-[10px] font-medium text-slate-400 block">깊이 L(m)</span>
              <input
                type="number"
                min={4}
                max={100}
                step="0.1"
                value={room.lengthMeters}
                onChange={(e) => onUpdateRoom({ lengthMeters: Math.max(4, Number(e.target.value)) })}
                className="w-full rounded-xl bg-slate-900/90 border border-white/[0.1] focus:border-cyan-400/60 focus:outline-none px-2 py-1.5 font-mono text-cyan-300 transition-colors"
              />
            </label>
            <label className="space-y-1" data-tooltip="좌~우 공간 가로폭(m)" data-tooltip-pos="bottom">
              <span className="text-[10px] font-medium text-slate-400 block">폭 W(m)</span>
              <input
                type="number"
                min={3}
                max={80}
                step="0.1"
                value={room.widthMeters}
                onChange={(e) => onUpdateRoom({ widthMeters: Math.max(3, Number(e.target.value)) })}
                className="w-full rounded-xl bg-slate-900/90 border border-white/[0.1] focus:border-cyan-400/60 focus:outline-none px-2 py-1.5 font-mono text-cyan-300 transition-colors"
              />
            </label>
            <label className="space-y-1" data-tooltip="바닥~천장 높이(m)" data-tooltip-pos="bottom">
              <span className="text-[10px] font-medium text-slate-400 block">천장 H(m)</span>
              <input
                type="number"
                min={2.2}
                max={25}
                step="0.1"
                value={room.heightMeters}
                onChange={(e) =>
                  onUpdateRoom({ heightMeters: Math.max(2.2, Number(e.target.value)) })
                }
                className="w-full rounded-xl bg-slate-900/90 border border-white/[0.1] focus:border-cyan-400/60 focus:outline-none px-2 py-1.5 font-mono text-cyan-300 transition-colors"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="space-y-1" data-tooltip="청취자 귀 높이 기준면(기본 1.2m)">
              <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap block">귀높이(m)</span>
              <input
                type="number"
                min={0.8}
                max={2.0}
                step={0.1}
                value={room.earHeightMeters}
                onChange={(e) =>
                  onUpdateRoom({ earHeightMeters: Math.max(0.8, Number(e.target.value)) })
                }
                className="w-full rounded-xl bg-slate-900/90 border border-white/[0.1] focus:border-cyan-400/60 focus:outline-none px-2 py-1.5 font-mono text-slate-200 transition-colors"
              />
            </label>
            <label className="space-y-1" data-tooltip="실내 잔향시간 RT60(초) — 음성명료도(STI) 산출 반영">
              <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap block">잔향 RT60(s)</span>
              <input
                type="number"
                min={0.3}
                max={3.0}
                step={0.05}
                value={room.rt60Seconds}
                onChange={(e) =>
                  onUpdateRoom({ rt60Seconds: Math.max(0.3, Number(e.target.value)) })
                }
                className="w-full rounded-xl bg-slate-900/90 border border-white/[0.1] focus:border-cyan-400/60 focus:outline-none px-2 py-1.5 font-mono text-slate-200 transition-colors"
              />
            </label>
          </div>

          {/* Architectural Floorplan Overlay Upload */}
          <div className="pt-2 border-t border-white/[0.07] flex items-center justify-between gap-2">
            <label
              data-tooltip="건축 2D 평면도 이미지(PNG/JPG/SVG)를 배경으로 깔고 위에서 음압분포를 시뮬레이션합니다"
              className="flex-1 text-center py-1.5 px-3 rounded-full border border-dashed border-white/[0.15] hover:border-cyan-400/60 hover:bg-cyan-400/5 text-[11px] font-medium text-slate-300 cursor-pointer bg-slate-900/60 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <ImageIcon className="w-3.5 h-3.5 text-cyan-400" /> 배경도면 업로드
              <input
                type="file"
                accept="image/*"
                onChange={handleFloorplanUpload}
                className="hidden"
              />
            </label>
            {room.floorplanImageUrl && (
              <button
                onClick={() => onUpdateRoom({ floorplanImageUrl: undefined })}
                data-tooltip="업로드한 배경 평면도 제거"
                className="px-3 py-1.5 rounded-full bg-rose-500/15 border border-rose-400/30 text-[11px] font-medium text-rose-300 hover:bg-rose-500/25 transition-colors whitespace-nowrap"
              >
                제거
              </button>
            )}
          </div>
        </div>

        {/* Selected Speaker Placement & Aiming Controls */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#161C2B] p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-orange-400/15 border border-orange-400/25 flex items-center justify-center text-orange-300">
                <Compass className="w-3.5 h-3.5" />
              </span>
              스피커 제어
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[10px] font-mono text-slate-300">
              {placements.length}EA
            </span>
          </div>

          {/* Speaker Selector Pills */}
          <div className="flex flex-wrap gap-1.5">
            {placements.map((pl) => (
              <button
                key={pl.id}
                onClick={() => setSelectedPlacementId(pl.id)}
                data-tooltip={`${pl.label} 선택 — 위치(X/Y/Z) 및 지향각 개별 조정`}
                className={`px-2.5 py-1 rounded-full text-[11px] font-mono transition-all ${
                  selectedPlacement?.id === pl.id
                    ? 'bg-orange-400 text-slate-950 font-bold shadow-sm'
                    : 'bg-white/[0.05] border border-white/[0.08] text-slate-300 hover:bg-white/[0.1]'
                }`}
              >
                {pl.label}
              </button>
            ))}
          </div>

          {selectedPlacement && (() => {
            const spkProd = catalogMap.get(selectedPlacement.productId);
            const driveInfo = splSummary.speakerDriveMap[selectedPlacement.nodeId];
            return (
              <div className="space-y-2.5 pt-2.5 border-t border-white/[0.07] text-xs">
                {/* Swap Speaker Model right inside the Acoustic Simulator! */}
                <select
                  value={selectedPlacement.productId}
                  onChange={(e) => onSwapNodeProduct(selectedPlacement.nodeId, e.target.value)}
                  data-tooltip="스피커 모델 변경 (지향각·감도·음압·내역서 즉시 연동)"
                  className="w-full rounded-xl bg-slate-900/90 border border-orange-400/40 focus:border-orange-400 px-2.5 py-1.5 text-[11px] font-mono text-orange-200 focus:outline-none transition-colors"
                >
                  {speakerCatalog.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      [{sp.brand}] {sp.model} ({sp.speaker?.sensitivityDb}dB, {sp.speaker?.dispersionHorizontalDeg}°×{sp.speaker?.dispersionVerticalDeg}°)
                    </option>
                  ))}
                </select>

                {/* Compact Live Amp-to-Speaker Power & SPL Readout */}
                {driveInfo && (
                  <div
                    data-tooltip={`${driveInfo.sourceDescription} | 수평 ${spkProd?.speaker?.dispersionHorizontalDeg}° × 수직 ${spkProd?.speaker?.dispersionVerticalDeg}°`}
                    className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-2.5 py-1.5 font-mono text-[10px] flex items-center justify-between"
                  >
                    <span className="text-slate-400">1m 최대출력</span>
                    <strong className="text-emerald-300">
                      {driveInfo.maxContinuousSpl1m}dB ({spkProd?.speaker?.dispersionHorizontalDeg}°×{spkProd?.speaker?.dispersionVerticalDeg}°)
                    </strong>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <label className="space-y-1" data-tooltip="전후 거리 X좌표(m)">
                    <span className="text-[10px] font-medium text-slate-400 block">X(m)</span>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={room.lengthMeters}
                      value={selectedPlacement.xMeters}
                      onChange={(e) =>
                        onUpdatePlacement(selectedPlacement.id, {
                          xMeters: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-xl bg-slate-900/90 border border-white/[0.1] focus:border-cyan-400/60 focus:outline-none px-2 py-1 font-mono text-slate-200"
                    />
                  </label>
                  <label className="space-y-1" data-tooltip="좌우 폭 Y좌표(m)">
                    <span className="text-[10px] font-medium text-slate-400 block">Y(m)</span>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={room.widthMeters}
                      value={selectedPlacement.yMeters}
                      onChange={(e) =>
                        onUpdatePlacement(selectedPlacement.id, {
                          yMeters: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-xl bg-slate-900/90 border border-white/[0.1] focus:border-cyan-400/60 focus:outline-none px-2 py-1 font-mono text-slate-200"
                    />
                  </label>
                  <label className="space-y-1" data-tooltip="바닥으로부터 설치 높이 Z(m)">
                    <span className="text-[10px] font-medium text-slate-400 block">높이 Z(m)</span>
                    <input
                      type="number"
                      step="0.1"
                      min={0.2}
                      max={room.heightMeters}
                      value={selectedPlacement.zHeightMeters}
                      onChange={(e) =>
                        onUpdatePlacement(selectedPlacement.id, {
                          zHeightMeters: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-xl bg-slate-900/90 border border-white/[0.1] focus:border-cyan-400/60 focus:outline-none px-2 py-1 font-mono text-slate-200"
                    />
                  </label>
                </div>

                {/* Aiming Azimuth & Vertical Tilt Sliders */}
                <div className="space-y-2 pt-1">
                  <label className="block" data-tooltip="수평 지향 회전각 (-90° 좌측 ~ +90° 우측)">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-400">수평 방위각(Pan)</span>
                      <span className="font-mono text-cyan-300">{selectedPlacement.azimuthDeg}°</span>
                    </div>
                    <input
                      type="range"
                      min={-90}
                      max={90}
                      step={2}
                      value={selectedPlacement.azimuthDeg}
                      onChange={(e) =>
                        onUpdatePlacement(selectedPlacement.id, {
                          azimuthDeg: Number(e.target.value),
                        })
                      }
                      className="w-full accent-cyan-400 h-1.5 cursor-pointer"
                    />
                  </label>

                  <label className="block" data-tooltip="수직 하향 틸트각 (0° 정면 ~ 90° 수직하향)">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-400">수직 틸트각(Tilt)</span>
                      <span className="font-mono text-orange-300">{selectedPlacement.tiltDownDeg}°</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={90}
                      step={2}
                      value={selectedPlacement.tiltDownDeg}
                      onChange={(e) =>
                        onUpdatePlacement(selectedPlacement.id, {
                          tiltDownDeg: Number(e.target.value),
                        })
                      }
                      className="w-full accent-orange-400 h-1.5 cursor-pointer"
                    />
                  </label>
                </div>

                <button
                  onClick={() =>
                    onUpdatePlacement(selectedPlacement.id, {
                      muted: !selectedPlacement.muted,
                    })
                  }
                  data-tooltip="개별 스피커 출력 ON/OFF 전환 (음압 분포 비교 테스트용)"
                  className={`w-full py-1.5 rounded-full text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    selectedPlacement.muted
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-400/35 hover:bg-rose-500/25'
                      : 'bg-white/[0.06] border border-white/[0.1] text-slate-200 hover:bg-white/[0.1]'
                  }`}
                >
                  {selectedPlacement.muted ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5" /> MUTE (꺼짐)
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> 출력 ON
                    </>
                  )}
                </button>
              </div>
            );
          })()}
        </div>
      </aside>

      {/* MAIN ACOUSTIC SIMULATION VIEWPORT (KPI STRIP + ADVISOR + TOP-VIEW + SIDE-VIEW) */}
      <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-3.5">
        {/* CRISP MATERIAL 3 TONAL KPI / METRIC CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 font-mono">
          <div
            data-tooltip={`객석 최소 ${splSummary.minSplDb}dB ~ 최대 ${splSummary.maxSplDb}dB`}
            data-tooltip-pos="bottom"
            className="rounded-2xl border border-white/[0.08] bg-[#161C2B] px-3.5 py-2.5 hover:border-sky-400/40 transition-colors"
          >
            <div className="text-[10px] font-sans font-medium text-slate-400">평균음압</div>
            <div className="text-base font-bold text-sky-300 mt-0.5">{splSummary.avgSplDb} dB</div>
          </div>
          <div
            data-tooltip={`최대·최소 음압 편차 ±${splSummary.uniformityPlusMinusDb}dB`}
            data-tooltip-pos="bottom"
            className="rounded-2xl border border-white/[0.08] bg-[#161C2B] px-3.5 py-2.5 hover:border-sky-400/40 transition-colors"
          >
            <div className="text-[10px] font-sans font-medium text-slate-400">음압편차</div>
            <div
              className={`text-base font-bold mt-0.5 ${
                isUniMet ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              ±{splSummary.uniformityPlusMinusDb} dB
            </div>
          </div>
          <div
            data-tooltip="음성명료도 지수 (0.60 이상 양호, 0.75 이상 우수)"
            data-tooltip-pos="bottom"
            className="rounded-2xl border border-white/[0.08] bg-[#161C2B] px-3.5 py-2.5 hover:border-sky-400/40 transition-colors"
          >
            <div className="text-[10px] font-sans font-medium text-slate-400">명료도(STI)</div>
            <div className="text-sm font-bold text-emerald-300 mt-1">
              {splSummary.estimatedSti} <span className="text-[11px] font-normal text-slate-400">({splSummary.stiGrade})</span>
            </div>
          </div>
          <div
            data-tooltip={`목표 음압 도달 비율 ${splSummary.targetCoveragePercent}% (사각지대 ${splSummary.deadSpotPercent}%)`}
            data-tooltip-pos="bottom"
            className="rounded-2xl border border-white/[0.08] bg-[#161C2B] px-3.5 py-2.5 hover:border-sky-400/40 transition-colors"
          >
            <div className="text-[10px] font-sans font-medium text-slate-400">커버리지</div>
            <div
              className={`text-base font-bold mt-0.5 ${
                splSummary.targetCoveragePercent >= 80 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {splSummary.targetCoveragePercent}%
            </div>
          </div>
          <div
            data-tooltip="2대 이상 스피커가 6dB 이내 음압 차이로 동시 도달하는 소리 중첩 구역 비율"
            data-tooltip-pos="bottom"
            className="rounded-2xl border border-white/[0.08] bg-[#161C2B] px-3.5 py-2.5 hover:border-sky-400/40 transition-colors"
          >
            <div className="text-[10px] font-sans font-medium text-slate-400">중첩구역</div>
            <div className="text-base font-bold text-amber-300 mt-0.5">
              {splSummary.overlapZonePercent ?? 0}%
            </div>
          </div>
          <div
            data-tooltip={`위상 동상 보강(▲부스트 +${splSummary.maxBoostDeltaDb ?? 0}dB) / 역상 상쇄(▼딥 ${splSummary.maxDipDeltaDb ?? 0}dB)`}
            data-tooltip-pos="bottom"
            className="rounded-2xl border border-white/[0.08] bg-[#161C2B] px-3.5 py-2.5 hover:border-sky-400/40 transition-colors"
          >
            <div className="text-[10px] font-sans font-medium text-slate-400">부스트 / 딥</div>
            <div className="text-sm font-bold mt-1">
              <span className="text-rose-400">+{splSummary.maxBoostDeltaDb ?? 0}</span>
              <span className="text-slate-500"> / </span>
              <span className="text-sky-400">{splSummary.maxDipDeltaDb ?? 0}dB</span>
            </div>
          </div>
        </div>

        {/* GOAL-DRIVEN ACOUSTIC MODIFICATION ADVISOR */}
        <div className="rounded-2xl border border-sky-400/25 bg-[#161C2B] p-3.5 space-y-3">
          {/* Single-Line Header + Target Criteria Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                data-tooltip="목표 평균음압(dB)과 허용 편차(±dB)를 지정하면 보유 장비 DB 안에서 즉시 적용 가능한 4가지 솔루션을 산출합니다"
                data-tooltip-pos="bottom"
                className="flex items-center gap-2 text-xs font-semibold text-slate-100 whitespace-nowrap cursor-help"
              >
                <span className="w-6 h-6 rounded-lg bg-cyan-400/15 border border-cyan-400/25 flex items-center justify-center text-cyan-300">
                  <Sparkles className="w-3.5 h-3.5" />
                </span>
                목표기준 맞춤설계
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold whitespace-nowrap border ${
                  isSplMet && isUniMet
                    ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30'
                    : 'bg-amber-400/15 text-amber-300 border-amber-400/30'
                }`}
              >
                {isSplMet && isUniMet
                  ? '✓ 목표 충족'
                  : !isSplMet && !isUniMet
                  ? `음압 -${(room.targetSplDb - splSummary.avgSplDb).toFixed(1)}dB · 편차 ±${splSummary.uniformityPlusMinusDb}dB`
                  : !isSplMet
                  ? `음압 -${(room.targetSplDb - splSummary.avgSplDb).toFixed(1)}dB 부족`
                  : `편차 ±${splSummary.uniformityPlusMinusDb}dB 초과`}
              </span>
            </div>

            {/* Compact Target Inputs & Quick Presets */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
              {/* Target Average SPL */}
              <div
                data-tooltip="목표 객석 평균음압(dB) 기준 설정"
                data-tooltip-pos="bottom"
                className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-full border border-white/[0.08]"
              >
                <span className="text-[11px] font-sans text-emerald-300 font-semibold px-1">목표음압</span>
                {[86, 92, 95, 99].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onUpdateRoom({ targetSplDb: val })}
                    className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${
                      room.targetSplDb === val
                        ? 'bg-emerald-400 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    {val}
                  </button>
                ))}
                <input
                  type="number"
                  min={72}
                  max={108}
                  value={room.targetSplDb}
                  onChange={(e) =>
                    onUpdateRoom({ targetSplDb: Math.max(72, Number(e.target.value)) })
                  }
                  className="w-12 rounded-full bg-slate-900 border border-emerald-400/40 px-1.5 py-0.5 text-xs font-bold text-emerald-300 text-right focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 pr-1">dB</span>
              </div>

              {/* Target Uniformity Deviation */}
              <div
                data-tooltip="목표 공간 음압편차(±dB 이내) 기준 설정"
                data-tooltip-pos="bottom"
                className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-full border border-white/[0.08]"
              >
                <span className="text-[11px] font-sans text-amber-300 font-semibold px-1">목표편차</span>
                {[2.0, 3.0, 4.0].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onUpdateRoom({ targetUniformityDb: val })}
                    className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${
                      targetUni === val
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    ±{val}
                  </button>
                ))}
                <input
                  type="number"
                  min={1.0}
                  max={10.0}
                  step={0.5}
                  value={targetUni}
                  onChange={(e) =>
                    onUpdateRoom({ targetUniformityDb: Math.max(1.0, Number(e.target.value)) })
                  }
                  className="w-12 rounded-full bg-slate-900 border border-amber-400/40 px-1.5 py-0.5 text-xs font-bold text-amber-300 text-right focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 pr-1">dB</span>
              </div>

              <button
                onClick={() => setShowAdvisorPanel((v) => !v)}
                data-tooltip="자동 수정제안 카드 접기/펼치기"
                data-tooltip-pos="bottom"
                className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] text-[11px] text-slate-200 font-sans whitespace-nowrap transition-colors"
              >
                {showAdvisorPanel ? '접기 ▲' : `제안(${proposals.length}) ▼`}
              </button>
            </div>
          </div>

          {appliedProposalBanner && (
            <div className="rounded-xl bg-emerald-400/10 border border-emerald-400/30 px-3 py-1.5 text-[11px] text-emerald-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium truncate">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                {appliedProposalBanner}
              </span>
              <button
                onClick={() => setAppliedProposalBanner(null)}
                className="text-emerald-300 hover:text-white text-[10px] font-mono ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* 4 Compact Dashboard Proposal Cards in a Single 4-Column Row (Details in Hover Tooltip) */}
          {showAdvisorPanel && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
              {proposals.map((prop) => {
                const badgeColor =
                  prop.category === 'reposition'
                    ? 'bg-cyan-400/15 text-cyan-300 border-cyan-400/30'
                    : prop.category === 'swap_model'
                    ? 'bg-orange-400/15 text-orange-300 border-orange-400/30'
                    : prop.category === 'add_speakers'
                    ? 'bg-amber-400/15 text-amber-300 border-amber-400/30'
                    : 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30';

                const tooltipDetail = `${prop.description} | 조치: ${prop.actionBullets.join(' / ')}`;

                return (
                  <div
                    key={prop.id}
                    data-tooltip={tooltipDetail}
                    data-tooltip-pos="bottom"
                    className="rounded-2xl border border-white/[0.08] hover:border-cyan-400/45 bg-slate-950/65 p-3 flex flex-col justify-between gap-2.5 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold whitespace-nowrap ${badgeColor}`}
                      >
                        {prop.badgeLabel}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold whitespace-nowrap ${
                          prop.costDeltaKrw === 0
                            ? 'text-cyan-300'
                            : prop.costDeltaKrw > 0
                            ? 'text-amber-300'
                            : 'text-emerald-300'
                        }`}
                      >
                        {prop.costDeltaKrw === 0
                          ? '₩0'
                          : prop.costDeltaKrw > 0
                          ? `+₩${Math.round(prop.costDeltaKrw / 10000)}만`
                          : `-₩${Math.round(Math.abs(prop.costDeltaKrw) / 10000)}만`}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-100 truncate">{prop.title}</div>

                    <div className="flex items-center justify-between gap-1 pt-2 border-t border-white/[0.07]">
                      <div className="text-[10px] font-mono space-y-0.5">
                        <div>
                          <span className="text-slate-500">음압 </span>
                          <span className="text-slate-400">{prop.beforeAvgSplDb}</span>
                          <span className="text-slate-500">➔</span>
                          <strong
                            className={
                              prop.meetsSplTarget ? 'text-emerald-300' : 'text-cyan-300'
                            }
                          >
                            {prop.afterAvgSplDb}dB
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500">편차 </span>
                          <span className="text-slate-400">±{prop.beforeUniformityDb}</span>
                          <span className="text-slate-500">➔</span>
                          <strong
                            className={
                              prop.meetsUniformityTarget ? 'text-emerald-300' : 'text-amber-300'
                            }
                          >
                            ±{prop.afterUniformityDb}dB
                          </strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onApplyProposal(prop);
                          setAppliedProposalBanner(
                            `[${prop.badgeLabel}] ${prop.title} 적용 완료 (평균 ${prop.afterAvgSplDb}dB / 편차 ±${prop.afterUniformityDb}dB)`
                          );
                        }}
                        className="px-3 py-1.5 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[11px] font-bold flex items-center gap-1 shadow-sm whitespace-nowrap transition-colors"
                      >
                        <Zap className="w-3 h-3" /> 적용
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Control Bar & Color Scale Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#161C2B] border border-white/[0.08] rounded-2xl px-4 py-2">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label
              data-tooltip="스피커별 수평 -6dB 지향각 부채꼴 표시/숨김"
              className="flex items-center gap-1.5 cursor-pointer text-slate-200 whitespace-nowrap"
            >
              <input
                type="checkbox"
                checked={showDispersionCones}
                onChange={(e) => setShowDispersionCones(e.target.checked)}
                className="accent-cyan-400"
              />
              지향각 표시
            </label>
            <label
              data-tooltip="3dB 간격 등음압선(Isobar Contour) 표시/숨김"
              className="flex items-center gap-1.5 cursor-pointer text-slate-200 whitespace-nowrap"
            >
              <input
                type="checkbox"
                checked={showIsobars}
                onChange={(e) => setShowIsobars(e.target.checked)}
                className="accent-cyan-400"
              />
              등음압선(3dB)
            </label>
            <label
              data-tooltip="다중 스피커 소리 중첩 시 경로차(Δd)에 따른 동상 보강(▲부스트 +3~6dB) 및 역상 콤필터링 상쇄(▼딥 -3~6dB) 예측 표시"
              className="flex items-center gap-1.5 cursor-pointer text-cyan-300 font-semibold whitespace-nowrap"
            >
              <input
                type="checkbox"
                checked={showInterference}
                onChange={(e) => setShowInterference(e.target.checked)}
                className="accent-cyan-400"
              />
              위상간섭(부스트·딥)
            </label>

            {/* Acoustic Frequency Band Selector */}
            <div
              data-tooltip="주파수 대역별 파장(λ=c/f) 및 지향각 변화에 따른 부스트·딥 간섭 패턴 시뮬레이션"
              className="flex items-center gap-1 bg-slate-950/80 px-1.5 py-0.5 rounded-full border border-white/[0.08] font-mono text-[10px]"
            >
              <span className="text-slate-400 px-1.5 font-sans">대역</span>
              {(
                [
                  { id: 'broadband', label: '전대역' },
                  { id: 100, label: '100Hz' },
                  { id: 250, label: '250Hz' },
                  { id: 1000, label: '1kHz' },
                ] as const
              ).map((b) => (
                <button
                  key={String(b.id)}
                  type="button"
                  onClick={() => setAnalysisBand(b.id)}
                  className={`px-2 py-0.5 rounded-full transition-colors ${
                    analysisBand === b.id
                      ? 'bg-cyan-400 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* dB SPL Color Scale Legend */}
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="text-slate-400">SPL:</span>
            <span className="text-blue-400">70dB</span>
            <div
              className="w-36 h-2.5 rounded-full border border-white/[0.12]"
              style={{
                background:
                  'linear-gradient(90deg, #1d4ed8 0%, #06b6d4 28%, #22c55e 54%, #eab308 78%, #ef4444 100%)',
              }}
            />
            <span className="text-rose-400 font-bold">105dB+</span>
          </div>
        </div>

        {/* 1. TOP-VIEW HORIZONTAL SPL COVERAGE MAP */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#161C2B] p-3.5 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 min-h-7 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                data-tooltip="스피커 아이콘을 드래그하여 위치를 이동하면 공간 음압이 실시간 재계산됩니다"
                className="px-2.5 py-0.5 rounded-full bg-cyan-400/15 border border-cyan-400/30 text-cyan-300 font-mono text-xs font-semibold cursor-help"
              >
                평면도(TOP VIEW)
              </span>
              <span className="text-xs font-medium text-slate-200">
                청취높이 Z={room.earHeightMeters}m
              </span>
              <span
                data-tooltip="구면파 거리감쇠(-20log d, 라인어레이 근거리 -10log d) + 360° 지향성 폴라패턴 + 복소수 위상합성(Phasor Sum) 적용"
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] font-mono text-slate-300 cursor-help"
              >
                이론검증: 역자승법칙(-6dB/2배거리) · 지향성 Q · 위상간섭
              </span>
            </div>
            <div className="h-6 flex items-center">
              {hoverProbe ? (
                <div className="px-3 py-0.5 rounded-full bg-slate-950/90 border border-cyan-400/40 font-mono text-xs text-cyan-300 whitespace-nowrap flex items-center gap-2">
                  <span>
                    ({hoverProbe.xMeters.toFixed(1)}m, {hoverProbe.yMeters.toFixed(1)}m){' '}
                    <strong className="text-white">{hoverProbe.splDb.toFixed(1)} dB</strong>
                  </span>
                  {hoverProbe.overlapCount >= 2 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-400/15 text-amber-300 text-[10px]">
                      중첩 {hoverProbe.overlapCount}대
                    </span>
                  )}
                  {showInterference && hoverProbe.state === 'boost' && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-400/20 text-rose-300 text-[10px] font-bold">
                      ▲부스트 +{hoverProbe.interferenceDeltaDb.toFixed(1)}dB
                    </span>
                  )}
                  {showInterference && hoverProbe.state === 'dip' && (
                    <span className="px-1.5 py-0.2 rounded-full bg-cyan-400/20 text-cyan-300 text-[10px] font-bold">
                      ▼딥 {hoverProbe.interferenceDeltaDb.toFixed(1)}dB
                    </span>
                  )}
                </div>
              ) : (
                <div className="px-3 py-0.5 rounded-full bg-slate-950/50 border border-white/[0.06] font-mono text-[11px] text-slate-500 whitespace-nowrap">
                  도면 위 마우스 이동 시 지점 음압(dB) · 중첩 · 부스트/딥 표시
                </div>
              )}
            </div>
          </div>

          {/* Interactive Aspect-Ratio Preserved Room Box */}
          <div className="flex justify-center items-center py-1.5">
            <div
              onMouseMove={handleTopViewMouseMove}
              onMouseUp={() => setDraggingSpkId(null)}
              onMouseLeave={() => {
                setDraggingSpkId(null);
                setHoverProbe(null);
              }}
              style={{
                width: '100%',
                maxWidth: 880,
                aspectRatio: `${room.lengthMeters} / ${room.widthMeters}`,
                maxHeight: 430,
              }}
              className="relative rounded-xl overflow-hidden border border-white/[0.12] bg-slate-950 shadow-2xl select-none"
            >
              {/* Optional Uploaded Architectural Floorplan Image */}
              {room.floorplanImageUrl && (
                <img
                  src={room.floorplanImageUrl}
                  alt="건축 평면도 배경"
                  style={{ opacity: room.floorplanOpacity }}
                  className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                />
              )}

              {/* Heatmap & Cones Canvas */}
              <canvas
                ref={topCanvasRef}
                width={880}
                height={520}
                className="w-full h-full block pointer-events-none"
              />

              {/* Draggable Speaker Markers on Top-View (Model-Specific CAD Cabinet Outlines & Driver Positions) */}
              {placements.map((spk) => {
                const leftPct = (spk.xMeters / room.lengthMeters) * 100;
                const topPct = (spk.yMeters / room.widthMeters) * 100;
                const isSelected = selectedPlacement?.id === spk.id;
                const prod = catalogMap.get(spk.productId);
                const shape = prod?.enclosureShape || 'trapezoid';
                const modelUpper = `${prod?.brand || ''} ${prod?.model || ''}`.toUpperCase();
                const driverInch = prod?.speaker?.driverSizeInch || 12;

                const isMartinCdd = modelUpper.includes('CDD');
                const isHkFineo = modelUpper.includes('FINEO') || modelUpper.includes('FO ') || modelUpper.includes('HK');
                const isTurboNuq = modelUpper.includes('NUQ');
                const isTurboIq = modelUpper.includes('IQ') || prod?.speaker?.type === 'active';
                const isJblSrx = modelUpper.includes('SRX') || (modelUpper.includes('JBL') && driverInch >= 15);
                const isMartinBlackline = modelUpper.includes('BLACKLINE') || modelUpper.includes('X15');
                const isWallMount = shape === 'wall' || modelUpper.includes('CONTROL 28');
                const isMartinSub = shape === 'subwoofer' && (modelUpper.includes('SX') || modelUpper.includes('MARTIN'));

                const strokeCol = spk.muted
                  ? '#f43f5e'
                  : isSelected
                  ? '#ffffff'
                  : isMartinCdd || isMartinSub
                  ? '#fb7185'
                  : isTurboIq
                  ? '#22d3ee'
                  : isTurboNuq
                  ? '#38bdf8'
                  : prod?.speaker?.type === 'highz_100v' || isWallMount
                  ? '#fbbf24'
                  : isMartinBlackline
                  ? '#f59e0b'
                  : '#f97316';

                return (
                  <div
                    key={spk.id}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setSelectedPlacementId(spk.id);
                      setDraggingSpkId(spk.id);
                    }}
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className={`absolute w-12 h-12 cursor-move z-10 flex items-center justify-center rounded-full ${
                      isSelected
                        ? 'ring-2 ring-orange-400 bg-orange-500/15'
                        : 'hover:ring-2 hover:ring-cyan-400/80 hover:bg-cyan-500/10'
                    }`}
                    title={`${spk.label} (${prod?.brand} ${prod?.model}) — 드래그하여 위치 이동`}
                  >
                    <div
                      style={{ transform: `rotate(${spk.azimuthDeg}deg)` }}
                      className={`pointer-events-none flex items-center justify-center ${
                        spk.muted ? 'opacity-55' : ''
                      }`}
                    >
                      {shape === 'ceiling' ? (
                        /* JBL Control 26CT: Coaxial Ceiling Speaker with Dog-Ear Clamps & Tap Switch */
                        <svg width={38} height={38} viewBox="0 0 38 38">
                          <rect x={16} y={1} width={6} height={3.5} rx={1} fill="#f59e0b" />
                          <rect x={16} y={33.5} width={6} height={3.5} rx={1} fill="#f59e0b" />
                          <circle cx={19} cy={19} r={14} fill="#e2e8f0" stroke={strokeCol} strokeWidth={2} />
                          <circle cx={19} cy={19} r={11} fill="#090d16" stroke="#475569" strokeWidth={1} />
                          <circle cx={13} cy={13} r={1.8} fill="#fbbf24" />
                          <line x1={8} y1={19} x2={30} y2={19} stroke="#64748b" strokeWidth={1.8} />
                          <circle cx={19} cy={19} r={4.5} fill="#090d16" stroke="#f59e0b" strokeWidth={1.2} />
                          <circle cx={19} cy={19} r={2} fill="#fbbf24" />
                        </svg>
                      ) : shape === 'subwoofer' ? (
                        isMartinSub ? (
                          /* Martin Audio SX118: Octagonal Chamfered Sub with 4 Corner Triangular Ports & Ribbed 18" Cone */
                          <svg width={44} height={40} viewBox="0 0 44 40">
                            <polygon
                              points="8,4 28,4 32,8 32,32 28,36 8,36 4,32 4,8"
                              fill="#090d16"
                              stroke={strokeCol}
                              strokeWidth={2}
                            />
                            <polygon points="7,7 12,7 7,12" fill="#fb7185" />
                            <polygon points="29,7 24,7 29,12" fill="#fb7185" />
                            <polygon points="7,33 12,33 7,28" fill="#fb7185" />
                            <polygon points="29,33 24,33 29,28" fill="#fb7185" />
                            <circle cx={18} cy={20} r={9.5} fill="#1e293b" stroke="#fb7185" strokeWidth={1.5} />
                            <line x1={11} y1={13} x2={25} y2={27} stroke="#475569" strokeWidth={1} />
                            <line x1={25} y1={13} x2={11} y2={27} stroke="#475569" strokeWidth={1} />
                            <circle cx={18} cy={20} r={3.5} fill="#090d16" stroke="#fda4af" strokeWidth={1} />
                            <path d="M 35,11 Q 41,20 35,29" fill="none" stroke="#fda4af" strokeWidth={1.8} />
                          </svg>
                        ) : (
                          /* HK Audio FINEO FO S118: Square Install Sub with 18" Cone + Front Laminar Slot Port */
                          <svg width={44} height={40} viewBox="0 0 44 40">
                            <rect x={4} y={4} width={28} height={32} rx={2} fill="#090d16" stroke={strokeCol} strokeWidth={2} />
                            <circle cx={16} cy={20} r={9.5} fill="#1e293b" stroke="#fb923c" strokeWidth={1.5} />
                            <circle cx={16} cy={20} r={3.5} fill="#f97316" />
                            {/* Front Vertical Slot Port along Right Baffle Edge */}
                            <rect x={27.5} y={7} width={2.8} height={26} rx={0.8} fill="#f97316" />
                            <path d="M 35,11 Q 41,20 35,29" fill="none" stroke="#fdba74" strokeWidth={1.8} />
                          </svg>
                        )
                      ) : shape === 'column' ? (
                        /* JBL CBT 70J-1: J-Array Column with Dual-Row Asymmetric Drivers (16 HF + 4 LF) */
                        <svg width={44} height={38} viewBox="0 0 44 38">
                          <path
                            d="M 6,4 L 24,4 L 27,34 L 6,32 Z"
                            fill="#090d16"
                            stroke="#38bdf8"
                            strokeWidth={2}
                          />
                          {[8, 14, 20, 26, 31].map((cy, idx) => (
                            <circle key={`hf-${idx}`} cx={11} cy={cy} r={1.5} fill="#7dd3fc" />
                          ))}
                          {[10, 19, 28].map((cy, idx) => (
                            <circle key={`lf-${idx}`} cx={19} cy={cy} r={3.2} fill="#1e293b" stroke="#f97316" strokeWidth={1.1} />
                          ))}
                          <path d="M 28,8 L 41,19 L 28,30" fill="rgba(56,189,248,0.25)" stroke="#38bdf8" strokeWidth={1.6} />
                        </svg>
                      ) : isMartinCdd ? (
                        /* Martin Audio CDD8 / CDD12: Curved Almond Composite Shell + Single Center Coaxial Star Driver */
                        <svg width={46} height={38} viewBox="0 0 46 38">
                          <path
                            d={
                              driverInch >= 12
                                ? 'M 6,9 Q 16,2 28,4 Q 33,19 28,34 Q 16,36 6,29 Q 2,19 6,9 Z'
                                : 'M 8,11 Q 17,5 27,7 Q 31,19 27,31 Q 17,33 8,27 Q 4,19 8,11 Z'
                            }
                            fill="#090d16"
                            stroke={strokeCol}
                            strokeWidth={2}
                          />
                          {/* Single Coaxial Driver with CDD Star Waveguide in Center */}
                          <circle
                            cx={18}
                            cy={19}
                            r={driverInch >= 12 ? 9.5 : 7.5}
                            fill="#1e293b"
                            stroke="#fb7185"
                            strokeWidth={1.4}
                          />
                          <polygon points="15,15 21,14 21,24 15,23" fill="#090d16" stroke="#fda4af" strokeWidth={1} />
                          <circle cx={18} cy={19} r={2.2} fill="#fb7185" />
                          <line x1={30} y1={19} x2={42} y2={19} stroke="#fb7185" strokeWidth={2} />
                          <polygon points="44,19 38,15.5 38,22.5" fill="#fb7185" />
                        </svg>
                      ) : isHkFineo ? (
                        /* HK Audio FINEO FO 8 / FO 12: Crisp Rectangular German Box + Left Woofer & Right Square BEM Horn */
                        <svg width={46} height={38} viewBox="0 0 46 38">
                          <rect
                            x={4}
                            y={driverInch >= 12 ? 4 : 7}
                            width={driverInch >= 12 ? 25 : 22}
                            height={driverInch >= 12 ? 30 : 24}
                            rx={2}
                            fill="#090d16"
                            stroke={strokeCol}
                            strokeWidth={2}
                          />
                          {/* Rear/Left Woofer + Front/Right Square BEM Waveguide + HK Badge */}
                          <circle
                            cx={12}
                            cy={19}
                            r={driverInch >= 12 ? 7 : 5.5}
                            fill="#1e293b"
                            stroke="#f97316"
                            strokeWidth={1.3}
                          />
                          <rect x={20} y={12} width={6} height={14} rx={1} fill="#1e293b" stroke="#fdba74" strokeWidth={1} />
                          <rect x={16.5} y={17} width={3} height={4} fill="#f97316" />
                          <line x1={29} y1={19} x2={42} y2={19} stroke="#38bdf8" strokeWidth={2} />
                          <polygon points="44,19 38,15.5 38,22.5" fill="#38bdf8" />
                        </svg>
                      ) : isTurboNuq ? (
                        /* Turbosound NuQ102 / NuQ122: Multi-Angle Chamfered Wedge + Elliptical/Octagonal Waveguide */
                        <svg width={46} height={38} viewBox="0 0 46 38">
                          <polygon
                            points="4,13 11,6 26,4 29,9 29,29 26,34 11,32 4,25"
                            fill="#090d16"
                            stroke={strokeCol}
                            strokeWidth={2}
                          />
                          <circle
                            cx={13}
                            cy={19}
                            r={driverInch >= 12 ? 6.8 : 5.5}
                            fill="#1e293b"
                            stroke="#38bdf8"
                            strokeWidth={1.3}
                          />
                          <ellipse cx={23} cy={19} rx={3.5} ry={7} fill="#0284c7" stroke="#7dd3fc" strokeWidth={1} />
                          <line x1={30} y1={19} x2={42} y2={19} stroke="#38bdf8" strokeWidth={2} />
                          <polygon points="44,19 38,15.5 38,22.5" fill="#38bdf8" />
                        </svg>
                      ) : isTurboIq ? (
                        /* Turbosound iQ12 Active DSP Speaker: Rounded Polymer Shell with Cyan Side Ribs & Front LED */
                        <svg width={46} height={38} viewBox="0 0 46 38">
                          <rect x={4} y={5} width={25} height={28} rx={6} fill="#090d16" stroke={strokeCol} strokeWidth={2} />
                          <rect x={11} y={3} width={8} height={2.5} rx={1} fill="#22d3ee" />
                          <rect x={11} y={32.5} width={8} height={2.5} rx={1} fill="#22d3ee" />
                          <circle cx={13} cy={19} r={6.5} fill="#1e293b" stroke="#22d3ee" strokeWidth={1.3} />
                          <polygon points="20,11 27,8 27,30 20,27" fill="#083344" stroke="#67e8f9" strokeWidth={1} />
                          <line x1={30} y1={19} x2={42} y2={19} stroke="#22d3ee" strokeWidth={2} />
                          <polygon points="44,19 38,15.5 38,22.5" fill="#22d3ee" />
                        </svg>
                      ) : isJblSrx ? (
                        /* JBL SRX815: Heavy-Duty 15" Hex Touring Cabinet + Orange Side Handles + Giant PT Horn */
                        <svg width={48} height={40} viewBox="0 0 48 40">
                          <polygon
                            points="3,10 9,3 28,3 31,8 31,32 28,37 9,37 3,30"
                            fill="#090d16"
                            stroke={strokeCol}
                            strokeWidth={2.2}
                          />
                          <rect x={13} y={2} width={7} height={2.5} fill="#f97316" />
                          <rect x={13} y={35.5} width={7} height={2.5} fill="#f97316" />
                          <circle cx={13} cy={20} r={8} fill="#1e293b" stroke="#f97316" strokeWidth={1.5} />
                          <circle cx={13} cy={20} r={3} fill="#f97316" />
                          <rect x={22} y={7} width={6.5} height={26} rx={1} fill="#1e293b" stroke="#fb923c" strokeWidth={1.1} />
                          <line x1={32} y1={20} x2={44} y2={20} stroke="#f97316" strokeWidth={2.2} />
                          <polygon points="46,20 40,16 40,24" fill="#f97316" />
                        </svg>
                      ) : isWallMount ? (
                        /* JBL Control 28-1: Wall Bracket Stem on Rear + Compact Tapered Wall Enclosure */
                        <svg width={46} height={36} viewBox="0 0 46 36">
                          <rect x={1} y={11} width={3} height={14} rx={1} fill="#94a3b8" />
                          <line x1={4} y1={18} x2={9} y2={18} stroke="#fbbf24" strokeWidth={2.5} />
                          <polygon
                            points="9,9 26,5 26,31 9,27"
                            fill="#090d16"
                            stroke={strokeCol}
                            strokeWidth={2}
                          />
                          <circle cx={15} cy={18} r={5} fill="#1e293b" stroke="#fbbf24" strokeWidth={1.2} />
                          <rect x={21} y={10} width={3.5} height={16} fill="#fbbf24" />
                          <line x1={27} y1={18} x2={40} y2={18} stroke="#fbbf24" strokeWidth={2} />
                          <polygon points="42,18 36,14.5 36,21.5" fill="#fbbf24" />
                        </svg>
                      ) : (
                        /* Martin Audio Blackline X15 & Standard Tapered Trapezoid Point-Source */
                        <svg width={46} height={38} viewBox="0 0 46 38">
                          <polygon
                            points="4,11 26,4 28,8 28,30 26,34 4,27"
                            fill="#090d16"
                            stroke={strokeCol}
                            strokeWidth={2.2}
                            strokeLinejoin="round"
                          />
                          <circle cx={13} cy={19} r={7} fill="#1e293b" stroke={strokeCol} strokeWidth={1.4} />
                          <polygon points="20,10 26,7 26,31 20,28" fill="#1e293b" stroke="#fde047" strokeWidth={1} />
                          <line x1={29} y1={19} x2={42} y2={19} stroke="#38bdf8" strokeWidth={2} />
                          <polygon points="44,19 38,15.5 38,22.5" fill="#38bdf8" />
                        </svg>
                      )}
                    </div>
                    <span
                      className={`pointer-events-none absolute ${
                        topPct > 72 ? 'bottom-full mb-1' : 'top-full mt-0.5'
                      } ${
                        leftPct < 14
                          ? 'left-0 translate-x-0'
                          : leftPct > 84
                          ? 'right-0 translate-x-0'
                          : 'left-1/2 -translate-x-1/2'
                      } px-1.5 py-0.5 rounded border text-[9px] font-mono whitespace-nowrap shadow-md ${
                        isSelected
                          ? 'bg-orange-500 text-slate-950 border-white font-bold z-30'
                          : 'bg-slate-950/90 border-slate-700 text-white'
                      }`}
                    >
                      {spk.label}({prod?.model})
                    </span>
                  </div>
                );
              })}

              {/* Dimension Rulers */}
              <div className="absolute bottom-1.5 right-2 px-2.5 py-0.5 rounded-full bg-slate-950/85 border border-white/[0.08] text-[10px] font-mono text-slate-300 pointer-events-none whitespace-nowrap">
                깊이 {room.lengthMeters}m×폭 {room.widthMeters}m(면적 {(room.lengthMeters * room.widthMeters).toFixed(1)}㎡)
              </div>
            </div>
          </div>
        </div>

        {/* 2. SIDE-VIEW VERTICAL ELEVATION CROSS-SECTION */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#161C2B] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span
                data-tooltip="설치 높이(Z) 및 수직 지향각·하향 틸트각에 따른 종단면 음압 투사도"
                className="px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 font-mono text-xs font-semibold cursor-help"
              >
                종단면도(SIDE VIEW)
              </span>
              <span className="text-xs font-medium text-slate-200">
                수직지향 {selectedPlacement ? catalogMap.get(selectedPlacement.productId)?.speaker?.dispersionVerticalDeg : 60}°V
              </span>
            </div>
            <label
              data-tooltip="평면도 상의 Y축 단면 기준선 위치를 이동합니다"
              className="flex items-center gap-2 text-xs text-slate-300 font-mono whitespace-nowrap bg-slate-950/70 px-3 py-1 rounded-full border border-white/[0.08]"
            >
              단면 Y:
              <input
                type="range"
                min={0.5}
                max={room.widthMeters - 0.5}
                step={0.2}
                value={room.sideViewSliceYMeters}
                onChange={(e) =>
                  onUpdateRoom({ sideViewSliceYMeters: Number(e.target.value) })
                }
                className="w-24 accent-amber-400 h-1.5 cursor-pointer"
              />
              <span className="text-amber-300">{room.sideViewSliceYMeters}m</span>
            </label>
          </div>

          <div className="flex justify-center">
            <div className="w-full max-w-[880px] h-44 relative rounded-xl overflow-hidden border border-white/[0.12] bg-slate-950">
              <canvas
                ref={sideCanvasRef}
                width={880}
                height={180}
                className="w-full h-full block"
              />
              <div className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full bg-slate-950/85 border border-white/[0.08] text-[10px] font-mono text-slate-300 whitespace-nowrap">
                천장고 {room.heightMeters}m / 청취귀높이 {room.earHeightMeters}m
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
