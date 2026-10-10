/**
 * 鹿雨森 / 三消戰鬥原型（玩法核心）
 * 參考使用者 match3_v1 的 8×8、交換、連鎖與特殊糖規則。
 * 配對、重力、搜尋、洗牌、特效擴散均直接引用慢慢軍火庫 HTTPS JS。
 * 不帶原版排行榜、得分模式與音效：改為鹿雨森的 Boss 回合戰鬥。
 */
(() => {
  'use strict';
  const REQUIRED=['SlowlyGridLineMatch','SlowlyGridGravity','SlowlyGridSwapSearch','SlowlyGridShuffleUntil','SlowlyGridChainExpand'];
  const missing=REQUIRED.filter(name=>!window[name]);
  if(missing.length){
    const error=document.getElementById('engineError');
    error.hidden=false;
    error.textContent=`軍火庫連線或零件載入失敗：${missing.join('、')}。請確認網路後重新整理。`;
    return;
  }
  const SIZE=8;
  const SYMBOLS=['✦','◈','✧','☽'];
  const NAMES=['樹影','雨幕','林間微光','雨聲'];
  const MAX_HP=90,MAX_BOSS=160;
  const SPECIAL_MARKS={sh:'↔',sv:'↕',w:'✣',b:'✶'};
  const $=id=>document.getElementById(id);
  const ui={board:$('board'),bossHp:$('bossHpText'),bossFill:$('bossHpFill'),bossShield:$('bossShield'),bossCountdown:$('bossCountdown'),playerHp:$('playerHpText'),playerFill:$('playerHpFill'),playerShield:$('playerShield'),playerEnergy:$('playerEnergy'),skill:$('skillBtn'),moves:$('moveCount'),status:$('turnStatus'),log:$('battleLog'),result:$('resultPanel'),resultTitle:$('resultTitle'),resultDescription:$('resultDescription'),restart:$('restart'),resultRestart:$('resultRestart')};
  let grid=[],selected=null,busy=false,finished=false,generation=0;
  let hp=MAX_HP,bossHp=MAX_BOSS,shield=0,bossShield=0,energy=0,steps=0,bossActions=0;
  const key=(r,c)=>`${r}:${c}`;
  const asPos=k=>{const [r,c]=k.split(':').map(Number);return {r,c};};
  const randomColor=()=>Math.floor(Math.random()*SYMBOLS.length);
  const makeTile=()=>({c:randomColor(),sp:null});
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const live=gen=>gen===generation;
  const inside=(r,c)=>r>=0&&r<SIZE&&c>=0&&c<SIZE;
  const adj=(a,b)=>Math.abs(a.r-b.r)+Math.abs(a.c-b.c)===1;
  const swap=(a,b)=>{const t=grid[a.r][a.c];grid[a.r][a.c]=grid[b.r][b.c];grid[b.r][b.c]=t;};
  const matches=()=>window.SlowlyGridLineMatch.find(grid,{minLength:3,getValue:cell=>cell.c,isBlocked:cell=>!cell||cell.c==null||cell.sp==='b'});

  function hasMove(){
    return window.SlowlyGridSwapSearch.findFirst(grid,{
      isImmediate({aCell,bCell}){return Boolean(aCell?.sp&&bCell?.sp)||aCell?.sp==='b'||bCell?.sp==='b';},
      testAfterSwap(){return matches().groups.length>0;}
    });
  }
  function makeBoard(){
    for(let attempt=0;attempt<70;attempt++){
      grid=Array.from({length:SIZE},()=>Array(SIZE).fill(null));
      for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
        let color;
        do{color=randomColor();}while((c>=2&&grid[r][c-1].c===color&&grid[r][c-2].c===color)||(r>=2&&grid[r-1][c].c===color&&grid[r-2][c].c===color));
        grid[r][c]={c:color,sp:null};
      }
      if(hasMove())return;
    }
    throw new Error('無法生成可交換棋盤');
  }
  function ensurePlayable(){
    if(hasMove()||grid.some(row=>row.some(tile=>tile?.sp)))return;
    const result=window.SlowlyGridShuffleUntil.run(grid,{
      maxAttempts:120,
      shuffle(values){const array=values.slice();for(let i=array.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[array[i],array[j]]=[array[j],array[i]];}return array;},
      accept(){return matches().groups.length===0&&Boolean(hasMove());}
    });
    if(!result.accepted){makeBoard();}
    log('霧氣重整了符文排列，已找到新的可行交換。');
  }
  function log(message){ui.log.textContent=message;}
  function render(freshKeys=null){
    ui.board.replaceChildren();
    const frag=document.createDocumentFragment();
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const tile=grid[r][c];
      const el=document.createElement('button');el.type='button';el.className='m3-cell';
      if(selected&&selected.r===r&&selected.c===c)el.classList.add('is-selected');
      if(freshKeys?.has(key(r,c)))el.classList.add('is-fresh');
      el.dataset.r=String(r);el.dataset.c=String(c);
      if(!tile){el.disabled=true;el.setAttribute('aria-label','空格');frag.append(el);continue;}
      el.dataset.color=String(tile.c);
      if(tile.sp)el.dataset.special=tile.sp;
      el.disabled=busy||finished;
      el.setAttribute('role','gridcell');
      el.setAttribute('aria-label',`第 ${r+1} 行第 ${c+1} 列，${NAMES[tile.c]}${tile.sp?'，特殊符文':''}`);
      el.setAttribute('aria-selected',String(Boolean(selected&&selected.r===r&&selected.c===c)));
      const glyph=document.createElement('span');glyph.className='m3-glyph';glyph.textContent=SYMBOLS[tile.c];el.append(glyph);
      if(tile.sp){const mark=document.createElement('span');mark.className='m3-special';mark.textContent=SPECIAL_MARKS[tile.sp];mark.setAttribute('aria-hidden','true');el.append(mark);}
      frag.append(el);
    }
    ui.board.append(frag);
    const remaining=Math.max(0,3-steps%3);
    ui.bossHp.textContent=`${bossHp} / ${MAX_BOSS}`;
    ui.bossFill.style.width=`${Math.max(0,100*bossHp/MAX_BOSS)}%`;
    ui.bossShield.textContent=`護盾 ${bossShield}`;
    ui.bossCountdown.textContent=`距離攻擊還有 ${remaining} 步`;
    ui.playerHp.textContent=`${hp} / ${MAX_HP}`;
    ui.playerFill.style.width=`${Math.max(0,100*hp/MAX_HP)}%`;
    ui.playerShield.textContent=`護盾 ${shield}`;
    ui.playerEnergy.textContent=`靈息 ${energy} / 100`;
    ui.skill.disabled=busy||finished||energy<100;
    ui.moves.textContent=`已交換 ${steps} 次`;
    ui.status.textContent=busy?'共鳴發動中':finished?'試煉結束':'旅人回合';
  }
  function clearKeys(keys){for(const k of keys){const {r,c}=asPos(k);if(inside(r,c)){grid[r][c]=null;}}}
  function specialCoverage(seeds){
    const result=window.SlowlyGridChainExpand.expand(grid,seeds,{
      maxWaves:15,
      expandAt({r,c,cell}){
        if(!cell?.sp)return [];
        if(cell.sp==='sh')return Array.from({length:SIZE},(_,col)=>({r,c:col}));
        if(cell.sp==='sv')return Array.from({length:SIZE},(_,row)=>({r:row,c}));
        if(cell.sp==='w'){const out=[];for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)out.push({r:r+dr,c:c+dc});return out;}
        if(cell.sp==='b'){const out=[];for(let rr=0;rr<SIZE;rr++)for(let cc=0;cc<SIZE;cc++)if(grid[rr][cc]?.c===cell.c)out.push({r:rr,c:cc});return out;}
        return [];
      }
    });
    return new Set(result.positions.map(({r,c})=>key(r,c)));
  }
  // 依原版概念：交會=T/L 包裝，五連=彩球，四連=橫／直條紋。盡量選交換落點生成。
  function computeCreations(found,lastMoved){
    const out=new Map(),belong=new Map();
    for(const group of found.groups){for(const pos of group.cells){const k=key(pos.r,pos.c);if(!belong.has(k))belong.set(k,[]);belong.get(k).push(group.type);}}
    for(const [k,types] of belong){
      if(types.includes('h')&&types.includes('v')){
        const {r,c}=asPos(k);if(!grid[r][c].sp)out.set(k,{c:grid[r][c].c,sp:'w'});
      }
    }
    for(const group of [...found.groups].sort((a,b)=>b.len-a.len)){
      if(group.len<4)continue;
      let possible=group.cells.filter(({r,c})=>!grid[r][c].sp&&!out.has(key(r,c)));
      if(!possible.length)continue;
      const pick=possible.find(({r,c})=>lastMoved&&r===lastMoved.r&&c===lastMoved.c)||possible[Math.floor(possible.length/2)];
      out.set(key(pick.r,pick.c),{c:grid[pick.r][pick.c].c,sp:group.len>=5?'b':group.type==='h'?'sh':'sv'});
    }
    return out;
  }
  function applyRewards(cleared,combo){
    let damage=0,guard=0,gain=0,heal=0;
    for(const tile of cleared){
      damage+=1;
      if(tile.c===0)damage+=2;
      if(tile.c===1)guard+=2;
      if(tile.c===2)gain+=9;
      if(tile.c===3)heal+=1;
    }
    const multiplier=1+Math.min(3,combo-1)*.25;
    const dealt=hitBoss(Math.max(1,Math.round(damage*multiplier)));
    shield=Math.min(90,shield+guard);
    energy=Math.min(100,energy+gain);
    hp=Math.min(MAX_HP,hp+heal);
    return {dealt,guard,gain,heal};
  }
  function hitBoss(raw){
    const blocked=Math.min(raw,bossShield);bossShield-=blocked;
    const dealt=Math.max(0,raw-blocked);bossHp=Math.max(0,bossHp-dealt);
    if(dealt)window.SilvaMatch3Visuals?.bossHurt(dealt);
    return dealt;
  }
  async function settle(initial,lastMoved,gen,extraSeeds=null){
    let found=initial,combo=0,total={dealt:0,guard:0,gain:0,heal:0};
    while(live(gen)&&combo<25){
      const seeds=new Set(extraSeeds||[]);
      if(found)for(const group of found.groups)for(const p of group.cells)seeds.add(key(p.r,p.c));
      if(!seeds.size)break;
      combo++;
      const creations=extraSeeds?new Map():computeCreations(found,lastMoved);
      const all=specialCoverage([...seeds].map(asPos));
      const preserved=new Set([...creations.keys()]);
      const cleared=[];
      for(const k of all){if(preserved.has(k))continue;const {r,c}=asPos(k);if(grid[r][c])cleared.push(grid[r][c]);}
      for(const k of all){if(preserved.has(k))continue;const {r,c}=asPos(k);grid[r][c]=null;}
      for(const [k,tile] of creations){const {r,c}=asPos(k);grid[r][c]=tile;}
      // 生成特殊符文的那一格仍然計入本次共鳴。
      for(const tile of creations.values())cleared.push(tile);
      const rewards=applyRewards(cleared,combo);
      for(const k of Object.keys(total))total[k]+=rewards[k];
      render();
      // 呈現一拍，然後依軍火庫重力生成新符文。
      await wait(160);if(!live(gen))return;
      window.SlowlyGridGravity.down(grid,{isEmpty:tile=>tile==null,createCell:()=>makeTile()});
      render(new Set(Array.from({length:SIZE*SIZE},(_,i)=>key(Math.floor(i/SIZE),i%SIZE))));
      await wait(190);if(!live(gen))return;
      if(bossHp<=0){finish(true);return;}
      found=matches();lastMoved=null;extraSeeds=null;
      if(!found.groups.length)break;
    }
    if(!live(gen))return;
    log(`共鳴 ${combo} 連鎖｜Boss −${total.dealt} HP、護盾 +${total.guard}、靈息 +${total.gain}${total.heal?`、治療 +${total.heal}`:''}`);
  }
  async function bossTurn(gen){
    if(!live(gen)||finished)return;
    bossActions++;
    ui.status.textContent='霧影行動中';
    ui.bossCountdown.textContent='霧影正在蓄勢…';
    await window.SilvaMatch3Visuals?.bossAttack();
    if(!live(gen))return;
    const raw=11+(bossActions%3===0?5:0);
    const blocked=Math.min(raw,shield);shield-=blocked;
    const hit=raw-blocked;hp=Math.max(0,hp-hit);
    if(bossActions%2===0){bossShield+=8;window.SilvaMatch3Visuals?.bossGuard();}
    log(`霧影反擊 ${raw} 點，護盾擋下 ${blocked}，旅人受到 ${hit} 點傷害${bossActions%2===0?'；霧影凝聚 8 點護盾':''}。`);
    render();
    if(hp<=0)finish(false);
    await wait(350);
  }
  async function trySwap(a,b){
    if(busy||finished)return;
    const gen=generation;busy=true;selected=null;
    swap(a,b);render();await wait(175);
    if(!live(gen))return;
    const x=grid[a.r][a.c],y=grid[b.r][b.c];
    let seeds=null;
    // 彩球以鄰格顏色為目標；其他特殊符文相鄰交換直接觸發組合。
    if(x.sp==='b'||y.sp==='b'){
      if(x.sp==='b'&&y.sp==='b')seeds=new Set(Array.from({length:SIZE*SIZE},(_,i)=>key(Math.floor(i/SIZE),i%SIZE)));
      else{
        const color=x.sp==='b'?y.c:x.c;
        seeds=new Set();for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)if(grid[r][c]?.c===color)seeds.add(key(r,c));
        seeds.add(key(a.r,a.c));seeds.add(key(b.r,b.c));
      }
    }else if(x.sp&&y.sp){seeds=new Set([key(a.r,a.c),key(b.r,b.c)]);}
    const found=matches();
    if(!seeds&&!found.groups.length){swap(a,b);render();log('這次交換沒有形成三連，符文已回到原位。');busy=false;render();return;}
    steps++;
    if(seeds)await settle(null,null,gen,seeds);
    else await settle(found,b,gen);
    if(!live(gen)||finished)return;
    ensurePlayable();
    if(steps%3===0)await bossTurn(gen);
    if(!live(gen)||finished)return;
    busy=false;render();
  }
  async function activateSpecial(pos){
    if(busy||finished)return;
    const tile=grid[pos.r][pos.c];if(!tile.sp)return;
    busy=true;selected=null;const gen=generation;
    steps++;
    await settle(null,null,gen,new Set([key(pos.r,pos.c)]));
    if(!live(gen)||finished)return;
    ensurePlayable();if(steps%3===0)await bossTurn(gen);
    if(!live(gen)||finished)return;
    busy=false;render();
  }
  function selectCell(pos){
    if(busy||finished)return;
    if(!selected){selected=pos;render();return;}
    if(selected.r===pos.r&&selected.c===pos.c){
      selected=null;
      if(grid[pos.r][pos.c].sp){void activateSpecial(pos);}else{render();}
      return;
    }
    if(adj(selected,pos)){const a=selected;selected=null;void trySwap(a,pos);return;}
    selected=pos;render();
  }
  let startTouch=null;
  ui.board.addEventListener('pointerdown',event=>{
    const tile=event.target.closest('.m3-cell');
    if(!tile||busy||finished)return;
    startTouch={r:Number(tile.dataset.r),c:Number(tile.dataset.c),x:event.clientX,y:event.clientY,pointerId:event.pointerId};
  });
  ui.board.addEventListener('pointerup',event=>{
    const touch=startTouch;startTouch=null;
    if(!touch||busy||finished||event.pointerId!==touch.pointerId)return;
    const dx=event.clientX-touch.x,dy=event.clientY-touch.y;
    if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;
    const a={r:touch.r,c:touch.c};
    const b={r:a.r+(Math.abs(dy)>Math.abs(dx)?Math.sign(dy):0),c:a.c+(Math.abs(dx)>=Math.abs(dy)?Math.sign(dx):0)};
    if(inside(b.r,b.c)){selected=null;void trySwap(a,b);}
    startTouch={ignoreClick:true};
  });
  ui.board.addEventListener('click',event=>{
    if(startTouch?.ignoreClick){startTouch=null;return;}
    const tile=event.target.closest('.m3-cell');if(!tile)return;
    selectCell({r:Number(tile.dataset.r),c:Number(tile.dataset.c)});
  });
  ui.board.addEventListener('pointercancel',()=>{startTouch=null;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&selected&&!busy){selected=null;render();}});
  ui.skill.addEventListener('click',()=>{
    if(busy||finished||energy<100)return;
    energy=0;const damage=hitBoss(24);shield+=8;
    log(`森林共鳴！對 Boss 造成 ${damage} 點傷害，旅人得到 8 點護盾。`);
    if(bossHp<=0)finish(true);render();
  });
  function finish(won){finished=true;busy=false;selected=null;
    ui.result.hidden=false;ui.resultTitle.textContent=won?'迷霧暫時散去':'旅人倒在霧中';
    ui.resultDescription.textContent=won?'試煉成功！森林仍有更多故事等待探索。':'試煉失敗。不必擔心，還可以重新挑戰。';render();}
  function restart(){
    generation++;busy=false;finished=false;selected=null;
    hp=MAX_HP;bossHp=MAX_BOSS;shield=0;bossShield=0;energy=0;steps=0;bossActions=0;
    ui.result.hidden=true;
    try{makeBoard();render();log('交換相鄰的符文，讓三個以上相同符文連成一線。');}
    catch(error){$('engineError').hidden=false;$('engineError').textContent=`無法初始化三消棋盤：${error.message}`;console.error(error);}
  }
  ui.restart.addEventListener('click',restart);ui.resultRestart.addEventListener('click',restart);
  restart();
})();
