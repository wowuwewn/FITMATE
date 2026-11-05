import { analyzeCart, analysisDataset } from './data/analysis.js';
const states=[['P02','M02'],['P01','M02']].map(ids=>({ids,result:analyzeCart(ids.map(productId=>({productId,quantity:1})),analysisDataset)}));
let index=0,current=states[0].result.score.value,frame=0;
document.querySelector('#replay').addEventListener('click',()=>{
  cancelAnimationFrame(frame);index=1-index;
  const target=states[index],from=current,to=target.result.score.value,start=performance.now();
  document.querySelector('#spec-gauge').setAttribute('aria-label',`시연 비교 지표 ${to} / 100. 의학적 안전도 아님`);
  document.querySelector('#replay').textContent=index?'프로틴 B 구성으로 돌아가기 →':'프로틴 A로 교체 비교하기 →';
  document.querySelector('#spec-status').textContent=`현재 ${target.ids.join(' + ')} · ${target.result.findings.map(f=>f.ruleId).join(', ')||'매칭 규칙 없음'} · ${to}점`;
  function tick(now){const progress=matchMedia('(prefers-reduced-motion: reduce)').matches?1:Math.min((now-start)/680,1);current=from+(to-from)*(1-Math.pow(1-progress,3));document.querySelector('#spec-number').textContent=Math.round(current);document.querySelector('#spec-ring').style.strokeDashoffset=100-current;if(progress<1)frame=requestAnimationFrame(tick)}frame=requestAnimationFrame(tick);
});
