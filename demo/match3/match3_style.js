/**
 * 鹿雨森 / 三消 Demo：純呈現層。
 * 軍火庫負責畫森林雨霧，宿主只設定顏色、動畫及戰鬥視覺回饋。
 * 不處理戰鬥數值、不產生音效。
 */
(() => {
  'use strict';
  const lowMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const visuals = [];
  try {
    if (window.SlowlyPineForest?.create) visuals.push(window.SlowlyPineForest.create({
      canvas:'#forest',seed:31,maxDpr:1.4,density:.82,
      layers:[
        {baseline:.75,minHeight:.18,maxHeight:.34,color:'#193a35',width:.4},
        {baseline:.94,minHeight:.32,maxHeight:.51,color:'#071b1e',width:.4}
      ]
    }));
    if (window.SlowlyCanvasFog?.create) visuals.push(window.SlowlyCanvasFog.create({
      canvas:'#fog',count:lowMotion?8:18,color:'#b3d2c9',opacity:.48,size:1.15,
      speed:lowMotion?0:.44,maxDpr:1.4,autoStart:!lowMotion
    }));
    if (window.SlowlyCanvasRain?.create) visuals.push(window.SlowlyCanvasRain.create({
      canvas:'#weather',count:lowMotion?17:Math.min(145,Math.max(55,Math.floor(innerWidth/9))),
      color:'#c7e4e0',opacity:.52,speed:.72,wind:.17,length:.6,maxDpr:1.4,autoStart:!lowMotion
    }));
  } catch(error){console.warn('[Silvarain Match3] 部分背景特效無法啟動',error);}

  const boss=document.querySelector('#bossFigure');
  const bossFloat=document.querySelector('#bossFloat');
  const arena=document.querySelector('#arena');
  function replay(element,klass,ms=650){
    if(!element||lowMotion)return;
    element.classList.remove(klass);void element.offsetWidth;element.classList.add(klass);
    setTimeout(()=>element.classList.remove(klass),ms);
  }
  window.SilvaMatch3Visuals=Object.freeze({
    bossHurt(amount){
      replay(boss,'is-hurt',410);
      if(!bossFloat||lowMotion)return;
      bossFloat.textContent=`−${amount}`;
      replay(bossFloat,'is-visible',1220);
    },
    async bossAttack(){
      replay(boss,'is-striking',750);
      await new Promise(resolve=>setTimeout(resolve,lowMotion?50:450));
      replay(arena,'is-hit',500);
    },
    bossGuard(){replay(boss,'is-guard',850);}
  });
})();
