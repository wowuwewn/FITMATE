# Fitmate V3 React 통합 가이드

이 문서는 적용 지침이다. 기존 React 앱, 분석 엔진, JSON, 패키지 설정은 수정하지 않았다. 구현은 `prototypes/fitmate-v3`에만 있다.

## 실행과 산출물

바로 확인하려면 `OPEN-FITMATE.html`을 Chrome에서 연다. 이 단일 파일에는 폰트·이미지·실제 분석 코드가 포함되어 서버가 필요 없다. 개별 HTML/CSS/JS를 개발할 때는 아래 명령을 저장소 루트에서 실행한다. 완성된 `data/analysis.js`, 이미지, 폰트가 포함되어 별도의 설치나 빌드 없이 미리 볼 수 있다.

```powershell
node prototypes/fitmate-v3/tools/serve.mjs
```

`http://127.0.0.1:4178`을 연다. 개발용 `index.html`은 ES 모듈 파일을 사용하므로 HTTP 실행이 필요하다. `OPEN-FITMATE.html`은 엔진을 data URL 모듈로 내장하여 `file://`로도 실행된다. 외부 API·CDN·폰트 요청이 없다. 출처 링크를 사용자가 여는 경우에만 외부 사이트로 이동한다. 서버는 루프백에서 정적 파일만 제공하는 로컬 미리보기 도구이며 앱 백엔드가 아니다.

| 파일 | 역할 |
|---|---|
| `OPEN-FITMATE.html` | 서버 없이 여는 단일 파일. `tools/package.mjs`로 재생성 |
| `index.html`, `app.js` | 홈, 탐색, 조합함, 분석 상세, 교체 비교, 저장·복원 |
| `tokens.css` | 색, 글꼴, 간격, 모션, 터치 크기의 기준 |
| `styles.css` | 화면 및 재사용 컴포넌트 스타일 |
| `design-system.html` | 실제 엔진 결과로 움직이는 디자인 시스템 명세 |
| `engine-entry.ts` | 원본 엔진과 카탈로그를 읽는 번들 진입점 |
| `data/analysis.js` | 원본 엔진의 독립 실행용 번들. 수동 수정 금지 |
| `data/*.json` | 원본 JSON과 동일한 사본, 출처 해시 |
| `UX-REVIEW.md` | 화면별 진단, 우선순위, 변경점 및 추가 지침 |
| `qa/` | 크기별 실제 렌더, 사용자 흐름 검증 결과, 원본 해시 |

## 데이터 계층은 유지하고 표현만 교체

프로토타입의 HTML 문자열과 DOM 이벤트 위임 코드를 React에 그대로 붙이지 않는다. 각 렌더 함수의 마크업을 JSX 컴포넌트로 옮기고 현재 앱의 상태·콜백을 연결한다. React에서는 번들 사본이 아니라 현재의 원본 모듈을 직접 import한다.

```tsx
import { analyzeCart } from '../analysis/engine'
import { analysisDataset } from '../analysis/data'
import { getReplacementCandidates } from '../analysis/optimization'

const analysis = useMemo(
  () => analyzeCart(cart, analysisDataset),
  [cart],
)
const candidates = useMemo(
  () => getReplacementCandidates(cart, sourceId, analysisDataset),
  [cart, sourceId],
)
```

| 프로토타입 책임 | 적용할 기존 파일 | 연결 계약 |
|---|---|---|
| `home()` | `src/screens/Home.tsx` | `onExplore`, `onExample`, `onProduct` 유지. 추천 클릭은 먼저 구성 미리보기 |
| `productRow()`, `explore()` | `Explore.tsx`, `ProductImage.tsx` | 실제 카탈로그, `onAdd`, 제품 상세. 이미지에서 성분을 유추하지 않음 |
| `cartScreen()`, `cartRow()` | `Cart.tsx` | 기존 cart 및 수량/삭제/저장 콜백. 하단 저장 영역만큼 padding-bottom 확보 |
| `gauge()`, `animateGauge()` | `ScoreGauge.tsx` | `score.value: number \| null`. ARIA는 최종 점수, 숫자 애니메이션은 숨김 |
| `analysisScreen()`, `relationSVG()` | `Result.tsx`, `AnalysisDetails.tsx` | `findings`, `score.deductions`, `duplicates`, `coverage`를 각각 사용 |
| `openSheet()` | `Sheet.tsx` | title, content, opener. Escape/포커스 복귀/배경 스크롤 잠금 |
| `optimizeScreen()` | `Optimize.tsx` | 기존 후보와 `comparison`. 미리보기로 실제 cart 변경 금지; 적용에서 변경 |
| `explanationHTML()` | `AiExplanation.tsx` | 규칙 설명은 독립적인 `kind: 'rules'` 상태. 생성형 응답으로 표시 금지 |
| `savedScreen()` | `Saved.tsx`, `lib/saved.ts` | 기존 저장 형식·키를 유지. 원본 분석 함수로 복원 시 재계산 |

## React 컴포넌트 경계

```ts
type ScoreSummaryProps = { analysis: AnalysisResult; onDetails: () => void }
type IngredientRelationProps = { finding: Finding; onEvidence: () => void }
type ReplacementPreviewProps = {
  candidate: ReplacementCandidate
  onApply: (items: CartItem[]) => void
}
type ExplanationProps = {
  analysis: AnalysisResult
  mode: 'rules' | 'ai'
  status: 'idle' | 'loading' | 'success' | 'error'
}
```

`Finding` 하나가 여러 제품 쌍에서 발견돼도 `causeKey` 단위로 감점을 표시한다. 전체 경고 개수와 고유 감점 원인 개수는 다를 수 있다. SVG는 `Finding.ingredientIds`와 `Finding.productIds`에서 생성한다. 정렬된 성분 순서와 제품 순서가 다르므로, 해당 제품의 `ingredients`로 연결을 확인한다. 중복 관계는 같은 성분을 두 제품에 각각 표시한다. 매칭이 없을 때 연결선을 꾸며 만들지 않는다.

탐색 담기 버튼은 토글로 연결한다. `isInCart ? onRemove(productId) : onAdd(productId)`이며, 담김 상태에서 다시 누를 때 수량 증가가 아니라 담기 취소다. 제품 상세도 같은 상태를 읽어 ‘담기 취소 / 조합함에 담기’를 전환하고 ‘닫고 돌아가기’를 별도로 둔다. 탐색 진입 시 이전 screen과 scrollY를 저장하고 상단 뒤로가기에서 복원한다. 제품 상세의 닫기는 화면 이동 없이 해당 제품 행으로 포커스를 복귀한다.

조합함의 ‘상세 정보 확인’ 아래에 ‘최적화 분석’ 버튼을 둔다. 이 버튼은 기존 `optimize` 화면으로 이동하며 새로운 계산 로직을 만들지 않는다. 제품이 담겨 있는 경우 표시하고, 후보가 없는 구성은 최적화 화면의 기존 안내를 사용한다.

## 디자인 토큰 적용

`tokens.css`의 `--fm-*`를 프로젝트 디자인 토큰에 대응한다. `styles.css`의 전역 `body`, `button`, `h1` 등을 통째로 덮어쓰지 말고 기존 앱 루트 아래로 범위를 한정한다. 패널 너비 480px와 데스크톱 설명 영역은 검토용 쉘이며 제품 앱에 필수 요소가 아니다.

- 본문 16px/1.55, 설명 15px/1.6, 구획 제목 22px. 12–14px는 식별자·메타데이터에 한정한다.
- 기본색 #55789B, 작은 링크 글씨 #3E6083, 본문 #171B20, 보조 #626D79.
- 담기·삭제·닫기·수량 버튼 44px 이상. 모양이 작은 수량 테두리와 실제 클릭 영역을 구분한다.
- 컨테이너 좌우 22px, 320px에서는 16px. 세로 페이지 스크롤과 카테고리의 가로 스크롤을 분리한다.
- 내비게이션 72px + safe area. CTA를 위에 둘 경우 본문에 CTA 높이 + 24px 이상의 추가 하단 여백을 준다.
- 같은 이미지의 프로틴 A/B/C에는 성분 차이와 변형 문자를 표시한다. 원본 패키지를 실제 브랜드 사진으로 오인시키는 라벨은 만들지 않는다.

## Motion for React로 옮기기

1. **점수:** 하나의 `useMotionValue`에서 숫자와 SVG `strokeDashoffset`을 함께 파생한다. `animate(previous, next, {duration: 0.68})` 하나로 처리하고 이전 컨트롤을 cleanup에서 중단한다. `null`은 숫자 변환 없이 ‘—’로 표시한다. 초당 갱신되는 숫자 대신 최종 변화 한 번만 live region에 읽는다.
2. **제품 담기:** 버튼 체크 전환과 nav 배지의 작은 scale 피드백. 400ms 이내에 종료한다. 전체 리스트·전체 페이지를 다시 진입 애니메이션시키지 않는다.
3. **삭제:** 실제 상태 변경은 즉시 반영하고 `AnimatePresence`로 행 exit만 160ms 처리한다. 되돌리기는 이전 `CartItem[]` 스냅샷을 복원한다. 복용약 삭제를 중단 권고로 서술하지 않는다.
4. **관계:** SVG `pathLength="100"`, `strokeDasharray="100"`, offset 100→0, 650ms 한 번. 무한 점멸이나 흐르는 입자를 쓰지 않는다. 관계의 강도·확률을 선 두께·속도로 표현하지 않는다.
5. **교체:** 대체 제품 opacity와 x 8→0, 450ms. 비교 점수는 실제 `comparison.after.score`까지 600ms. 제거·추가 원인도 같은 comparison에서 렌더한다.
6. **바텀시트:** y 30→0, opacity 0→1, 300ms. 네이티브 dialog 또는 동일 수준의 포커스 격리. 페이지 전체 drag는 사용하지 않는다.
7. **설명:** 완성된 설명을 300ms opacity/y로 보여준다. 규칙 템플릿에 AI 생각 중/토큰 스트리밍 효과를 붙이지 않는다.

모든 항목에 `useReducedMotion()`을 적용한다. true이면 y/scale 효과를 없애고 숫자와 선을 즉시 최종값으로 이동한다. 진행 중 모션의 구독·requestAnimationFrame·네트워크 요청은 화면 변경 때 정리한다.

## AI 상태 연결

프로토타입은 API 호출이 없는 rules 상태만 구현했다. 기존 `api/explain.ts`, `server/assistant.ts`는 그대로 둔다. 향후 기존 API에 연결할 때 다음 상태를 구분한다.

| 상태 | 제목/표기 | 동작 |
|---|---|---|
| 연결 전 | 규칙 기반 안내 · AI 생성 아님 | 현재 분석 객체에서만 템플릿 생성 |
| 연결된 요청 중 | AI 설명 요청 중 | 실제 fetch가 진행 중일 때만 표시. 기존 분석 유지 |
| `kind: 'ai'` 성공 | AI 생성 설명 | 서버 fingerprint와 현재 분석을 비교. 응답 출처를 함께 표시 |
| `kind: 'rules'` 반환 | 규칙 기반 안내 | AI 생성 라벨 사용 금지 |
| 오류/시간 초과 | AI 설명에 연결하지 못했어요 | 원본 규칙 리포트와 질문 유지, 재시도 제공 |

카트 변경 시 이전 요청을 abort하고 `fingerprint`가 다른 응답은 버린다. 개인정보·제품 구성이 전송되는 실제 API 요청 전에 기존 전송 안내를 유지한다. AI 응답은 점수·원인·성분·함량을 변경할 수 없다.

## 저장과 상태

프로토타입 전용 키는 `fitmate-v3-design-prototype`이다. 기존 앱의 저장 값을 읽거나 덮어쓰지 않는다. 최초 DEMO는 리뷰 스크린샷과 같은 P02 + M02다. 저장·복원 시 `normalizeCart`를 사용한다. JSON 파싱 오류와 저장 공간 거부를 처리하며 저장 실패를 성공으로 표시하지 않는다. React 통합 시에는 기존 저장 API를 사용하고 이 프로토타입 키로 마이그레이션하지 않는다.

## 화면 단위 적용 순서 및 수용 기준

1. 토큰·버튼·제품 행을 적용하고 홈만 검수한다. 인기·판매량이 없는 상황에서 랭킹 문구가 나오면 실패다.
2. 조합함을 적용한다. P02 + M02는 88, P01 + M02는 100, 0/1개 제품은 ‘—’. 용기 수량만 바뀌어도 감점이 증폭되지 않아야 한다.
3. 분석 상세에 R06/R09와 해당 URL이 정확하게 연결되는지 확인한다. 규칙 없는 유단백질 중복은 새 감점을 만들면 안 된다.
4. 교체에서 실제 후보만 선택하고 약은 그대로 유지한다. +12점의 근거는 R06 매칭 제거이며 의학적 개선으로 표현하지 않는다.
5. 저장·복원, 320/390/430px, 1440px, 키보드, Escape, 모션 감소, 최대 수량, 빈 조합, 저장 실패를 검수한다.

실기기 iOS Safari의 safe area/키보드/바텀시트와 VoiceOver·TalkBack 읽기 순서는 출시 전 별도 확인이 필요하다. 이 산출물은 출시를 위한 UI 구현안이며 임상 검증 완료 또는 실기기 QA 완료를 의미하지 않는다.
