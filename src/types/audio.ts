export type ProductCategory =
  | 'speaker'
  | 'amplifier'
  | 'mixer'
  | 'dsp'
  | 'source_mic'
  | 'network';

export type SignalCategory = 'signal' | 'speaker' | 'network';

export type PortSignalType =
  | 'mic_line'
  | 'speaker_lowz'
  | 'speaker_100v'
  | 'network_dante';

export type ConnectorType =
  | 'XLR'
  | 'TRS'
  | 'RCA'
  | 'Euroblock'
  | 'Speakon'
  | 'Terminal100V'
  | 'RJ45';

export interface PortSpec {
  id: string;
  label: string;
  direction: 'in' | 'out';
  signalType: PortSignalType;
  connector: ConnectorType;
  channelIndex: number;
  /** Optional link to amp channel or speaker tap */
  ampChannel?: number;
}

export type EnclosureShape =
  | 'trapezoid'
  | 'subwoofer'
  | 'column'
  | 'ceiling'
  | 'wall'
  | 'rack_1u'
  | 'rack_2u'
  | 'console'
  | 'half_rack';

export interface SpeakerSpecs {
  type: 'passive_lowz' | 'active' | 'subwoofer' | 'column' | 'highz_100v';
  impedanceOhms: number; // e.g. 8, 4, or 0 for pure 100V
  rmsWatts: number;
  programWatts: number;
  peakWatts: number;
  tap100vWatts?: number; // For 100V line speakers
  sensitivityDb: number; // 1W / 1m
  maxSplDb: number;
  freqResponseLowHz: number;
  freqResponseHighHz: number;
  dispersionHorizontalDeg: number; // e.g. 90 (-6dB beamwidth)
  dispersionVerticalDeg: number; // e.g. 60 (-6dB beamwidth)
  driverSizeInch: number;
}

export interface AmplifierSpecs {
  channels: number;
  watts8OhmPerCh: number;
  watts4OhmPerCh: number;
  watts2OhmPerCh?: number;
  wattsBridge8Ohm?: number;
  watts100vPerCh?: number;
  minImpedanceOhms: number; // 2, 4, or 8
  supports100v: boolean;
  hasBuiltInDsp?: boolean;
  hasDante?: boolean;
}

export interface MixerSpecs {
  micLineInputs: number;
  stereoInputs: number;
  mainOutputs: number;
  auxOutputs: number;
  matrixOutputs?: number;
  isDigital: boolean;
  danteChannels?: number;
}

export interface DspSpecs {
  analogInputs: number;
  analogOutputs: number;
  danteInputs: number;
  danteOutputs: number;
  hasAec?: boolean;
}

export interface AudioProduct {
  id: string;
  brand: string;
  model: string;
  name: string;
  category: ProductCategory;
  unitPriceKrw: number;
  rackUnits?: number;
  enclosureShape: EnclosureShape;
  customImageUrl?: string;
  description: string;
  ports: PortSpec[];
  speaker?: SpeakerSpecs;
  amplifier?: AmplifierSpecs;
  mixer?: MixerSpecs;
  dsp?: DspSpecs;
  powerConsumptionWatts?: number;
  weightKg?: number;
}

export interface SystemNode {
  id: string;
  productId: string;
  customLabel: string;
  x: number;
  y: number;
  /** For 100V speakers, user can pick tap wattage if different from default */
  selectedTapWatts?: number;
}

export interface CableConnection {
  id: string;
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
  cableCategory: SignalCategory;
  connectorFrom: ConnectorType;
  connectorTo: ConnectorType;
  estimatedLengthMeters: number;
  label?: string;
}

export interface SpeakerPlacement {
  id: string;
  nodeId: string; // Links directly to the SystemNode in the schematic!
  productId: string;
  label: string;
  /** Room coordinates in meters (0,0 is top-left / front-left of room) */
  xMeters: number;
  yMeters: number;
  zHeightMeters: number;
  /** Horizontal aiming angle in degrees: 0 = pointing right (+X / towards audience), 90 = +Y (down), -90 = -Y (up) */
  azimuthDeg: number;
  /** Vertical tilt downward angle in degrees: positive = tilted down towards floor (e.g. 15 deg) */
  tiltDownDeg: number;
  muted?: boolean;
}

export type VenuePurpose =
  | 'auditorium'
  | 'church'
  | 'conference'
  | 'cafe_retail'
  | 'live_club'
  | 'classroom';

export interface RoomConfig {
  widthMeters: number; // Y-axis (Left-to-Right width of room)
  lengthMeters: number; // X-axis (Stage Front-to-Back depth of room)
  heightMeters: number; // Z-axis (Floor-to-Ceiling height)
  earHeightMeters: number; // 1.2m seated, 1.6m standing
  targetSplDb: number; // e.g. 88 dB for speech, 96 dB for music/church
  /** Target acceptable SPL deviation (±dB) across the audience area, e.g. ±3.0 dB */
  targetUniformityDb?: number;
  rt60Seconds: number; // Reverberation time estimate (e.g. 0.6s ~ 1.4s)
  stageDepthMeters: number; // Front stage zone X (0 to stageDepthMeters)
  floorplanImageUrl?: string;
  floorplanOpacity: number;
  sideViewSliceYMeters: number; // Y coordinate for side-view vertical cross-section
}

export interface OptimizationProposal {
  id: string;
  category: 'reposition' | 'swap_model' | 'add_speakers' | 'combined';
  badgeLabel: string;
  title: string;
  description: string;
  actionBullets: string[];
  beforeAvgSplDb: number;
  afterAvgSplDb: number;
  beforeUniformityDb: number;
  afterUniformityDb: number;
  beforeCoveragePercent: number;
  afterCoveragePercent: number;
  costDeltaKrw: number;
  meetsSplTarget: boolean;
  meetsUniformityTarget: boolean;
  nextNodes: SystemNode[];
  nextConnections: CableConnection[];
  nextPlacements: SpeakerPlacement[];
}

export interface ProjectMeta {
  id: string;
  projectName: string;
  clientName: string;
  venueName: string;
  designerName: string;
  companyName: string;
  drawingNumber: string;
  createdAt: string;
  updatedAt: string;
  showPricingInReport: boolean;
  installationFeePercent: number;
  discountPercent: number;
  notes: string;
}

export interface AmpChannelLoadAnalysis {
  ampNodeId: string;
  ampLabel: string;
  ampProduct: AudioProduct;
  channelIndex: number;
  portId: string;
  portLabel: string;
  connectedSpeakerNodes: {
    nodeId: string;
    label: string;
    product: AudioProduct;
    deliveredWatts: number;
    rmsWatts: number;
    headroomRatio: number; // deliveredWatts / rmsWatts
  }[];
  mode: 'lowz' | 'highz_100v' | 'unconnected';
  totalImpedanceOhms: number | null;
  ampAvailableWattsAtLoad: number;
  totalTapWatts100v: number;
  status: 'optimal' | 'acceptable' | 'underpowered' | 'overloaded' | 'unconnected';
  statusMessage: string;
}

export interface ConnectionValidationResult {
  connectionId: string;
  isValid: boolean;
  severity: 'ok' | 'warning' | 'error';
  message: string;
  technicalBadge: string;
}

export interface AcousticInterferenceHotspot {
  type: 'boost' | 'dip';
  xMeters: number;
  yMeters: number;
  splDb: number;
  deltaDb: number; // +dB boost or -dB dip relative to incoherent power sum
}

export interface SPLSimulationSummary {
  avgSplDb: number;
  maxSplDb: number;
  minSplDb: number;
  uniformityPlusMinusDb: number;
  targetCoveragePercent: number; // % of audience area >= targetSplDb - 3dB
  deadSpotPercent: number; // % of audience area < targetSplDb - 9dB
  estimatedSti: number; // 0.0 ~ 1.0 Speech Transmission Index
  stiGrade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  overlapZonePercent?: number; // % of audience area where >=2 speakers overlap within 6dB
  maxBoostDeltaDb?: number; // Peak constructive phase boost (+dB)
  maxDipDeltaDb?: number; // Deepest destructive phase cancellation dip (-dB)
  interferenceHotspots?: AcousticInterferenceHotspot[];
  speakerDriveMap: Record<
    string,
    {
      deliveredWatts: number;
      maxContinuousSpl1m: number;
      isPoweredByAmp: boolean;
      sourceDescription: string;
    }
  >;
}

export interface AutoDesignWizardInput {
  purpose: VenuePurpose;
  lengthMeters: number;
  widthMeters: number;
  heightMeters: number;
  wirelessMicCount: number;
  wiredMicCount: number;
  bgmSourceCount: number;
  includeSubwoofer: boolean;
  systemTopology: 'auto' | 'low_z' | 'high_z_100v';
  useDanteNetwork: boolean;
  budgetTier: 'standard' | 'premium';
}

export interface ConnectResult {
  ok: boolean;
  level: 'success' | 'info' | 'error';
  message: string;
}

