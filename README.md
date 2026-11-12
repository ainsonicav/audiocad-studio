# AudioCAD Studio (오디오시스템다이어그램)

> **프로 음향 시스템 전문 2D CAD 신호계통도 · 3D SPL 음압 시뮬레이터 · 장비 카탈로그 자동분석 플랫폼**
> 서비스 URL: https://ainsonicav.github.io/audiocad-studio/

---

## 🎧 주요 기능

1. **실물형 단자·배선 기반 2D 신호계통도 (Signal Flow Canvas)**
   - **XLR / Speakon NL4 / 100V Terminal / Dante RJ45** 등 신호 규격별 단자 포인트 및 전용 케이블 비주얼 스타일 제공.
   - **비교차(Non-Crossing) 리버 라우팅**: 케이블 간 불필요한 겹침을 최소화하는 자동 레인 배치.
   - **반원형 입체 브릿지 점프 아치 (`⌒`)**: 라인이 불가피하게 교차할 때 전기 도면 표준 8px 반원 점프 아치 및 다크 컷아웃 백킹 마스크 적용.
   - **포트 핀 0px 스냅 도킹**: 화살표 촉과 포트 단자가 자석처럼 정확히 0px 오차로 체결되는 도킹 스냅 링 렌더링.
   - **케이블 핸들 드래그 재배선**: 선의 양 끝점을 잡아 다른 포트로 이동(Rewiring), 실시간 호환성 피드백(초록 펄스 vs 흐리게 차단) 및 오결선 방지.
   - **포트 가득 참 시 상위 모델 자동 교체**: 목표 장비의 포트가 가득 차면 기존 결선을 100% 보존하면서 상위 호환 모델(8ch → 16ch 믹서, 2ch → 4ch 앰프 등)로 자동 스왑.

2. **브랜드 카탈로그 파일 업로드 & 지능형 음향 물리 사양 자동 파악**
   - **다양한 파일 형식 지원**: PDF 카탈로그/브로셔, CSV/Excel 제품표, 텍스트/마크다운, 스펙 텍스트 복사·붙여넣기 지원.
   - **브랜드 자동 매칭**: JBL, Crown, Soundcraft, Martin Audio, HK Audio, Turbosound, Powersoft, Allen & Heath, Behringer, Shure, Sennheiser, Yamaha 등 50여 개 프로 브랜드 자동 감지.
   - **음향 물리 사양 정밀 추출**: 우퍼 인치, RMS W, 임피던스(4/8/16Ω/100V), 감도(dB SPL @ 1W/1m), 수평/수직 지향각($H^\circ \times V^\circ$), 앰프 채널수 및 출력, 믹서 입력수 및 입출력 단자 세트 자동 생성.
   - **원클릭 일괄 등록**: 파악된 제품 목록을 검토 후 즉시 라이브러리에 영구 반영.

3. **3D 공간 음향 SPL 음압 시뮬레이터 (Acoustic Room Simulator)**
   - 공간 치수(가로×세로×천장고), 4대 내장재(콘크리트, 석고보드, 목재, 흡음 패널) 잔향 시간($RT_{60}$) 시뮬레이션.
   - 스피커 3D 공간 배치(X, Y, Z, 지향각, 틸트각) 및 역제곱 법칙 기반 실시간 청취면 음압 분포도(Heatmap) 렌더링.
   - 위상 간섭(Phase Interference) 및 1/1 옥타브 밴드(125Hz ~ 8kHz) 주파수별 음압 분석.

4. **전기적 임피던스 & 앰프 매칭 물리 엔진**
   - 파워앰프 채널별 Low-Z 병렬 합성 임피던스 계산 및 최적 부하 안전성(과부하/안전) 실시간 감시.
   - 100V 하이임피던스 트랜스포머 탭 용량 합산 및 과입력 방지.

5. **내역서(BOM) 및 2D CAD 도면 시트 출력**
   - 소요 케이블(길이별·커넥터별) 및 장비 내역서(단가, 수량, 합계 견적) 자동 집계.
   - 관공서/시공 납품용 표준 표제란이 포함된 2D CAD 도면 시트 인쇄 및 PDF 내보내기 지원.

---

## 🛠️ 기술 스택

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite v6
- **Graphics & Visuals**: Pure SVG, HTML5 Canvas, DeviceSvgArtwork Hardware Chassis Renderer
- **Deployment**: GitHub Pages (GitHub Actions CI/CD)

---

## 🚀 로컬 개발 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (localhost:5173)
npm run dev

# 프로덕션 빌드
npm run build
```

---

## 📄 라이선스

© 2026 Ainsonic. All Rights Reserved.
