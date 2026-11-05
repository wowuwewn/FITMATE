# Fitmate 3차 UX 구현 기록

## 홈과 인트로

첫 홈 방문에 약 1초짜리 로고·메시지 인트로가 표시됩니다. 건너뛰기·Escape를 지원하며 재방문은 `fitmate.intro.seen.v1`로 생략합니다. 실제 홈은 인트로 뒤에서 즉시 렌더링됩니다. 모션 감소 환경은 연출 대기 없이 진입합니다. 직접 들어온 상세 링크는 인트로로 가리지 않습니다.

홈은 검색, 실제 엔진으로 계산한 조합 예시, 프로틴/영양제 탐색, 이미지가 있는 카테고리 바로가기로 구성했습니다. 예시를 선택하면 현재 조합이 바뀐다는 안내가 있으며 즉시 실제 결과를 계산합니다. 판매 순위·가격·후기·새 상품은 만들지 않았습니다.

## 조합함

앱 상위의 기존 `useMemo(() => analyzeCart(...))` 결과를 그대로 표시합니다. 별도 분석 버튼과 강제 로딩 시퀀스를 제거했습니다. 첫 화면에서 실제 숫자를 바로 보여주고 이후 변경은 0.45초 동안 게이지와 숫자가 함께 움직입니다. 수량은 용기 개수이므로 수량만 바꾸면 재분석해도 같은 점수일 수 있습니다.

상단은 지표·주의사항·중복 성분·정보 부족 요약과 상세 버튼, 중간은 제품/수량/직접 삭제/선택 삭제, 하단은 AI 설명·제품 추가·탐색·조합 저장입니다. 저장은 기존 형식과 저장소 키를 유지합니다.

상세 정보는 네이티브 dialog 바텀시트로 열립니다. 상호작용·중복 관찰·교체 비교·시너지 데이터 부재·미지원 조건·점수 근거·출처를 확인하고 전체 리포트로 이동할 수 있습니다. 배경 스크롤 잠금, 내부 스크롤, Escape/닫기/배경 클릭, 포커스 복원을 지원합니다.

## 카테고리와 내 정보

9개 카테고리는 별도 매핑 모듈로 관리합니다. 현재 제품은 프로틴 3개, 비타민&미네랄 5개, 용도를 추정하지 않은 카페인 제품 2개입니다. 약물 7개는 별도 **복용약 확인** 목록에 있으며 기본 전체 목록에 섞지 않습니다. 원본 17개 모두 접근 가능합니다.

스낵·크레아틴·다이어트·유산균·오일·식물 추출물은 현재 상품 데이터가 없어 빈 상태를 표시합니다. 그림이 있다는 이유로 상품이나 분류 근거를 생성하지 않습니다.

**내 정보**는 저장한 조합의 불러오기/삭제, 현재 조합과 기록의 차이, 브라우저 저장 범위, 서비스·점수 정책 안내를 제공합니다. 프로필·인증은 만들지 않았고 기존 `#saved` 링크도 유지합니다.

## 이미지와 모션

사용자의 추가 요청에 따라 모든 17개 제품에 기존 이미지 또는 공용 목업을 매핑했습니다. 모든 9개 카테고리에도 이미지가 있습니다. 실제 상품 사진으로 오인하지 않도록 AI 목업 안내를 표시합니다.

내장 ImageGen으로 새 목업 8개를 생성했습니다. 원본 PNG는 `public/images/mockups/`, 화면에서 사용하는 투명 WebP는 같은 경로입니다. WebP 8개 합계 약 198KB로, 생성 원본 약 9.5MB를 그대로 내려받지 않습니다. 공용 패키지 이미지가 성분·제형·실제 라벨을 뜻하지 않습니다. 프롬프트는 [에셋 기록](./ASSET_PROMPTS.md)에 있습니다.

인트로 등장/페이드, 예시 선택 누름 피드백, 실제 점수 변경, 기존 제품 추가/제거·교체 모션을 적용합니다. main은 opacity 전환만 사용하므로 고정 CTA의 부모 transform 문제를 만들지 않습니다.

제품 상세 버튼으로 바뀐 이미지에서 드래그를 클릭으로 처리하는 회귀가 검출되어 `BrowseButton`이 8px 이상 이동한 포인터 제스처를 클릭에서 제외하도록 수정했습니다. 이미지 HTML drag는 꺼져 있으며 정상 세로 스크롤과 카테고리 내부 가로 스크롤은 유지합니다.

## AI 연결

추가 요청의 서버리스 AI 설명 구현·환경변수·호출 제한·실제 검증 범위는 [AI 어시스턴트](./AI_ASSISTANT.md)를 참고하세요. JSON 분석 결과와 점수는 AI의 성공/실패에 영향받지 않습니다.

## 변경 파일

수정:

- `src/App.tsx`, `src/App.css`
- `src/screens/Home.tsx`, `Explore.tsx`, `Cart.tsx`, `Saved.tsx`, `Result.tsx`
- `src/components/ScoreGauge.tsx`, `ProductImage.tsx`
- `src/lib/catalog.ts`
- `tests/fitmate.spec.ts`, `analysis-flow.spec.ts`, `layout.spec.ts`
- `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `.gitignore`
- `docs/IMPLEMENTATION.md`, `RUN.md`, `LAYOUT_QA.md`, `ASSET_PROMPTS.md`, `docs/qa/*.png`

추가:

- `src/components/Sheet.tsx`, `CartDetails.tsx`, `Intro.tsx`, `ProductDetails.tsx`, `BrowseButton.tsx`, `AiExplanation.tsx`
- `src/lib/categories.ts`, `imagery.ts`, `intro.ts`, `src/assistant/types.ts`
- `src/analysis/__tests__/catalog.test.ts`
- `api/explain.ts`, `server/context.ts`, `guard.ts`, `assistant.ts`, `server/__tests__/assistant.test.ts`, `vercel.test.ts`
- `.env.example`, `vercel.json`, `tsconfig.server.json`
- `tests/ux-v3.spec.ts`, `assistant.spec.ts`
- `public/images/mockups/{snack,creatine,diet,probiotic,oil,extract,energy,medication}.{png,webp}`
- `docs/UX_V3.md`, `AI_ASSISTANT.md`

PRD, 원본 JSON, 분석 엔진, 점수 정책은 변경하지 않았습니다. Vercel에 배포하지 않았습니다.

## 남은 제약

제품은 모두 가상 시연용이며 모든 함량이 미등록입니다. 긍정적 규칙·개인 응답·실제 유당/제형·복용 시간 자료가 없어 시너지·실제 섭취량·의학적 안전을 판정하지 않습니다. 목업도 실제 제품의 외관을 뜻하지 않습니다. 실제 iOS Safari 기기 검증과 실제 AI 키/배포 환경 검증은 수행하지 않았습니다.

## 최종 검증 결과

- `npm test`: 기존 엔진 회귀와 신규 UI/AI 검사를 포함해 단위 67개와 Playwright 51개 통과.
- 이후 API 진입점의 분산 제한 필수 적용 회귀 1개를 추가하고 `npm run test:unit`을 재실행해 **최종 단위 68개 통과**.
- 최종 고유 검사 수는 **단위 68개 + 브라우저 51개 = 119개**입니다. 기존 65개는 기능을 유지하고 변경된 UI 조작 순서와 명칭만 반영했습니다.
- 마지막 `npm run build` 성공. `npm run lint` 경고·오류 없음.
- 320×568, 375×667, 390×844, 1440×900에서 핵심 흐름·제스처·가로 넘침·고정 CTA·내부/배경 스크롤·저장·복원을 검사했습니다.
- 별도 브라우저 확인: 바텀시트 배경 클릭 닫기, 실제 로컬 API의 AI 미연결 응답, AI 오류 안내가 고정 저장 버튼 위에 보이는 배치.
- 브라우저 번들에 서버 API 키 변수·Bearer 인증·테스트 키 표식이 포함되지 않았습니다.
- 원본 보존 검증: [해시 기록](./qa/v3-integrity.json)의 여섯 파일 모두 `unchanged:true`. PRD, 두 원본 JSON, 엔진, 점수 함수, 점수 정책 문서입니다.

| 요구 흐름 | 확인 근거 |
| --- | --- |
| 최초 인트로·자동 종료·건너뛰기·재방문 생략 | `tests/ux-v3.spec.ts`, `docs/qa/v3-intro.png` |
| 검색·추천 예시·제품 상세·조합함 연결 | `tests/fitmate.spec.ts`, `ux-v3.spec.ts` |
| 즉시 점수·추가/삭제/수량 재분석·원형 게이지 | `src/screens/Cart.tsx`, `ScoreGauge.tsx`, `tests/analysis-flow.spec.ts` |
| 상세 근거·상호작용·중복·정보 부족·전체 리포트 | `CartDetails.tsx`, `AnalysisDetails.tsx`, UI 회귀 검사 |
| 9개 분류·빈 카테고리·약물 분리·모든 이미지 | `categories.ts`, `imagery.ts`, `catalog.test.ts`, `ux-v3.spec.ts` |
| 내 정보 저장/불러오기/삭제·기존 형식 유지 | `Saved.tsx`, `src/lib/saved.ts`, `tests/fitmate.spec.ts`, `ux-v3.spec.ts` |
| P02+M02=88/R06, P01 교체=100, P01+M01→P03+M01=75 | 기존 `engine.test.ts`와 `analysis-flow.spec.ts` |
| 드래그·터치·스크롤·고정 위치·모션 감소 | `tests/layout.spec.ts`, `ux-v3.spec.ts` |
| 서버 재분석·지원 질문·실제 근거만 사용·입력 검증 | `server/context.ts`, `guard.ts`, `server/__tests__/assistant.test.ts` |
| API 비밀키 격리·분산 제한·캐시·토큰/시간 상한·오류 처리 | `api/explain.ts`, `server/assistant.ts`, `server/__tests__/vercel.test.ts`, 번들 검사 |
| 생성 설명과 고정 안내 구분·실패 시 규칙 분석 유지 | `tests/assistant.spec.ts`: 실제 미연결/정보 부족 응답 + 명시적 성공 응답 모킹 |

실제 제공자의 유료 생성과 배포된 Vercel 함수/Firewall 검사는 키·배포를 사용하지 않아 제외했습니다. 실행하지 않은 검사를 통과한 것으로 보고하지 않습니다.
