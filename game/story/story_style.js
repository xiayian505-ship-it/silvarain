/* 鹿雨森 Story｜UI 渲染與森林表現。劇情流程完全委由 story.js。
 * 森林／雨／霧取自軍火庫 HTTPS 零件，不在這裡複製實作。
 */
(() => {
  'use strict';
  const story = window.SilvarainStory;
  const $ = id => document.getElementById(id);
  const node = (tag, cls, value) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (value !== undefined) e.textContent = value;
    return e;
  };
  const sceneNames = {
    mist: ['MIST · FIRST LIGHT', '夢與初見'],
    swamp: ['MIST · MARSHLAND', '霧中沼澤'],
    tree: ['THE TREE OF LIFE', '生命之樹'],
    rain: ['RAIN · MEMORIES', '雨與記憶']
  };
  let activeTab = 'main';
  let expandedChapter = null;
  const screens = ['catalogScreen', 'readerScreen', 'statusScreen'];
  function showScreen(id) { screens.forEach(x => { $(x).hidden = x !== id; }); }
  function stateText(item) {
    if (!item.published) return '故事尚未寫入';
    if (!item.unlocked) return '尚未解鎖';
    if (item.completed) return '已讀完 · 可隨時重看';
    return '已解鎖 · 可閱讀';
  }
  function renderCatalog(snapshot) {
    showScreen('catalogScreen');
    $('mainTab').classList.toggle('is-active', activeTab === 'main');
    $('extrasTab').classList.toggle('is-active', activeTab === 'extras');
    $('mainTab').setAttribute('aria-pressed', String(activeTab === 'main'));
    $('extrasTab').setAttribute('aria-pressed', String(activeTab === 'extras'));
    const list = $('catalogList');
    list.replaceChildren();
    const all = story.catalog();
    const items = activeTab === 'main' ? all.main : all.extras;
    items.forEach((item, i) => {
      const wrapper = node('div', 'chapter-box' + (!(item.published && item.unlocked) ? ' is-locked' : ''));
      const open = item.published && item.unlocked;
      const row = node('button', 'chapter-button');
      row.type = 'button'; row.disabled = !open;
      const label = node('div', 'chapter-content');
      label.append(node('span', 'chapter-title', item.title), node('span', 'chapter-description', stateText(item)));
      const badge = node('span', 'chapter-status', open ? (item.completed ? '已讀完  ✓' : '展開  ↗') : (item.published ? '未解鎖  ◇' : '敬請期待'));
      const numeral = node('span', 'chapter-number', activeTab === 'main' ? (i===0?'00':i===11?'END':String(i).padStart(2,'0')) : String(i+1).padStart(2,'0'));
      row.append(numeral, label, badge);
      wrapper.append(row);
      if (activeTab === 'main') {
        row.setAttribute('aria-expanded', String(expandedChapter===item.id && open));
        row.addEventListener('click', () => {
          expandedChapter = expandedChapter === item.id ? null : item.id;
          renderCatalog(snapshot);
        });
        if (expandedChapter === item.id && open) {
          wrapper.classList.add('is-expanded');
          const group = node('div', 'section-list');
          item.sections.forEach(s => {
            const button = node('button', 'section-button');
            button.type = 'button'; button.disabled = !s.unlocked;
            button.append(node('span','section-marker',s.completed?'✓':s.unlocked?'◈':'·'),
                          node('span','section-label',s.title),
                          node('span','chapter-status',s.completed?'重新閱讀':s.unlocked?'開始閱讀':'尚未解鎖'));
            button.addEventListener('click', () => story.openSection(item.id, s.id));
            group.append(button);
          });
          wrapper.append(group);
        }
      } else row.addEventListener('click', () => story.openExtra(item.id));
      list.append(wrapper);
    });
    const b = snapshot.progress.bookmark;
    let canResume = false;
    if (b) {
      if (b.kind === 'extra') canResume=all.extras.some(x=>x.id===b.sectionId&&x.published&&x.unlocked);
      else canResume=all.main.some(x=>x.id===b.chapterId&&x.sections.some(s=>s.id===b.sectionId&&s.unlocked));
    }
    $('resumeButton').hidden = !canResume;
  }
  function renderReader(snapshot) {
    showScreen('readerScreen');
    const event = story.currentEvent();
    if (!event) return;
    const scene = sceneNames[event.scene] || sceneNames.mist;
    $('visualStage').dataset.scene = sceneNames[event.scene] ? event.scene : 'mist';
    $('sceneKicker').textContent = scene[0];
    $('sceneTitle').textContent = event.type === 'scene' ? (event.title || scene[1]) : scene[1];
    const speaker = $('speakerName');
    const text = $('storyText');
    const choices = $('storyChoices');
    const next = $('nextButton');
    const notice = $('readerNotice');
    choices.replaceChildren();
    notice.hidden = !snapshot.error;
    notice.textContent = snapshot.error || '';
    $('readerHeading').textContent = snapshot.entry.title;
    $('progressFill').style.width = `${((snapshot.eventIndex+1)/snapshot.entry.events.length)*100}%`;
    $('stageSpeaker').hidden = event.type !== 'dialogue';
    $('stageSpeaker').textContent = event.type === 'dialogue' ? (event.speaker || '？？？') : '';
    next.hidden = false;
    if (['dialogue','text'].includes(event.type)) {
      speaker.textContent = event.speaker || event.name || '';
      text.textContent = event.text || '';
    } else if (event.type === 'narration' || event.type === 'scene') {
      speaker.textContent = event.type === 'scene' ? '場景｜' + (event.title || '') : '';
      text.textContent = event.text || event.title || '';
    } else if (event.type === 'choice') {
      speaker.textContent = '璐瑤的心聲';
      text.textContent = event.prompt || '請做出選擇';
      next.hidden = true;
      (event.options || []).forEach((opt,i) => {
        const button = node('button','choice-option',opt.text || `選項 ${i+1}`);
        button.type = 'button';button.addEventListener('click',()=>story.chooseOption(i));choices.append(button);
      });
      if (!event.options?.length) { notice.textContent = '尚未設定選項內容。';notice.hidden=false; }
    } else if (event.type === 'challenge') {
      speaker.textContent = '關卡預留';text.textContent = '正式關卡尚未確定，這裡先保留接口，不會假裝完成挑戰。';next.hidden = true;
    } else {
      speaker.textContent = '未知事件';text.textContent = `尚未支援的劇情事件：${String(event.type||'(無)')}`;next.hidden = true;
    }
    text.scrollTop = 0;
    text.classList.remove('is-new');void text.offsetWidth;text.classList.add('is-new');
    $('readingPosition').textContent = `${String(snapshot.eventIndex+1).padStart(2,'0')} / ${String(snapshot.entry.events.length).padStart(2,'0')}`;
  }
  function renderStatus(snapshot) {
    showScreen('statusScreen');
    const title=$('statusTitle'),description=$('statusText'),next=$('statusNext');
    next.hidden = true;next.onclick = null;
    if (snapshot.page === 'loading') {
      title.textContent = '正在翻開故事';description.textContent = '稍候片刻。雨聲仍在，記憶正在甦醒。';
    } else if (snapshot.page === 'error') {
      title.textContent='迷霧遮住了文字';description.textContent=`${snapshot.error}。請透過 GitHub Pages 或本機 HTTP 伺服器開啟故事。`;
    } else {
      title.textContent='本節 · 已讀完';
      description.textContent='這段記憶已經留下。現在可以回到目錄重新閱讀，或繼續翻開下一節。';
      const upcoming=story.nextAvailable();
      if (upcoming) {next.hidden=false;next.onclick=()=>story.openSection(upcoming.chapterId,upcoming.sectionId);}
    }
  }
  let lastPage = null;
  function render(snapshot) {
    if (snapshot.page === 'catalog') renderCatalog(snapshot);
    else if (snapshot.page === 'reader') renderReader(snapshot);
    else renderStatus(snapshot);
    if (snapshot.page !== lastPage) {
      window.scrollTo({top:0,behavior:'instant'});
      lastPage = snapshot.page;
    }
  }
  $('mainTab').addEventListener('click',()=>{activeTab='main';render(story.snapshot());});
  $('extrasTab').addEventListener('click',()=>{activeTab='extras';render(story.snapshot());});
  $('returnCatalog').addEventListener('click',story.openCatalog);
  $('statusBack').addEventListener('click',story.openCatalog);
  $('nextButton').addEventListener('click',story.advance);
  $('resumeButton').addEventListener('click',story.resume);
  // 手機閱讀操作：點對話框空白處下一句，不搶走選項或按鈕事件。
  $('dialoguePanel').addEventListener('click',event=>{
    if (event.target.closest('button')) return;
    const s=story.snapshot();
    if (s.page==='reader' && !['choice','challenge'].includes(story.currentEvent()?.type)) story.advance();
  });
  $('backButton').addEventListener('click',()=>{
    if (window.SlowlyNavigation) window.SlowlyNavigation.go('../index.html');
    else { $('statusTitle').textContent='入口暫時無法跳轉'; $('statusText').textContent='請確認軍火庫 Navigation 已載入。'; showScreen('statusScreen'); }
  });
  document.addEventListener('keydown',e=>{
    const s=story.snapshot();
    if(e.key==='Escape'&&s.page==='reader')story.openCatalog();
    if(e.key==='ArrowRight'&&s.page==='reader'&&!['BUTTON','INPUT','TEXTAREA'].includes(document.activeElement?.tagName))story.advance();
  });
  story.subscribe(render);
  story.initialize();

  // Canvas 來源均為 lib.stillnessbyslowly.com 的獨立積木，失敗則退回 CSS 林霧背景。
  const pieces=[];
  try {
    if(window.SlowlyPineForest?.create){
      pieces.push(window.SlowlyPineForest.create({canvas:'#storyForestBack',seed:24,density:.95,maxDpr:1.5,
        layers:[{baseline:.72,minHeight:.21,maxHeight:.34,color:'#204847',width:.34},
                {baseline:.92,minHeight:.26,maxHeight:.46,color:'#122f34',width:.39}]}));
      pieces.push(window.SlowlyPineForest.create({canvas:'#storyForestFront',seed:63,maxDpr:1.5,
        layers:[{baseline:1.16,minHeight:.40,maxHeight:.64,color:'#06161b',width:.4,fillBelow:false}]}));
    }
    if(window.SlowlyCanvasFog?.create)pieces.push(window.SlowlyCanvasFog.create({canvas:'#storyFog',count:21,color:'#c9e6d7',opacity:.73,speed:.64,size:1.05,maxDpr:1.5,autoStart:true}));
    if(window.SlowlyCanvasRain?.create)pieces.push(window.SlowlyCanvasRain.create({canvas:'#storyRain',count:Math.min(240,Math.floor(innerWidth/5)),color:'#b8e0d5',opacity:.75,speed:.8,wind:.15,length:1,maxDpr:1.5,autoStart:true}));
  }catch(error){console.warn('鹿雨森 Story：自然特效暫不可用，使用 CSS 背景。',error);}
  addEventListener('pagehide',()=>pieces.forEach(p=>{try{p?.destroy?.();}catch(_){}}),{once:true});
})();
