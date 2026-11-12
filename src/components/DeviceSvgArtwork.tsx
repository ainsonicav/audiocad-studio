import React, { useId } from 'react';
import { AudioProduct } from '../types/audio';

interface DeviceSvgArtworkProps {
  product: AudioProduct;
  width?: number;
  height?: number;
  compact?: boolean;
}

/**
 * Renders model-specific, simplified hardware SVG icons using a fixed internal viewBox
 * (`236x82` for speakers, `236x52` for rack/console gear) and strict chassis `<clipPath>`s
 * so graphics never overflow their container box at any size (sidebar, node, or CAD sheet).
 */
export const DeviceSvgArtwork: React.FC<DeviceSvgArtworkProps> = ({
  product,
  width = 236,
  height = 76,
}) => {
  const uid = useId().replace(/:/g, '');
  const modelUpper = `${product.brand} ${product.model}`.toUpperCase();

  if (product.customImageUrl) {
    return (
      <div
        className="relative overflow-hidden rounded border border-slate-700 bg-slate-900 flex items-center justify-center"
        style={{ width, height }}
      >
        <img
          src={product.customImageUrl}
          alt={product.model}
          className="max-h-full max-w-full object-contain"
        />
        <span className="absolute bottom-0.5 right-1 text-[9px] font-mono bg-slate-950/80 px-1 rounded text-cyan-300">
          {product.model}
        </span>
      </div>
    );
  }

  // ============================================================================
  // 1. SPEAKER ENCLOSURE ARTWORK (Fixed Internal ViewBox: 236 x 82)
  // ============================================================================
  if (product.category === 'speaker') {
    const VW = 236;
    const VH = 82;
    const shape = product.enclosureShape;
    const isActive = product.speaker?.type === 'active';
    const is100v = product.speaker?.type === 'highz_100v';
    const driverInch = product.speaker?.driverSizeInch || 12;

    const cabClipId = `spk-cab-clip-${uid}`;
    const specClipId = `spk-spec-clip-${uid}`;
    const specBoxX = 76;
    const specBoxW = 152;

    const isMartinCdd = modelUpper.includes('CDD');
    const isHkFineo = modelUpper.includes('FINEO') || modelUpper.includes('FO ') || modelUpper.includes('HK');
    const isTurboNuq = modelUpper.includes('NUQ');
    const isTurboIq = modelUpper.includes('IQ') || (isActive && modelUpper.includes('TURBO'));
    const isJblSrx = modelUpper.includes('SRX') || (modelUpper.includes('JBL') && driverInch >= 15);
    const isMartinBlackline = modelUpper.includes('BLACKLINE') || modelUpper.includes('X15') || modelUpper.includes('X12');
    const isJblControlWall = shape === 'wall' || modelUpper.includes('CONTROL 28') || modelUpper.includes('CONTROL 25');
    const isMartinSub = shape === 'subwoofer' && (modelUpper.includes('SX') || modelUpper.includes('MARTIN'));

    // A) 100V CEILING SPEAKER (e.g. JBL Control 26CT)
    if (shape === 'ceiling') {
      const cx = 38;
      const cy = 41;
      const rOuter = 27;
      return (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="xMidYMid meet"
          className="block select-none overflow-hidden"
        >
          <defs>
            <clipPath id={cabClipId}>
              <rect x={4} y={4} width={68} height={74} rx={4} />
            </clipPath>
            <clipPath id={specClipId}>
              <rect x={0} y={0} width={specBoxW - 6} height={56} />
            </clipPath>
          </defs>

          <rect x={2} y={2} width={VW - 4} height={VH - 4} rx={6} fill="#090d16" stroke="#334155" strokeWidth={1} />

          <g clipPath={`url(#${cabClipId})`}>
            {/* Dog-Ear Clamps */}
            <rect x={cx - rOuter - 4} y={cy - 3.5} width={5} height={7} rx={1} fill="#f59e0b" />
            <rect x={cx + rOuter - 1} y={cy - 3.5} width={5} height={7} rx={1} fill="#f59e0b" />
            {/* Circular Bezel & Cone */}
            <circle cx={cx} cy={cy} r={rOuter} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1.4} />
            <circle cx={cx} cy={cy} r={rOuter - 4} fill="#0f172a" stroke="#475569" strokeWidth={1} />
            {/* Coaxial Bridge & Tweeter */}
            <line x1={cx - rOuter + 5} y1={cy} x2={cx + rOuter - 5} y2={cy} stroke="#64748b" strokeWidth={2} />
            <circle cx={cx} cy={cy} r={7.5} fill="#090d16" stroke="#f59e0b" strokeWidth={1.2} />
            <circle cx={cx} cy={cy} r={3.5} fill="#fbbf24" />
          </g>

          <g transform={`translate(${specBoxX}, 13)`}>
            <rect x={0} y={0} width={specBoxW} height={56} rx={4} fill="#0f172a" stroke="#334155" strokeWidth={0.8} />
            <g clipPath={`url(#${specClipId})`}>
              <text x={7} y={15} fill="#fbbf24" fontSize={9.5} fontWeight="bold" fontFamily="monospace">
                {driverInch}" 동축 실링스피커
              </text>
              <text x={7} y={29} fill="#f8fafc" fontSize={9} fontFamily="monospace">
                100V 탭:{product.speaker?.tap100vWatts || 30}W · {product.speaker?.sensitivityDb}dB
              </text>
              <text x={7} y={43} fill="#38bdf8" fontSize={8.5} fontFamily="monospace">
                지향각:{product.speaker?.dispersionHorizontalDeg}° 원추형
              </text>
            </g>
          </g>
        </svg>
      );
    }

    // B) COLUMN LINE ARRAY SPEAKER (JBL CBT 70J-1 J-Array vs Standard Column)
    if (shape === 'column') {
      const isCbt70 = modelUpper.includes('CBT');
      return (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="xMidYMid meet"
          className="block select-none overflow-hidden"
        >
          <defs>
            <clipPath id={cabClipId}>
              <rect x={4} y={4} width={68} height={74} rx={4} />
            </clipPath>
            <clipPath id={specClipId}>
              <rect x={0} y={0} width={specBoxW - 6} height={56} />
            </clipPath>
          </defs>

          <rect x={2} y={2} width={VW - 4} height={VH - 4} rx={6} fill="#090d16" stroke="#1e293b" />

          <g clipPath={`url(#${cabClipId})`}>
            {isCbt70 ? (
              /* JBL CBT 70J-1: Simplified J-Curved Asymmetric Column (Left HF Row + Right 4 LF Woofers) */
              <g>
                <path
                  d="M 20,7 L 48,7 L 48,58 L 53,75 L 24,75 L 20,58 Z"
                  fill="#1e293b"
                  stroke="#38bdf8"
                  strokeWidth={1.4}
                />
                <path
                  d="M 23,10 L 45,10 L 45,58 L 49,72 L 26,72 L 23,58 Z"
                  fill="#020617"
                />
                {Array.from({ length: 8 }).map((_, idx) => (
                  <circle key={`hf-${idx}`} cx={28} cy={14 + idx * 7.8} r={1.8} fill="#38bdf8" />
                ))}
                {Array.from({ length: 4 }).map((_, idx) => (
                  <circle
                    key={`lf-${idx}`}
                    cx={38}
                    cy={16 + idx * 16}
                    r={4.8}
                    fill="#1e293b"
                    stroke="#f97316"
                    strokeWidth={1.1}
                  />
                ))}
              </g>
            ) : (
              /* Standard Vertical Column Array */
              <g>
                <rect x={24} y={7} width={26} height={68} rx={4} fill="#1e293b" stroke="#38bdf8" strokeWidth={1.3} />
                <rect x={27} y={10} width={20} height={62} rx={2} fill="#020617" />
                {Array.from({ length: 5 }).map((_, idx) => (
                  <circle
                    key={idx}
                    cx={37}
                    cy={16 + idx * 12.5}
                    r={4.2}
                    fill="#1e293b"
                    stroke="#38bdf8"
                    strokeWidth={1}
                  />
                ))}
              </g>
            )}
          </g>

          <g transform={`translate(${specBoxX}, 13)`}>
            <rect x={0} y={0} width={specBoxW} height={56} rx={4} fill="#0f172a" stroke="#1e293b" />
            <g clipPath={`url(#${specClipId})`}>
              <text x={7} y={15} fill="#38bdf8" fontSize={9.5} fontWeight="bold" fontFamily="monospace">
                {isCbt70 ? 'J-ARRAY (16HF+4LF)' : 'LINE ARRAY COLUMN'}
              </text>
              <text x={7} y={29} fill="#f8fafc" fontSize={9} fontFamily="monospace">
                {product.speaker?.rmsWatts}W·{product.speaker?.impedanceOhms}Ω·{product.speaker?.sensitivityDb}dB
              </text>
              <text x={7} y={43} fill="#94a3b8" fontSize={8.5} fontFamily="monospace">
                지향각:{product.speaker?.dispersionHorizontalDeg}°H×{product.speaker?.dispersionVerticalDeg}°V
              </text>
            </g>
          </g>
        </svg>
      );
    }

    // C) 18" SUBWOOFER CABINET (HK Audio FINEO FO S118 vs Martin Audio SX118)
    if (shape === 'subwoofer') {
      const cx = 39;
      const cy = isMartinSub ? 41 : 37;
      return (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="xMidYMid meet"
          className="block select-none overflow-hidden"
        >
          <defs>
            <clipPath id={cabClipId}>
              <rect x={4} y={4} width={68} height={74} rx={4} />
            </clipPath>
            <clipPath id={specClipId}>
              <rect x={0} y={0} width={specBoxW - 6} height={56} />
            </clipPath>
          </defs>

          <rect x={2} y={2} width={VW - 4} height={VH - 4} rx={6} fill="#090d16" stroke="#1e293b" />

          <g clipPath={`url(#${cabClipId})`}>
            {isMartinSub ? (
              /* Martin Audio SX118: Octagonal Chamfered Sub + 4 Corner Ports + 18" Cone */
              <g>
                <polygon
                  points="15,8 63,8 68,13 68,69 63,74 15,74 10,69 10,13"
                  fill="#1e293b"
                  stroke="#fb7185"
                  strokeWidth={1.4}
                />
                <rect x={14} y={12} width={50} height={58} rx={2} fill="#020617" />
                <polygon points="16,14 23,14 16,21" fill="#fb7185" />
                <polygon points="62,14 55,14 62,21" fill="#fb7185" />
                <polygon points="16,68 23,68 16,61" fill="#fb7185" />
                <polygon points="62,68 55,68 62,61" fill="#fb7185" />
                <circle cx={cx} cy={cy} r={19} fill="#0f172a" stroke="#fb7185" strokeWidth={1.4} />
                <circle cx={cx} cy={cy} r={6.5} fill="#090d16" stroke="#fda4af" strokeWidth={1.1} />
              </g>
            ) : (
              /* HK Audio FINEO FO S118: Square Install Sub + Upper 18" Cone + Bottom Slot Port */
              <g>
                <rect x={10} y={8} width={58} height={66} rx={3} fill="#1e293b" stroke="#f97316" strokeWidth={1.4} />
                <rect x={13.5} y={11.5} width={51} height={59} rx={2} fill="#020617" />
                <circle cx={cx} cy={cy} r={17.5} fill="#0f172a" stroke="#f97316" strokeWidth={1.4} />
                <circle cx={cx} cy={cy} r={6} fill="#090d16" stroke="#fb923c" strokeWidth={1} />
                <rect x={17} y={62} width={44} height={5.5} rx={1} fill="#090d16" stroke="#f97316" strokeWidth={0.9} />
              </g>
            )}
          </g>

          <g transform={`translate(${specBoxX}, 13)`}>
            <rect x={0} y={0} width={specBoxW} height={56} rx={4} fill="#0f172a" stroke="#431407" />
            <g clipPath={`url(#${specClipId})`}>
              <text x={7} y={15} fill={isMartinSub ? '#fb7185' : '#fb923c'} fontSize={9.5} fontWeight="bold" fontFamily="monospace">
                {driverInch}" SUB ({isMartinSub ? '4코너포트' : '하단슬롯'})
              </text>
              <text x={7} y={29} fill="#f8fafc" fontSize={9} fontFamily="monospace">
                {product.speaker?.rmsWatts}W RMS · {product.speaker?.impedanceOhms}Ω
              </text>
              <text x={7} y={43} fill="#fdba74" fontSize={8.5} fontFamily="monospace">
                감도 {product.speaker?.sensitivityDb}dB / 최대 {product.speaker?.maxSplDb}dB
              </text>
            </g>
          </g>
        </svg>
      );
    }

    // D) POINT-SOURCE & WALL LOUDSPEAKERS (Strictly Bounded inside x=[10..68], y=[6..76])
    const cabCx = 39;
    const cabCy = 41;
    const accentColor = isMartinCdd
      ? '#fb7185'
      : isTurboIq || isActive
      ? '#22d3ee'
      : isTurboNuq
      ? '#38bdf8'
      : is100v
      ? '#fbbf24'
      : isMartinBlackline
      ? '#f59e0b'
      : '#f97316';

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        className="block select-none overflow-hidden"
      >
        <defs>
          <clipPath id={cabClipId}>
            <rect x={4} y={4} width={68} height={74} rx={4} />
          </clipPath>
          <clipPath id={specClipId}>
            <rect x={0} y={0} width={specBoxW - 6} height={60} />
          </clipPath>
        </defs>

        <rect x={2} y={2} width={VW - 4} height={VH - 4} rx={6} fill="#090d16" stroke="#1e293b" />

        <g clipPath={`url(#${cabClipId})`}>
          {isMartinCdd ? (
            /* 1) Martin Audio CDD8 / CDD12: Curved Almond Shell + Single Center Coaxial CDD Driver */
            <g>
              <path
                d="M 19,8 Q 39,4 59,8 Q 66,41 59,74 Q 39,78 19,74 Q 12,41 19,8 Z"
                fill="#1e293b"
                stroke={accentColor}
                strokeWidth={1.5}
              />
              <path
                d="M 22,11 Q 39,8 56,11 Q 62,41 56,71 Q 39,74 22,71 Q 16,41 22,11 Z"
                fill="#020617"
              />
              <circle
                cx={cabCx}
                cy={cabCy}
                r={driverInch >= 12 ? 18 : 14.5}
                fill="#0f172a"
                stroke={accentColor}
                strokeWidth={1.4}
              />
              <polygon
                points={`${cabCx - 6},${cabCy - 6} ${cabCx + 6},${cabCy - 6} ${cabCx + 4},${cabCy + 6} ${cabCx - 4},${cabCy + 6}`}
                fill="#090d16"
                stroke="#fda4af"
                strokeWidth={1.1}
              />
              <circle cx={cabCx} cy={cabCy} r={2.6} fill="#fb7185" />
            </g>
          ) : isHkFineo ? (
            /* 2) HK Audio FINEO FO 8 / FO 12: Rectangular Box + Square Horn + Woofer + HK Orange Badge */
            <g>
              <rect
                x={driverInch <= 8 ? 16 : 13}
                y={7}
                width={driverInch <= 8 ? 46 : 52}
                height={68}
                rx={2.5}
                fill="#1e293b"
                stroke="#f97316"
                strokeWidth={1.5}
              />
              <rect
                x={driverInch <= 8 ? 19 : 16}
                y={10}
                width={driverInch <= 8 ? 40 : 46}
                height={62}
                rx={1.5}
                fill="#020617"
              />
              {/* Square Rotatable BEM Horn */}
              <rect x={cabCx - 10} y={13} width={20} height={17} rx={1.5} fill="#0f172a" stroke="#64748b" strokeWidth={1} />
              <circle cx={cabCx} cy={21.5} r={3} fill="#f97316" />
              {/* Orange HK Center Badge */}
              <rect x={cabCx - 4} y={33} width={8} height={3} rx={0.5} fill="#f97316" />
              {/* Lower LF Woofer */}
              <circle
                cx={cabCx}
                cy={54}
                r={driverInch >= 12 ? 14 : 11.5}
                fill="#0f172a"
                stroke="#f97316"
                strokeWidth={1.3}
              />
              <circle cx={cabCx} cy={54} r={4} fill="#090d16" stroke="#fb923c" strokeWidth={0.9} />
            </g>
          ) : isTurboNuq ? (
            /* 3) Turbosound NuQ102 / NuQ122: Multi-Angle Chamfered Wedge + Elliptical/Octagonal Waveguide */
            <g>
              <polygon
                points="20,7 58,7 65,17 63,65 58,75 20,75 15,65 13,17"
                fill="#1e293b"
                stroke="#38bdf8"
                strokeWidth={1.5}
              />
              <polygon
                points="22,10 56,10 61,18 59,64 56,72 22,72 19,64 17,18"
                fill="#020617"
              />
              <ellipse cx={cabCx} cy={22} rx={13} ry={8} fill="#0f172a" stroke="#38bdf8" strokeWidth={1.1} />
              <circle cx={cabCx} cy={22} r={3.2} fill="#7dd3fc" />
              <circle
                cx={cabCx}
                cy={53}
                r={driverInch >= 12 ? 14 : 12}
                fill="#0f172a"
                stroke="#38bdf8"
                strokeWidth={1.3}
              />
              <circle cx={cabCx} cy={53} r={4.2} fill="#0284c7" />
            </g>
          ) : isTurboIq || isActive ? (
            /* 4) Turbosound iQ12 Active DSP: Rounded Molded Polymer Shell + Cyan Side Ribs + Front LED Bar */
            <g>
              <rect x={14} y={7} width={50} height={68} rx={8} fill="#1e293b" stroke="#22d3ee" strokeWidth={1.5} />
              <rect x={17} y={10} width={44} height={62} rx={5} fill="#020617" />
              <polygon points="22,13 56,13 49,29 29,29" fill="#0f172a" stroke="#22d3ee" strokeWidth={1} />
              <circle cx={cabCx} cy={21} r={3} fill="#67e8f9" />
              <circle cx={cabCx} cy={51} r={13.5} fill="#0f172a" stroke="#22d3ee" strokeWidth={1.3} />
              <circle cx={cabCx} cy={51} r={4.2} fill="#083344" stroke="#67e8f9" strokeWidth={1} />
              <rect x={cabCx - 8} y={68} width={16} height={2} rx={1} fill="#22d3ee" />
            </g>
          ) : isJblSrx ? (
            /* 5) JBL SRX815: Wide Hex Touring Enclosure + Giant PT Horn + 15" Differential Woofer */
            <g>
              <polygon
                points="16,7 62,7 67,14 67,68 62,75 16,75 11,68 11,14"
                fill="#1e293b"
                stroke="#f97316"
                strokeWidth={1.5}
              />
              <rect x={15} y={10} width={48} height={62} rx={2} fill="#020617" />
              <rect x={18} y={12} width={42} height={19} rx={2} fill="#0f172a" stroke="#f97316" strokeWidth={1} />
              <rect x={cabCx - 5} y={19} width={10} height={5} rx={1} fill="#fb923c" />
              <circle cx={cabCx} cy={52} r={15.5} fill="#0f172a" stroke="#f97316" strokeWidth={1.5} />
              <circle cx={cabCx} cy={52} r={5.5} fill="#090d16" stroke="#fb923c" strokeWidth={1.1} />
            </g>
          ) : isMartinBlackline ? (
            /* 6) Martin Audio Blackline X15: Tapered Symmetric Trapezoid + Gold Accent + 15" Woofer */
            <g>
              <polygon
                points="14,7 64,7 66,18 61,75 17,75 12,18"
                fill="#1e293b"
                stroke="#f59e0b"
                strokeWidth={1.5}
              />
              <polygon
                points="17,10 61,10 62,18 58,72 20,72 16,18"
                fill="#020617"
              />
              <rect x={cabCx - 11} y={12} width={22} height={16} rx={1.5} fill="#0f172a" stroke="#f59e0b" strokeWidth={1} />
              <circle cx={cabCx} cy={20} r={3.2} fill="#fbbf24" />
              <circle cx={cabCx} cy={52} r={15} fill="#0f172a" stroke="#f59e0b" strokeWidth={1.4} />
              <circle cx={cabCx} cy={52} r={4.8} fill="#090d16" stroke="#fbbf24" strokeWidth={1} />
            </g>
          ) : isJblControlWall ? (
            /* 7) JBL Control 28-1: Left Wall-Mount Bracket + Tapered Wall Cabinet */
            <g>
              <rect x={7} y={30} width={3.5} height={22} rx={1} fill="#64748b" />
              <line x1={10.5} y1={41} x2={17} y2={41} stroke="#94a3b8" strokeWidth={2.5} />
              <polygon
                points="17,10 63,7 63,75 17,72"
                fill="#1e293b"
                stroke="#fbbf24"
                strokeWidth={1.4}
              />
              <rect x={20} y={12} width={39} height={58} rx={2.5} fill="#020617" />
              <rect x={23} y={15} width={33} height={15} rx={1.5} fill="#0f172a" stroke="#fbbf24" strokeWidth={0.9} />
              <circle cx={40} cy={22.5} r={2.8} fill="#fde047" />
              <circle cx={40} cy={52} r={11.5} fill="#0f172a" stroke="#fbbf24" strokeWidth={1.2} />
              <circle cx={40} cy={52} r={3.5} fill="#fbbf24" />
            </g>
          ) : (
            /* Default 2-Way Point Source */
            <g>
              <rect x={14} y={7} width={50} height={68} rx={4} fill="#1e293b" stroke={accentColor} strokeWidth={1.4} />
              <rect x={17} y={10} width={44} height={62} rx={2} fill="#020617" />
              <rect x={21} y={13} width={36} height={16} rx={1.5} fill="#0f172a" stroke="#475569" strokeWidth={0.9} />
              <circle cx={cabCx} cy={21} r={2.5} fill="#cbd5e1" />
              <circle cx={cabCx} cy={52} r={13.5} fill="#0f172a" stroke={accentColor} strokeWidth={1.3} />
            </g>
          )}
        </g>

        {/* Right Side Spec Box (Strictly Clipped) */}
        <g transform={`translate(${specBoxX}, 11)`}>
          <rect x={0} y={0} width={specBoxW} height={60} rx={4} fill="#0f172a" stroke="#1e293b" />
          <g clipPath={`url(#${specClipId})`}>
            <text x={7} y={14} fill="#f8fafc" fontSize={9.5} fontWeight="bold" fontFamily="monospace">
              {isMartinCdd
                ? `${driverInch}" CDD 동축스피커`
                : isHkFineo
                ? `${driverInch}" 독일 인스톨 2-Way`
                : isTurboNuq
                ? `${driverInch}" 컨버전스혼 2-Way`
                : isTurboIq || isActive
                ? `${driverInch}" 액티브 DSP 스피커`
                : isJblSrx
                ? `${driverInch}" PT혼 투어링 메인`
                : isMartinBlackline
                ? `${driverInch}" 고감도 사다리꼴`
                : isJblControlWall
                ? `${driverInch}" 벽부형 브래킷스피커`
                : `${driverInch}" 2-WAY SPEAKER`}
            </text>
            <text x={7} y={27} fill={accentColor} fontSize={9} fontWeight="bold" fontFamily="monospace">
              {product.speaker?.rmsWatts}W RMS · {product.speaker?.impedanceOhms ? `${product.speaker.impedanceOhms}Ω` : '100V'}
            </text>
            <text x={7} y={40} fill="#38bdf8" fontSize={8.5} fontFamily="monospace">
              감도 {product.speaker?.sensitivityDb}dB / 최대 {product.speaker?.maxSplDb}dB
            </text>
            <text x={7} y={53} fill="#94a3b8" fontSize={8.5} fontFamily="monospace">
              지향각 {product.speaker?.dispersionHorizontalDeg}°H×{product.speaker?.dispersionVerticalDeg}°V
            </text>
          </g>
        </g>
      </svg>
    );
  }

  // ============================================================================
  // 2. MIXER CONSOLE ARTWORK (Fixed Internal ViewBox: 236 x 52, Strict ClipPath)
  // ============================================================================
  if (product.category === 'mixer') {
    const VW = 236;
    const VH = 52;
    const clipId = `mix-clip-${uid}`;

    const isXenyx = modelUpper.includes('XENYX') || modelUpper.includes('1222');
    const isSignature = modelUpper.includes('SIGNATURE') || modelUpper.includes('SOUNDCRAFT');
    const isStudioLive = modelUpper.includes('STUDIOLIVE') || modelUpper.includes('PRESONUS') || modelUpper.includes('32SC');
    const isSq = modelUpper.includes('SQ') || modelUpper.includes('ALLEN') || modelUpper.includes('QU') || modelUpper.includes('AHM');

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        className="block select-none overflow-hidden"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={4} y={3} width={VW - 8} height={VH - 6} rx={4} />
          </clipPath>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          {isXenyx ? (
            /* A) Behringer XENYX X1222USB: Red Side Cheeks + 7 Knob/Fader Strips + GEQ Box + Red '24' FX Display */
            <g>
              <rect x={4} y={3} width={VW - 8} height={VH - 6} rx={4} fill="#1e293b" stroke="#dc2626" strokeWidth={1.3} />
              <rect x={4} y={3} width={7} height={VH - 6} fill="#991b1b" />
              <rect x={VW - 11} y={3} width={7} height={VH - 6} fill="#991b1b" />
              {Array.from({ length: 7 }).map((_, idx) => {
                const sx = 20 + idx * 17;
                return (
                  <g key={idx}>
                    <circle cx={sx} cy={11} r={2} fill="#3b82f6" />
                    <circle cx={sx} cy={18} r={2} fill="#ef4444" />
                    <circle cx={sx} cy={25} r={2} fill="#f97316" />
                    <line x1={sx} y1={30} x2={sx} y2={44} stroke="#020617" strokeWidth={1.6} />
                    <rect x={sx - 2.5} y={34 + (idx % 3) * 2} width={5} height={3} rx={0.6} fill="#f8fafc" />
                  </g>
                );
              })}
              {/* 7-Band GEQ & Red 7-Segment Display */}
              <rect x={144} y={8} width={44} height={16} rx={2} fill="#090d16" stroke="#475569" strokeWidth={0.8} />
              {Array.from({ length: 5 }).map((_, g) => (
                <line key={g} x1={151 + g * 7.5} y1={11} x2={151 + g * 7.5} y2={21} stroke="#38bdf8" strokeWidth={1.4} />
              ))}
              <rect x={193} y={8} width={26} height={16} rx={2} fill="#020617" stroke="#ef4444" strokeWidth={0.9} />
              <text x={206} y={19} textAnchor="middle" fill="#ef4444" fontSize={8.5} fontWeight="bold" fontFamily="monospace">
                FX24
              </text>
              {/* Red Master Faders */}
              <line x1={199} y1={28} x2={199} y2={44} stroke="#020617" strokeWidth={1.6} />
              <line x1={211} y1={28} x2={211} y2={44} stroke="#020617" strokeWidth={1.6} />
              <rect x={196.5} y={33} width={5} height={3.5} rx={0.6} fill="#ef4444" />
              <rect x={208.5} y={33} width={5} height={3.5} rx={0.6} fill="#ef4444" />
            </g>
          ) : isSignature ? (
            /* B) Soundcraft Signature 16: Metallic Blue Chassis + 10 Strips + Lexicon LCD + Yellow/Red Faders */
            <g>
              <rect x={4} y={3} width={VW - 8} height={VH - 6} rx={4} fill="#172554" stroke="#3b82f6" strokeWidth={1.4} />
              <rect x={9} y={5} width={VW - 18} height={VH - 10} rx={2} fill="#0f172a" />
              {Array.from({ length: 10 }).map((_, idx) => {
                const sx = 18 + idx * 14;
                return (
                  <g key={idx}>
                    <circle cx={sx} cy={11} r={1.8} fill="#38bdf8" />
                    <circle cx={sx} cy={17} r={1.8} fill="#2dd4bf" />
                    <circle cx={sx} cy={23} r={1.8} fill="#ef4444" />
                    <line x1={sx} y1={28} x2={sx} y2={43} stroke="#020617" strokeWidth={1.5} />
                    <rect x={sx - 2.2} y={32 + (idx % 3) * 2.5} width={4.4} height={3} rx={0.6} fill="#e2e8f0" />
                  </g>
                );
              })}
              <rect x={162} y={8} width={38} height={14} rx={1.5} fill="#0284c7" stroke="#7dd3fc" strokeWidth={0.8} />
              <text x={181} y={17.5} textAnchor="middle" fill="#e0f2fe" fontSize={7} fontWeight="bold" fontFamily="monospace">
                LEXICON
              </text>
              <rect x={206} y={8} width={4} height={16} rx={1} fill="#22c55e" />
              <rect x={213} y={8} width={4} height={16} rx={1} fill="#22c55e" />
              {[170, 182, 196, 208].map((fx, fIdx) => (
                <g key={fIdx}>
                  <line x1={fx} y1={27} x2={fx} y2={43} stroke="#020617" strokeWidth={1.5} />
                  <rect x={fx - 2.2} y={32} width={4.4} height={3} rx={0.6} fill={fIdx < 2 ? '#facc15' : '#ef4444'} />
                </g>
              ))}
            </g>
          ) : isStudioLive ? (
            /* C) PreSonus StudioLive 32SC: Left Fat Channel Encoder Strip + Right Touch Display + RGB Scribble Faders */
            <g>
              <rect x={4} y={3} width={VW - 8} height={VH - 6} rx={5} fill="#0f172a" stroke="#38bdf8" strokeWidth={1.3} />
              <rect x={12} y={7} width={132} height={14} rx={2} fill="#020617" stroke="#1e293b" />
              {Array.from({ length: 8 }).map((_, idx) => (
                <circle key={idx} cx={22 + idx * 15} cy={14} r={2.8} fill="#1e293b" stroke="#06b6d4" strokeWidth={1} />
              ))}
              <rect x={150} y={7} width={72} height={14} rx={2} fill="#0284c7" stroke="#7dd3fc" strokeWidth={0.9} />
              <polyline points="154,18 168,11 184,15 202,9 218,13" fill="none" stroke="#fde047" strokeWidth={1.3} />
              {Array.from({ length: 12 }).map((_, idx) => {
                const sx = 16 + idx * 15.5;
                const cols = ['#06b6d4', '#3b82f6', '#8b55f7', '#10b981'];
                return (
                  <g key={idx}>
                    <rect x={sx - 4} y={24} width={8} height={3} rx={0.5} fill={cols[idx % 4]} />
                    <line x1={sx} y1={29} x2={sx} y2={44} stroke="#020617" strokeWidth={1.5} />
                    <rect x={sx - 2.4} y={33 + (idx % 3) * 2.5} width={4.8} height={3} rx={0.6} fill="#cbd5e1" />
                  </g>
                );
              })}
              <rect x={208} y={24} width={9} height={3} rx={0.5} fill="#f43f5e" />
              <line x1={212.5} y1={29} x2={212.5} y2={44} stroke="#020617" strokeWidth={1.6} />
              <rect x={209.5} y={32} width={6} height={3.5} rx={0.6} fill="#f8fafc" />
            </g>
          ) : isSq ? (
            /* D) Allen & Heath SQ-5: Top Light-Bar Hood + Upper-Left Touchscreen + Upper-Right Chrome Encoders + Pastel Strips */
            <g>
              <polygon
                points={`10,3 ${VW - 10},3 ${VW - 4},12 ${VW - 4},${VH - 3} 4,${VH - 3} 4,12`}
                fill="#0f172a"
                stroke="#38bdf8"
                strokeWidth={1.4}
              />
              <line x1={14} y1={5.5} x2={VW - 14} y2={5.5} stroke="#a855f7" strokeWidth={2} />
              {/* Left 7" Touchscreen */}
              <rect x={14} y={8} width={58} height={14} rx={2} fill="#042f2e" stroke="#2dd4bf" strokeWidth={1} />
              <polyline points="18,19 30,12 44,16 58,10 68,13" fill="none" stroke="#5eead4" strokeWidth={1.3} />
              {/* Right Rotary Encoders */}
              {Array.from({ length: 7 }).map((_, idx) => (
                <circle key={idx} cx={84 + idx * 19} cy={15} r={3} fill="#1e293b" stroke="#e2e8f0" strokeWidth={1} />
              ))}
              {/* 13 Faders with Pastel Scribble Strips */}
              {Array.from({ length: 13 }).map((_, idx) => {
                const sx = 16 + idx * 16.8;
                const lcdCol = idx < 5 ? '#38bdf8' : idx < 9 ? '#a855f7' : idx < 12 ? '#4ade80' : '#f43f5e';
                return (
                  <g key={idx}>
                    <rect x={sx - 4.5} y={25} width={9} height={3} rx={0.5} fill={lcdCol} />
                    <line x1={sx} y1={30} x2={sx} y2={44} stroke="#020617" strokeWidth={1.5} />
                    <rect x={sx - 2.5} y={33 + (idx % 3) * 2.5} width={5} height={3.2} rx={0.6} fill="#f8fafc" />
                  </g>
                );
              })}
            </g>
          ) : (
            /* E) Behringer X32: Silver Touring Side Handles + Left Input Bank / Right DCA-Bus Bank + Right TFT Screen */
            <g>
              <rect x={4} y={3} width={VW - 8} height={VH - 6} rx={3} fill="#0f172a" stroke="#64748b" strokeWidth={1.3} />
              <rect x={4} y={3} width={7} height={VH - 6} fill="#94a3b8" />
              <rect x={VW - 11} y={3} width={7} height={VH - 6} fill="#94a3b8" />
              {/* Upper-Left Channel Strip & Upper-Right 7" TFT Screen */}
              <rect x={15} y={7} width={114} height={14} rx={2} fill="#020617" stroke="#334155" strokeWidth={0.8} />
              {Array.from({ length: 6 }).map((_, idx) => (
                <circle key={idx} cx={25 + idx * 18} cy={14} r={2.5} fill="#1e293b" stroke="#fb923c" strokeWidth={0.9} />
              ))}
              <rect x={135} y={7} width={84} height={14} rx={2} fill="#090d16" stroke="#f59e0b" strokeWidth={1} />
              <polyline points="140,18 156,11 174,15 194,9 214,13" fill="none" stroke="#fde047" strokeWidth={1.3} />
              {/* Left 8 Input Faders */}
              {Array.from({ length: 8 }).map((_, idx) => {
                const sx = 18 + idx * 13.5;
                return (
                  <g key={`in-${idx}`}>
                    <rect x={sx - 3.8} y={25} width={7.6} height={3} rx={0.5} fill={idx < 4 ? '#f59e0b' : '#38bdf8'} />
                    <line x1={sx} y1={30} x2={sx} y2={44} stroke="#020617" strokeWidth={1.5} />
                    <rect x={sx - 2.3} y={34 + (idx % 3) * 2} width={4.6} height={3} rx={0.6} fill="#e2e8f0" />
                  </g>
                );
              })}
              <line x1={128} y1={24} x2={128} y2={45} stroke="#475569" strokeWidth={1.5} />
              {/* Right 6 DCA/Bus + Master Faders */}
              {Array.from({ length: 6 }).map((_, idx) => {
                const sx = 138 + idx * 15;
                const isMaster = idx === 5;
                return (
                  <g key={`bus-${idx}`}>
                    <rect x={sx - 3.8} y={25} width={7.6} height={3} rx={0.5} fill={isMaster ? '#ef4444' : '#10b981'} />
                    <line x1={sx} y1={30} x2={sx} y2={44} stroke="#020617" strokeWidth={1.5} />
                    <rect x={sx - 2.4} y={isMaster ? 32 : 35} width={4.8} height={3.2} rx={0.6} fill={isMaster ? '#ef4444' : '#cbd5e1'} />
                  </g>
                );
              })}
            </g>
          )}
        </g>
      </svg>
    );
  }

  // ============================================================================
  // 3. POWER AMPLIFIER ARTWORK (Fixed Internal ViewBox: 236 x 52, Strict ClipPath)
  // ============================================================================
  if (product.category === 'amplifier') {
    const VW = 236;
    const VH = 52;
    const clipId = `amp-clip-${uid}`;

    const isPowersoft = modelUpper.includes('POWERSOFT') || modelUpper.includes('QUATTROCANALI') || product.rackUnits === 1;
    const isJblVma = modelUpper.includes('VMA') || (modelUpper.includes('JBL') && product.amplifier?.supports100v);
    const isCrownCdi = modelUpper.includes('CDI');
    const isCrownXti = modelUpper.includes('XTI');
    const isHighPowerXti = modelUpper.includes('6002');

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        className="block select-none overflow-hidden"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={4} y={5} width={VW - 8} height={VH - 10} rx={3} />
          </clipPath>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          {isPowersoft ? (
            /* A) Powersoft Quattrocanali 4804 / 2404 DSP+D: 1U Slim Rack + Angled Vents + Center 4-Ch Matrix LED */
            <g>
              <rect x={4} y={12} width={8} height={28} rx={1.5} fill="#334155" stroke="#475569" />
              <rect x={VW - 12} y={12} width={8} height={28} rx={1.5} fill="#334155" stroke="#475569" />
              <rect x={12} y={12} width={VW - 24} height={28} rx={2} fill="#090d16" stroke="#22d3ee" strokeWidth={1.3} />
              <polygon points="18,16 82,16 76,36 18,36" fill="#1e293b" />
              <line x1={79} y1={16} x2={73} y2={36} stroke="#22d3ee" strokeWidth={2} />
              <polygon points="154,16 218,16 218,36 160,36" fill="#1e293b" />
              <line x1={157} y1={16} x2={163} y2={36} stroke="#f97316" strokeWidth={2} />
              {/* Center 4-Channel LED Bars */}
              {[0, 1, 2, 3].map((ch) => (
                <g key={ch} transform={`translate(${90 + ch * 14}, 17)`}>
                  <rect x={0} y={0} width={9} height={5} rx={1} fill="#22c55e" />
                  <rect x={0} y={7} width={9} height={5} rx={1} fill="#22d3ee" />
                  <rect x={0} y={14} width={9} height={4} rx={1} fill="#38bdf8" />
                </g>
              ))}
            </g>
          ) : isJblVma ? (
            /* B) JBL VMA 1240: 5 Green-Halo Input Knobs + Media LCD + Master Knob */
            <g>
              <rect x={4} y={6} width={8} height={40} rx={1.5} fill="#334155" stroke="#475569" />
              <rect x={VW - 12} y={6} width={8} height={40} rx={1.5} fill="#334155" stroke="#475569" />
              <rect x={12} y={6} width={VW - 24} height={40} rx={2.5} fill="#0f172a" stroke="#f59e0b" strokeWidth={1.3} />
              {Array.from({ length: 5 }).map((_, idx) => (
                <circle key={idx} cx={28 + idx * 23} cy={26} r={6.8} fill="#020617" stroke="#22c55e" strokeWidth={1.4} />
              ))}
              <rect x={142} y={15} width={40} height={22} rx={2} fill="#083344" stroke="#38bdf8" strokeWidth={1} />
              <text x={162} y={29} textAnchor="middle" fill="#67e8f9" fontSize={7.5} fontWeight="bold" fontFamily="monospace">
                100V/BT
              </text>
              <circle cx={204} cy={26} r={9.5} fill="#020617" stroke="#f59e0b" strokeWidth={1.6} />
            </g>
          ) : isCrownCdi ? (
            /* C) Crown CDi 4|300: Left Louver Grille + Center Blue LCD + 4-Ch Meters + Right Encoder Wheel */
            <g>
              <rect x={4} y={6} width={8} height={40} rx={1.5} fill="#334155" stroke="#475569" />
              <rect x={VW - 12} y={6} width={8} height={40} rx={1.5} fill="#334155" stroke="#475569" />
              <rect x={12} y={6} width={VW - 24} height={40} rx={2.5} fill="#090d16" stroke="#fbbf24" strokeWidth={1.3} />
              {[0, 1, 2, 3].map((r) => (
                <rect key={r} x={18} y={13 + r * 7.5} width={74} height={3} rx={1} fill="#1e293b" />
              ))}
              <rect x={100} y={14} width={46} height={24} rx={2} fill="#1e3a8a" stroke="#38bdf8" strokeWidth={1} />
              <text x={123} y={29} textAnchor="middle" fill="#bae6fd" fontSize={7.5} fontWeight="bold" fontFamily="monospace">
                CDi 4CH
              </text>
              {[0, 1, 2, 3].map((ch) => (
                <rect key={ch} x={154 + ch * 9} y={15} width={5} height={22} rx={1} fill="#22c55e" />
              ))}
              <circle cx={206} cy={26} r={8.5} fill="#1e293b" stroke="#94a3b8" strokeWidth={1.3} />
            </g>
          ) : isCrownXti ? (
            /* D) Crown XTi 4002 / XTi 6002: Curved Honeycomb Side Grilles + Center Blue LCD + Dual Knobs */
            <g>
              <rect x={4} y={6} width={8} height={40} rx={1.5} fill="#475569" stroke="#64748b" />
              <rect x={VW - 12} y={6} width={8} height={40} rx={1.5} fill="#475569" stroke="#64748b" />
              <rect
                x={12}
                y={6}
                width={VW - 24}
                height={40}
                rx={3}
                fill="#1e293b"
                stroke={isHighPowerXti ? '#38bdf8' : '#f97316'}
                strokeWidth={1.4}
              />
              <path d="M 18,12 L 66,12 Q 74,26 66,40 L 18,40 Z" fill="#090d16" stroke="#475569" />
              <path d="M 218,12 L 170,12 Q 162,26 170,40 L 218,40 Z" fill="#090d16" stroke="#475569" />
              <circle cx={84} cy={26} r={6.5} fill="#090d16" stroke="#fb923c" strokeWidth={1.3} />
              <rect x={95} y={14} width={46} height={24} rx={2} fill="#0284c7" stroke="#7dd3fc" strokeWidth={1} />
              <text x={118} y={29} textAnchor="middle" fill="#f0f9ff" fontSize={7.5} fontWeight="bold" fontFamily="monospace">
                {isHighPowerXti ? 'XTi 6002' : 'XTi 4002'}
              </text>
              <circle cx={152} cy={26} r={6.5} fill="#090d16" stroke="#fb923c" strokeWidth={1.3} />
            </g>
          ) : (
            /* E) Crown XLi 1500: Diagonal Side Vents + Center Plate with Two Large Analog Knobs */
            <g>
              <rect x={4} y={6} width={8} height={40} rx={1.5} fill="#334155" stroke="#475569" />
              <rect x={VW - 12} y={6} width={8} height={40} rx={1.5} fill="#334155" stroke="#475569" />
              <rect x={12} y={6} width={VW - 24} height={40} rx={2.5} fill="#0f172a" stroke="#f97316" strokeWidth={1.3} />
              {[0, 1, 2, 3, 4].map((i) => (
                <g key={i}>
                  <line x1={22 + i * 9} y1={13} x2={18 + i * 9} y2={39} stroke="#020617" strokeWidth={3.5} />
                  <line x1={174 + i * 9} y1={13} x2={170 + i * 9} y2={39} stroke="#020617" strokeWidth={3.5} />
                </g>
              ))}
              <rect x={74} y={10} width={88} height={32} rx={3} fill="#020617" stroke="#334155" strokeWidth={1} />
              {[98, 138].map((kx, idx) => (
                <g key={idx}>
                  <circle cx={kx} cy={26} r={8.5} fill="#1e293b" stroke="#f97316" strokeWidth={1.4} />
                  <circle cx={kx} cy={26} r={3.5} fill="#090d16" />
                </g>
              ))}
            </g>
          )}
        </g>
      </svg>
    );
  }

  // ============================================================================
  // 4. DSP / PROCESSOR ARTWORK (Fixed Internal ViewBox: 236 x 52, Strict ClipPath)
  // ============================================================================
  if (product.category === 'dsp') {
    const VW = 236;
    const VH = 52;
    const clipId = `dsp-clip-${uid}`;
    const isMartinDx = modelUpper.includes('DX4') || modelUpper.includes('MARTIN');
    const isBssBlu = modelUpper.includes('BLU') || modelUpper.includes('BSS');

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        className="block select-none overflow-hidden"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={4} y={8} width={VW - 8} height={VH - 16} rx={4} />
          </clipPath>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          {isBssBlu ? (
            /* BSS Soundweb London BLU-100: Clean Contained Teal Badge + Simplified 7x3 LED Matrix Strictly Inside Box */
            <g>
              <rect x={4} y={8} width={VW - 8} height={VH - 16} rx={4} fill="#0f172a" stroke="#14b8a6" strokeWidth={1.4} />
              <polygon points="10,14 64,14 56,38 10,38" fill="#134e4a" />
              <text x={35} y={28} textAnchor="middle" fill="#5eead4" fontSize={8} fontWeight="bold" fontFamily="monospace">
                BLU-100
              </text>
              {Array.from({ length: 7 }).map((_, col) => {
                const cx = 78 + col * 18;
                return (
                  <g key={col}>
                    <circle cx={cx} cy={20} r={2.0} fill="#22c55e" />
                    <circle cx={cx} cy={26} r={2.0} fill="#eab308" />
                    <circle cx={cx} cy={32} r={2.0} fill="#06b6d4" />
                  </g>
                );
              })}
            </g>
          ) : isMartinDx ? (
            /* Martin Audio DX4.0: Crimson Frame + Left Blue LCD + 8 Contained Channel Meters */
            <g>
              <rect x={4} y={8} width={VW - 8} height={VH - 16} rx={4} fill="#090d16" stroke="#fb7185" strokeWidth={1.4} />
              <rect x={12} y={13} width={66} height={26} rx={2} fill="#1e3a8a" stroke="#38bdf8" strokeWidth={1} />
              <text x={45} y={29} textAnchor="middle" fill="#e0f2fe" fontSize={8} fontWeight="bold" fontFamily="monospace">
                DX4.0 FIR
              </text>
              {Array.from({ length: 8 }).map((_, i) => (
                <rect
                  key={i}
                  x={88 + i * 16}
                  y={15}
                  width={9}
                  height={22}
                  rx={1.5}
                  fill={i < 4 ? '#38bdf8' : '#fb7185'}
                />
              ))}
            </g>
          ) : (
            /* dbx DriveRack PA2: Emerald Frame + Left RTA Curve LCD + 6 Meter Bars + Right Wheel */
            <g>
              <rect x={4} y={8} width={VW - 8} height={VH - 16} rx={4} fill="#0f172a" stroke="#10b981" strokeWidth={1.4} />
              <rect x={12} y={13} width={78} height={26} rx={2} fill="#022c22" stroke="#10b981" strokeWidth={1} />
              <path d="M 17,30 Q 34,17 51,26 T 85,22" fill="none" stroke="#34d399" strokeWidth={1.6} />
              {Array.from({ length: 6 }).map((_, i) => (
                <rect
                  key={i}
                  x={98 + i * 14}
                  y={15}
                  width={8}
                  height={22}
                  rx={1.5}
                  fill={i < 2 ? '#38bdf8' : '#10b981'}
                />
              ))}
              <circle cx={206} cy={26} r={8.5} fill="#1e293b" stroke="#34d399" strokeWidth={1.4} />
            </g>
          )}
        </g>
      </svg>
    );
  }

  // ============================================================================
  // 5. NETWORK / DANTE STAGEBOX & SWITCH ARTWORK (Fixed Internal ViewBox: 236 x 52)
  // ============================================================================
  if (product.category === 'network') {
    const VW = 236;
    const VH = 52;
    const clipId = `net-clip-${uid}`;
    const isStagebox = modelUpper.includes('DT168') || modelUpper.includes('STAGE') || modelUpper.includes('DL16') || modelUpper.includes('S16');

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        className="block select-none overflow-hidden"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={4} y={6} width={VW - 8} height={VH - 12} rx={4} />
          </clipPath>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          {isStagebox ? (
            /* Allen & Heath DT168 Stagebox: Side Bumpers + 8x2 Blue XLR Inputs + 4x2 Orange XLR Outputs */
            <g>
              <rect x={4} y={6} width={VW - 8} height={VH - 12} rx={4} fill="#0f172a" stroke="#a855f7" strokeWidth={1.4} />
              <rect x={4} y={6} width={9} height={VH - 12} fill="#334155" />
              <rect x={VW - 13} y={6} width={9} height={VH - 12} fill="#334155" />
              {Array.from({ length: 8 }).map((_, c) => (
                <g key={`in-${c}`}>
                  <circle cx={26 + c * 15} cy={19} r={4.8} fill="#020617" stroke="#38bdf8" strokeWidth={1.1} />
                  <circle cx={26 + c * 15} cy={33} r={4.8} fill="#020617" stroke="#38bdf8" strokeWidth={1.1} />
                </g>
              ))}
              {Array.from({ length: 4 }).map((_, c) => (
                <g key={`out-${c}`}>
                  <circle cx={156 + c * 15} cy={19} r={4.8} fill="#020617" stroke="#f97316" strokeWidth={1.1} />
                  <circle cx={156 + c * 15} cy={33} r={4.8} fill="#020617" stroke="#f97316" strokeWidth={1.1} />
                </g>
              ))}
            </g>
          ) : (
            /* Netgear AV M4250 1U Dante Switch */
            <g>
              <rect x={4} y={8} width={VW - 8} height={VH - 16} rx={4} fill="#0f172a" stroke="#8b5cf6" strokeWidth={1.4} />
              {Array.from({ length: 8 }).map((_, i) => (
                <g key={i} transform={`translate(${16 + i * 26}, 15)`}>
                  <rect x={0} y={0} width={18} height={14} rx={1.5} fill="#020617" stroke="#64748b" strokeWidth={1} />
                  <circle cx={4} cy={4} r={1.5} fill="#22c55e" />
                  <circle cx={14} cy={4} r={1.5} fill="#f59e0b" />
                  <rect x={5} y={17} width={8} height={4} rx={1} fill="#a855f7" />
                </g>
              ))}
            </g>
          )}
        </g>
      </svg>
    );
  }

  // ============================================================================
  // 6. SOURCES & MICROPHONES ARTWORK (Fixed Internal ViewBox: 236 x 52, Strict ClipPath)
  // ============================================================================
  const VW = 236;
  const VH = 52;
  const srcClipId = `src-clip-${uid}`;
  const isGooseneck = modelUpper.includes('MX418') || modelUpper.includes('GOOSENECK') || product.name.includes('구즈넥');
  const isWiredMic = modelUpper.includes('SM58-LC') || modelUpper.includes('SM57') || product.name.includes('유선마이크');
  const isDiBox = modelUpper.includes('PROAV') || modelUpper.includes('RADIAL') || product.name.includes('DI박스');
  const isMediaPlayer = modelUpper.includes('DN-300') || modelUpper.includes('DENON') || product.name.includes('미디어플레이어');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet"
      className="block select-none overflow-hidden"
    >
      <defs>
        <clipPath id={srcClipId}>
          <rect x={4} y={6} width={VW - 8} height={VH - 12} rx={4} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${srcClipId})`}>
        {isGooseneck ? (
          <g>
            <rect x={4} y={6} width={VW - 8} height={VH - 12} rx={4} fill="#090d16" stroke="#38bdf8" strokeWidth={1.2} />
            <polygon points="22,42 64,42 57,32 29,32" fill="#1e293b" stroke="#64748b" strokeWidth={1.1} />
            <path d="M 43,32 Q 43,14 82,16" fill="none" stroke="#94a3b8" strokeWidth={2.5} strokeLinecap="round" />
            <rect x={80} y={12} width={13} height={7} rx={3.5} fill="#38bdf8" />
            <text x={108} y={25} fill="#38bdf8" fontSize={9.5} fontWeight="bold" fontFamily="monospace">
              GOOSENECK MIC
            </text>
            <text x={108} y={37} fill="#94a3b8" fontSize={8.5} fontFamily="monospace">
              18" 구즈넥 · +48V
            </text>
          </g>
        ) : isWiredMic ? (
          <g>
            <rect x={4} y={6} width={VW - 8} height={VH - 12} rx={4} fill="#090d16" stroke="#38bdf8" strokeWidth={1.2} />
            <polygon points="20,22 64,19 64,33 20,30" fill="#334155" stroke="#64748b" strokeWidth={1.1} />
            <circle cx={72} cy={26} r={10.5} fill="#94a3b8" stroke="#e2e8f0" strokeWidth={1.2} />
            <text x={98} y={25} fill="#f8fafc" fontSize={9.5} fontWeight="bold" fontFamily="monospace">
              DYNAMIC VOCAL MIC
            </text>
            <text x={98} y={37} fill="#38bdf8" fontSize={8.5} fontFamily="monospace">
              카디오이드 · XLR
            </text>
          </g>
        ) : isDiBox ? (
          <g>
            <rect x={14} y={8} width={VW - 28} height={VH - 16} rx={4} fill="#064e3b" stroke="#10b981" strokeWidth={1.4} />
            <circle cx={38} cy={26} r={5.5} fill="#090d16" stroke="#34d399" strokeWidth={1.2} />
            <circle cx={56} cy={26} r={5.5} fill="#090d16" stroke="#34d399" strokeWidth={1.2} />
            <text x={136} y={29} textAnchor="middle" fill="#6ee7b7" fontSize={9.5} fontWeight="bold" fontFamily="monospace">
              STEREO PASSIVE DI BOX
            </text>
          </g>
        ) : isMediaPlayer ? (
          <g>
            <rect x={4} y={8} width={VW - 8} height={VH - 16} rx={4} fill="#0f172a" stroke="#38bdf8" strokeWidth={1.3} />
            <rect x={14} y={14} width={5} height={24} rx={2} fill="#38bdf8" />
            <rect x={28} y={24} width={72} height={4} rx={1.5} fill="#020617" stroke="#64748b" strokeWidth={0.9} />
            <rect x={110} y={14} width={76} height={24} rx={2} fill="#083344" stroke="#22d3ee" strokeWidth={0.9} />
            <text x={148} y={29} textAnchor="middle" fill="#67e8f9" fontSize={8} fontWeight="bold" fontFamily="monospace">
              BT / CD / USB
            </text>
            <circle cx={206} cy={26} r={7.5} fill="#1e293b" stroke="#38bdf8" strokeWidth={1.2} />
          </g>
        ) : (
          /* Shure SLXD24D Dual Wireless Receiver + 2 Contained Handheld Mics */
          <g>
            <rect x={4} y={8} width={VW - 8} height={VH - 16} rx={4} fill="#0f172a" stroke="#06b6d4" strokeWidth={1.3} />
            <rect x={12} y={13} width={72} height={26} rx={2} fill="#083344" stroke="#22d3ee" strokeWidth={0.9} />
            <text x={48} y={24} textAnchor="middle" fill="#67e8f9" fontSize={8} fontWeight="bold" fontFamily="monospace">
              CH1 WIRELESS
            </text>
            <text x={48} y={34} textAnchor="middle" fill="#a5f3fc" fontSize={7.2} fontFamily="monospace">
              RF ████ AF ███
            </text>

            <rect x={92} y={13} width={72} height={26} rx={2} fill="#083344" stroke="#22d3ee" strokeWidth={0.9} />
            <text x={128} y={24} textAnchor="middle" fill="#67e8f9" fontSize={8} fontWeight="bold" fontFamily="monospace">
              CH2 WIRELESS
            </text>
            <text x={128} y={34} textAnchor="middle" fill="#a5f3fc" fontSize={7.2} fontFamily="monospace">
              RF ████ AF ███
            </text>

            {[180, 204].map((mx, i) => (
              <g key={i}>
                <rect x={mx} y={22} width={6} height={15} rx={2} fill="#334155" stroke="#94a3b8" strokeWidth={0.8} />
                <circle cx={mx + 3} cy={18} r={4.5} fill="#cbd5e1" stroke="#38bdf8" strokeWidth={0.9} />
              </g>
            ))}
          </g>
        )}
      </g>
    </svg>
  );
};
