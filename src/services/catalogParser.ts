import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import {
  AudioProduct,
  EnclosureShape,
  PortSpec,
  ProductCategory,
  SpeakerSpec,
  AmplifierSpec,
  MixerSpec,
  DspSpec,
} from '../types/audio';

export interface ParsedCatalogResult {
  brandDetected: string;
  totalParsed: number;
  products: AudioProduct[];
  rawTextPreview: string;
}

// Known major pro audio brands dictionary
const KNOWN_BRANDS: Record<string, string> = {
  jbl: 'JBL Professional',
  crown: 'Crown',
  soundcraft: 'Soundcraft',
  bss: 'BSS Audio',
  martin: 'Martin Audio',
  'martin audio': 'Martin Audio',
  hk: 'HK Audio',
  'hk audio': 'HK Audio',
  turbosound: 'Turbosound',
  powersoft: 'Powersoft',
  behringer: 'Behringer',
  presonus: 'PreSonus',
  'allen & heath': 'Allen & Heath',
  'allen and heath': 'Allen & Heath',
  ah: 'Allen & Heath',
  yamaha: 'Yamaha',
  shure: 'Shure',
  sennheiser: 'Sennheiser',
  qsc: 'QSC',
  ev: 'Electro-Voice',
  'electro-voice': 'Electro-Voice',
  genelec: 'Genelec',
  bose: 'Bose Professional',
  midas: 'Midas',
  dynacord: 'Dynacord',
  rcf: 'RCF',
  dandb: 'd&b audiotechnik',
  'd&b': 'd&b audiotechnik',
  lacoustics: 'L-Acoustics',
  'l-acoustics': 'L-Acoustics',
  dbx: 'dbx',
  samson: 'Samson',
  akg: 'AKG',
};

/**
 * Detect primary brand from text content or filename
 */
export function detectBrandFromContent(content: string, fileName?: string): string {
  const probe = `${fileName || ''} ${content.slice(0, 2000)}`.toLowerCase();

  for (const [key, formalName] of Object.entries(KNOWN_BRANDS)) {
    const regex = new RegExp(`\\b${key.replace(/&/g, '&')}\\b`, 'i');
    if (regex.test(probe)) {
      return formalName;
    }
  }

  // Fallback: search for words preceding "catalog", "audio", "pro"
  const brandMatch = probe.match(/([a-z0-9\-_]{2,16})\s+(?:catalog|brochure|products|lineup|audio|sound)/i);
  if (brandMatch) {
    const raw = brandMatch[1];
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  return 'Ainsonic Custom';
}

/**
 * Determine product category from model name and description keywords
 */
export function detectCategory(text: string): ProductCategory {
  const lower = text.toLowerCase();

  // 1. Audio Mixer / Console (Higher priority than general 'mic' since mixers mention mic preamps)
  if (
    lower.includes('mixer') ||
    lower.includes('console') ||
    lower.includes('fader') ||
    lower.includes('믹서') ||
    lower.includes('콘솔') ||
    lower.includes('audio console') ||
    lower.includes('mixing desk')
  ) {
    return 'mixer';
  }

  // 2. Microphones & Wireless Systems
  if (
    lower.includes('microphone') ||
    lower.includes('wireless mic') ||
    lower.includes('무선마이크') ||
    lower.includes('수신기') ||
    lower.includes('핸드헬드') ||
    lower.includes('lavalier') ||
    lower.includes('transmitter') ||
    lower.includes('receiver system') ||
    lower.includes('handheld') ||
    lower.includes('slxd') ||
    lower.includes('ew-d') ||
    lower.includes('sm58') ||
    (lower.includes('mic') && !lower.includes('preamp'))
  ) {
    return 'source_mic';
  }

  // 3. DSP / Audio Processors
  if (
    lower.includes('dsp') ||
    lower.includes('processor') ||
    lower.includes('soundweb') ||
    lower.includes('matrix') ||
    lower.includes('loudspeaker management') ||
    lower.includes('프로세서')
  ) {
    return 'dsp';
  }

  // 4. Dante / Network Interfaces / Stageboxes
  if (
    lower.includes('dante') ||
    lower.includes('stagebox') ||
    lower.includes('스테이지박스') ||
    lower.includes('ethernet switch')
  ) {
    return 'network';
  }

  // 5. Power Amplifiers
  if (
    lower.includes('amplifier') ||
    lower.includes('power amp') ||
    lower.includes('앰프') ||
    lower.includes('파워앰프') ||
    lower.includes('4-channel') ||
    lower.includes('2-channel') ||
    lower.includes('8-channel') ||
    lower.includes('quattrocanali') ||
    lower.includes('xti') ||
    lower.includes('cdi') ||
    lower.includes('xli')
  ) {
    return 'amplifier';
  }

  // Default to speaker
  return 'speaker';
}

/**
 * Parses raw text extracted from PDF, Excel/CSV, or pasted catalog text,
 * and synthesizes an array of clean AudioProduct objects ready for CAD.
 */
export function parseCatalogText(
  rawText: string,
  options?: {
    forcedBrand?: string;
    fileName?: string;
  }
): ParsedCatalogResult {
  const brand = options?.forcedBrand || detectBrandFromContent(rawText, options?.fileName);
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  const productCandidates: Array<{
    model: string;
    name: string;
    blockText: string;
  }> = [];

  // Stopwords that must NEVER be treated as product model names
  const INVALID_MODEL_WORDS = new Set([
    'WATT', 'WATTS', 'RMS', 'OHM', 'OHMS', 'CHANNEL', 'CHANNELS', 'CH',
    'SPEAKER', 'SPEAKERS', 'AMPLIFIER', 'AMPLIFIERS', 'AMP', 'MIXER', 'MIXERS',
    'TWO-WAY', 'THREE-WAY', 'INCH', 'INPUT', 'INPUTS', 'OUTPUT', 'OUTPUTS',
    'HIGH-OUTPUT', 'PASSIVE', 'ACTIVE', 'POWERED', 'SYSTEM', 'LINE', 'SERIES',
    'PROFESSIONAL', 'HIGH-PERFORMANCE', 'DIGITAL', 'ANALOG', 'WIRELESS'
  ]);

  const isValidModelName = (str: string): boolean => {
    const s = str.trim().toUpperCase();
    if (s.length < 2 || s.length > 25) return false;
    if (!/[A-Z0-9]/.test(s)) return false;

    // Check if the string is just composed of spec words/numbers (e.g. "500W RMS", "16 MIC/LINE INPUTS", "8 OHMS")
    const words = s.split(/[\s\-/,.]+/).filter((w) => w.length > 0);
    if (words.length === 0) return false;

    const isAllSpecTokens = words.every(
      (w) =>
        INVALID_MODEL_WORDS.has(w) ||
        /^\d+(?:W|WATT|WATTS|RMS|OHM|OHMS|CH|CHANNEL|INCH|DB|V|HZ|KHZ)?$/i.test(w)
    );
    if (isAllSpecTokens) return false;

    if (/^\d+\s*(?:W|WATT|WATTS|RMS|OHM|OHMS|CH|CHANNEL|INCH|")$/i.test(s)) return false;
    if (/^(?:HIGH|LOW|MID|TWO|THREE|FOUR|DUAL|SINGLE)[-\s]/i.test(s)) return false;
    return true;
  };

  // Check if file is explicitly CSV or TSV
  const isCsvOrTsvFile = Boolean(options?.fileName?.match(/\.(csv|tsv)$/i));

  if (isCsvOrTsvFile) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0 && (line.toLowerCase().includes('model') || line.toLowerCase().includes('품명') || line.toLowerCase().includes('brand'))) {
        continue;
      }
      const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ''));
      if (parts.length >= 2) {
        const candidateModel = parts.find((p) => isValidModelName(p)) || parts[0];
        if (candidateModel && isValidModelName(candidateModel)) {
          productCandidates.push({
            model: candidateModel,
            name: parts[1] || candidateModel,
            blockText: line,
          });
        }
      }
    }
  } else {
    // Unstructured or semi-structured text: parse by blank paragraphs or model heading lines
    const rawParagraphs = rawText.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter((p) => p.length > 0);

    if (rawParagraphs.length >= 2) {
      for (const para of rawParagraphs) {
        // Skip document title / cover headers that don't describe a specific piece of equipment
        const paraLower = para.toLowerCase();
        if (
          (paraLower.includes('lineup') || paraLower.includes('catalog') || paraLower.includes('brochure') || paraLower.includes('price list')) &&
          !paraLower.includes('ohm') && !paraLower.includes('watt') && !paraLower.includes('db')
        ) {
          continue;
        }

        const paraLines = para.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
        if (paraLines.length === 0) continue;

        // Find the best line in the paragraph that contains a model heading
        let matched = false;
        for (const line of paraLines) {
          const headingMatch =
            line.match(/^([A-Z0-9][A-Z0-9\-_./| ]{1,25}?)\s+[-–—:]\s+(.+)$/i) ||
            line.match(/^([A-Z0-9][A-Z0-9\-_./|]{2,20})\s+(.+)$/i);

          if (headingMatch && isValidModelName(headingMatch[1])) {
            productCandidates.push({
              model: headingMatch[1].trim(),
              name: headingMatch[2].trim(),
              blockText: para,
            });
            matched = true;
            break;
          }
        }

        if (!matched) {
          const firstLine = paraLines[0];
          if (isValidModelName(firstLine) && firstLine.length <= 25) {
            productCandidates.push({
              model: firstLine,
              name: paraLines[1] || firstLine,
              blockText: para,
            });
          }
        }
      }
    } else {
      // Line by line scanning
      for (const line of lines) {
        const headingMatch =
          line.match(/^([A-Z0-9][A-Z0-9\-_./| ]{1,25}?)\s+[-–—:]\s+(.+)$/i) ||
          line.match(/^([A-Z0-9][A-Z0-9\-_./|]{2,20})\s+(.+)$/i);

        if (headingMatch && isValidModelName(headingMatch[1])) {
          productCandidates.push({
            model: headingMatch[1].trim(),
            name: headingMatch[2].trim(),
            blockText: line,
          });
        }
      }
    }
  }

  // De-duplicate candidates by model name
  const seenModels = new Set<string>();
  const uniqueCandidates = productCandidates.filter((c) => {
    const key = c.model.toUpperCase();
    if (seenModels.has(key)) return false;
    seenModels.add(key);
    return true;
  });

  // Convert each candidate into a full AudioProduct with synthesized ports & electrical specs
  const products: AudioProduct[] = uniqueCandidates.map((cand, idx) => {
    return synthesizeAudioProductFromBlock(cand.model, cand.name, cand.blockText, brand, idx);
  });

  return {
    brandDetected: brand,
    totalParsed: products.length,
    products,
    rawTextPreview: rawText.slice(0, 1500),
  };
}

/**
 * Synthesizes deep physical, electrical, and port specs from model and contextual text
 */
function synthesizeAudioProductFromBlock(
  model: string,
  name: string,
  blockText: string,
  brand: string,
  idx: number
): AudioProduct {
  const text = `${model} ${name} ${blockText}`.toLowerCase();
  const cat = detectCategory(text);

  // Price extraction or fallback
  let unitPriceKrw = 850000;
  const priceMatch = text.match(/(?:₩|krw|\\|원)\s*([\d,]+)/i) || text.match(/([\d,]+)\s*(?:원|만원)/);
  if (priceMatch) {
    const rawNum = priceMatch[1].replace(/,/g, '');
    const num = Number(rawNum);
    if (!isNaN(num)) {
      unitPriceKrw = text.includes('만원') ? num * 10000 : num;
    }
  }

  // 1) SPEAKER SPECS SYNTHESIS
  if (cat === 'speaker') {
    let spkType: SpeakerSpec['type'] = 'passive_lowz';
    let enclosureShape: EnclosureShape = 'trapezoid';

    if (text.includes('sub') || text.includes('서브우퍼') || text.includes('18"') || model.includes('SUB') || model.includes('118') || model.includes('218')) {
      spkType = 'subwoofer';
      enclosureShape = 'subwoofer';
    } else if (text.includes('column') || text.includes('cbt') || text.includes('라인어레이') || text.includes('line array')) {
      spkType = 'column';
      enclosureShape = 'column';
    } else if (text.includes('ceiling') || text.includes('100v') || text.includes('실링') || text.includes('high-z') || text.includes('매립')) {
      spkType = 'highz_100v';
      enclosureShape = 'ceiling';
    } else if (text.includes('active') || text.includes('powered') || text.includes('액티브') || text.includes('iq12') || text.includes('prx')) {
      spkType = 'active';
      enclosureShape = 'trapezoid';
    }

    // Driver Inch: e.g. 15", 12", 10", 8", 6.5"
    let driverSizeInch = 12;
    const driverMatch = text.match(/\b(18|15|12|10|8|6(?:\.5)?|5(?:\.25)?|4)\s*(?:inch|"|인치|형)/);
    if (driverMatch) {
      driverSizeInch = parseFloat(driverMatch[1]);
    } else {
      // Model number inference (e.g. CDD12 -> 12", FO 8 -> 8", SRX815 -> 15")
      if (model.includes('18')) driverSizeInch = 18;
      else if (model.includes('15')) driverSizeInch = 15;
      else if (model.includes('12')) driverSizeInch = 12;
      else if (model.includes('10')) driverSizeInch = 10;
      else if (model.includes('8')) driverSizeInch = 8;
      else if (model.includes('6')) driverSizeInch = 6.5;
    }

    // RMS Watts: e.g. 400W, 800W, 1200W
    let rmsWatts = driverSizeInch >= 18 ? 1000 : driverSizeInch >= 15 ? 600 : driverSizeInch >= 12 ? 400 : 250;
    const wattsMatch = text.match(/\b(\d{2,4})\s*(?:w|watt|와트|rms|aes|continuous)/);
    if (wattsMatch) {
      rmsWatts = parseInt(wattsMatch[1], 10);
    }

    // Sensitivity (dB SPL @ 1W/1m)
    let sensitivityDb = driverSizeInch >= 15 ? 98 : driverSizeInch >= 12 ? 97 : 94;
    const sensMatch = text.match(/\b(8\d|9\d|10\d|11\d)(?:\.\d)?\s*(?:db|db\s*spl)/);
    if (sensMatch) {
      sensitivityDb = parseFloat(sensMatch[1]);
    }

    // Dispersion (Horizontal x Vertical Degrees)
    let dispersionHorizontalDeg = 90;
    let dispersionVerticalDeg = 60;
    const dispMatch = text.match(/(\d{2,3})[°x×*]\s*(\d{2,3})/);
    if (dispMatch) {
      dispersionHorizontalDeg = parseInt(dispMatch[1], 10);
      dispersionVerticalDeg = parseInt(dispMatch[2], 10);
    } else if (enclosureShape === 'ceiling') {
      dispersionHorizontalDeg = 120;
      dispersionVerticalDeg = 120;
    } else if (enclosureShape === 'subwoofer') {
      dispersionHorizontalDeg = 360;
      dispersionVerticalDeg = 360;
    }

    // Impedance
    let impedanceOhms = 8;
    const ohmMatch = text.match(/\b(4|8|16)\s*(?:ohm|ohms|옴|Ω)/);
    if (ohmMatch) {
      impedanceOhms = parseInt(ohmMatch[1], 10);
    }

    const tap100vWatts = spkType === 'highz_100v' ? 30 : undefined;
    const programWatts = rmsWatts * 2;
    const peakWatts = rmsWatts * 4;
    const maxSplDb = Math.round((sensitivityDb + 10 * Math.log10(programWatts)) * 10) / 10;

    const ports: PortSpec[] =
      spkType === 'active'
        ? [
            { id: 'xlr_in_1', label: 'LINE/MIC IN 1', direction: 'in', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
            { id: 'xlr_thru', label: 'LINK OUT (XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
          ]
        : spkType === 'highz_100v'
        ? [
            { id: 'tap_in', label: `100V IN (${tap100vWatts}W)`, direction: 'in', signalType: 'speaker_100v', connector: 'Terminal100V', channelIndex: 1 },
            { id: 'tap_thru', label: '100V THRU', direction: 'out', signalType: 'speaker_100v', connector: 'Terminal100V', channelIndex: 1 },
          ]
        : [
            { id: 'nl4_in', label: 'NL4 IN (+1/-1)', direction: 'in', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 1 },
            { id: 'nl4_thru', label: 'NL4 LINK THRU', direction: 'out', signalType: 'speaker_lowz', connector: 'Speakon', channelIndex: 1 },
          ];

    const speaker: SpeakerSpec = {
      type: spkType,
      impedanceOhms: spkType === 'highz_100v' ? 0 : impedanceOhms,
      rmsWatts,
      programWatts,
      peakWatts,
      tap100vWatts,
      sensitivityDb,
      maxSplDb,
      freqResponseLowHz: spkType === 'subwoofer' ? 35 : driverSizeInch >= 15 ? 45 : 55,
      freqResponseHighHz: spkType === 'subwoofer' ? 150 : 20000,
      dispersionHorizontalDeg,
      dispersionVerticalDeg,
      driverSizeInch,
    };

    return {
      id: `imported-${brand.toLowerCase().replace(/[^a-z0-9]/g, '')}-${model.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}-${idx}`,
      brand,
      model,
      name,
      category: 'speaker',
      unitPriceKrw,
      enclosureShape,
      description: `${brand} ${model} — ${driverSizeInch}" ${rmsWatts}W ${spkType === 'subwoofer' ? '서브우퍼' : '스피커'} (${dispersionHorizontalDeg}°x${dispersionVerticalDeg}°)`,
      ports,
      speaker,
    };
  }

  // 2) AMPLIFIER SPECS SYNTHESIS
  if (cat === 'amplifier') {
    let channels = 2;
    if (text.includes('4-ch') || text.includes('4ch') || text.includes('4채널') || model.includes('4|') || model.includes('4804') || model.includes('2404')) {
      channels = 4;
    } else if (text.includes('8-ch') || text.includes('8ch') || text.includes('8채널')) {
      channels = 8;
    }

    let watts8OhmPerCh = 600;
    const w8Match = text.match(/8\s*(?:ohm|Ω).*?(\d{2,4})\s*w/) || text.match(/(\d{2,4})\s*w.*?8\s*(?:ohm|Ω)/);
    if (w8Match) {
      watts8OhmPerCh = parseInt(w8Match[1], 10);
    } else {
      // Model number inference (e.g. 4804 -> 1200W, 4002 -> 800W, 1500 -> 350W)
      if (model.includes('4804') || model.includes('6002')) watts8OhmPerCh = 1200;
      else if (model.includes('4002') || model.includes('2404')) watts8OhmPerCh = 800;
      else if (model.includes('1500') || model.includes('300')) watts8OhmPerCh = 350;
    }
    const watts4OhmPerCh = Math.round(watts8OhmPerCh * 1.6);
    const supports100v = text.includes('100v') || text.includes('70v') || text.includes('high-z') || model.includes('CDI') || model.includes('VMA');
    const watts100vPerCh = supports100v ? watts8OhmPerCh : undefined;
    const hasDante = text.includes('dante') || model.includes('+D') || model.includes('DANTE');

    const ports: PortSpec[] = [];
    if (hasDante) {
      ports.push({
        id: 'dante_in',
        label: 'DANTE IN (RJ45)',
        direction: 'in',
        signalType: 'network_dante',
        connector: 'RJ45',
        channelIndex: 1,
      });
    }
    for (let c = 1; c <= channels; c++) {
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
    for (let c = 1; c <= channels; c++) {
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

    const amplifier: AmplifierSpec = {
      channels,
      watts8OhmPerCh,
      watts4OhmPerCh,
      watts100vPerCh,
      minImpedanceOhms: 4,
      supports100v,
      hasDante,
    };

    return {
      id: `imported-${brand.toLowerCase().replace(/[^a-z0-9]/g, '')}-${model.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}-${idx}`,
      brand,
      model,
      name,
      category: 'amplifier',
      unitPriceKrw,
      enclosureShape: model.includes('QUATTRO') ? 'rack_1u' : 'rack_2u',
      description: `${brand} ${model} — ${channels}채널 프로페셔널 파워앰프 (${watts8OhmPerCh}W @ 8Ω${supports100v ? ', 100V 겸용' : ''})`,
      ports,
      amplifier,
    };
  }

  // 3) MIXER SPECS SYNTHESIS
  if (cat === 'mixer') {
    let micLineInputs = 16;
    const inMatch = text.match(/(\d{1,2})\s*(?:ch|channel|mic|input|in|채널|입력)/);
    if (inMatch) {
      micLineInputs = parseInt(inMatch[1], 10);
    } else {
      if (model.includes('32')) micLineInputs = 32;
      else if (model.includes('24')) micLineInputs = 24;
      else if (model.includes('16')) micLineInputs = 16;
      else if (model.includes('12')) micLineInputs = 12;
      else if (model.includes('8') || model.includes('5')) micLineInputs = 8;
    }

    const isDigital = text.includes('digital') || text.includes('디지털') || model.includes('SQ') || model.includes('X32') || model.includes('STUDIOLIVE');
    const danteChannels = text.includes('dante') ? 16 : 0;
    const auxOutputs = micLineInputs >= 24 ? 8 : micLineInputs >= 16 ? 4 : 2;

    const ports: PortSpec[] = [];
    for (let i = 1; i <= micLineInputs; i++) {
      ports.push({
        id: `mix_in_${i}`,
        label: `MIC/LINE IN ${i}`,
        direction: 'in',
        signalType: 'mic_line',
        connector: 'XLR',
        channelIndex: i,
      });
    }
    if (danteChannels > 0) {
      ports.push(
        { id: 'dante_in', label: 'DANTE IN (RJ45)', direction: 'in', signalType: 'network_dante', connector: 'RJ45', channelIndex: micLineInputs + 1 },
        { id: 'dante_out', label: 'DANTE OUT (RJ45)', direction: 'out', signalType: 'network_dante', connector: 'RJ45', channelIndex: 1 }
      );
    }
    ports.push(
      { id: 'mix_out_1', label: 'MAIN OUT L (XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
      { id: 'mix_out_2', label: 'MAIN OUT R (XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 2 }
    );
    for (let a = 1; a <= auxOutputs; a++) {
      ports.push({
        id: `mix_aux_${a}`,
        label: `AUX/BUS OUT ${a}`,
        direction: 'out',
        signalType: 'mic_line',
        connector: 'XLR',
        channelIndex: 2 + a,
      });
    }

    const mixer: MixerSpec = {
      micLineInputs,
      stereoInputs: 2,
      mainOutputs: 2,
      auxOutputs,
      isDigital,
      danteChannels,
    };

    return {
      id: `imported-${brand.toLowerCase().replace(/[^a-z0-9]/g, '')}-${model.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}-${idx}`,
      brand,
      model,
      name,
      category: 'mixer',
      unitPriceKrw,
      enclosureShape: 'console',
      description: `${brand} ${model} — ${micLineInputs}채널 ${isDigital ? '디지털' : '아날로그'} 오디오 콘솔 (Main + ${auxOutputs} Aux)`,
      ports,
      mixer,
    };
  }

  // 4) DSP SPECS SYNTHESIS
  if (cat === 'dsp') {
    let inCount = 8;
    let outCount = 8;
    if (model.includes('100') || model.includes('12')) {
      inCount = 12;
      outCount = 4;
    } else if (model.includes('DX4') || model.includes('4.0')) {
      inCount = 4;
      outCount = 8;
    }

    const ports: PortSpec[] = [];
    for (let i = 1; i <= inCount; i++) {
      ports.push({
        id: `dsp_in_${i}`,
        label: `ANALOG IN ${i}`,
        direction: 'in',
        signalType: 'mic_line',
        connector: 'PhoenixEuroblock',
        channelIndex: i,
      });
    }
    for (let o = 1; o <= outCount; o++) {
      ports.push({
        id: `dsp_out_${o}`,
        label: `ANALOG OUT ${o}`,
        direction: 'out',
        signalType: 'mic_line',
        connector: 'PhoenixEuroblock',
        channelIndex: o,
      });
    }

    const dsp: DspSpec = {
      analogInputs: inCount,
      analogOutputs: outCount,
      danteChannels: text.includes('dante') ? 16 : 0,
      firSupport: true,
      matrixRouting: true,
    };

    return {
      id: `imported-${brand.toLowerCase().replace(/[^a-z0-9]/g, '')}-${model.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}-${idx}`,
      brand,
      model,
      name,
      category: 'dsp',
      unitPriceKrw,
      enclosureShape: 'rack_1u',
      description: `${brand} ${model} — ${inCount}in/${outCount}out 프로페셔널 DSP 오디오 매트릭스 프로세서`,
      ports,
      dsp,
    };
  }

  // 5) SOURCE / WIRELESS MIC SPECS SYNTHESIS
  if (cat === 'source_mic') {
    const isDual = text.includes('dual') || text.includes('2-ch') || text.includes('2ch') || text.includes('24d') || text.includes('2채널');
    const ports: PortSpec[] = [
      { id: 'mic_out_1', label: 'CH1 BAL OUT (XLR)', direction: 'out', signalType: 'mic_line', connector: 'XLR', channelIndex: 1 },
    ];
    if (isDual) {
      ports.push({
        id: 'mic_out_2',
        label: 'CH2 BAL OUT (XLR)',
        direction: 'out',
        signalType: 'mic_line',
        connector: 'XLR',
        channelIndex: 2,
      });
    }

    return {
      id: `imported-${brand.toLowerCase().replace(/[^a-z0-9]/g, '')}-${model.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}-${idx}`,
      brand,
      model,
      name,
      category: 'source_mic',
      unitPriceKrw,
      enclosureShape: 'rack_1u',
      description: `${brand} ${model} — 프로페셔널 ${isDual ? '듀얼 2채널' : '싱글 1채널'} 무선 마이크 수신기 시스템`,
      ports,
    };
  }

  // 6) NETWORK STAGEBOX / SWITCH SPECS SYNTHESIS
  const ports: PortSpec[] = [];
  for (let i = 1; i <= 8; i++) {
    ports.push({
      id: `dante_rx_${i}`,
      label: `DANTE RX ${i}`,
      direction: 'in',
      signalType: 'network_dante',
      connector: 'RJ45',
      channelIndex: i,
    });
  }
  for (let o = 1; o <= 8; o++) {
    ports.push({
      id: `dante_tx_${o}`,
      label: `DANTE TX ${o}`,
      direction: 'out',
      signalType: 'network_dante',
      connector: 'RJ45',
      channelIndex: o,
    });
  }

  return {
    id: `imported-${brand.toLowerCase().replace(/[^a-z0-9]/g, '')}-${model.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}-${idx}`,
    brand,
    model,
    name,
    category: 'network',
    unitPriceKrw,
    enclosureShape: 'rack_1u',
    description: `${brand} ${model} — 기가비트 이더넷 / Dante 네트워크 오디오 인터페이스`,
    ports,
  };
}

// Configure pdf.js worker for Vite bundler (works in dev and ./ relative base builds)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

/**
 * Extracts plain text from an uploaded file (handles .txt, .csv, .json, .md, .html, .pdf, and image OCR)
 */
export async function extractTextFromCatalogFile(
  file: File,
  onProgress?: (status: string) => void
): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  // Plain text formats
  if (['txt', 'csv', 'tsv', 'json', 'md', 'html', 'htm'].includes(extension)) {
    return await file.text();
  }

  // Image formats (camera photo, screenshot, scanned catalog image) via browser OCR
  if (
    file.type.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'avif', 'tif', 'tiff'].includes(extension)
  ) {
    return await extractTextFromImageFile(file, onProgress);
  }

  // PDF format text extraction via pdfjs-dist (handles FlateDecode, CMap, Korean/Unicode fonts + scanned PDF OCR fallback)
  if (extension === 'pdf') {
    const arrayBuffer = await file.arrayBuffer();
    return await extractTextFromPdfBuffer(arrayBuffer, onProgress);
  }

  // Fallback: try reading as UTF-8 text
  try {
    const text = await file.text();
    if (text && text.length > 50) return text;
  } catch {
    // ignore
  }

  throw new Error(`지원하지 않는 파일 형식입니다: .${extension} (PDF, 사진/이미지, CSV, TXT, JSON, MD 지원)`);
}

/**
 * Enhances an image on an offscreen canvas (upscale + contrast/grayscale) for better OCR accuracy.
 */
async function preprocessImageForOcr(source: File | HTMLCanvasElement): Promise<HTMLCanvasElement> {
  if (source instanceof HTMLCanvasElement) {
    return source;
  }

  const bitmap = await createImageBitmap(source);
  const maxDim = Math.max(bitmap.width, bitmap.height);
  // Upscale smaller phone/screenshot images so small spec text is legible to Tesseract
  const scale = maxDim < 1400 ? Math.min(2.2, 1600 / Math.max(1, maxDim)) : 1;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('브라우저 캔버스 컨텍스트를 초기화할 수 없습니다.');
  }

  ctx.filter = 'grayscale(100%) contrast(135%) brightness(105%)';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas;
}

/**
 * Runs client-side OCR (English + Korean) on a photographed or uploaded catalog image.
 */
async function extractTextFromImageFile(
  source: File | HTMLCanvasElement,
  onProgress?: (status: string) => void
): Promise<string> {
  onProgress?.('이미지 전처리 중...');
  const canvas = await preprocessImageForOcr(source);

  onProgress?.('사진 텍스트 인식(OCR) 모델 로딩 중...');
  const result = await Tesseract.recognize(canvas, 'eng+kor', {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(`사진 텍스트 인식(OCR) 중... ${Math.round(m.progress * 100)}%`);
      } else if (m.status === 'loading language traineddata') {
        onProgress?.('한/영 OCR 언어 데이터 다운로드 중...');
      }
    },
  });

  return (result.data.text || '').trim();
}

interface PdfTextChunk {
  str: string;
  x: number;
  y: number;
}

/**
 * Extracts structured line-by-line text from a PDF ArrayBuffer using pdfjs-dist,
 * preserving visual rows and paragraph gaps, with automatic OCR fallback for scanned PDFs.
 */
async function extractTextFromPdfBuffer(
  buffer: ArrayBuffer,
  onProgress?: (status: string) => void
): Promise<string> {
  try {
    onProgress?.('PDF 문서 분석 중...');
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const chunks: PdfTextChunk[] = [];

      for (const item of textContent.items) {
        if ('str' in item && typeof item.str === 'string' && item.str.trim().length > 0) {
          const transform = (item as { transform?: number[] }).transform;
          const x = transform ? transform[4] : 0;
          const y = transform ? transform[5] : 0;
          chunks.push({ str: item.str, x, y });
        }
      }

      // Sort top-to-bottom (descending Y in PDF coordinates), then left-to-right (ascending X)
      chunks.sort((a, b) => {
        if (Math.abs(b.y - a.y) > 3) return b.y - a.y;
        return a.x - b.x;
      });

      const lines: string[] = [];
      let currentLineY: number | null = null;
      let currentLineParts: string[] = [];

      for (const chunk of chunks) {
        if (currentLineY === null) {
          currentLineY = chunk.y;
          currentLineParts.push(chunk.str.trim());
        } else if (Math.abs(currentLineY - chunk.y) <= 3.5) {
          currentLineParts.push(chunk.str.trim());
        } else {
          lines.push(currentLineParts.join(' '));
          // Preserve paragraph breaks when vertical gap is large
          if (currentLineY - chunk.y > 18) {
            lines.push('');
          }
          currentLineY = chunk.y;
          currentLineParts = [chunk.str.trim()];
        }
      }

      if (currentLineParts.length > 0) {
        lines.push(currentLineParts.join(' '));
      }

      const pageStr = lines.join('\n').trim();
      if (pageStr) {
        pageTexts.push(pageStr);
      }
    }

    const combined = pageTexts.join('\n\n').trim();
    if (combined.length >= 20) {
      return combined;
    }

    // Scanned / image-only PDF fallback: render up to first 5 pages and run OCR
    const ocrPages: string[] = [];
    const maxOcrPages = Math.min(pdf.numPages, 5);
    for (let pageNum = 1; pageNum <= maxOcrPages; pageNum++) {
      onProgress?.(`스캔 PDF 페이지 OCR 인식 중 (${pageNum}/${maxOcrPages})...`);
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const pageOcr = await extractTextFromImageFile(canvas, onProgress);
      if (pageOcr) ocrPages.push(pageOcr);
    }

    const ocrCombined = ocrPages.join('\n\n').trim();
    if (ocrCombined.length > 0) {
      return ocrCombined;
    }
  } catch (err) {
    console.warn('pdfjs-dist extraction failed, falling back to legacy scanner:', err);
  }

  return extractTextFromPdfBufferLegacy(buffer);
}

/**
 * Legacy fallback PDF text stream scanner for malformed/uncompressed PDFs.
 */
function extractTextFromPdfBufferLegacy(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder('latin1');
  const rawString = decoder.decode(bytes);

  const extractedLines: string[] = [];

  // Match text objects between BT and ET
  const btEtRegex = /BT[\s\S]*?ET/g;
  let match: RegExpExecArray | null;

  while ((match = btEtRegex.exec(rawString)) !== null) {
    const block = match[0];

    // Extract strings in parentheses: (Sample Text) Tj
    const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
    let tjMatch: RegExpExecArray | null;
    let lineStr = '';
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      lineStr += tjMatch[1] + ' ';
    }

    // Extract array strings: [(Sample) 20 (Text)] TJ
    const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
    let arrMatch: RegExpExecArray | null;
    while ((arrMatch = tjArrayRegex.exec(block)) !== null) {
      const inner = arrMatch[1];
      const partRegex = /\(([^)]+)\)/g;
      let partMatch: RegExpExecArray | null;
      while ((partMatch = partRegex.exec(inner)) !== null) {
        lineStr += partMatch[1] + ' ';
      }
    }

    if (lineStr.trim().length > 0) {
      // Decode escaped characters (\(, \), \\, \n, \r)
      const clean = lineStr
        .replace(/\\([()\\])/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
      if (clean.length > 0) {
        extractedLines.push(clean);
      }
    }
  }

  // If text objects yielded good content, return it
  if (extractedLines.length > 5) {
    return extractedLines.join('\n');
  }

  // Fallback: search for readable ASCII word sequences in raw string
  const asciiWords = rawString.match(/[A-Za-z0-9\-_./]{3,}/g) || [];
  return asciiWords.slice(0, 3000).join(' ');
}
