// ==UserScript==
// @name         SimpCity Post & Thread Filter
// @namespace    https://github.com/taylorfunk/simpcity-tools
// @version      2.2.0
// @description  Sort threads and posts by most liked/reactions with date filtering. Scan All Pages to rank posts across entire threads. Forum lists sort by Likes, Views, or Replies. Touch/mobile support, boundary-clamped panel.
// @author       Taylor Funk
// @license      MIT
// @match        https://simpcity.cr/*
// @match        https://simpcity.su/*
// @match        https://simpcity.li/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @noframes
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SCRIPT_ID = 'scpf';
  const LOG_PREFIX = '[SCPostFilter]';

  const DATE_RANGES = {
    all:     { label: 'All Time',   days: 0 },
    today:   { label: 'Today',      days: 1 },
    week:    { label: 'This Week',  days: 7 },
    month:   { label: 'This Month', days: 30 },
    quarter: { label: '3 Months',   days: 90 },
    year:    { label: 'This Year',  days: 365 }
  };

  const SORT_MODES = {
    reactions: { label: '🔥 Most Liked',   key: 'reactions' },
    newest:    { label: '🕐 Newest First',  key: 'newest' },
    oldest:    { label: '📅 Oldest First',  key: 'oldest' }
  };

  let currentDateRange = GM_getValue(`${SCRIPT_ID}_dateRange`, 'all');
  let currentSort = GM_getValue(`${SCRIPT_ID}_sort`, 'reactions');
  let isActive = false;
  let panelEl = null;

  // ========================================
  // STYLES
  // ========================================
  GM_addStyle(`
    .${SCRIPT_ID}-panel {
      position: fixed; bottom: 20px; right: 20px; z-index: 99999;
      background: rgba(18, 18, 18, 0.97); border: 1px solid #2b2b2b; border-radius: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #e6e6e6; box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      min-width: 260px; backdrop-filter: blur(8px); user-select: none;
    }
    .${SCRIPT_ID}-panel.minimized .${SCRIPT_ID}-body { display: none; }

    .${SCRIPT_ID}-header {
      display: flex; justify-content: space-between; align-items: center; padding: 10px 14px;
      background: linear-gradient(135deg, #1a1a1a 0%, #111 100%);
      border-radius: 14px 14px 0 0; cursor: move; border-bottom: 1px solid #2b2b2b;
    }
    .${SCRIPT_ID}-panel.minimized .${SCRIPT_ID}-header { border-radius: 14px; border-bottom: none; }
    .${SCRIPT_ID}-title { font-weight: 700; font-size: 13px; color: #3aff9d; display: flex; align-items: center; gap: 6px; }
    .${SCRIPT_ID}-header-btn {
      background: none; border: none; color: #666; cursor: pointer; font-size: 16px; padding: 2px 4px;
      line-height: 1; border-radius: 4px; transition: color 0.15s, background 0.15s;
    }
    .${SCRIPT_ID}-header-btn:hover { color: #fff; background: rgba(255,255,255,0.08); }

    .${SCRIPT_ID}-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
    .${SCRIPT_ID}-section-label { font-size: 10px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }

    .${SCRIPT_ID}-pills { display: flex; flex-wrap: wrap; gap: 5px; }
    .${SCRIPT_ID}-pill {
      background: #1c1c1c; border: 1px solid #333; border-radius: 20px;
      padding: 5px 11px; font-size: 11px; font-weight: 600; cursor: pointer; color: #aaa; transition: all 0.15s;
    }
    .${SCRIPT_ID}-pill:hover { border-color: #555; color: #ddd; }
    .${SCRIPT_ID}-pill.active { background: rgba(58, 255, 157, 0.1); border-color: #3aff9d; color: #3aff9d; }

    .${SCRIPT_ID}-sort-row { display: flex; gap: 5px; }
    .${SCRIPT_ID}-sort-btn {
      flex: 1; background: #1c1c1c; border: 1px solid #333; border-radius: 8px;
      padding: 7px 6px; font-size: 11px; font-weight: 600; cursor: pointer; color: #aaa; text-align: center; transition: all 0.15s;
    }
    .${SCRIPT_ID}-sort-btn:hover { border-color: #555; color: #ddd; }
    .${SCRIPT_ID}-sort-btn.active { background: rgba(59, 130, 246, 0.12); border-color: #3b82f6; color: #60a5fa; }

    .${SCRIPT_ID}-actions { display: flex; gap: 6px; margin-top: 2px; }
    .${SCRIPT_ID}-apply-btn {
      flex: 1; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; border-radius: 8px;
      padding: 9px; color: white; font-size: 12px; font-weight: 700; cursor: pointer; transition: filter 0.15s;
    }
    .${SCRIPT_ID}-apply-btn:hover { filter: brightness(1.1); }
    .${SCRIPT_ID}-reset-btn {
      background: #1c1c1c; border: 1px solid #333; border-radius: 8px;
      padding: 9px 14px; color: #888; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s;
    }
    .${SCRIPT_ID}-reset-btn:hover { border-color: #ef4444; color: #ef4444; }

    .${SCRIPT_ID}-stats { font-size: 10px; color: #555; text-align: center; padding-top: 4px; border-top: 1px solid #222; }

    .${SCRIPT_ID}-rank-badge {
      display: inline-flex; align-items: center; gap: 4px;
      background: rgba(58, 255, 157, 0.08); border: 1px solid rgba(58, 255, 157, 0.2);
      border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 700; color: #3aff9d; margin-left: 8px;
    }
    .${SCRIPT_ID}-rank-badge.top3 { background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.3); color: #f59e0b; }
    .${SCRIPT_ID}-rank-badge.zero { background: rgba(100, 100, 100, 0.08); border-color: rgba(100, 100, 100, 0.2); color: #555; }

    .${SCRIPT_ID}-scroll-list { max-height: 160px; overflow-y: auto; margin-top: 6px; }
    .${SCRIPT_ID}-scroll-item {
      display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 6px;
      cursor: pointer; font-size: 11px; transition: background 0.1s;
    }
    .${SCRIPT_ID}-scroll-item:hover { background: rgba(255,255,255,0.05); }
    .${SCRIPT_ID}-scroll-rank { font-weight: 700; color: #3aff9d; min-width: 20px; }
    .${SCRIPT_ID}-scroll-info { color: #aaa; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .${SCRIPT_ID}-scroll-count { font-weight: 700; color: #3aff9d; }

    article.message.${SCRIPT_ID}-hidden { display: none !important; }

    .${SCRIPT_ID}-scan-btn {
      flex: 1; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border: none; border-radius: 8px;
      padding: 9px; color: white; font-size: 12px; font-weight: 700; cursor: pointer; transition: filter 0.15s;
    }
    .${SCRIPT_ID}-scan-btn:hover { filter: brightness(1.1); }
    .${SCRIPT_ID}-scan-btn:disabled { opacity: 0.5; cursor: not-allowed; filter: none; }

    .${SCRIPT_ID}-progress { margin-top: 4px; }
    .${SCRIPT_ID}-progress-bar {
      height: 4px; background: #1c1c1c; border-radius: 4px; overflow: hidden; margin-bottom: 4px;
    }
    .${SCRIPT_ID}-progress-fill {
      height: 100%; background: linear-gradient(90deg, #3b82f6, #3aff9d); border-radius: 4px;
      transition: width 0.3s ease; width: 0%;
    }
    .${SCRIPT_ID}-progress-text { font-size: 10px; color: #666; text-align: center; }

    .${SCRIPT_ID}-scroll-page {
      font-size: 9px; color: #555; background: rgba(255,255,255,0.05); padding: 1px 5px;
      border-radius: 4px; white-space: nowrap; flex-shrink: 0;
    }
    .${SCRIPT_ID}-scroll-item.cross-page { border-left: 2px solid #3b82f6; padding-left: 6px; }
    .${SCRIPT_ID}-scroll-item.cross-page .${SCRIPT_ID}-scroll-rank { color: #60a5fa; }

    .${SCRIPT_ID}-forum-bar {
      display: flex; gap: 6px; align-items: center; padding: 8px 12px; flex-wrap: wrap;
      background: rgba(18, 18, 18, 0.95); border: 1px solid #2b2b2b; border-radius: 10px; margin-bottom: 12px;
    }
    .${SCRIPT_ID}-forum-bar-label { font-size: 11px; font-weight: 700; color: #3aff9d; white-space: nowrap; }
  `);

  // ========================================
  // UTILITIES
  // ========================================
  function log(...args) { console.log(LOG_PREFIX, ...args); }
  function isThreadPage() { return !!document.querySelector('article.message, .message[data-content]'); }
  function isForumListPage() { return !!document.querySelector('.structItem--thread') && !isThreadPage(); }

  // Active highlight timer - prevents stacking when clicking scroll items rapidly
  let _highlightTimer = null;
  let _highlightedEl = null;

  // Cross-page scan state
  let _scanCache = null; // { url, posts[] } - cached scan results
  let _isScanning = false;

  function getDateCutoff(rangeKey) {
    const range = DATE_RANGES[rangeKey];
    if (!range || range.days === 0) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range.days);
    cutoff.setHours(0, 0, 0, 0);
    return cutoff;
  }

  // ========================================
  // REACTION COUNT EXTRACTION
  // ========================================
  function getReactionCount(postEl) {
    const reactionsBar = postEl.querySelector('.reactionsBar');
    if (reactionsBar) {
      const link = reactionsBar.querySelector('.reactionsBar-link');
      if (link) {
        const match = link.textContent.match(/(\d+)/);
        if (match) return parseInt(match[1], 10);
      }
      const icons = reactionsBar.querySelectorAll('.reaction--small, .reaction, [data-reaction-id]');
      if (icons.length > 0) {
        let total = 0;
        icons.forEach(icon => {
          const countEl = icon.querySelector('.reaction-count, .u-srOnly');
          const m = countEl ? countEl.textContent.match(/(\d+)/) : null;
          total += m ? parseInt(m[1], 10) : 1;
        });
        return total;
      }
    }

    const likesList = postEl.querySelector('.message-likes, .js-reactionsList, .likesBar');
    if (likesList) {
      const text = likesList.textContent.trim();
      const m1 = text.match(/and\s+(\d+)\s+other/i);
      if (m1) return parseInt(m1[1], 10) + 1;
      const m2 = text.match(/(\d+)\s*(reaction|like|people)/i);
      if (m2) return parseInt(m2[1], 10);
      if (text.length > 0 && text.match(/[a-zA-Z]/)) {
        const names = text.split(',').length;
        if (names >= 1) return names;
      }
    }

    const dataEl = postEl.querySelector('[data-reaction-count]');
    if (dataEl) return parseInt(dataEl.dataset.reactionCount, 10) || 0;

    return 0;
  }

  // ========================================
  // POST DATA EXTRACTION
  // ========================================
  function getPostData(postEl) {
    const reactions = getReactionCount(postEl);
    let postDate = null;
    const timeEl = postEl.querySelector('time[datetime], .message-attribution time, .message-date time, header time');
    if (timeEl) {
      const dt = timeEl.getAttribute('datetime');
      if (dt) postDate = new Date(dt);
    }
    const postId = postEl.id || postEl.dataset.content || '';
    const author = (postEl.querySelector('.message-name, .username') || {}).textContent?.trim() || '';
    return { el: postEl, reactions, postDate, postId, author };
  }

  // ========================================
  // CROSS-PAGE SCANNING
  // ========================================
  function getThreadPageCount() {
    const pageNavItems = document.querySelectorAll('.pageNav-page a, .pageNav-page');
    let maxPage = 1;
    pageNavItems.forEach(el => {
      const num = parseInt(el.textContent.trim(), 10);
      if (!isNaN(num) && num > maxPage) maxPage = num;
    });
    return maxPage;
  }

  function getThreadBaseUrl() {
    // Strip /page-N and query params to get the base thread URL
    let url = window.location.pathname.replace(/\/page-\d+$/, '');
    if (!url.endsWith('/')) url += '/';
    return window.location.origin + url;
  }

  function extractPostsFromDoc(doc, pageNum, pageUrl) {
    const posts = doc.querySelectorAll('article.message, .message[data-content]');
    return Array.from(posts).map(postEl => {
      const reactions = getReactionCount(postEl);
      let postDate = null;
      const timeEl = postEl.querySelector('time[datetime], .message-attribution time, .message-date time, header time');
      if (timeEl) {
        const dt = timeEl.getAttribute('datetime');
        if (dt) postDate = new Date(dt);
      }
      const postId = postEl.id || postEl.dataset.content || '';
      const author = (postEl.querySelector('.message-name, .username') || {}).textContent?.trim() || '';
      return { reactions, postDate, postId, author, pageNum, pageUrl, isCurrentPage: false };
    });
  }

  async function fetchPage(url) {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    return new DOMParser().parseFromString(html, 'text/html');
  }

  async function scanAllPages(onProgress) {
    const totalPages = getThreadPageCount();
    const baseUrl = getThreadBaseUrl();
    const allPosts = [];

    // Current page posts (from DOM — these we can scroll to)
    const currentPagePosts = getAllPosts().map(el => {
      const pd = getPostData(el);
      const currentPath = window.location.pathname;
      const pageMatch = currentPath.match(/\/page-(\d+)/);
      const currentPageNum = pageMatch ? parseInt(pageMatch[1], 10) : 1;
      return { ...pd, pageNum: currentPageNum, pageUrl: window.location.href, isCurrentPage: true };
    });
    allPosts.push(...currentPagePosts);
    onProgress(1, totalPages);

    if (totalPages <= 1) return allPosts;

    // Determine which page number is the current page
    const currentPath = window.location.pathname;
    const currentPageMatch = currentPath.match(/\/page-(\d+)/);
    const currentPageNum = currentPageMatch ? parseInt(currentPageMatch[1], 10) : 1;

    // Fetch all other pages (sequential with small delay to be polite)
    for (let page = 1; page <= totalPages; page++) {
      if (page === currentPageNum) continue; // Already have current page

      const pageUrl = page === 1 ? baseUrl : baseUrl + 'page-' + page;
      try {
        const doc = await fetchPage(pageUrl);
        const posts = extractPostsFromDoc(doc, page, pageUrl);
        allPosts.push(...posts);
      } catch (err) {
        log(`Failed to fetch page ${page}:`, err.message);
      }

      onProgress(page <= currentPageNum ? page : page, totalPages);

      // Small delay between requests to avoid hammering the server
      if (page < totalPages) await new Promise(r => setTimeout(r, 300));
    }

    return allPosts;
  }

  // ========================================
  // THREAD VIEW: RANK + HIGHLIGHT
  // ========================================
  function getAllPosts() {
    return Array.from(document.querySelectorAll('article.message, .message[data-content]'));
  }

  function applyFilters() {
    if (!isThreadPage()) return;
    const posts = getAllPosts();
    const cutoff = getDateCutoff(currentDateRange);
    const allData = posts.map(getPostData);

    let visible = [];
    let hiddenCount = 0;
    allData.forEach(pd => {
      if (cutoff && pd.postDate && pd.postDate < cutoff) {
        pd.el.classList.add(`${SCRIPT_ID}-hidden`);
        hiddenCount++;
      } else {
        pd.el.classList.remove(`${SCRIPT_ID}-hidden`);
        visible.push(pd);
      }
    });

    const sorted = [...visible];
    if (currentSort === 'reactions') sorted.sort((a, b) => b.reactions - a.reactions);
    else if (currentSort === 'newest') sorted.sort((a, b) => (b.postDate || 0) - (a.postDate || 0));
    else if (currentSort === 'oldest') sorted.sort((a, b) => (a.postDate || 0) - (b.postDate || 0));

    allData.forEach(pd => pd.el.querySelectorAll(`.${SCRIPT_ID}-rank-badge`).forEach(b => b.remove()));

    sorted.forEach((pd, rank) => {
      const badge = document.createElement('span');
      const isTop3 = rank < 3 && pd.reactions > 0;
      badge.className = `${SCRIPT_ID}-rank-badge${isTop3 ? ' top3' : (pd.reactions === 0 ? ' zero' : '')}`;
      badge.textContent = `#${rank + 1} · ❤️ ${pd.reactions}`;
      const header = pd.el.querySelector('.message-attribution, .message-userDetails, .message-cell--user, header');
      if (header) header.appendChild(badge);
    });

    buildScrollList(sorted);
    isActive = true;
    updateStats(visible.length, hiddenCount, allData.length);
    log(`Applied: sort=${currentSort}, range=${currentDateRange}, showing=${visible.length}/${allData.length}`);
  }

  function resetFilters() {
    if (!isThreadPage()) return;
    getAllPosts().forEach(p => {
      p.classList.remove(`${SCRIPT_ID}-hidden`);
      p.querySelectorAll(`.${SCRIPT_ID}-rank-badge`).forEach(b => b.remove());
    });
    isActive = false;
    currentDateRange = 'all';
    currentSort = 'reactions';
    GM_setValue(`${SCRIPT_ID}_dateRange`, currentDateRange);
    GM_setValue(`${SCRIPT_ID}_sort`, currentSort);
    updatePanelState();
    updateStats(0, 0, 0, true);
    clearScrollList();
    log('Filters reset');
  }

  function buildScrollList(sorted, maxItems = 20) {
    const container = document.getElementById(`${SCRIPT_ID}-scroll-list`);
    if (!container) return;
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    sorted.slice(0, maxItems).forEach((pd, rank) => {
      const item = document.createElement('div');
      const isCrossPage = pd.pageNum !== undefined && !pd.isCurrentPage;
      item.className = `${SCRIPT_ID}-scroll-item${isCrossPage ? ' cross-page' : ''}`;
      const rankEl = document.createElement('span');
      rankEl.className = `${SCRIPT_ID}-scroll-rank`;
      rankEl.textContent = `#${rank + 1}`;
      const info = document.createElement('span');
      info.className = `${SCRIPT_ID}-scroll-info`;
      info.textContent = pd.author || 'Anonymous';
      const count = document.createElement('span');
      count.className = `${SCRIPT_ID}-scroll-count`;
      count.textContent = `❤️ ${pd.reactions}`;
      item.appendChild(rankEl);
      item.appendChild(info);
      item.appendChild(count);

      // Show page number for cross-page results
      if (pd.pageNum !== undefined) {
        const pageTag = document.createElement('span');
        pageTag.className = `${SCRIPT_ID}-scroll-page`;
        pageTag.textContent = `p${pd.pageNum}`;
        item.appendChild(pageTag);
      }

      if (pd.el && pd.isCurrentPage !== false) {
        // Current page post — scroll to it
        item.onclick = () => {
          if (_highlightTimer) { clearTimeout(_highlightTimer); }
          if (_highlightedEl) { _highlightedEl.style.outline = ''; _highlightedEl.style.outlineOffset = ''; }
          pd.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          pd.el.style.outline = '2px solid #3aff9d';
          pd.el.style.outlineOffset = '4px';
          _highlightedEl = pd.el;
          _highlightTimer = setTimeout(() => { pd.el.style.outline = ''; pd.el.style.outlineOffset = ''; _highlightedEl = null; _highlightTimer = null; }, 2500);
        };
      } else if (pd.pageUrl && pd.postId) {
        // Cross-page post — navigate to it
        item.onclick = () => {
          const anchor = pd.postId.startsWith('post-') ? pd.postId : 'post-' + pd.postId;
          window.location.href = pd.pageUrl + '#' + anchor;
        };
        item.title = `Page ${pd.pageNum} — click to navigate`;
      } else if (pd.pageUrl) {
        item.onclick = () => { window.location.href = pd.pageUrl; };
        item.title = `Page ${pd.pageNum}`;
      }

      fragment.appendChild(item);
    });
    container.appendChild(fragment);
  }

  function clearScrollList() {
    const c = document.getElementById(`${SCRIPT_ID}-scroll-list`);
    if (c) c.innerHTML = '';
  }

  // ========================================
  // FORUM LIST VIEW
  // ========================================
  function injectForumBar() {
    if (!isForumListPage() || document.querySelector(`.${SCRIPT_ID}-forum-bar`)) return;
    const listContainer = document.querySelector('.structItemContainer, .block-body');
    if (!listContainer) return;

    const bar = document.createElement('div');
    bar.className = `${SCRIPT_ID}-forum-bar`;

    const baseUrl = window.location.pathname;
    const currentParams = new URLSearchParams(window.location.search);
    const currentOrder = currentParams.get('order') || '';

    // Sort mode selector
    const FORUM_SORT_MODES = [
      { key: 'reaction_score', label: '🔥 Most Liked', icon: '🔥' },
      { key: 'view_count',     label: '👁 Most Viewed', icon: '👁' },
      { key: 'reply_count',    label: '💬 Most Replies', icon: '💬' }
    ];

    const modeLabel = document.createElement('span');
    modeLabel.className = `${SCRIPT_ID}-forum-bar-label`;
    modeLabel.textContent = 'Sort:';
    bar.appendChild(modeLabel);

    FORUM_SORT_MODES.forEach(mode => {
      const pill = document.createElement('span');
      pill.className = `${SCRIPT_ID}-pill`;
      pill.textContent = mode.label;
      if (currentOrder === mode.key) pill.classList.add('active');
      pill.addEventListener('click', () => {
        const p = new URLSearchParams();
        p.set('order', mode.key);
        p.set('direction', 'desc');
        window.location.href = baseUrl + '?' + p.toString();
      });
      bar.appendChild(pill);
    });

    // Separator + date range pills (only for reaction_score mode)
    if (currentOrder === 'reaction_score') {
      const sep = document.createElement('span');
      sep.style.cssText = 'width: 1px; height: 18px; background: #333; margin: 0 4px;';
      bar.appendChild(sep);

      const dateLabel = document.createElement('span');
      dateLabel.className = `${SCRIPT_ID}-forum-bar-label`;
      dateLabel.textContent = 'Period:';
      bar.appendChild(dateLabel);

      Object.entries(DATE_RANGES).forEach(([key, range]) => {
        const pill = document.createElement('span');
        pill.className = `${SCRIPT_ID}-pill`;
        pill.textContent = range.label;
        if (key === 'all' && !currentParams.has('last_days')) pill.classList.add('active');
        else if (currentParams.get('last_days') === String(range.days) && range.days > 0) pill.classList.add('active');
        pill.addEventListener('click', () => {
          const p = new URLSearchParams();
          p.set('order', 'reaction_score');
          if (range.days > 0) p.set('last_days', String(range.days));
          window.location.href = baseUrl + '?' + p.toString();
        });
        bar.appendChild(pill);
      });
    }

    const resetPill = document.createElement('span');
    resetPill.className = `${SCRIPT_ID}-pill`;
    resetPill.textContent = '↩ Default';
    resetPill.style.color = '#888';
    if (!currentOrder) resetPill.classList.add('active');
    resetPill.addEventListener('click', () => { window.location.href = baseUrl; });
    bar.appendChild(resetPill);

    listContainer.parentElement.insertBefore(bar, listContainer);
  }

  // ========================================
  // SCAN ALL PAGES
  // ========================================
  async function startScan() {
    if (_isScanning) return;
    _isScanning = true;

    const scanBtn = document.getElementById(`${SCRIPT_ID}-scan-btn`);
    const progressEl = document.getElementById(`${SCRIPT_ID}-progress`);
    const progressFill = document.getElementById(`${SCRIPT_ID}-progress-fill`);
    const progressText = document.getElementById(`${SCRIPT_ID}-progress-text`);

    if (scanBtn) { scanBtn.disabled = true; scanBtn.textContent = 'Scanning...'; }
    if (progressEl) progressEl.style.display = 'block';

    try {
      const allPosts = await scanAllPages((done, total) => {
        const pct = Math.round((done / total) * 100);
        if (progressFill) progressFill.style.width = pct + '%';
        if (progressText) progressText.textContent = `Fetching page ${done} of ${total}...`;
      });

      // Cache the scan results
      _scanCache = { url: getThreadBaseUrl(), posts: allPosts };

      // Apply current filters to scanned data
      const cutoff = getDateCutoff(currentDateRange);
      let visible = allPosts;
      if (cutoff) {
        visible = allPosts.filter(pd => !pd.postDate || pd.postDate >= cutoff);
      }

      // Sort
      const sorted = [...visible];
      if (currentSort === 'reactions') sorted.sort((a, b) => b.reactions - a.reactions);
      else if (currentSort === 'newest') sorted.sort((a, b) => (b.postDate || 0) - (a.postDate || 0));
      else if (currentSort === 'oldest') sorted.sort((a, b) => (a.postDate || 0) - (b.postDate || 0));

      // Also apply badges to current-page posts
      const currentPagePosts = getAllPosts();
      currentPagePosts.forEach(p => p.querySelectorAll(`.${SCRIPT_ID}-rank-badge`).forEach(b => b.remove()));

      sorted.forEach((pd, rank) => {
        if (pd.isCurrentPage && pd.el) {
          const badge = document.createElement('span');
          const isTop3 = rank < 3 && pd.reactions > 0;
          badge.className = `${SCRIPT_ID}-rank-badge${isTop3 ? ' top3' : (pd.reactions === 0 ? ' zero' : '')}`;
          badge.textContent = `#${rank + 1}/${allPosts.length} · ❤️ ${pd.reactions}`;
          const header = pd.el.querySelector('.message-attribution, .message-userDetails, .message-cell--user, header');
          if (header) header.appendChild(badge);
        }
      });

      // Show top 50 in scroll list for scanned results
      buildScrollList(sorted, 50);
      isActive = true;
      const hiddenCount = allPosts.length - visible.length;
      updateStats(visible.length, hiddenCount, allPosts.length);

      if (progressText) progressText.textContent = `Scanned ${getThreadPageCount()} pages — ${allPosts.length} total posts found`;
      log(`Scan complete: ${allPosts.length} posts across ${getThreadPageCount()} pages`);
    } catch (err) {
      log('Scan failed:', err);
      if (progressText) progressText.textContent = 'Scan failed — ' + err.message;
    }

    _isScanning = false;
    if (scanBtn) {
      scanBtn.disabled = false;
      const pageCount = getThreadPageCount();
      scanBtn.textContent = _scanCache ? `Re-scan (${pageCount} pages)` : `Scan All ${pageCount} Pages`;
    }
  }

  // ========================================
  // UI: FLOATING PANEL
  // ========================================
  function createPanel() {
    if (panelEl || !isThreadPage()) return;
    const panel = document.createElement('div');
    panel.className = `${SCRIPT_ID}-panel`;
    const isMinimized = GM_getValue(`${SCRIPT_ID}_minimized`, false);
    if (isMinimized) panel.classList.add('minimized');

    // Restore saved position from drag (with viewport bounds check)
    const savedPos = GM_getValue(`${SCRIPT_ID}_panelPos`, null);
    if (savedPos) {
      const savedRight = parseInt(savedPos.right, 10);
      const savedBottom = parseInt(savedPos.bottom, 10);
      if (!isNaN(savedRight) && savedRight >= 0 && savedRight < window.innerWidth) panel.style.right = savedPos.right;
      if (!isNaN(savedBottom) && savedBottom >= 0 && savedBottom < window.innerHeight) panel.style.bottom = savedPos.bottom;
    }

    const header = document.createElement('div');
    header.className = `${SCRIPT_ID}-header`;
    const title = document.createElement('div');
    title.className = `${SCRIPT_ID}-title`;
    title.innerHTML = '🔥 Post Filter';
    const postCountBadge = document.createElement('span');
    postCountBadge.id = `${SCRIPT_ID}-post-count-badge`;
    postCountBadge.style.cssText = 'background: rgba(58,255,157,0.15); color: #3aff9d; font-size: 10px; padding: 2px 7px; border-radius: 10px; font-weight: 700; display: none;';
    title.appendChild(postCountBadge);
    const minimizeBtn = document.createElement('button');
    minimizeBtn.className = `${SCRIPT_ID}-header-btn`;
    minimizeBtn.title = 'Minimize (Alt+F)';
    minimizeBtn.textContent = '−';
    minimizeBtn.onclick = () => {
      const min = panel.classList.toggle('minimized');
      minimizeBtn.textContent = min ? '+' : '−';
      GM_setValue(`${SCRIPT_ID}_minimized`, min);
    };
    if (isMinimized) minimizeBtn.textContent = '+';
    header.appendChild(title);
    header.appendChild(minimizeBtn);
    panel.appendChild(header);

    const body = document.createElement('div');
    body.className = `${SCRIPT_ID}-body`;

    // Date Range
    const dateLabel = document.createElement('div');
    dateLabel.className = `${SCRIPT_ID}-section-label`;
    dateLabel.textContent = 'Date Range';
    body.appendChild(dateLabel);
    const datePills = document.createElement('div');
    datePills.className = `${SCRIPT_ID}-pills`;
    datePills.id = `${SCRIPT_ID}-date-pills`;
    Object.entries(DATE_RANGES).forEach(([key, range]) => {
      const pill = document.createElement('span');
      pill.className = `${SCRIPT_ID}-pill${key === currentDateRange ? ' active' : ''}`;
      pill.dataset.range = key;
      pill.textContent = range.label;
      pill.addEventListener('click', () => {
        currentDateRange = key;
        GM_setValue(`${SCRIPT_ID}_dateRange`, key);
        datePills.querySelectorAll(`.${SCRIPT_ID}-pill`).forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
      });
      datePills.appendChild(pill);
    });
    body.appendChild(datePills);

    // Sort
    const sortLabel = document.createElement('div');
    sortLabel.className = `${SCRIPT_ID}-section-label`;
    sortLabel.textContent = 'Sort By';
    sortLabel.style.marginTop = '4px';
    body.appendChild(sortLabel);
    const sortRow = document.createElement('div');
    sortRow.className = `${SCRIPT_ID}-sort-row`;
    sortRow.id = `${SCRIPT_ID}-sort-row`;
    Object.entries(SORT_MODES).forEach(([key, mode]) => {
      const btn = document.createElement('div');
      btn.className = `${SCRIPT_ID}-sort-btn${key === currentSort ? ' active' : ''}`;
      btn.dataset.sort = key;
      btn.textContent = mode.label;
      btn.addEventListener('click', () => {
        currentSort = key;
        GM_setValue(`${SCRIPT_ID}_sort`, key);
        sortRow.querySelectorAll(`.${SCRIPT_ID}-sort-btn`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      sortRow.appendChild(btn);
    });
    body.appendChild(sortRow);

    // Actions
    const actions = document.createElement('div');
    actions.className = `${SCRIPT_ID}-actions`;
    const applyBtn = document.createElement('button');
    applyBtn.className = `${SCRIPT_ID}-apply-btn`;
    applyBtn.textContent = 'Apply Filter';
    applyBtn.onclick = applyFilters;
    const resetBtn = document.createElement('button');
    resetBtn.className = `${SCRIPT_ID}-reset-btn`;
    resetBtn.textContent = 'Reset';
    resetBtn.onclick = resetFilters;
    actions.appendChild(applyBtn);
    actions.appendChild(resetBtn);
    body.appendChild(actions);

    // Scan All Pages button
    const scanRow = document.createElement('div');
    scanRow.className = `${SCRIPT_ID}-actions`;
    const scanBtn = document.createElement('button');
    scanBtn.className = `${SCRIPT_ID}-scan-btn`;
    scanBtn.id = `${SCRIPT_ID}-scan-btn`;
    const pageCount = getThreadPageCount();
    scanBtn.textContent = pageCount > 1 ? `Scan All ${pageCount} Pages` : 'Scan Thread (1 page)';
    scanBtn.onclick = startScan;
    scanRow.appendChild(scanBtn);
    body.appendChild(scanRow);

    // Progress indicator (hidden by default)
    const progress = document.createElement('div');
    progress.className = `${SCRIPT_ID}-progress`;
    progress.id = `${SCRIPT_ID}-progress`;
    progress.style.display = 'none';
    const progressBar = document.createElement('div');
    progressBar.className = `${SCRIPT_ID}-progress-bar`;
    const progressFill = document.createElement('div');
    progressFill.className = `${SCRIPT_ID}-progress-fill`;
    progressFill.id = `${SCRIPT_ID}-progress-fill`;
    progressBar.appendChild(progressFill);
    progress.appendChild(progressBar);
    const progressText = document.createElement('div');
    progressText.className = `${SCRIPT_ID}-progress-text`;
    progressText.id = `${SCRIPT_ID}-progress-text`;
    progress.appendChild(progressText);
    body.appendChild(progress);

    // Scroll list
    const scrollList = document.createElement('div');
    scrollList.className = `${SCRIPT_ID}-scroll-list`;
    scrollList.id = `${SCRIPT_ID}-scroll-list`;
    body.appendChild(scrollList);

    // Stats
    const stats = document.createElement('div');
    stats.className = `${SCRIPT_ID}-stats`;
    stats.id = `${SCRIPT_ID}-stats`;
    stats.textContent = 'Select filters and click Apply';
    body.appendChild(stats);

    panel.appendChild(body);
    document.body.appendChild(panel);
    panelEl = panel;
    makeDraggable(panel, header);
  }

  function updatePanelState() {
    if (!panelEl) return;
    const dp = panelEl.querySelector(`#${SCRIPT_ID}-date-pills`);
    if (dp) dp.querySelectorAll(`.${SCRIPT_ID}-pill`).forEach(p => p.classList.toggle('active', p.dataset.range === currentDateRange));
    const sr = panelEl.querySelector(`#${SCRIPT_ID}-sort-row`);
    if (sr) sr.querySelectorAll(`.${SCRIPT_ID}-sort-btn`).forEach(b => b.classList.toggle('active', b.dataset.sort === currentSort));
  }

  function updateStats(showing, hidden, total, reset = false) {
    const el = document.getElementById(`${SCRIPT_ID}-stats`);
    if (!el) return;
    el.textContent = reset ? 'Filters cleared' : `Showing ${showing} of ${total} posts${hidden > 0 ? ` (${hidden} hidden)` : ''}`;

    // Update minimized badge
    const badge = document.getElementById(`${SCRIPT_ID}-post-count-badge`);
    if (badge) {
      if (reset || total === 0) { badge.style.display = 'none'; }
      else { badge.textContent = `${showing}/${total}`; badge.style.display = 'inline'; }
    }
  }

  // ========================================
  // DRAGGABLE (with boundary clamping + touch support)
  // ========================================
  function makeDraggable(panel, handle) {
    let dragging = false, startX, startY, startRight, startBottom;

    function clampPosition(right, bottom) {
      const panelRect = panel.getBoundingClientRect();
      const maxRight = Math.max(0, window.innerWidth - panelRect.width);
      const maxBottom = Math.max(0, window.innerHeight - panelRect.height);
      return {
        right: Math.max(0, Math.min(maxRight, right)),
        bottom: Math.max(0, Math.min(maxBottom, bottom))
      };
    }

    function onStart(clientX, clientY) {
      dragging = true;
      startX = clientX; startY = clientY;
      startRight = parseInt(getComputedStyle(panel).right, 10) || 20;
      startBottom = parseInt(getComputedStyle(panel).bottom, 10) || 20;
      document.body.style.userSelect = 'none';
    }

    function onMove(clientX, clientY) {
      if (!dragging) return;
      const rawRight = startRight + (startX - clientX);
      const rawBottom = startBottom + (startY - clientY);
      const clamped = clampPosition(rawRight, rawBottom);
      panel.style.right = clamped.right + 'px';
      panel.style.bottom = clamped.bottom + 'px';
    }

    function onEnd() {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = '';
      GM_setValue(`${SCRIPT_ID}_panelPos`, { right: panel.style.right, bottom: panel.style.bottom });
    }

    // Mouse events
    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      onStart(e.clientX, e.clientY);
    });
    document.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    document.addEventListener('mouseup', onEnd);

    // Touch events for mobile
    handle.addEventListener('touchstart', (e) => {
      if (e.target.closest('button')) return;
      const t = e.touches[0];
      onStart(t.clientX, t.clientY);
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
    }, { passive: true });
    document.addEventListener('touchend', onEnd);

    // Re-clamp on window resize
    window.addEventListener('resize', () => {
      if (dragging) return;
      const currentRight = parseInt(getComputedStyle(panel).right, 10) || 20;
      const currentBottom = parseInt(getComputedStyle(panel).bottom, 10) || 20;
      const clamped = clampPosition(currentRight, currentBottom);
      panel.style.right = clamped.right + 'px';
      panel.style.bottom = clamped.bottom + 'px';
    });
  }

  // ========================================
  // KEYBOARD
  // ========================================
  document.addEventListener('keydown', (e) => {
    if (e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      if (panelEl) { const min = panelEl.classList.toggle('minimized'); GM_setValue(`${SCRIPT_ID}_minimized`, min); }
    }
    if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      applyFilters();
    }
  });

  // ========================================
  // INIT
  // ========================================
  function init() {
    if (isThreadPage()) { createPanel(); log('Thread view — panel injected'); }
    if (isForumListPage()) { injectForumBar(); log('Forum list — filter bar injected'); }
  }

  init();
  log('Initialized');

})();
