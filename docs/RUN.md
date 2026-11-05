# 실행과 확인

프로젝트 폴더 `D:\dev\Fitmate`에서 실행합니다.

```sh
npm install
npm run dev -- --host 127.0.0.1
```

기본 주소: http://127.0.0.1:5173/

홈의 추천 조합 예시 또는 제품 상세에서 제품을 담을 수 있습니다. 조합함 점수는 진입 즉시 표시됩니다. 프로틴 B(P02)는 일반 탐색에서, 레보티록신 경구제(M02)는 별도 '복용약 확인'에서 추가하세요. 비교 지표 88과 R06이 표시됩니다. 상세 정보 → 제품 교체 비교에서 프로틴 A(P01)로 바꾸면 지표 100과 변경된 결과를 확인합니다. 이 값은 의학적 안전 점수가 아닙니다. 저장한 조합은 하단 '내 정보'에서 관리합니다.

AI 설명은 기본 미연결 상태입니다. 실제 키와 서버 설정은 [AI 연결 안내](./AI_ASSISTANT.md)를 따릅니다. 키는 서버 전용 `.env.local`에만 넣습니다. 정적 `vite preview`에서는 API가 실행되지 않습니다. 배포 명령은 실행하지 않습니다.

```sh
npm run build
npm run preview
npm run lint
npm test
```

- `npm test`: Vitest 단위 테스트 후 Playwright E2E 실행
- `npm run test:unit`: 분석 엔진·카테고리·AI 서버 검증 테스트 실행
- `npm run test:e2e`: UI/제스처/교체 흐름 테스트만 실행 (Google Chrome 필요)
- 테스트 서버: 기본 포트 5173. 실행 중인 프로젝트 서버가 있으면 재사용합니다.
- 빌드 결과: `dist/`. 이번 작업에서는 배포하지 않습니다.
- 저장소: `fitmate.cart.v1`, `fitmate.saved.v1`, `fitmate.previous-cart.v1`, `fitmate.intro.seen.v1`. 저장된 점수 대신 현재 제품 구성으로 재계산합니다.
- 검수 이미지: `docs/qa/`, 기본 화면·교체 후 결과·4개 제스처 뷰포트

[분석 엔진](./ANALYSIS_ENGINE.md), [점수 정책](./SCORING_POLICY.md), [제스처·가독성](./LAYOUT_QA.md), [구현 및 수정 파일 목록](./IMPLEMENTATION.md)을 참고하세요.
