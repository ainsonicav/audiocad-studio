import React, { useEffect, useMemo, useState } from 'react';
import {
  AudioProduct,
  AutoDesignWizardInput,
  CableConnection,
  ConnectResult,
  OptimizationProposal,
  ProjectMeta,
  RoomConfig,
  SpeakerPlacement,
  SystemNode,
} from './types/audio';
import {
  computeCleanNodeLayout,
  computeRoomSplSimulation,
  estimateNodeRenderedHeight,
  generateGoalDrivenOptimizationProposals,
  generateRecommendedSystem,
  getSignalCategoryFromPortType,
  validateConnection,
} from './engine/audioPhysics';
import {
  loadLocalCatalog,
  SavedProjectPayload,
  saveLocalCatalog,
  saveProjectToStorage,
  syncCatalogWithCloud,
} from './services/cloudStorage';
import { SignalFlowCanvas } from './components/SignalFlowCanvas';
import { AcousticRoomSimulator } from './components/AcousticRoomSimulator';
import { BomAndCadReportView } from './components/BomAndCadReportView';
import { CatalogManagerModal } from './components/CatalogManagerModal';
import { AutoDesignModal } from './components/AutoDesignModal';
import { CloudSettingsModal } from './components/CloudSettingsModal';
import {
  Cloud,
  Database,
  FileSpreadsheet,
  GitBranch,
  Layers,
  Radio,
  Sparkles,
  Volume2,
  Wand2,
} from 'lucide-react';

type ActiveTab = 'schematic' | 'acoustics' | 'report';

export const App: React.FC = () => {
  const [catalog, setCatalog] = useState<AudioProduct[]>(() => loadLocalCatalog());
  const catalogMap = useMemo(() => {
    const map = new Map<string, AudioProduct>();
    catalog.forEach((p) => map.set(p.id, p));
    return map;
  }, [catalog]);

  // Initial Auto-Generated System for immediate interactive experience
  const initialDesign = useMemo(
    () =>
      generateRecommendedSystem(
        {
          purpose: 'auditorium',
          lengthMeters: 18,
          widthMeters: 12,
          heightMeters: 4.5,
          wirelessMicCount: 4,
          wiredMicCount: 2,
          bgmSourceCount: 1,
          includeSubwoofer: true,
          systemTopology: 'low_z',
          useDanteNetwork: false,
          budgetTier: 'standard',
        },
        catalog
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [meta, setMeta] = useState<ProjectMeta>({
    id: 'proj-default-001',
    projectName: '다목적 대강당 프로오디오시스템 구축 설계',
    clientName: '아인소닉 아트홀(18m×12m)',
    venueName: '본관 3층 대강당',
    designerName: '음향설계팀',
    companyName: 'Ainsonic AV Engineering',
    drawingNumber: 'DWG-2026-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    showPricingInReport: true,
    installationFeePercent: 12,
    discountPercent: 0,
    notes: '',
  });

  const [room, setRoom] = useState<RoomConfig>(initialDesign.room);
  const [nodes, setNodes] = useState<SystemNode[]>(initialDesign.nodes);
  const [connections, setConnections] = useState<CableConnection[]>(initialDesign.connections);
  const [placements, setPlacements] = useState<SpeakerPlacement[]>(initialDesign.placements);
  const [recommendationNotes, setRecommendationNotes] = useState<string[]>(
    initialDesign.recommendationNotes
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('schematic');
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [isAutoDesignModalOpen, setIsAutoDesignModalOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string>('로컬 자동저장 활성');

  // Real-time Electrical & Acoustic Physics Calculation
  const { summary: splSummary, ampLoads } = useMemo(
    () => computeRoomSplSimulation(room, placements, nodes, connections, catalogMap),
    [room, placements, nodes, connections, catalogMap]
  );

  // Real-time Goal-Driven Optimization Proposals (Target Average SPL & Target Uniformity ±dB)
  const optimizationProposals = useMemo(
    () =>
      generateGoalDrivenOptimizationProposals(
        room,
        placements,
        nodes,
        connections,
        catalog,
        catalogMap
      ),
    [room, placements, nodes, connections, catalog, catalogMap]
  );

  const handleApplyOptimizationProposal = (prop: OptimizationProposal) => {
    setNodes(prop.nextNodes);
    setConnections(prop.nextConnections);
    setPlacements(prop.nextPlacements);
    setRecommendationNotes([
      `[목표음압(${room.targetSplDb}dB)·편차(±${room.targetUniformityDb ?? 3.0}dB) 맞춤수정 반영] ${prop.title} ➔ 평균음압 ${prop.afterAvgSplDb}dB, 편차 ±${prop.afterUniformityDb}dB, 커버리지 ${prop.afterCoveragePercent}%`,
    ]);
    setMeta((prev) => ({ ...prev, updatedAt: new Date().toISOString() }));
  };

  // Calculate live total equipment cost for top header badge
  const totalEquipmentPriceKrw = useMemo(() => {
    return nodes.reduce((sum, n) => {
      const prod = catalogMap.get(n.productId);
      return sum + (prod?.unitPriceKrw || 0);
    }, 0);
  }, [nodes, catalogMap]);

  // Auto-save project changes
  useEffect(() => {
    const payload: SavedProjectPayload = {
      meta,
      room,
      nodes,
      connections,
      placements,
    };
    saveProjectToStorage(payload).then((res) => {
      setSyncStatusMessage(res.message);
    });
  }, [meta, room, nodes, connections, placements]);

  // Add a new equipment node to the schematic (and if it's a speaker, also place it in the room!)
  const handleAddNode = (
    productId: string,
    x?: number,
    y?: number,
    directProduct?: AudioProduct
  ) => {
    let prod = catalogMap.get(productId) || directProduct;
    if (!prod) return;

    if (!catalogMap.has(prod.id)) {
      const updatedCatalog = [prod, ...catalog];
      setCatalog(updatedCatalog);
      saveLocalCatalog(updatedCatalog);
      syncCatalogWithCloud(updatedCatalog).then((res) => setSyncStatusMessage(res.message));
    }

    const sameCategoryCount = nodes.filter(
      (n) => catalogMap.get(n.productId)?.category === prod.category
    ).length;

    const defaultXByCat: Record<AudioProduct['category'], number> = {
      source_mic: 50,
      mixer: 460,
      dsp: 870,
      network: 870,
      amplifier: 1280,
      speaker: 1690,
    };

    const targetColX = defaultXByCat[prod.category];
    const nodesInSameCol = nodes.filter((n) => Math.abs(n.x - targetColX) < 120);
    const bottomMostY = nodesInSameCol.reduce((maxBottom, n) => {
      const nProd = catalogMap.get(n.productId);
      return Math.max(maxBottom, n.y + estimateNodeRenderedHeight(nProd) + 28);
    }, 60);

    const nodeId = `node_${prod.category}_${Date.now()}`;
    const label = `${prod.model}#${sameCategoryCount + 1}`;
    const newNode: SystemNode = {
      id: nodeId,
      productId: prod.id,
      customLabel: label,
      x: x ?? targetColX,
      y: y ?? bottomMostY,
    };

    setNodes((prev) => [...prev, newNode]);

    // If it's a speaker, automatically add a linked SpeakerPlacement in the room floorplan!
    if (prod.category === 'speaker') {
      const spkCount = placements.length;
      const newPlacement: SpeakerPlacement = {
        id: `place_${nodeId}`,
        nodeId,
        productId: prod.id,
        label,
        xMeters: Math.round(room.lengthMeters * 0.25 * 10) / 10,
        yMeters:
          Math.round(
            room.widthMeters * (spkCount % 2 === 0 ? 0.22 : 0.78) * 10
          ) / 10,
        zHeightMeters:
          prod.enclosureShape === 'ceiling'
            ? room.heightMeters - 0.1
            : prod.enclosureShape === 'subwoofer'
            ? 0.4
            : Math.min(3.2, room.heightMeters * 0.7),
        azimuthDeg: 0,
        tiltDownDeg: prod.enclosureShape === 'ceiling' ? 88 : 14,
      };
      setPlacements((prev) => [...prev, newPlacement]);
    }
  };

  const handleUpdateNodePosition = (nodeId: string, x: number, y: number) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, x, y } : n)));
  };

  const handleUpdateNodeLabel = (nodeId: string, customLabel: string) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, customLabel } : n)));
    setPlacements((prev) =>
      prev.map((pl) => (pl.nodeId === nodeId ? { ...pl, label: customLabel } : pl))
    );
  };

  // Remap connections intelligently when a node's product model is swapped
  const remapConnectionsForSwappedNode = (
    currentConnections: CableConnection[],
    targetNodeId: string,
    oldProd: AudioProduct | undefined,
    newProd: AudioProduct
  ): CableConnection[] => {
    const newInPorts = newProd.ports.filter((p) => p.direction === 'in');
    const newOutPorts = newProd.ports.filter((p) => p.direction === 'out');

    return currentConnections
      .map((conn) => {
        if (conn.toNodeId === targetNodeId) {
          // Find same port id or same index/signalType
          const exact = newInPorts.find((p) => p.id === conn.toPortId);
          if (exact) return conn;

          const oldInPorts = oldProd?.ports.filter((p) => p.direction === 'in') || [];
          const oldIdx = Math.max(0, oldInPorts.findIndex((p) => p.id === conn.toPortId));
          const replacement = newInPorts[oldIdx] || newInPorts[0];
          if (!replacement) return null;

          return {
            ...conn,
            toPortId: replacement.id,
            connectorTo: replacement.connector,
            cableCategory: getSignalCategoryFromPortType(replacement.signalType),
          };
        }

        if (conn.fromNodeId === targetNodeId) {
          const exact = newOutPorts.find((p) => p.id === conn.fromPortId);
          if (exact) return conn;

          const oldOutPorts = oldProd?.ports.filter((p) => p.direction === 'out') || [];
          const oldIdx = Math.max(0, oldOutPorts.findIndex((p) => p.id === conn.fromPortId));
          const replacement = newOutPorts[oldIdx] || newOutPorts[0];
          if (!replacement) return null;

          return {
            ...conn,
            fromPortId: replacement.id,
            connectorFrom: replacement.connector,
            cableCategory: getSignalCategoryFromPortType(replacement.signalType),
          };
        }

        return conn;
      })
      .filter((c): c is CableConnection => c !== null);
  };

  /** Swap a single node's product (from Schematic or Room Simulator) and cascade updates */
  const handleSwapNodeProduct = (nodeId: string, newProductId: string) => {
    const newProd = catalogMap.get(newProductId);
    if (!newProd) return;

    const targetNode = nodes.find((n) => n.id === nodeId);
    const oldProd = targetNode ? catalogMap.get(targetNode.productId) : undefined;

    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, productId: newProductId } : n))
    );
    setConnections((prev) =>
      remapConnectionsForSwappedNode(prev, nodeId, oldProd, newProd)
    );
    setPlacements((prev) =>
      prev.map((pl) =>
        pl.nodeId === nodeId
          ? {
              ...pl,
              productId: newProductId,
              tiltDownDeg:
                newProd.enclosureShape === 'ceiling'
                  ? 88
                  : pl.tiltDownDeg >= 80
                  ? 14
                  : pl.tiltDownDeg,
            }
          : pl
      )
    );
    setMeta((prev) => ({ ...prev, updatedAt: new Date().toISOString() }));
  };

  /** Swap all instances of oldProductId to newProductId (from Final BOM / Report View) */
  const handleSwapProductEverywhere = (oldProductId: string, newProductId: string) => {
    if (oldProductId === newProductId) return;
    const newProd = catalogMap.get(newProductId);
    const oldProd = catalogMap.get(oldProductId);
    if (!newProd) return;

    const affectedNodeIds = nodes
      .filter((n) => n.productId === oldProductId)
      .map((n) => n.id);

    setNodes((prev) =>
      prev.map((n) => (n.productId === oldProductId ? { ...n, productId: newProductId } : n))
    );

    setConnections((prev) => {
      let updated = prev;
      for (const nId of affectedNodeIds) {
        updated = remapConnectionsForSwappedNode(updated, nId, oldProd, newProd);
      }
      return updated;
    });

    setPlacements((prev) =>
      prev.map((pl) =>
        pl.productId === oldProductId
          ? {
              ...pl,
              productId: newProductId,
              tiltDownDeg:
                newProd.enclosureShape === 'ceiling'
                  ? 88
                  : pl.tiltDownDeg >= 80
                  ? 14
                  : pl.tiltDownDeg,
            }
          : pl
      )
    );
    setMeta((prev) => ({ ...prev, updatedAt: new Date().toISOString() }));
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setConnections((prev) =>
      prev.filter((c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId)
    );
    setPlacements((prev) => prev.filter((pl) => pl.nodeId !== nodeId));
  };

  /**
   * Validates and creates (or re-routes) a cable.
   * - Impossible links (wrong direction / signal type / Low-Z vs 100V) are BLOCKED with an error.
   * - If the target input is occupied, the next free compatible input is used.
   * - If the device is completely full, it is auto-swapped to a compatible larger model
   *   (keeping every existing cable) and then connected.
   */
  const tryConnect = (
    fromNodeId: string,
    fromPortId: string,
    toNodeId: string,
    toPortId: string,
    replaceConnId?: string
  ): ConnectResult => {
    const others = connections.filter((c) => c.id !== replaceConnId);
    const fromNode = nodes.find((n) => n.id === fromNodeId);
    const toNode = nodes.find((n) => n.id === toNodeId);
    const fromProd = fromNode ? catalogMap.get(fromNode.productId) : undefined;
    const toProd = toNode ? catalogMap.get(toNode.productId) : undefined;
    const fromPort = fromProd?.ports.find((p) => p.id === fromPortId);
    const toPort = toProd?.ports.find((p) => p.id === toPortId);
    if (!fromNode || !toNode || !fromProd || !toProd || !fromPort || !toPort) {
      return { ok: false, level: 'error', message: '포트를 찾을 수 없어 연결할 수 없습니다.' };
    }
    if (fromNodeId === toNodeId) {
      return { ok: false, level: 'error', message: '같은 장비끼리는 연결할 수 없습니다.' };
    }

    // 1) Technical validity (direction, signal type, Low-Z / 100V, high-voltage miswire)
    const probe: CableConnection = {
      id: replaceConnId || 'probe',
      fromNodeId,
      fromPortId,
      toNodeId,
      toPortId,
      cableCategory: getSignalCategoryFromPortType(fromPort.signalType),
      connectorFrom: fromPort.connector,
      connectorTo: toPort.connector,
      estimatedLengthMeters: 5,
    };
    const validation = validateConnection(probe, nodes, catalogMap);
    if (!validation.isValid) {
      return { ok: false, level: 'error', message: `연결 불가: ${validation.message}` };
    }

    const isUsedIn = (list: CableConnection[], nodeId: string, portId: string) =>
      list.some((c) => c.toNodeId === nodeId && c.toPortId === portId);

    let finalToPortId = toPort.id;
    let note = '';
    let swapTo: AudioProduct | null = null;
    let workingConns = others;

    if (isUsedIn(others, toNodeId, toPortId)) {
      // 2) Occupied → next free input of same signal type on the same device
      const freeSame = toProd.ports.find(
        (p) =>
          p.direction === 'in' &&
          p.signalType === fromPort.signalType &&
          !isUsedIn(others, toNodeId, p.id)
      );
      if (freeSame) {
        finalToPortId = freeSame.id;
        note = ` (선택 포트 사용중 → 빈 포트 ${freeSame.label}로 연결)`;
      } else {
        // 3) Device full → auto-swap to the closest compatible model that keeps all cables
        const usedHere = others.filter((c) => c.toNodeId === toNodeId || c.fromNodeId === toNodeId);
        const candidates = catalog
          .filter((p) => p.category === toProd.category && p.id !== toProd.id)
          .filter((p) =>
            usedHere.every((c) =>
              c.toNodeId === toNodeId
                ? p.ports.some((pp) => pp.id === c.toPortId && pp.direction === 'in')
                : p.ports.some((pp) => pp.id === c.fromPortId && pp.direction === 'out')
            )
          )
          .filter((p) =>
            p.ports.some(
              (pp) =>
                pp.direction === 'in' &&
                pp.signalType === fromPort.signalType &&
                !isUsedIn(others, toNodeId, pp.id)
            )
          )
          .sort((a, b) => {
            const inCount = (x: AudioProduct) => x.ports.filter((q) => q.direction === 'in').length;
            const da = Math.abs(inCount(a) - inCount(toProd));
            const db = Math.abs(inCount(b) - inCount(toProd));
            return da - db || a.unitPriceKrw - b.unitPriceKrw;
          });

        if (candidates.length === 0) {
          return {
            ok: false,
            level: 'error',
            message: `연결 불가: ${toProd.model}의 입력이 모두 사용중이며 교체 가능한 다른 모델이 없습니다.`,
          };
        }
        swapTo = candidates[0];
        const freePort = swapTo.ports.find(
          (pp) =>
            pp.direction === 'in' &&
            pp.signalType === fromPort.signalType &&
            !isUsedIn(others, toNodeId, pp.id)
        )!;
        finalToPortId = freePort.id;
        note = ` (${toProd.model} 입력 가득참 → ${swapTo.brand} ${swapTo.model}(으)로 자동 교체)`;
      }
    }

    const finalToProd = swapTo || toProd;
    const finalToPort = finalToProd.ports.find((p) => p.id === finalToPortId)!;
    const category = getSignalCategoryFromPortType(fromPort.signalType);
    const newConn: CableConnection = {
      id: replaceConnId || `conn_${Date.now()}`,
      fromNodeId,
      fromPortId,
      toNodeId,
      toPortId: finalToPortId,
      cableCategory: category,
      connectorFrom: fromPort.connector,
      connectorTo: finalToPort.connector,
      estimatedLengthMeters:
        connections.find((c) => c.id === replaceConnId)?.estimatedLengthMeters ??
        (category === 'speaker' ? 22 : category === 'network' ? 15 : 5),
    };

    if (swapTo) {
      handleSwapNodeProduct(toNodeId, swapTo.id);
    }
    void workingConns;
    setConnections((prev) => [...prev.filter((c) => c.id !== replaceConnId), newConn]);

    return {
      ok: true,
      level: swapTo ? 'info' : 'success',
      message: `연결 완료: ${fromPort.label} → ${finalToPort.label}${note}`,
    };
  };

  const handleAddConnection = (
    fromNodeId: string,
    fromPortId: string,
    toNodeId: string,
    toPortId: string
  ): ConnectResult => {
    const exists = connections.some(
      (c) =>
        c.fromNodeId === fromNodeId &&
        c.fromPortId === fromPortId &&
        c.toNodeId === toNodeId &&
        c.toPortId === toPortId
    );
    if (exists) {
      return { ok: false, level: 'info', message: '이미 같은 연결이 있습니다.' };
    }
    return tryConnect(fromNodeId, fromPortId, toNodeId, toPortId);
  };

  const handleReconnect = (
    connectionId: string,
    fromNodeId: string,
    fromPortId: string,
    toNodeId: string,
    toPortId: string
  ): ConnectResult => tryConnect(fromNodeId, fromPortId, toNodeId, toPortId, connectionId);

  const handleDeleteConnection = (connectionId: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== connectionId));
  };

  const handleUpdateConnectionLength = (connectionId: string, meters: number) => {
    setConnections((prev) =>
      prev.map((c) => (c.id === connectionId ? { ...c, estimatedLengthMeters: meters } : c))
    );
  };

  const handleAutoLayoutNodes = () => {
    setNodes((prev) => computeCleanNodeLayout(prev, catalogMap));
  };

  const handleRunAutoDesign = (wizardInput: AutoDesignWizardInput) => {
    const result = generateRecommendedSystem(wizardInput, catalog);
    setRoom(result.room);
    setNodes(result.nodes);
    setConnections(result.connections);
    setPlacements(result.placements);
    setRecommendationNotes(result.recommendationNotes);
    setMeta((prev) => ({
      ...prev,
      projectName: `${wizardInput.lengthMeters}m×${wizardInput.widthMeters}m 공간 맞춤형 오디오시스템 설계`,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleAddProductToCatalog = (newProd: AudioProduct) => {
    const updated = [newProd, ...catalog];
    setCatalog(updated);
    saveLocalCatalog(updated);
    syncCatalogWithCloud(updated).then((res) => setSyncStatusMessage(res.message));
  };

  const handleDeleteProductFromCatalog = (productId: string) => {
    const updated = catalog.filter((p) => p.id !== productId);
    setCatalog(updated);
    saveLocalCatalog(updated);
  };

  const handleImportProducts = (imported: AudioProduct[]) => {
    const merged = [...imported, ...catalog];
    setCatalog(merged);
    saveLocalCatalog(merged);
    syncCatalogWithCloud(merged).then((res) => setSyncStatusMessage(res.message));
  };

  const handleTriggerCloudSync = () => {
    syncCatalogWithCloud(catalog).then((res) => {
      setCatalog(res.catalog);
      setSyncStatusMessage(res.message);
    });
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* TOP GLOBAL NAVIGATION & LIVE ENGINEERING KPI HEADER */}
      <header className="no-print h-12 shrink-0 border-b border-slate-800 bg-slate-950/95 px-4 flex items-center justify-between gap-3 z-30">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Volume2 className="w-4 h-4 text-slate-950" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-white whitespace-nowrap">
              AudioCAD
            </h1>
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-mono text-cyan-300">
              PRO
            </span>
          </div>
        </div>

        {/* CENTER 3-VIEW SWITCHER TABS */}
        <nav className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('schematic')}
            data-tooltip="장비 배치 및 포인트투포인트 입출력 직각 결선 계통도"
            data-tooltip-pos="bottom"
            className={`px-3.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition ${
              activeTab === 'schematic'
                ? 'bg-cyan-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            1. 계통도
          </button>

          <button
            onClick={() => setActiveTab('acoustics')}
            data-tooltip="공간 평면·단면 SPL 음압분포도 및 목표음압·편차 수정제안"
            data-tooltip-pos="bottom"
            className={`px-3.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition ${
              activeTab === 'acoustics'
                ? 'bg-orange-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            2. 음압분포(SPL)
          </button>

          <button
            onClick={() => setActiveTab('report')}
            data-tooltip="산출내역서(BOM) 모델 변경 및 2D CAD 도면(PDF 3매) 출력"
            data-tooltip-pos="bottom"
            className={`px-3.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition ${
              activeTab === 'report'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            3. 내역서·도면
          </button>
        </nav>

        {/* RIGHT LIVE METRICS & ACTION BUTTONS */}
        <div className="flex items-center gap-2">
          {/* Live SPL, Uniformity & Price Pill */}
          <div
            onClick={() => setActiveTab('acoustics')}
            data-tooltip={`목표 ${room.targetSplDb}dB / 기준편차 ±${room.targetUniformityDb ?? 3.0}dB (클릭 시 음압 시뮬레이터 이동)`}
            data-tooltip-pos="bottom"
            className="hidden xl:flex items-center gap-2.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-mono whitespace-nowrap cursor-pointer transition"
          >
            <div className="flex items-center gap-1">
              <span className="text-slate-500">평균</span>
              <strong className="text-cyan-300">{splSummary.avgSplDb}dB</strong>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1">
              <span className="text-slate-500">편차</span>
              <strong className="text-amber-300">±{splSummary.uniformityPlusMinusDb}dB</strong>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1">
              <strong className="text-emerald-300">₩{totalEquipmentPriceKrw.toLocaleString()}</strong>
            </div>
          </div>

          <button
            onClick={() => setIsAutoDesignModalOpen(true)}
            data-tooltip="공간 규격·용도 입력 시 최적 장비 구성 및 결선 자동 생성"
            data-tooltip-pos="bottom"
            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 text-xs font-bold flex items-center gap-1 shadow-md shadow-cyan-500/15 whitespace-nowrap transition"
          >
            <Wand2 className="w-3.5 h-3.5" /> AI 설계
          </button>

          <button
            onClick={() => setIsCatalogModalOpen(true)}
            data-tooltip="신규 장비·사양 직접 등록 및 CSV/JSON 제품 목록 일괄 업로드"
            data-tooltip-pos="bottom"
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold flex items-center gap-1 whitespace-nowrap transition"
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" /> 장비 DB
          </button>

          <button
            onClick={() => setIsCloudModalOpen(true)}
            data-tooltip="클라우드 DB(Supabase) 연동 및 프로젝트 JSON 백업·열기"
            data-tooltip-pos="bottom"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition"
          >
            <Cloud className="w-4 h-4 text-cyan-400" />
          </button>
        </div>
      </header>

      {/* MAIN WORKSPACE CONTENT */}
      <main className="flex-1 min-h-0 relative overflow-hidden">
        {activeTab === 'schematic' && (
          <SignalFlowCanvas
            catalog={catalog}
            catalogMap={catalogMap}
            nodes={nodes}
            connections={connections}
            ampLoads={ampLoads}
            onAddNode={handleAddNode}
            onRegisterProduct={handleAddProductToCatalog}
            onUpdateNodePosition={handleUpdateNodePosition}
            onUpdateNodeLabel={handleUpdateNodeLabel}
            onSwapNodeProduct={handleSwapNodeProduct}
            onDeleteNode={handleDeleteNode}
            onAddConnection={handleAddConnection}
            onReconnect={handleReconnect}
            onDeleteConnection={handleDeleteConnection}
            onUpdateConnectionLength={handleUpdateConnectionLength}
            onAutoLayoutNodes={handleAutoLayoutNodes}
            onOpenCatalogModal={() => setIsCatalogModalOpen(true)}
          />
        )}

        {activeTab === 'acoustics' && (
          <AcousticRoomSimulator
            room={room}
            placements={placements}
            catalog={catalog}
            catalogMap={catalogMap}
            splSummary={splSummary}
            proposals={optimizationProposals}
            onUpdateRoom={(patch) => setRoom((prev) => ({ ...prev, ...patch }))}
            onUpdatePlacement={(id, patch) =>
              setPlacements((prev) => prev.map((pl) => (pl.id === id ? { ...pl, ...patch } : pl)))
            }
            onSwapNodeProduct={handleSwapNodeProduct}
            onApplyProposal={handleApplyOptimizationProposal}
          />
        )}

        {activeTab === 'report' && (
          <BomAndCadReportView
            meta={meta}
            room={room}
            catalog={catalog}
            catalogMap={catalogMap}
            nodes={nodes}
            connections={connections}
            placements={placements}
            ampLoads={ampLoads}
            splSummary={splSummary}
            onUpdateMeta={(patch) => setMeta((prev) => ({ ...prev, ...patch }))}
            onSwapProductEverywhere={handleSwapProductEverywhere}
          />
        )}
      </main>

      {/* MODALS */}
      <CatalogManagerModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        catalog={catalog}
        onAddProduct={handleAddProductToCatalog}
        onDeleteProduct={handleDeleteProductFromCatalog}
        onImportProducts={handleImportProducts}
      />

      <AutoDesignModal
        isOpen={isAutoDesignModalOpen}
        onClose={() => setIsAutoDesignModalOpen(false)}
        onRunAutoDesign={handleRunAutoDesign}
      />

      <CloudSettingsModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        currentProject={{ meta, room, nodes, connections, placements }}
        onLoadProjectPayload={(payload) => {
          setMeta(payload.meta);
          setRoom(payload.room);
          setNodes(payload.nodes);
          setConnections(payload.connections);
          setPlacements(payload.placements);
        }}
        onTriggerCloudSync={handleTriggerCloudSync}
        syncStatusMessage={syncStatusMessage}
      />
    </div>
  );
};
export default App;
