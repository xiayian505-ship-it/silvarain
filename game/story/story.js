/* 鹿雨森 Story｜唯一的章節／小節／事件流程管理者
 * 不操作 DOM；UI 僅訂閱變更並呼叫本檔公開方法。
 * 網頁之間的跳轉由慢慢軍火庫 SlowlyNavigation 處理。
 */
(() => {
  'use strict';

  const DATA_BASE = new URL('./data/', window.location.href);
  const STORAGE_KEY = 'silvarain.story.progress.v1';
  const subscribers = new Set();
  const createProgress = () => ({
    completedSections: [], completedChapters: [], completedExtras: [],
    unlockedChapters: ['prologue'], bookmark: null
  });

  function loadProgress() {
    const defaults = createProgress();
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!parsed || typeof parsed !== 'object') return defaults;
      for (const field of ['completedSections', 'completedChapters', 'completedExtras', 'unlockedChapters']) {
        defaults[field] = Array.isArray(parsed[field])
          ? parsed[field].filter(x => typeof x === 'string') : [];
      }
      defaults.bookmark = parsed.bookmark && typeof parsed.bookmark === 'object' ? parsed.bookmark : null;
      if (!defaults.unlockedChapters.includes('prologue')) defaults.unlockedChapters.unshift('prologue');
    } catch (_) { /* 不可用的本機資料回到初始狀態 */ }
    return defaults;
  }

  let progress = loadProgress();
  let manifest = null;
  let view = { page: 'catalog', entry: null, eventIndex: 0, error: '' };
  let requestSerial = 0;

  const uniqueAdd = (list, value) => { if (!list.includes(value)) list.push(value); };
  function saveProgress() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }
    catch (_) { /* 隱私模式／容量阻擋時仍可當次閱讀 */ }
  }
  function announce() { subscribers.forEach(fn => fn(snapshot())); }
  function snapshot() { return { ...view, progress: JSON.parse(JSON.stringify(progress)) }; }
  function sectionKey(chapterId, sectionId) { return `${chapterId}/${sectionId}`; }
  function publishedSections(chapter) { return (chapter.sections || []).filter(s => s.enabled === true); }
  function isChapterUnlocked(chapter, index) {
    return index === 0 || progress.unlockedChapters.includes(chapter.id);
  }
  function isSectionUnlocked(chapter, index, sectionIndex) {
    if (!isChapterUnlocked(chapter, index)) return false;
    const section = publishedSections(chapter)[sectionIndex];
    if (!section) return false;
    if (sectionIndex === 0) return true;
    const earlier = publishedSections(chapter)[sectionIndex - 1];
    return progress.completedSections.includes(sectionKey(chapter.id, earlier.id)) ||
      progress.completedSections.includes(sectionKey(chapter.id, section.id));
  }
  function isExtraUnlocked(extra) {
    return !extra.unlockAfter || progress.completedChapters.includes(extra.unlockAfter);
  }

  function catalog() {
    if (!manifest) return { main: [], extras: [] };
    return {
      main: manifest.main.map((chapter, i) => {
        const published = publishedSections(chapter);
        return {
          id: chapter.id, title: chapter.title,
          published: published.length > 0,
          unlocked: isChapterUnlocked(chapter, i),
          completed: progress.completedChapters.includes(chapter.id),
          sections: published.map((s, j) => ({
            id: s.id, title: s.title,
            unlocked: isSectionUnlocked(chapter, i, j),
            completed: progress.completedSections.includes(sectionKey(chapter.id, s.id))
          }))
        };
      }),
      extras: manifest.extras.map(e => ({
        id: e.id, title: e.title, published: e.enabled === true,
        unlocked: isExtraUnlocked(e), completed: progress.completedExtras.includes(e.id)
      }))
    };
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`讀取失敗（HTTP ${response.status}）`);
    return response.json();
  }
  function fileUrl(file) {
    const result = new URL(String(file), DATA_BASE);
    if (result.origin !== DATA_BASE.origin || !result.pathname.startsWith(DATA_BASE.pathname)) {
      throw new Error('劇情檔案路徑不合法');
    }
    return result;
  }

  async function initialize() {
    try {
      const value = await fetchJson(new URL('chapters.json', DATA_BASE));
      if (!Array.isArray(value.main) || !Array.isArray(value.extras)) {
        throw new Error('chapters.json 的主線／番外索引格式錯誤');
      }
      manifest = value;
      view = { page: 'catalog', entry: null, eventIndex: 0, error: '' };
    } catch (err) {
      view = { page: 'error', entry: null, eventIndex: 0, error: err.message || String(err) };
    }
    announce();
  }

  function openCatalog() {
    requestSerial += 1;
    view = { page: 'catalog', entry: null, eventIndex: 0, error: '' };
    announce();
  }

  async function openSection(chapterId, sectionId, resume = false) {
    if (!manifest) return;
    const chapterIndex = manifest.main.findIndex(x => x.id === chapterId);
    if (chapterIndex < 0) return;
    const chapter = manifest.main[chapterIndex];
    const sections = publishedSections(chapter);
    const sectionIndex = sections.findIndex(x => x.id === sectionId);
    if (sectionIndex < 0 || !isSectionUnlocked(chapter, chapterIndex, sectionIndex)) return;
    await openEntry({ kind: 'main', chapterId, chapterIndex, sectionId,
      sectionIndex, title: sections[sectionIndex].title, file: sections[sectionIndex].file }, resume);
  }

  async function openExtra(extraId, resume = false) {
    if (!manifest) return;
    const extra = manifest.extras.find(x => x.id === extraId);
    if (!extra || extra.enabled !== true || !isExtraUnlocked(extra)) return;
    await openEntry({ kind: 'extra', chapterId: null, sectionId: extra.id,
      title: extra.title, file: extra.file }, resume);
  }

  async function openEntry(info, resume) {
    const serial = ++requestSerial;
    view = { page: 'loading', entry: null, eventIndex: 0, error: '' };
    announce();
    try {
      const data = await fetchJson(fileUrl(info.file));
      if (serial !== requestSerial) return;
      if (!Array.isArray(data.events) || data.events.length === 0) {
        throw new Error('這節尚未填入正式劇情，請先補上 events 再開放。');
      }
      if (data.id !== info.sectionId) {
        throw new Error('劇情資料 ID 與章節索引不一致。');
      }
      const bookmark = progress.bookmark;
      const index = resume && bookmark && bookmark.kind === info.kind &&
        bookmark.chapterId === info.chapterId && bookmark.sectionId === info.sectionId &&
        Number.isInteger(bookmark.index) ? Math.max(0, Math.min(bookmark.index, data.events.length - 1)) : 0;
      view = { page: 'reader', entry: { ...info, events: data.events }, eventIndex: index, error: '' };
      remember();
    } catch (err) {
      if (serial !== requestSerial) return;
      view = { page: 'error', entry: null, eventIndex: 0, error: err.message || String(err) };
    }
    announce();
  }

  function remember() {
    if (view.page !== 'reader') return;
    const e = view.entry;
    progress.bookmark = { kind: e.kind, chapterId: e.chapterId,
      sectionId: e.sectionId, index: view.eventIndex };
    saveProgress();
  }

  function currentEvent() {
    return view.page === 'reader' ? view.entry.events[view.eventIndex] : null;
  }

  function advance() {
    const event = currentEvent();
    if (!event || event.type === 'choice' || event.type === 'challenge') return;
    const next = view.eventIndex + 1;
    if (next >= view.entry.events.length) finishSection();
    else {
      view.eventIndex = next;
      remember(); announce();
    }
  }

  function chooseOption(optionIndex) {
    const event = currentEvent();
    if (!event || event.type !== 'choice' || !Array.isArray(event.options)) return;
    const chosen = event.options[optionIndex];
    if (!chosen) return;
    if (chosen.goto) {
      const index = view.entry.events.findIndex(x => x.id === chosen.goto);
      if (index < 0) {
        view.error = `找不到劇情事件 ID：${chosen.goto}`;
        announce();
        return;
      }
      view.eventIndex = index;
      view.error = '';
      remember(); announce();
    } else {
      const next = view.eventIndex + 1;
      if (next >= view.entry.events.length) finishSection();
      else { view.eventIndex = next; remember(); announce(); }
    }
  }

  function finishSection() {
    if (view.page !== 'reader') return;
    const entry = view.entry;
    if (entry.kind === 'extra') {
      uniqueAdd(progress.completedExtras, entry.sectionId);
    } else {
      uniqueAdd(progress.completedSections, sectionKey(entry.chapterId, entry.sectionId));
      const chapter = manifest.main[entry.chapterIndex];
      const ready = publishedSections(chapter);
      if (ready.length && ready.every(s => progress.completedSections.includes(sectionKey(chapter.id, s.id)))) {
        uniqueAdd(progress.completedChapters, chapter.id);
        if (manifest.main[entry.chapterIndex + 1]) {
          uniqueAdd(progress.unlockedChapters, manifest.main[entry.chapterIndex + 1].id);
        }
      }
    }
    progress.bookmark = null;
    saveProgress();
    view = { page: 'complete', entry, eventIndex: view.eventIndex, error: '' };
    announce();
  }

  async function resume() {
    const b = progress.bookmark;
    if (!b) return;
    if (b.kind === 'extra') await openExtra(b.sectionId, true);
    else await openSection(b.chapterId, b.sectionId, true);
  }

  function nextAvailable() {
    if (view.page !== 'complete' || view.entry.kind !== 'main') return null;
    const e = view.entry;
    const all = catalog().main;
    const current = all[e.chapterIndex];
    const pos = current.sections.findIndex(s => s.id === e.sectionId);
    const following = current.sections[pos + 1];
    if (following && following.unlocked) return { chapterId: current.id, sectionId: following.id };
    const nextChapter = all[e.chapterIndex + 1];
    if (nextChapter && nextChapter.published && nextChapter.sections[0]?.unlocked) {
      return { chapterId: nextChapter.id, sectionId: nextChapter.sections[0].id };
    }
    return null;
  }

  window.SilvarainStory = Object.freeze({
    subscribe(handler) { subscribers.add(handler); return () => subscribers.delete(handler); },
    initialize, catalog, snapshot, currentEvent, openCatalog,
    openSection, openExtra, advance, chooseOption, resume, nextAvailable
  });
})();
