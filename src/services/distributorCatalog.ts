import { AudioProduct, EnclosureShape, PortSpec, ProductCategory } from '../types/audio';

export interface KoreanAudioDistributor {
  id: 'sama_sound' | 'sama_cds' | 'techdata_ps' | 'onnuri_sound';
  name: string;
  shortLabel: string;
  siteUrl: string;
  searchUrlTemplate: string;
  brands: string[];
  summary: string;
}

/**
 * 기본 등록 4대 국내 음향 공식 수입·총판 사이트 및 취급 브랜드 정의
 * - 삼아사운드(심아사운드), 삼아CDS, 테크데이타PS, 온누리음향
 */
export const DEFAULT_KOREAN_DISTRIBUTORS: KoreanAudioDistributor[] = [
  {
    id: 'sama_sound',
    name: '삼아사운드 (Sama Sound)',
    shortLabel: '삼아사운드',
    siteUrl: 'https://www.samasound.co.kr',
    searchUrlTemplate: 'https://www.samastore.co.kr/goods/goods_search.php?keyword=',
    brands: ['Shure', 'Allen & Heath', 'HK Audio', 'PreSonus', 'Genelec', 'Dynaudio', 'Apogee', 'Klotz'],
    summary: 'Shure · Allen & Heath · HK Audio · PreSonus · Genelec 공식 수입원',
  },
  {
    id: 'sama_cds',
    name: '삼아CDS (Sama CDS)',
    shortLabel: '삼아CDS',
    siteUrl: 'https://www.samacds.co.kr',
    searchUrlTemplate: 'https://www.samacds.co.kr/?s=',
    brands: ['QSC', 'Allen & Heath', 'HK Audio', 'Shure', 'Visionary'],
    summary: 'QSC(Q-SYS) · Allen & Heath(AHM/dLive) · HK Audio SI 시스템 통합 총판',
  },
  {
    id: 'techdata_ps',
    name: '테크데이타PS (TechData PS)',
    shortLabel: '테크데이타PS',
    siteUrl: 'https://www.techdata-ps.com',
    searchUrlTemplate: 'https://www.techdata-ps.com/?s=',
    brands: ['JBL', 'Crown', 'Soundcraft', 'dbx', 'AKG', 'BSS', 'Lexicon'],
    summary: 'HARMAN Pro (JBL · Crown · Soundcraft · dbx · AKG · BSS) 공식 B2B 총판',
  },
  {
    id: 'onnuri_sound',
    name: '온누리음향 (Onnuri Sound)',
    shortLabel: '온누리음향',
    siteUrl: 'http://www.globalsound.co.kr',
    searchUrlTemplate: 'http://www.globalsound.co.kr/shop/search_result.php?search_str=',
    brands: ['Turbosound', 'Midas', 'Behringer', 'Lab Gruppen', 'Tannoy', 'Klark Teknik'],
    summary: 'Music Tribe (Turbosound · Midas · Behringer · Lab Gruppen · Tannoy) 공식 총판',
  },
];

export interface DistributorProductRecord {
  distributorId: KoreanAudioDistributor['id'];
  distributorName: string;
  sourceUrl: string;
  product: AudioProduct;
}

function makePorts(
  prefix: string,
  labelPrefix: string,
  count: number,
  direction: 'in' | 'out',
  signalType: PortSpec['signalType'],
  connector: PortSpec['connector'],
  startIndex = 1,
  withAmpChannel = false
): PortSpec[] {
  return Array.from({ length: count }, (_, idx) => {
    const ch = startIndex + idx;
    return {
      id: `${prefix}_${ch}`,
      label: `${labelPrefix}${ch}`,
      direction,
      signalType,
      connector,
      channelIndex: ch,
      ampChannel: withAmpChannel ? ch : undefined,
    };
  });
}

/**
 * 4대 총판 사이트 취급 브랜드의 확장 제품 사양 데이터베이스
 * 기본 카탈로그(33종)에 없는 모델 검색 시 즉시 자동 매칭·추출됩니다.
 */
export const DISTRIBUTOR_EXTENDED_CATALOG: DistributorProductRecord[] = [
  // =========================================================================
  // [삼아CDS] QSC (스피커, 파워앰프, Q-SYS DSP)
  // =========================================================================
  {
    distributorId: 'sama_cds',
    distributorName: '삼아CDS',
    sourceUrl: 'https://www.samacds.co.kr',
    product: {
      id: 'dist-qsc-k12-2',
      brand: 'QSC',
      model: 'K12.2',
      name: '12" 2000W Class-D 액티브 라우드스피커',
      category: 'speaker',
      unitPriceKrw: 1580000,
      enclosureShape: 'trapezoid',
      description: '[삼아CDS 자동수집] QSC K.2 시리즈 12인치 2000W Peak 액티브 스피커( DMT 75° 축대칭 지향각)',
      ports: [
        { id: 'xlr_in1', label: 'MIC/LINE IN A', direction: 'in', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
        { id: 'xlr_in2', label: 'HI-Z/LINE IN B', direction: 'in', signalType: 'mic_line', connector: 'XLR', channelIndex: 2 },
        { id: 'xlr_thru', label: 'MIX OUT(XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
      ],
      speaker: {
        type: 'active',
        impedanceOhms: 8,
        rmsWatts: 1000,
        programWatts: 1500,
        peakWatts: 2000,
        sensitivityDb: 98,
        maxSplDb: 132,
        freqResponseLowHz: 45,
        freqResponseHighHz: 20000,
        dispersionHorizontalDeg: 75,
        dispersionVerticalDeg: 75,
        driverSizeInch: 12,
      },
    },
  },
  {
    distributorId: 'sama_cds',
    distributorName: '삼아CDS',
    sourceUrl: 'https://www.samacds.co.kr',
    product: {
      id: 'dist-qsc-k10-2',
      brand: 'QSC',
      model: 'K10.2',
      name: '10" 2000W Class-D 액티브 라우드스피커',
      category: 'speaker',
      unitPriceKrw: 1380000,
      enclosureShape: 'trapezoid',
      description: '[삼아CDS 자동수집] QSC K10.2 10인치 2000W 액티브 스피커(90° DMT 축대칭 지향각)',
      ports: [
        { id: 'xlr_in1', label: 'MIC/LINE IN A', direction: 'in', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
        { id: 'xlr_thru', label: 'MIX OUT(XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
      ],
      speaker: {
        type: 'active',
        impedanceOhms: 8,
        rmsWatts: 1000,
        programWatts: 1500,
        peakWatts: 2000,
        sensitivityDb: 97,
        maxSplDb: 130,
        freqResponseLowHz: 50,
        freqResponseHighHz: 20000,
        dispersionHorizontalDeg: 90,
        dispersionVerticalDeg: 90,
        driverSizeInch: 10,
      },
    },
  },
  {
    distributorId: 'sama_cds',
    distributorName: '삼아CDS',
    sourceUrl: 'https://www.samacds.co.kr',
    product: {
      id: 'dist-qsc-e112',
      brand: 'QSC',
      model: 'E112',
      name: '12" 2-Way 패시브 포인트소스 스피커(400W)',
      category: 'speaker',
      unitPriceKrw: 1120000,
      enclosureShape: 'trapezoid',
      description: '[삼아CDS 자동수집] QSC E 시리즈 12인치 패시브 메인/모니터 스피커(8Ω, 400W RMS / 85° DMT)',
      ports: [
        { id: 'nl4_in', label: 'NL4 IN(+1/-1)', direction: 'in', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 1 },
        { id: 'nl4_thru', label: 'NL4 LINK THRU', direction: 'out', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 1 },
      ],
      speaker: {
        type: 'passive_lowz',
        impedanceOhms: 8,
        rmsWatts: 400,
        programWatts: 800,
        peakWatts: 1600,
        sensitivityDb: 96,
        maxSplDb: 128,
        freqResponseLowHz: 55,
        freqResponseHighHz: 20000,
        dispersionHorizontalDeg: 85,
        dispersionVerticalDeg: 85,
        driverSizeInch: 12,
      },
    },
  },
  {
    distributorId: 'sama_cds',
    distributorName: '삼아CDS',
    sourceUrl: 'https://www.samacds.co.kr',
    product: {
      id: 'dist-qsc-ads6t',
      brand: 'QSC',
      model: 'AD-S6T',
      name: '6.5" AcousticDesign 월마운트 스피커(100V/8Ω)',
      category: 'speaker',
      unitPriceKrw: 420000,
      enclosureShape: 'wall',
      description: '[삼아CDS 자동수집] QSC AcousticDesign 6.5인치 상업·회의실용 벽부형 스피커(100V 60W 탭)',
      ports: [
        { id: 'tap_in', label: '100V TAP IN(60W)', direction: 'in', signalType: 'speaker_100v', connector: 'Terminal100V', channelIndex: 1 },
        { id: 'tap_thru', label: '100V PARALLEL OUT', direction: 'out', signalType: 'speaker_100v', connector: 'Terminal100V', channelIndex: 1 },
      ],
      speaker: {
        type: 'highz_100v',
        impedanceOhms: 0,
        rmsWatts: 60,
        programWatts: 120,
        peakWatts: 240,
        tap100vWatts: 60,
        sensitivityDb: 90,
        maxSplDb: 111,
        freqResponseLowHz: 60,
        freqResponseHighHz: 20000,
        dispersionHorizontalDeg: 105,
        dispersionVerticalDeg: 105,
        driverSizeInch: 6.5,
      },
    },
  },
  {
    distributorId: 'sama_cds',
    distributorName: '삼아CDS',
    sourceUrl: 'https://www.samacds.co.kr',
    product: {
      id: 'dist-qsc-gxd8',
      brand: 'QSC',
      model: 'GXD 8',
      name: '2채널 DSP 파워앰프(2×800W@8Ω / 2×1200W@4Ω)',
      category: 'amplifier',
      unitPriceKrw: 1490000,
      rackUnits: 2,
      enclosureShape: 'rack_2u',
      description: '[삼아CDS 자동수집] QSC GXD8 내장 스피커 프로세싱 DSP 파워앰프(2×800W@8Ω)',
      ports: [
        { id: 'in_1', label: 'CH1 IN(XLR/TRS)', direction: 'in', signalType: 'mic_line', connector: 'XLR', channelIndex: 1, ampChannel: 1 },
        { id: 'in_2', label: 'CH2 IN(XLR/TRS)', direction: 'in', signalType: 'mic_line', connector: 'XLR', channelIndex: 2, ampChannel: 2 },
        { id: 'out_1', label: 'SPK OUT1(NL4)', direction: 'out', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 1, ampChannel: 1 },
        { id: 'out_2', label: 'SPK OUT2(NL4)', direction: 'out', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 2, ampChannel: 2 },
      ],
      amplifier: {
        channels: 2,
        watts8OhmPerCh: 800,
        watts4OhmPerCh: 1200,
        minImpedanceOhms: 4,
        supports100v: false,
        hasBuiltInDsp: true,
      },
    },
  },
  {
    distributorId: 'sama_cds',
    distributorName: '삼아CDS',
    sourceUrl: 'https://www.samacds.co.kr',
    product: {
      id: 'dist-qsc-core110f',
      brand: 'QSC',
      model: 'Q-SYS Core 110f',
      name: '통합 오디오·비디오·제어 네트워크 DSP 프로세서(24아날로그+128네트워크)',
      category: 'dsp',
      unitPriceKrw: 4350000,
      rackUnits: 1,
      enclosureShape: 'rack_1u',
      description: '[삼아CDS 자동수집] Q-SYS 생태계 표준 8Mic/Line In + 8Line Out + 8Flex + Dante/Q-LAN 통합 프로세서',
      ports: [
        ...makePorts('in', 'MIC/LINE IN', 8, 'in', 'mic_line', 'Euroblock', 1),
        { id: 'dante_in', label: 'Q-LAN/DANTE RX(RJ45)', direction: 'in', signalType: 'network_dante', connector: 'RJ45', channelIndex: 9 },
        { id: 'dante_out', label: 'Q-LAN/DANTE TX(RJ45)', direction: 'out', signalType: 'network_dante', connector: 'RJ45', channelIndex: 1 },
        ...makePorts('out', 'LINE/FLEX OUT', 8, 'out', 'mic_line', 'Euroblock', 2),
      ],
      dsp: {
        analogInputs: 8,
        analogOutputs: 8,
        danteInputs: 64,
        danteOutputs: 64,
        hasAec: true,
      },
    },
  },

  // =========================================================================
  // [삼아사운드] HK Audio · Allen & Heath · PreSonus · Shure · Genelec
  // =========================================================================
  {
    distributorId: 'sama_sound',
    distributorName: '삼아사운드',
    sourceUrl: 'https://www.samasound.co.kr',
    product: {
      id: 'dist-hk-polar12',
      brand: 'HK Audio',
      model: 'POLAR 12',
      name: '12" 서브 내장 2000W 액티브 컬럼어레이 PA 시스템',
      category: 'speaker',
      unitPriceKrw: 1490000,
      enclosureShape: 'column',
      description: '[삼아사운드 자동수집] 독일 HK Audio 12인치 우퍼 + 6×3인치 미드/하이 컬럼 일체형 액티브 스피커(120°×30°)',
      ports: [
        { id: 'xlr_in1', label: 'CH1/2 MIC/LINE(XLR)', direction: 'in', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
        { id: 'xlr_thru', label: 'MIX OUT(XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
      ],
      speaker: {
        type: 'active',
        impedanceOhms: 8,
        rmsWatts: 500,
        programWatts: 1000,
        peakWatts: 2000,
        sensitivityDb: 98,
        maxSplDb: 127,
        freqResponseLowHz: 35,
        freqResponseHighHz: 20000,
        dispersionHorizontalDeg: 120,
        dispersionVerticalDeg: 30,
        driverSizeInch: 12,
      },
    },
  },
  {
    distributorId: 'sama_sound',
    distributorName: '삼아사운드',
    sourceUrl: 'https://www.samasound.co.kr',
    product: {
      id: 'dist-hk-l5-112f',
      brand: 'HK Audio',
      model: 'LINEAR 5 112 F',
      name: '12" 고음압 투어링·강당 패시브스피커(500W RMS)',
      category: 'speaker',
      unitPriceKrw: 1420000,
      enclosureShape: 'trapezoid',
      description: '[삼아사운드 자동수집] HK Audio LINEAR 5 시리즈 12인치 고출력 패시브 스피커(8Ω, 500W RMS, 감도 98dB)',
      ports: [
        { id: 'nl4_in', label: 'NL4 IN(+1/-1)', direction: 'in', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 1 },
        { id: 'nl4_thru', label: 'NL4 LINK THRU', direction: 'out', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 1 },
      ],
      speaker: {
        type: 'passive_lowz',
        impedanceOhms: 8,
        rmsWatts: 500,
        programWatts: 1000,
        peakWatts: 2000,
        sensitivityDb: 98,
        maxSplDb: 132,
        freqResponseLowHz: 58,
        freqResponseHighHz: 20000,
        dispersionHorizontalDeg: 90,
        dispersionVerticalDeg: 55,
        driverSizeInch: 12,
      },
    },
  },
  {
    distributorId: 'sama_sound',
    distributorName: '삼아사운드',
    sourceUrl: 'https://www.samasound.co.kr',
    product: {
      id: 'dist-ah-qu24',
      brand: 'Allen & Heath',
      model: 'QU-24',
      name: '24채널 디지털 믹싱콘솔(24 AnalogiQ 프리앰프)',
      category: 'mixer',
      unitPriceKrw: 3450000,
      enclosureShape: 'console',
      description: '[삼아사운드 자동수집] Allen & Heath 24채널 모터페이더 디지털 믹서(24 Mic/Line In, 20 Out)',
      ports: [
        ...makePorts('mic_in', 'MIC/LINE IN', 16, 'in', 'mic_line', 'XLR', 1),
        { id: 'dante_out', label: 'dSNAKE OUT(RJ45)', direction: 'out', signalType: 'network_dante', connector: 'RJ45', channelIndex: 1 },
        { id: 'main_l', label: 'LR OUT L(XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 2 },
        { id: 'main_r', label: 'LR OUT R(XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 3 },
        ...makePorts('mix_out', 'MIX OUT', 6, 'out', 'mic_line', 'XLR', 4),
      ],
      mixer: {
        micLineInputs: 24,
        stereoInputs: 3,
        mainOutputs: 2,
        auxOutputs: 8,
        isDigital: true,
      },
    },
  },
  {
    distributorId: 'sama_sound',
    distributorName: '삼아사운드',
    sourceUrl: 'https://www.samasound.co.kr',
    product: {
      id: 'dist-ah-avantis',
      brand: 'Allen & Heath',
      model: 'Avantis',
      name: '64채널 96kHz 듀얼 터치스크린 플래그십 디지털콘솔',
      category: 'mixer',
      unitPriceKrw: 14800000,
      enclosureShape: 'console',
      description: '[삼아사운드 자동수집] Allen & Heath 96kHz XCVI 코어 64채널 42버스 대형 디지털 콘솔',
      ports: [
        ...makePorts('mic_in', 'LOCAL XLR IN', 12, 'in', 'mic_line', 'XLR', 1),
        { id: 'dante_in', label: 'DANTE/SLink IN(RJ45)', direction: 'in', signalType: 'network_dante', connector: 'RJ45', channelIndex: 13 },
        { id: 'dante_out', label: 'DANTE/SLink OUT(RJ45)', direction: 'out', signalType: 'network_dante', connector: 'RJ45', channelIndex: 1 },
        ...makePorts('xlr_out', 'LOCAL XLR OUT', 12, 'out', 'mic_line', 'XLR', 2),
      ],
      mixer: {
        micLineInputs: 64,
        stereoInputs: 4,
        mainOutputs: 4,
        auxOutputs: 12,
        isDigital: true,
        danteChannels: 64,
      },
    },
  },
  {
    distributorId: 'sama_sound',
    distributorName: '삼아사운드',
    sourceUrl: 'https://www.samasound.co.kr',
    product: {
      id: 'dist-shure-ulxd4d',
      brand: 'Shure',
      model: 'ULXD4D Dual',
      name: '듀얼 채널 디지털 무선마이크 수신기(Dante 탑재)',
      category: 'source_mic',
      unitPriceKrw: 3850000,
      rackUnits: 1,
      enclosureShape: 'rack_1u',
      description: '[삼아사운드 자동수집] Shure ULX-D 24-bit 디지털 듀얼 무선 수신기(XLR 출력 2CH + Dante RJ45 출력)',
      ports: [
        { id: 'rf_out1', label: 'CH1 XLR OUT', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
        { id: 'rf_out2', label: 'CH2 XLR OUT', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 2 },
        { id: 'dante_out', label: 'DANTE OUT(RJ45)', direction: 'out', signalType: 'network_dante', connector: 'RJ45', channelIndex: 3 },
      ],
    },
  },
  {
    distributorId: 'sama_sound',
    distributorName: '삼아사운드',
    sourceUrl: 'https://www.samasound.co.kr',
    product: {
      id: 'dist-genelec-4030c',
      brand: 'Genelec',
      model: '4030C',
      name: '5" 바이앰프 액티브 인스톨 라우드스피커(Euroblock)',
      category: 'speaker',
      unitPriceKrw: 980000,
      enclosureShape: 'trapezoid',
      description: '[삼아사운드 자동수집] 핀란드 Genelec 4000 시리즈 방송국·고급 회의실용 액티브 스피커(50W+50W)',
      ports: [
        { id: 'euro_in', label: 'BAL IN(Euroblock)', direction: 'in', signalType: 'mic_line', connector: 'Euroblock', channelIndex: 1 },
      ],
      speaker: {
        type: 'active',
        impedanceOhms: 8,
        rmsWatts: 100,
        programWatts: 150,
        peakWatts: 200,
        sensitivityDb: 96,
        maxSplDb: 104,
        freqResponseLowHz: 54,
        freqResponseHighHz: 20000,
        dispersionHorizontalDeg: 100,
        dispersionVerticalDeg: 100,
        driverSizeInch: 5,
      },
    },
  },

  // =========================================================================
  // [테크데이타PS] JBL · Crown · Soundcraft · dbx · AKG · BSS
  // =========================================================================
  {
    distributorId: 'techdata_ps',
    distributorName: '테크데이타PS',
    sourceUrl: 'https://www.techdata-ps.com',
    product: {
      id: 'dist-jbl-prx912',
      brand: 'JBL',
      model: 'PRX912',
      name: '12" 2000W Peak 프로페셔널 액티브스피커(dbx DSP)',
      category: 'speaker',
      unitPriceKrw: 1390000,
      enclosureShape: 'trapezoid',
      description: '[테크데이타PS 자동수집] JBL PRX900 시리즈 12인치 고출력 액티브 PA 스피커(1000W RMS / 132dB SPL)',
      ports: [
        { id: 'xlr_in1', label: 'CH1 COMBO IN', direction: 'in', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
        { id: 'xlr_in2', label: 'CH2 COMBO IN', direction: 'in', signalType: 'mic_line', connector: 'XLR', channelIndex: 2 },
        { id: 'xlr_thru', label: 'MIX OUT(XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
      ],
      speaker: {
        type: 'active',
        impedanceOhms: 8,
        rmsWatts: 1000,
        programWatts: 1500,
        peakWatts: 2000,
        sensitivityDb: 98,
        maxSplDb: 132,
        freqResponseLowHz: 50,
        freqResponseHighHz: 20000,
        dispersionHorizontalDeg: 90,
        dispersionVerticalDeg: 50,
        driverSizeInch: 12,
      },
    },
  },
  {
    distributorId: 'techdata_ps',
    distributorName: '테크데이타PS',
    sourceUrl: 'https://www.techdata-ps.com',
    product: {
      id: 'dist-jbl-eon715',
      brand: 'JBL',
      model: 'EON715',
      name: '15" 1300W 블루투스·DSP 액티브 PA 스피커',
      category: 'speaker',
      unitPriceKrw: 890000,
      enclosureShape: 'trapezoid',
      description: '[테크데이타PS 자동수집] JBL EON700 시리즈 15인치 다목적 액티브 스피커(650W RMS / 128dB SPL)',
      ports: [
        { id: 'xlr_in1', label: 'CH1 MIC/LINE', direction: 'in', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
        { id: 'xlr_thru', label: 'PASSTHRU(XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
      ],
      speaker: {
        type: 'active',
        impedanceOhms: 8,
        rmsWatts: 650,
        programWatts: 1000,
        peakWatts: 1300,
        sensitivityDb: 97,
        maxSplDb: 128,
        freqResponseLowHz: 45,
        freqResponseHighHz: 20000,
        dispersionHorizontalDeg: 90,
        dispersionVerticalDeg: 60,
        driverSizeInch: 15,
      },
    },
  },
  {
    distributorId: 'techdata_ps',
    distributorName: '테크데이타PS',
    sourceUrl: 'https://www.techdata-ps.com',
    product: {
      id: 'dist-jbl-srx812',
      brand: 'JBL',
      model: 'SRX812',
      name: '12" 2-Way 투어링·인스톨 패시브스피커(800W RMS)',
      category: 'speaker',
      unitPriceKrw: 1620000,
      enclosureShape: 'trapezoid',
      description: '[테크데이타PS 자동수집] JBL SRX800 시리즈 12인치 Differential Drive 패시브 메인스피커(8Ω, 800W RMS)',
      ports: [
        { id: 'nl4_in', label: 'NL4 IN(+1/-1)', direction: 'in', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 1 },
        { id: 'nl4_thru', label: 'NL4 LINK THRU', direction: 'out', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 1 },
      ],
      speaker: {
        type: 'passive_lowz',
        impedanceOhms: 8,
        rmsWatts: 800,
        programWatts: 1600,
        peakWatts: 3200,
        sensitivityDb: 95,
        maxSplDb: 134,
        freqResponseLowHz: 48,
        freqResponseHighHz: 20000,
        dispersionHorizontalDeg: 90,
        dispersionVerticalDeg: 50,
        driverSizeInch: 12,
      },
    },
  },
  {
    distributorId: 'techdata_ps',
    distributorName: '테크데이타PS',
    sourceUrl: 'https://www.techdata-ps.com',
    product: {
      id: 'dist-crown-xli2500',
      brand: 'Crown',
      model: 'XLi 2500',
      name: '2채널 고출력 파워앰프(2×500W@8Ω / 2×750W@4Ω)',
      category: 'amplifier',
      unitPriceKrw: 880000,
      rackUnits: 2,
      enclosureShape: 'rack_2u',
      description: '[테크데이타PS 자동수집] Crown XLi 시리즈 12인치 메인 스피커 구동용 2채널 파워앰프',
      ports: [
        { id: 'in_1', label: 'CH1 IN(XLR)', direction: 'in', signalType: 'mic_line', connector: 'XLR', channelIndex: 1, ampChannel: 1 },
        { id: 'in_2', label: 'CH2 IN(XLR)', direction: 'in', signalType: 'mic_line', connector: 'XLR', channelIndex: 2, ampChannel: 2 },
        { id: 'out_1', label: 'SPK OUT1(NL4)', direction: 'out', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 1, ampChannel: 1 },
        { id: 'out_2', label: 'SPK OUT2(NL4)', direction: 'out', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 2, ampChannel: 2 },
      ],
      amplifier: {
        channels: 2,
        watts8OhmPerCh: 500,
        watts4OhmPerCh: 750,
        wattsBridge8Ohm: 1500,
        minImpedanceOhms: 4,
        supports100v: false,
      },
    },
  },
  {
    distributorId: 'techdata_ps',
    distributorName: '테크데이타PS',
    sourceUrl: 'https://www.techdata-ps.com',
    product: {
      id: 'dist-soundcraft-ui24r',
      brand: 'Soundcraft',
      model: 'Ui24R',
      name: '24채널 랙마운트 디지털 무선제어 믹서(Studer 프리앰프)',
      category: 'mixer',
      unitPriceKrw: 1480000,
      rackUnits: 4,
      enclosureShape: 'console',
      description: '[테크데이타PS 자동수집] Soundcraft Studer 설계 프리앰프 20CH + Lexicon/dbx/DigiTech DSP 탑재 24채널 랙 디지털믹서',
      ports: [
        ...makePorts('mic_in', 'STUDER MIC IN', 16, 'in', 'mic_line', 'XLR', 1),
        { id: 'main_l', label: 'MAIN OUT L(XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
        { id: 'main_r', label: 'MAIN OUT R(XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 2 },
        ...makePorts('aux_out', 'AUX OUT', 8, 'out', 'mic_line', 'XLR', 3),
      ],
      mixer: {
        micLineInputs: 20,
        stereoInputs: 2,
        mainOutputs: 2,
        auxOutputs: 8,
        isDigital: true,
      },
    },
  },
  {
    distributorId: 'techdata_ps',
    distributorName: '테크데이타PS',
    sourceUrl: 'https://www.techdata-ps.com',
    product: {
      id: 'dist-bss-blu100',
      brand: 'BSS',
      model: 'Soundweb London BLU-100',
      name: '12×8 오픈아키텍처 디지털 오디오 프로세서(BLU link)',
      category: 'dsp',
      unitPriceKrw: 3250000,
      rackUnits: 1,
      enclosureShape: 'rack_1u',
      description: '[테크데이타PS 자동수집] HARMAN BSS Audio 12입력 × 8출력 오픈아키텍처 시스템 매트릭스 프로세서',
      ports: [
        ...makePorts('in', 'ANALOG IN', 12, 'in', 'mic_line', 'Euroblock', 1),
        ...makePorts('out', 'ANALOG OUT', 8, 'out', 'mic_line', 'Euroblock', 1),
      ],
      dsp: {
        analogInputs: 12,
        analogOutputs: 8,
        danteInputs: 48,
        danteOutputs: 48,
      },
    },
  },
  {
    distributorId: 'techdata_ps',
    distributorName: '테크데이타PS',
    sourceUrl: 'https://www.techdata-ps.com',
    product: {
      id: 'dist-akg-dms300',
      brand: 'AKG',
      model: 'DMS300 Vocal Set',
      name: '2.4GHz 24-bit 디지털 무선마이크 시스템',
      category: 'source_mic',
      unitPriceKrw: 520000,
      enclosureShape: 'half_rack',
      description: '[테크데이타PS 자동수집] AKG 24비트/48kHz 비압축 디지털 무선 핸드헬드 마이크 세트',
      ports: [
        { id: 'xlr_out', label: 'BALANCED XLR OUT', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
      ],
    },
  },

  // =========================================================================
  // [온누리음향] Turbosound · Midas · Behringer · Lab Gruppen · Tannoy
  // =========================================================================
  {
    distributorId: 'onnuri_sound',
    distributorName: '온누리음향',
    sourceUrl: 'http://www.globalsound.co.kr',
    product: {
      id: 'dist-midas-m32',
      brand: 'Midas',
      model: 'M32 LIVE',
      name: '40채널 라이브 투어링 디지털 콘솔(32 Midas PRO 프리앰프)',
      category: 'mixer',
      unitPriceKrw: 6450000,
      enclosureShape: 'console',
      description: '[온누리음향 자동수집] 영국 Midas PRO 마이크 프리앰프 32채널, 25 Midas PRO 모터페이더 탑재 표준 디지털 콘솔',
      ports: [
        ...makePorts('mic_in', 'MIDAS PRO IN', 16, 'in', 'mic_line', 'XLR', 1),
        { id: 'aes50_in', label: 'AES50/DANTE IN(RJ45)', direction: 'in', signalType: 'network_dante', connector: 'RJ45', channelIndex: 17 },
        { id: 'aes50_out', label: 'AES50/DANTE OUT(RJ45)', direction: 'out', signalType: 'network_dante', connector: 'RJ45', channelIndex: 1 },
        { id: 'main_l', label: 'OUT15(MAIN L)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 2 },
        { id: 'main_r', label: 'OUT16(MAIN R)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 3 },
        ...makePorts('mix_out', 'MIX/MTX OUT', 8, 'out', 'mic_line', 'XLR', 4),
      ],
      mixer: {
        micLineInputs: 32,
        stereoInputs: 4,
        mainOutputs: 2,
        auxOutputs: 14,
        isDigital: true,
        danteChannels: 32,
      },
    },
  },
  {
    distributorId: 'onnuri_sound',
    distributorName: '온누리음향',
    sourceUrl: 'http://www.globalsound.co.kr',
    product: {
      id: 'dist-midas-m32r',
      brand: 'Midas',
      model: 'M32R LIVE',
      name: '40채널 컴팩트 랙형 디지털 콘솔(16 Midas PRO 프리앰프)',
      category: 'mixer',
      unitPriceKrw: 4250000,
      enclosureShape: 'console',
      description: '[온누리음향 자동수집] Midas PRO 프리앰프 16채널, 17모터페이더 컴팩트 디지털 콘솔',
      ports: [
        ...makePorts('mic_in', 'MIDAS PRO IN', 16, 'in', 'mic_line', 'XLR', 1),
        { id: 'aes50_out', label: 'AES50/DANTE(RJ45)', direction: 'out', signalType: 'network_dante', connector: 'RJ45', channelIndex: 1 },
        { id: 'main_l', label: 'OUT7(MAIN L)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 2 },
        { id: 'main_r', label: 'OUT8(MAIN R)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 3 },
        ...makePorts('mix_out', 'MIX OUT', 6, 'out', 'mic_line', 'XLR', 4),
      ],
      mixer: {
        micLineInputs: 16,
        stereoInputs: 3,
        mainOutputs: 2,
        auxOutputs: 6,
        isDigital: true,
        danteChannels: 32,
      },
    },
  },
  {
    distributorId: 'onnuri_sound',
    distributorName: '온누리음향',
    sourceUrl: 'http://www.globalsound.co.kr',
    product: {
      id: 'dist-behringer-wing',
      brand: 'Behringer',
      model: 'WING',
      name: '48스테레오 채널 플래그십 디지털 믹싱콘솔(10" 터치스크린)',
      category: 'mixer',
      unitPriceKrw: 5200000,
      enclosureShape: 'console',
      description: '[온누리음향 자동수집] Behringer WING 48스테레오 채널, 24 모터페이더, Midas PRO 프리앰프 탑재 콘솔',
      ports: [
        ...makePorts('mic_in', 'MIDAS PRO IN', 8, 'in', 'mic_line', 'XLR', 1),
        { id: 'dante_in', label: 'AES50/DANTE IN(RJ45)', direction: 'in', signalType: 'network_dante', connector: 'RJ45', channelIndex: 9 },
        { id: 'dante_out', label: 'AES50/DANTE OUT(RJ45)', direction: 'out', signalType: 'network_dante', connector: 'RJ45', channelIndex: 1 },
        ...makePorts('mix_out', 'MIDAS LINE OUT', 8, 'out', 'mic_line', 'XLR', 2),
      ],
      mixer: {
        micLineInputs: 48,
        stereoInputs: 8,
        mainOutputs: 4,
        auxOutputs: 8,
        isDigital: true,
        danteChannels: 64,
      },
    },
  },
  {
    distributorId: 'onnuri_sound',
    distributorName: '온누리음향',
    sourceUrl: 'http://www.globalsound.co.kr',
    product: {
      id: 'dist-labgruppen-pd3000',
      brand: 'Lab Gruppen',
      model: 'PD3000',
      name: '2채널 투어링·인스톨 파워앰프(2×800W@8Ω / 2×1500W@4Ω)',
      category: 'amplifier',
      unitPriceKrw: 1380000,
      rackUnits: 2,
      enclosureShape: 'rack_2u',
      description: '[온누리음향 자동수집] 스웨덴 Lab Gruppen PD 시리즈 고출력 Class-D 2채널 파워앰프',
      ports: [
        { id: 'in_1', label: 'CH1 IN(XLR)', direction: 'in', signalType: 'mic_line', connector: 'XLR', channelIndex: 1, ampChannel: 1 },
        { id: 'in_2', label: 'CH2 IN(XLR)', direction: 'in', signalType: 'mic_line', connector: 'XLR', channelIndex: 2, ampChannel: 2 },
        { id: 'out_1', label: 'SPK OUT1(NL4)', direction: 'out', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 1, ampChannel: 1 },
        { id: 'out_2', label: 'SPK OUT2(NL4)', direction: 'out', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 2, ampChannel: 2 },
      ],
      amplifier: {
        channels: 2,
        watts8OhmPerCh: 800,
        watts4OhmPerCh: 1500,
        minImpedanceOhms: 2,
        supports100v: false,
      },
    },
  },
  {
    distributorId: 'onnuri_sound',
    distributorName: '온누리음향',
    sourceUrl: 'http://www.globalsound.co.kr',
    product: {
      id: 'dist-tannoy-vx12',
      brand: 'Tannoy',
      model: 'VX 12',
      name: '12" Dual Concentric 동축 포인트소스 패시브스피커',
      category: 'speaker',
      unitPriceKrw: 1450000,
      enclosureShape: 'trapezoid',
      description: '[온누리음향 자동수집] 영국 Tannoy 특허 Dual Concentric 동축 드라이버 탑재 12인치 스피커(8Ω, 350W RMS / 90° 동축)',
      ports: [
        { id: 'nl4_in', label: 'NL4 IN(+1/-1)', direction: 'in', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 1 },
        { id: 'nl4_thru', label: 'NL4 LINK THRU', direction: 'out', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 1 },
      ],
      speaker: {
        type: 'passive_lowz',
        impedanceOhms: 8,
        rmsWatts: 350,
        programWatts: 700,
        peakWatts: 1400,
        sensitivityDb: 97,
        maxSplDb: 128,
        freqResponseLowHz: 60,
        freqResponseHighHz: 20000,
        dispersionHorizontalDeg: 90,
        dispersionVerticalDeg: 90,
        driverSizeInch: 12,
      },
    },
  },
  {
    distributorId: 'onnuri_sound',
    distributorName: '온누리음향',
    sourceUrl: 'http://www.globalsound.co.kr',
    product: {
      id: 'dist-turbosound-iq15',
      brand: 'Turbosound',
      model: 'iQ15',
      name: '15" 2500W Klark Teknik DSP 액티브스피커(ULTRANET)',
      category: 'speaker',
      unitPriceKrw: 1290000,
      enclosureShape: 'trapezoid',
      description: '[온누리음향 자동수집] Turbosound iQ15 15인치 2500W 액티브 라우드스피커(75°×55°)',
      ports: [
        { id: 'xlr_in1', label: 'LINE/MIC IN A', direction: 'in', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
        { id: 'xlr_thru', label: 'MIX LINK OUT(XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
      ],
      speaker: {
        type: 'active',
        impedanceOhms: 8,
        rmsWatts: 750,
        programWatts: 1250,
        peakWatts: 2500,
        sensitivityDb: 99,
        maxSplDb: 132,
        freqResponseLowHz: 42,
        freqResponseHighHz: 20000,
        dispersionHorizontalDeg: 75,
        dispersionVerticalDeg: 55,
        driverSizeInch: 15,
      },
    },
  },
];

/**
 * 브랜드명 또는 모델명 키워드로 담당 국내 공식 총판(삼아사운드, 삼아CDS, 테크데이타PS, 온누리음향)을 자동 판별합니다.
 */
export function resolveDistributorByBrandOrQuery(query: string): KoreanAudioDistributor {
  const q = query.toLowerCase();

  // 1. 삼아CDS (QSC, Q-SYS, AHM)
  if (
    q.includes('qsc') ||
    q.includes('q-sys') ||
    q.includes('k12') ||
    q.includes('k10') ||
    q.includes('k8') ||
    q.includes('e11') ||
    q.includes('gxd') ||
    q.includes('pld') ||
    q.includes('ad-s') ||
    q.includes('ad-c') ||
    q.includes('core 110')
  ) {
    return DEFAULT_KOREAN_DISTRIBUTORS[1]; // 삼아CDS
  }

  // 2. 삼아사운드 (Shure, Allen & Heath, HK Audio, PreSonus, Genelec, Dynaudio)
  if (
    q.includes('shure') ||
    q.includes('allen') ||
    q.includes('a&h') ||
    q.includes('sq-') ||
    q.includes('qu-') ||
    q.includes('zed') ||
    q.includes('avantis') ||
    q.includes('dlive') ||
    q.includes('hk') ||
    q.includes('polar') ||
    q.includes('linear') ||
    q.includes('sonar') ||
    q.includes('fineo') ||
    q.includes('presonus') ||
    q.includes('studiolive') ||
    q.includes('genelec') ||
    q.includes('ulxd') ||
    q.includes('slxd') ||
    q.includes('sm58') ||
    q.includes('mx4')
  ) {
    return DEFAULT_KOREAN_DISTRIBUTORS[0]; // 삼아사운드
  }

  // 3. 온누리음향 (Turbosound, Midas, Behringer, Lab Gruppen, Tannoy, Klark Teknik)
  if (
    q.includes('turbosound') ||
    q.includes('nuq') ||
    q.includes('iq1') ||
    q.includes('ip2000') ||
    q.includes('midas') ||
    q.includes('m32') ||
    q.includes('mr18') ||
    q.includes('behringer') ||
    q.includes('x32') ||
    q.includes('wing') ||
    q.includes('xr1') ||
    q.includes('xenyx') ||
    q.includes('lab') ||
    q.includes('gruppen') ||
    q.includes('pd3000') ||
    q.includes('ipx') ||
    q.includes('tannoy') ||
    q.includes('vx') ||
    q.includes('cvs') ||
    q.includes('klark')
  ) {
    return DEFAULT_KOREAN_DISTRIBUTORS[3]; // 온누리음향
  }

  // 4. 테크데이타PS (JBL, Crown, Soundcraft, dbx, AKG, BSS)
  return DEFAULT_KOREAN_DISTRIBUTORS[2]; // 테크데이타PS
}

/**
 * 입력한 검색어(브랜드+모델명 또는 모델명 단독)가 기본 카탈로그에 없을 때,
 * 4대 공식 총판 DB 검색 + 모델 시리즈 음향 물리사양 자동 파서로 즉시 사양을 생성/반환합니다.
 */
export function searchOrSynthesizeDistributorProducts(
  rawQuery: string,
  existingCatalog: AudioProduct[],
  filterDistributorId?: KoreanAudioDistributor['id']
): DistributorProductRecord[] {
  const q = rawQuery.trim().toLowerCase();
  const existingIds = new Set(existingCatalog.map((c) => c.id));
  const existingModels = new Set(existingCatalog.map((c) => c.model.toLowerCase()));

  // 1. 확장 총판 DB에서 아직 로컬 카탈로그에 등록되지 않은 항목 필터링
  const matchedFromExtended = DISTRIBUTOR_EXTENDED_CATALOG.filter((rec) => {
    if (existingIds.has(rec.product.id) || existingModels.has(rec.product.model.toLowerCase())) {
      return false;
    }
    if (filterDistributorId && rec.distributorId !== filterDistributorId) {
      return false;
    }
    if (!q) return true;
    const text = `${rec.product.brand} ${rec.product.model} ${rec.product.name} ${rec.distributorName}`.toLowerCase();
    return text.includes(q);
  });

  if (!q || q.length < 2) {
    return matchedFromExtended;
  }

  // 만약 정확히 일치하는 모델이 이미 있으면 그대로 반환
  const exactInExtended = matchedFromExtended.some(
    (r) =>
      r.product.model.toLowerCase() === q ||
      `${r.product.brand} ${r.product.model}`.toLowerCase() === q
  );
  if (exactInExtended || existingModels.has(q)) {
    return matchedFromExtended;
  }

  // 2. 확장 DB에도 없는 신규 모델명(예: "JBL PRX915", "QSC K8.2", "Crown XLS2502", "Midas M32C", "Turbosound NuQ152")일 경우
  //    4대 총판 브랜드 규칙과 모델 번호에서 구경(Inch)·출력(W)·채널수·지향각을 자동 파싱하여 사양 생성
  const synthesized = synthesizeProductFromModelQuery(rawQuery.trim(), filterDistributorId);
  if (synthesized && !existingModels.has(synthesized.product.model.toLowerCase())) {
    return [synthesized, ...matchedFromExtended];
  }

  return matchedFromExtended;
}

/**
 * 모델명 문자열에서 브랜드, 총판, 카테고리, 스피커 구경/감도/지향각, 앰프 출력, 믹서 채널수를 자동 추론하는 엔진
 */
export function synthesizeProductFromModelQuery(
  rawInput: string,
  preferredDistId?: KoreanAudioDistributor['id']
): DistributorProductRecord | null {
  const cleaned = rawInput.trim();
  if (cleaned.length < 2) return null;

  const dist = preferredDistId
    ? DEFAULT_KOREAN_DISTRIBUTORS.find((d) => d.id === preferredDistId) ||
      resolveDistributorByBrandOrQuery(cleaned)
    : resolveDistributorByBrandOrQuery(cleaned);

  const lower = cleaned.toLowerCase();

  // 브랜드 추론
  const allBrands = [
    'Allen & Heath',
    'HK Audio',
    'PreSonus',
    'Soundcraft',
    'Turbosound',
    'Lab Gruppen',
    'Klark Teknik',
    'Behringer',
    'Genelec',
    'Dynaudio',
    'Tannoy',
    'Midas',
    'Crown',
    'Shure',
    'QSC',
    'JBL',
    'dbx',
    'AKG',
    'BSS',
  ];

  let detectedBrand = dist.brands[0];
  let modelPart = cleaned;

  for (const b of allBrands) {
    if (lower.startsWith(b.toLowerCase())) {
      detectedBrand = b;
      modelPart = cleaned.slice(b.length).trim() || cleaned;
      break;
    }
  }

  // 모델명만으로 브랜드 자동 매핑
  if (modelPart === cleaned) {
    if (/^(k8|k10|k12|e10|e12|e15|gxd|pld|ad-|core)/i.test(cleaned)) detectedBrand = 'QSC';
    else if (/^(sq|qu|zed|avantis|dlive|ahm)/i.test(cleaned)) detectedBrand = 'Allen & Heath';
    else if (/^(polar|linear|sonar|fineo|l5)/i.test(cleaned)) detectedBrand = 'HK Audio';
    else if (/^(studiolive|earmix)/i.test(cleaned)) detectedBrand = 'PreSonus';
    else if (/^(sm|beta|ulx|slx|blx|qlx|mx)/i.test(cleaned)) detectedBrand = 'Shure';
    else if (/^(prx|srx|eon|vtx|cbt|control|vma)/i.test(cleaned)) detectedBrand = 'JBL';
    else if (/^(xli|xti|xls|cdi|dci)/i.test(cleaned)) detectedBrand = 'Crown';
    else if (/^(ui|si |signature|epm|lx7)/i.test(cleaned)) detectedBrand = 'Soundcraft';
    else if (/^(driverack|venu360|pa2)/i.test(cleaned)) detectedBrand = 'dbx';
    else if (/^(blu-)/i.test(cleaned)) detectedBrand = 'BSS';
    else if (/^(nuq|iq|ip|tcs|milan)/i.test(cleaned)) detectedBrand = 'Turbosound';
    else if (/^(m32|mr18|mr12|hd96)/i.test(cleaned)) detectedBrand = 'Midas';
    else if (/^(x32|wing|xr|xenyx|flow)/i.test(cleaned)) detectedBrand = 'Behringer';
    else if (/^(pd|ipx|plm|fp|ca|lucide)/i.test(cleaned)) detectedBrand = 'Lab Gruppen';
    else if (/^(vx|cvs|cms|vls)/i.test(cleaned)) detectedBrand = 'Tannoy';
  }

  const finalDistributor = resolveDistributorByBrandOrQuery(`${detectedBrand} ${modelPart}`);
  const normModel = modelPart.toUpperCase();

  // 카테고리 자동 판별
  let category: ProductCategory = 'speaker';
  if (
    ['Crown', 'Lab Gruppen'].includes(detectedBrand) ||
    /(xli|xti|xls|cdi|gxd|pld|pd\d|ipx|vma)/i.test(lower)
  ) {
    category = 'amplifier';
  } else if (
    ['Allen & Heath', 'PreSonus', 'Soundcraft', 'Midas', 'Behringer'].includes(detectedBrand) ||
    /(sq-|qu-|zed|studiolive|signature|ui\d|m32|x32|wing|mr18|xr18)/i.test(lower)
  ) {
    category = 'mixer';
  } else if (
    ['Shure', 'AKG'].includes(detectedBrand) ||
    /(ulx|slx|blx|sm58|dms|mic)/i.test(lower)
  ) {
    category = 'source_mic';
  } else if (['dbx', 'BSS', 'Klark Teknik'].includes(detectedBrand) || /(core|blu-|venu|dsp)/i.test(lower)) {
    category = 'dsp';
  }

  const slug = `${detectedBrand}-${normModel}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // 1) 스피커 사양 합성
  if (category === 'speaker') {
    const isSub = /(sub|18|118|218|b\b|s\b)/i.test(normModel);
    const isCol = /(cbt|polar|vls|ip\d|column)/i.test(normModel);
    const isHighZ = /(control|ad-|cvs|cms|100v|c\/t|ct\b)/i.test(normModel);
    const isActive = /(k8|k10|k12|prx|eon|iq|polar|sonar|genelec|a\b)/i.test(normModel) && !isHighZ;

    let driverInch = 12;
    if (/18/.test(normModel)) driverInch = 18;
    else if (/15/.test(normModel)) driverInch = 15;
    else if (/12/.test(normModel)) driverInch = 12;
    else if (/10/.test(normModel)) driverInch = 10;
    else if (/8/.test(normModel)) driverInch = 8;
    else if (/6/.test(normModel)) driverInch = 6.5;
    else if (/5/.test(normModel)) driverInch = 5;

    const rmsWatts = isHighZ
      ? 40
      : isSub
      ? 800
      : isActive
      ? 700
      : driverInch >= 15
      ? 600
      : driverInch >= 12
      ? 400
      : 250;

    const sensitivityDb = isHighZ
      ? 90
      : isSub
      ? 99
      : driverInch >= 15
      ? 98
      : driverInch >= 12
      ? 97
      : 94;

    const dispH = isSub ? 360 : isCol ? 130 : isHighZ ? 110 : 90;
    const dispV = isSub ? 180 : isCol ? 25 : isHighZ ? 100 : 60;
    const enclosureShape: EnclosureShape = isSub
      ? 'subwoofer'
      : isCol
      ? 'column'
      : isHighZ
      ? 'ceiling'
      : 'trapezoid';

    const ports: PortSpec[] = isActive
      ? [
          { id: 'xlr_in1', label: 'LINE/MIC IN', direction: 'in', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
          { id: 'xlr_thru', label: 'LINK OUT(XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
        ]
      : isHighZ
      ? [
          { id: 'tap_in', label: `100V TAP IN(${rmsWatts}W)`, direction: 'in', signalType: 'speaker_100v', connector: 'Terminal100V', channelIndex: 1 },
          { id: 'tap_thru', label: '100V PARALLEL OUT', direction: 'out', signalType: 'speaker_100v', connector: 'Terminal100V', channelIndex: 1 },
        ]
      : [
          { id: 'nl4_in', label: 'NL4 IN(+1/-1)', direction: 'in', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 1 },
          { id: 'nl4_thru', label: 'NL4 LINK THRU', direction: 'out', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 1 },
        ];

    return {
      distributorId: finalDistributor.id,
      distributorName: finalDistributor.shortLabel,
      sourceUrl: `${finalDistributor.searchUrlTemplate}${encodeURIComponent(normModel)}`,
      product: {
        id: `auto-${slug}`,
        brand: detectedBrand,
        model: normModel,
        name: `${driverInch}" ${isSub ? '서브우퍼' : isCol ? '컬럼어레이' : isActive ? '액티브' : isHighZ ? '100V 인스톨' : '2-Way 패시브'} 스피커`,
        category: 'speaker',
        unitPriceKrw: isSub ? 1750000 : isHighZ ? 340000 : driverInch >= 15 ? 1480000 : 1180000,
        enclosureShape,
        description: `[${finalDistributor.shortLabel} 자동수집] ${detectedBrand} ${normModel} (${rmsWatts}W RMS, ${sensitivityDb}dB, ${dispH}°×${dispV}°)`,
        ports,
        speaker: {
          type: isSub ? 'subwoofer' : isCol ? 'column' : isHighZ ? 'highz_100v' : isActive ? 'active' : 'passive_lowz',
          impedanceOhms: isHighZ ? 0 : 8,
          rmsWatts,
          programWatts: rmsWatts * 2,
          peakWatts: rmsWatts * 4,
          tap100vWatts: isHighZ ? rmsWatts : undefined,
          sensitivityDb,
          maxSplDb: Math.round(sensitivityDb + 10 * Math.log10(rmsWatts * 2)),
          freqResponseLowHz: isSub ? 35 : 55,
          freqResponseHighHz: isSub ? 150 : 20000,
          dispersionHorizontalDeg: dispH,
          dispersionVerticalDeg: dispV,
          driverSizeInch: driverInch,
        },
      },
    };
  }

  // 2) 파워앰프 사양 합성
  if (category === 'amplifier') {
    const numMatch = normModel.match(/(\d{3,4})/);
    const rawNum = numMatch ? Number(numMatch[1]) : 1500;
    const watts8Ohm = Math.max(250, Math.min(2000, Math.round((rawNum * 0.25) / 50) * 50));
    const watts4Ohm = Math.round(watts8Ohm * 1.6);
    const is4Ch = /(4\||4x|4ch|quattro|pld4)/i.test(normModel);
    const chCount = is4Ch ? 4 : 2;
    const is100v = /(cdi|vma|100v)/i.test(normModel);

    const ports: PortSpec[] = [];
    for (let c = 1; c <= chCount; c++) {
      ports.push({
        id: `in_${c}`,
        label: `CH${c} IN(XLR)`,
        direction: 'in',
        signalType: 'mic_line',
        connector: 'XLR',
        channelIndex: c,
        ampChannel: c,
      });
    }
    for (let c = 1; c <= chCount; c++) {
      ports.push({
        id: `out_${c}`,
        label: is100v ? `100V OUT CH${c}` : `SPK OUT${c}(NL4)`,
        direction: 'out',
        signalType: is100v ? 'speaker_100v' : 'speaker_lowz',
        connector: is100v ? 'Terminal100V' : 'Speakon',
        channelIndex: c,
        ampChannel: c,
      });
    }

    return {
      distributorId: finalDistributor.id,
      distributorName: finalDistributor.shortLabel,
      sourceUrl: `${finalDistributor.searchUrlTemplate}${encodeURIComponent(normModel)}`,
      product: {
        id: `auto-${slug}`,
        brand: detectedBrand,
        model: normModel,
        name: `${chCount}채널 파워앰프(${chCount}×${watts8Ohm}W@8Ω)`,
        category: 'amplifier',
        unitPriceKrw: chCount === 4 ? 1950000 : 1250000,
        rackUnits: 2,
        enclosureShape: 'rack_2u',
        description: `[${finalDistributor.shortLabel} 자동수집] ${detectedBrand} ${normModel} (${chCount}CH × ${watts8Ohm}W@8Ω / ${watts4Ohm}W@4Ω)`,
        ports,
        amplifier: {
          channels: chCount,
          watts8OhmPerCh: watts8Ohm,
          watts4OhmPerCh: watts4Ohm,
          watts100vPerCh: is100v ? watts8Ohm : undefined,
          minImpedanceOhms: 4,
          supports100v: is100v,
          hasBuiltInDsp: true,
        },
      },
    };
  }

  // 3) 오디오 믹서 사양 합성
  if (category === 'mixer') {
    const chMatch = normModel.match(/(\d{1,2})/);
    const chCount = chMatch ? Math.max(8, Math.min(32, Number(chMatch[1]))) : 16;
    const inPortDisplay = Math.min(16, chCount);

    return {
      distributorId: finalDistributor.id,
      distributorName: finalDistributor.shortLabel,
      sourceUrl: `${finalDistributor.searchUrlTemplate}${encodeURIComponent(normModel)}`,
      product: {
        id: `auto-${slug}`,
        brand: detectedBrand,
        model: normModel,
        name: `${chCount}채널 프로 오디오 믹싱콘솔`,
        category: 'mixer',
        unitPriceKrw: chCount >= 24 ? 3200000 : 1450000,
        enclosureShape: 'console',
        description: `[${finalDistributor.shortLabel} 자동수집] ${detectedBrand} ${normModel} (${chCount}입력 채널 프로 오디오 콘솔)`,
        ports: [
          ...makePorts('mic_in', 'MIC/LINE IN', inPortDisplay, 'in', 'mic_line', 'XLR', 1),
          { id: 'main_l', label: 'MAIN OUT L(XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
          { id: 'main_r', label: 'MAIN OUT R(XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 2 },
          ...makePorts('aux_out', 'AUX/MIX OUT', 4, 'out', 'mic_line', 'XLR', 3),
        ],
        mixer: {
          micLineInputs: chCount,
          stereoInputs: 2,
          mainOutputs: 2,
          auxOutputs: 6,
          isDigital: true,
        },
      },
    };
  }

  // 4) 마이크 또는 DSP
  return {
    distributorId: finalDistributor.id,
    distributorName: finalDistributor.shortLabel,
    sourceUrl: `${finalDistributor.searchUrlTemplate}${encodeURIComponent(normModel)}`,
    product: {
      id: `auto-${slug}`,
      brand: detectedBrand,
      model: normModel,
      name: category === 'dsp' ? '디지털 오디오 프로세서' : '프로페셔널 무선/유선 마이크 시스템',
      category,
      unitPriceKrw: category === 'dsp' ? 1850000 : 890000,
      enclosureShape: 'rack_1u',
      description: `[${finalDistributor.shortLabel} 자동수집] ${detectedBrand} ${normModel}`,
      ports:
        category === 'dsp'
          ? [
              ...makePorts('in', 'INPUT ', 4, 'in', 'mic_line', 'XLR', 1),
              ...makePorts('out', 'OUTPUT ', 8, 'out', 'mic_line', 'XLR', 1),
            ]
          : [
              { id: 'xlr_out_1', label: 'MIC OUT 1(XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
              { id: 'xlr_out_2', label: 'MIC OUT 2(XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 2 },
            ],
      dsp:
        category === 'dsp'
          ? {
              analogInputs: 4,
              analogOutputs: 8,
              danteInputs: 0,
              danteOutputs: 0,
            }
          : undefined,
    },
  };
}
