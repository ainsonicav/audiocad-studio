import {
  AcousticInterferenceHotspot,
  AmpChannelLoadAnalysis,
  AudioProduct,
  AutoDesignWizardInput,
  CableConnection,
  ConnectionValidationResult,
  OptimizationProposal,
  PortSignalType,
  RoomConfig,
  SignalCategory,
  SpeakerPlacement,
  SPLSimulationSummary,
  SystemNode,
} from '../types/audio';

export function getSignalCategoryFromPortType(portType: PortSignalType): SignalCategory {
  if (portType === 'speaker_lowz' || portType === 'speaker_100v') return 'speaker';
  if (portType === 'network_dante') return 'network';
  return 'signal';
}

export interface CableVisualStyle {
  color: string;
  strokeWidth: number;
  dashArray?: string;
  markerId: string;
  typeLabel: string;
}

export const CABLE_TYPE_LEGEND = [
  { id: 'xlr', label: 'XLR', tooltip: 'XLR 밸런스 마이크·라인 신호선', color: '#06b6d4', isThick: false, isDashed: false },
  { id: 'trs', label: 'TRS(55)', tooltip: 'TRS/TS 6.3mm 라인 신호선', color: '#10b981', isThick: false, isDashed: false },
  { id: 'rca', label: 'RCA/Euro', tooltip: 'RCA 언밸런스 및 Euroblock 설비 신호선', color: '#3b82f6', isThick: false, isDashed: false },
  { id: 'speakon', label: 'NL4(Low-Z)', tooltip: 'Speakon(NL4) 저임피던스(4/8Ω) 스피커 파워선', color: '#f97316', isThick: true, isDashed: false },
  { id: 'highz100v', label: '100V(High-Z)', tooltip: '100V 하이임피던스 분산 스피커 파워선', color: '#eab308', isThick: true, isDashed: false },
  { id: 'dante', label: 'Dante(Cat6)', tooltip: 'Cat6 RJ45 Dante·네트워크 오디오 케이블', color: '#a855f7', isThick: false, isDashed: true },
] as const;

export function getPortPinColor(port: { signalType: PortSignalType; connector?: string }): string {
  if (port.signalType === 'network_dante' || port.connector === 'RJ45') return '#a855f7'; // Violet Purple
  if (port.signalType === 'speaker_100v' || port.connector === 'Terminal100V') return '#eab308'; // Gold Yellow
  if (port.signalType === 'speaker_lowz' || port.connector === 'Speakon') return '#f97316'; // Vivid Orange
  if (port.connector === 'TRS') return '#10b981'; // Emerald Green
  if (port.connector === 'RCA' || port.connector === 'Euroblock') return '#3b82f6'; // Royal Blue
  return '#06b6d4'; // Cyan (XLR Balanced Mic/Line)
}

export function getCableVisualStyle(
  conn: CableConnection,
  nodes: SystemNode[],
  catalogMap: Map<string, AudioProduct>,
  isValid = true
): CableVisualStyle {
  if (!isValid) {
    return {
      color: '#ef4444',
      strokeWidth: 2.6,
      dashArray: '4 3',
      markerId: 'arrow-error',
      typeLabel: '오결선주의',
    };
  }

  const fromNode = nodes.find((n) => n.id === conn.fromNodeId);
  const fromProd = fromNode ? catalogMap.get(fromNode.productId) : undefined;
  const fromPort = fromProd?.ports.find((p) => p.id === conn.fromPortId);
  const sigType = fromPort?.signalType;
  const connector = fromPort?.connector || conn.connectorFrom;

  if (sigType === 'network_dante' || conn.cableCategory === 'network' || connector === 'RJ45') {
    return {
      color: '#a855f7',
      strokeWidth: 2.2,
      dashArray: '6 4',
      markerId: 'arrow-dante',
      typeLabel: 'Cat6 Dante',
    };
  }

  if (sigType === 'speaker_100v' || connector === 'Terminal100V') {
    return {
      color: '#eab308',
      strokeWidth: 3.4,
      markerId: 'arrow-highz100v',
      typeLabel: '100V High-Z',
    };
  }

  if (sigType === 'speaker_lowz' || conn.cableCategory === 'speaker' || connector === 'Speakon') {
    return {
      color: '#f97316',
      strokeWidth: 3.4,
      markerId: 'arrow-speakon',
      typeLabel: 'NL4 스피커선',
    };
  }

  if (connector === 'TRS') {
    return {
      color: '#10b981',
      strokeWidth: 2.2,
      markerId: 'arrow-trs',
      typeLabel: 'TRS 라인선',
    };
  }

  if (connector === 'RCA' || connector === 'Euroblock') {
    return {
      color: '#3b82f6',
      strokeWidth: 2.2,
      markerId: 'arrow-rca',
      typeLabel: `${connector} 신호선`,
    };
  }

  return {
    color: '#06b6d4',
    strokeWidth: 2.2,
    markerId: 'arrow-xlr',
    typeLabel: 'XLR 신호선',
  };
}

export interface RoutedCableGeometry {
  connectionId: string;
  pathD: string;
  badgeX: number;
  badgeY: number;
  jumpArcs: Array<{ cx: number; cy: number; rx: number; ry: number }>;
}

/**
 * Builds a strict 90-degree orthogonal (right-angle) SVG path (`M ... L ...`) between two ports,
 * offsetting parallel vertical segments into dedicated lanes so lines and badges never overlap.
 */
export function buildOrthogonalCablePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  laneIdx: number,
  totalInCorridor = 1
): { pathD: string; badgeX: number; badgeY: number } {
  if (x2 > x1 + 32) {
    const corridorCenter = (x1 + x2) / 2;
    const maxSpread = Math.min(108, Math.max(28, x2 - x1 - 48));
    const step = totalInCorridor > 1 ? Math.min(16, maxSpread / (totalInCorridor - 1)) : 0;
    const laneOffset =
      totalInCorridor > 1
        ? Math.round((laneIdx - (totalInCorridor - 1) / 2) * step)
        : 0;

    const midX = Math.round(corridorCenter + laneOffset);
    const pathD = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;

    const dy = y2 - y1;
    const ratio = 0.28 + (laneIdx % 3) * 0.22;
    const badgeX = midX;
    const badgeY = Math.abs(dy) > 28 ? Math.round(y1 + dy * ratio) : Math.round((y1 + y2) / 2);

    return { pathD, badgeX, badgeY };
  }

  const margin = 26 + (laneIdx % 4) * 12;
  const rightX = Math.round(Math.max(x1, x2) + margin);
  const leftX = Math.round(Math.min(x1, x2) - margin);
  const midY = Math.round((y1 + y2) / 2);

  const pathD = `M ${x1} ${y1} L ${rightX} ${y1} L ${rightX} ${midY} L ${leftX} ${midY} L ${leftX} ${y2} L ${x2} ${y2}`;
  const badgeX = Math.round((rightX + leftX) / 2);
  const badgeY = midY;

  return { pathD, badgeX, badgeY };
}

/**
 * Global Non-Crossing Orthogonal Router + Automatic Semicircular Bridge Jump-Over (`⌒`) Generator.
 * 1. Orders parallel lanes in each corridor using the Left-Edge Non-Crossing River Routing rule:
 *    - Wires going UP (dy < -2) are sorted by (y1 + y2) ascending on the left lanes.
 *    - Wires going DOWN (dy > 2) are sorted by (y1 + y2) descending on the right lanes (so upper wires turn further right than lower wires, eliminating all crossings between parallel buses like CH1/CH2 -> IN1/IN2!).
 * 2. Routes same-column daisy-chains through the empty vertical gap between nodes.
 * 3. Detects all remaining H-V intersections and inserts semicircular hop-over arcs (`A rx ry 0 0 sweep ...`) on horizontal segments wherever they cross vertical segments.
 */
export function routeAllCablesWithJumpOvers(
  connections: CableConnection[],
  nodes: SystemNode[],
  catalogMap: Map<string, AudioProduct>,
  nodeWidth = 256,
  portRowHeight = 24
): Map<string, RoutedCableGeometry> {
  const getHeaderH = (prod?: AudioProduct) => (prod?.category === 'speaker' ? 144 : 114);

  const getPinCoords = (node: SystemNode, portId: string): { x: number; y: number } | null => {
    const prod = catalogMap.get(node.productId);
    if (!prod) return null;
    const inPorts = prod.ports.filter((p) => p.direction === 'in');
    const outPorts = prod.ports.filter((p) => p.direction === 'out');
    const headerH = getHeaderH(prod);

    const inIdx = inPorts.findIndex((p) => p.id === portId);
    if (inIdx !== -1) {
      return {
        x: Math.round(node.x),
        y: Math.round(node.y + headerH + inIdx * portRowHeight + portRowHeight / 2),
      };
    }
    const outIdx = outPorts.findIndex((p) => p.id === portId);
    if (outIdx !== -1) {
      return {
        x: Math.round(node.x + nodeWidth),
        y: Math.round(node.y + headerH + outIdx * portRowHeight + portRowHeight / 2),
      };
    }
    return null;
  };

  interface RawWire {
    conn: CableConnection;
    fromNode: SystemNode;
    toNode: SystemNode;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    isForward: boolean;
    corridorKey: string;
  }

  const rawWires: RawWire[] = [];
  for (const conn of connections) {
    const fromNode = nodes.find((n) => n.id === conn.fromNodeId);
    const toNode = nodes.find((n) => n.id === conn.toNodeId);
    if (!fromNode || !toNode) continue;
    const p1 = getPinCoords(fromNode, conn.fromPortId);
    const p2 = getPinCoords(toNode, conn.toPortId);
    if (!p1 || !p2) continue;

    const isForward = p2.x > p1.x + 32;
    const corridorKey = isForward
      ? `fwd_${Math.round(p1.x / 120)}_${Math.round(p2.x / 120)}`
      : `loop_${Math.round(Math.min(p1.x, p2.x) / 120)}`;

    rawWires.push({
      conn,
      fromNode,
      toNode,
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      isForward,
      corridorKey,
    });
  }

  // Group by corridor and sort each corridor using Non-Crossing Lane Assignment
  const corridors = new Map<string, RawWire[]>();
  for (const w of rawWires) {
    const list = corridors.get(w.corridorKey) || [];
    list.push(w);
    corridors.set(w.corridorKey, list);
  }

  interface PolyWire {
    connId: string;
    pts: Array<{ x: number; y: number }>;
    badgeX: number;
    badgeY: number;
  }

  const polyWires: PolyWire[] = [];

  for (const [, group] of corridors.entries()) {
    if (group[0].isForward) {
      // Partition into going-UP (dy < -2), FLAT (|dy| <= 2), and going-DOWN (dy > 2)
      const upWires = group
        .filter((w) => w.y2 - w.y1 < -2)
        .sort((a, b) => a.y1 + a.y2 - (b.y1 + b.y2) || a.y1 - b.y1);
      const flatWires = group
        .filter((w) => Math.abs(w.y2 - w.y1) <= 2)
        .sort((a, b) => a.y1 - b.y1);
      // Key non-crossing rule for downward wires: LOWER wire turns earlier (smaller midX), UPPER wire turns later (larger midX)!
      const downWires = group
        .filter((w) => w.y2 - w.y1 > 2)
        .sort((a, b) => b.y1 + b.y2 - (a.y1 + a.y2) || b.y1 - a.y1);

      const ordered = [...upWires, ...flatWires, ...downWires];
      const total = ordered.length;

      ordered.forEach((w, laneIdx) => {
        const corridorMinX = w.x1 + 22;
        const corridorMaxX = w.x2 - 22;
        const corridorSpan = Math.max(20, corridorMaxX - corridorMinX);
        const corridorCenter = (corridorMinX + corridorMaxX) / 2;

        const idealStep = 15;
        const maxSpread = Math.min(corridorSpan, Math.max(16, (total - 1) * idealStep));
        const step = total > 1 ? maxSpread / (total - 1) : 0;
        const offset = total > 1 ? (laneIdx - (total - 1) / 2) * step : 0;
        const midX = Math.round(corridorCenter + offset);

        const pts =
          Math.abs(w.y2 - w.y1) <= 1
            ? [
                { x: w.x1, y: w.y1 },
                { x: w.x2, y: w.y2 },
              ]
            : [
                { x: w.x1, y: w.y1 },
                { x: midX, y: w.y1 },
                { x: midX, y: w.y2 },
                { x: w.x2, y: w.y2 },
              ];

        const dy = w.y2 - w.y1;
        const ratio = 0.28 + (laneIdx % 3) * 0.22;
        const badgeX = midX;
        const badgeY = Math.abs(dy) > 28 ? Math.round(w.y1 + dy * ratio) : Math.round((w.y1 + w.y2) / 2);

        polyWires.push({ connId: w.conn.id, pts, badgeX, badgeY });
      });
    } else {
      // Same-column daisy-chain (e.g. Speaker 1 LINK THRU -> Speaker 2 IN)
      group.forEach((w, laneIdx) => {
        const margin = 24 + (laneIdx % 4) * 12;
        const rightX = Math.round(Math.max(w.x1, w.x2) + margin);
        const leftX = Math.round(Math.min(w.x1, w.x2) - margin);

        // Route through the empty vertical gap between the two nodes so we never cross over a node card!
        const fromProd = catalogMap.get(w.fromNode.productId);
        const toProd = catalogMap.get(w.toNode.productId);
        const fromBottom = w.fromNode.y + estimateNodeRenderedHeight(fromProd);
        const toBottom = w.toNode.y + estimateNodeRenderedHeight(toProd);

        let midY = Math.round((w.y1 + w.y2) / 2);
        if (w.toNode.y >= fromBottom - 10) {
          midY = Math.round((fromBottom + w.toNode.y) / 2);
        } else if (w.fromNode.y >= toBottom - 10) {
          midY = Math.round((toBottom + w.fromNode.y) / 2);
        }

        const pts = [
          { x: w.x1, y: w.y1 },
          { x: rightX, y: w.y1 },
          { x: rightX, y: midY },
          { x: leftX, y: midY },
          { x: leftX, y: w.y2 },
          { x: w.x2, y: w.y2 },
        ];
        polyWires.push({
          connId: w.conn.id,
          pts,
          badgeX: Math.round((rightX + leftX) / 2),
          badgeY: midY,
        });
      });
    }
  }

  // Collect all vertical segments across all routed cables for H-V crossing detection
  interface VerticalSeg {
    connId: string;
    x: number;
    yMin: number;
    yMax: number;
  }
  const verticalSegs: VerticalSeg[] = [];
  for (const pw of polyWires) {
    for (let i = 0; i < pw.pts.length - 1; i++) {
      const a = pw.pts[i];
      const b = pw.pts[i + 1];
      if (a.x === b.x && Math.abs(b.y - a.y) > 2) {
        verticalSegs.push({
          connId: pw.connId,
          x: a.x,
          yMin: Math.min(a.y, b.y),
          yMax: Math.max(a.y, b.y),
        });
      }
    }
  }

  // Build final SVG path strings with Semicircular Bridge Hop-Over Arcs (`⌒`) at every H-V intersection
  const result = new Map<string, RoutedCableGeometry>();
  const JUMP_R = 8; // Crisp, clearly visible jump bridge radius

  for (const pw of polyWires) {
    const jumpArcs: Array<{ cx: number; cy: number; rx: number; ry: number }> = [];
    if (pw.pts.length === 0) continue;

    let d = `M ${pw.pts[0].x} ${pw.pts[0].y}`;

    for (let i = 0; i < pw.pts.length - 1; i++) {
      const p1 = pw.pts[i];
      const p2 = pw.pts[i + 1];

      // Horizontal segment: check if it crosses any vertical segments of other cables
      if (p1.y === p2.y && Math.abs(p2.x - p1.x) > 6) {
        const yH = p1.y;
        const xMin = Math.min(p1.x, p2.x);
        const xMax = Math.max(p1.x, p2.x);
        const dir = p2.x >= p1.x ? 1 : -1;

        // Find all vertical segment X positions crossed by this horizontal segment
        // Robust intersection condition: vertical line passes cleanly across horizontal line
        const crossedXs = verticalSegs
          .filter(
            (v) =>
              v.connId !== pw.connId &&
              v.x > xMin + 4 &&
              v.x < xMax - 4 &&
              yH >= v.yMin &&
              yH <= v.yMax
          )
          .map((v) => v.x);

        const uniqueSortedXs = Array.from(new Set(crossedXs)).sort((a, b) => a - b);

        if (uniqueSortedXs.length > 0) {
          // Merge closely spaced vertical crossings into clean combined bridge intervals
          const intervals: Array<{ minX: number; maxX: number }> = [];
          for (const cx of uniqueSortedXs) {
            const ivMin = Math.max(xMin, cx - JUMP_R);
            const ivMax = Math.min(xMax, cx + JUMP_R);
            if (intervals.length > 0 && ivMin <= intervals[intervals.length - 1].maxX + 2) {
              intervals[intervals.length - 1].maxX = Math.max(intervals[intervals.length - 1].maxX, ivMax);
            } else {
              intervals.push({ minX: ivMin, maxX: ivMax });
            }
          }

          if (dir === -1) {
            intervals.reverse();
          }

          for (const iv of intervals) {
            const startX = dir === 1 ? iv.minX : iv.maxX;
            const endX = dir === 1 ? iv.maxX : iv.minX;
            const span = Math.abs(endX - startX);
            const rx = Math.round((span / 2) * 10) / 10;
            const ry = Math.round(Math.min(10, Math.max(6, span * 0.55)) * 10) / 10;
            const sweepFlag = dir === 1 ? 1 : 0; // Always arch UPWARD (`⌒`) in screen coordinates

            d += ` L ${startX} ${yH} A ${rx} ${ry} 0 0 ${sweepFlag} ${endX} ${yH}`;
            jumpArcs.push({ cx: (startX + endX) / 2, cy: yH, rx, ry });
          }
        }

        d += ` L ${p2.x} ${p2.y}`;
      } else {
        d += ` L ${p2.x} ${p2.y}`;
      }
    }

    result.set(pw.connId, {
      connectionId: pw.connId,
      pathD: d,
      badgeX: pw.badgeX,
      badgeY: pw.badgeY,
      jumpArcs,
    });
  }

  return result;
}

/**
 * Calculates exact rendered height of a SystemNode card (including header, SVG artwork,
 * port rows, and bottom amplifier load status pills) so nodes never overlap vertically.
 */
export function estimateNodeRenderedHeight(prod?: AudioProduct): number {
  if (!prod) return 180;
  const headerH = prod.category === 'speaker' ? 144 : 114;
  const inCount = prod.ports.filter((p) => p.direction === 'in').length;
  const outCount = prod.ports.filter((p) => p.direction === 'out').length;
  const maxPortRows = Math.max(inCount, outCount, 1);
  const ampExtraH =
    prod.category === 'amplifier' ? (prod.amplifier?.channels || 2) * 24 + 18 : 0;
  return headerH + maxPortRows * 24 + 14 + ampExtraH;
}

/**
 * Arranges all nodes into clean, non-overlapping signal-flow columns with wide cable corridors.
 */
export function computeCleanNodeLayout(
  nodes: SystemNode[],
  catalogMap: Map<string, AudioProduct>
): SystemNode[] {
  const colX: Record<AudioProduct['category'], number> = {
    source_mic: 50,
    mixer: 460,
    dsp: 870,
    network: 870,
    amplifier: 1280,
    speaker: 1690,
  };

  // Group dsp and network into column 3 (870px) so they share a single Y tracker and never collide!
  const colYTracker: Record<string, number> = {
    col_source: 55,
    col_mixer: 90,
    col_dsp_net: 80,
    col_amp: 70,
    col_speaker: 55,
  };

  const getTrackerKey = (cat: AudioProduct['category']) => {
    if (cat === 'source_mic') return 'col_source';
    if (cat === 'mixer') return 'col_mixer';
    if (cat === 'dsp' || cat === 'network') return 'col_dsp_net';
    if (cat === 'amplifier') return 'col_amp';
    return 'col_speaker';
  };

  return nodes.map((node) => {
    const prod = catalogMap.get(node.productId);
    const cat = prod?.category || 'speaker';
    const trackerKey = getTrackerKey(cat);
    const x = colX[cat];
    const y = colYTracker[trackerKey];
    const nodeH = estimateNodeRenderedHeight(prod);
    colYTracker[trackerKey] = y + nodeH + 28; // 28px clean vertical margin between nodes
    return { ...node, x, y };
  });
}

export function validateConnection(
  conn: CableConnection,
  nodes: SystemNode[],
  catalogMap: Map<string, AudioProduct>
): ConnectionValidationResult {
  const fromNode = nodes.find((n) => n.id === conn.fromNodeId);
  const toNode = nodes.find((n) => n.id === conn.toNodeId);
  if (!fromNode || !toNode) {
    return {
      connectionId: conn.id,
      isValid: false,
      severity: 'error',
      message: '연결된 장비 노드를 찾을 수 없습니다.',
      technicalBadge: 'ERR',
    };
  }

  const fromProd = catalogMap.get(fromNode.productId);
  const toProd = catalogMap.get(toNode.productId);
  const fromPort = fromProd?.ports.find((p) => p.id === conn.fromPortId);
  const toPort = toProd?.ports.find((p) => p.id === conn.toPortId);

  if (!fromPort || !toPort) {
    return {
      connectionId: conn.id,
      isValid: false,
      severity: 'error',
      message: '포트 사양 정보를 찾을 수 없습니다.',
      technicalBadge: 'PORT ERR',
    };
  }

  if (fromPort.direction !== 'out' || toPort.direction !== 'in') {
    return {
      connectionId: conn.id,
      isValid: false,
      severity: 'error',
      message: `신호 방향 오류: 출력(OUT) 포트에서 입력(IN) 포트로만 연결해야 합니다.`,
      technicalBadge: '역방향 오류',
    };
  }

  // Check signal type compatibility
  if (fromPort.signalType !== toPort.signalType) {
    if (
      (fromPort.signalType === 'speaker_lowz' || fromPort.signalType === 'speaker_100v') &&
      toPort.signalType === 'mic_line'
    ) {
      return {
        connectionId: conn.id,
        isValid: false,
        severity: 'error',
        message: '치명적 오결선: 파워앰프 고전압 스피커 출력을 라인/마이크 입력에 연결하면 장비가 손상됩니다!',
        technicalBadge: '고전압 오결선 위험!',
      };
    }

    if (
      (fromPort.signalType === 'speaker_lowz' && toPort.signalType === 'speaker_100v') ||
      (fromPort.signalType === 'speaker_100v' && toPort.signalType === 'speaker_lowz')
    ) {
      return {
        connectionId: conn.id,
        isValid: false,
        severity: 'error',
        message: '임피던스 방식 불일치: 저임피던스(4/8Ω) 포트와 고임피던스(100V 라인트랜스) 포트는 혼용할 수 없습니다.',
        technicalBadge: 'Low-Z / 100V 불일치',
      };
    }

    return {
      connectionId: conn.id,
      isValid: false,
      severity: 'error',
      message: `신호 규격 불일치: ${fromPort.signalType} 출력을 ${toPort.signalType} 입력에 직접 연결할 수 없습니다.`,
      technicalBadge: '신호 규격 불일치',
    };
  }

  if (fromPort.signalType === 'network_dante') {
    return {
      connectionId: conn.id,
      isValid: true,
      severity: 'ok',
      message: 'Dante / AES67 기가비트 네트워크 오디오 링크 정상',
      technicalBadge: 'Cat6 Dante (1Gbps)',
    };
  }

  if (fromPort.signalType === 'speaker_lowz') {
    return {
      connectionId: conn.id,
      isValid: true,
      severity: 'ok',
      message: `Low-Z 스피커 파워 라인 (${fromPort.connector} → ${toPort.connector})`,
      technicalBadge: `SPK ${fromPort.connector}`,
    };
  }

  if (fromPort.signalType === 'speaker_100v') {
    return {
      connectionId: conn.id,
      isValid: true,
      severity: 'ok',
      message: '100V 하이임피던스 스피커 라인 연결 정상',
      technicalBadge: '100V High-Z Line',
    };
  }

  return {
    connectionId: conn.id,
    isValid: true,
    severity: 'ok',
    message: `오디오 신호 라인 (${fromPort.connector} → ${toPort.connector})`,
    technicalBadge: `${fromPort.connector}→${toPort.connector}`,
  };
}

/**
 * Traces all amplifier speaker output channels, including daisy-chained speakers (LINK THRU),
 * and calculates total impedance, delivered power per speaker, and headroom status.
 */
export function analyzeAmplifierLoads(
  nodes: SystemNode[],
  connections: CableConnection[],
  catalogMap: Map<string, AudioProduct>
): AmpChannelLoadAnalysis[] {
  const results: AmpChannelLoadAnalysis[] = [];

  const ampNodes = nodes.filter((n) => catalogMap.get(n.productId)?.category === 'amplifier');

  for (const ampNode of ampNodes) {
    const ampProduct = catalogMap.get(ampNode.productId);
    if (!ampProduct || !ampProduct.amplifier) continue;

    const spkOutPorts = ampProduct.ports.filter(
      (p) => p.direction === 'out' && (p.signalType === 'speaker_lowz' || p.signalType === 'speaker_100v')
    );

    for (const outPort of spkOutPorts) {
      // Traverse chain starting from (ampNode.id, outPort.id)
      const visitedNodeIds = new Set<string>();
      const chainSpeakers: { node: SystemNode; product: AudioProduct }[] = [];

      const queue: { fromNodeId: string; fromPortId?: string }[] = [
        { fromNodeId: ampNode.id, fromPortId: outPort.id },
      ];

      while (queue.length > 0) {
        const current = queue.shift()!;
        const outgoingConns = connections.filter(
          (c) =>
            c.fromNodeId === current.fromNodeId &&
            (current.fromPortId ? c.fromPortId === current.fromPortId : true) &&
            c.cableCategory === 'speaker'
        );

        for (const conn of outgoingConns) {
          if (visitedNodeIds.has(conn.toNodeId)) continue;
          const targetNode = nodes.find((n) => n.id === conn.toNodeId);
          if (!targetNode) continue;
          const targetProd = catalogMap.get(targetNode.productId);
          if (!targetProd || targetProd.category !== 'speaker' || !targetProd.speaker) continue;

          visitedNodeIds.add(targetNode.id);
          chainSpeakers.push({ node: targetNode, product: targetProd });

          // Also follow any speaker LINK THRU ports from this speaker
          const thruPorts = targetProd.ports.filter(
            (p) => p.direction === 'out' && (p.signalType === 'speaker_lowz' || p.signalType === 'speaker_100v')
          );
          for (const thru of thruPorts) {
            queue.push({ fromNodeId: targetNode.id, fromPortId: thru.id });
          }
        }
      }

      const chIdx = outPort.ampChannel || outPort.channelIndex;

      if (chainSpeakers.length === 0) {
        results.push({
          ampNodeId: ampNode.id,
          ampLabel: ampNode.customLabel,
          ampProduct,
          channelIndex: chIdx,
          portId: outPort.id,
          portLabel: outPort.label,
          connectedSpeakerNodes: [],
          mode: 'unconnected',
          totalImpedanceOhms: null,
          ampAvailableWattsAtLoad: ampProduct.amplifier.watts8OhmPerCh,
          totalTapWatts100v: 0,
          status: 'unconnected',
          statusMessage: '미연결 (대기 채널)',
        });
        continue;
      }

      // High-Z 100V Mode
      if (outPort.signalType === 'speaker_100v') {
        const max100vWatts =
          ampProduct.amplifier.watts100vPerCh || ampProduct.amplifier.watts8OhmPerCh;
        let totalTap = 0;
        const connectedSpeakerNodes = chainSpeakers.map(({ node, product }) => {
          const tapW =
            node.selectedTapWatts ||
            product.speaker?.tap100vWatts ||
            product.speaker?.rmsWatts ||
            30;
          totalTap += tapW;
          return {
            nodeId: node.id,
            label: node.customLabel,
            product,
            deliveredWatts: tapW,
            rmsWatts: tapW,
            headroomRatio: 1.0,
          };
        });

        const loadRatio = totalTap / max100vWatts;
        let status: AmpChannelLoadAnalysis['status'] = 'optimal';
        let statusMessage = `100V 매칭 적정(탭 합계 ${totalTap}W/앰프 ${max100vWatts}W, 부하율 ${Math.round(loadRatio * 100)}%)`;

        if (loadRatio > 1.0) {
          status = 'overloaded';
          statusMessage = `100V 과부하 위험! 탭 합계(${totalTap}W)가 앰프 정격(${max100vWatts}W)을 초과했습니다.`;
        } else if (loadRatio > 0.85) {
          status = 'acceptable';
          statusMessage = `100V 여유분 주의(부하율 ${Math.round(loadRatio * 100)}%, 권장 80% 이하)`;
        }

        results.push({
          ampNodeId: ampNode.id,
          ampLabel: ampNode.customLabel,
          ampProduct,
          channelIndex: chIdx,
          portId: outPort.id,
          portLabel: outPort.label,
          connectedSpeakerNodes,
          mode: 'highz_100v',
          totalImpedanceOhms: null,
          ampAvailableWattsAtLoad: max100vWatts,
          totalTapWatts100v: totalTap,
          status,
          statusMessage,
        });
        continue;
      }

      // Low-Z Mode: Parallel Impedance Calculation: 1 / Z_total = sum(1 / Z_i)
      let invImpedanceSum = 0;
      for (const { product } of chainSpeakers) {
        const z = product.speaker?.impedanceOhms || 8;
        if (z > 0) invImpedanceSum += 1 / z;
      }
      const totalImpedanceOhms =
        invImpedanceSum > 0 ? Math.round((1 / invImpedanceSum) * 100) / 100 : 8;

      // Interpolate Amplifier Power at totalImpedanceOhms
      const ampSpec = ampProduct.amplifier;
      let ampWattsAtLoad = ampSpec.watts8OhmPerCh;
      if (totalImpedanceOhms <= 2.5) {
        ampWattsAtLoad = ampSpec.watts2OhmPerCh || Math.round(ampSpec.watts4OhmPerCh * 1.3);
      } else if (totalImpedanceOhms <= 4.5) {
        ampWattsAtLoad = ampSpec.watts4OhmPerCh;
      } else if (totalImpedanceOhms < 8) {
        // Linear interpolation between 4 ohm and 8 ohm
        const t = (8 - totalImpedanceOhms) / 4;
        ampWattsAtLoad = Math.round(
          ampSpec.watts8OhmPerCh + t * (ampSpec.watts4OhmPerCh - ampSpec.watts8OhmPerCh)
        );
      }

      const connectedSpeakerNodes = chainSpeakers.map(({ node, product }) => {
        const spkZ = product.speaker?.impedanceOhms || 8;
        const spkRms = product.speaker?.rmsWatts || 300;
        // Power share in parallel network: P_i = V^2 / Z_i, so P_i = P_total * (Z_total / Z_i)
        const deliveredWatts = Math.round(ampWattsAtLoad * (totalImpedanceOhms / spkZ));
        const headroomRatio = Math.round((deliveredWatts / spkRms) * 100) / 100;
        return {
          nodeId: node.id,
          label: node.customLabel,
          product,
          deliveredWatts,
          rmsWatts: spkRms,
          headroomRatio,
        };
      });

      const minRatio = Math.min(...connectedSpeakerNodes.map((s) => s.headroomRatio));
      const maxRatio = Math.max(...connectedSpeakerNodes.map((s) => s.headroomRatio));

      let status: AmpChannelLoadAnalysis['status'] = 'optimal';
      let statusMessage = '';

      if (totalImpedanceOhms < ampSpec.minImpedanceOhms - 0.1) {
        status = 'overloaded';
        statusMessage = `임피던스 과부하 위험! 합성 ${totalImpedanceOhms}Ω < 앰프 최소허용 ${ampSpec.minImpedanceOhms}Ω`;
      } else if (maxRatio > 2.2) {
        status = 'overloaded';
        statusMessage = `스피커 허용입력 대비 과출력 주의(${Math.round(maxRatio * 100)}% · 리미터 설정 필수)`;
      } else if (minRatio < 0.7) {
        status = 'underpowered';
        statusMessage = `앰프 출력 부족(${Math.round(minRatio * 100)}% · 클리핑 왜곡 우려, 권장 100~160%)`;
      } else if (minRatio >= 1.0 && maxRatio <= 1.8) {
        status = 'optimal';
        statusMessage = `최적 매칭(${totalImpedanceOhms}Ω 부하, 헤드룸 ${Math.round(minRatio * 100)}% 확보)`;
      } else {
        status = 'acceptable';
        statusMessage = `구동 가능(${totalImpedanceOhms}Ω 부하, 매칭비 ${Math.round(minRatio * 100)}%)`;
      }

      results.push({
        ampNodeId: ampNode.id,
        ampLabel: ampNode.customLabel,
        ampProduct,
        channelIndex: chIdx,
        portId: outPort.id,
        portLabel: outPort.label,
        connectedSpeakerNodes,
        mode: 'lowz',
        totalImpedanceOhms,
        ampAvailableWattsAtLoad: ampWattsAtLoad,
        totalTapWatts100v: 0,
        status,
        statusMessage,
      });
    }
  }

  return results;
}

export type AcousticAnalysisBand = 'broadband' | 100 | 250 | 1000;

export interface PointAcousticFieldResult {
  /** Final SPL (dB) incorporating phase interference when enabled */
  splDb: number;
  /** Pure scalar energy summation SPL (dB) without phase interference */
  incoherentSplDb: number;
  /** Phase interference delta (dB) = coherentSplDb - incoherentSplDb (+boost / -dip) */
  interferenceDeltaDb: number;
  /** Number of speakers overlapping within 6 dB of the loudest speaker at this point */
  overlapCount: number;
  /** Classification of acoustic state at this point */
  state: 'normal' | 'boost' | 'dip' | 'overlap';
}

const SPEED_OF_SOUND_MPS = 343.0; // m/s at 20°C

/**
 * Evaluates full 3D acoustic field at target point (x, y, z) according to acoustic propagation theory:
 * 1. Distance Law:
 *    - Point source / Subwoofer / Ceiling: Spherical divergence (-20*log10(d) = -6 dB per distance doubling)
 *    - Column / Line array: Cylindrical near-field (-10*log10(d) = -3 dB per doubling up to transition distance ~5m), then spherical (-20*log10(d))
 * 2. 360° 3D Polar Directivity:
 *    - Exact -6 dB attenuation at +/- half nominal beamwidth (dispersionH/2, dispersionV/2)
 *    - Frequency-dependent directivity (wider beamwidth at 100Hz low frequencies, tighter at 1kHz+)
 *    - Realistic rear-baffle diffraction & front-to-back rejection (-18 ~ -24 dB behind speaker cabinet)
 * 3. Complex Acoustic Wave Phase Summation (Constructive Boost & Destructive Cancellation Dip):
 *    - Computes complex pressure P = sum(10^(L_i/20) * e^(-j * 2*pi*f * d_i / c))
 *    - Predicts Power Alley constructive boost (up to +6 dB over 1 spk / +3 dB over energy sum) and Comb-Filtering nulls/dips (-3 ~ -9 dB) where multiple speakers overlap.
 */
export function calculatePointAcousticFieldAt3D(
  targetX: number,
  targetY: number,
  targetZ: number,
  placements: SpeakerPlacement[],
  catalogMap: Map<string, AudioProduct>,
  speakerDriveMap: SPLSimulationSummary['speakerDriveMap'],
  band: AcousticAnalysisBand = 'broadband',
  enablePhaseInterference = true
): PointAcousticFieldResult {
  const contributions: {
    splDb: number;
    dist3D: number;
    isSub: boolean;
  }[] = [];

  for (const spk of placements) {
    if (spk.muted) continue;
    const prod = catalogMap.get(spk.productId);
    if (!prod || !prod.speaker) continue;

    // If analyzing mid/high band (1000Hz), subwoofers (<150Hz) do not radiate 1kHz
    const isSub = prod.speaker.type === 'subwoofer';
    if (band === 1000 && isSub) continue;

    const driveInfo = speakerDriveMap[spk.nodeId];
    const effectiveWatts = driveInfo
      ? Math.min(driveInfo.deliveredWatts, prod.speaker.programWatts)
      : prod.speaker.rmsWatts;

    if (effectiveWatts <= 0.1) continue;

    // 1m On-axis continuous SPL
    const spl1m = prod.speaker.sensitivityDb + 10 * Math.log10(effectiveWatts);

    // 3D Vector from speaker to listener point
    const dx = targetX - spk.xMeters;
    const dy = targetY - spk.yMeters;
    const dz = targetZ - spk.zHeightMeters;

    const dist3D = Math.max(0.65, Math.sqrt(dx * dx + dy * dy + dz * dz));

    // Distance Attenuation: Column array cylindrical near-field (-3dB/2x) vs Point source spherical (-6dB/2x)
    let distanceLossDb = -20 * Math.log10(dist3D);
    if (prod.speaker.type === 'column') {
      const dTrans = 5.0; // Cylindrical-to-spherical transition distance (m)
      if (dist3D <= dTrans) {
        distanceLossDb = -10 * Math.log10(dist3D);
      } else {
        distanceLossDb = -10 * Math.log10(dTrans) - 20 * Math.log10(dist3D / dTrans);
      }
    }

    // 3D Polar Directivity Attenuation
    let directivityLossDb = 0;
    if (!isSub && prod.speaker.dispersionHorizontalDeg < 350) {
      // Frequency-dependent dispersion widening factor (horns are wider at 100Hz/250Hz than at 1kHz)
      const freqWidthFactor = band === 100 ? 1.65 : band === 250 ? 1.25 : 1.0;

      if (spk.tiltDownDeg >= 80) {
        // Down-firing ceiling speaker conical pattern
        const radialDist = Math.sqrt(dx * dx + dy * dy);
        const verticalDrop = Math.max(0.2, Math.abs(dz));
        const coneAngle = (Math.atan2(radialDist, verticalDrop) * 180) / Math.PI;
        const halfCone = Math.min(90, (prod.speaker.dispersionHorizontalDeg / 2) * freqWidthFactor);
        directivityLossDb = -Math.min(24, 6 * Math.pow(coneAngle / halfCone, 2));
      } else {
        // Transform (dx, dy, dz) into speaker's local 3D aiming coordinate frame
        const azRad = (spk.azimuthDeg * Math.PI) / 180;
        const tiltRad = (spk.tiltDownDeg * Math.PI) / 180;

        // Horizontal rotation by -azRad
        const xHoriz = dx * Math.cos(azRad) + dy * Math.sin(azRad);
        const yHoriz = -dx * Math.sin(azRad) + dy * Math.cos(azRad);

        // Vertical rotation by tiltDownDeg
        const xLocal = xHoriz * Math.cos(tiltRad) - dz * Math.sin(tiltRad);
        const yLocal = yHoriz;
        const zLocal = xHoriz * Math.sin(tiltRad) + dz * Math.cos(tiltRad);

        // Full 0° ~ 180° off-axis angles (including rear hemisphere xLocal < 0!)
        const offAxisH = Math.abs((Math.atan2(yLocal, xLocal) * 180) / Math.PI);
        const forwardProj = Math.sqrt(xLocal * xLocal + yLocal * yLocal);
        const offAxisV = Math.abs((Math.atan2(zLocal, Math.max(0.1, forwardProj)) * 180) / Math.PI);

        const halfH = Math.min(140, Math.max(12, (prod.speaker.dispersionHorizontalDeg / 2) * freqWidthFactor));
        const halfV = Math.min(120, Math.max(10, (prod.speaker.dispersionVerticalDeg / 2) * freqWidthFactor));

        // Exact -6.0 dB at halfH / halfV boundary, smooth baffle roll-off into rear hemisphere
        const lossH = 6 * Math.pow(offAxisH / halfH, 1.85);
        const lossV = 6 * Math.pow(offAxisV / halfV, 1.85);
        const maxRearAtten = band === 100 ? 12 : band === 250 ? 18 : 24;
        directivityLossDb = -Math.min(maxRearAtten, lossH + lossV);
      }
    }

    const pointSpl = spl1m + distanceLossDb + directivityLossDb;
    contributions.push({
      splDb: pointSpl,
      dist3D,
      isSub,
    });
  }

  if (contributions.length === 0) {
    return {
      splDb: 35,
      incoherentSplDb: 35,
      interferenceDeltaDb: 0,
      overlapCount: 0,
      state: 'normal',
    };
  }

  // 1. Incoherent Power Summation: 10 * log10( sum(10^(L_i / 10)) )
  let incoherentPowerSum = 0;
  let maxSingleSpl = -Infinity;
  for (const c of contributions) {
    incoherentPowerSum += Math.pow(10, c.splDb / 10);
    if (c.splDb > maxSingleSpl) maxSingleSpl = c.splDb;
  }
  const incoherentSplDb = 10 * Math.log10(Math.max(1e-9, incoherentPowerSum));

  // Count how many speakers overlap within 6 dB of the strongest speaker at this point
  const overlapCount = contributions.filter((c) => maxSingleSpl - c.splDb <= 6.0).length;

  if (!enablePhaseInterference || contributions.length < 2) {
    return {
      splDb: Math.round(incoherentSplDb * 10) / 10,
      incoherentSplDb: Math.round(incoherentSplDb * 10) / 10,
      interferenceDeltaDb: 0,
      overlapCount,
      state: overlapCount >= 2 ? 'overlap' : 'normal',
    };
  }

  // 2. Coherent Complex Wave Phase Summation:
  //    Evaluate complex pressure phasor sum P(f) = sum_i 10^(L_i/20) * exp(-j * 2*pi*f * d_i / c)
  const evalCoherentPowerAtFreq = (freqHz: number): number => {
    const k = (2 * Math.PI * freqHz) / SPEED_OF_SOUND_MPS;
    let re = 0;
    let im = 0;
    for (const c of contributions) {
      // Subwoofers only participate in low-frequency coherent interference (<=160Hz)
      if (c.isSub && freqHz > 180) continue;
      const amp = Math.pow(10, c.splDb / 20);
      const phase = k * c.dist3D;
      re += amp * Math.cos(phase);
      im += amp * Math.sin(phase);
    }
    // Include 15% diffuse room reverberant energy floor so deep phase nulls don't drop to -infinity
    const directCoherentPower = re * re + im * im;
    return 0.85 * directCoherentPower + 0.15 * incoherentPowerSum;
  };

  let coherentPower = incoherentPowerSum;
  if (band === 'broadband') {
    // Weighted multi-band pink-noise coherent integration (90Hz, 180Hz, 350Hz, 700Hz)
    const freqs = [
      { f: 95, w: 0.32 },
      { f: 190, w: 0.30 },
      { f: 380, w: 0.22 },
      { f: 800, w: 0.16 },
    ];
    let weightedPower = 0;
    for (const item of freqs) {
      weightedPower += item.w * evalCoherentPowerAtFreq(item.f);
    }
    coherentPower = weightedPower;
  } else {
    coherentPower = evalCoherentPowerAtFreq(band);
  }

  const coherentSplDb = 10 * Math.log10(Math.max(1e-9, coherentPower));
  const rawDelta = coherentSplDb - incoherentSplDb;
  const interferenceDeltaDb = Math.round(rawDelta * 10) / 10;

  let state: PointAcousticFieldResult['state'] = 'normal';
  if (overlapCount >= 2) {
    if (interferenceDeltaDb >= 1.2) {
      state = 'boost';
    } else if (interferenceDeltaDb <= -1.5) {
      state = 'dip';
    } else {
      state = 'overlap';
    }
  }

  return {
    splDb: Math.round(coherentSplDb * 10) / 10,
    incoherentSplDb: Math.round(incoherentSplDb * 10) / 10,
    interferenceDeltaDb,
    overlapCount,
    state,
  };
}

/**
 * Calculates 3D SPL at target point (x, y, z) from all placed speakers,
 * adhering to spherical/cylindrical divergence, 360° polar directivity, and acoustic wave interference.
 */
export function calculatePointSplAt3D(
  targetX: number,
  targetY: number,
  targetZ: number,
  placements: SpeakerPlacement[],
  catalogMap: Map<string, AudioProduct>,
  speakerDriveMap: SPLSimulationSummary['speakerDriveMap'],
  band: AcousticAnalysisBand = 'broadband',
  enablePhaseInterference = true
): number {
  return calculatePointAcousticFieldAt3D(
    targetX,
    targetY,
    targetZ,
    placements,
    catalogMap,
    speakerDriveMap,
    band,
    enablePhaseInterference
  ).splDb;
}

export function computeRoomSplSimulation(
  room: RoomConfig,
  placements: SpeakerPlacement[],
  nodes: SystemNode[],
  connections: CableConnection[],
  catalogMap: Map<string, AudioProduct>
): {
  summary: SPLSimulationSummary;
  ampLoads: AmpChannelLoadAnalysis[];
} {
  const ampLoads = analyzeAmplifierLoads(nodes, connections, catalogMap);

  // Build speakerDriveMap linking each speaker nodeId to its actual delivered watts
  const speakerDriveMap: SPLSimulationSummary['speakerDriveMap'] = {};

  for (const node of nodes) {
    const prod = catalogMap.get(node.productId);
    if (!prod || prod.category !== 'speaker' || !prod.speaker) continue;

    if (prod.speaker.type === 'active') {
      // Check if connected to a signal source
      const hasSignalIn = connections.some((c) => c.toNodeId === node.id);
      const watts = prod.speaker.rmsWatts;
      const spl1m = Math.round((prod.speaker.sensitivityDb + 10 * Math.log10(watts)) * 10) / 10;
      speakerDriveMap[node.id] = {
        deliveredWatts: watts,
        maxContinuousSpl1m: spl1m,
        isPoweredByAmp: true,
        sourceDescription: hasSignalIn
          ? `내장 액티브앰프(${watts}W RMS)`
          : `내장앰프(${watts}W, 신호선 미연결)`,
      };
    } else {
      // Find in ampLoads
      let foundLoad: {
        ampLabel: string;
        portLabel: string;
        deliveredWatts: number;
      } | null = null;

      for (const load of ampLoads) {
        const match = load.connectedSpeakerNodes.find((s) => s.nodeId === node.id);
        if (match) {
          foundLoad = {
            ampLabel: load.ampLabel,
            portLabel: load.portLabel,
            deliveredWatts: match.deliveredWatts,
          };
          break;
        }
      }

      if (foundLoad) {
        const effectiveW = Math.min(foundLoad.deliveredWatts, prod.speaker.programWatts);
        const spl1m =
          Math.round((prod.speaker.sensitivityDb + 10 * Math.log10(Math.max(1, effectiveW))) * 10) /
          10;
        speakerDriveMap[node.id] = {
          deliveredWatts: foundLoad.deliveredWatts,
          maxContinuousSpl1m: spl1m,
          isPoweredByAmp: true,
          sourceDescription: `${foundLoad.ampLabel}[${foundLoad.portLabel}] → ${foundLoad.deliveredWatts}W 인가`,
        };
      } else {
        // Fallback to nominal RMS for preview but mark as unpowered
        const nominalW = prod.speaker.tap100vWatts || prod.speaker.rmsWatts;
        const spl1m =
          Math.round((prod.speaker.sensitivityDb + 10 * Math.log10(Math.max(1, nominalW))) * 10) /
          10;
        speakerDriveMap[node.id] = {
          deliveredWatts: nominalW,
          maxContinuousSpl1m: spl1m,
          isPoweredByAmp: false,
          sourceDescription: `앰프 미결선(정격 ${nominalW}W 기준 시뮬레이션)`,
        };
      }
    }
  }

  // Sample audience area grid (from stageDepthMeters to lengthMeters - 0.5m)
  const startX = Math.min(room.stageDepthMeters + 0.5, room.lengthMeters * 0.2);
  const endX = Math.max(startX + 1, room.lengthMeters - 0.5);
  const startY = 0.5;
  const endY = Math.max(1, room.widthMeters - 0.5);

  const stepsX = 24;
  const stepsY = 16;
  const splSamples: number[] = [];
  let overlapCells = 0;
  let maxBoostDeltaDb = 0;
  let maxDipDeltaDb = 0;
  const candidateHotspots: AcousticInterferenceHotspot[] = [];

  for (let ix = 0; ix < stepsX; ix++) {
    const x = Math.round((startX + ((endX - startX) * ix) / (stepsX - 1)) * 10) / 10;
    for (let iy = 0; iy < stepsY; iy++) {
      const y = Math.round((startY + ((endY - startY) * iy) / (stepsY - 1)) * 10) / 10;
      const field = calculatePointAcousticFieldAt3D(
        x,
        y,
        room.earHeightMeters,
        placements,
        catalogMap,
        speakerDriveMap,
        'broadband',
        true
      );
      splSamples.push(field.splDb);

      if (field.overlapCount >= 2) {
        overlapCells += 1;
        if (field.interferenceDeltaDb > maxBoostDeltaDb) {
          maxBoostDeltaDb = field.interferenceDeltaDb;
        }
        if (field.interferenceDeltaDb < maxDipDeltaDb) {
          maxDipDeltaDb = field.interferenceDeltaDb;
        }
        if (field.state === 'boost' || field.state === 'dip') {
          candidateHotspots.push({
            type: field.state,
            xMeters: x,
            yMeters: y,
            splDb: field.splDb,
            deltaDb: field.interferenceDeltaDb,
          });
        }
      }
    }
  }

  // Pick up to 3 spatially separated boost spots and 3 dip spots so canvas badges never overlap
  const pickDistinctHotspots = (
    list: AcousticInterferenceHotspot[],
    type: 'boost' | 'dip',
    maxCount: number
  ): AcousticInterferenceHotspot[] => {
    const sorted = list
      .filter((h) => h.type === type)
      .sort((a, b) =>
        type === 'boost' ? b.deltaDb - a.deltaDb : a.deltaDb - b.deltaDb
      );
    const chosen: AcousticInterferenceHotspot[] = [];
    for (const item of sorted) {
      if (chosen.length >= maxCount) break;
      const tooClose = chosen.some(
        (c) => Math.hypot(c.xMeters - item.xMeters, c.yMeters - item.yMeters) < 2.6
      );
      if (!tooClose) {
        chosen.push(item);
      }
    }
    return chosen;
  };

  const interferenceHotspots: AcousticInterferenceHotspot[] = [
    ...pickDistinctHotspots(candidateHotspots, 'boost', 2),
    ...pickDistinctHotspots(candidateHotspots, 'dip', 3),
  ];
  const overlapZonePercent = Math.round((overlapCells / Math.max(1, splSamples.length)) * 100);

  if (splSamples.length === 0 || placements.length === 0) {
    return {
      summary: {
        avgSplDb: 0,
        maxSplDb: 0,
        minSplDb: 0,
        uniformityPlusMinusDb: 0,
        targetCoveragePercent: 0,
        deadSpotPercent: 100,
        estimatedSti: 0,
        stiGrade: 'POOR',
        speakerDriveMap,
      },
      ampLoads,
    };
  }

  const maxSplDb = Math.round(Math.max(...splSamples) * 10) / 10;
  const minSplDb = Math.round(Math.min(...splSamples) * 10) / 10;
  const avgSplDb =
    Math.round((splSamples.reduce((a, b) => a + b, 0) / splSamples.length) * 10) / 10;
  const uniformityPlusMinusDb = Math.round(((maxSplDb - minSplDb) / 2) * 10) / 10;

  const coveredCount = splSamples.filter((s) => s >= room.targetSplDb - 4).length;
  const deadCount = splSamples.filter((s) => s < room.targetSplDb - 9).length;

  const targetCoveragePercent = Math.round((coveredCount / splSamples.length) * 100);
  const deadSpotPercent = Math.round((deadCount / splSamples.length) * 100);

  // Estimate Speech Transmission Index (STI) from RT60, speaker directivity (Q), and SPL uniformity
  const avgDispersionH =
    placements.reduce((acc, p) => {
      const sp = catalogMap.get(p.productId)?.speaker;
      return acc + (sp?.dispersionHorizontalDeg || 90);
    }, 0) / Math.max(1, placements.length);
  const avgDispersionV =
    placements.reduce((acc, p) => {
      const sp = catalogMap.get(p.productId)?.speaker;
      return acc + (sp?.dispersionVerticalDeg || 60);
    }, 0) / Math.max(1, placements.length);

  // Higher directivity (narrower vertical dispersion like column arrays) improves STI in reverberant rooms
  const directivityBonus = avgDispersionV <= 35 ? 0.08 : avgDispersionH <= 90 ? 0.03 : -0.02;
  const rt60Penalty = Math.max(0, (room.rt60Seconds - 0.5) * 0.18);
  const uniformityPenalty = Math.max(0, (uniformityPlusMinusDb - 3.5) * 0.015);
  const rawSti = Math.min(0.88, Math.max(0.32, 0.76 + directivityBonus - rt60Penalty - uniformityPenalty));
  const estimatedSti = Math.round(rawSti * 100) / 100;

  let stiGrade: SPLSimulationSummary['stiGrade'] = 'GOOD';
  if (estimatedSti >= 0.65) stiGrade = 'EXCELLENT';
  else if (estimatedSti >= 0.52) stiGrade = 'GOOD';
  else if (estimatedSti >= 0.43) stiGrade = 'FAIR';
  else stiGrade = 'POOR';

  return {
    summary: {
      avgSplDb,
      maxSplDb,
      minSplDb,
      uniformityPlusMinusDb,
      targetCoveragePercent,
      deadSpotPercent,
      estimatedSti,
      stiGrade,
      overlapZonePercent,
      maxBoostDeltaDb,
      maxDipDeltaDb,
      interferenceHotspots,
      speakerDriveMap,
    },
    ampLoads,
  };
}

/**
 * Automatic System Recommendation & Point-to-Point Wiring Engine
 */
export function generateRecommendedSystem(
  input: AutoDesignWizardInput,
  catalog: AudioProduct[]
): {
  room: RoomConfig;
  nodes: SystemNode[];
  connections: CableConnection[];
  placements: SpeakerPlacement[];
  recommendationNotes: string[];
} {
  const notes: string[] = [];
  const areaSqm = input.lengthMeters * input.widthMeters;
  const is100vMode =
    input.systemTopology === 'high_z_100v' ||
    (input.systemTopology === 'auto' && input.purpose === 'cafe_retail');

  // Determine Target SPL & RT60 by venue purpose
  const purposeDefaults: Record<
    AutoDesignWizardInput['purpose'],
    { targetSpl: number; rt60: number; earH: number; stageD: number; label: string }
  > = {
    auditorium: { targetSpl: 94, rt60: 1.1, earH: 1.2, stageD: 3.0, label: '대강당/다목적홀' },
    church: { targetSpl: 95, rt60: 1.35, earH: 1.2, stageD: 3.2, label: '교회/예배당' },
    conference: { targetSpl: 88, rt60: 0.65, earH: 1.2, stageD: 1.8, label: '컨퍼런스/대회의실' },
    cafe_retail: { targetSpl: 82, rt60: 0.75, earH: 1.4, stageD: 0.5, label: '카페/상업매장' },
    live_club: { targetSpl: 100, rt60: 0.85, earH: 1.5, stageD: 3.5, label: '라이브홀/공연장' },
    classroom: { targetSpl: 86, rt60: 0.6, earH: 1.2, stageD: 1.5, label: '강의실/시청각실' },
  };

  const preset = purposeDefaults[input.purpose];

  const room: RoomConfig = {
    lengthMeters: input.lengthMeters,
    widthMeters: input.widthMeters,
    heightMeters: input.heightMeters,
    earHeightMeters: preset.earH,
    targetSplDb: preset.targetSpl,
    targetUniformityDb: 3.0,
    rt60Seconds: preset.rt60,
    stageDepthMeters: Math.min(preset.stageD, input.lengthMeters * 0.22),
    floorplanOpacity: 0.45,
    sideViewSliceYMeters: Math.round((input.widthMeters * 0.25) * 10) / 10,
  };

  const nodes: SystemNode[] = [];
  const connections: CableConnection[] = [];
  const placements: SpeakerPlacement[] = [];

  const findProduct = (id: string, fallbackCategory: AudioProduct['category']) =>
    catalog.find((p) => p.id === id) ||
    catalog.find((p) => p.category === fallbackCategory) ||
    catalog[0];

  // ==========================================
  // CASE A: 100V High-Z Commercial Distributed System
  // ==========================================
  if (is100vMode) {
    const spkProd =
      input.heightMeters <= 3.6
        ? findProduct('spk-ceil-65-100v', 'speaker')
        : findProduct('spk-wall-5-100v', 'speaker');

    // Calculate grid of speakers (approx 1 speaker per 22~28 sqm, even number)
    const countX = Math.max(2, Math.min(5, Math.round(input.lengthMeters / 5.0)));
    const countY = Math.max(2, Math.min(3, Math.round(input.widthMeters / 5.5)));
    const totalSpk = countX * countY;
    const tapW = spkProd.speaker?.tap100vWatts || 30;
    const totalTapWatts = totalSpk * tapW;

    notes.push(
      `[공간분석] ${input.lengthMeters}m×${input.widthMeters}m(${areaSqm.toFixed(0)}㎡) ${preset.label} 환경에 맞춰 균일한 음압편차를 제공하는 100V 하이임피던스 분산스피커(${spkProd.model}×${totalSpk}EA) 구성을 채택했습니다.`
    );

    // Choose 100V Amp
    const useMultiZoneAmp = totalTapWatts > 190 || input.wirelessMicCount + input.wiredMicCount > 2;
    const ampProd = useMultiZoneAmp
      ? findProduct('amp-100v-4x350', 'amplifier')
      : findProduct('amp-100v-240m', 'amplifier');

    notes.push(
      `[앰프매칭] 총 100V 탭 소비전력 ${totalTapWatts}W 대비 20% 이상 헤드룸을 확보하도록 ${ampProd.model} 앰프를 배치했습니다.`
    );

    // Sources
    let sourceY = 80;
    const sourceNodeIds: { nodeId: string; portId: string }[] = [];

    const wmicSets = Math.ceil(input.wirelessMicCount / 2);
    for (let i = 0; i < wmicSets; i++) {
      const wmicProd = findProduct('src-wmic-dual', 'source_mic');
      const nodeId = `node_wmic_${i + 1}`;
      nodes.push({
        id: nodeId,
        productId: wmicProd.id,
        customLabel: `무선마이크 수신기#${i + 1}`,
        x: 60,
        y: sourceY,
      });
      sourceY += 130;
      sourceNodeIds.push({ nodeId, portId: wmicProd.ports[0].id });
      if (wmicProd.ports[1]) {
        sourceNodeIds.push({ nodeId, portId: wmicProd.ports[1].id });
      }
    }

    for (let i = 0; i < input.wiredMicCount; i++) {
      const micProd = findProduct('src-gooseneck', 'source_mic');
      const nodeId = `node_mic_${i + 1}`;
      nodes.push({
        id: nodeId,
        productId: micProd.id,
        customLabel: `안내·포디움마이크#${i + 1}`,
        x: 60,
        y: sourceY,
      });
      sourceY += 105;
      sourceNodeIds.push({ nodeId, portId: micProd.ports[0].id });
    }

    for (let i = 0; i < Math.max(1, input.bgmSourceCount); i++) {
      const bgmProd = findProduct('src-media-player', 'source_mic');
      const nodeId = `node_bgm_${i + 1}`;
      nodes.push({
        id: nodeId,
        productId: bgmProd.id,
        customLabel: `BGM 미디어플레이어#${i + 1}`,
        x: 60,
        y: sourceY,
      });
      sourceY += 120;
      sourceNodeIds.push({ nodeId, portId: bgmProd.ports[0].id });
    }

    // If multi-zone amp, add mixer + matrix DSP
    let ampFeedNodeId = '';
    let ampFeedPorts: string[] = [];

    if (useMultiZoneAmp) {
      const mixProd = findProduct('mix-analog-8', 'mixer');
      const mixNodeId = 'node_mixer_main';
      nodes.push({
        id: mixNodeId,
        productId: mixProd.id,
        customLabel: '메인 프리믹서',
        x: 390,
        y: 160,
      });

      const mixInPorts = mixProd.ports.filter((p) => p.direction === 'in');
      sourceNodeIds.forEach((src, idx) => {
        if (mixInPorts[idx]) {
          connections.push({
            id: `conn_src_mix_${idx + 1}`,
            fromNodeId: src.nodeId,
            fromPortId: src.portId,
            toNodeId: mixNodeId,
            toPortId: mixInPorts[idx].id,
            cableCategory: 'signal',
            connectorFrom: 'XLR',
            connectorTo: mixInPorts[idx].connector,
            estimatedLengthMeters: 5,
          });
        }
      });

      ampFeedNodeId = mixNodeId;
      ampFeedPorts = mixProd.ports.filter((p) => p.direction === 'out').map((p) => p.id);
    }

    const ampNodeId = 'node_amp_100v';
    nodes.push({
      id: ampNodeId,
      productId: ampProd.id,
      customLabel: '100V 메인 파워앰프',
      x: useMultiZoneAmp ? 720 : 450,
      y: 180,
    });

    const ampInPorts = ampProd.ports.filter((p) => p.direction === 'in');
    if (useMultiZoneAmp) {
      ampFeedPorts.slice(0, 2).forEach((outPortId, idx) => {
        if (ampInPorts[idx]) {
          connections.push({
            id: `conn_mix_amp_${idx + 1}`,
            fromNodeId: ampFeedNodeId,
            fromPortId: outPortId,
            toNodeId: ampNodeId,
            toPortId: ampInPorts[idx].id,
            cableCategory: 'signal',
            connectorFrom: 'XLR',
            connectorTo: 'XLR',
            estimatedLengthMeters: 2,
          });
        }
      });
    } else {
      sourceNodeIds.forEach((src, idx) => {
        if (ampInPorts[idx]) {
          connections.push({
            id: `conn_src_amp_${idx + 1}`,
            fromNodeId: src.nodeId,
            fromPortId: src.portId,
            toNodeId: ampNodeId,
            toPortId: ampInPorts[idx].id,
            cableCategory: 'signal',
            connectorFrom: 'XLR',
            connectorTo: ampInPorts[idx].connector,
            estimatedLengthMeters: 5,
          });
        }
      });
    }

    // Place 100V speakers and wire them in Zone chains
    const ampOutPorts = ampProd.ports.filter((p) => p.signalType === 'speaker_100v');
    let spkCounter = 0;

    for (let iy = 0; iy < countY; iy++) {
      let prevSpkNodeId: string | null = null;
      const zoneOutPort = ampOutPorts[iy % ampOutPorts.length];

      for (let ix = 0; ix < countX; ix++) {
        spkCounter++;
        const spkNodeId = `node_spk_100v_${spkCounter}`;
        const label = `100V SPK Z${iy + 1}-${ix + 1}`;
        nodes.push({
          id: spkNodeId,
          productId: spkProd.id,
          customLabel: label,
          x: (useMultiZoneAmp ? 1050 : 800) + ix * 230,
          y: 70 + (iy * countX + ix) * 95,
          selectedTapWatts: tapW,
        });

        const inPort = spkProd.ports.find((p) => p.direction === 'in')!;
        const thruPort = spkProd.ports.find((p) => p.direction === 'out');

        if (!prevSpkNodeId) {
          connections.push({
            id: `conn_amp_spk_${spkCounter}`,
            fromNodeId: ampNodeId,
            fromPortId: zoneOutPort.id,
            toNodeId: spkNodeId,
            toPortId: inPort.id,
            cableCategory: 'speaker',
            connectorFrom: 'Terminal100V',
            connectorTo: 'Terminal100V',
            estimatedLengthMeters: 18,
          });
        } else if (thruPort) {
          connections.push({
            id: `conn_link_spk_${spkCounter}`,
            fromNodeId: prevSpkNodeId,
            fromPortId: thruPort.id,
            toNodeId: spkNodeId,
            toPortId: inPort.id,
            cableCategory: 'speaker',
            connectorFrom: 'Terminal100V',
            connectorTo: 'Terminal100V',
            estimatedLengthMeters: 6,
          });
        }
        prevSpkNodeId = spkNodeId;

        // Room Coordinates
        const xMeters =
          Math.round((((ix + 0.6) / countX) * input.lengthMeters) * 10) / 10;
        const yMeters =
          Math.round((((iy + 0.5) / countY) * input.widthMeters) * 10) / 10;
        const isCeiling = spkProd.enclosureShape === 'ceiling';

        placements.push({
          id: `place_${spkNodeId}`,
          nodeId: spkNodeId,
          productId: spkProd.id,
          label,
          xMeters,
          yMeters,
          zHeightMeters: isCeiling ? input.heightMeters - 0.1 : Math.min(2.8, input.heightMeters - 0.5),
          azimuthDeg: 0,
          tiltDownDeg: isCeiling ? 88 : 18,
        });
      }
    }

    const catalogMap = new Map<string, AudioProduct>();
    catalog.forEach((p) => catalogMap.set(p.id, p));
    const cleanNodes = computeCleanNodeLayout(nodes, catalogMap);

    return { room, nodes: cleanNodes, connections, placements, recommendationNotes: notes };
  }

  // ==========================================
  // CASE B: Low-Z Professional Audio System
  // ==========================================
  // 1. Choose Main Speakers based on room length & purpose
  let mainSpkProd: AudioProduct;
  if (input.purpose === 'church' && input.lengthMeters <= 22 && input.budgetTier === 'premium') {
    mainSpkProd = findProduct('spk-col-array', 'speaker');
  } else if (input.lengthMeters >= 22 || input.purpose === 'live_club') {
    mainSpkProd = findProduct('spk-ps15-lowz', 'speaker');
  } else if (input.lengthMeters >= 13 || input.purpose === 'auditorium' || input.purpose === 'church') {
    mainSpkProd = findProduct('spk-ps12-lowz', 'speaker');
  } else if (input.lengthMeters >= 8.5) {
    mainSpkProd = findProduct('spk-ps10-lowz', 'speaker');
  } else {
    mainSpkProd = findProduct('spk-ps8-lowz', 'speaker');
  }

  // Need Delay Fill speakers if room is longer than 17 meters
  const needsDelaySpeakers = input.lengthMeters >= 17;
  const delaySpkProd = findProduct('spk-ps8-lowz', 'speaker');
  const subSpkProd = findProduct('spk-sub18-lowz', 'speaker');

  notes.push(
    `[메인스피커 선정] 공간 깊이 ${input.lengthMeters}m, 폭 ${input.widthMeters}m(${preset.label}, 목표 ${preset.targetSpl}dB)를 커버하기 위해 메인 L/R로 ${mainSpkProd.brand} ${mainSpkProd.model}(${mainSpkProd.speaker?.rmsWatts}W RMS, 감도 ${mainSpkProd.speaker?.sensitivityDb}dB, 지향각 ${mainSpkProd.speaker?.dispersionHorizontalDeg}°×${mainSpkProd.speaker?.dispersionVerticalDeg}°)를 배치했습니다.`
  );

  if (needsDelaySpeakers) {
    notes.push(
      `[후방딜레이 보강] 장거리(${input.lengthMeters}m) 거리감쇠로 인한 앞·뒤 음압편차를 ±3.5dB 이내로 줄이기 위해 중후방에 ${delaySpkProd.model} 딜레이스피커 L/R 1조를 추가 구성했습니다.`
    );
  }

  // 2. Choose Sources & Mixer
  let srcY = 60;
  const sourcePortRefs: { nodeId: string; portId: string; label: string }[] = [];

  const wmicSetCount = Math.max(1, Math.ceil(input.wirelessMicCount / 2));
  for (let i = 0; i < wmicSetCount; i++) {
    const wmicProd = findProduct('src-wmic-dual', 'source_mic');
    const nodeId = `node_wmic_${i + 1}`;
    nodes.push({
      id: nodeId,
      productId: wmicProd.id,
      customLabel: `무선마이크 수신기#${i + 1}`,
      x: 50,
      y: srcY,
    });
    srcY += 135;
    sourcePortRefs.push({ nodeId, portId: wmicProd.ports[0].id, label: `WMIC${i * 2 + 1}` });
    if (i * 2 + 2 <= input.wirelessMicCount && wmicProd.ports[1]) {
      sourcePortRefs.push({ nodeId, portId: wmicProd.ports[1].id, label: `WMIC${i * 2 + 2}` });
    }
  }

  for (let i = 0; i < input.wiredMicCount; i++) {
    const micProd =
      i === 0 ? findProduct('src-gooseneck', 'source_mic') : findProduct('src-wired-mic', 'source_mic');
    const nodeId = `node_wired_mic_${i + 1}`;
    nodes.push({
      id: nodeId,
      productId: micProd.id,
      customLabel: i === 0 ? '단상 구즈넥마이크' : `유선마이크#${i + 1}`,
      x: 50,
      y: srcY,
    });
    srcY += 105;
    sourcePortRefs.push({ nodeId, portId: micProd.ports[0].id, label: `MIC${i + 1}` });
  }

  for (let i = 0; i < Math.max(1, input.bgmSourceCount); i++) {
    const bgmProd =
      i === 0 ? findProduct('src-media-player', 'source_mic') : findProduct('src-pc-di', 'source_mic');
    const nodeId = `node_bgm_${i + 1}`;
    nodes.push({
      id: nodeId,
      productId: bgmProd.id,
      customLabel: i === 0 ? '블루투스·USB 미디어플레이어' : `영상·PC DI박스#${i}`,
      x: 50,
      y: srcY,
    });
    srcY += 120;
    sourcePortRefs.push({ nodeId, portId: bgmProd.ports[0].id, label: `BGM L` });
    if (bgmProd.ports[1]) {
      sourcePortRefs.push({ nodeId, portId: bgmProd.ports[1].id, label: `BGM R` });
    }
  }

  const totalInputsNeeded = sourcePortRefs.length;
  let mixerProd: AudioProduct;
  if (input.useDanteNetwork || input.budgetTier === 'premium') {
    mixerProd =
      totalInputsNeeded > 12
        ? findProduct('mix-digi-32d', 'mixer')
        : findProduct('mix-digi-16d', 'mixer');
  } else {
    mixerProd =
      totalInputsNeeded > 7
        ? findProduct('mix-analog-16', 'mixer')
        : findProduct('mix-analog-8', 'mixer');
  }

  const mixerNodeId = 'node_mixer_foh';
  nodes.push({
    id: mixerNodeId,
    productId: mixerProd.id,
    customLabel: 'FOH 메인 오디오믹서',
    x: 380,
    y: 120,
  });

  // Connect Sources -> Mixer Inputs (point-to-point channel 1..N)
  const mixerMicInPorts = mixerProd.ports.filter(
    (p) => p.direction === 'in' && p.signalType === 'mic_line'
  );
  sourcePortRefs.forEach((src, idx) => {
    const targetPort = mixerMicInPorts[idx];
    if (targetPort) {
      connections.push({
        id: `conn_in_${idx + 1}`,
        fromNodeId: src.nodeId,
        fromPortId: src.portId,
        toNodeId: mixerNodeId,
        toPortId: targetPort.id,
        cableCategory: 'signal',
        connectorFrom: 'XLR',
        connectorTo: targetPort.connector,
        estimatedLengthMeters: 12,
      });
    }
  });

  // 3. Choose System DSP / Network Switch
  const dspProd = input.useDanteNetwork
    ? findProduct('dsp-4x8-dante', 'dsp')
    : findProduct('dsp-2x6', 'dsp');
  const dspNodeId = 'node_dsp_main';
  nodes.push({
    id: dspNodeId,
    productId: dspProd.id,
    customLabel: '스피커 매니지먼트 DSP',
    x: 720,
    y: 150,
  });

  if (input.useDanteNetwork) {
    const swProd = findProduct('net-switch-dante8', 'network');
    const swNodeId = 'node_net_switch';
    nodes.push({
      id: swNodeId,
      productId: swProd.id,
      customLabel: 'Dante 기가비트 스위치',
      x: 550,
      y: 440,
    });

    const mixDanteOut = mixerProd.ports.find(
      (p) => p.direction === 'out' && p.signalType === 'network_dante'
    );
    const swIn1 = swProd.ports.find((p) => p.direction === 'in');
    const swOut1 = swProd.ports.find((p) => p.direction === 'out');
    const dspDanteIn = dspProd.ports.find(
      (p) => p.direction === 'in' && p.signalType === 'network_dante'
    );

    if (mixDanteOut && swIn1 && swOut1 && dspDanteIn) {
      connections.push({
        id: 'conn_dante_mix_sw',
        fromNodeId: mixerNodeId,
        fromPortId: mixDanteOut.id,
        toNodeId: swNodeId,
        toPortId: swIn1.id,
        cableCategory: 'network',
        connectorFrom: 'RJ45',
        connectorTo: 'RJ45',
        estimatedLengthMeters: 30,
      });
      connections.push({
        id: 'conn_dante_sw_dsp',
        fromNodeId: swNodeId,
        fromPortId: swOut1.id,
        toNodeId: dspNodeId,
        toPortId: dspDanteIn.id,
        cableCategory: 'network',
        connectorFrom: 'RJ45',
        connectorTo: 'RJ45',
        estimatedLengthMeters: 2,
      });
    }
  }

  // Also wire analog Main L/R from Mixer -> DSP In A/B (either primary or redundant backup)
  const mixerMainOuts = mixerProd.ports.filter(
    (p) => p.direction === 'out' && p.signalType === 'mic_line'
  );
  const dspAnalogIns = dspProd.ports.filter(
    (p) => p.direction === 'in' && p.signalType === 'mic_line'
  );
  if (mixerMainOuts[0] && dspAnalogIns[0]) {
    connections.push({
      id: 'conn_mix_dsp_l',
      fromNodeId: mixerNodeId,
      fromPortId: mixerMainOuts[0].id,
      toNodeId: dspNodeId,
      toPortId: dspAnalogIns[0].id,
      cableCategory: 'signal',
      connectorFrom: 'XLR',
      connectorTo: 'XLR',
      estimatedLengthMeters: 3,
    });
  }
  if (mixerMainOuts[1] && dspAnalogIns[1]) {
    connections.push({
      id: 'conn_mix_dsp_r',
      fromNodeId: mixerNodeId,
      fromPortId: mixerMainOuts[1].id,
      toNodeId: dspNodeId,
      toPortId: dspAnalogIns[1].id,
      cableCategory: 'signal',
      connectorFrom: 'XLR',
      connectorTo: 'XLR',
      estimatedLengthMeters: 3,
    });
  }

  // 4. Choose Main Amplifier matched to Main Speaker RMS (targeting 1.2x ~ 1.6x headroom)
  const mainSpkRms = mainSpkProd.speaker?.rmsWatts || 400;
  let mainAmpProd: AudioProduct;
  if (input.useDanteNetwork && mainSpkRms <= 550) {
    mainAmpProd = findProduct('amp-4ch-600d', 'amplifier');
  } else if (mainSpkRms >= 550) {
    mainAmpProd = findProduct('amp-2ch-1200', 'amplifier');
  } else if (mainSpkRms >= 300) {
    mainAmpProd = findProduct('amp-2ch-650', 'amplifier');
  } else {
    mainAmpProd = findProduct('amp-2ch-350', 'amplifier');
  }

  const mainAmpNodeId = 'node_amp_main';
  nodes.push({
    id: mainAmpNodeId,
    productId: mainAmpProd.id,
    customLabel: '메인스피커 파워앰프',
    x: 1040,
    y: 90,
  });

  notes.push(
    `[파워앰프 매칭] 메인스피커(${mainSpkRms}W@8Ω)에 클리핑 없는 다이내믹 헤드룸을 공급하도록 채널당 ${mainAmpProd.amplifier?.watts8OhmPerCh}W@8Ω 출력의 ${mainAmpProd.model} 앰프를 매칭했습니다(매칭비 ${Math.round(((mainAmpProd.amplifier?.watts8OhmPerCh || 500) / mainSpkRms) * 100)}%).`
  );

  const dspOuts = dspProd.ports.filter(
    (p) => p.direction === 'out' && p.signalType === 'mic_line'
  );
  const mainAmpIns = mainAmpProd.ports.filter(
    (p) => p.direction === 'in' && p.signalType === 'mic_line'
  );
  const mainAmpSpkOuts = mainAmpProd.ports.filter(
    (p) => p.direction === 'out' && p.signalType === 'speaker_lowz'
  );

  // Connect DSP Out 1/2 -> Main Amp In 1/2
  if (dspOuts[0] && mainAmpIns[0]) {
    connections.push({
      id: 'conn_dsp_mainamp_l',
      fromNodeId: dspNodeId,
      fromPortId: dspOuts[0].id,
      toNodeId: mainAmpNodeId,
      toPortId: mainAmpIns[0].id,
      cableCategory: 'signal',
      connectorFrom: 'XLR',
      connectorTo: 'XLR',
      estimatedLengthMeters: 1.5,
    });
  }
  if (dspOuts[1] && mainAmpIns[1]) {
    connections.push({
      id: 'conn_dsp_mainamp_r',
      fromNodeId: dspNodeId,
      fromPortId: dspOuts[1].id,
      toNodeId: mainAmpNodeId,
      toPortId: mainAmpIns[1].id,
      cableCategory: 'signal',
      connectorFrom: 'XLR',
      connectorTo: 'XLR',
      estimatedLengthMeters: 1.5,
    });
  }

  // Place Main L / Main R Speakers
  const mainSpkNodes = [
    {
      id: 'node_spk_main_l',
      label: 'MAIN SPK L(좌측메인)',
      nodeY: 50,
      roomY: Math.round(input.widthMeters * 0.16 * 10) / 10,
      azimuth: 8,
    },
    {
      id: 'node_spk_main_r',
      label: 'MAIN SPK R(우측메인)',
      nodeY: 270,
      roomY: Math.round(input.widthMeters * 0.84 * 10) / 10,
      azimuth: -8,
    },
  ];

  mainSpkNodes.forEach((m, idx) => {
    nodes.push({
      id: m.id,
      productId: mainSpkProd.id,
      customLabel: m.label,
      x: 1380,
      y: m.nodeY,
    });

    const spkInPort = mainSpkProd.ports.find((p) => p.direction === 'in')!;
    if (mainAmpSpkOuts[idx]) {
      connections.push({
        id: `conn_mainamp_spk_${idx + 1}`,
        fromNodeId: mainAmpNodeId,
        fromPortId: mainAmpSpkOuts[idx].id,
        toNodeId: m.id,
        toPortId: spkInPort.id,
        cableCategory: 'speaker',
        connectorFrom: 'Speakon',
        connectorTo: 'Speakon',
        estimatedLengthMeters: 25,
      });
    }

    placements.push({
      id: `place_${m.id}`,
      nodeId: m.id,
      productId: mainSpkProd.id,
      label: m.label,
      xMeters: Math.round(Math.max(1.2, room.stageDepthMeters * 0.7) * 10) / 10,
      yMeters: m.roomY,
      zHeightMeters: Math.round(Math.min(3.8, input.heightMeters * 0.72) * 10) / 10,
      azimuthDeg: m.azimuth,
      tiltDownDeg: mainSpkProd.enclosureShape === 'column' ? 6 : 14,
    });
  });

  // 5. Optional Delay Fill Speakers
  if (needsDelaySpeakers) {
    let delayAmpNodeId = mainAmpNodeId;
    let delayAmpInPorts = mainAmpIns.slice(2, 4);
    let delayAmpOutPorts = mainAmpSpkOuts.slice(2, 4);

    // If Main Amp is only 2-channel, add a dedicated Delay Amplifier
    if ((mainAmpProd.amplifier?.channels || 2) < 4) {
      const delayAmpProd = findProduct('amp-2ch-350', 'amplifier');
      delayAmpNodeId = 'node_amp_delay';
      nodes.push({
        id: delayAmpNodeId,
        productId: delayAmpProd.id,
        customLabel: '딜레이스피커 파워앰프',
        x: 1040,
        y: 310,
      });
      delayAmpInPorts = delayAmpProd.ports.filter((p) => p.direction === 'in');
      delayAmpOutPorts = delayAmpProd.ports.filter((p) => p.direction === 'out');
    }

    if (dspOuts[2] && delayAmpInPorts[0]) {
      connections.push({
        id: 'conn_dsp_delayamp_l',
        fromNodeId: dspNodeId,
        fromPortId: dspOuts[2].id,
        toNodeId: delayAmpNodeId,
        toPortId: delayAmpInPorts[0].id,
        cableCategory: 'signal',
        connectorFrom: 'XLR',
        connectorTo: 'XLR',
        estimatedLengthMeters: 1.5,
      });
    }
    if (dspOuts[3] && delayAmpInPorts[1]) {
      connections.push({
        id: 'conn_dsp_delayamp_r',
        fromNodeId: dspNodeId,
        fromPortId: dspOuts[3].id,
        toNodeId: delayAmpNodeId,
        toPortId: delayAmpInPorts[1].id,
        cableCategory: 'signal',
        connectorFrom: 'XLR',
        connectorTo: 'XLR',
        estimatedLengthMeters: 1.5,
      });
    }

    const delaySpkConfigs = [
      {
        id: 'node_spk_delay_l',
        label: 'DELAY SPK L(중후방좌)',
        nodeY: 490,
        roomY: Math.round(input.widthMeters * 0.12 * 10) / 10,
        azimuth: 10,
      },
      {
        id: 'node_spk_delay_r',
        label: 'DELAY SPK R(중후방우)',
        nodeY: 710,
        roomY: Math.round(input.widthMeters * 0.88 * 10) / 10,
        azimuth: -10,
      },
    ];

    delaySpkConfigs.forEach((d, idx) => {
      nodes.push({
        id: d.id,
        productId: delaySpkProd.id,
        customLabel: d.label,
        x: 1380,
        y: d.nodeY,
      });
      const spkIn = delaySpkProd.ports.find((p) => p.direction === 'in')!;
      if (delayAmpOutPorts[idx]) {
        connections.push({
          id: `conn_delayamp_spk_${idx + 1}`,
          fromNodeId: delayAmpNodeId,
          fromPortId: delayAmpOutPorts[idx].id,
          toNodeId: d.id,
          toPortId: spkIn.id,
          cableCategory: 'speaker',
          connectorFrom: 'Speakon',
          connectorTo: 'Speakon',
          estimatedLengthMeters: 38,
        });
      }

      placements.push({
        id: `place_${d.id}`,
        nodeId: d.id,
        productId: delaySpkProd.id,
        label: d.label,
        xMeters: Math.round(input.lengthMeters * 0.56 * 10) / 10,
        yMeters: d.roomY,
        zHeightMeters: Math.round(Math.min(3.2, input.heightMeters * 0.68) * 10) / 10,
        azimuthDeg: d.azimuth,
        tiltDownDeg: 16,
      });
    });
  }

  // 6. Optional Subwoofer
  if (input.includeSubwoofer) {
    const subAmpProd = findProduct('amp-2ch-1200', 'amplifier');
    const subAmpNodeId = 'node_amp_sub';
    nodes.push({
      id: subAmpNodeId,
      productId: subAmpProd.id,
      customLabel: '서브우퍼 전용 파워앰프',
      x: 1040,
      y: needsDelaySpeakers ? 520 : 320,
    });

    const subAmpIns = subAmpProd.ports.filter((p) => p.direction === 'in');
    const subAmpOuts = subAmpProd.ports.filter((p) => p.direction === 'out');

    if (dspOuts[4] && subAmpIns[0]) {
      connections.push({
        id: 'conn_dsp_subamp_1',
        fromNodeId: dspNodeId,
        fromPortId: dspOuts[4].id,
        toNodeId: subAmpNodeId,
        toPortId: subAmpIns[0].id,
        cableCategory: 'signal',
        connectorFrom: 'XLR',
        connectorTo: 'XLR',
        estimatedLengthMeters: 1.5,
      });
    }

    const subCount = areaSqm >= 220 ? 2 : 1;
    for (let s = 0; s < subCount; s++) {
      const subNodeId = `node_spk_sub_${s + 1}`;
      const subLabel = subCount === 1 ? 'SUBWOOFER(서브우퍼)' : `SUBWOOFER ${s === 0 ? 'L' : 'R'}`;
      nodes.push({
        id: subNodeId,
        productId: subSpkProd.id,
        customLabel: subLabel,
        x: 1380,
        y: (needsDelaySpeakers ? 930 : 490) + s * 220,
      });

      const subInPort = subSpkProd.ports.find((p) => p.direction === 'in')!;
      const ampOutPort = subAmpOuts[s] || subAmpOuts[0];
      if (s === 1 && dspOuts[5] && subAmpIns[1]) {
        connections.push({
          id: 'conn_dsp_subamp_2',
          fromNodeId: dspNodeId,
          fromPortId: dspOuts[5].id,
          toNodeId: subAmpNodeId,
          toPortId: subAmpIns[1].id,
          cableCategory: 'signal',
          connectorFrom: 'XLR',
          connectorTo: 'XLR',
          estimatedLengthMeters: 1.5,
        });
      }

      connections.push({
        id: `conn_subamp_spk_${s + 1}`,
        fromNodeId: subAmpNodeId,
        fromPortId: ampOutPort.id,
        toNodeId: subNodeId,
        toPortId: subInPort.id,
        cableCategory: 'speaker',
        connectorFrom: 'Speakon',
        connectorTo: 'Speakon',
        estimatedLengthMeters: 22,
      });

      placements.push({
        id: `place_${subNodeId}`,
        nodeId: subNodeId,
        productId: subSpkProd.id,
        label: subLabel,
        xMeters: Math.round(Math.max(1.0, room.stageDepthMeters * 0.85) * 10) / 10,
        yMeters:
          subCount === 1
            ? Math.round(input.widthMeters * 0.5 * 10) / 10
            : Math.round(input.widthMeters * (s === 0 ? 0.28 : 0.72) * 10) / 10,
        zHeightMeters: 0.4,
        azimuthDeg: 0,
        tiltDownDeg: 0,
      });
    }
  }

  const catalogMap = new Map<string, AudioProduct>();
  catalog.forEach((p) => catalogMap.set(p.id, p));
  const cleanNodes = computeCleanNodeLayout(nodes, catalogMap);

  return { room, nodes: cleanNodes, connections, placements, recommendationNotes: notes };
}

/**
 * Computes geometrically optimized speaker placements & aiming angles (azimuth + vertical tilt)
 * to minimize SPL deviation (±dB) across the audience listening plane while eliminating dead spots.
 */
export function optimizePlacementsForUniformity(
  room: RoomConfig,
  placements: SpeakerPlacement[],
  catalogMap: Map<string, AudioProduct>
): SpeakerPlacement[] {
  if (placements.length === 0) return placements;

  const subPlacements = placements.filter(
    (p) => catalogMap.get(p.productId)?.speaker?.type === 'subwoofer'
  );
  const fullRangePlacements = placements.filter(
    (p) => catalogMap.get(p.productId)?.speaker?.type !== 'subwoofer'
  );

  const audStartX = Math.min(room.stageDepthMeters + 0.4, room.lengthMeters * 0.2);
  const audDepth = Math.max(2, room.lengthMeters - audStartX - 0.5);

  // Check if majority are ceiling / 100V speakers
  const ceilingCount = fullRangePlacements.filter(
    (p) => catalogMap.get(p.productId)?.enclosureShape === 'ceiling'
  ).length;

  const optimizedFullRange: SpeakerPlacement[] = [];

  if (ceilingCount > 0 && ceilingCount === fullRangePlacements.length) {
    // Distribute ceiling speakers in a uniform rectangular grid over the audience zone
    const n = fullRangePlacements.length;
    const rowsY = n >= 6 ? 2 : Math.max(1, Math.min(2, Math.round(room.widthMeters / 6)));
    const colsX = Math.max(1, Math.ceil(n / rowsY));

    fullRangePlacements.forEach((pl, idx) => {
      const c = Math.floor(idx / rowsY);
      const r = idx % rowsY;
      const xRatio = (c + 0.5) / colsX;
      const yRatio = rowsY === 1 ? 0.5 : r === 0 ? 0.26 : 0.74;

      optimizedFullRange.push({
        ...pl,
        xMeters: Math.round((audStartX + audDepth * xRatio) * 10) / 10,
        yMeters: Math.round(room.widthMeters * yRatio * 10) / 10,
        zHeightMeters: Math.round((room.heightMeters - 0.1) * 10) / 10,
        azimuthDeg: 0,
        tiltDownDeg: 88,
      });
    });
  } else {
    // Group directional speakers into L/R pairs (zones along room length X)
    const sorted = [...fullRangePlacements].sort((a, b) => a.xMeters - b.xMeters);
    const numPairs = Math.max(1, Math.ceil(sorted.length / 2));

    sorted.forEach((pl, idx) => {
      const pairIdx = Math.floor(idx / 2);
      const isLeft = idx % 2 === 0;
      const isSingleInPair = idx === sorted.length - 1 && sorted.length % 2 === 1;

      // Zone coverage segment along X
      const zoneStartX =
        pairIdx === 0
          ? Math.max(1.0, room.stageDepthMeters * 0.88)
          : Math.round((audStartX + audDepth * ((pairIdx * 0.92) / numPairs)) * 10) / 10;

      const zoneTargetX =
        audStartX + audDepth * Math.min(0.95, (pairIdx + 0.68) / numPairs);

      const yPos = isSingleInPair
        ? room.widthMeters * 0.5
        : isLeft
        ? room.widthMeters * (pairIdx === 0 ? 0.17 : 0.12)
        : room.widthMeters * (pairIdx === 0 ? 0.83 : 0.88);

      // Aim inward toward the center-opposite 62% width of the target zone so L/R beams cross evenly
      const aimTargetY = isSingleInPair
        ? room.widthMeters * 0.5
        : isLeft
        ? room.widthMeters * 0.56
        : room.widthMeters * 0.44;

      const zMount = Math.round(
        Math.min(Math.max(2.4, room.heightMeters * 0.72), 4.0) * 10
      ) / 10;

      const dx = Math.max(2.0, zoneTargetX - zoneStartX);
      const dy = aimTargetY - yPos;
      const dz = Math.max(0.8, zMount - room.earHeightMeters);

      const rawAzimuth = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
      const azimuthDeg = Math.max(-35, Math.min(35, rawAzimuth));

      const horizDist = Math.sqrt(dx * dx + dy * dy);
      const rawTilt = Math.round((Math.atan2(dz, horizDist) * 180) / Math.PI);
      const tiltDownDeg = Math.max(8, Math.min(28, rawTilt));

      optimizedFullRange.push({
        ...pl,
        xMeters: Math.round(zoneStartX * 10) / 10,
        yMeters: Math.round(yPos * 10) / 10,
        zHeightMeters: zMount,
        azimuthDeg,
        tiltDownDeg,
      });
    });
  }

  const optimizedSubs = subPlacements.map((sub, idx) => ({
    ...sub,
    xMeters: Math.round(Math.max(0.9, room.stageDepthMeters * 0.85) * 10) / 10,
    yMeters:
      subPlacements.length === 1
        ? Math.round(room.widthMeters * 0.5 * 10) / 10
        : Math.round(room.widthMeters * (idx % 2 === 0 ? 0.3 : 0.7) * 10) / 10,
    zHeightMeters: 0.4,
  }));

  return [...optimizedFullRange, ...optimizedSubs];
}

/**
 * Generates goal-driven modification proposals using ONLY the products in `catalog`
 * to satisfy the user's target average SPL (`room.targetSplDb`) and target SPL deviation (`room.targetUniformityDb`).
 */
export function generateGoalDrivenOptimizationProposals(
  room: RoomConfig,
  placements: SpeakerPlacement[],
  nodes: SystemNode[],
  connections: CableConnection[],
  catalog: AudioProduct[],
  catalogMap: Map<string, AudioProduct>
): OptimizationProposal[] {
  const proposals: OptimizationProposal[] = [];
  const targetSpl = room.targetSplDb;
  const targetUni = room.targetUniformityDb ?? 3.0;

  const baseSim = computeRoomSplSimulation(room, placements, nodes, connections, catalogMap).summary;
  const baseCost = nodes.reduce((sum, n) => sum + (catalogMap.get(n.productId)?.unitPriceKrw || 0), 0);

  const calcCostDelta = (candidateNodes: SystemNode[]) => {
    const newCost = candidateNodes.reduce(
      (sum, n) => sum + (catalogMap.get(n.productId)?.unitPriceKrw || 0),
      0
    );
    return newCost - baseCost;
  };

  // ============================================================================
  // PROPOSAL 1: Reposition & Re-Aim Existing Speakers (Zero Extra Equipment Cost)
  // ============================================================================
  if (placements.length > 0) {
    const repoPlacements = optimizePlacementsForUniformity(room, placements, catalogMap);
    const repoSim = computeRoomSplSimulation(
      room,
      repoPlacements,
      nodes,
      connections,
      catalogMap
    ).summary;

    const movedDescriptions = repoPlacements
      .slice(0, 4)
      .map((pl) => `${pl.label}: (${pl.xMeters}m, ${pl.yMeters}m, H=${pl.zHeightMeters}m) / 방위각 ${pl.azimuthDeg}°·틸트 ${pl.tiltDownDeg}°`);

    proposals.push({
      id: 'prop-reposition-aim',
      category: 'reposition',
      badgeLabel: '위치·각도 이동',
      title: `보유스피커 ${placements.length}대 위치·지향각 재배치`,
      description: `장비 추가 없이 스피커 ${placements.length}대의 좌표·방위각·틸트각을 공간 비율에 맞춰 자동 정렬 (사각지대·편차 감소)`,
      actionBullets: [
        ...movedDescriptions,
        placements.length > 4 ? `외 ${placements.length - 4}대 스피커 등간격·지향각 동기화` : '전면·후방 거리감쇠 보정 틸트각 적용',
      ],
      beforeAvgSplDb: baseSim.avgSplDb,
      afterAvgSplDb: repoSim.avgSplDb,
      beforeUniformityDb: baseSim.uniformityPlusMinusDb,
      afterUniformityDb: repoSim.uniformityPlusMinusDb,
      beforeCoveragePercent: baseSim.targetCoveragePercent,
      afterCoveragePercent: repoSim.targetCoveragePercent,
      costDeltaKrw: 0,
      meetsSplTarget: Math.abs(repoSim.avgSplDb - targetSpl) <= 2.0 || repoSim.avgSplDb >= targetSpl,
      meetsUniformityTarget: repoSim.uniformityPlusMinusDb <= targetUni,
      nextNodes: nodes,
      nextConnections: connections,
      nextPlacements: repoPlacements,
    });
  }

  // ============================================================================
  // PROPOSAL 2: Swap Speaker & Amplifier Models within User's Catalog for Target Average SPL
  // ============================================================================
  const fullRangeSpeakerCatalog = catalog.filter(
    (p) => p.category === 'speaker' && p.speaker && p.speaker.type !== 'subwoofer'
  );
  const lowZAmps = catalog
    .filter((p) => p.category === 'amplifier' && p.amplifier && !p.amplifier.supports100v)
    .sort((a, b) => (a.amplifier?.watts8OhmPerCh || 0) - (b.amplifier?.watts8OhmPerCh || 0));

  if (fullRangeSpeakerCatalog.length > 0 && placements.length > 0) {
    let bestSwapCandidate: {
      spkProd: AudioProduct;
      ampProd: AudioProduct | null;
      nodes: SystemNode[];
      connections: CableConnection[];
      placements: SpeakerPlacement[];
      sim: SPLSimulationSummary;
      score: number;
    } | null = null;

    for (const candidateSpk of fullRangeSpeakerCatalog) {
      const spkSpec = candidateSpk.speaker!;
      // Find matching amplifier if passive_lowz
      let matchedAmp: AudioProduct | null = null;
      if (spkSpec.type === 'passive_lowz' && lowZAmps.length > 0) {
        matchedAmp =
          lowZAmps.find((a) => (a.amplifier?.watts8OhmPerCh || 0) >= spkSpec.rmsWatts * 1.1) ||
          lowZAmps[lowZAmps.length - 1];
      }

      const candNodes = nodes.map((n) => {
        const prod = catalogMap.get(n.productId);
        if (!prod) return n;
        if (prod.category === 'speaker' && prod.speaker?.type !== 'subwoofer') {
          return { ...n, productId: candidateSpk.id };
        }
        if (
          prod.category === 'amplifier' &&
          matchedAmp &&
          !prod.amplifier?.supports100v &&
          !n.id.includes('sub')
        ) {
          return { ...n, productId: matchedAmp.id };
        }
        return n;
      });

      const candPlacements = optimizePlacementsForUniformity(
        room,
        placements.map((pl) => {
          const prod = catalogMap.get(pl.productId);
          if (prod?.speaker?.type === 'subwoofer') return pl;
          return { ...pl, productId: candidateSpk.id };
        }),
        catalogMap
      );

      // Remap speaker input ports if needed
      const spkInPort = candidateSpk.ports.find((p) => p.direction === 'in') || candidateSpk.ports[0];
      const candConnections = connections.map((c) => {
        const toNode = candNodes.find((n) => n.id === c.toNodeId);
        if (toNode && toNode.productId === candidateSpk.id && spkInPort) {
          return {
            ...c,
            toPortId: spkInPort.id,
            connectorTo: spkInPort.connector,
            cableCategory: getSignalCategoryFromPortType(spkInPort.signalType),
          };
        }
        return c;
      });

      const sim = computeRoomSplSimulation(
        room,
        candPlacements,
        candNodes,
        candConnections,
        catalogMap
      ).summary;

      // Score: prioritize reaching targetSplDb closely and improving uniformity
      const splDiff = sim.avgSplDb - targetSpl;
      const splPenalty =
        splDiff < -0.5 ? Math.abs(splDiff) * 3.2 : splDiff > 4.5 ? (splDiff - 4.5) * 1.8 : Math.abs(splDiff) * 0.8;
      const uniPenalty = Math.max(0, sim.uniformityPlusMinusDb - targetUni) * 1.5;
      const score = splPenalty + uniPenalty;

      // Skip if identical to current primary speaker & amp
      const currentMainSpkId = placements.find(
        (p) => catalogMap.get(p.productId)?.speaker?.type !== 'subwoofer'
      )?.productId;
      const isDifferentModel = candidateSpk.id !== currentMainSpkId;

      if (isDifferentModel && (!bestSwapCandidate || score < bestSwapCandidate.score)) {
        bestSwapCandidate = {
          spkProd: candidateSpk,
          ampProd: matchedAmp,
          nodes: computeCleanNodeLayout(candNodes, catalogMap),
          connections: candConnections,
          placements: candPlacements,
          sim,
          score,
        };
      }
    }

    if (bestSwapCandidate) {
      const { spkProd, ampProd, nodes: cNodes, connections: cConns, placements: cPlaces, sim } =
        bestSwapCandidate;
      proposals.push({
        id: `prop-swap-model-${spkProd.id}`,
        category: 'swap_model',
        badgeLabel: '보유장비 교체',
        title: `${spkProd.brand} ${spkProd.model}${ampProd ? ` + ${ampProd.model}` : ''} 교체`,
        description: `목표 평균음압(${targetSpl}dB)에 맞춰 감도 ${spkProd.speaker?.sensitivityDb}dB·정격 ${spkProd.speaker?.rmsWatts}W 모델로 교체`,
        actionBullets: [
          `메인/보조 스피커 교체: [${spkProd.brand}] ${spkProd.model} (${spkProd.name})`,
          ampProd
            ? `파워앰프 매칭 변경: [${ampProd.brand}] ${ampProd.model} (${ampProd.amplifier?.watts8OhmPerCh}W@8Ω)`
            : `액티브/기존 구동 체계 유지 (내장앰프 ${spkProd.speaker?.rmsWatts}W 구동)`,
          `예상 객석 평균음압: ${baseSim.avgSplDb}dB ➔ ${sim.avgSplDb}dB (목표 ${targetSpl}dB 기준)`,
        ],
        beforeAvgSplDb: baseSim.avgSplDb,
        afterAvgSplDb: sim.avgSplDb,
        beforeUniformityDb: baseSim.uniformityPlusMinusDb,
        afterUniformityDb: sim.uniformityPlusMinusDb,
        beforeCoveragePercent: baseSim.targetCoveragePercent,
        afterCoveragePercent: sim.targetCoveragePercent,
        costDeltaKrw: calcCostDelta(cNodes),
        meetsSplTarget: sim.avgSplDb >= targetSpl - 1.0,
        meetsUniformityTarget: sim.uniformityPlusMinusDb <= targetUni,
        nextNodes: cNodes,
        nextConnections: cConns,
        nextPlacements: cPlaces,
      });
    }
  }

  // ============================================================================
  // PROPOSAL 3: Add Delay / Distributed Speakers + Auto-Wiring for Target Uniformity (±dB)
  // ============================================================================
  const currentFullRangePlacements = placements.filter(
    (p) => catalogMap.get(p.productId)?.speaker?.type !== 'subwoofer'
  );
  const currentMainSpkProd =
    catalogMap.get(currentFullRangePlacements[0]?.productId || '') ||
    fullRangeSpeakerCatalog[0];

  if (currentMainSpkProd) {
    // Decide how many speakers to add (2EA or 4EA) based on uniformity gap & room length
    const uniGap = baseSim.uniformityPlusMinusDb - targetUni;
    const addCount = uniGap > 2.2 || (room.lengthMeters >= 20 && currentFullRangePlacements.length <= 2) ? 4 : 2;

    // Pick a delay speaker from catalog (prefer same brand compact 8"~12" speaker or same model)
    const sameBrandDelay = fullRangeSpeakerCatalog.find(
      (p) =>
        p.brand === currentMainSpkProd.brand &&
        p.speaker?.type === currentMainSpkProd.speaker?.type &&
        (p.speaker?.driverSizeInch || 12) <= 12
    );
    const delaySpkProd = sameBrandDelay || currentMainSpkProd;

    const addNodes: SystemNode[] = [...nodes];
    const addConnections: CableConnection[] = [...connections];
    const addPlacementsRaw: SpeakerPlacement[] = [...placements];

    const ts = Date.now();
    let delayAmpNodeId: string | null = null;
    let delayAmpProd: AudioProduct | null = null;

    if (delaySpkProd.speaker?.type === 'passive_lowz') {
      // Pick 2ch or 4ch amplifier from catalog
      const preferredAmp =
        (addCount >= 4
          ? lowZAmps.find((a) => (a.amplifier?.channels || 2) >= 4)
          : null) ||
        lowZAmps.find(
          (a) => (a.amplifier?.watts8OhmPerCh || 0) >= (delaySpkProd.speaker?.rmsWatts || 300)
        ) ||
        lowZAmps[0];

      if (preferredAmp) {
        delayAmpProd = preferredAmp;
        delayAmpNodeId = `node_amp_opt_${ts}`;
        addNodes.push({
          id: delayAmpNodeId,
          productId: preferredAmp.id,
          customLabel: `보조·딜레이 파워앰프(${preferredAmp.model})`,
          x: 1280,
          y: 420,
        });

        // Connect DSP or Mixer output to this new Delay Amp
        const dspOrMixerNode =
          addNodes.find((n) => catalogMap.get(n.productId)?.category === 'dsp') ||
          addNodes.find((n) => catalogMap.get(n.productId)?.category === 'mixer');

        if (dspOrMixerNode) {
          const sourceProd = catalogMap.get(dspOrMixerNode.productId);
          const sourceOutPorts =
            sourceProd?.ports.filter((p) => p.direction === 'out' && p.signalType === 'mic_line') ||
            [];
          const ampInPorts =
            preferredAmp.ports.filter((p) => p.direction === 'in' && p.signalType === 'mic_line') ||
            [];

          for (let ch = 0; ch < Math.min(2, ampInPorts.length); ch++) {
            const srcPort =
              sourceOutPorts[(ch + 2) % Math.max(1, sourceOutPorts.length)] || sourceOutPorts[0];
            if (srcPort && ampInPorts[ch]) {
              addConnections.push({
                id: `conn_opt_sig_${ts}_${ch}`,
                fromNodeId: dspOrMixerNode.id,
                fromPortId: srcPort.id,
                toNodeId: delayAmpNodeId,
                toPortId: ampInPorts[ch].id,
                cableCategory: 'signal',
                connectorFrom: srcPort.connector,
                connectorTo: ampInPorts[ch].connector,
                estimatedLengthMeters: 3,
              });
            }
          }
        }
      }
    }

    for (let i = 0; i < addCount; i++) {
      const spkNodeId = `node_spk_opt_${ts}_${i + 1}`;
      const sideLabel = i % 2 === 0 ? 'L' : 'R';
      const zoneNum = Math.floor(i / 2) + 1;
      const customLabel = `DELAY SPK ${zoneNum}${sideLabel}(보조#${i + 1})`;

      addNodes.push({
        id: spkNodeId,
        productId: delaySpkProd.id,
        customLabel,
        x: 1690,
        y: 500 + i * 180,
      });

      const spkInPort =
        delaySpkProd.ports.find((p) => p.direction === 'in') || delaySpkProd.ports[0];

      if (delayAmpNodeId && delayAmpProd && spkInPort) {
        const ampOutPorts = delayAmpProd.ports.filter(
          (p) => p.direction === 'out' && p.signalType === 'speaker_lowz'
        );
        const outPort = ampOutPorts[i % Math.max(1, ampOutPorts.length)];
        if (outPort) {
          addConnections.push({
            id: `conn_opt_spk_${ts}_${i + 1}`,
            fromNodeId: delayAmpNodeId,
            fromPortId: outPort.id,
            toNodeId: spkNodeId,
            toPortId: spkInPort.id,
            cableCategory: 'speaker',
            connectorFrom: outPort.connector,
            connectorTo: spkInPort.connector,
            estimatedLengthMeters: 28,
          });
        }
      } else if (delaySpkProd.speaker?.type === 'active' && spkInPort) {
        const dspOrMixerNode =
          addNodes.find((n) => catalogMap.get(n.productId)?.category === 'dsp') ||
          addNodes.find((n) => catalogMap.get(n.productId)?.category === 'mixer');
        if (dspOrMixerNode) {
          const srcProd = catalogMap.get(dspOrMixerNode.productId);
          const srcOuts =
            srcProd?.ports.filter((p) => p.direction === 'out' && p.signalType === 'mic_line') ||
            [];
          const outP = srcOuts[(i + 2) % Math.max(1, srcOuts.length)] || srcOuts[0];
          if (outP) {
            addConnections.push({
              id: `conn_opt_act_${ts}_${i + 1}`,
              fromNodeId: dspOrMixerNode.id,
              fromPortId: outP.id,
              toNodeId: spkNodeId,
              toPortId: spkInPort.id,
              cableCategory: 'signal',
              connectorFrom: outP.connector,
              connectorTo: spkInPort.connector,
              estimatedLengthMeters: 25,
            });
          }
        }
      }

      addPlacementsRaw.push({
        id: `place_${spkNodeId}`,
        nodeId: spkNodeId,
        productId: delaySpkProd.id,
        label: customLabel,
        xMeters: Math.round(room.lengthMeters * 0.55 * 10) / 10,
        yMeters: Math.round(room.widthMeters * (i % 2 === 0 ? 0.14 : 0.86) * 10) / 10,
        zHeightMeters: Math.round(Math.min(3.2, room.heightMeters * 0.7) * 10) / 10,
        azimuthDeg: i % 2 === 0 ? 12 : -12,
        tiltDownDeg: 18,
      });
    }

    const addPlacements = optimizePlacementsForUniformity(room, addPlacementsRaw, catalogMap);
    const cleanAddNodes = computeCleanNodeLayout(addNodes, catalogMap);
    const addSim = computeRoomSplSimulation(
      room,
      addPlacements,
      cleanAddNodes,
      addConnections,
      catalogMap
    ).summary;

    proposals.push({
      id: `prop-add-speakers-${addCount}`,
      category: 'add_speakers',
      badgeLabel: `스피커 +${addCount}EA 추가`,
      title: `딜레이 ${delaySpkProd.model} +${addCount}대 추가·분산배치`,
      description: `음압편차(±${targetUni}dB) 충족을 위해 중후방에 ${delaySpkProd.model} ${addCount}대 및 앰프 결선을 자동 확장`,
      actionBullets: [
        `추가 스피커: [${delaySpkProd.brand}] ${delaySpkProd.model} × ${addCount}EA (총 풀레인지 ${currentFullRangePlacements.length}대 ➔ ${currentFullRangePlacements.length + addCount}대)`,
        delayAmpProd
          ? `구동 앰프 및 결선 자동 추가: [${delayAmpProd.brand}] ${delayAmpProd.model} 1대 + 포인트 결선`
          : `액티브 라인 신호 결선 자동 확장`,
        `전·중·후방 다중 존(Multi-Zone) 등간격 위치 이동 및 하향 틸트각 자동 정렬`,
      ],
      beforeAvgSplDb: baseSim.avgSplDb,
      afterAvgSplDb: addSim.avgSplDb,
      beforeUniformityDb: baseSim.uniformityPlusMinusDb,
      afterUniformityDb: addSim.uniformityPlusMinusDb,
      beforeCoveragePercent: baseSim.targetCoveragePercent,
      afterCoveragePercent: addSim.targetCoveragePercent,
      costDeltaKrw: calcCostDelta(cleanAddNodes),
      meetsSplTarget: addSim.avgSplDb >= targetSpl - 1.0,
      meetsUniformityTarget: addSim.uniformityPlusMinusDb <= targetUni,
      nextNodes: cleanAddNodes,
      nextConnections: addConnections,
      nextPlacements: addPlacements,
    });

    // ============================================================================
    // PROPOSAL 4: Combined Goal-Driven Solution (Target SPL + Target Uniformity Together)
    // ============================================================================
    // Find best speaker model in catalog when combined with the expanded speaker count & optimized positions
    let bestCombo: {
      spkProd: AudioProduct;
      ampProd: AudioProduct | null;
      nodes: SystemNode[];
      connections: CableConnection[];
      placements: SpeakerPlacement[];
      sim: SPLSimulationSummary;
      score: number;
    } | null = null;

    for (const candSpk of fullRangeSpeakerCatalog) {
      const spkSpec = candSpk.speaker!;
      let matchedAmp: AudioProduct | null = null;
      if (spkSpec.type === 'passive_lowz' && lowZAmps.length > 0) {
        matchedAmp =
          lowZAmps.find((a) => (a.amplifier?.watts8OhmPerCh || 0) >= spkSpec.rmsWatts * 1.15) ||
          lowZAmps[lowZAmps.length - 1];
      }

      const comboNodes = cleanAddNodes.map((n) => {
        const prod = catalogMap.get(n.productId);
        if (!prod) return n;
        if (prod.category === 'speaker' && prod.speaker?.type !== 'subwoofer') {
          return { ...n, productId: candSpk.id };
        }
        if (
          prod.category === 'amplifier' &&
          matchedAmp &&
          !prod.amplifier?.supports100v &&
          !n.id.includes('sub')
        ) {
          return { ...n, productId: matchedAmp.id };
        }
        return n;
      });

      const comboPlacements = optimizePlacementsForUniformity(
        room,
        addPlacements.map((pl) => {
          const prod = catalogMap.get(pl.productId);
          if (prod?.speaker?.type === 'subwoofer') return pl;
          return { ...pl, productId: candSpk.id };
        }),
        catalogMap
      );

      const spkInPort = candSpk.ports.find((p) => p.direction === 'in') || candSpk.ports[0];
      const comboConnections = addConnections.map((c) => {
        const toNode = comboNodes.find((n) => n.id === c.toNodeId);
        if (toNode && toNode.productId === candSpk.id && spkInPort) {
          return {
            ...c,
            toPortId: spkInPort.id,
            connectorTo: spkInPort.connector,
            cableCategory: getSignalCategoryFromPortType(spkInPort.signalType),
          };
        }
        return c;
      });

      const sim = computeRoomSplSimulation(
        room,
        comboPlacements,
        comboNodes,
        comboConnections,
        catalogMap
      ).summary;

      const splDiff = sim.avgSplDb - targetSpl;
      const splPenalty =
        splDiff < -0.3 ? Math.abs(splDiff) * 4.0 : splDiff > 4.0 ? (splDiff - 4.0) * 1.5 : Math.abs(splDiff) * 0.6;
      const uniPenalty = Math.max(0, sim.uniformityPlusMinusDb - targetUni) * 3.0;
      const score = splPenalty + uniPenalty;

      if (!bestCombo || score < bestCombo.score) {
        bestCombo = {
          spkProd: candSpk,
          ampProd: matchedAmp,
          nodes: computeCleanNodeLayout(comboNodes, catalogMap),
          connections: comboConnections,
          placements: comboPlacements,
          sim,
          score,
        };
      }
    }

    if (bestCombo) {
      const { spkProd, ampProd, nodes: cbNodes, connections: cbConns, placements: cbPlaces, sim } =
        bestCombo;
      proposals.push({
        id: `prop-combined-master-${spkProd.id}`,
        category: 'combined',
        badgeLabel: '음압·편차 통합설계',
        title: `${spkProd.model} 총 ${cbPlaces.filter((p) => catalogMap.get(p.productId)?.speaker?.type !== 'subwoofer').length}EA 통합 최적설계`,
        description: `목표 평균음압(${targetSpl}dB)과 편차(±${targetUni}dB) 동시 충족 (모델교체+대수확장+위치정렬 일괄적용)`,
        actionBullets: [
          `주력 스피커 통일·확장: [${spkProd.brand}] ${spkProd.model} 총 ${cbPlaces.filter((p) => catalogMap.get(p.productId)?.speaker?.type !== 'subwoofer').length}EA 배치`,
          ampProd
            ? `파워앰프 최적 매칭: [${ampProd.brand}] ${ampProd.model} 정격 헤드룸 매칭 구동`
            : `액티브 파워드 구동 매칭 완료`,
          `달성 결과: 평균음압 ${sim.avgSplDb}dB / 음압편차 ±${sim.uniformityPlusMinusDb}dB / 커버리지 ${sim.targetCoveragePercent}%`,
        ],
        beforeAvgSplDb: baseSim.avgSplDb,
        afterAvgSplDb: sim.avgSplDb,
        beforeUniformityDb: baseSim.uniformityPlusMinusDb,
        afterUniformityDb: sim.uniformityPlusMinusDb,
        beforeCoveragePercent: baseSim.targetCoveragePercent,
        afterCoveragePercent: sim.targetCoveragePercent,
        costDeltaKrw: calcCostDelta(cbNodes),
        meetsSplTarget: sim.avgSplDb >= targetSpl - 1.0,
        meetsUniformityTarget: sim.uniformityPlusMinusDb <= targetUni,
        nextNodes: cbNodes,
        nextConnections: cbConns,
        nextPlacements: cbPlaces,
      });
    }
  }

  return proposals;
}
