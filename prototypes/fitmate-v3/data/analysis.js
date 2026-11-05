// src/analysis/conditions.ts
var result = (status, reason) => ({
	status,
	reason
});
function evaluateCondition(condition, products) {
	if (!condition || typeof condition !== "object" || Array.isArray(condition)) return result("unsupported", "지원하지 않는 조건 구조입니다.");
	const item = condition;
	const has = (product, id) => product.ingredients.some((ingredient) => ingredient.registered && ingredient.id === id);
	switch (item.op) {
		case "active_entities_present":
			if (!Array.isArray(item.entity_ids) || !item.entity_ids.length || !item.entity_ids.every((id) => typeof id === "string")) return result("unsupported", "성분 ID 목록이 올바르지 않습니다.");
			if (Object.keys(item).some((key) => ![
				"op",
				"entity_ids",
				"ingredient_scope",
				"qualifier"
			].includes(key))) return result("unsupported", "알 수 없는 추가 성분 조건이 있습니다.");
			if (!item.entity_ids.every((id) => products.some((product) => has(product, id)))) return result("not_met", "필요한 등록 성분이 모두 확인되지 않았습니다.");
			if ("ingredient_scope" in item || "qualifier" in item) return result("unknown", "제품 범위·섭취 변경 이력이 없어 추가 조건을 판정하지 않았습니다.");
			return result("met", "필요한 등록 성분의 존재를 확인했습니다.");
		case "distinct_products_same_ingredient":
			if (typeof item.ingredient_id !== "string" || !Number.isInteger(item.min_products) || Number(item.min_products) < 2) return result("unsupported", "서로 다른 제품 수 조건이 올바르지 않습니다.");
			if (Object.keys(item).some((key) => ![
				"op",
				"ingredient_id",
				"min_products",
				"window"
			].includes(key))) return result("unsupported", "알 수 없는 추가 중복 조건이 있습니다.");
			if (products.filter((product) => has(product, item.ingredient_id)).length < Number(item.min_products)) return result("not_met", "해당 성분을 포함한 서로 다른 제품 수가 조건보다 적습니다.");
			if ("window" in item) return result("unknown", "동일 성분은 확인했지만 실제 같은 날 섭취했는지는 알 수 없습니다.");
			return result("met", "서로 다른 제품에 등록된 동일 성분을 확인했습니다.");
		case "oral_drug_separation": return result("unknown", "복용 시간·제형·라벨 확인 정보가 없어 시간 간격의 충족 여부를 계산하지 않았습니다.");
		default: return result("unsupported", `지원하지 않는 조건 연산자: ${typeof item.op === "string" ? item.op : "미지정"}`);
	}
}
// src/analysis/scoring.ts
var SCORING_POLICY = {
	version: "demo-comparison-v1",
	baseline: 100,
	weights: {
		info: 3,
		caution: 12,
		high: 25
	}
};
function scoreFindings(findings, canCompare) {
	const causes = /* @__PURE__ */ new Map();
	for (const finding of findings) {
		const points = SCORING_POLICY.weights[finding.severity];
		const existing = causes.get(finding.causeKey);
		if (!existing) causes.set(finding.causeKey, {
			causeKey: finding.causeKey,
			ingredientNames: finding.ingredientNames,
			severity: finding.severity,
			points,
			ruleIds: [finding.ruleId],
			productPairs: [finding.productIds]
		});
		else {
			if (points > existing.points) {
				existing.points = points;
				existing.severity = finding.severity;
			}
			if (!existing.ruleIds.includes(finding.ruleId)) existing.ruleIds.push(finding.ruleId);
			if (!existing.productPairs.some((pair) => pair[0] === finding.productIds[0] && pair[1] === finding.productIds[1])) existing.productPairs.push(finding.productIds);
		}
	}
	const deductions = [...causes.values()].sort((a, b) => a.causeKey.localeCompare(b.causeKey));
	for (const deduction of deductions) deduction.ruleIds.sort();
	const rawDeduction = deductions.reduce((sum, deduction) => sum + deduction.points, 0);
	return {
		value: canCompare ? Math.max(0, SCORING_POLICY.baseline - rawDeduction) : null,
		baseline: SCORING_POLICY.baseline,
		rawDeduction,
		deductions,
		policyVersion: SCORING_POLICY.version
	};
}
// src/analysis/engine.ts
var severities = /* @__PURE__ */ new Set([
	"info",
	"caution",
	"high"
]);
var causeKeyFor = (a, b) => JSON.stringify([a, b].sort());
var safeUrls = (urls = []) => [...new Set(urls.filter((url) => {
	try {
		return new URL(url).protocol === "https:";
	} catch {
		return false;
	}
}))].sort();
function analyzeCart(cart, dataset) {
	const issues = [];
	const ingredientById = new Map(dataset.ingredients.map((ingredient) => [ingredient.id, ingredient]));
	const catalog = new Map(dataset.products.map((product) => [product.product_id, product]));
	const quantities = /* @__PURE__ */ new Map();
	for (const item of cart) {
		if (!item || typeof item.productId !== "string" || !Number.isSafeInteger(item.quantity) || item.quantity < 1) {
			issues.push({
				code: "invalid_cart_item",
				message: "올바르지 않은 제품 또는 용기 수량을 분석에서 제외했습니다."
			});
			continue;
		}
		const total = (quantities.get(item.productId) ?? 0) + item.quantity;
		if (!Number.isSafeInteger(total)) {
			issues.push({
				code: "invalid_quantity",
				productId: item.productId,
				message: "용기 수량 범위를 확인할 수 없습니다."
			});
			continue;
		}
		quantities.set(item.productId, total);
	}
	const products = [...quantities].sort(([a], [b]) => a.localeCompare(b)).map(([productId, quantity]) => {
		const product = catalog.get(productId);
		if (!product) issues.push({
			code: "unknown_product",
			productId,
			message: `${productId}: 등록된 제품 정보가 없어 확인하지 못했습니다.`
		});
		const sourceIngredients = product?.ingredients ?? [];
		if (!sourceIngredients.length) issues.push({
			code: "missing_ingredients",
			productId,
			message: `${product?.display_name ?? productId}: 성분 목록이 없어 일부 조합을 확인하지 못했습니다.`
		});
		const ingredients = sourceIngredients.map((ingredient) => {
			const definition = ingredientById.get(ingredient.ingredient_id);
			if (!definition) issues.push({
				code: "unknown_ingredient",
				productId,
				message: `${ingredient.ingredient_id}: 성분 ID가 등록되지 않아 임의로 매핑하지 않았습니다.`
			});
			const amountKnown = typeof ingredient.amount === "number" && Number.isFinite(ingredient.amount) && ingredient.amount >= 0 && typeof ingredient.unit === "string" && ingredient.unit.trim().length > 0;
			if (!amountKnown) issues.push({
				code: "unknown_amount",
				productId,
				message: `${definition?.name_ko ?? ingredient.ingredient_id}: 성분 함량 또는 단위가 없어 정량 판정을 하지 않았습니다.`
			});
			return {
				id: ingredient.ingredient_id,
				name: definition?.name_ko ?? ingredient.ingredient_id,
				registered: Boolean(definition),
				amount: amountKnown ? ingredient.amount : null,
				unit: amountKnown ? ingredient.unit : null
			};
		});
		return {
			productId,
			displayName: product?.display_name ?? productId,
			category: product?.category ?? "unknown",
			quantity,
			ingredients
		};
	});
	const knownIds = (product) => new Set(product.ingredients.filter((ingredient) => ingredient.registered).map((ingredient) => ingredient.id));
	const findingByKey = /* @__PURE__ */ new Map();
	const duplicateById = /* @__PURE__ */ new Map();
	const skippedRules = /* @__PURE__ */ new Set();
	let evaluatedPairs = 0;
	for (let i = 0; i < products.length; i++) for (let j = i + 1; j < products.length; j++) {
		const a = products[i], b = products[j], aIds = knownIds(a), bIds = knownIds(b);
		if (!aIds.size || !bIds.size) continue;
		evaluatedPairs++;
		for (const id of aIds) {
			if (!bIds.has(id)) continue;
			const duplicate = duplicateById.get(id) ?? {
				ingredientId: id,
				name: ingredientById.get(id).name_ko,
				productIds: [],
				ruleIds: []
			};
			duplicate.productIds = [.../* @__PURE__ */ new Set([
				...duplicate.productIds,
				a.productId,
				b.productId
			])].sort();
			duplicateById.set(id, duplicate);
		}
		for (const rule of dataset.rules) {
			if (!(aIds.has(rule.ingredient_a) && bIds.has(rule.ingredient_b) || aIds.has(rule.ingredient_b) && bIds.has(rule.ingredient_a))) continue;
			const skip = (message) => {
				if (!skippedRules.has(rule.rule_id)) issues.push({
					code: "unsupported_rule",
					ruleId: rule.rule_id,
					message
				});
				skippedRules.add(rule.rule_id);
			};
			if (rule.match !== "different_cart_products_contain_each_ingredient" || rule.symmetric !== true || !severities.has(rule.severity) || !["duplicate_ingredient", "interaction_review"].includes(rule.alert_type)) {
				skip(`${rule.rule_id}: 미지원 매칭 방식·방향·severity·알림 유형이 있어 적용하지 않았습니다.`);
				continue;
			}
			if (rule.conditions !== void 0 || rule.trigger !== void 0) {
				skip(`${rule.rule_id}: 미지원 필수 조건 구조가 있어 적용하지 않았습니다.`);
				continue;
			}
			if (rule.condition !== void 0) {
				const required = evaluateCondition(rule.condition, products);
				if (required.status === "not_met") continue;
				if (required.status !== "met") {
					skip(`${rule.rule_id}: ${required.reason} 필수 조건을 확인할 수 없어 적용하지 않았습니다.`);
					continue;
				}
			}
			const productIds = [a.productId, b.productId];
			const key = JSON.stringify([rule.rule_id, ...productIds]);
			if (findingByKey.has(key)) continue;
			const ids = [rule.ingredient_a, rule.ingredient_b].sort();
			const medicationRelated = [a, b].some((product) => product.category === "medication") || ids.some((id) => ingredientById.get(id)?.kind.startsWith("medication"));
			const detailedEvaluation = rule.original_condition_for_optional_detailed_evaluation === void 0 ? {
				status: "unknown",
				reason: "별도 상세 조건이 등록되지 않았으며 실제 복용 상황은 확인하지 않았습니다."
			} : evaluateCondition(rule.original_condition_for_optional_detailed_evaluation, products);
			findingByKey.set(key, {
				key,
				causeKey: causeKeyFor(...ids),
				ruleId: rule.rule_id,
				ingredientIds: ids,
				ingredientNames: ids.map((id) => ingredientById.get(id).name_ko),
				productIds,
				severity: rule.severity,
				kind: rule.alert_type === "duplicate_ingredient" ? "duplicate" : "interaction",
				medicationRelated,
				title: rule.title,
				message: rule.message,
				triggerMeaning: rule.trigger_meaning ?? "등록된 성분 관계의 검토 안내이며 부작용 발생을 확정하지 않습니다.",
				evidenceLevel: rule.evidence_level ?? null,
				sourceUrls: safeUrls(rule.source_urls),
				detailedEvaluation
			});
			if (ids[0] === ids[1]) {
				const duplicate = duplicateById.get(ids[0]);
				if (duplicate && !duplicate.ruleIds.includes(rule.rule_id)) duplicate.ruleIds.push(rule.rule_id);
			}
		}
	}
	const findings = [...findingByKey.values()].sort((a, b) => a.key.localeCompare(b.key));
	const duplicates = [...duplicateById.values()].sort((a, b) => a.ingredientId.localeCompare(b.ingredientId));
	const coverage = {
		totalPairs: products.length * (products.length - 1) / 2,
		evaluatedPairs,
		unknownAmounts: issues.filter((issue) => issue.code === "unknown_amount").length,
		ingredientEntries: products.reduce((count, product) => count + product.ingredients.length, 0),
		missingIngredientProducts: products.filter((product) => !product.ingredients.length).length,
		unregisteredIngredients: issues.filter((issue) => issue.code === "unknown_ingredient").length,
		skippedRules: skippedRules.size
	};
	return {
		products,
		findings,
		duplicates,
		issues,
		deferredRules: dataset.deferredRules.map((rule) => ({
			...rule,
			sourceUrls: safeUrls(rule.sourceUrls)
		})),
		coverage,
		score: scoreFindings(findings, evaluatedPairs > 0 && skippedRules.size === 0),
		fingerprint: JSON.stringify({
			products: products.map((product) => [product.productId, product.quantity]),
			versions: dataset.versions
		})
	};
}
var cart_interactions_dataset_default = {
	dataset_version: "cart-pairs-1.0",
	language: "ko",
	purpose: "미리 등록한 제품을 장바구니에 담으면 성분 조합에 해당하는 경고 문구를 출력",
	scope_notes: [
		"제품 예시는 가상의 시연용 구성. 실제 브랜드 또는 실제 라벨을 나타내지 않음.",
		"약물은 기존 복용약 또는 병용 확인 대상으로 등록.",
		"경고는 동시 사용 계획을 확인하라는 의미. 존재만으로 독성이나 부작용을 확정하지 않음.",
		"약물 계열 ID는 관리자가 검증한 계열 매핑에만 사용. 약 이름을 부분 문자열로 매칭하지 않음.",
		"칼륨·미네랄이 첨가된 제품은 포함된 해당 성분으로 매칭. 단백질 자체에 혈압약 충돌 규칙을 만들지 않음."
	],
	ingredients: [
		{
			"id": "caffeine",
			"name_ko": "카페인",
			"name_en": "Caffeine",
			"kind": "supplement_ingredient"
		},
		{
			"id": "guarana",
			"name_ko": "과라나",
			"name_en": "Guarana",
			"kind": "supplement_ingredient"
		},
		{
			"id": "synephrine",
			"name_ko": "p-시네프린",
			"name_en": "p-Synephrine",
			"kind": "supplement_ingredient"
		},
		{
			"id": "yohimbine",
			"name_ko": "요힘빈",
			"name_en": "Yohimbine",
			"kind": "supplement_ingredient"
		},
		{
			"id": "maoi",
			"name_ko": "모노아민 산화효소 억제제",
			"name_en": "MAOI",
			"kind": "medication_class"
		},
		{
			"id": "pseudoephedrine",
			"name_ko": "슈도에페드린",
			"name_en": "Pseudoephedrine",
			"kind": "medication_active_ingredient"
		},
		{
			"id": "calcium",
			"name_ko": "칼슘",
			"name_en": "Calcium",
			"kind": "supplement_ingredient"
		},
		{
			"id": "levothyroxine",
			"name_ko": "레보티록신",
			"name_en": "Levothyroxine",
			"kind": "medication_active_ingredient"
		},
		{
			"id": "iron",
			"name_ko": "철",
			"name_en": "Iron",
			"kind": "supplement_ingredient"
		},
		{
			"id": "magnesium",
			"name_ko": "마그네슘",
			"name_en": "Magnesium",
			"kind": "supplement_ingredient"
		},
		{
			"id": "vitamin_d",
			"name_ko": "비타민 D",
			"name_en": "Vitamin D",
			"kind": "supplement_ingredient"
		},
		{
			"id": "vitamin_b6",
			"name_ko": "비타민 B6",
			"name_en": "Vitamin B6",
			"kind": "supplement_ingredient"
		},
		{
			"id": "zinc",
			"name_ko": "아연",
			"name_en": "Zinc",
			"kind": "supplement_ingredient"
		},
		{
			"id": "niacin",
			"name_ko": "나이아신",
			"name_en": "Niacin",
			"kind": "supplement_ingredient"
		},
		{
			"id": "vitamin_a",
			"name_ko": "비타민 A",
			"name_en": "Vitamin A",
			"kind": "supplement_ingredient"
		},
		{
			"id": "creatine",
			"name_ko": "크레아틴",
			"name_en": "Creatine monohydrate",
			"kind": "supplement_ingredient"
		},
		{
			"id": "beta_alanine",
			"name_ko": "베타알라닌",
			"name_en": "Beta-alanine",
			"kind": "supplement_ingredient"
		},
		{
			"id": "tca",
			"name_ko": "삼환계 항우울제",
			"name_en": "Tricyclic antidepressant",
			"kind": "medication_class"
		},
		{
			"id": "dmaa",
			"name_ko": "DMAA",
			"name_en": "1,3-Dimethylamylamine",
			"kind": "supplement_ingredient"
		},
		{
			"id": "amphetamine",
			"name_ko": "암페타민계 혼합염 제품",
			"name_en": "Mixed amphetamine salts",
			"kind": "medication_active_ingredient"
		},
		{
			"id": "ciprofloxacin",
			"name_ko": "시프로플록사신 경구제",
			"name_en": "Oral ciprofloxacin",
			"kind": "medication_active_ingredient"
		},
		{
			"id": "potassium",
			"name_ko": "칼륨",
			"name_en": "Potassium",
			"kind": "supplement_ingredient"
		},
		{
			"id": "spironolactone",
			"name_ko": "스피로놀락톤",
			"name_en": "Spironolactone",
			"kind": "medication_active_ingredient"
		},
		{
			"id": "acei",
			"name_ko": "ACE 억제제",
			"name_en": "ACE inhibitor",
			"kind": "medication_class"
		},
		{
			"id": "vitamin_k",
			"name_ko": "비타민 K",
			"name_en": "Vitamin K",
			"kind": "supplement_ingredient"
		},
		{
			"id": "warfarin",
			"name_ko": "와파린",
			"name_en": "Warfarin",
			"kind": "medication_active_ingredient"
		},
		{
			"id": "omega3",
			"name_ko": "오메가3",
			"name_en": "Omega-3 fatty acids",
			"kind": "supplement_ingredient"
		},
		{
			"id": "isotretinoin",
			"name_ko": "이소트레티노인 경구제",
			"name_en": "Oral isotretinoin",
			"kind": "medication_active_ingredient"
		},
		{
			"id": "thiazide",
			"name_ko": "티아지드 이뇨제",
			"name_en": "Thiazide diuretic",
			"kind": "medication_class"
		},
		{
			"id": "vitamin_e",
			"name_ko": "비타민 E",
			"name_en": "Vitamin E",
			"kind": "supplement_ingredient"
		},
		{
			"id": "arb",
			"name_ko": "안지오텐신 수용체 차단제",
			"name_en": "ARB",
			"kind": "medication_class"
		},
		{
			"id": "folate",
			"name_ko": "엽산",
			"name_en": "Folate",
			"kind": "supplement_ingredient"
		},
		{
			"id": "protein",
			"name_ko": "유청·카제인 단백질",
			"name_en": "Milk protein",
			"kind": "supplement_ingredient"
		}
	],
	products: [
		{
			"product_id": "P01",
			"display_name": "시연용 프로틴 A — 유단백질 단일 구성",
			"category": "supplement",
			"is_demo": true,
			"composition_status": "fictional_declared_for_demo",
			"ingredients": [{
				"ingredient_id": "protein",
				"amount": null,
				"unit": null
			}]
		},
		{
			"product_id": "P02",
			"display_name": "시연용 프로틴 B — 칼슘 첨가 구성",
			"category": "supplement",
			"is_demo": true,
			"composition_status": "fictional_declared_for_demo",
			"ingredients": [{
				"ingredient_id": "protein",
				"amount": null,
				"unit": null
			}, {
				"ingredient_id": "calcium",
				"amount": null,
				"unit": null
			}]
		},
		{
			"product_id": "P03",
			"display_name": "시연용 프로틴 C — 칼륨 첨가 구성",
			"category": "supplement",
			"is_demo": true,
			"composition_status": "fictional_declared_for_demo",
			"ingredients": [{
				"ingredient_id": "protein",
				"amount": null,
				"unit": null
			}, {
				"ingredient_id": "potassium",
				"amount": null,
				"unit": null
			}]
		},
		{
			"product_id": "P04",
			"display_name": "시연용 카페인 부스터",
			"category": "supplement",
			"is_demo": true,
			"composition_status": "fictional_declared_for_demo",
			"ingredients": [{
				"ingredient_id": "caffeine",
				"amount": null,
				"unit": null
			}]
		},
		{
			"product_id": "P05",
			"display_name": "시연용 카페인 에너지음료",
			"category": "supplement",
			"is_demo": true,
			"composition_status": "fictional_declared_for_demo",
			"ingredients": [{
				"ingredient_id": "caffeine",
				"amount": null,
				"unit": null
			}]
		},
		{
			"product_id": "P06",
			"display_name": "시연용 마그네슘제",
			"category": "supplement",
			"is_demo": true,
			"composition_status": "fictional_declared_for_demo",
			"ingredients": [{
				"ingredient_id": "magnesium",
				"amount": null,
				"unit": null
			}]
		},
		{
			"product_id": "P07",
			"display_name": "시연용 철분제",
			"category": "supplement",
			"is_demo": true,
			"composition_status": "fictional_declared_for_demo",
			"ingredients": [{
				"ingredient_id": "iron",
				"amount": null,
				"unit": null
			}]
		},
		{
			"product_id": "P08",
			"display_name": "시연용 종합비타민",
			"category": "supplement",
			"is_demo": true,
			"composition_status": "fictional_declared_for_demo",
			"ingredients": [
				{
					"ingredient_id": "vitamin_d",
					"amount": null,
					"unit": null
				},
				{
					"ingredient_id": "vitamin_b6",
					"amount": null,
					"unit": null
				},
				{
					"ingredient_id": "iron",
					"amount": null,
					"unit": null
				}
			]
		},
		{
			"product_id": "P09",
			"display_name": "시연용 비타민 D",
			"category": "supplement",
			"is_demo": true,
			"composition_status": "fictional_declared_for_demo",
			"ingredients": [{
				"ingredient_id": "vitamin_d",
				"amount": null,
				"unit": null
			}]
		},
		{
			"product_id": "P10",
			"display_name": "시연용 아연제",
			"category": "supplement",
			"is_demo": true,
			"composition_status": "fictional_declared_for_demo",
			"ingredients": [{
				"ingredient_id": "zinc",
				"amount": null,
				"unit": null
			}]
		},
		{
			"product_id": "M01",
			"display_name": "시연용 스피로놀락톤 경구제",
			"category": "medication",
			"is_demo": true,
			"composition_status": "fictional_declared_for_demo",
			"ingredients": [{
				"ingredient_id": "spironolactone",
				"amount": null,
				"unit": null
			}]
		},
		{
			"product_id": "M02",
			"display_name": "시연용 레보티록신 경구제",
			"category": "medication",
			"is_demo": true,
			"composition_status": "fictional_declared_for_demo",
			"ingredients": [{
				"ingredient_id": "levothyroxine",
				"amount": null,
				"unit": null
			}]
		},
		{
			"product_id": "M03",
			"display_name": "시연용 시프로플록사신 경구제 경구제",
			"category": "medication",
			"is_demo": true,
			"composition_status": "fictional_declared_for_demo",
			"ingredients": [{
				"ingredient_id": "ciprofloxacin",
				"amount": null,
				"unit": null
			}]
		},
		{
			"product_id": "M04",
			"display_name": "시연용 슈도에페드린 경구제",
			"category": "medication",
			"is_demo": true,
			"composition_status": "fictional_declared_for_demo",
			"ingredients": [{
				"ingredient_id": "pseudoephedrine",
				"amount": null,
				"unit": null
			}]
		},
		{
			"product_id": "M05",
			"display_name": "시연용 와파린 경구제",
			"category": "medication",
			"is_demo": true,
			"composition_status": "fictional_declared_for_demo",
			"ingredients": [{
				"ingredient_id": "warfarin",
				"amount": null,
				"unit": null
			}]
		},
		{
			"product_id": "M06",
			"display_name": "시연용 이소트레티노인 경구제 경구제",
			"category": "medication",
			"is_demo": true,
			"composition_status": "fictional_declared_for_demo",
			"ingredients": [{
				"ingredient_id": "isotretinoin",
				"amount": null,
				"unit": null
			}]
		},
		{
			"product_id": "M07",
			"display_name": "시연용 ACE 억제제 계열 등록 예시",
			"category": "medication",
			"is_demo": true,
			"composition_status": "fictional_declared_for_demo",
			"ingredients": [{
				"ingredient_id": "acei",
				"amount": null,
				"unit": null
			}]
		}
	],
	interaction_rules: [
		{
			"rule_id": "R01",
			"ingredient_a": "caffeine",
			"ingredient_b": "caffeine",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "duplicate_ingredient",
			"severity": "info",
			"title": "동일 성분 포함",
			"message": "커피와 부스터의 카페인이 합쳐집니다. 오늘 마신 음료와 운동 전 제품을 함께 확인하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "카페인 합산으로 불면·두근거림 가능",
			"clinical_conditions": "동시 섭취, 누적량, 민감도",
			"dose_and_timing_note": "KR 400 mg/일, EU 200 mg/회·400 mg/일 참고",
			"evidence_level": "높음",
			"source_urls": ["https://www.efsa.europa.eu/en/efsajournal/pub/4102", "https://www.mfds.go.kr/brd/m_227/view.do?itm_seq_1=0&itm_seq_2=0&multi_itm_seq=0&page=11&seq=27563"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "distinct_products_same_ingredient",
				"ingredient_id": "caffeine",
				"min_products": 2,
				"window": "local_day"
			}
		},
		{
			"rule_id": "R02",
			"ingredient_a": "caffeine",
			"ingredient_b": "guarana",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "caution",
			"title": "함께 복용하기 전 확인",
			"message": "과라나에도 카페인이 들어 있습니다. 제품에 카페인 총량이 표시돼 있는지 확인하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "과라나는 카페인 급원이라 누적량 증가",
			"clinical_conditions": "추출물 함량만 표시되거나 총 카페인과 이중 집계",
			"dose_and_timing_note": "제품의 총 카페인 또는 검증된 함량·함유율",
			"evidence_level": "높음",
			"source_urls": ["https://www.efsa.europa.eu/en/efsajournal/pub/4102", "https://www.anses.fr/system/files/NUT2012sa0200EN.pdf"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "active_entities_present",
				"entity_ids": ["caffeine", "guarana"]
			}
		},
		{
			"rule_id": "R03",
			"ingredient_a": "synephrine",
			"ingredient_b": "caffeine",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "high",
			"title": "함께 복용하기 전 확인",
			"message": "시네프린과 카페인이 같이 들어 있습니다. 운동 전에는 이 조합을 피하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "심혈관 부담 가능. 병용 위해 크기 불확실",
			"clinical_conditions": "운동 중 또는 전후, 심혈관질환",
			"dose_and_timing_note": "ANSES 병용 회피 권고. 병용량 컷오프 없음",
			"evidence_level": "중간",
			"source_urls": ["https://www.anses.fr/system/files/NUT2012sa0200EN.pdf", "https://www.nccih.nih.gov/health/bitter-orange"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "active_entities_present",
				"entity_ids": ["synephrine", "caffeine"]
			}
		},
		{
			"rule_id": "R04",
			"ingredient_a": "yohimbine",
			"ingredient_b": "maoi",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "high",
			"title": "함께 복용하기 전 확인",
			"message": "이 항우울제를 복용 중이라면 요힘베 제품을 추가하기 전에 약사에게 확인하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "교감신경성 이상반응과 혈압 상승 우려",
			"clinical_conditions": "요힘빈 함량 불명·활성 MAOI 치료",
			"dose_and_timing_note": "NCCIH 병용 회피. 용량 컷오프 없음",
			"evidence_level": "중간",
			"source_urls": ["https://www.nccih.nih.gov/health/yohimbe/"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "active_entities_present",
				"entity_ids": ["yohimbine", "maoi"]
			}
		},
		{
			"rule_id": "R05",
			"ingredient_a": "caffeine",
			"ingredient_b": "pseudoephedrine",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "caution",
			"title": "함께 복용하기 전 확인",
			"message": "코막힘 약과 부스터를 함께 쓰면 잠들기 어렵거나 두근거릴 수 있습니다. 약사에게 성분표를 보여 주세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "불면·떨림·두근거림의 상가 가능성",
			"clinical_conditions": "고카페인, 각성제 민감, 고혈압",
			"dose_and_timing_note": "정량 기준 근거 부족",
			"evidence_level": "이론적 가능성",
			"source_urls": ["https://www.nhs.uk/medicines/pseudoephedrine/", "https://www.efsa.europa.eu/en/efsajournal/pub/4102"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "active_entities_present",
				"entity_ids": ["caffeine", "pseudoephedrine"]
			}
		},
		{
			"rule_id": "R06",
			"ingredient_a": "calcium",
			"ingredient_b": "levothyroxine",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "caution",
			"title": "함께 복용하기 전 확인",
			"message": "칼슘제가 갑상선약 흡수를 줄일 수 있습니다. 이 약의 라벨은 4시간 이상 간격을 안내합니다.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "동시 섭취 시 약 흡수 저하",
			"clinical_conditions": "칼슘 보충제·칼슘 함유 종합비타민",
			"dose_and_timing_note": "SYNTHROID 라벨 양방향 ≥4시간",
			"evidence_level": "높음",
			"source_urls": ["https://www.dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b9aea421-ae9b-439a-90a3-07a0a50e835d", "https://ods.od.nih.gov/factsheets/calcium-HealthProfessional/"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "oral_drug_separation",
				"drug_id": "levothyroxine",
				"other_id": "calcium",
				"min_hours_drug_before_other": 4,
				"min_hours_drug_after_other": 4,
				"when_time_unknown": "timing_unknown_review",
				"ingredient_scope": "supplement_antacid_or_matching_drug_label_form",
				"timing_basis": "product_specific_oral_label",
				"label_reference_source_id": "thy",
				"at_exact_boundary": "meets_interval"
			}
		},
		{
			"rule_id": "R07",
			"ingredient_a": "iron",
			"ingredient_b": "levothyroxine",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "caution",
			"title": "함께 복용하기 전 확인",
			"message": "철분제가 갑상선약 흡수를 줄일 수 있습니다. 이 약의 라벨은 4시간 이상 간격을 안내합니다.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "철과 약이 결합해 흡수 저하",
			"clinical_conditions": "철분제·철 함유 종합비타민",
			"dose_and_timing_note": "SYNTHROID 라벨 양방향 ≥4시간",
			"evidence_level": "높음",
			"source_urls": ["https://www.dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b9aea421-ae9b-439a-90a3-07a0a50e835d", "https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "oral_drug_separation",
				"drug_id": "levothyroxine",
				"other_id": "iron",
				"min_hours_drug_before_other": 4,
				"min_hours_drug_after_other": 4,
				"when_time_unknown": "timing_unknown_review",
				"ingredient_scope": "supplement_antacid_or_matching_drug_label_form",
				"timing_basis": "product_specific_oral_label",
				"label_reference_source_id": "thy",
				"at_exact_boundary": "meets_interval"
			}
		},
		{
			"rule_id": "R08",
			"ingredient_a": "magnesium",
			"ingredient_b": "magnesium",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "duplicate_ingredient",
			"severity": "info",
			"title": "동일 성분 포함",
			"message": "마그네슘 보충제와 일부 제산제에는 같은 성분이 들어 있습니다. 라벨의 마그네슘 양을 합쳐 확인하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "비식품 유래 원소 마그네슘 누적·설사",
			"clinical_conditions": "신기능 저하, 여러 보충제 또는 의약품",
			"dose_and_timing_note": "KR·US 350 mg/일 UL, 보충제와 의약품",
			"evidence_level": "높음",
			"source_urls": ["https://health.seoulmc.or.kr/uploadFiles/2025_%ED%95%9C%EA%B5%AD%EC%9D%B8%EC%98%81%EC%96%91%EC%86%8C%EC%84%AD%EC%B7%A8%EA%B8%B0%EC%A4%80_%ED%99%9C%EC%9A%A9.pdf", "https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "distinct_products_same_ingredient",
				"ingredient_id": "magnesium",
				"min_products": 2,
				"window": "local_day"
			}
		},
		{
			"rule_id": "R09",
			"ingredient_a": "vitamin_d",
			"ingredient_b": "vitamin_d",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "duplicate_ingredient",
			"severity": "info",
			"title": "동일 성분 포함",
			"message": "종합비타민에도 비타민 D가 들어 있을 수 있습니다. 단일 제품과 함께 하루 총량을 확인하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "과량이 지속되면 고칼슘혈증",
			"clinical_conditions": "고함량 중복, 신장질환",
			"dose_and_timing_note": "KR·US 100 µg/일 총량 UL",
			"evidence_level": "높음",
			"source_urls": ["https://health.seoulmc.or.kr/uploadFiles/2025_%ED%95%9C%EA%B5%AD%EC%9D%B8%EC%98%81%EC%96%91%EC%86%8C%EC%84%AD%EC%B7%A8%EA%B8%B0%EC%A4%80_%ED%99%9C%EC%9A%A9.pdf", "https://ods.od.nih.gov/factsheets/Vitamind-HealthProfessional/"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "distinct_products_same_ingredient",
				"ingredient_id": "vitamin_d",
				"min_products": 2,
				"window": "local_day"
			}
		},
		{
			"rule_id": "R11",
			"ingredient_a": "vitamin_b6",
			"ingredient_b": "vitamin_b6",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "duplicate_ingredient",
			"severity": "info",
			"title": "동일 성분 포함",
			"message": "손발 저림은 비타민 B6 과다 섭취와 관련될 수 있습니다. 매일 먹는 제품의 B6를 합쳐 보세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "만성 중복이 말초신경 손상 위험 증가",
			"clinical_conditions": "매일 반복, 총량 미기록",
			"dose_and_timing_note": "KR 50, US 100, EU 12 mg/일 UL",
			"evidence_level": "높음",
			"source_urls": [
				"https://health.seoulmc.or.kr/uploadFiles/2025_%ED%95%9C%EA%B5%AD%EC%9D%B8%EC%98%81%EC%96%91%EC%86%8C%EC%84%AD%EC%B7%A8%EA%B8%B0%EC%A4%80_%ED%99%9C%EC%9A%A9.pdf",
				"https://ods.od.nih.gov/factsheets/VitaminB6-HealthProfessional/?uid=c693f1ef99748s16",
				"https://www.efsa.europa.eu/sites/default/files/2023-11/ul_summary_tables-version-8.pdf",
				"https://ods.od.nih.gov/factsheets/MVMS-HealthProfessional/"
			],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "distinct_products_same_ingredient",
				"ingredient_id": "vitamin_b6",
				"min_products": 2,
				"window": "local_day"
			}
		},
		{
			"rule_id": "R12",
			"ingredient_a": "zinc",
			"ingredient_b": "zinc",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "duplicate_ingredient",
			"severity": "info",
			"title": "동일 성분 포함",
			"message": "아연을 여러 제품에서 꾸준히 많이 먹으면 구리 섭취 상태에 영향을 줄 수 있습니다.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "장기간 과다 시 구리 흡수 저하",
			"clinical_conditions": "높은 용량을 수주 이상",
			"dose_and_timing_note": "KR 35, US 40 mg/일 총량 UL",
			"evidence_level": "높음",
			"source_urls": ["https://health.seoulmc.or.kr/uploadFiles/2025_%ED%95%9C%EA%B5%AD%EC%9D%B8%EC%98%81%EC%96%91%EC%86%8C%EC%84%AD%EC%B7%A8%EA%B8%B0%EC%A4%80_%ED%99%9C%EC%9A%A9.pdf", "https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "distinct_products_same_ingredient",
				"ingredient_id": "zinc",
				"min_products": 2,
				"window": "local_day"
			}
		},
		{
			"rule_id": "R13",
			"ingredient_a": "iron",
			"ingredient_b": "iron",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "duplicate_ingredient",
			"severity": "info",
			"title": "동일 성분 포함",
			"message": "두 제품에 모두 철분이 있는지 확인하세요. 처방받은 철분은 약사나 의사와 상의해 조정하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "철 중복, 변비·오심 또는 과량 독성",
			"clinical_conditions": "철 과부하, 고용량 복용",
			"dose_and_timing_note": "KR·US 45 mg/일 총량 UL. 처방 치료량 별도",
			"evidence_level": "높음",
			"source_urls": [
				"https://health.seoulmc.or.kr/uploadFiles/2025_%ED%95%9C%EA%B5%AD%EC%9D%B8%EC%98%81%EC%96%91%EC%86%8C%EC%84%AD%EC%B7%A8%EA%B8%B0%EC%A4%80_%ED%99%9C%EC%9A%A9.pdf",
				"https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/",
				"https://ods.od.nih.gov/factsheets/MVMS-HealthProfessional/"
			],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "distinct_products_same_ingredient",
				"ingredient_id": "iron",
				"min_products": 2,
				"window": "local_day"
			}
		},
		{
			"rule_id": "R14",
			"ingredient_a": "niacin",
			"ingredient_b": "niacin",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "duplicate_ingredient",
			"severity": "info",
			"title": "동일 성분 포함",
			"message": "부스터와 비타민에 나이아신이 겹칠 수 있습니다. 라벨에서 함량과 형태를 확인하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "첨가 나이아신 누적, 니코틴산 홍조",
			"clinical_conditions": "화학 형태 불명·고함량",
			"dose_and_timing_note": "미국 첨가형 35 mg/일 UL",
			"evidence_level": "높음",
			"source_urls": ["https://ods.od.nih.gov/factsheets/Niacin-HealthProfessional/?uid=603ca288f70b9s16"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "distinct_products_same_ingredient",
				"ingredient_id": "niacin",
				"min_products": 2,
				"window": "local_day"
			}
		},
		{
			"rule_id": "R15",
			"ingredient_a": "vitamin_a",
			"ingredient_b": "vitamin_a",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "duplicate_ingredient",
			"severity": "info",
			"title": "동일 성분 포함",
			"message": "두 제품에 레티놀 형태의 비타민 A가 있는지 확인하세요. 임신 중이라면 제품을 추가하기 전에 상담하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "전형성 A 과다, 간 이상·태아 위험",
			"clinical_conditions": "레티놀형, 임신, 장기 고섭취",
			"dose_and_timing_note": "KR·US 전형성 A 3000 µg RAE/일 UL",
			"evidence_level": "높음",
			"source_urls": [
				"https://health.seoulmc.or.kr/uploadFiles/2025_%ED%95%9C%EA%B5%AD%EC%9D%B8%EC%98%81%EC%96%91%EC%86%8C%EC%84%AD%EC%B7%A8%EA%B8%B0%EC%A4%80_%ED%99%9C%EC%9A%A9.pdf",
				"https://ods.od.nih.gov/factsheets/VitaminA-HealthProfessional/",
				"https://ods.od.nih.gov/factsheets/MVMS-HealthProfessional/"
			],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "distinct_products_same_ingredient",
				"ingredient_id": "vitamin_a",
				"min_products": 2,
				"window": "local_day"
			}
		},
		{
			"rule_id": "R16",
			"ingredient_a": "creatine",
			"ingredient_b": "creatine",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "duplicate_ingredient",
			"severity": "info",
			"title": "동일 성분 포함",
			"message": "부스터에도 크레아틴이 들어 있을 수 있습니다. 단일 제품과 중복되는지 확인하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "동일 성분 누적, 위장 불편 가능",
			"clinical_conditions": "여러 스쿱·로딩과 중복",
			"dose_and_timing_note": "유지 연구 3–5 g/일. UL 미설정",
			"evidence_level": "높음",
			"source_urls": [
				"https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance-HealthProfessional/",
				"https://pmc.ncbi.nlm.nih.gov/articles/PMC9261739/",
				"https://www.foodsafetykorea.go.kr/portal/healthyfoodlife/searchHomeHFDetail.do?prdlstReportLedgNo=2022021000191767"
			],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "distinct_products_same_ingredient",
				"ingredient_id": "creatine",
				"min_products": 2,
				"window": "local_day"
			}
		},
		{
			"rule_id": "R17",
			"ingredient_a": "beta_alanine",
			"ingredient_b": "beta_alanine",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "duplicate_ingredient",
			"severity": "info",
			"title": "동일 성분 포함",
			"message": "베타알라닌이 두 제품에 겹치면 피부가 따끔거리거나 저릴 수 있습니다.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "1회 섭취량 증가로 일시 저림 가능",
			"clinical_conditions": "같은 섭취 이벤트, 빠른 방출 제형",
			"dose_and_timing_note": "연구 분할량 ≤2 g은 공식 1회 상한과 별개",
			"evidence_level": "높음",
			"source_urls": ["https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance-HealthProfessional/"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "distinct_products_same_ingredient",
				"ingredient_id": "beta_alanine",
				"min_products": 2,
				"window": "local_day"
			}
		},
		{
			"rule_id": "R18",
			"ingredient_a": "yohimbine",
			"ingredient_b": "tca",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "high",
			"title": "함께 복용하기 전 확인",
			"message": "복용 중인 항우울제와 요힘베가 문제가 될 수 있습니다. 요힘베를 추가하기 전에 약사에게 확인하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "혈압·심박 관련 부작용 우려",
			"clinical_conditions": "활성 처방 및 요힘빈 함량 미확인",
			"dose_and_timing_note": "NCCIH 병용 회피",
			"evidence_level": "중간",
			"source_urls": ["https://www.nccih.nih.gov/health/yohimbe/"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "active_entities_present",
				"entity_ids": ["yohimbine", "tca"]
			}
		},
		{
			"rule_id": "R19",
			"ingredient_a": "dmaa",
			"ingredient_b": "caffeine",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "high",
			"title": "함께 복용하기 전 확인",
			"message": "DMAA가 확인된 제품은 피하세요. 카페인과 함께 섭취하면 심혈관 부작용이 우려됩니다.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "FDA가 병용 위험 경고. 혈압 상승·심혈관 이상 가능",
			"clinical_conditions": "동일 제품 또는 운동 전 병용",
			"dose_and_timing_note": "정량 기준 근거 부족",
			"evidence_level": "중간",
			"source_urls": ["https://www.fda.gov/food/information-select-dietary-supplement-ingredients-and-other-substances/dmaa-products-marketed-dietary-supplements", "https://www.wada-ama.org/sites/default/files/2025-09/2026list_en_final_clean_september_2025.pdf"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "active_entities_present",
				"entity_ids": ["dmaa", "caffeine"]
			}
		},
		{
			"rule_id": "R20",
			"ingredient_a": "caffeine",
			"ingredient_b": "amphetamine",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "caution",
			"title": "함께 복용하기 전 확인",
			"message": "처방 각성제와 카페인 부스터는 두근거림이나 불면을 더 느끼게 할 수 있습니다. 복용약은 그대로 두고 부스터를 추가하기 전 상담하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "심박·혈압·불면 증상이 겹칠 수 있음",
			"clinical_conditions": "심혈관질환·불면·민감도",
			"dose_and_timing_note": "정량 기준 근거 부족",
			"evidence_level": "이론적 가능성",
			"source_urls": ["https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=aff45863-ffe1-4d4f-8acf-c7081512a6c0", "https://www.efsa.europa.eu/en/efsajournal/pub/4102"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "active_entities_present",
				"entity_ids": ["caffeine", "amphetamine"]
			}
		},
		{
			"rule_id": "R23",
			"ingredient_a": "magnesium",
			"ingredient_b": "ciprofloxacin",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "caution",
			"title": "함께 복용하기 전 확인",
			"message": "마그네슘 제품이 항생제 흡수를 줄일 수 있습니다. 약사에게 섭취 시간표를 보여 주세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "복합체 형성으로 항생제 흡수 저하",
			"clinical_conditions": "경구제와 가까운 시간에 섭취",
			"dose_and_timing_note": "약을 미네랄보다 ≥2시간 전 또는 ≥6시간 후",
			"evidence_level": "높음",
			"source_urls": ["https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d358eb18-f4d0-e9ba-e053-2a95a90a435d"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "oral_drug_separation",
				"drug_id": "ciprofloxacin",
				"other_id": "magnesium",
				"min_hours_drug_before_other": 2,
				"min_hours_drug_after_other": 6,
				"when_time_unknown": "timing_unknown_review",
				"ingredient_scope": "supplement_antacid_or_matching_drug_label_form",
				"timing_basis": "product_specific_oral_label",
				"label_reference_source_id": "cip",
				"at_exact_boundary": "meets_interval"
			}
		},
		{
			"rule_id": "R24",
			"ingredient_a": "zinc",
			"ingredient_b": "ciprofloxacin",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "caution",
			"title": "함께 복용하기 전 확인",
			"message": "아연 제품과 항생제 사이에 라벨이 요구하는 간격을 두는지 확인하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "항생제 흡수 저하",
			"clinical_conditions": "경구제와 가까운 시간",
			"dose_and_timing_note": "약 ≥2시간 전 또는 ≥6시간 후",
			"evidence_level": "높음",
			"source_urls": ["https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d358eb18-f4d0-e9ba-e053-2a95a90a435d", "https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "oral_drug_separation",
				"drug_id": "ciprofloxacin",
				"other_id": "zinc",
				"min_hours_drug_before_other": 2,
				"min_hours_drug_after_other": 6,
				"when_time_unknown": "timing_unknown_review",
				"ingredient_scope": "supplement_antacid_or_matching_drug_label_form",
				"timing_basis": "product_specific_oral_label",
				"label_reference_source_id": "cip",
				"at_exact_boundary": "meets_interval"
			}
		},
		{
			"rule_id": "R25",
			"ingredient_a": "iron",
			"ingredient_b": "ciprofloxacin",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "caution",
			"title": "함께 복용하기 전 확인",
			"message": "철분이 항생제 흡수를 방해할 수 있습니다. 약사에게 두 제품의 복용 시간을 확인하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "항생제 흡수 저하",
			"clinical_conditions": "경구제와 가까운 시간",
			"dose_and_timing_note": "약 ≥2시간 전 또는 ≥6시간 후",
			"evidence_level": "높음",
			"source_urls": ["https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d358eb18-f4d0-e9ba-e053-2a95a90a435d", "https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "oral_drug_separation",
				"drug_id": "ciprofloxacin",
				"other_id": "iron",
				"min_hours_drug_before_other": 2,
				"min_hours_drug_after_other": 6,
				"when_time_unknown": "timing_unknown_review",
				"ingredient_scope": "supplement_antacid_or_matching_drug_label_form",
				"timing_basis": "product_specific_oral_label",
				"label_reference_source_id": "cip",
				"at_exact_boundary": "meets_interval"
			}
		},
		{
			"rule_id": "R26",
			"ingredient_a": "calcium",
			"ingredient_b": "ciprofloxacin",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "caution",
			"title": "함께 복용하기 전 확인",
			"message": "칼슘제와 항생제의 복용 간격을 확인하세요. 우유만으로 약을 먹는 경우와 유제품이 포함된 식사는 라벨 안내가 다릅니다.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "칼슘과 결합하여 항생제 흡수 저하",
			"clinical_conditions": "칼슘제 또는 우유·강화음료만으로 복용",
			"dose_and_timing_note": "보충제에 약 ≥2시간 전 또는 ≥6시간 후. 유제품이 포함된 식사 예외는 별도",
			"evidence_level": "높음",
			"source_urls": ["https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d358eb18-f4d0-e9ba-e053-2a95a90a435d"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "oral_drug_separation",
				"drug_id": "ciprofloxacin",
				"other_id": "calcium",
				"min_hours_drug_before_other": 2,
				"min_hours_drug_after_other": 6,
				"when_time_unknown": "timing_unknown_review",
				"ingredient_scope": "supplement_antacid_or_matching_drug_label_form",
				"timing_basis": "product_specific_oral_label",
				"label_reference_source_id": "cip",
				"at_exact_boundary": "meets_interval"
			}
		},
		{
			"rule_id": "R27",
			"ingredient_a": "caffeine",
			"ingredient_b": "ciprofloxacin",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "caution",
			"title": "함께 복용하기 전 확인",
			"message": "이 항생제를 복용하면 카페인의 효과가 더 오래 갈 수 있습니다. 부스터나 에너지음료를 추가하기 전에 확인하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "카페인 제거가 늦어져 효과 및 증상 지속",
			"clinical_conditions": "높은 카페인 노출 또는 민감도",
			"dose_and_timing_note": "병용 정량 기준 없음",
			"evidence_level": "높음",
			"source_urls": ["https://dailymed.nlm.nih.gov/dailymed/downloadpdffile.cfm?setId=2efbda2a-fc97-b7c5-e063-6294a90a362d"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "active_entities_present",
				"entity_ids": ["caffeine", "ciprofloxacin"]
			}
		},
		{
			"rule_id": "R28",
			"ingredient_a": "potassium",
			"ingredient_b": "spironolactone",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "high",
			"title": "함께 복용하기 전 확인",
			"message": "이 약은 몸에 칼륨을 남길 수 있습니다. 칼륨 전해질이나 저염 소금을 추가하기 전에 확인하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "칼륨 배설 감소로 고칼륨혈증",
			"clinical_conditions": "보충제·칼륨 소금 대체제, 신기능 저하",
			"dose_and_timing_note": "안전한 병용량 단정 불가",
			"evidence_level": "높음",
			"source_urls": ["https://www.dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=2ed347bc-a9f1-4800-99bc-9af9912ead1f&type=display", "https://ods.od.nih.gov/factsheets/Potassium-HealthProfessional/"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "active_entities_present",
				"entity_ids": ["potassium", "spironolactone"],
				"ingredient_scope": "supplement_or_salt_substitute"
			}
		},
		{
			"rule_id": "R29",
			"ingredient_a": "potassium",
			"ingredient_b": "acei",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "high",
			"title": "함께 복용하기 전 확인",
			"message": "혈압약과 칼륨 보충제를 함께 쓰면 혈중 칼륨이 높아질 수 있습니다.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "칼륨 배설 감소로 고칼륨혈증",
			"clinical_conditions": "CKD, 칼륨 보충제·소금 대체제",
			"dose_and_timing_note": "일반 AI 이하에서도 발생 가능",
			"evidence_level": "높음",
			"source_urls": ["https://ods.od.nih.gov/factsheets/Potassium-HealthProfessional/"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "active_entities_present",
				"entity_ids": ["potassium", "acei"],
				"ingredient_scope": "supplement_or_salt_substitute"
			}
		},
		{
			"rule_id": "R30",
			"ingredient_a": "vitamin_k",
			"ingredient_b": "warfarin",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "caution",
			"title": "함께 복용하기 전 확인",
			"message": "와파린 복용 중에는 비타민 K 섭취량을 갑자기 바꾸기 전에 진료팀에 알려 주세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "섭취 급변 시 항응고 효과 변화",
			"clinical_conditions": "새 제품 시작·중단·증량",
			"dose_and_timing_note": "일관된 섭취가 핵심. 일률적인 금지량 없음",
			"evidence_level": "높음",
			"source_urls": ["https://ods.od.nih.gov/factsheets/vitaminK-HealthProfessional/"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "active_entities_present",
				"entity_ids": ["vitamin_k", "warfarin"],
				"qualifier": { "any": [
					"start",
					"stop",
					"dose_change",
					"intake_history_unknown"
				] }
			}
		},
		{
			"rule_id": "R31",
			"ingredient_a": "omega3",
			"ingredient_b": "warfarin",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "caution",
			"title": "함께 복용하기 전 확인",
			"message": "오메가3를 새로 시작하거나 양을 바꿀 때는 와파린 진료팀에 제품의 EPA와 DHA 함량을 알려 주세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "항혈소판 효과 가능. 보통 임상적으로 유의한 출혈 증가는 일관되지 않음",
			"clinical_conditions": "고용량·추가 항혈소판제·출혈 증상",
			"dose_and_timing_note": "공통 병용 금지 용량 없음",
			"evidence_level": "중간",
			"source_urls": ["https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/?adb_sid=adc5deb4-f07d-41c6-81bd-2739eb028ba8"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "active_entities_present",
				"entity_ids": ["omega3", "warfarin"]
			}
		},
		{
			"rule_id": "R32",
			"ingredient_a": "vitamin_a",
			"ingredient_b": "isotretinoin",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "high",
			"title": "함께 복용하기 전 확인",
			"message": "이 여드름약과 비타민 A 보충제를 함께 쓰면 부작용이 늘 수 있습니다. 추가 복용 전에 확인하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "유사 독성의 상가 가능",
			"clinical_conditions": "비타민 A 보충제 또는 함유 종합비타민",
			"dose_and_timing_note": "미국 경구 이소트레티노인 라벨 병용 회피",
			"evidence_level": "높음",
			"source_urls": ["https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=31f62a49-4c6d-4ce3-a0ca-d159562370b1", "https://ods.od.nih.gov/factsheets/VitaminA-HealthProfessional/"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "active_entities_present",
				"entity_ids": ["vitamin_a", "isotretinoin"],
				"ingredient_scope": "vitamin_a_supplement"
			}
		},
		{
			"rule_id": "R33",
			"ingredient_a": "vitamin_d",
			"ingredient_b": "thiazide",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "caution",
			"title": "함께 복용하기 전 확인",
			"message": "이 혈압약을 복용 중이라면 비타민 D를 추가하기 전에 기존 칼슘과 비타민 D 양을 확인하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "칼슘 배설 감소와 장 흡수 증가로 고칼슘혈증 가능",
			"clinical_conditions": "신장질환, 부갑상선기능항진, 고령",
			"dose_and_timing_note": "정량 병용 기준 없음",
			"evidence_level": "중간",
			"source_urls": ["https://ods.od.nih.gov/factsheets/Vitamind-HealthProfessional/"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "active_entities_present",
				"entity_ids": ["vitamin_d", "thiazide"]
			}
		},
		{
			"rule_id": "R40",
			"ingredient_a": "vitamin_e",
			"ingredient_b": "warfarin",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "caution",
			"title": "함께 복용하기 전 확인",
			"message": "와파린 복용 중에 고함량 비타민 E를 추가하려면 출혈 위험을 먼저 확인하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "혈소판 응집·비타민 K 의존 응고 영향으로 출혈 가능",
			"clinical_conditions": "고용량, 저비타민 K 상태, 항혈소판제",
			"dose_and_timing_note": "임상적으로 유의한 정확한 병용량 불명",
			"evidence_level": "중간",
			"source_urls": ["https://ods.od.nih.gov/factsheets/VitaminE-HealthProfessional/?uid=61cd6a49b00b38s16"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "active_entities_present",
				"entity_ids": ["vitamin_e", "warfarin"],
				"ingredient_scope": "supplement"
			}
		},
		{
			"rule_id": "R41",
			"ingredient_a": "potassium",
			"ingredient_b": "arb",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "interaction_review",
			"severity": "high",
			"title": "함께 복용하기 전 확인",
			"message": "복용 중인 혈압약과 칼륨 보충제를 함께 쓰기 전에 약사나 진료팀에 확인하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "칼륨 배설 감소로 고칼륨혈증 위험",
			"clinical_conditions": "CKD·칼륨 소금 대체제·고함량 보충",
			"dose_and_timing_note": "보편 안전 병용량 미설정",
			"evidence_level": "높음",
			"source_urls": ["https://ods.od.nih.gov/factsheets/Potassium-HealthProfessional/"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "active_entities_present",
				"entity_ids": ["potassium", "arb"],
				"ingredient_scope": "supplement_or_salt_substitute"
			}
		},
		{
			"rule_id": "R45",
			"ingredient_a": "folate",
			"ingredient_b": "folate",
			"match": "different_cart_products_contain_each_ingredient",
			"symmetric": true,
			"alert_type": "duplicate_ingredient",
			"severity": "info",
			"title": "동일 성분 포함",
			"message": "두 제품에 엽산이 들어 있으면 라벨에서 엽산 실함량을 함께 확인하세요.",
			"trigger_meaning": "장바구니에서 함께 검출되어 검토 안내. 부작용 발생 확정이 아님.",
			"details": "합성 엽산 누적, B12 결핍 진단 지연 가능",
			"clinical_conditions": "강화식품 포함, B12 결핍 위험",
			"dose_and_timing_note": "미국 1000 µg 합성 엽산/일. µg DFE와 분리",
			"evidence_level": "높음",
			"source_urls": ["https://ods.od.nih.gov/factsheets/Folate-HealthProfessional/", "https://ods.od.nih.gov/factsheets/MVMS-HealthProfessional/"],
			"original_condition_for_optional_detailed_evaluation": {
				"op": "distinct_products_same_ingredient",
				"ingredient_id": "folate",
				"min_products": 2,
				"window": "local_day"
			}
		}
	],
	registration_template: {
		"product_id": "unique_id",
		"display_name": "등록할 제품 이름",
		"category": "supplement 또는 medication",
		"is_demo": false,
		"composition_status": "verified_label",
		"ingredients": [{
			"ingredient_id": "위 ingredients의 id",
			"amount": null,
			"unit": null
		}]
	},
	matching_contract: {
		"steps": [
			"각 장바구니 제품의 ingredient_id 목록을 읽는다.",
			"서로 다른 제품 두 개씩 모든 쌍을 만든다.",
			"각 제품의 성분 쌍을 규칙의 ingredient_a, ingredient_b와 양방향으로 비교한다.",
			"일치한 규칙의 title, message, severity, source_urls를 출력한다.",
			"동일 rule_id와 정렬된 product_id 쌍을 키로 중복 경고를 제거한다."
		],
		"unknown_ingredient_result": {
			"status": "incomplete",
			"message": "등록된 성분 정보가 부족해 일부 조합을 확인하지 못했습니다."
		},
		"no_match_result": {
			"status": "no_rule_match",
			"message": "현재 등록된 성분과 규칙에서 경고 항목이 발견되지 않았습니다."
		},
		"duplicate_policy": "성분 중복은 정보 알림. 함량과 실제 섭취량 확인 없이 과다 섭취로 판정하지 않음.",
		"medication_policy": "복용약 임의 중단·용량 변경 안내 금지. 약사 또는 처방 의료진 확인 안내.",
		"quantitative_scope": "이 데이터셋은 성분 쌍 조회용. 양·시간에 따른 추가 판정에는 dose_and_timing_note와 원문 라벨을 사용."
	},
	demo_carts: [
		{
			"product_ids": ["P02", "M02"],
			"expected_rule_ids": ["R06"],
			"meaning": "칼슘 첨가 프로틴 + 레보티록신 → 흡수 관련 복용 간격 확인"
		},
		{
			"product_ids": ["P03", "M01"],
			"expected_rule_ids": ["R28"],
			"meaning": "칼륨 첨가 프로틴 + 스피로놀락톤 → 칼륨 병용 주의"
		},
		{
			"product_ids": ["P04", "P05"],
			"expected_rule_ids": ["R01"],
			"meaning": "카페인 중복 → 총섭취량 확인"
		},
		{
			"product_ids": ["P07", "M03"],
			"expected_rule_ids": ["R25"],
			"meaning": "철분 + 시프로플록사신 → 복용 간격 확인"
		},
		{
			"product_ids": ["P08", "P09"],
			"expected_rule_ids": ["R09"],
			"meaning": "비타민 D 중복"
		},
		{
			"product_ids": ["P01", "M01"],
			"expected_rule_ids": [],
			"meaning": "유단백질만 등록된 예시에는 해당 쌍 규칙 없음. 실제 제품의 미등록 성분을 추정하지 않음."
		}
	]
};
var supplement_interactions_with_lactose_ko_default = {
	dataset_name: "운동 보충제·영양제·의약품 상호작용 및 유당불내증 경고 규칙",
	version: "1.1.0",
	locale: "ko-KR",
	disclaimer: "상호작용 탐지용 초기 데이터. 모든 조합이 공식 병용금기는 아니며 의약품별 허가사항과 전문가 검증이 필요함. 사용자 응답만으로 안전성을 보증하지 않음. 유당불내증은 병용금기가 아닌 개인별 소화기 민감성으로 분류하며, 우유 단백질 알레르기와 다름.",
	rules: [
		{
			"id": "INT-001",
			"ingredient_a": {
				"name_ko": "요힘빈",
				"key": "yohimbine"
			},
			"ingredient_b": {
				"name_ko": "고함량 카페인",
				"key": "caffeine"
			},
			"trigger": {
				"type": "co_use_check",
				"question_ko": "요힘빈 또는 요힘베 함유 제품을 함께 섭취하고 있습니까?",
				"choices": [
					"예",
					"아니요",
					"잘 모르겠음"
				],
				"show_warning_if": "yes"
			},
			"interaction_type": "중대한 병용주의",
			"possible_adverse_effects_ko": "심한 혈압 상승, 두근거림, 부정맥 등 심혈관계 부작용 위험이 증가할 수 있습니다.",
			"alert": {
				"level": "high",
				"label_ko": "강한 경고",
				"message_ko": "요힘빈 + 고함량 카페인: 심한 혈압 상승, 두근거림, 부정맥 등 심혈관계 부작용 위험이 증가할 수 있습니다."
			},
			"recommended_action_ko": "요힘빈과 카페인 함유 제품을 함께 복용하지 말고 의사 또는 약사와 상의하세요.",
			"regulatory_contraindication_confirmed": false,
			"evidence_status": "공식 허가사항 및 전문가 검수 필요"
		},
		{
			"id": "INT-002",
			"ingredient_a": {
				"name_ko": "요힘빈",
				"key": "yohimbine"
			},
			"ingredient_b": {
				"name_ko": "ADHD 치료용 각성제",
				"key": "adhd_stimulants"
			},
			"trigger": {
				"type": "co_use_check",
				"question_ko": "ADHD 치료를 위해 메틸페니데이트나 암페타민계 각성제를 복용하고 있습니까?",
				"choices": [
					"예",
					"아니요",
					"잘 모르겠음"
				],
				"show_warning_if": "yes"
			},
			"interaction_type": "중대한 병용주의",
			"possible_adverse_effects_ko": "교감신경 자극이 중첩되어 심박수와 혈압이 상승할 수 있습니다.",
			"alert": {
				"level": "high",
				"label_ko": "강한 경고",
				"message_ko": "요힘빈 + ADHD 치료용 각성제: 교감신경 자극이 중첩되어 심박수와 혈압이 상승할 수 있습니다."
			},
			"recommended_action_ko": "요힘빈 사용 전 처방 의료진 또는 약사에게 상호작용을 확인하세요.",
			"regulatory_contraindication_confirmed": false,
			"evidence_status": "공식 허가사항 및 전문가 검수 필요"
		},
		{
			"id": "INT-003",
			"ingredient_a": {
				"name_ko": "세인트존스워트",
				"key": "st_johns_wort"
			},
			"ingredient_b": {
				"name_ko": "일부 항우울제",
				"key": "certain_antidepressants"
			},
			"trigger": {
				"type": "co_use_check",
				"question_ko": "SSRI, SNRI, MAOI 등 항우울제를 복용하고 있습니까?",
				"choices": [
					"예",
					"아니요",
					"잘 모르겠음"
				],
				"show_warning_if": "yes"
			},
			"interaction_type": "중대한 병용주의",
			"possible_adverse_effects_ko": "세로토닌 증후군을 포함한 심각한 세로토닌 관련 부작용이 발생할 수 있습니다.",
			"alert": {
				"level": "high",
				"label_ko": "강한 경고",
				"message_ko": "세인트존스워트 + 일부 항우울제: 세로토닌 증후군을 포함한 심각한 세로토닌 관련 부작용이 발생할 수 있습니다."
			},
			"recommended_action_ko": "의료진 확인 없이 세인트존스워트를 병용하지 마세요. 처방약을 임의로 중단하지 마세요.",
			"regulatory_contraindication_confirmed": false,
			"evidence_status": "공식 허가사항 및 전문가 검수 필요"
		},
		{
			"id": "INT-004",
			"ingredient_a": {
				"name_ko": "세인트존스워트",
				"key": "st_johns_wort"
			},
			"ingredient_b": {
				"name_ko": "특정 HIV 치료제",
				"key": "certain_hiv_antiretrovirals"
			},
			"trigger": {
				"type": "co_use_check",
				"question_ko": "HIV 치료제를 복용하고 있습니까?",
				"choices": [
					"예",
					"아니요",
					"잘 모르겠음"
				],
				"show_warning_if": "yes"
			},
			"interaction_type": "약물별 공식 병용금기 확인 필요",
			"possible_adverse_effects_ko": "특정 HIV 치료제의 혈중 농도가 감소하여 치료 효과가 떨어지고 치료 실패 위험이 증가할 수 있습니다.",
			"alert": {
				"level": "critical",
				"label_ko": "병용금기 가능",
				"message_ko": "세인트존스워트 + 특정 HIV 치료제: 특정 HIV 치료제의 혈중 농도가 감소하여 치료 효과가 떨어지고 치료 실패 위험이 증가할 수 있습니다."
			},
			"recommended_action_ko": "해당 HIV 치료제의 성분과 허가사항을 확인하고 전문의 또는 약사와 상담하세요.",
			"regulatory_contraindication_confirmed": null,
			"evidence_status": "공식 허가사항 및 전문가 검수 필요"
		},
		{
			"id": "INT-005",
			"ingredient_a": {
				"name_ko": "칼륨 보충제",
				"key": "potassium_supplement"
			},
			"ingredient_b": {
				"name_ko": "스피로노락톤",
				"key": "spironolactone"
			},
			"trigger": {
				"type": "co_use_check",
				"question_ko": "스피로노락톤(알닥톤) 또는 다른 칼륨 보존 이뇨제를 복용하고 있습니까?",
				"choices": [
					"예",
					"아니요",
					"잘 모르겠음"
				],
				"show_warning_if": "yes"
			},
			"interaction_type": "중대한 병용주의",
			"possible_adverse_effects_ko": "혈중 칼륨이 과도하게 높아지는 고칼륨혈증이 발생할 수 있으며 심각한 부정맥으로 이어질 수 있습니다.",
			"alert": {
				"level": "high",
				"label_ko": "강한 경고",
				"message_ko": "칼륨 보충제 + 스피로노락톤: 혈중 칼륨이 과도하게 높아지는 고칼륨혈증이 발생할 수 있으며 심각한 부정맥으로 이어질 수 있습니다."
			},
			"recommended_action_ko": "의료진의 명시적인 지시 없이 칼륨 보충제를 추가하지 말고 혈중 칼륨 및 신장 기능 확인이 필요한지 상담하세요.",
			"regulatory_contraindication_confirmed": false,
			"evidence_status": "공식 허가사항 및 전문가 검수 필요"
		},
		{
			"id": "INT-006",
			"ingredient_a": {
				"name_ko": "비타민 K",
				"key": "vitamin_k"
			},
			"ingredient_b": {
				"name_ko": "와파린",
				"key": "warfarin"
			},
			"trigger": {
				"type": "co_use_check",
				"question_ko": "와파린을 복용하고 있습니까?",
				"choices": [
					"예",
					"아니요",
					"잘 모르겠음"
				],
				"show_warning_if": "yes"
			},
			"interaction_type": "섭취량 일관성 및 INR 관리 필요",
			"possible_adverse_effects_ko": "비타민 K 섭취량의 급격한 변화는 와파린의 항응고 효과를 변화시켜 혈전 또는 출혈 위험에 영향을 줄 수 있습니다.",
			"alert": {
				"level": "moderate",
				"label_ko": "의료진 관리 필수",
				"message_ko": "비타민 K + 와파린: 비타민 K 섭취량의 급격한 변화는 와파린의 항응고 효과를 변화시켜 혈전 또는 출혈 위험에 영향을 줄 수 있습니다."
			},
			"recommended_action_ko": "비타민 K를 무조건 피하기보다는 섭취량을 일정하게 유지하고 변경 전 의료진과 상의하세요.",
			"regulatory_contraindication_confirmed": false,
			"evidence_status": "공식 허가사항 및 전문가 검수 필요"
		},
		{
			"id": "INT-007",
			"ingredient_a": {
				"name_ko": "고용량 비타민 E",
				"key": "high_dose_vitamin_e"
			},
			"ingredient_b": {
				"name_ko": "와파린",
				"key": "warfarin"
			},
			"trigger": {
				"type": "co_use_check",
				"question_ko": "와파린을 복용하면서 고용량 비타민 E 보충제를 사용하고 있습니까?",
				"choices": [
					"예",
					"아니요",
					"잘 모르겠음"
				],
				"show_warning_if": "yes"
			},
			"interaction_type": "용량 의존적 병용주의",
			"possible_adverse_effects_ko": "항응고 작용과 관련되어 출혈 위험이 증가할 수 있습니다. 위험은 비타민 E 용량과 개인 상태에 따라 달라집니다.",
			"alert": {
				"level": "high",
				"label_ko": "강한 주의",
				"message_ko": "고용량 비타민 E + 와파린: 항응고 작용과 관련되어 출혈 위험이 증가할 수 있습니다. 위험은 비타민 E 용량과 개인 상태에 따라 달라집니다."
			},
			"recommended_action_ko": "비타민 E 용량을 확인하고 와파린을 처방한 의료진 또는 약사와 상담하세요.",
			"regulatory_contraindication_confirmed": false,
			"evidence_status": "공식 허가사항 및 전문가 검수 필요"
		},
		{
			"id": "INT-008",
			"ingredient_a": {
				"name_ko": "홍국(모나콜린 K 함유)",
				"key": "red_yeast_rice_monacolin_k"
			},
			"ingredient_b": {
				"name_ko": "스타틴계 의약품",
				"key": "statins"
			},
			"trigger": {
				"type": "co_use_check",
				"question_ko": "콜레스테롤 치료를 위해 스타틴계 의약품을 복용하고 있습니까?",
				"choices": [
					"예",
					"아니요",
					"잘 모르겠음"
				],
				"show_warning_if": "yes"
			},
			"interaction_type": "중대한 병용주의",
			"possible_adverse_effects_ko": "홍국의 모나콜린 K가 스타틴과 유사하게 작용하여 근육 손상 및 간 관련 부작용 위험이 중첩될 수 있으며 심한 경우 신장 손상으로 이어질 수 있습니다.",
			"alert": {
				"level": "high",
				"label_ko": "강한 경고",
				"message_ko": "홍국(모나콜린 K 함유) + 스타틴계 의약품: 홍국의 모나콜린 K가 스타틴과 유사하게 작용하여 근육 손상 및 간 관련 부작용 위험이 중첩될 수 있으며 심한 경우 신장 손상으로 이어질 수 있습니다."
			},
			"recommended_action_ko": "홍국 제품의 모나콜린 함유 여부를 확인하고 의료진과 상의하기 전에는 추가 복용하지 마세요.",
			"regulatory_contraindication_confirmed": false,
			"evidence_status": "공식 허가사항 및 전문가 검수 필요"
		},
		{
			"id": "LAC-001",
			"rule_category": "individual_intolerance",
			"ingredient_a": {
				"name_ko": "WPC 유청단백 농축물",
				"key": "whey_protein_concentrate"
			},
			"ingredient_b": {
				"name_ko": "유당불내증",
				"key": "lactose_intolerance"
			},
			"trigger": {
				"type": "personal_condition_check",
				"question_ko": "유당불내증이 있거나 우유·WPC 프로틴 섭취 후 복부 불편을 겪은 적이 있습니까?",
				"choices": [
					"예",
					"아니요",
					"잘 모르겠음"
				],
				"show_warning_if": "yes",
				"requires_product_lactose_verification": true
			},
			"interaction_type": "개인 특성에 따른 소화기 증상 주의 (병용금기 아님)",
			"possible_adverse_effects_ko": "복부팽만, 가스, 복통, 설사, 메스꺼움 등이 나타날 수 있습니다.",
			"alert": {
				"level": "medium",
				"label_ko": "유당불내증 주의",
				"message_ko": "WPC 제품에는 유당이 남아 있을 수 있어 유당불내증이 있다면 복부팽만, 가스, 복통 또는 설사가 발생할 수 있습니다. 제품의 실제 유당 함량을 확인하세요."
			},
			"recommended_action_ko": "제품 라벨의 유당 함량을 확인하고, 불편이 있었다면 저유당 또는 무유당 제품을 고려하세요.",
			"regulatory_contraindication_confirmed": false,
			"evidence_status": "공공 보건 자료로 증상과 함유원료 근거 확인; 개별 제품 유당 함량 확인 필요",
			"product_match": {
				"categories": ["whey_protein_concentrate"],
				"lactose_condition": "contains_lactose",
				"lactose_g_per_serving": null,
				"label_keywords": [
					"유당",
					"락토스",
					"lactose",
					"우유",
					"탈지분유",
					"whey",
					"유청"
				]
			},
			"sources": [
				{
					"source": "NIDDK: Eating, Diet, & Nutrition for Lactose Intolerance",
					"url": "https://www.niddk.nih.gov/health-information/digestive-diseases/lactose-intolerance/eating-diet-nutrition"
				},
				{
					"source": "NIDDK: Symptoms & Causes of Lactose Intolerance",
					"url": "https://www.niddk.nih.gov/health-information/digestive-diseases/lactose-intolerance/symptoms-causes"
				},
				{
					"source": "ADPI: Whey Protein Isolate",
					"url": "https://adpi.org/whey-protein-isolate/"
				}
			],
			"relative_lactose_note": "일반적으로 WPI보다 유당이 많은 경향이 있으나 제품마다 다름."
		},
		{
			"id": "LAC-002",
			"rule_category": "individual_intolerance",
			"ingredient_a": {
				"name_ko": "WPI 유청단백 분리물",
				"key": "whey_protein_isolate"
			},
			"ingredient_b": {
				"name_ko": "유당불내증",
				"key": "lactose_intolerance"
			},
			"trigger": {
				"type": "personal_condition_check",
				"question_ko": "유당불내증이 있으며 WPI 제품에서도 소화기 증상을 경험한 적이 있습니까?",
				"choices": [
					"예",
					"아니요",
					"잘 모르겠음"
				],
				"show_warning_if": "yes",
				"requires_product_lactose_verification": true
			},
			"interaction_type": "개인 특성에 따른 소화기 증상 주의 (병용금기 아님)",
			"possible_adverse_effects_ko": "복부팽만, 가스, 복통, 설사, 메스꺼움 등이 나타날 수 있습니다.",
			"alert": {
				"level": "low",
				"label_ko": "유당불내증 주의",
				"message_ko": "WPI는 일반적으로 WPC보다 유당이 적지만, 모든 WPI 제품이 완전 무유당인 것은 아닙니다. 소량의 유당에도 증상이 있다면 실제 제품의 유당 함량을 확인하세요."
			},
			"recommended_action_ko": "무유당 표시와 1회 제공량당 유당 함량을 확인하세요. WPI라는 이름만으로 무유당 판정하지 마세요.",
			"regulatory_contraindication_confirmed": false,
			"evidence_status": "공공 보건 자료로 증상과 함유원료 근거 확인; 개별 제품 유당 함량 확인 필요",
			"product_match": {
				"categories": ["whey_protein_isolate"],
				"lactose_condition": "contains_lactose",
				"lactose_g_per_serving": null,
				"label_keywords": [
					"유당",
					"락토스",
					"lactose",
					"우유",
					"탈지분유",
					"whey",
					"유청"
				]
			},
			"sources": [
				{
					"source": "NIDDK: Eating, Diet, & Nutrition for Lactose Intolerance",
					"url": "https://www.niddk.nih.gov/health-information/digestive-diseases/lactose-intolerance/eating-diet-nutrition"
				},
				{
					"source": "NIDDK: Symptoms & Causes of Lactose Intolerance",
					"url": "https://www.niddk.nih.gov/health-information/digestive-diseases/lactose-intolerance/symptoms-causes"
				},
				{
					"source": "ADPI: Whey Protein Isolate",
					"url": "https://adpi.org/whey-protein-isolate/"
				}
			],
			"relative_lactose_note": "유당 함량은 제조사/제품별 상이; 저유당과 무유당을 구분."
		},
		{
			"id": "LAC-003",
			"rule_category": "individual_intolerance",
			"ingredient_a": {
				"name_ko": "우유·분유 함유 매스게이너",
				"key": "mass_gainer"
			},
			"ingredient_b": {
				"name_ko": "유당불내증",
				"key": "lactose_intolerance"
			},
			"trigger": {
				"type": "personal_condition_check",
				"question_ko": "유당불내증이 있거나 우유·분유 함유 게이너를 섭취하면 속이 불편합니까?",
				"choices": [
					"예",
					"아니요",
					"잘 모르겠음"
				],
				"show_warning_if": "yes",
				"requires_product_lactose_verification": true
			},
			"interaction_type": "개인 특성에 따른 소화기 증상 주의 (병용금기 아님)",
			"possible_adverse_effects_ko": "복부팽만, 가스, 복통, 설사, 메스꺼움 등이 나타날 수 있습니다.",
			"alert": {
				"level": "medium",
				"label_ko": "유당불내증 주의",
				"message_ko": "매스게이너에 우유, 분유, 유청 및 유당 원료가 들어 있다면 1회 섭취량에 따라 가스, 복부팽만, 설사 등이 생길 수 있습니다."
			},
			"recommended_action_ko": "우유·분유·유당 표시를 확인하고 가능한 한 실제 유당량을 확인하세요. 분할 섭취나 저유당 대체 제품은 개인의 내성에 따라 판단하세요.",
			"regulatory_contraindication_confirmed": false,
			"evidence_status": "공공 보건 자료로 증상과 함유원료 근거 확인; 개별 제품 유당 함량 확인 필요",
			"product_match": {
				"categories": ["mass_gainer"],
				"lactose_condition": "milk_derived_ingredients_or_declared_lactose",
				"lactose_g_per_serving": null,
				"label_keywords": [
					"유당",
					"락토스",
					"lactose",
					"우유",
					"탈지분유",
					"whey",
					"유청"
				]
			},
			"sources": [
				{
					"source": "NIDDK: Eating, Diet, & Nutrition for Lactose Intolerance",
					"url": "https://www.niddk.nih.gov/health-information/digestive-diseases/lactose-intolerance/eating-diet-nutrition"
				},
				{
					"source": "NIDDK: Symptoms & Causes of Lactose Intolerance",
					"url": "https://www.niddk.nih.gov/health-information/digestive-diseases/lactose-intolerance/symptoms-causes"
				},
				{
					"source": "ADPI: Whey Protein Isolate",
					"url": "https://adpi.org/whey-protein-isolate/"
				}
			]
		},
		{
			"id": "LAC-004",
			"rule_category": "individual_intolerance",
			"ingredient_a": {
				"name_ko": "유당 함유 영양제·의약품 부형제",
				"key": "lactose_excipient"
			},
			"ingredient_b": {
				"name_ko": "유당불내증",
				"key": "lactose_intolerance"
			},
			"trigger": {
				"type": "personal_condition_check",
				"question_ko": "유당불내증이 매우 심하거나, 영양제·약을 복용한 뒤 소화기 증상을 경험한 적이 있습니까?",
				"choices": [
					"예",
					"아니요",
					"잘 모르겠음"
				],
				"show_warning_if": "yes",
				"requires_product_lactose_verification": true
			},
			"interaction_type": "개인 특성에 따른 소화기 증상 주의 (병용금기 아님)",
			"possible_adverse_effects_ko": "복부팽만, 가스, 복통, 설사, 메스꺼움 등이 나타날 수 있습니다.",
			"alert": {
				"level": "low",
				"label_ko": "유당불내증 주의",
				"message_ko": "일부 영양제·의약품에는 부형제로 소량의 유당이 포함될 수 있습니다. 대부분은 소량을 견딜 수 있으나 민감도가 높은 사람은 확인이 필요합니다."
			},
			"recommended_action_ko": "약품·영양제의 첨가제 표시를 확인하고, 처방약은 임의로 중단하지 말고 약사에게 대체 제형을 문의하세요.",
			"regulatory_contraindication_confirmed": false,
			"evidence_status": "공공 보건 자료로 증상과 함유원료 근거 확인; 개별 제품 유당 함량 확인 필요",
			"product_match": {
				"categories": ["lactose_excipient"],
				"lactose_condition": "explicit_lactose_excipient_present",
				"lactose_g_per_serving": null,
				"label_keywords": [
					"유당",
					"락토스",
					"lactose",
					"우유",
					"탈지분유",
					"whey",
					"유청"
				]
			},
			"sources": [
				{
					"source": "NIDDK: Eating, Diet, & Nutrition for Lactose Intolerance",
					"url": "https://www.niddk.nih.gov/health-information/digestive-diseases/lactose-intolerance/eating-diet-nutrition"
				},
				{
					"source": "NIDDK: Symptoms & Causes of Lactose Intolerance",
					"url": "https://www.niddk.nih.gov/health-information/digestive-diseases/lactose-intolerance/symptoms-causes"
				},
				{
					"source": "ADPI: Whey Protein Isolate",
					"url": "https://adpi.org/whey-protein-isolate/"
				}
			]
		}
	],
	data_model_notes: {
		"rule_categories": ["drug_supplement_interaction", "individual_intolerance"],
		"intolerance_rule_usage": "제품의 실제 유당 함유 여부 및 개인 응답이 확인된 경우에만 적용. WPI라는 이유로 무조건 무유당 판정하지 않음.",
		"lactose_quantity": "제품별 유당 함량이 없으면 unknown으로 기록; 유당불내증에 적용 가능한 보편적인 1일 UL은 없음.",
		"milk_allergy": "유당불내증과 우유 단백질 알레르기를 구분; 알레르기가 있는 경우 유당의 양과 무관하게 우유 단백질 함유 제품 확인 필요."
	},
	personal_conditions: [{
		"id": "lactose_intolerance",
		"name_ko": "유당불내증",
		"question_ko": "유당불내증 진단을 받았거나 우유·유청단백 섭취 후 복부팽만·설사 등의 증상이 있습니까?",
		"answer_values": [
			"yes",
			"no",
			"unknown"
		],
		"usual_symptoms_ko": [
			"복부팽만",
			"가스",
			"복통",
			"설사",
			"메스꺼움"
		],
		"no_universal_upper_limit": true,
		"note": "개인별 허용 가능한 유당량에 차이가 큼. 대부분은 일정량의 유당을 견딜 수 있으나 개인별 증상 기반으로 판단."
	}, {
		"id": "milk_protein_allergy",
		"name_ko": "우유 단백질 알레르기",
		"question_ko": "유당불내증이 아니라 우유 단백질 알레르기 진단을 받은 적이 있습니까?",
		"answer_values": [
			"yes",
			"no",
			"unknown"
		],
		"note": "유당불내증과 다른 면역반응. 우유 단백질 함유 WPC/WPI 모두 알레르기 위험이 있으므로 별도 알레르기 엔진에서 강하게 경고."
	}]
};
// src/analysis/data.ts
var deferredSupplementalRules = supplement_interactions_with_lactose_ko_default.rules.map((rule) => {
	const registeredIds = new Set(cart_interactions_dataset_default.ingredients.map((ingredient) => ingredient.id));
	const missing = [rule.ingredient_a.key, rule.ingredient_b.key].filter((id) => !registeredIds.has(id));
	const reason = rule.trigger.type === "personal_condition_check" ? "개인 응답과 제품별 실제 유당·제형 정보가 없어 적용을 보류했습니다. 유당불내증을 성분 간 충돌로 취급하지 않습니다." : "병용 확인 응답과 용량·약물 계열 등 제품 조건을 확인할 자료가 없어 적용을 보류했습니다.";
	return {
		id: rule.id,
		source: "supplement_interactions_with_lactose_ko.json",
		type: rule.trigger.type,
		reason: reason + (missing.length ? ` 자동 매핑하지 않은 ID: ${missing.join(", ")}.` : ""),
		sourceUrls: ("sources" in rule ? rule.sources : [])?.flatMap((source) => source.url.startsWith("https://") ? [source.url] : []) ?? []
	};
});
var analysisDataset = {
	ingredients: cart_interactions_dataset_default.ingredients,
	products: cart_interactions_dataset_default.products,
	rules: cart_interactions_dataset_default.interaction_rules,
	deferredRules: deferredSupplementalRules,
	versions: {
		cart: cart_interactions_dataset_default.dataset_version,
		supplemental: supplement_interactions_with_lactose_ko_default.version
	}
};
// src/analysis/optimization.ts
function compareAnalyses(before, after) {
	const beforeCauses = new Set(before.score.deductions.map((item) => item.causeKey));
	const afterCauses = new Set(after.score.deductions.map((item) => item.causeKey));
	return {
		before,
		after,
		scoreDelta: before.score.value === null || after.score.value === null ? null : after.score.value - before.score.value,
		removedCauses: before.score.deductions.filter((item) => !afterCauses.has(item.causeKey)),
		addedCauses: after.score.deductions.filter((item) => !beforeCauses.has(item.causeKey))
	};
}
function getReplacementCandidates(cart, sourceId, dataset) {
	const source = dataset.products.find((product) => product.product_id === sourceId);
	const sourceItem = cart.find((item) => item.productId === sourceId);
	const registered = new Set(dataset.ingredients.map((ingredient) => ingredient.id));
	if (!sourceItem || source?.category !== "supplement" || !source.ingredients?.length || source.ingredients.some((ingredient) => !registered.has(ingredient.ingredient_id))) return [];
	const sourceIds = new Set(source.ingredients.map((ingredient) => ingredient.ingredient_id));
	const before = analyzeCart(cart, dataset);
	if (before.score.value === null || before.coverage.missingIngredientProducts > 0 || before.coverage.unregisteredIngredients > 0 || before.coverage.skippedRules > 0) return [];
	return dataset.products.filter((product) => product.category === "supplement" && !cart.some((item) => item.productId === product.product_id) && Boolean(product.ingredients?.length) && product.ingredients.every((ingredient) => registered.has(ingredient.ingredient_id)) && product.ingredients.some((ingredient) => sourceIds.has(ingredient.ingredient_id))).map((product) => {
		const items = cart.map((item) => ({
			...item,
			productId: item.productId === sourceId ? product.product_id : item.productId
		}));
		return {
			product,
			items,
			comparison: compareAnalyses(before, analyzeCart(items, dataset))
		};
	}).sort((a, b) => (b.comparison.after.score.value ?? -1) - (a.comparison.after.score.value ?? -1) || a.comparison.addedCauses.length - b.comparison.addedCauses.length || a.product.product_id.localeCompare(b.product.product_id));
}
// src/lib/categories.ts
function categoryForProduct(product) {
	if (product.category !== "supplement") return null;
	const ids = product.ingredients?.map((item) => item.ingredient_id) ?? [];
	if (ids.includes("protein")) return "프로틴";
	if (ids.includes("creatine")) return "크레아틴";
	if (ids.some((id) => id.startsWith("vitamin_") || [
		"magnesium",
		"iron",
		"zinc",
		"calcium",
		"potassium",
		"niacin",
		"folate"
	].includes(id))) return "비타민&미네랄";
	if (ids.includes("omega3")) return "지방산&오일";
	return null;
}
// src/lib/imagery.ts
var productImages = {
	P01: "/images/white-jar-demo.png",
	P02: "/images/white-jar-demo.png",
	P03: "/images/white-jar-demo.png",
	P04: "/images/mockups/creatine.webp",
	P05: "/images/mockups/energy.webp",
	P06: "/images/charcoal-jar-demo.png",
	P07: "/images/amber-bottle-demo.png",
	P08: "/images/amber-bottle-demo.png",
	P09: "/images/amber-bottle-demo.png",
	P10: "/images/charcoal-jar-demo.png",
	...Object.fromEntries([
		"M01",
		"M02",
		"M03",
		"M04",
		"M05",
		"M06",
		"M07"
	].map((id) => [id, "/images/mockups/medication.webp"]))
};
// src/lib/catalog.ts
var ingredientNames = new Map(cart_interactions_dataset_default.ingredients.map((item) => [item.id, item.name_ko]));
var displayOrder = [
	"P01",
	"P06",
	"P08"
];
var products = cart_interactions_dataset_default.products.map((product) => {
	const [name, variant] = product.display_name.replace(/^시연용\s*/, "").replace("경구제 경구제", "경구제").split(" — ");
	const ingredients = [...product.ingredients ?? []];
	const names = ingredients.map((item) => item.ingredient_id).map((id) => ingredientNames.get(id) ?? "미등록 성분");
	const group = categoryForProduct(product);
	return {
		...product,
		ingredients,
		name,
		subtitle: variant ?? (names.length ? names.join(" · ") : "성분 정보 없음"),
		ingredientNames: names,
		image: productImages[product.product_id],
		group
	};
}).sort((a, b) => {
	const order = (id) => displayOrder.includes(id) ? displayOrder.indexOf(id) : 100;
	return order(a.product_id) - order(b.product_id);
});
var productById = new Map(products.map((product) => [product.product_id, product]));
[
	"P01",
	"P06",
	"P08"
].map((productId) => ({
	productId,
	quantity: 1
}));
function normalizeCart(value) {
	if (!Array.isArray(value)) return [];
	const quantities = /* @__PURE__ */ new Map();
	for (const item of value) {
		if (!item || typeof item !== "object") continue;
		const { productId, quantity } = item;
		if (typeof productId !== "string" || !productById.has(productId) || typeof quantity !== "number" || !Number.isFinite(quantity) || quantity < 1) continue;
		quantities.set(productId, Math.min(99, (quantities.get(productId) ?? 0) + Math.floor(quantity)));
	}
	return Array.from(quantities, ([productId, quantity]) => ({
		productId,
		quantity
	}));
}
export { SCORING_POLICY, analysisDataset, analyzeCart, compareAnalyses, getReplacementCandidates, normalizeCart, products };
