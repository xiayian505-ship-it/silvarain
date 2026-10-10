/* 鹿雨森 Story｜純 UI 層：接收 Story 狀態並顯示，不自行處理劇情跳轉。 */
(() => {
  'use strict';
  const story = window.SilvarainStory;
  const byId = id => document.getElementById(id);
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  let activeTab = 'main';
  let expandedChapter = null;

  const screens = ['catalogScreen', 'readerScreen', 'statusScreen'];
  function showScreen(name) { screens.forEach(id => { byId(id).hidden = id !== name; }); }
  function stateText(item) {
    if (!item.published) return '尚未收錄';
    if (!item.unlocked) return '尚未解鎖';
    if (item.completed) return '已讀完 · 可重看';
    return '可閱讀';
  }

  function renderCatalog(snapshot) {
    showScreen('catalogScreen');
    byId('mainTab').classList.toggle('is-active', activeTab === 'main');
    byId('extrasTab').classList.toggle('is-active', activeTab === 'extras');
    byId('mainTab').setAttribute('aria-pressed', String(activeTab === 'main'));
    byId('extrasTab').setAttribute('aria-pressed', String(activeTab === 'extras'));

    const list = byId('catalogList');
    list.replaceChildren();
    const all = story.catalog();
    const items = activeTab === 'main' ? all.main : all.extras;

    items.forEach(item => {
      const wrapper = el('div', 'chapter-box');
      const open = item.published && item.unlocked;
      const row = el('button', 'chapter-button');
      row.type = 'button';
      row.disabled = !open;
      const label = el('div', 'chapter-content');
      label.append(el('span', 'chapter-title', item.title), el('span', 'chapter-description', stateText(item)));
      const status = el('span', 'chapter-status', open ? '›' : '🔒');
      if (!item.published) status.textContent = '預留';
      row.append(label, status);
      wrapper.append(row);

      if (activeTab === 'main') {
        row.setAttribute('aria-expanded', String(expandedChapter === item.id && open));
        row.addEventListener('click', () => {
          expandedChapter = expandedChapter === item.id ? null : item.id;
          renderCatalog(snapshot);
        });
        if (expandedChapter === item.id && open) {
          wrapper.classList.add('is-expanded');
          const secBox = el('div', 'section-list');
          item.sections.forEach(section => {
            const btn = el('button', 'section-button');
            btn.type = 'button';
            btn.disabled = !section.unlocked;
            const mark = el('span', 'section-marker', section.completed ? '✓' : section.unlocked ? '○' : '•');
            const title = el('span', 'section-label', section.title);
            const state = el('span', 'chapter-status', section.completed ? '重看' : section.unlocked ? '閱讀' : '未解鎖');
            btn.append(mark, title, state);
            btn.addEventListener('click', () => story.openSection(item.id, section.id));
            secBox.append(btn);
          });
          wrapper.append(secBox);
        }
      } else {
        row.addEventListener('click', () => story.openExtra(item.id));
      }
      list.append(wrapper);
    });
    const bookmark = snapshot.progress.bookmark;
    let canResume = false;
    if (bookmark) {
      if (bookmark.kind === 'extra') {
        canResume = all.extras.some(e => e.id === bookmark.sectionId && e.published && e.unlocked);
      } else {
        canResume = all.main.some(ch => ch.id === bookmark.chapterId &&
          ch.sections.some(s => s.id === bookmark.sectionId && s.unlocked));
      }
    }
    byId('resumeButton').hidden = !canResume;
  }

  function renderReader(snapshot) {
    showScreen('readerScreen');
    const event = story.currentEvent();
    if (!event) return;
    const heading = byId('readerHeading');
    heading.textContent = snapshot.entry.title;
    const speaker = byId('speakerName');
    const text = byId('storyText');
    const options = byId('storyChoices');
    const next = byId('nextButton');
    const notice = byId('readerNotice');
    options.replaceChildren();
    notice.hidden = !snapshot.error;
    notice.textContent = snapshot.error || '';

    if (event.type === 'dialogue' || event.type === 'text') {
      speaker.textContent = event.speaker || event.name || '';
      text.textContent = event.text || '';
      next.hidden = false;
    } else if (event.type === 'narration' || event.type === 'scene') {
      speaker.textContent = event.type === 'scene' ? '場景' : '';
      text.textContent = event.text || event.title || '';
      next.hidden = false;
    } else if (event.type === 'choice') {
      speaker.textContent = '';
      text.textContent = event.prompt || '請選擇';
      next.hidden = true;
      (event.options || []).forEach((option, i) => {
        const button = el('button', '', option.text || `選項 ${i+1}`);
        button.type = 'button';
        button.addEventListener('click', () => story.chooseOption(i));
        options.append(button);
      });
      if (!event.options?.length) {
        notice.textContent = '選項事件尚未設定 options。';
        notice.hidden = false;
      }
    } else if (event.type === 'challenge') {
      speaker.textContent = '關卡預留';
      text.textContent = '這裡預留了關卡事件，但正式玩法尚未決定。為避免跳過關卡，目前暫停在此。';
      next.hidden = true;
    } else {
      speaker.textContent = '格式待確認';
      text.textContent = `尚未支援的事件類型：${String(event.type || '(無)')}`;
      next.hidden = true;
    }
    byId('readingPosition').textContent = `${snapshot.eventIndex + 1} / ${snapshot.entry.events.length}`;
  }

  function renderStatus(snapshot) {
    showScreen('statusScreen');
    const title = byId('statusTitle');
    const text = byId('statusText');
    const next = byId('statusNext');
    next.hidden = true;
    if (snapshot.page === 'loading') {
      title.textContent = '正在翻開故事';
      text.textContent = '請稍候，迷霧正在散去。';
    } else if (snapshot.page === 'error') {
      title.textContent = '劇情尚未能開啟';
      text.textContent = `${snapshot.error}（如果是直接開啟本機 HTML，請改由 GitHub Pages 或本機 HTTP 伺服器測試。）`;
    } else {
      title.textContent = '本節閱讀完畢';
      text.textContent = '閱讀紀錄已更新，可以回目錄重看已解鎖故事。';
      const following = story.nextAvailable();
      if (following) {
        next.hidden = false;
        next.onclick = () => story.openSection(following.chapterId, following.sectionId);
      }
    }
  }

  function render(snapshot) {
    if (snapshot.page === 'catalog') renderCatalog(snapshot);
    else if (snapshot.page === 'reader') renderReader(snapshot);
    else renderStatus(snapshot);
  }

  byId('mainTab').addEventListener('click', () => { activeTab = 'main'; render(story.snapshot()); });
  byId('extrasTab').addEventListener('click', () => { activeTab = 'extras'; render(story.snapshot()); });
  byId('returnCatalog').addEventListener('click', story.openCatalog);
  byId('statusBack').addEventListener('click', story.openCatalog);
  byId('nextButton').addEventListener('click', story.advance);
  byId('resumeButton').addEventListener('click', story.resume);
  byId('backButton').addEventListener('click', () => {
    if (window.SlowlyNavigation) window.SlowlyNavigation.go('../index.html');
    else { byId('statusTitle').textContent = '跳轉元件未載入'; showScreen('statusScreen'); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && story.snapshot().page === 'reader') story.openCatalog();
    if (e.key === 'ArrowRight' && story.snapshot().page === 'reader' &&
        !['BUTTON','INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) story.advance();
  });

  story.subscribe(render);
  story.initialize();
})();
