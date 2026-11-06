# Fitmate 최종 시연 영상 — 소스와 이용 기록

제작일: 2026-11-06 (Asia/Seoul).

## 실제 앱 화면

- 대상: https://fitmate-team3.vercel.app
- Production 배포: `dpl_6U1twtAtXSbLZ2yYS8KKaVLWUqWD`, 앱 커밋 `cc18dcd`.
- Chrome/Playwright로 실제 검색·담기·R06 근거 열기·교체·저장을 조작했다. 제품, 점수, 분석 문구를 합성하거나 교체하지 않았다.
- CSS 화면 390×844, 실제 캡처 780×1688. 전체 앱을 잘라내지 않고 1920×1080 중립색 캔버스에 배치했다. 핵심 구간만 최대 1.12배 확대한다.
- 화면 외부의 시각 요소는 발화에 맞춘 하단 한국어 자막뿐이다. URL, 별도 제목, 설명 카드, 점수 오버레이를 넣지 않았다.
- 원본 42.10–42.53초의 로딩 대기만 컷 편집했다. 실제 점수 애니메이션을 보존했고, 이후 자막·음성·클릭 시각을 0.43초 앞당겼다. 최종 영상은 약 55.6초다.

## 음악·효과음

- 음악: **Fitmate Original Ambient**, 이 프로젝트를 위해 직접 합성한 56초 오리지널 신스·앰비언트 연주.
- 사인파 기반 패드, 플럭, 베이스와 절제된 노이즈 퍼커션. 92 BPM. 외부 상업 음악, 다운로드 음원, 타인의 녹음·샘플을 사용하지 않았다.
- 기존 제작 원본의 독자적인 합성 코드를 재사용하고, 교체 장면의 차임을 새 촬영의 실제 클릭 시각에 맞췄다.
- 효과음도 수학적 파형으로 직접 합성했다. 실제 클릭 시각은 `artifacts/video/recording.json`에 기록한다.
- 이 프로젝트의 공개 발표·시연 영상에 사용하기 위해 제작했다. 별도의 제3자 음원 라이선스나 구독이 필요하지 않다. 법적 저작권 귀속에 관한 추가 보증을 의미하지는 않는다.
- 원본: `artifacts/video/fitmate-original-bgm.wav`
- 제작 코드: `artifacts/video/tools/sound_release.py`
- 기존 제작 코드 보존: `artifacts/video/previous-release/tools/prepare.py`

## 한국어 합성 음성

- 설치된 Windows 음성 **Microsoft Heami Desktop**, `System.Speech.Synthesis.SpeechSynthesizer`를 사용했다.
- 유료 API, 새로운 가입, 외부 TTS 서비스, 실제 인물의 목소리 복제는 사용하지 않았다.
- 기본 발화 속도 0. 첫 구간만 5초 안에 맞추기 위해 FFmpeg `atempo` 약 1.21배를 적용했다. 나머지는 원래 속도다.
- 내레이션은 약 -18 LUFS로 정규화한 후 음악을 덕킹해 최종 약 -16 LUFS로 혼합했다. BGM 전용 버전에는 음성이 없다.
- 대본: `artifacts/video/narration-ko.txt`
- 구간별 음성: `artifacts/video/work/voice-*.wav`
- 실제 측정 발화 시간: `artifacts/video/voice-timing.json`
- 자막: `artifacts/video/fitmate-demo-ko.srt`

## 글꼴·기존 자산

- 앱은 기존 Pretendard Variable과 기존 패키지 목업을 사용한다. 글꼴 원본 라이선스는 설치 패키지와 프로토타입에 보존한다.
- 영상 자막은 설치된 Windows 맑은 고딕으로 렌더링했다. 글꼴 파일을 별도로 배포하지 않는다.
- 제품 이미지·성분 데이터는 가상 시연용이다. 88→100은 등록된 규칙에 따른 비교 점수 변화이며 의학적 안전성 개선을 보장하지 않는다.

## 재현과 보존

1. `FITMATE_VIDEO_URL`을 검증한 Production URL로 지정하고 `node artifacts/video/tools/record.mjs`를 실행한다.
2. `python artifacts/video/tools/prepare_release.py`, PowerShell `artifacts/video/tools/tts.ps1`, `python artifacts/video/tools/mix_voice.py` 순서로 음성을 만든다.
3. `python artifacts/video/tools/sound_release.py`, `python artifacts/video/tools/render_release.py`로 두 MP4를 렌더링한다.
4. `python artifacts/video/tools/verify_release.py`로 전 구간 디코딩·스트림·오디오와 주요 프레임을 검수한다.

이전 영상·녹화·제작 원본은 `artifacts/video/previous-release/`에 보존했다. 모든 영상과 QA는 `artifacts/` 아래에 있고 `.vercelignore`로 배포에서 제외된다.
