# Fitmate V3 디자인 프로토타입

기존 앱을 보존한 독립 HTML/CSS/JS 구현. 로컬 폰트·이미지와 실제 JSON 규칙 엔진 번들이 포함되어 있다.

**가장 간단한 확인:** `OPEN-FITMATE.html`을 Chrome에서 연다. 폰트·제품 이미지·분석 코드가 포함된 단일 HTML이라 서버 없이 동작한다. 다른 폴더로 복사해도 앱을 사용할 수 있다. 문서·디자인 시스템·원본 JSON 링크까지 사용하려면 현재 폴더 구조를 유지한다.

`DESIGN-SYSTEM.html`도 서버 없이 열 수 있으며, 실제 엔진으로 움직이는 게이지 예제가 포함되어 있다.

개발용으로 개별 파일을 확인하려면 아래 정적 서버를 사용한다.

```powershell
# D:\dev\Fitmate에서 실행
node prototypes/fitmate-v3/tools/serve.mjs
```

브라우저에서 **http://127.0.0.1:4178**을 연다.

- `#home` 홈 / `#explore` 탐색 / `#cart` 조합함
- `#analysis` 분석 상세·규칙 설명 / `#optimize` 제품 교체 비교
- `#saved` 내 정보·저장 조합
- `/design-system.html` 재사용 디자인 시스템과 실동작 모션

첫 조합은 리뷰 스크린샷의 DEMO P02 + M02, 88점이다. 조합함 → 분석 상세 → 제품 교체 비교 → 프로틴 A 적용으로 실제 100점(+12)을 확인할 수 있다. 홈의 종합비타민 + 비타민 D 예시는 R09와 중복 관계를 보여준다. 100점도 의학적 안전도를 의미하지 않는다. AI API를 호출하지 않으며 설명은 규칙 기반으로 명시된다.

문서: [UX 진단·변경점](./UX-REVIEW.md), [React 통합 가이드](./INTEGRATION.md), [검수 결과](./qa/verification.json).

재검수(미리보기 서버를 먼저 실행):

```powershell
node prototypes/fitmate-v3/tools/verify.mjs
node prototypes/fitmate-v3/tools/verify-final.mjs
node prototypes/fitmate-v3/tools/verify-cancel.mjs
node prototypes/fitmate-v3/tools/check-package.mjs
```

원본 엔진이 바뀌었을 때만 번들과 사본을 재생성:

```powershell
node prototypes/fitmate-v3/tools/prepare.mjs
node prototypes/fitmate-v3/tools/package.mjs
```

`prepare`는 원본을 읽어 프로토타입 폴더에만 쓴다. 최초 기록한 `qa/source-baseline.json`을 덮어쓰지 않는다. 패키지 설치·기존 프로젝트 빌드·배포는 수행하지 않는다. 정적 HTTP 서버는 Ctrl+C로 종료한다.
