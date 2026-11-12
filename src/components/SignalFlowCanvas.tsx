import React, { useRef, useState } from 'react';
import {
  AmpChannelLoadAnalysis,
  AudioProduct,
  CableConnection,
  ConnectResult,
  PortSignalType,
  PortSpec,
  SystemNode,
} from '../types/audio';
import {
  buildOrthogonalCablePath,
  CABLE_TYPE_LEGEND,
  getCableVisualStyle,
  getPortPinColor,
  routeAllCablesWithJumpOvers,
  validateConnection,
} from '../engine/audioPhysics';
import { DeviceSvgArtwork } from './DeviceSvgArtwork';
import {
  DEFAULT_KOREAN_DISTRIBUTORS,
  KoreanAudioDistributor,
  searchOrSynthesizeDistributorProducts,
} from '../services/distributorCatalog';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  FileUp,
  Globe,
  Plus,
  Radio,
  RotateCcw,
  Sliders,
  Speaker,
  Trash2,
  Volume2,
  Wifi,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface SignalFlowCanvasProps {
  catalog: AudioProduct[];
  catalogMap: Map<string, AudioProduct>;
  nodes: SystemNode[];
  connections: CableConnection[];
  ampLoads: AmpChannelLoadAnalysis[];
  onAddNode: (
    productId: string,
    x?: number,
    y?: number,
    directProduct?: AudioProduct
  ) => void;
  onRegisterProduct: (product: AudioProduct) => void;
  onUpdateNodePosition: (nodeId: string, x: number, y: number) => void;
  onUpdateNodeLabel: (nodeId: string, label: string) => void;
  onSwapNodeProduct: (nodeId: string, newProductId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onAddConnection: (
    fromNodeId: string,
    fromPortId: string,
    toNodeId: string,
    toPortId: string
  ) => ConnectResult;
  onReconnect: (
    connectionId: string,
    fromNodeId: string,
    fromPortId: string,
    toNodeId: string,
    toPortId: string
  ) => ConnectResult;
  onDeleteConnection: (connectionId: string) => void;
  onUpdateConnectionLength: (connectionId: string, meters: number) => void;
  onAutoLayoutNodes: () => void;
  onOpenCatalogModal?: () => void;
}

const NODE_WIDTH = 256;
const PORT_ROW_HEIGHT = 24;

export function getNodeHeaderHeight(prod?: AudioProduct): number {
  return prod?.category === 'speaker' ? 144 : 114;
}

export function getPortColor(signalType: PortSignalType): string {
  switch (signalType) {
    case 'speaker_lowz':
      return '#f97316'; // Orange-500
    case 'speaker_100v':
      return '#f59e0b'; // Amber-500
    case 'network_dante':
      return '#a855f7'; // Purple-500
    case 'mic_line':
    default:
      return '#06b6d4'; // Cyan-500
  }
}

export const SignalFlowCanvas: React.FC<SignalFlowCanvasProps> = ({
  catalog,
  catalogMap,
  nodes,
  connections,
  ampLoads,
  onAddNode,
  onRegisterProduct,
  onUpdateNodePosition,
  onUpdateNodeLabel,
  onSwapNodeProduct,
  onDeleteNode,
  onAddConnection,
  onReconnect,
  onDeleteConnection,
  onUpdateConnectionLength,
  onAutoLayoutNodes,
  onOpenCatalogModal,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(0.82);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 10, y: 10 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Active port-to-port wiring state
  const [wiringStart, setWiringStart] = useState<{
    nodeId: string;
    port: PortSpec;
    x: number;
    y: number;
  } | null>(null);
  const [mouseWorldPos, setMouseWorldPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedConnId, setSelectedConnId] = useState<string | null>(null);

  // Cable endpoint re-routing (drag a cable end onto another port) + feedback toast
  const [rewire, setRewire] = useState<{ connId: string; end: 'from' | 'to' } | null>(null);
  const [toast, setToast] = useState<ConnectResult | null>(null);
  React.useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [distributorFilter, setDistributorFilter] = useState<
    KoreanAudioDistributor['id'] | 'all'
  >('all');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setWiringStart(null);
        setRewire(null);
        setSelectedConnId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute exact port pin coordinates in canvas world space
  const getPortCoordinates = (
    node: SystemNode,
    portId: string
  ): { x: number; y: number; port: PortSpec } | null => {
    const prod = catalogMap.get(node.productId);
    if (!prod) return null;
    const inPorts = prod.ports.filter((p) => p.direction === 'in');
    const outPorts = prod.ports.filter((p) => p.direction === 'out');
    const headerH = getNodeHeaderHeight(prod);

    const inIdx = inPorts.findIndex((p) => p.id === portId);
    if (inIdx !== -1) {
      return {
        x: node.x,
        y: node.y + headerH + inIdx * PORT_ROW_HEIGHT + PORT_ROW_HEIGHT / 2,
        port: inPorts[inIdx],
      };
    }

    const outIdx = outPorts.findIndex((p) => p.id === portId);
    if (outIdx !== -1) {
      return {
        x: node.x + NODE_WIDTH,
        y: node.y + headerH + outIdx * PORT_ROW_HEIGHT + PORT_ROW_HEIGHT / 2,
        port: outPorts[outIdx],
      };
    }
    return null;
  };

  const clientToWorld = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    const world = clientToWorld(e.clientX, e.clientY);
    setMouseWorldPos(world);

    if (draggingNodeId) {
      onUpdateNodePosition(
        draggingNodeId,
        Math.max(10, Math.round((world.x - dragOffset.x) / 10) * 10),
        Math.max(10, Math.round((world.y - dragOffset.y) / 10) * 10)
      );
      return;
    }

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingNodeId(null);
    setIsPanning(false);
    if (rewire) {
      setToast({ ok: false, level: 'info', message: '포트 위에서 놓아야 연결이 변경됩니다. (원래 연결 유지)' });
      setRewire(null);
    }
  };

  /** Drop a dragged cable end onto a port → validate, reconnect or reject with warning */
  const handlePortDropForRewire = (nodeId: string, port: PortSpec) => {
    if (!rewire) return;
    const conn = connections.find((c) => c.id === rewire.connId);
    if (!conn) {
      setRewire(null);
      return;
    }
    const res =
      rewire.end === 'to'
        ? onReconnect(conn.id, conn.fromNodeId, conn.fromPortId, nodeId, port.id)
        : onReconnect(conn.id, nodeId, port.id, conn.toNodeId, conn.toPortId);
    setToast(res);
    setRewire(null);
  };

  /** Live compatibility of a port while dragging a cable end */
  const getRewireTargetState = (nodeId: string, port: PortSpec): 'ok' | 'bad' | null => {
    if (!rewire) return null;
    const conn = connections.find((c) => c.id === rewire.connId);
    if (!conn) return null;
    const fixedNode = rewire.end === 'to' ? conn.fromNodeId : conn.toNodeId;
    const fixedPortId = rewire.end === 'to' ? conn.fromPortId : conn.toPortId;
    const fixedProd = catalogMap.get(nodes.find((n) => n.id === fixedNode)?.productId || '');
    const fixedPort = fixedProd?.ports.find((p) => p.id === fixedPortId);
    if (!fixedPort || nodeId === fixedNode) return 'bad';
    const wantDir = rewire.end === 'to' ? 'in' : 'out';
    if (port.direction !== wantDir) return 'bad';
    return port.signalType === fixedPort.signalType ? 'ok' : 'bad';
  };

  const handleDropFromCatalog = (e: React.DragEvent) => {
    e.preventDefault();
    const productId = e.dataTransfer.getData('application/audiocad-product');
    const autoJson = e.dataTransfer.getData('application/audiocad-auto-product');
    const world = clientToWorld(e.clientX, e.clientY);
    const dropX = Math.max(20, Math.round((world.x - NODE_WIDTH / 2) / 10) * 10);
    const dropY = Math.max(20, Math.round((world.y - 40) / 10) * 10);

    if (autoJson) {
      try {
        const parsedProd = JSON.parse(autoJson) as AudioProduct;
        onAddNode(parsedProd.id, dropX, dropY, parsedProd);
        return;
      } catch {
        // fallback
      }
    }

    if (!productId) return;
    onAddNode(productId, dropX, dropY);
  };

  const activeDistributorObj =
    distributorFilter === 'all'
      ? null
      : DEFAULT_KOREAN_DISTRIBUTORS.find((d) => d.id === distributorFilter) || null;

  const filteredCatalog = catalog.filter((p) => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (activeDistributorObj) {
      const brandMatched = activeDistributorObj.brands.some(
        (b) => b.toLowerCase() === p.brand.toLowerCase()
      );
      if (!brandMatched) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.model.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // 기본 카탈로그에 없거나 추가 조회가 필요한 모델을 4대 총판 사이트 DB 및 자동 사양 파서에서 실시간 추출
  const autoFetchedDistributorRecords = React.useMemo(() => {
    if (!searchQuery.trim() && distributorFilter === 'all') return [];
    const records = searchOrSynthesizeDistributorProducts(
      searchQuery,
      catalog,
      distributorFilter === 'all' ? undefined : distributorFilter
    );
    return records.filter((r) =>
      categoryFilter === 'all' ? true : r.product.category === categoryFilter
    );
  }, [searchQuery, catalog, distributorFilter, categoryFilter]);

  const selectedConn = connections.find((c) => c.id === selectedConnId) || null;

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-950">
      {/* LEFT EQUIPMENT PALETTE (DRAG & DROP SIDEBAR) */}
      <aside className="w-68 shrink-0 border-r border-slate-800 bg-slate-900/90 flex flex-col">
        <div className="p-2.5 border-b border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 whitespace-nowrap">
              <Sliders className="w-3.5 h-3.5" /> 장비 라이브러리
            </h3>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                {filteredCatalog.length}종
              </span>
              {onOpenCatalogModal && (
                <button
                  type="button"
                  onClick={onOpenCatalogModal}
                  data-tooltip="브랜드 카탈로그 파일(PDF, CSV, TXT) 업로드하여 제품목록 자동추가"
                  data-tooltip-pos="right"
                  className="px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold flex items-center gap-1 transition"
                >
                  <FileUp className="w-3 h-3" /> 카탈로그 업로드
                </button>
              )}
            </div>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="모델·브랜드 검색 (미등록 시 자동수집)"
            className="w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />

          {/* 4대 기본 등록 공식 수입·총판 사이트 칩 (삼아사운드, 삼아CDS, 테크데이타PS, 온누리음향) */}
          <div className="flex items-center gap-1 flex-wrap">
            {DEFAULT_KOREAN_DISTRIBUTORS.map((dist) => {
              const isActive = distributorFilter === dist.id;
              return (
                <button
                  key={dist.id}
                  type="button"
                  onClick={() =>
                    setDistributorFilter((prev) => (prev === dist.id ? 'all' : dist.id))
                  }
                  data-tooltip={`${dist.name} (${dist.siteUrl}) | 취급: ${dist.brands.join(', ')}`}
                  data-tooltip-pos="right"
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-emerald-300 hover:border-emerald-500/40'
                  }`}
                >
                  {dist.shortLabel}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-1 text-[11px]">
            {[
              { id: 'all', label: '전체' },
              { id: 'source_mic', label: '소스·마이크' },
              { id: 'mixer', label: '믹서' },
              { id: 'dsp', label: 'DSP' },
              { id: 'amplifier', label: '앰프' },
              { id: 'speaker', label: '스피커' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`py-1 px-1.5 rounded font-medium whitespace-nowrap transition ${
                  categoryFilter === cat.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                    : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Equipment Draggable Cards (Minimal Dashboard Style + Auto-Fetched Distributor Specs) */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {/* 4대 총판 사이트 실시간 자동수집 결과 (카탈로그 미등록 모델 검색 또는 총판 필터 선택 시 자동 표시) */}
          {autoFetchedDistributorRecords.length > 0 && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-1.5 space-y-1.5 mb-2">
              <div className="flex items-center justify-between px-1">
                <span
                  data-tooltip="기본 카탈로그에 없는 모델을 삼아사운드·삼아CDS·테크데이타PS·온누리음향 취급 브랜드 DB에서 자동 추출했습니다"
                  data-tooltip-pos="right"
                  className="text-[10px] font-bold text-emerald-300 flex items-center gap-1 cursor-help"
                >
                  <Globe className="w-3 h-3" /> 총판 사이트 자동수집 ({autoFetchedDistributorRecords.length})
                </span>
              </div>

              {autoFetchedDistributorRecords.slice(0, 6).map((rec) => {
                const prod = rec.product;
                return (
                  <div
                    key={prod.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        'application/audiocad-auto-product',
                        JSON.stringify(prod)
                      );
                    }}
                    title={`[${rec.distributorName}] ${prod.name} | ${prod.description} (클릭 또는 드래그 시 자동 등록 및 배치)`}
                    className="rounded border border-emerald-500/40 bg-slate-950/95 p-2 hover:border-emerald-400 transition cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="min-w-0 flex items-center gap-1">
                        <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[9px] shrink-0">
                          {rec.distributorName}
                        </span>
                        <span className="text-[11px] font-mono text-white font-bold truncate">
                          {prod.brand} {prod.model}
                        </span>
                      </div>
                      <button
                        onClick={() => onAddNode(prod.id, undefined, undefined, prod)}
                        data-tooltip={`[${rec.distributorName}] 사양 자동등록 및 캔버스 배치`}
                        data-tooltip-pos="right"
                        className="px-1.5 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-bold flex items-center gap-0.5 shrink-0 transition"
                      >
                        <Plus className="w-2.5 h-2.5" /> 자동등록
                      </button>
                    </div>
                    <div className="flex justify-center bg-slate-900/70 rounded py-1">
                      <DeviceSvgArtwork
                        product={prod}
                        width={196}
                        height={prod.category === 'speaker' ? 58 : 38}
                        compact
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredCatalog.map((prod) => (
            <div
              key={prod.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/audiocad-product', prod.id);
              }}
              title={`${prod.name} | IN ${prod.ports.filter((p) => p.direction === 'in').length} · OUT ${prod.ports.filter((p) => p.direction === 'out').length} (드래그 또는 + 클릭)`}
              className="group rounded-lg border border-slate-800 bg-slate-950/90 p-2 hover:border-cyan-500/60 transition cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="min-w-0 flex items-center gap-1.5">
                  <span className="text-[11px] font-mono text-cyan-300 font-bold truncate">
                    {prod.brand} {prod.model}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono text-slate-400">
                    ₩{(prod.unitPriceKrw / 10000).toFixed(0)}만
                  </span>
                  <button
                    onClick={() => onAddNode(prod.id)}
                    data-tooltip={`${prod.name} 캔버스에 추가`}
                    className="rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 p-1 text-slate-300 transition"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="flex justify-center bg-slate-900/70 rounded py-1">
                <DeviceSvgArtwork
                  product={prod}
                  width={204}
                  height={prod.category === 'speaker' ? 66 : 42}
                  compact
                />
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* CENTER INTERACTIVE SIGNAL FLOW CANVAS */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top Canvas Toolbar & Legend */}
        <div className="h-10 border-b border-slate-800 bg-slate-900/90 px-3 flex items-center justify-between z-20 whitespace-nowrap">
          <div className="flex items-center gap-3 text-xs">
            <span
              data-tooltip="장비 우측 OUT 단자를 클릭한 뒤 연결할 장비의 좌측 IN 단자를 클릭하세요"
              data-tooltip-pos="bottom"
              className="font-semibold text-cyan-300 flex items-center gap-1 cursor-help bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded text-[11px]"
            >
              <Zap className="w-3 h-3 text-cyan-400" /> OUT➔IN 직각결선
            </span>

            {/* Multi-Color Cable Type Legend */}
            <div className="hidden lg:flex items-center gap-2.5 border-l border-slate-800 pl-3 text-[11px]">
              {CABLE_TYPE_LEGEND.map((item) => (
                <span
                  key={item.id}
                  data-tooltip={item.tooltip}
                  data-tooltip-pos="bottom"
                  className="flex items-center gap-1 whitespace-nowrap font-mono cursor-help"
                  style={{ color: item.color }}
                >
                  <span
                    className="w-3.5 inline-block rounded"
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

          {/* Zoom & Auto-Layout Controls */}
          <div className="flex items-center gap-1.5">
            {wiringStart && (
              <button
                onClick={() => setWiringStart(null)}
                data-tooltip="현재 진행 중인 포트 결선 취소(ESC)"
                data-tooltip-pos="bottom"
                className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-medium mr-1"
              >
                취소
              </button>
            )}
            <button
              onClick={onAutoLayoutNodes}
              data-tooltip="신호흐름 단계별로 장비 노드를 겹침 없이 자동 정렬"
              data-tooltip-pos="bottom"
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" /> 자동정렬
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.45, Math.round((z - 0.1) * 100) / 100))}
              data-tooltip="화면 축소"
              data-tooltip-pos="bottom"
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono text-slate-300 w-11 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 100) / 100))}
              data-tooltip="화면 확대"
              data-tooltip-pos="bottom"
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setZoom(0.85);
                setPan({ x: 10, y: 10 });
              }}
              data-tooltip="화면 배율 및 위치 초기화"
              data-tooltip-pos="bottom"
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300"
            >
              리셋
            </button>
          </div>
        </div>

        {/* Selected Cable Inspector Banner */}
        {selectedConn && (
          <div className="bg-slate-900/95 border-b border-cyan-500/40 px-4 py-2 flex items-center justify-between z-20 text-xs whitespace-nowrap">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-semibold">
                선택된 케이블: {selectedConn.connectorFrom}→{selectedConn.connectorTo}
              </span>
              <label className="flex items-center gap-1.5 text-slate-300">
                예상 배선거리(m):
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={selectedConn.estimatedLengthMeters}
                  onChange={(e) =>
                    onUpdateConnectionLength(selectedConn.id, Math.max(1, Number(e.target.value)))
                  }
                  className="w-16 rounded bg-slate-950 border border-slate-700 px-2 py-0.5 text-center font-mono text-cyan-300"
                />
                m
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onDeleteConnection(selectedConn.id);
                  setSelectedConnId(null);
                }}
                className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> 연결선삭제
              </button>
              <button
                onClick={() => setSelectedConnId(null)}
                className="px-2 py-1 text-slate-400 hover:text-slate-200"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* Interactive Canvas Area */}
        <div
          ref={canvasRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropFromCatalog}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvasBg === 'true') {
              setWiringStart(null);
              setSelectedConnId(null);
              setIsPanning(true);
              setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
            }
          }}
          data-canvas-bg="true"
          className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(51, 65, 85, 0.45) 1px, transparent 1px)',
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        >
          {/* Connection Feedback Toast (possible / blocked / auto model swap) */}
          {(toast || rewire) && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              className={`absolute top-3 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-lg border text-xs font-semibold shadow-xl max-w-[80%] ${
                rewire
                  ? 'bg-slate-900/95 border-white/50 text-white'
                  : toast?.level === 'error'
                  ? 'bg-rose-950/95 border-rose-500/70 text-rose-100'
                  : toast?.level === 'info'
                  ? 'bg-amber-950/95 border-amber-500/70 text-amber-100'
                  : 'bg-emerald-950/95 border-emerald-500/70 text-emerald-100'
              }`}
            >
              {rewire
                ? '연결선 끝을 옮길 포트 위에서 놓으세요 (초록 포트 = 연결 가능 · Esc 취소)'
                : `${toast?.level === 'error' ? '⛔ ' : toast?.level === 'info' ? '🔄 ' : '✅ '}${toast?.message}`}
            </div>
          )}

          {/* Animated CSS Keyframes for Signal Flow */}
          <style>{`
            @keyframes signalFlowAnim {
              from { stroke-dashoffset: 28; }
              to { stroke-dashoffset: 0; }
            }
            .cable-flow-anim {
              stroke-dasharray: 8 6;
              animation: signalFlowAnim 0.85s linear infinite;
            }
          `}</style>

          {/* World Transform Container */}
          <div
            data-canvas-bg="true"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: 2400,
              height: 1500,
              position: 'relative',
            }}
          >
            {/* Stage / Rack / Speaker Column Zone Guide Headers */}
            <div className="pointer-events-none select-none">
              {[
                { x: 50, w: 256, title: 'STAGE / INPUT SOURCES', sub: '마이크·미디어음원' },
                { x: 460, w: 256, title: 'FOH MIXING CONSOLE', sub: '아날로그·디지털믹서' },
                { x: 870, w: 256, title: 'DSP & DANTE NETWORK', sub: '프로세서·스위치' },
                { x: 1280, w: 256, title: 'POWER AMPLIFICATION', sub: '파워앰프(Low-Z/100V)' },
                { x: 1690, w: 256, title: 'LOUDSPEAKER SYSTEM', sub: '메인·딜레이·서브우퍼' },
              ].map((zone, i) => (
                <div
                  key={i}
                  style={{ left: zone.x, top: 12, width: zone.w }}
                  className="absolute border-b border-slate-800/80 pb-1 flex items-baseline justify-between px-1 whitespace-nowrap"
                >
                  <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400">
                    {zone.title}
                  </span>
                  <span className="text-[10px] text-slate-500">{zone.sub}</span>
                </div>
              ))}
            </div>

            {/* SVG LAYER FOR POINT-TO-POINT ORTHOGONAL (90-DEGREE) CABLES */}
            <svg
              width={2400}
              height={1800}
              className="absolute inset-0 pointer-events-none overflow-visible z-20"
            >
              <defs>
                {[
                  { id: 'arrow-xlr', color: '#06b6d4' },
                  { id: 'arrow-trs', color: '#10b981' },
                  { id: 'arrow-rca', color: '#3b82f6' },
                  { id: 'arrow-speakon', color: '#f97316' },
                  { id: 'arrow-highz100v', color: '#eab308' },
                  { id: 'arrow-dante', color: '#a855f7' },
                  { id: 'arrow-error', color: '#ef4444' },
                ].map((mk) => (
                  <marker
                    key={mk.id}
                    id={mk.id}
                    viewBox="0 0 10 10"
                    refX="9.5"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 9.5 5 L 0 8.5 z" fill={mk.color} />
                  </marker>
                ))}
              </defs>

              {(() => {
                // Global Non-Crossing Orthogonal Router + Semicircular Bridge Hop-Over (`⌒`) Generator
                const routedMap = routeAllCablesWithJumpOvers(
                  connections,
                  nodes,
                  catalogMap,
                  NODE_WIDTH,
                  PORT_ROW_HEIGHT
                );

                return connections.map((conn) => {
                  const routed = routedMap.get(conn.id);
                  if (!routed) return null;

                  const validation = validateConnection(conn, nodes, catalogMap);
                  const style = getCableVisualStyle(conn, nodes, catalogMap, validation.isValid);
                  const { pathD, badgeX, badgeY, jumpArcs } = routed;
                  const isSelected = selectedConnId === conn.id;
                  const isBeingRewired = rewire?.connId === conn.id;
                  const fromN = nodes.find((n) => n.id === conn.fromNodeId);
                  const toN = nodes.find((n) => n.id === conn.toNodeId);
                  const pinA = fromN ? getPortCoordinates(fromN, conn.fromPortId) : null;
                  const pinB = toN ? getPortCoordinates(toN, conn.toPortId) : null;

                  return (
                    <g
                      key={conn.id}
                      className="pointer-events-auto cursor-pointer group"
                      style={{ pointerEvents: rewire ? 'none' : undefined }}
                      opacity={isBeingRewired ? 0.25 : 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedConnId(conn.id);
                      }}
                    >
                      {/* Invisible wide hit path */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={14}
                        strokeLinejoin="round"
                      />

                      {/* Bridge Crossing Cut-Out Masks: clears out crossing background lines behind each jump arc */}
                      {jumpArcs?.map((arc, aIdx) => (
                        <circle
                          key={`arc-halo-${aIdx}`}
                          cx={arc.cx}
                          cy={arc.cy - 1}
                          r={arc.rx + 2.5}
                          fill="#020617"
                          stroke="#090d16"
                          strokeWidth={2}
                        />
                      ))}

                      {/* Dark Bridge-Separation Backing Halo (Makes Semicircular Jump-Over Bridges `⌒` Crisp) */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#090d16"
                        strokeWidth={style.strokeWidth + 3.8}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />

                      {/* Base Orthogonal + Bridge Jump-Over Cable Line */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={style.color}
                        strokeWidth={isSelected ? style.strokeWidth + 1.6 : style.strokeWidth}
                        strokeOpacity={isSelected ? 1.0 : 0.78}
                        strokeLinejoin="round"
                        strokeDasharray={style.dashArray}
                      />

                      {/* Animated Signal Flow Overlay */}
                      {validation.isValid && (
                        <path
                          d={pathD}
                          fill="none"
                          stroke={style.color}
                          strokeWidth={style.strokeWidth}
                          strokeLinejoin="round"
                          className="cable-flow-anim"
                          markerEnd={`url(#${style.markerId})`}
                        />
                      )}

                      {/* Docking snap rings at exact port pins: guarantees 100% pixel-perfect connection alignment */}
                      {pinA && (
                        <circle
                          cx={pinA.x}
                          cy={pinA.y}
                          r={4}
                          fill={style.color}
                          stroke="#090d16"
                          strokeWidth={1.5}
                          className="pointer-events-none"
                        />
                      )}
                      {pinB && (
                        <circle
                          cx={pinB.x}
                          cy={pinB.y}
                          r={4.5}
                          fill={style.color}
                          stroke="#090d16"
                          strokeWidth={1.5}
                          className="pointer-events-none"
                        />
                      )}

                      {/* Draggable endpoint grips: grab a cable end and drop it on another port */}
                      {[
                        { end: 'from' as const, pin: pinA },
                        { end: 'to' as const, pin: pinB },
                      ].map(
                        ({ end, pin }) =>
                          pin && (
                            <g
                              key={end}
                              className={
                                isSelected
                                  ? 'opacity-100'
                                  : 'opacity-0 group-hover:opacity-100 transition-opacity'
                              }
                              style={{ cursor: 'grab' }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setSelectedConnId(conn.id);
                                setWiringStart(null);
                                setRewire({ connId: conn.id, end });
                              }}
                            >
                              <circle cx={pin.x} cy={pin.y} r={9} fill="transparent" />
                              <circle
                                cx={pin.x}
                                cy={pin.y}
                                r={6}
                                fill="#020617"
                                stroke="#ffffff"
                                strokeWidth={1.6}
                              />
                              <circle cx={pin.x} cy={pin.y} r={2.4} fill={style.color} />
                            </g>
                          )
                      )}

                      {/* Compact Cable Badge (Visible on Hover or Selection to keep canvas clean) */}
                      <g
                        transform={`translate(${badgeX}, ${badgeY})`}
                        className={
                          isSelected || !validation.isValid
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100 transition-opacity'
                        }
                      >
                        <rect
                          x={-42}
                          y={-8}
                          width={84}
                          height={16}
                          rx={3.5}
                          fill="#090d16"
                          fillOpacity={0.95}
                          stroke={style.color}
                          strokeWidth={isSelected ? 1.6 : 1.0}
                        />
                        <text
                          x={0}
                          y={3}
                          textAnchor="middle"
                          fill={validation.isValid ? style.color : '#fca5a5'}
                          fontSize={8.5}
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {style.typeLabel}({conn.estimatedLengthMeters}m)
                        </text>
                      </g>
                    </g>
                  );
                });
              })()}

              {/* Cable End Re-Routing Preview */}
              {rewire && (() => {
                const conn = connections.find((c) => c.id === rewire.connId);
                if (!conn) return null;
                const fixedNode = nodes.find(
                  (n) => n.id === (rewire.end === 'to' ? conn.fromNodeId : conn.toNodeId)
                );
                const fixedPortId = rewire.end === 'to' ? conn.fromPortId : conn.toPortId;
                const fixed = fixedNode ? getPortCoordinates(fixedNode, fixedPortId) : null;
                if (!fixed) return null;
                const midX = Math.round((fixed.x + mouseWorldPos.x) / 2);
                const d = `M ${fixed.x} ${fixed.y} L ${midX} ${fixed.y} L ${midX} ${mouseWorldPos.y} L ${mouseWorldPos.x} ${mouseWorldPos.y}`;
                return (
                  <g pointerEvents="none">
                    <path
                      d={d}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={2.6}
                      strokeLinejoin="round"
                      strokeDasharray="6 5"
                    />
                    <circle cx={mouseWorldPos.x} cy={mouseWorldPos.y} r={5} fill="#ffffff" />
                  </g>
                );
              })()}

              {/* Active Dragging Orthogonal Wire Preview */}
              {wiringStart && (() => {
                const previewMidX = Math.round((wiringStart.x + mouseWorldPos.x) / 2);
                const previewPath = `M ${wiringStart.x} ${wiringStart.y} L ${previewMidX} ${wiringStart.y} L ${previewMidX} ${mouseWorldPos.y} L ${mouseWorldPos.x} ${mouseWorldPos.y}`;
                return (
                  <path
                    d={previewPath}
                    fill="none"
                    stroke={getPortPinColor(wiringStart.port)}
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeDasharray="5 5"
                  />
                );
              })()}
            </svg>

            {/* EQUIPMENT NODES */}
            {nodes.map((node) => {
              const product = catalogMap.get(node.productId);
              if (!product) return null;

              const inPorts = product.ports.filter((p) => p.direction === 'in');
              const outPorts = product.ports.filter((p) => p.direction === 'out');
              const maxPortRows = Math.max(inPorts.length, outPorts.length, 1);
              const artworkH = product.category === 'speaker' ? 82 : 48;

              // Find same-category products so user can swap model directly on the node
              const sameCategoryProducts = catalog.filter((p) => p.category === product.category);

              // Check if this is an amplifier or speaker to show live load badge
              const nodeAmpLoads = ampLoads.filter((a) => a.ampNodeId === node.id);

              return (
                <div
                  key={node.id}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: NODE_WIDTH,
                  }}
                  className="absolute rounded-lg ring-1 ring-slate-700/90 bg-slate-900/95 shadow-xl select-none z-10 hover:ring-cyan-500/70 transition-shadow"
                >
                  {/* Fixed-Height Top Header + SVG Faceplate (Guarantees 0px Pin Coordinate Drift) */}
                  <div
                    style={{ height: getNodeHeaderHeight(product) }}
                    className="flex flex-col justify-between border-b border-slate-800/80 bg-slate-950/90 rounded-t-lg overflow-hidden"
                  >
                    {/* Node Header (Draggable Handle + Model Swap Dropdown + Delete) */}
                    <div
                      onMouseDown={(e) => {
                        if (
                          (e.target as HTMLElement).tagName === 'SELECT' ||
                          (e.target as HTMLElement).tagName === 'INPUT'
                        ) {
                          return;
                        }
                        e.stopPropagation();
                        const world = clientToWorld(e.clientX, e.clientY);
                        setDraggingNodeId(node.id);
                        setDragOffset({ x: world.x - node.x, y: world.y - node.y });
                      }}
                      className="px-2.5 pt-1.5 pb-1 border-b border-slate-800 bg-slate-950/90 cursor-move"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <input
                          type="text"
                          value={node.customLabel}
                          onChange={(e) => onUpdateNodeLabel(node.id, e.target.value)}
                          className="bg-transparent text-xs font-bold text-cyan-300 focus:bg-slate-900 focus:outline-none rounded px-1 w-44 truncate"
                          title="클릭하여 장비 호칭 수정"
                        />
                        <button
                          onClick={() => onDeleteNode(node.id)}
                          className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition"
                          title="장비 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Direct Model Replacement Dropdown */}
                      <select
                        value={product.id}
                        onChange={(e) => onSwapNodeProduct(node.id, e.target.value)}
                        className="w-full rounded bg-slate-900 border border-slate-700/80 px-1.5 py-0.5 text-[10px] font-mono text-slate-200 focus:border-cyan-400 focus:outline-none cursor-pointer"
                        title={`${product.name} — 클릭하여 다른 제품 모델로 교체`}
                      >
                        {sameCategoryProducts.map((cand) => (
                          <option key={cand.id} value={cand.id}>
                            [{cand.brand}] {cand.model}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Realistic SVG Hardware Faceplate */}
                    <div className="px-2 flex-1 flex items-center justify-center bg-slate-950/50">
                      <DeviceSvgArtwork product={product} width={236} height={artworkH} />
                    </div>
                  </div>

                  {/* Point-to-Point Numbered Ports Section (Left: IN, Right: OUT) */}
                  <div className="relative pb-1.5">
                    {Array.from({ length: maxPortRows }).map((_, rowIdx) => {
                      const inPort = inPorts[rowIdx];
                      const outPort = outPorts[rowIdx];

                      const isWiringCompatibleTarget =
                        wiringStart &&
                        inPort &&
                        wiringStart.nodeId !== node.id &&
                        wiringStart.port.signalType === inPort.signalType;

                      const isWiringMismatchTarget =
                        wiringStart &&
                        inPort &&
                        wiringStart.nodeId !== node.id &&
                        wiringStart.port.signalType !== inPort.signalType;

                      return (
                        <div
                          key={rowIdx}
                          style={{ height: PORT_ROW_HEIGHT }}
                          className="flex items-center justify-between text-[10px] font-mono px-0"
                        >
                          {/* LEFT INPUT PORT */}
                          {inPort ? (
                            <button
                              type="button"
                              onMouseUp={(e) => {
                                if (rewire) {
                                  e.stopPropagation();
                                  handlePortDropForRewire(node.id, inPort);
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (wiringStart && wiringStart.nodeId !== node.id) {
                                  const res = onAddConnection(
                                    wiringStart.nodeId,
                                    wiringStart.port.id,
                                    node.id,
                                    inPort.id
                                  );
                                  setToast(res);
                                  if (res.ok) setWiringStart(null);
                                }
                              }}
                              className={`relative flex items-center gap-1.5 pl-3 pr-2 py-0.5 rounded-r transition text-left max-w-[126px] ${
                                rewire && getRewireTargetState(node.id, inPort) === 'ok'
                                  ? 'bg-emerald-500/30 text-emerald-100 ring-1 ring-emerald-400 animate-pulse'
                                  : rewire && getRewireTargetState(node.id, inPort) === 'bad'
                                  ? 'opacity-35'
                                  : isWiringCompatibleTarget
                                  ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400 animate-pulse'
                                  : isWiringMismatchTarget
                                  ? 'opacity-40 hover:bg-rose-500/20'
                                  : 'hover:bg-slate-800 text-slate-300'
                              }`}
                              title={`입력 포트: ${inPort.label} (${inPort.connector})`}
                            >
                              <span
                                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-slate-950"
                                style={{ left: -5, backgroundColor: getPortPinColor(inPort) }}
                              />
                              <span className="truncate">{inPort.label}</span>
                            </button>
                          ) : (
                            <span />
                          )}

                          {/* RIGHT OUTPUT PORT */}
                          {outPort ? (
                            <button
                              type="button"
                              onMouseUp={(e) => {
                                if (rewire) {
                                  e.stopPropagation();
                                  handlePortDropForRewire(node.id, outPort);
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const coords = getPortCoordinates(node, outPort.id);
                                if (coords) {
                                  setWiringStart({
                                    nodeId: node.id,
                                    port: outPort,
                                    x: coords.x,
                                    y: coords.y,
                                  });
                                }
                              }}
                              className={`relative flex items-center justify-end gap-1.5 pl-2 pr-3 py-0.5 rounded-l transition text-right max-w-[126px] ${
                                rewire && getRewireTargetState(node.id, outPort) === 'ok'
                                  ? 'bg-emerald-500/30 text-emerald-100 ring-1 ring-emerald-400 animate-pulse'
                                  : rewire && getRewireTargetState(node.id, outPort) === 'bad'
                                  ? 'opacity-35'
                                  : wiringStart?.nodeId === node.id && wiringStart.port.id === outPort.id
                                  ? 'bg-cyan-500/30 text-cyan-200 ring-1 ring-cyan-400'
                                  : 'hover:bg-slate-800 text-slate-300'
                              }`}
                              title={`출력 포트 클릭하여 결선 시작: ${outPort.label} (${outPort.connector})`}
                            >
                              <span className="truncate">{outPort.label}</span>
                              <span
                                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-slate-950"
                                style={{ right: -5, backgroundColor: getPortPinColor(outPort) }}
                              />
                            </button>
                          ) : (
                            <span />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Amplifier Load Status Pill neatly contained INSIDE Bottom of Amplifier Node */}
                  {nodeAmpLoads.length > 0 && (
                    <div className="mx-1.5 mb-1.5 bg-slate-950/90 border border-slate-800 rounded p-1.5 space-y-1">
                      {nodeAmpLoads.map((load) => (
                        <div
                          key={load.portId}
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center justify-between whitespace-nowrap ${
                            load.status === 'optimal'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : load.status === 'acceptable'
                              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                              : load.status === 'unconnected'
                              ? 'bg-slate-800/60 text-slate-500'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}
                        >
                          <span>CH{load.channelIndex}:</span>
                          <span className="truncate ml-1">
                            {load.mode === 'lowz'
                              ? `${load.totalImpedanceOhms}Ω·${load.ampAvailableWattsAtLoad}W`
                              : load.mode === 'highz_100v'
                              ? `100V·${load.totalTapWatts100v}W/${load.ampAvailableWattsAtLoad}W`
                              : '대기'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM AMPLIFIER-SPEAKER IMPEDANCE & POWER MATCHING STATUS BAR */}
        <div className="border-t border-slate-800 bg-slate-900/95 px-3 py-1.5 z-20 flex items-center gap-3 overflow-x-auto whitespace-nowrap">
          <span
            data-tooltip="파워앰프 출력 채널별 합성 임피던스(Ω) 및 정격 출력 매칭 상태"
            className="text-[11px] font-bold text-orange-400 flex items-center gap-1 shrink-0 cursor-help"
          >
            <Volume2 className="w-3.5 h-3.5" /> 앰프매칭
          </span>
          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
            {ampLoads.filter((l) => l.mode !== 'unconnected').length === 0 ? (
              <span className="text-[11px] text-slate-500">미결선</span>
            ) : (
              ampLoads
                .filter((l) => l.mode !== 'unconnected')
                .map((load) => (
                  <div
                    key={`${load.ampNodeId}_${load.portId}`}
                    data-tooltip={load.statusMessage}
                    className={`px-2 py-0.5 rounded border text-[11px] font-mono flex items-center gap-1 shrink-0 cursor-help ${
                      load.status === 'optimal'
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                        : load.status === 'acceptable'
                        ? 'bg-amber-950/50 border-amber-500/40 text-amber-200'
                        : 'bg-rose-950/70 border-rose-500/50 text-rose-200'
                    }`}
                  >
                    {load.status === 'optimal' ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                    )}
                    <span>
                      {load.ampProduct.model} CH{load.channelIndex}:
                    </span>
                    <strong className="text-white">
                      {load.mode === 'lowz'
                        ? `${load.totalImpedanceOhms}Ω·${load.ampAvailableWattsAtLoad}W`
                        : `100V·${load.totalTapWatts100v}W`}
                    </strong>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
