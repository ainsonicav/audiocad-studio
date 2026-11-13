import React, { useState } from 'react';
import {
  AudioProduct,
  EnclosureShape,
  PortSpec,
  ProductCategory,
} from '../types/audio';
import { DeviceSvgArtwork } from './DeviceSvgArtwork';
import {
  DEFAULT_KOREAN_DISTRIBUTORS,
  KoreanAudioDistributor,
  searchOrSynthesizeDistributorProducts,
  synthesizeProductFromModelQuery,
} from '../services/distributorCatalog';
import {
  extractTextFromCatalogFile,
  parseCatalogText,
  ParsedCatalogResult,
} from '../services/catalogParser';
import {
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FileUp,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

interface CatalogManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: AudioProduct[];
  onAddProduct: (product: AudioProduct) => void;
  onDeleteProduct: (productId: string) => void;
  onImportProducts: (products: AudioProduct[]) => void;
  initialTab?: 'upload' | 'manual';
}

export const CatalogManagerModal: React.FC<CatalogManagerModalProps> = ({
  isOpen,
  onClose,
  catalog,
  onAddProduct,
  onDeleteProduct,
  onImportProducts,
  initialTab = 'upload',
}) => {
  const [modalMode, setModalMode] = useState<'upload' | 'manual'>(initialTab);

  // =========================================================================
  // 1. BRAND CATALOG FILE / TEXT UPLOAD & AI SPEC PARSER STATE
  // =========================================================================
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedCatalogResult | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [forcedBrand, setForcedBrand] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // =========================================================================
  // 2. MANUAL PRODUCT FORM STATE
  // =========================================================================
  const [category, setCategory] = useState<ProductCategory>('speaker');
  const [brand, setBrand] = useState('Ainsonic Custom');
  const [model, setModel] = useState('PRO-12X');
  const [name, setName] = useState('12" 커스텀 패시브스피커');
  const [unitPriceKrw, setUnitPriceKrw] = useState(850000);
  const [description, setDescription] = useState('사용자 추가 커스텀사양 장비');
  const [customImageUrl, setCustomImageUrl] = useState('');

  // Speaker Form State
  const [spkType, setSpkType] = useState<'passive_lowz' | 'active' | 'subwoofer' | 'column' | 'highz_100v'>('passive_lowz');
  const [impedanceOhms, setImpedanceOhms] = useState(8);
  const [rmsWatts, setRmsWatts] = useState(400);
  const [sensitivityDb, setSensitivityDb] = useState(97);
  const [dispersionH, setDispersionH] = useState(90);
  const [dispersionV, setDispersionV] = useState(60);
  const [driverInch, setDriverInch] = useState(12);
  const [tap100vWatts, setTap100vWatts] = useState(30);

  // Amplifier Form State
  const [ampChannels, setAmpChannels] = useState(2);
  const [watts8Ohm, setWatts8Ohm] = useState(600);
  const [watts4Ohm, setWatts4Ohm] = useState(950);
  const [supports100v, setSupports100v] = useState(false);
  const [watts100v, setWatts100v] = useState(350);
  const [ampHasDante, setAmpHasDante] = useState(false);

  // Mixer / DSP / Generic Port Counts
  const [inPortCount, setInPortCount] = useState(12);
  const [outPortCount, setOutPortCount] = useState(6);
  const [isDigitalMixer, setIsDigitalMixer] = useState(true);
  const [hasDantePort, setHasDantePort] = useState(false);

  // 4대 공식 총판 자동 조회 상태
  const [distQuery, setDistQuery] = useState('');
  const [selectedDistId, setSelectedDistId] = useState<KoreanAudioDistributor['id'] | 'all'>('all');
  const [autoFillBanner, setAutoFillBanner] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCatalogFileSelected = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    setUploadedFileName(file.name);
    try {
      const extractedText = await extractTextFromCatalogFile(file);
      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error('파일에서 읽을 수 있는 텍스트나 사양 데이터를 추출하지 못했습니다.');
      }
      const result = parseCatalogText(extractedText, {
        forcedBrand: forcedBrand.trim() || undefined,
        fileName: file.name,
      });
      if (result.products.length === 0) {
        throw new Error('파일에서 유효한 제품 모델명이나 사양을 찾지 못했습니다. 텍스트 직접 입력 탭에서 복사하여 붙여넣어 보세요.');
      }
      setParsedResult(result);
      if (!forcedBrand && result.brandDetected) {
        setForcedBrand(result.brandDetected);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '카탈로그 파싱 중 오류가 발생했습니다.';
      setParseError(msg);
    } finally {
      setIsParsing(false);
    }
  };

  const handleParsePastedText = () => {
    if (!pastedText.trim()) return;
    setIsParsing(true);
    setParseError(null);
    try {
      const result = parseCatalogText(pastedText, {
        forcedBrand: forcedBrand.trim() || undefined,
        fileName: uploadedFileName || undefined,
      });
      if (result.products.length === 0) {
        throw new Error('입력한 텍스트에서 제품 모델명이나 사양을 찾지 못했습니다.');
      }
      setParsedResult(result);
      if (!forcedBrand && result.brandDetected) {
        setForcedBrand(result.brandDetected);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '텍스트 분석 중 오류가 발생했습니다.';
      setParseError(msg);
    } finally {
      setIsParsing(false);
    }
  };

  const handleCommitParsedProducts = () => {
    if (!parsedResult || parsedResult.products.length === 0) return;
    // Apply forced brand if modified by user
    const finalProducts = parsedResult.products.map((p) =>
      forcedBrand.trim() ? { ...p, brand: forcedBrand.trim() } : p
    );
    onImportProducts(finalProducts);
    alert(`[${forcedBrand || parsedResult.brandDetected}] ${finalProducts.length}종의 제품이 제품 목록에 자동 추가되었습니다!`);
    setParsedResult(null);
    onClose();
  };

  const handleRemoveParsedCandidate = (idxToRemove: number) => {
    if (!parsedResult) return;
    const nextList = parsedResult.products.filter((_, idx) => idx !== idxToRemove);
    setParsedResult({
      ...parsedResult,
      totalParsed: nextList.length,
      products: nextList,
    });
  };

  const populateFormFromDistributorProduct = (prod: AudioProduct, distName: string) => {
    setCategory(prod.category);
    setBrand(prod.brand);
    setModel(prod.model);
    setName(prod.name);
    setUnitPriceKrw(prod.unitPriceKrw);
    setDescription(prod.description);
    if (prod.speaker) {
      setSpkType(prod.speaker.type);
      setImpedanceOhms(prod.speaker.impedanceOhms || 8);
      setRmsWatts(prod.speaker.rmsWatts);
      setSensitivityDb(prod.speaker.sensitivityDb);
      setDispersionH(prod.speaker.dispersionHorizontalDeg);
      setDispersionV(prod.speaker.dispersionVerticalDeg);
      setDriverInch(prod.speaker.driverSizeInch);
      if (prod.speaker.tap100vWatts) setTap100vWatts(prod.speaker.tap100vWatts);
    } else if (prod.amplifier) {
      setAmpChannels(prod.amplifier.channels);
      setWatts8Ohm(prod.amplifier.watts8OhmPerCh);
      setWatts4Ohm(prod.amplifier.watts4OhmPerCh);
      setSupports100v(prod.amplifier.supports100v);
      if (prod.amplifier.watts100vPerCh) setWatts100v(prod.amplifier.watts100vPerCh);
      setAmpHasDante(Boolean(prod.amplifier.hasDante));
    } else if (prod.mixer) {
      setInPortCount(prod.mixer.micLineInputs);
      setOutPortCount(prod.mixer.mainOutputs + prod.mixer.auxOutputs);
      setIsDigitalMixer(prod.mixer.isDigital);
      setHasDantePort(Boolean(prod.mixer.danteChannels));
    } else if (prod.dsp) {
      setInPortCount(prod.dsp.analogInputs);
      setOutPortCount(prod.dsp.analogOutputs);
    }
    setAutoFillBanner(
      `[${distName}] ${prod.brand} ${prod.model} 사양이 자동 입력되었습니다.`
    );
  };

  const handleAutoFetchByModelInput = () => {
    const q = (distQuery.trim() || `${brand} ${model}`).trim();
    if (!q) return;
    const matches = searchOrSynthesizeDistributorProducts(
      q,
      catalog,
      selectedDistId === 'all' ? undefined : selectedDistId
    );
    if (matches.length > 0) {
      populateFormFromDistributorProduct(matches[0].product, matches[0].distributorName);
      return;
    }
    const synth = synthesizeProductFromModelQuery(
      q,
      selectedDistId === 'all' ? undefined : selectedDistId
    );
    if (synth) {
      populateFormFromDistributorProduct(synth.product, synth.distributorName);
    }
  };

  const distSearchResults = searchOrSynthesizeDistributorProducts(
    distQuery,
    catalog,
    selectedDistId === 'all' ? undefined : selectedDistId
  );

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const buildPreviewProduct = (): AudioProduct => {
    const ports: PortSpec[] = [];
    let enclosureShape: EnclosureShape = 'rack_1u';

    if (category === 'speaker') {
      enclosureShape =
        spkType === 'subwoofer'
          ? 'subwoofer'
          : spkType === 'column'
          ? 'column'
          : spkType === 'highz_100v'
          ? 'ceiling'
          : 'trapezoid';

      if (spkType === 'active') {
        ports.push(
          { id: 'xlr_in_1', label: 'LINE/MIC IN 1', direction: 'in', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
          { id: 'xlr_thru', label: 'LINK OUT (XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 }
        );
      } else if (spkType === 'highz_100v') {
        ports.push(
          { id: 'tap_in', label: `100V TAP IN (${tap100vWatts}W)`, direction: 'in', signalType: 'speaker_100v', connector: 'Terminal100V', channelIndex: 1 },
          { id: 'tap_thru', label: '100V PARALLEL OUT', direction: 'out', signalType: 'speaker_100v', connector: 'Terminal100V', channelIndex: 1 }
        );
      } else {
        ports.push(
          { id: 'nl4_in', label: 'NL4 IN (+1/-1)', direction: 'in', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 1 },
          { id: 'nl4_thru', label: 'NL4 LINK THRU', direction: 'out', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 1 }
        );
      }
    } else if (category === 'amplifier') {
      enclosureShape = 'rack_2u';
      if (ampHasDante) {
        ports.push({
          id: 'dante_in',
          label: 'DANTE IN (RJ45)',
          direction: 'in',
          signalType: 'network_dante',
          connector: 'RJ45',
          channelIndex: 1,
        });
      }
      for (let c = 1; c <= ampChannels; c++) {
        ports.push({
          id: `amp_in_${c}`,
          label: `CH ${c} IN (XLR)`,
          direction: 'in',
          signalType: 'mic_line',
          connector: 'XLR',
          channelIndex: c,
          ampChannel: c,
        });
      }
      for (let c = 1; c <= ampChannels; c++) {
        ports.push({
          id: `amp_out_${c}`,
          label: supports100v ? `100V OUT CH ${c}` : `SPK OUT CH ${c} (NL4)`,
          direction: 'out',
          signalType: supports100v ? 'speaker_100v' : 'speaker_lowz',
          connector: supports100v ? 'Terminal100V' : 'Speakon',
          channelIndex: c,
          ampChannel: c,
        });
      }
    } else if (category === 'mixer') {
      enclosureShape = 'console';
      for (let i = 1; i <= inPortCount; i++) {
        ports.push({
          id: `mix_in_${i}`,
          label: `MIC/LINE IN ${i}`,
          direction: 'in',
          signalType: 'mic_line',
          connector: 'XLR',
          channelIndex: i,
        });
      }
      if (hasDantePort) {
        ports.push(
          { id: 'dante_in', label: 'DANTE IN (RJ45)', direction: 'in', signalType: 'network_dante', connector: 'RJ45', channelIndex: inPortCount + 1 },
          { id: 'dante_out', label: 'DANTE OUT (RJ45)', direction: 'out', signalType: 'network_dante', connector: 'RJ45', channelIndex: 1 }
        );
      }
      for (let o = 1; o <= outPortCount; o++) {
        const outLabel = o === 1 ? 'MAIN OUT L' : o === 2 ? 'MAIN OUT R' : `MIX/AUX OUT ${o - 2}`;
        ports.push({
          id: `mix_out_${o}`,
          label: outLabel,
          direction: 'out',
          signalType: 'mic_line',
          connector: 'XLR',
          channelIndex: o,
        });
      }
    } else {
      enclosureShape = 'rack_1u';
      const sigType = category === 'network' ? 'network_dante' : 'mic_line';
      const connType = category === 'network' ? 'RJ45' : 'XLR';
      for (let i = 1; i <= inPortCount; i++) {
        ports.push({
          id: `in_${i}`,
          label: `${category === 'network' ? 'DANTE RX' : 'INPUT'} ${i}`,
          direction: 'in',
          signalType: sigType,
          connector: connType,
          channelIndex: i,
        });
      }
      for (let o = 1; o <= outPortCount; o++) {
        ports.push({
          id: `out_${o}`,
          label: `${category === 'network' ? 'DANTE TX' : 'OUTPUT'} ${o}`,
          direction: 'out',
          signalType: sigType,
          connector: connType,
          channelIndex: o,
        });
      }
    }

    return {
      id: `custom-${category}-${Date.now()}`,
      brand,
      model,
      name,
      category,
      unitPriceKrw,
      enclosureShape,
      customImageUrl: customImageUrl || undefined,
      description,
      ports,
      speaker:
        category === 'speaker'
          ? {
              type: spkType,
              impedanceOhms: spkType === 'highz_100v' ? 0 : impedanceOhms,
              rmsWatts,
              programWatts: rmsWatts * 2,
              peakWatts: rmsWatts * 4,
              tap100vWatts: spkType === 'highz_100v' ? tap100vWatts : undefined,
              sensitivityDb,
              maxSplDb: Math.round((sensitivityDb + 10 * Math.log10(rmsWatts * 2)) * 10) / 10,
              freqResponseLowHz: spkType === 'subwoofer' ? 35 : 55,
              freqResponseHighHz: spkType === 'subwoofer' ? 150 : 20000,
              dispersionHorizontalDeg: dispersionH,
              dispersionVerticalDeg: dispersionV,
              driverSizeInch: driverInch,
            }
          : undefined,
      amplifier:
        category === 'amplifier'
          ? {
              channels: ampChannels,
              watts8OhmPerCh: watts8Ohm,
              watts4OhmPerCh: watts4Ohm,
              watts100vPerCh: supports100v ? watts100v : undefined,
              minImpedanceOhms: 4,
              supports100v,
              hasDante: ampHasDante,
            }
          : undefined,
      mixer:
        category === 'mixer'
          ? {
              micLineInputs: inPortCount,
              stereoInputs: 2,
              mainOutputs: 2,
              auxOutputs: Math.max(0, outPortCount - 2),
              isDigital: isDigitalMixer,
              danteChannels: hasDantePort ? 16 : 0,
            }
          : undefined,
    };
  };

  const previewProd = buildPreviewProduct();

  const handleSaveCustomProduct = (e: React.FormEvent) => {
    e.preventDefault();
    onAddProduct(previewProd);
    alert(`[${previewProd.brand} ${previewProd.model}] 장비가 제품 카탈로그에 등록되었습니다!`);
  };

  const handleCsvOrJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            onImportProducts(parsed);
            alert(`${parsed.length}종의 제품이 일괄 등록되었습니다.`);
          }
          return;
        }
        // Simple CSV parser: brand,model,name,category,unitPriceKrw,rmsWatts,impedanceOhms,sensitivityDb,dispersionH,dispersionV
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const imported: AudioProduct[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          if (cols.length < 5) continue;
          const [cBrand, cModel, cName, cCat, cPrice, cWatts, cOhms, cSens, cDispH, cDispV] = cols;
          const cat = (['speaker', 'amplifier', 'mixer', 'dsp', 'source_mic', 'network'].includes(cCat)
            ? cCat
            : 'speaker') as ProductCategory;
          const watts = Number(cWatts) || 350;
          const ohms = Number(cOhms) || 8;
          const sens = Number(cSens) || 96;
          const dH = Number(cDispH) || 90;
          const dV = Number(cDispV) || 60;

          imported.push({
            id: `csv-${cat}-${Date.now()}-${i}`,
            brand: cBrand || 'Custom',
            model: cModel || `MDL-${i}`,
            name: cName || cModel,
            category: cat,
            unitPriceKrw: Number(cPrice) || 500000,
            enclosureShape: cat === 'speaker' ? 'trapezoid' : cat === 'mixer' ? 'console' : 'rack_2u',
            description: `${cBrand} ${cName}`,
            ports:
              cat === 'speaker'
                ? [
                    { id: 'nl4_in', label: 'NL4 IN', direction: 'in', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 1 },
                    { id: 'nl4_thru', label: 'NL4 LINK', direction: 'out', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 1 },
                  ]
                : [
                    { id: 'in_1', label: 'IN 1', direction: 'in', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
                    { id: 'out_1', label: 'OUT 1', direction: 'out', signalType: cat === 'amplifier' ? 'speaker_lowz' : 'mic_line', connector: cat === 'amplifier' ? 'Speakon' : 'XLR', channelIndex: 1 },
                  ],
            speaker:
              cat === 'speaker'
                ? {
                    type: 'passive_lowz',
                    impedanceOhms: ohms,
                    rmsWatts: watts,
                    programWatts: watts * 2,
                    peakWatts: watts * 4,
                    sensitivityDb: sens,
                    maxSplDb: Math.round(sens + 10 * Math.log10(watts * 2)),
                    freqResponseLowHz: 55,
                    freqResponseHighHz: 20000,
                    dispersionHorizontalDeg: dH,
                    dispersionVerticalDeg: dV,
                    driverSizeInch: 12,
                  }
                : undefined,
            amplifier:
              cat === 'amplifier'
                ? {
                    channels: 2,
                    watts8OhmPerCh: watts,
                    watts4OhmPerCh: Math.round(watts * 1.6),
                    minImpedanceOhms: 4,
                    supports100v: false,
                  }
                : undefined,
          });
        }

        if (imported.length > 0) {
          onImportProducts(imported);
          alert(`CSV에서 ${imported.length}종의 제품이 카탈로그에 추가되었습니다!`);
        }
      } catch (err) {
        alert('파일 형식을 확인해 주세요.');
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadSampleCsv = () => {
    const sample =
      '\uFEFFbrand,model,name,category,unitPriceKrw,rmsWatts,impedanceOhms,sensitivityDb,dispersionH,dispersionV\n' +
      'JBL,SRX812P,12인치 패시브 메인스피커,speaker,1350000,600,8,98,90,50\n' +
      'Crown,XTi4002,2채널 고출력 파워앰프,amplifier,1420000,650,8,0,0,0\n';
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audiocad_product_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[92vh] rounded-2xl border border-white/[0.1] bg-[#161C2B] shadow-2xl shadow-black/60 flex flex-col overflow-hidden break-keep">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3 bg-[#111622]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-400/12 border border-sky-400/25 flex items-center justify-center shrink-0">
              <Database className="w-4 h-4 text-sky-400" />
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-sm font-semibold text-white break-keep tracking-tight">
                장비 DB 카탈로그 관리
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-sky-400/12 border border-sky-400/25 text-sky-300 font-mono text-[10px] font-semibold">
                브랜드 카탈로그 자동분석 · 4대 총판 연동
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Mode Switching Pill Tabs */}
            <div className="inline-flex rounded-full bg-[#0B0F17] p-1 border border-white/[0.08] text-xs">
              <button
                type="button"
                onClick={() => setModalMode('upload')}
                className={`px-3.5 py-1.5 rounded-full font-semibold transition flex items-center gap-1.5 ${
                  modalMode === 'upload'
                    ? 'bg-sky-400 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileUp className="w-3.5 h-3.5" /> 카탈로그 업로드 자동분석
              </button>
              <button
                type="button"
                onClick={() => setModalMode('manual')}
                className={`px-3.5 py-1.5 rounded-full font-semibold transition flex items-center gap-1.5 ${
                  modalMode === 'manual'
                    ? 'bg-sky-400 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5" /> 수동 등록 및 총판검색
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              data-tooltip="닫기"
              data-tooltip-pos="bottom"
              className="p-2 rounded-full bg-[#1E2638] hover:bg-white/[0.12] border border-white/[0.08] text-slate-300 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            MODE 1: BRAND CATALOG FILE / TEXT UPLOAD & AI AUTO SPEC PARSER
           ========================================================================= */}
        {modalMode === 'upload' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0B0F17]/40">
            {/* Top Explanation & Brand Override Input */}
            <div className="rounded-2xl border border-sky-400/25 bg-sky-400/[0.06] p-4 space-y-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-sky-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-sky-400" />
                    브랜드 카탈로그 업로드 및 음향 사양 자동 파악
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    제조사/브랜드 카탈로그 파일(PDF, CSV, Excel, TXT)을 올리거나 제품 스펙 텍스트를 붙여넣으면,
                    사양 파서가 <strong>모델명, 제품 카테고리, RMS 출력, 임피던스, 감도, 지향각, 입출력 포트</strong>를 자동으로 파악하여 제품 목록에 일괄 등록합니다.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium whitespace-nowrap">브랜드 지정:</span>
                  <input
                    type="text"
                    value={forcedBrand}
                    onChange={(e) => setForcedBrand(e.target.value)}
                    placeholder="비워둘 시 파일에서 자동 감지 (예: JBL, Crown...)"
                    className="w-56 rounded-xl bg-[#0B0F17] border border-white/[0.12] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/70 focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Supported Format Badges */}
              <div className="flex items-center gap-2 pt-2.5 border-t border-sky-400/15 text-[11px] font-mono text-sky-300/90 flex-wrap">
                <span>지원 형식:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#111622] border border-white/[0.08] text-slate-200">
                  📄 PDF 카탈로그 (.pdf)
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#111622] border border-white/[0.08] text-slate-200">
                  📊 CSV / Excel 표 (.csv, .tsv)
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#111622] border border-white/[0.08] text-slate-200">
                  📝 텍스트 / 마크다운 (.txt, .md, .json)
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#111622] border border-white/[0.08] text-slate-200">
                  📋 스펙 텍스트 직접 복사·붙여넣기
                </span>
              </div>
            </div>

            {/* Dropzone & Text Input Dual Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Drag & Drop File Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleCatalogFileSelected(file);
                }}
                className={`rounded-2xl border-2 border-dashed p-6 flex flex-col items-center justify-center text-center transition cursor-pointer relative min-h-[190px] ${
                  isDraggingOver
                    ? 'border-sky-400 bg-sky-400/10 scale-[1.01]'
                    : 'border-white/[0.14] hover:border-sky-400/50 bg-[#111622]'
                }`}
              >
                <input
                  type="file"
                  accept=".pdf,.csv,.tsv,.txt,.json,.md,.html"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCatalogFileSelected(file);
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="w-12 h-12 rounded-2xl bg-sky-400/12 border border-sky-400/25 flex items-center justify-center mb-3">
                  <FileUp className="w-6 h-6 text-sky-400" />
                </div>
                <span className="text-sm font-semibold text-slate-100 mb-1">
                  카탈로그 파일을 여기에 끌어다 놓으세요
                </span>
                <span className="text-xs text-slate-400 mb-3">
                  또는 클릭하여 내 컴퓨터에서 파일 선택
                </span>
                <span className="px-3.5 py-1 rounded-full bg-[#1E2638] text-sky-300 text-[11px] font-mono border border-white/[0.08]">
                  {uploadedFileName ? `선택됨: ${uploadedFileName}` : 'PDF / CSV / TXT 파일 선택'}
                </span>
              </div>

              {/* Right: Direct Text Paste Input */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#111622] p-4 flex flex-col justify-between">
                <div className="space-y-2 flex-1 flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      카탈로그 텍스트 직접 붙여넣기
                    </span>
                    <button
                      type="button"
                      onClick={() => setPastedText('')}
                      className="text-[11px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded-full hover:bg-white/[0.06] transition"
                    >
                      지우기
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="웹사이트나 문서에서 복사한 제품 스펙 표나 모델명 목록을 여기에 붙여넣으세요 (예: CDD12 12인치 400W 8옴 97dB 110x60 / XTi 4002 2ch 800W...)"
                    className="w-full flex-1 rounded-xl bg-[#0B0F17] border border-white/[0.08] p-3 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none resize-none transition"
                  />
                </div>
                <button
                  type="button"
                  disabled={!pastedText.trim() || isParsing}
                  onClick={handleParsePastedText}
                  className="mt-3 w-full py-2 rounded-full bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" /> 텍스트 내용 자동 분석 및 추출
                </button>
              </div>
            </div>

            {/* Parsing Spinner */}
            {isParsing && (
              <div className="p-8 rounded-2xl bg-[#111622] border border-sky-400/30 flex flex-col items-center justify-center gap-2.5">
                <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
                <span className="text-xs font-semibold text-sky-300">
                  카탈로그 내용 및 음향 물리 사양을 파악 중입니다...
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  모델명, 카테고리, RMS 출력, 감도, 지향각, 입출력 단자 자동 매핑 진행 중
                </span>
              </div>
            )}

            {/* Error Banner */}
            {parseError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between">
                <span>⚠️ {parseError}</span>
                <button
                  type="button"
                  onClick={() => setParseError(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10"
                >
                  ✕
                </button>
              </div>
            )}

            {/* PARSED RESULTS TABLE & PREVIEW */}
            {parsedResult && parsedResult.products.length > 0 && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#111622] p-5 space-y-4 shadow-xl">
                {/* Result Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xs text-slate-400">파악된 브랜드:</span>
                    <input
                      type="text"
                      value={forcedBrand || parsedResult.brandDetected}
                      onChange={(e) => setForcedBrand(e.target.value)}
                      className="px-3 py-1 rounded-full bg-[#0B0F17] border border-sky-400/40 text-sky-300 text-xs font-semibold w-36 focus:outline-none"
                      title="클릭하여 브랜드명 변경"
                    />
                    <span className="text-xs text-slate-300 font-mono">
                      총 <strong>{parsedResult.products.length}종</strong> 제품 사양 자동 추출 완료
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCommitParsedProducts}
                    className="px-4 py-2 rounded-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    추출된 제품 {parsedResult.products.length}종 카탈로그에 일괄 등록하기
                  </button>
                </div>

                {/* Candidate Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[380px] overflow-y-auto pr-1">
                  {parsedResult.products.map((prod, idx) => (
                    <div
                      key={prod.id}
                      className="rounded-2xl border border-white/[0.08] bg-[#161C2B] p-3.5 flex flex-col justify-between hover:border-sky-400/40 transition relative group"
                    >
                      <button
                        type="button"
                        onClick={() => handleRemoveParsedCandidate(idx)}
                        data-tooltip="이 제품 제외"
                        className="absolute top-2.5 right-2.5 text-slate-500 hover:text-rose-400 p-1 rounded-full hover:bg-white/[0.06] transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      <div className="space-y-2 mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold uppercase bg-[#1E2638] text-sky-300 border border-white/[0.06]">
                            {prod.category}
                          </span>
                          <span className="text-xs font-semibold text-slate-100 font-mono truncate max-w-[170px]">
                            {prod.model}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 line-clamp-1">
                          {prod.name}
                        </p>

                        {/* Hardware Svg Preview */}
                        <div className="bg-[#0B0F17] p-2 rounded-xl border border-white/[0.06] flex items-center justify-center">
                          <DeviceSvgArtwork product={prod} width={180} height={38} />
                        </div>
                      </div>

                      {/* Key Physics Specs Pills */}
                      <div className="pt-2.5 border-t border-white/[0.06] text-[10px] font-mono text-slate-400 flex flex-wrap gap-1.5">
                        {prod.speaker && (
                          <>
                            <span className="px-2 py-0.5 rounded-full bg-[#0B0F17] text-amber-300 border border-white/[0.06]">
                              {prod.speaker.driverSizeInch}" {prod.speaker.rmsWatts}W
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-[#0B0F17] text-sky-300 border border-white/[0.06]">
                              {prod.speaker.sensitivityDb}dB
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-[#0B0F17] text-emerald-300 border border-white/[0.06]">
                              {prod.speaker.dispersionHorizontalDeg}°x{prod.speaker.dispersionVerticalDeg}°
                            </span>
                          </>
                        )}
                        {prod.amplifier && (
                          <>
                            <span className="px-2 py-0.5 rounded-full bg-[#0B0F17] text-amber-300 border border-white/[0.06]">
                              {prod.amplifier.channels}CH
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-[#0B0F17] text-sky-300 border border-white/[0.06]">
                              {prod.amplifier.watts8OhmPerCh}W @8Ω
                            </span>
                            {prod.amplifier.supports100v && (
                              <span className="px-2 py-0.5 rounded-full bg-[#0B0F17] text-emerald-300 border border-white/[0.06]">
                                100V
                              </span>
                            )}
                          </>
                        )}
                        {prod.mixer && (
                          <>
                            <span className="px-2 py-0.5 rounded-full bg-[#0B0F17] text-sky-300 border border-white/[0.06]">
                              {prod.mixer.micLineInputs} MIC IN
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-[#0B0F17] text-amber-300 border border-white/[0.06]">
                              {prod.mixer.isDigital ? '디지털' : '아날로그'}
                            </span>
                          </>
                        )}
                        <span className="px-2 py-0.5 rounded-full bg-[#0B0F17] text-slate-400 border border-white/[0.06]">
                          포트 {prod.ports.length}개
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            MODE 2: MANUAL FORM & 4 REGISTERED KOREAN DISTRIBUTOR AUTO-SPECS
           ========================================================================= */}
        {modalMode === 'manual' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0B0F17]/40">
        {/* TOP BAR: 4 REGISTERED KOREAN DISTRIBUTOR SITES & AUTO-SPEC FETCHER */}
        <div className="px-6 py-3.5 border-b border-white/[0.08] bg-[#111622] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mr-1">
                <Globe className="w-3.5 h-3.5" /> 기본 등록 총판 사이트:
              </span>
              <button
                type="button"
                onClick={() => setSelectedDistId('all')}
                className={`px-3 py-1 rounded-full text-[11px] font-mono transition ${
                  selectedDistId === 'all'
                    ? 'bg-emerald-400 text-slate-950 font-semibold shadow-sm'
                    : 'bg-[#1E2638] border border-white/[0.08] text-slate-300 hover:border-emerald-400/40'
                }`}
              >
                전체(4곳)
              </button>
              {DEFAULT_KOREAN_DISTRIBUTORS.map((dist) => (
                <div key={dist.id} className="inline-flex items-center rounded-full overflow-hidden border border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedDistId((prev) => (prev === dist.id ? 'all' : dist.id))
                    }
                    data-tooltip={`${dist.summary} (${dist.siteUrl})`}
                    data-tooltip-pos="bottom"
                    className={`px-3 py-1 text-[11px] font-semibold transition ${
                      selectedDistId === dist.id
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-[#1E2638] text-slate-200 hover:bg-white/[0.08]'
                    }`}
                  >
                    {dist.shortLabel}
                    <span className="ml-1 text-[10px] font-mono opacity-80">
                      ({dist.brands.slice(0, 3).join('·')})
                    </span>
                  </button>
                  <a
                    href={dist.siteUrl}
                    target="_blank"
                    rel="noreferrer"
                    data-tooltip={`${dist.name} 공식 사이트 열기`}
                    data-tooltip-pos="bottom"
                    className="px-2 py-1 bg-[#111622] border-l border-white/[0.08] hover:bg-[#1E2638] text-slate-400 hover:text-sky-300 transition"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                const toImport = distSearchResults.map((r) => r.product);
                if (toImport.length === 0) return;
                onImportProducts(toImport);
                setAutoFillBanner(
                  `총판 DB에서 미등록 장비 ${toImport.length}종을 카탈로그에 일괄 추가했습니다.`
                );
              }}
              data-tooltip="현재 선택된 총판의 미등록 표준 장비 사양을 한 번에 모두 카탈로그에 추가합니다"
              data-tooltip-pos="bottom"
              className="px-3 py-1.5 rounded-full bg-emerald-400/15 hover:bg-emerald-400/25 border border-emerald-400/35 text-emerald-200 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap transition"
            >
              <Plus className="w-3 h-3" /> 미등록 총판장비 일괄등록 ({distSearchResults.length}종)
            </button>
          </div>

          {/* Model Search -> Auto Spec Fetch Input */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={distQuery}
                onChange={(e) => setDistQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAutoFetchByModelInput();
                  }
                }}
                placeholder="찾으시는 모델명 입력 (예: QSC K12.2, Midas M32, JBL PRX912, Lab Gruppen PD3000, HK POLAR 12...)"
                className="w-full rounded-full bg-[#0B0F17] border border-white/[0.12] pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none transition"
              />
            </div>
            <button
              type="button"
              onClick={handleAutoFetchByModelInput}
              data-tooltip="입력한 모델명의 사양(출력·임피던스·감도·지향각·포트)을 총판 브랜드 DB에서 자동으로 가져와 아래 입력폼에 채웁니다"
              data-tooltip-pos="bottom"
              className="px-4 py-2 rounded-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-semibold flex items-center gap-1.5 shadow-sm whitespace-nowrap transition"
            >
              <Sparkles className="w-3.5 h-3.5" /> 모델 사양 자동수집
            </button>
          </div>

          {/* Quick Auto-Matched Distributor Chips */}
          {distSearchResults.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-[10px] font-mono text-slate-400 shrink-0">자동매칭:</span>
              {distSearchResults.slice(0, 8).map((rec) => (
                <div
                  key={rec.product.id}
                  className="inline-flex items-center rounded-full bg-[#161C2B] border border-white/[0.08] hover:border-emerald-400/40 text-[11px] shrink-0 overflow-hidden transition"
                >
                  <button
                    type="button"
                    onClick={() =>
                      populateFormFromDistributorProduct(rec.product, rec.distributorName)
                    }
                    data-tooltip={`[${rec.distributorName}] ${rec.product.name} — 클릭 시 아래 폼에 사양 자동채우기`}
                    className="px-2.5 py-1 text-left hover:bg-[#1E2638] flex items-center gap-1"
                  >
                    <span className="text-[9px] font-mono text-emerald-400">
                      [{rec.distributorName}]
                    </span>
                    <span className="font-mono font-semibold text-slate-100">
                      {rec.product.brand} {rec.product.model}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onAddProduct(rec.product);
                      setAutoFillBanner(
                        `[${rec.distributorName}] ${rec.product.brand} ${rec.product.model} 장비가 카탈로그에 즉시 등록되었습니다.`
                      );
                    }}
                    data-tooltip="카탈로그에 바로 추가"
                    className="px-2 py-1 bg-emerald-400/15 hover:bg-emerald-400 hover:text-slate-950 text-emerald-300 font-semibold transition"
                  >
                    +등록
                  </button>
                </div>
              ))}
            </div>
          )}

          {autoFillBanner && (
            <div className="text-[11px] font-mono text-emerald-300 bg-emerald-400/10 border border-emerald-400/25 rounded-full px-3.5 py-1 flex items-center justify-between">
              <span>✓ {autoFillBanner}</span>
              <button
                type="button"
                onClick={() => setAutoFillBanner(null)}
                className="text-slate-400 hover:text-white ml-2"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT 7 COLS: ADD CUSTOM PRODUCT FORM */}
          <form onSubmit={handleSaveCustomProduct} className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-400 whitespace-nowrap">
                1. 신규장비 사양입력 및 실물형블록 생성
              </h3>

              {/* Live SVG Preview of the Custom Product */}
              <div className="flex items-center gap-2.5 bg-[#111622] px-3 py-1.5 rounded-2xl border border-white/[0.08]">
                <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">아이콘 미리보기:</span>
                <DeviceSvgArtwork product={previewProd} width={180} height={42} />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <label className="space-y-1.5">
                <span className="text-[11px] text-slate-400 whitespace-nowrap block">제품 카테고리</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ProductCategory)}
                  className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.12] px-3 py-2 text-sky-300 font-semibold focus:border-sky-400/70 focus:outline-none transition"
                >
                  <option value="speaker">스피커(Speaker)</option>
                  <option value="amplifier">파워앰프(Power Amp)</option>
                  <option value="mixer">오디오믹서(Mixer)</option>
                  <option value="dsp">DSP/프로세서</option>
                  <option value="source_mic">마이크/음원소스</option>
                  <option value="network">네트워크/Dante장비</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-[11px] text-slate-400 whitespace-nowrap block">제조사(Brand)</span>
                <input
                  type="text"
                  required
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.12] px-3 py-2 text-slate-100 focus:border-sky-400/70 focus:outline-none transition"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-[11px] text-slate-400 whitespace-nowrap block">모델명(Model)</span>
                <input
                  type="text"
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.12] px-3 py-2 font-mono text-slate-100 focus:border-sky-400/70 focus:outline-none transition"
                />
              </label>

              <label className="space-y-1.5 md:col-span-2">
                <span className="text-[11px] text-slate-400 whitespace-nowrap block">품명 및 요약규격</span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.12] px-3 py-2 text-slate-100 focus:border-sky-400/70 focus:outline-none transition"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-[11px] text-slate-400 whitespace-nowrap block">단가(KRW ₩)</span>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  value={unitPriceKrw}
                  onChange={(e) => setUnitPriceKrw(Number(e.target.value))}
                  className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.12] px-3 py-2 font-mono text-emerald-300 focus:border-sky-400/70 focus:outline-none transition"
                />
              </label>
            </div>

            {/* Category-Specific Technical Specifications */}
            {category === 'speaker' && (
              <div className="rounded-2xl border border-amber-400/25 bg-[#111622] p-4 space-y-3 text-xs">
                <div className="font-semibold text-amber-300 break-keep">
                  스피커 음향·전기 물리사양 (SPL 분포도 및 앰프매칭에 직접 반영)
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-[11px] text-slate-400 whitespace-nowrap block">스피커 구동방식/외형</span>
                    <select
                      value={spkType}
                      onChange={(e) => setSpkType(e.target.value as typeof spkType)}
                      className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.12] px-2.5 py-1.5 text-slate-200 focus:border-sky-400/70 focus:outline-none transition"
                    >
                      <option value="passive_lowz">패시브 포인트소스(Low-Z 4/8Ω)</option>
                      <option value="column">패시브 라인컬럼어레이(Low-Z)</option>
                      <option value="subwoofer">패시브 서브우퍼(Low-Z)</option>
                      <option value="active">액티브 파워드스피커(앰프내장)</option>
                      <option value="highz_100v">100V 하이임피던스(실링/월마운트)</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400 whitespace-nowrap block">정격 허용입력 RMS(W)</span>
                    <input
                      type="number"
                      min={5}
                      max={4000}
                      value={rmsWatts}
                      onChange={(e) => setRmsWatts(Number(e.target.value))}
                      className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.12] px-2.5 py-1.5 font-mono text-amber-300 focus:border-sky-400/70 focus:outline-none transition"
                    />
                  </label>

                  {spkType === 'highz_100v' ? (
                    <label className="space-y-1">
                      <span className="text-[11px] text-slate-400 whitespace-nowrap block">100V 탭출력(W)</span>
                      <input
                        type="number"
                        min={2}
                        max={120}
                        value={tap100vWatts}
                        onChange={(e) => setTap100vWatts(Number(e.target.value))}
                        className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.12] px-2.5 py-1.5 font-mono text-amber-300 focus:border-sky-400/70 focus:outline-none transition"
                      />
                    </label>
                  ) : (
                    <label className="space-y-1">
                      <span className="text-[11px] text-slate-400 whitespace-nowrap block">공칭 임피던스(Ω)</span>
                      <select
                        value={impedanceOhms}
                        onChange={(e) => setImpedanceOhms(Number(e.target.value))}
                        className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.12] px-2.5 py-1.5 font-mono text-sky-300 focus:border-sky-400/70 focus:outline-none transition"
                      >
                        <option value={4}>4Ω</option>
                        <option value={8}>8Ω</option>
                        <option value={16}>16Ω</option>
                      </select>
                    </label>
                  )}

                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400 whitespace-nowrap block">감도/효율(dB @1W/1m)</span>
                    <input
                      type="number"
                      step={0.5}
                      min={80}
                      max={112}
                      value={sensitivityDb}
                      onChange={(e) => setSensitivityDb(Number(e.target.value))}
                      className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.12] px-2.5 py-1.5 font-mono text-emerald-300 focus:border-sky-400/70 focus:outline-none transition"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400 whitespace-nowrap block">수평 지향각(°H)</span>
                    <input
                      type="number"
                      min={20}
                      max={360}
                      value={dispersionH}
                      onChange={(e) => setDispersionH(Number(e.target.value))}
                      className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.12] px-2.5 py-1.5 font-mono text-sky-300 focus:border-sky-400/70 focus:outline-none transition"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400 whitespace-nowrap block">수직 지향각(°V)</span>
                    <input
                      type="number"
                      min={10}
                      max={180}
                      value={dispersionV}
                      onChange={(e) => setDispersionV(Number(e.target.value))}
                      className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.12] px-2.5 py-1.5 font-mono text-sky-300 focus:border-sky-400/70 focus:outline-none transition"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400 whitespace-nowrap block">유닛 구경(Inch)</span>
                    <input
                      type="number"
                      step={0.5}
                      min={3}
                      max={21}
                      value={driverInch}
                      onChange={(e) => setDriverInch(Number(e.target.value))}
                      className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.12] px-2.5 py-1.5 font-mono text-slate-200 focus:border-sky-400/70 focus:outline-none transition"
                    />
                  </label>
                </div>
              </div>
            )}

            {category === 'amplifier' && (
              <div className="rounded-2xl border border-sky-400/25 bg-[#111622] p-4 space-y-3 text-xs">
                <div className="font-semibold text-sky-300 break-keep">파워앰프 채널 및 임피던스별 정격출력 사양</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400 whitespace-nowrap block">채널수(CH)</span>
                    <select
                      value={ampChannels}
                      onChange={(e) => setAmpChannels(Number(e.target.value))}
                      className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.12] px-2.5 py-1.5 font-mono text-sky-300 focus:border-sky-400/70 focus:outline-none transition"
                    >
                      <option value={1}>1채널</option>
                      <option value={2}>2채널</option>
                      <option value={4}>4채널</option>
                      <option value={8}>8채널</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400 whitespace-nowrap block">8Ω 채널당 출력(W)</span>
                    <input
                      type="number"
                      value={watts8Ohm}
                      onChange={(e) => setWatts8Ohm(Number(e.target.value))}
                      className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.12] px-2.5 py-1.5 font-mono text-amber-300 focus:border-sky-400/70 focus:outline-none transition"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400 whitespace-nowrap block">4Ω 채널당 출력(W)</span>
                    <input
                      type="number"
                      value={watts4Ohm}
                      onChange={(e) => setWatts4Ohm(Number(e.target.value))}
                      className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.12] px-2.5 py-1.5 font-mono text-amber-300 focus:border-sky-400/70 focus:outline-none transition"
                    />
                  </label>
                  <label className="space-y-1 flex flex-col justify-end">
                    <span className="flex items-center gap-2 cursor-pointer py-1.5 px-2.5 rounded-xl bg-[#0B0F17] border border-white/[0.08] whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={supports100v}
                        onChange={(e) => setSupports100v(e.target.checked)}
                        className="accent-sky-400"
                      />
                      100V 하이임피던스
                    </span>
                  </label>
                </div>
              </div>
            )}

            {(category === 'mixer' ||
              category === 'dsp' ||
              category === 'source_mic' ||
              category === 'network') && (
              <div className="rounded-2xl border border-indigo-400/25 bg-[#111622] p-4 space-y-3 text-xs">
                <div className="font-semibold text-indigo-300 break-keep">
                  포인트투포인트 결선용 입력(IN)/출력(OUT) 포트개수 지정
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400 whitespace-nowrap block">입력포트(IN) 수</span>
                    <input
                      type="number"
                      min={0}
                      max={32}
                      value={inPortCount}
                      onChange={(e) => setInPortCount(Number(e.target.value))}
                      className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.12] px-2.5 py-1.5 font-mono text-sky-300 focus:border-sky-400/70 focus:outline-none transition"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400 whitespace-nowrap block">출력포트(OUT) 수</span>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={outPortCount}
                      onChange={(e) => setOutPortCount(Number(e.target.value))}
                      className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.12] px-2.5 py-1.5 font-mono text-amber-300 focus:border-sky-400/70 focus:outline-none transition"
                    />
                  </label>
                  <label className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-[#0B0F17] border border-white/[0.08] cursor-pointer whitespace-nowrap md:col-span-2">
                    <input
                      type="checkbox"
                      checked={hasDantePort}
                      onChange={(e) => setHasDantePort(e.target.checked)}
                      className="accent-indigo-400"
                    />
                    Dante RJ45 포트 포함
                  </label>
                </div>
              </div>
            )}

            {/* Optional Custom Front Panel Image */}
            <div className="flex items-center justify-between gap-3 pt-2 text-xs border-t border-white/[0.08]">
              <label className="flex items-center gap-2 text-slate-200 cursor-pointer bg-[#1E2638] hover:bg-white/[0.12] px-3.5 py-2 rounded-full border border-white/[0.08] whitespace-nowrap transition">
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                실물외형 이미지 업로드(선택)
                <input type="file" accept="image/*" onChange={handleImageFileUpload} className="hidden" />
              </label>

              <button
                type="submit"
                className="px-5 py-2 rounded-full bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold flex items-center gap-1.5 shadow-sm whitespace-nowrap transition"
              >
                <Plus className="w-4 h-4" /> 카탈로그에 장비추가
              </button>
            </div>
          </form>

          {/* RIGHT 5 COLS: CSV BULK IMPORT & EXISTING CATALOG LIST */}
          <div className="lg:col-span-5 flex flex-col space-y-4 lg:border-l border-white/[0.08] lg:pl-6">
            <div className="rounded-2xl border border-white/[0.08] bg-[#111622] p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 whitespace-nowrap">
                2. 엑셀(CSV)/JSON 제품목록 일괄등록
              </h4>
              <p className="text-[11px] text-slate-400 break-keep leading-relaxed">
                보유 중인 장비리스트(CSV/JSON)를 업로드하면 그 사양 안에서 공간에 맞는 최적조합을 추천해 드립니다.
              </p>
              <div className="flex items-center gap-2">
                <label className="flex-1 text-center py-2 px-3 rounded-full bg-emerald-400/15 hover:bg-emerald-400/25 border border-emerald-400/35 text-emerald-200 text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap transition">
                  <FileUp className="w-3.5 h-3.5" /> CSV/JSON 파일업로드
                  <input
                    type="file"
                    accept=".csv,.json"
                    onChange={handleCsvOrJsonImport}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="py-2 px-3.5 rounded-full bg-[#1E2638] hover:bg-white/[0.12] border border-white/[0.08] text-slate-200 text-xs flex items-center gap-1.5 whitespace-nowrap transition"
                >
                  <Download className="w-3.5 h-3.5" /> 양식 다운로드
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-white/[0.08] bg-[#111622] p-4">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
                  현재 등록된 장비목록 ({catalog.length}종)
                </span>
              </div>
              <div className="flex-1 overflow-y-auto max-h-72 space-y-1.5 pr-1">
                {catalog.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl bg-[#0B0F17] border border-white/[0.06] px-3 py-2 text-xs hover:border-white/[0.14] transition"
                  >
                    <div className="truncate pr-2">
                      <span className="font-mono text-sky-400 font-semibold mr-1.5">
                        [{item.brand}] {item.model}
                      </span>
                      <span className="text-slate-300">{item.name}</span>
                    </div>
                    {item.id.startsWith('custom-') || item.id.startsWith('csv-') ? (
                      <button
                        type="button"
                        onClick={() => onDeleteProduct(item.id)}
                        className="text-rose-400 hover:text-rose-300 p-1 rounded-full hover:bg-rose-400/10 shrink-0 transition"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[#1E2638] text-[10px] font-mono text-slate-400 shrink-0 whitespace-nowrap">기본내장</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
</div>
);
};
