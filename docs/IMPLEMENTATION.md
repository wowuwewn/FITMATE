# Fitmate 현재 구현

현재 3차 홈·즉시 분석 조합함·카테고리·목업·내 정보와 추가 AI 설명 구현은 [3차 기록](./UX_V3.md), [AI 연결 안내](./AI_ASSISTANT.md)를 참고하세요. 아래는 2차 구현 당시의 기록입니다.

기존 React + TypeScript + Vite 프로젝트와 모바일 디자인을 유지하면서 JSON 분석 엔진, 실제 교체 비교, 가독성 및 제스처 안정성을 연결했습니다. 이번 작업에서는 배포하지 않았습니다.

## 실제 동작

- 홈, 탐색, 검색/분류/정렬, 제품 추가, 수량/선택 삭제, 빈 상태
- localStorage에 조합함과 보관함 저장, 새로고침 후 유지
- 등록 성분의 모든 제품 쌍 비교, 원본 규칙 매칭, 동일 성분 관찰
- 약물 관련 경고 분리, severity/설명/원본 출처, 함량·조건 누락 표시
- 고유 성분 관계별 중복 감점 없는 시연 비교 지표와 실제 게이지 전환
- 공통 등록 성분이 있는 실제 JSON 제품 후보와 전후 지표·주의 관계 비교
- 교체 확정 후 새 cart로 재계산한 결과에 바로 진입. 제품/수량/경고/지표가 함께 변경
- 조합 보관은 별도 선택. 새 구성을 저장하고 다시 불러오면 현재 규칙으로 분석
- 모션 감소, 이미지 실패, 손상된 저장 데이터, 저장소 차단 처리

## 분석 범위

두 데이터 파일은 `cart_interactions_dataset.json`과 이름이 변경된 `supplement_interactions_with_lactose_ko.json`입니다. PRD와 두 JSON은 수정하지 않았습니다.

주 데이터의 17개 제품과 33개 성분 쌍 규칙을 사용합니다. 보조 데이터의 조건부 규칙 12개는 읽고 보류 이유와 출처를 제공하지만, 개인 응답·제품별 유당·제형·고용량 조건이 없어 자동 경고/감점하지 않습니다.

모든 현재 제품의 함량은 null입니다. 함량·가격·효능·임상 근거·상호작용을 새로 만들지 않았습니다. 수량은 용기 개수이며 섭취량이 아닙니다. 시너지 가점, 일일 총량/독성 판정, 개인 체질·알레르기 판정은 지원하지 않습니다.

고정 82/88 예시 전환은 제거했습니다. [점수 정책](./SCORING_POLICY.md)의 비교 지표를 계산하며, 100점도 안전성을 뜻하지 않습니다. 정책은 전문가 검증이 필요합니다.

[엔진 구조·조건 지원 범위](./ANALYSIS_ENGINE.md)를 참고하세요.

## UI와 제스처

Pretendard, #55789B, 화이트/쿨그레이, 기존 제품 이미지와 카드/게이지 구조를 유지했습니다. 본문 15~16px, 제품명 17px, 상세 섹션 제목 20px, 화면 제목 28px, 보조 설명 13~14px을 중심으로 정돈했습니다. 상단·리스트·카드 여백과 의미 없는 고정 최소 높이를 줄였습니다.

전환 중 main의 transform이 고정 버튼의 좌표 기준을 바꾸는 문제를 제거했습니다. 화면은 페이드로 전환하고 개별 제품/콘텐츠/점수 모션은 유지합니다. 이미지의 기본 HTML drag를 끄고, 의도된 카테고리 안에만 가로 스크롤을 한정했습니다. 세로 스크롤과 핀치 줌, 텍스트 선택은 유지합니다. body 전체 overflow 숨김이나 전역 터치 차단을 사용하지 않았습니다.

[제스처 원인·검수 기록](./LAYOUT_QA.md)을 참고하세요.

## 이미지

기존 AI 연출 에셋 4종을 그대로 사용합니다. 실제 상품 사진은 아닙니다. P01/P06/P08은 시연 패키지 이미지를 표시하고 나머지는 이미지 누락 상태입니다. 작은 비교 썸네일은 누락 아이콘과 접근성 이름으로 표시합니다.

[에셋 파일과 생성 프롬프트](./ASSET_PROMPTS.md)는 첫 UI 구현의 기록이며 이번 작업에서 이미지를 새로 생성하지 않았습니다.

## 변경 파일

새 파일:

- `src/analysis/types.ts`, `data.ts`, `conditions.ts`, `engine.ts`, `scoring.ts`, `optimization.ts`
- `src/analysis/__tests__/engine.test.ts`
- `src/components/AnalysisDetails.tsx`
- `src/lib/presentation.ts`
- `tests/analysis-flow.spec.ts`, `tests/layout.spec.ts`
- `docs/SCORING_POLICY.md`, `docs/ANALYSIS_ENGINE.md`, `docs/LAYOUT_QA.md`

수정 파일:

- `src/App.tsx`, `src/App.css`, `src/index.css`
- `src/lib/catalog.ts`
- `src/screens/Home.tsx`, `Cart.tsx`, `Result.tsx`, `Optimize.tsx`
- `src/components/ProductImage.tsx`, `ScoreGauge.tsx`, `AnalysisOverlay.tsx`
- `tests/fitmate.spec.ts`
- `package.json`, `package-lock.json`: Vitest와 테스트 스크립트
- `docs/IMPLEMENTATION.md`, `docs/RUN.md`, `docs/qa/*.png`

## 원본 보존 확인

작업 전후 SHA-256을 비교한 값입니다.

| 파일 | SHA-256 |
| --- | --- |
| docs/PRD.md | 838C04063E1422E61C00674CBA13F91DC21841F18F1F64B6BF3C7E67A0A54165 |
| cart_interactions_dataset.json | DAFE6D8B9C1707F6FFE8716F6A12CEF67D695A7EF7890ACAF3FEB2E5094A43F0 |
| supplement_interactions_with_lactose_ko.json | DD2817EFDD18CD2AE044F49C99AA1B2969544F525F7C65276A02274D2566575E |

## 실행과 검사

[실행 안내](./RUN.md). `npm test`로 단위 테스트와 Playwright를 함께 실행합니다. 빌드·린트·최종 테스트 결과는 작업 완료 보고와 검수 기록을 참고하세요.

최종 결과: Vitest 33개, Playwright 32개로 총 65개 통과. `npm run build` 성공, `npm run lint` 경고·오류 없음. 요청한 네 뷰포트의 드래그·스와이프·스크롤·전환 및 교체→결과→보관→조합함→reload를 확인했습니다. 교체 직후 결과는 scrollY=0에서 새 구성과 계산값을 표시하는 것도 별도로 확인했습니다. PRD와 두 JSON의 SHA-256은 작업 전후 동일합니다.
