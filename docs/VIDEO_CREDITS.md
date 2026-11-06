# FITMATE 30초 발표 영상 — 소스와 재현

제작 기록: 2026-11-06 (Asia/Seoul). 현재 보관하는 동영상은 아래 두 파일입니다.

| 파일 | 내용 |
| --- | --- |
| `artifacts/video/fitmate-demo-30s-final.mp4` | 실제 앱 화면·한국어 내레이션·자막·BGM |
| `artifacts/video/fitmate-demo-30s-bgm.mp4` | 동일 화면·자막·BGM, 내레이션 없음 |

두 파일은 30초, 1920×1080, 30fps, H.264/yuv420p + AAC 48kHz stereo 형식입니다. 기존 55초 영상·중복 백업·WEBM 및 렌더링용 원본 MP4는 사용자 요청으로 삭제했습니다.

## 실제 화면과 편집

Chrome/Playwright로 실제 제품 검색·담기·R06 근거 확인·P01 교체·저장을 조작한 화면을 사용했습니다. 제품·점수·분석 문구를 영상용으로 바꾸지 않았습니다. 컷 구간과 대본은 `artifacts/video/short30/project.json`에 있습니다.

앱 전체를 고정 배치하고 오른쪽 여백에 64px 한국어 자막을 표시합니다. 화면 배속·동적 줌·클릭 효과음은 사용하지 않습니다. 가상 제품과 시연용 비교 점수이며 88→100은 의학적 안전성 개선을 보장하지 않습니다.

## 음성·음악·글꼴

- 내레이션: `edge-tts`를 통한 Microsoft `ko-KR-HyunsuMultilingualNeural`. 녹음된 실제 인물의 음성 복제는 사용하지 않았습니다. 원본 MP3와 단어 경계 JSON은 `artifacts/video/short30/work/voice-*`에 유지합니다.
- BGM: v2 제작 코드에서 수학적 파형과 고정 난수로 합성한 108 BPM 오리지널 곡을 재사용했습니다. 외부 음원·샘플을 최종 영상에 넣지 않았습니다. 원본은 `artifacts/video/v2/fitmate-v2-original-bgm.wav`, 재사용하는 정규화 음악은 `v2/work/music-normalized.wav`입니다.
- 자세한 음원·합성 음성 제작 기록은 `artifacts/video/v2/VIDEO_CREDITS.md`에 있습니다. 제작 도구에 대한 기록이며 법적 권리 귀속을 추가 보증하지 않습니다.
- 앱 글꼴은 Pretendard이며 라이선스는 [PRETENDARD.txt](licenses/PRETENDARD.txt)에 보관합니다. 영상 자막은 설치된 Windows 맑은 고딕으로 렌더링했고 글꼴 파일을 별도 배포하지 않습니다.

## 재제작 시 필요한 것

촬영 프레임 1,531장(`artifacts/video/raw/frames-2x/`)과 타이밍·조작 기록(`artifacts/video/recording.json`), 원본 음성·음악·대본·제작 코드는 보존했습니다. **현재 남은 자료로 원본 MP4를 재인코딩할 수 있어 재촬영이 필요하지 않습니다.** 촬영 프레임까지 삭제하면 동일 화면의 복원이 어려워집니다.

다음 명령은 재제작할 때만 실행합니다. Python 제작 환경에는 numpy·Pillow·imageio-ffmpeg가 필요하며, 기존 `artifacts/video/v2/vendor/`에는 TTS 도구가 보관돼 있습니다. 저장된 음성을 재사용하므로 TTS 서비스 재호출은 필요하지 않습니다.

```sh
python artifacts/video/tools/render_release.py raw
python artifacts/video/short30/tools/make.py
python artifacts/video/short30/tools/verify.py
```

첫 명령은 중간 입력 `artifacts/video/raw/fitmate-production.mp4`를 다시 만듭니다. 두 번째는 저장된 MP3·단어 경계·음악을 사용해 중간 파일과 30초 최종본 2종을 생성합니다. 세 번째는 스트림·전체 디코딩·오디오와 주요 프레임을 검수하며 로컬 QA 파일을 생성합니다.

영상·제작 원본·QA는 `artifacts/` 아래에만 있으며 `.gitignore`와 `.vercelignore`로 Git 및 배포 업로드에서 제외합니다. 현재 앱의 실행·빌드에는 영상 제작 환경이 필요하지 않습니다.
