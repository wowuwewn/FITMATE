# 시연용 패키지 에셋

기존 4종의 위치 설명은 최초 제작 당시 기록입니다. 현재 홈은 탐색형으로 변경됐고 공용 목업 매핑은 `src/lib/imagery.ts`에서 관리합니다.

생성 방법: 내장 `image_gen.imagegen`, 투명 배경. CLI/API fallback은 사용하지 않았습니다. 생성 원본을 복사해 프로젝트에 보관했습니다. 실제 브랜드나 상품의 사진, 라벨, 효능 또는 함량을 나타내지 않습니다.

## 3차 추가 목업 8종

생성: 내장 ImageGen, 각 에셋 별도 호출, `transparent_background: true`. 원본 `public/images/mockups/*.png`를 보존하고 화면용으로 최대 480px 투명 WebP를 준비했습니다. WebP 변환은 해상도와 인코딩만 변경했으며 패키지 내용은 편집하지 않았습니다. 실제 제품의 함량·브랜드·제형을 나타내는 자료가 아닙니다.

첫 네 개의 최종 프롬프트는 아래 공통 텍스트의 `{subject}`에 표의 문구를 대입한 것입니다.

```text
Use case: product-mockup. Asset type: Fitmate mobile app category illustration. Primary request: {subject}. Premium photorealistic 3D studio product mockup; restrained Korean consumer wellness aesthetic. Square composition, single centered arrangement entirely visible, ample transparent margin. Soft diffuse studio lighting, subtle contact shadow, charcoal and #55789B accents, tactile paper and matte plastic. Genuinely transparent background. No brand names, no logos, no text, no numbers, no quantities, no certifications, no claims, no watermark. It is a generic illustrative mockup, not a real commercial product.
```

| 파일명 (`.png`, `.webp`) | subject |
| --- | --- |
| snack | an unbranded oatmeal protein snack bar in a pearl-white wrapper with a muted dusty-blue band, wrapper partly open to show a small corner of the bar |
| creatine | a compact pearl-white wide supplement powder jar with a dusty-blue lid and a blank dusty-blue label band, no scoop or loose powder |
| diet | a minimal matte pearl-white resealable nutrition pouch with a thin sage gray band, completely blank, no slimming claims or measurement imagery |
| probiotic | a small pearl-white supplement bottle beside two upright plain stick sachets, minimal dusty-blue accent bands, no capsules outside |

다음 네 개는 아래 공통 텍스트에 표의 문구를 대입했습니다.

```text
Use case: product-mockup. Asset type: generic Fitmate mobile app illustrative thumbnail. Primary request: {subject}. Premium photorealistic 3D studio packaging mockup in a restrained Korean consumer wellness aesthetic. Square composition, object entirely visible and centered, ample transparent margin. Soft diffuse studio lighting with subtle contact shadow. Palette pearl white, cool gray, #55789B dusty blue. Genuinely transparent background. Absolutely no text, brand names, logos, dosages, numbers, health claims, certifications, watermark or real commercial product identity. Illustrative packaging only.
```

| 파일명 (`.png`, `.webp`) | subject |
| --- | --- |
| oil | a single small amber glass supplement bottle with matte pearl-white lid and a blank cream label, two golden softgel shapes beside its base |
| extract | a small amber glass botanical supplement bottle with charcoal cap and a blank sage label, one subtle green leaf beside the base |
| energy | a single slim pearl-white aluminium beverage can with a dusty-blue broad blank band, no food props, no lightning or energy symbols |
| medication | a plain white medicine carton with a restrained dusty-blue band beside a sealed silver blister strip, no visible tablets, no crosses or medical symbols |

공용 매핑: 프로틴 3종은 기존 화이트 용기, 미네랄·비타민 5종은 기존 차콜/앰버 용기, 부스터는 무문자 파우더 용기, 음료는 새 캔, 약물 7종은 새 무문자 상자 목업을 사용합니다. 같은 이미지 사용은 실제 제품의 동등성이나 제형을 뜻하지 않습니다. 빈 카테고리에는 이미지와 빈 데이터 안내만 있고 새 상품을 만들지 않았습니다.

## `public/images/protein-hero-demo.png`

홈의 첫 번째 히어로 이미지.

```text
Use case: product-mockup. Asset type: transparent raster hero photograph for a fictional supplement demo app. Subject: one premium large matte charcoal-black unbranded whey protein tub with subtly ridged black screw lid, tiny restrained white uppercase text exactly "WHEY\nPROTEIN" on lower left front. Three-quarter slightly front view, realistic plastic texture, lid ellipses and soft reflections. A small natural mound of off-white protein powder on the ground to left, beside tub. Reference composition is a tall black protein container in a premium minimalist Korean mobile app. Tub fills about 78 percent of image height and sits centered slightly right. Soft studio daylight from upper left. Isolated on actual transparent background with subtle contact shadow under objects. This is explicitly a fictional generic packaging illustration, never a real brand. No quantities, benefits, certification, brand logo, extra label, watermark, hands, UI, or decorative props. Photorealistic product photography, not geometric vector drawing. Tight useful framing.
```

## `public/images/white-jar-demo.png`

홈 갤러리 및 가상 시연 제품 P01의 연출 이미지.

```text
Use case: product-mockup. Asset type: transparent catalog product photograph for a fictional demo app. Subject: a single neutral unbranded white/off-white supplement powder jar with matte pearl white cylindrical body, softly rounded shoulders, short neck and finely ribbed light grey screw cap. Premium realistic 3D product photo. Straight front view with slight view of top of cap. Compact wide jar proportions, height 1.45 times width. Fill 85 percent of frame. Soft studio light upper left, realistic plastic material and subtle contact shadow. Transparent background. No text, no brand logo, no quantity, no claims, no certification, no watermark, no additional objects. Fictional generic packaging used only as a clearly labeled illustrative asset.
```

## `public/images/charcoal-jar-demo.png`

가상 시연 제품 P06의 연출 이미지.

```text
Use case: product-mockup. Asset type: transparent small catalog product photograph for a fictional supplement demo app. A single blank matte charcoal black compact supplement jar, ribbed black screw lid, wide gently rounded cylindrical body, subtle shoulders. Short jar, height about 1.3 times width. Front view with top of cap slightly visible. Realistic dark plastic material and studio reflections, soft light upper left and subtle contact shadow. Actual transparent background. Tightly framed with entire object visible. Premium photorealistic studio photograph. Fictional unbranded generic packaging for clearly disclosed illustrative use, no actual brand. No label, text, logo, quantities, claims, pills, extra objects or UI.
```

## `public/images/amber-bottle-demo.png`

홈 갤러리 및 가상 시연 제품 P08의 연출 이미지.

```text
Use case: product-mockup. Asset type: transparent catalog product photograph for a fictional supplement demo app. Subject: a single small premium amber brown glass vitamin bottle with a black ribbed screw cap, square rounded shoulders and realistic amber glass highlights. Completely blank without label, no visible pills. Front view with slight view of cap top. Height 1.9 times width, fills 85 percent of frame. Realistic materials, soft studio light from upper left, subtle contact shadow below. Isolated actual transparent background. Fictional unbranded generic illustrative packaging, not a real product. No text, no brand logo, no claims, no dosage, no watermark, no additional props, no UI.
```
