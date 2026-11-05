# AI 조합 분석 어시스턴트

## 역할과 연결 구조

기존 `analyzeCart`, 교체 비교 함수, `demo-comparison-v1` 정책을 수정하지 않았습니다. 조합함과 상세 리포트의 **AI 분석 설명**에서 사용자가 요청할 때만 `/api/explain`을 호출합니다. 화면 진입·수량 변경·새로고침은 유료 호출을 만들지 않습니다.

클라이언트는 제품 ID·용기 수량·질문·현재 분석 fingerprint, 교체 직전 구성만 보냅니다. 서버는 클라이언트가 보낸 점수나 근거를 받지 않고 같은 JSON과 엔진으로 다시 계산합니다. 교체 질문은 실제 교체 후보에서 나온 구성인지도 확인합니다. 이전 구성은 `fitmate.previous-cart.v1`에 저장하고 추가·삭제·수량 변경·예시 적용·조합 복원 시 초기화합니다.

서버가 만든 감점·매칭·정보 부족·변경 사실만 OpenAI에 전달합니다. 임상 설명을 모델의 지식으로 보완하거나 외부 문서를 검색하지 않습니다. 원본 건강 관련 설명과 출처는 기존 상세 리포트에서 확인합니다.

## 지원 질문

- 쉽게 요약해줘
- 왜 감점됐나요?
- 어떤 성분이 문제인가요?
- 제품 교체 후 무엇이 달라졌나요?

공백·문장부호 차이는 허용합니다. 위 범위 밖의 자유 입력, 이전 기록이 없는 교체 질문, 비교 정보가 없는 조합은 **정보 부족 · 규칙 기반 안내 (AI 생성 아님)**로 응답하며 모델에 보내지 않습니다. 일반 건강 상담 챗봇이 아닙니다.

## 생성 응답과 근거

실제 모델 응답만 **AI 생성 설명**으로 표시합니다. 캐시 응답은 재사용이라고 표시합니다. 키 미설정·오류 안내는 AI가 생성한 것처럼 보여주지 않습니다. 고정된 AI 시연 답변은 제품 코드에 없습니다.

OpenAI Responses API의 `text.format` JSON Schema를 사용합니다. 문장마다 서버가 제공한 fact ID를 붙이고, 서버가 그 ID를 실제 매칭 규칙·제품·출처로 해석합니다. 모델이 URL을 생성하지 않습니다. 미등록 fact ID·규칙·제품·성분, 근거 밖의 수치, URL·HTML·복용량·의학적 판단 관련 표현은 차단합니다. 불완전 응답·거절·검증 실패는 원문을 사용자에게 노출하지 않습니다.

이 검증은 출처·형식·일부 표현 검증이며 모든 한국어 문장의 의미를 증명하는 임상 검증은 아닙니다. 생성 설명은 원본 근거와 대조해야 합니다. 제품은 가상 시연 데이터이며, 점수 자체도 의학적 안전·효능 평가가 아닙니다.

## 로컬 연결

1. `.env.example`을 `.env.local`로 복사합니다.
2. 직접 발급한 OpenAI 프로젝트 API 키를 **서버 변수** `OPENAI_API_KEY`에 넣습니다. 저장소나 채팅에 붙여 넣지 않습니다.
3. `AI_ENABLED=true`, `OPENAI_MODEL=gpt-5.4-mini`를 설정합니다.
4. `AI_ALLOWED_ORIGINS`에 실제 브라우저 주소를 정확히 넣습니다. 예: `http://127.0.0.1:5173,http://localhost:5173`. 포트가 바뀌면 수정합니다.
5. 개발 서버를 다시 시작하고 `npm run dev -- --host 127.0.0.1`로 실행합니다.

Vite 개발 서버의 전용 미들웨어가 동일한 서버 핸들러를 실행합니다. 환경변수는 서버에서만 읽으며 `define`, `import.meta.env`, `VITE_` 변수로 API 키를 전달하지 않습니다. `vite preview`는 정적 파일 확인용이므로 서버리스 API를 실행하지 않습니다.

키가 없으면 `.env.local`을 만들 필요가 없습니다. 기본 상태는 AI 미연결이며 JSON 분석·저장·교체·리포트는 정상 동작합니다.

## Vercel 설정 — 배포는 수행하지 않음

루트 `api/explain.ts`가 Node.js Web Standard 함수입니다. `vercel.json`에 Vite 빌드, `dist`, `icn1` 리전과 25초 실행 한도를 지정했습니다. 새로운 DB·인증 시스템은 만들지 않았습니다.

향후 연결할 때 Vercel 프로젝트의 서버 환경변수에 위 항목을 설정하고 `AI_ALLOWED_ORIGINS`에는 실제 허용 도메인만 넣습니다. Preview와 Production은 각각 설정합니다. `VITE_OPENAI_API_KEY` 같은 공개 변수를 만들면 안 됩니다.

유료 AI를 켜기 전에 Vercel Firewall에서 `@vercel/firewall` SDK 조건의 공통 제한 규칙을 설정합니다. IP별 추가 규칙은 선택 사항입니다.

| 서버 변수 | 규칙 설정 | 권장 초기 한도 |
| --- | --- | --- |
| `AI_GLOBAL_LIMIT_ID` | 필수: 공통 키 `fitmate-ai-total`을 받는 제한 ID | 600초당 10회 |
| `AI_RATE_LIMIT_ID` | 선택: 호출자 IP별 추가 제한 ID | 60초당 5회 |

API는 필수 공통 규칙과 설정된 IP 규칙을 검사합니다. 필수 변수 누락, ID 미등록, 차단, 네트워크·시간 초과면 모델 호출을 보류합니다. Firewall 규칙은 코드 파일만으로 자동 생성되지 않습니다. 계정의 지원 범위를 확인하고 직접 설정해야 합니다. 이 작업에서는 프로젝트 설정 변경·연결·배포를 하지 않았습니다.

배포 API 진입점은 `VERCEL` 시스템 환경변수 노출 여부와 관계없이 분산 제한을 필수로 적용합니다. Vite의 로컬 개발 핸들러만 메모리 보조 제한을 사용합니다.

WAF의 최대 창은 Hobby/Pro에서 10분이며 하루 단위 창은 지원하지 않습니다. Hobby는 제한 규칙 한 개를 지원하므로 공통 규칙만 설정하고 추가 IP 규칙은 비워둘 수 있습니다. 규칙은 Default(429)로 설정해야 실제 차단됩니다. 계정에서 이미 해당 한도를 사용하는 규칙이 있다면 충돌 여부를 먼저 확인하세요. [공식 WAF 제한 문서](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)

SDK 카운터는 리전별입니다. 리전 변경·다중 리전·재배포를 통틀어 보장하는 결제 금액 상한은 아닙니다. OpenAI 프로젝트의 사용 제한·예산 알림도 함께 설정하고 사용량을 확인하세요. API 모델을 임의의 고비용 모델로 교체하지 못하도록 현재 허용 모델은 `gpt-5.4-mini` 하나로 제한했습니다.

## 입력·오류·비용 통제

- POST JSON만 허용, Origin 허용 목록, 본문 최대 8KB, 질문 200자, 등록 제품 2~10개, 중복 ID 거부, 용기 수량 정수 1~99.
- 서버 재분석 및 fingerprint 일치 검사. 모델 입력 근거 최대 14,000자.
- 호출당 출력 상한 700토큰, 추론 `none`, `store:false`, 도구·대화 이력 없음, 자동 재시도 없음.
- 제공자 호출 최대 15초, Firewall 검사 각각 2초, 브라우저 요청 22초. 구성 변경 시 오래된 요청/설명을 폐기합니다. Vercel 함수는 `supportsCancellation:true`로 연결 종료 신호를 제공자 호출에도 전달합니다.
- 같은 구성·질문의 메모리 캐시 10분·최대 100개, 동시 중복 요청 통합.
- 개발/단일 인스턴스 보조 제한은 IP당 분당 5회·일당 30회. 인스턴스 재시작으로 초기화되므로 Vercel에서는 이것만으로 보호하지 않습니다.
- 오류에 원본 예외·API 키·제공자 응답 본문을 노출하지 않습니다. API 응답은 `Cache-Control:no-store`이며 생성 설명을 localStorage에 저장하지 않습니다.

## 검증과 실행

`npm run test:unit`은 기존 엔진·카테고리 검사와 서버 API·응답 검증·Firewall 연결 검사를 포함합니다. `npm run test:e2e`는 모바일 화면과 실제 로컬 API의 미연결/정보 부족 응답, 모킹한 성공 응답을 검사합니다.

실제 키가 없어 실제 OpenAI의 유료 생성 응답과 배포된 Vercel 런타임/Firewall은 검증하지 않았습니다. 테스트의 성공 응답은 명시적인 모킹이며 실제 생성 성공이라고 보고하지 않습니다.

최종 단위 68개, 브라우저 51개, build/lint 통과. AI 브라우저 검사에는 요청 시간 초과 후 재시도 가능 여부와 오류 안내의 하단 CTA 겹침 검사도 포함됩니다. 전체 검수는 [3차 기록](./UX_V3.md#최종-검증-결과)을 참고하세요.

## 공식 문서

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs): Responses API의 `text.format` 스키마와 불완전/거절 응답 처리.
- [OpenAI GPT-5.4 Mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini): 사용 모델과 지원 API/형식.
- [Vercel Node.js 함수](https://vercel.com/docs/functions/runtimes/node-js): `/api`의 Web Standard `fetch` 진입점.
- [Vercel Rate Limiting SDK](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk): 사전 Firewall 규칙, 키별 제한, 리전별 카운터.
