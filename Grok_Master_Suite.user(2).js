// ==UserScript==
// @name         Grok Master Suite
// @namespace    https://github.com/taylorfunk/grok-suite
// @version      1.1.0
// @description  Consolidated Grok suite: Prompt Manager + Video Gen Overrides + AI Enhancement (OpenRouter) + Multi-Image Queue + Auto-Retry + Offline Video DB + MP4 Download. Cached DB, memory leak fixes, optimized observers.
// @author       Taylor Funk
// @license      MIT
// @match        https://grok.com/*
// @match        https://*.grok.com/*
// @match        https://grok.x.ai/*
// @match        https://*.grok.x.ai/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      assets.grok.com
// @connect      imagine-public.x.ai
// @connect      video.grok.com
// @connect      openrouter.ai
// @noframes
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';
  if (window.grokPromptManagerLoaded) return;
  window.grokPromptManagerLoaded = true;

  function initScript() {

    GM_registerMenuCommand('Toggle Grok Manager UI', () => {
      const overlay = document.querySelector('.grok-prompt-overlay');
      if (!overlay) return;
      isOpen = !isOpen;
      if (isOpen) {
        overlay.style.display = 'flex';
        overlay.offsetHeight;
        overlay.classList.add('open');
        updateCounts();
        updateCategorySelect();
        refreshActiveTab();
      } else {
        overlay.classList.remove('open');
        setTimeout(() => overlay.style.display = 'none', 200);
      }
    });

    GM_addStyle(`
      :root {
        --grok-bg: #000000;
        --grok-surface: #16181c;
        --grok-surface-trans: rgba(22, 24, 28, 0.95);
        --grok-surface-hover: #1d1f23;
        --grok-border: #2f3336;
        --grok-primary: #1d9bf0;
        --grok-primary-hover: #1a8cd8;
        --grok-text-main: #e7e9ea;
        --grok-text-muted: #71767b;
        --grok-danger: #f4212e;
        --grok-warning: #ffd400;
        --grok-success: #00ba7c;
        --grok-image-history: #ff8c00;
        --grok-radius: 16px;
      }

      .grok-prompt-overlay { position: fixed; inset: 0; z-index: 10000; display: none; opacity: 0; transition: opacity 0.2s ease; isolation: isolate; }
      .grok-prompt-overlay.open { display: flex; opacity: 1; pointer-events: auto; }
      .grok-prompt-overlay.mode-centered { background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(4px); align-items: center; justify-content: center; }
      .grok-prompt-overlay.mode-centered .grok-prompt-modal { position: relative; width: 1463px; height: 809px; transform: scale(0.95); transition: transform 0.2s; }
      .grok-prompt-overlay.mode-centered.open .grok-prompt-modal { transform: scale(1); }
      .grok-prompt-overlay.mode-floating { background: transparent; pointer-events: none; display: none; }
      .grok-prompt-overlay.mode-floating.open { display: block; }
      .grok-prompt-overlay.mode-floating .grok-prompt-modal {
        position: fixed; pointer-events: auto;
        box-shadow: 0 0 0 1px rgba(255,255,255,0.1), 0 20px 60px rgba(0,0,0,0.8);
        backdrop-filter: blur(10px);
      }

      .grok-prompt-modal {
        background: var(--grok-surface-trans);
        border: 1px solid var(--grok-border);
        border-radius: var(--grok-radius);
        display: flex; flex-direction: column;
        color: var(--grok-text-main);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        min-width: 380px; min-height: 200px;
        overflow: hidden;
      }
      .grok-prompt-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--grok-border); cursor: move; background: rgba(255,255,255,0.02); user-select: none; }
      .grok-prompt-title { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
      .grok-header-actions { display: flex; align-items: center; gap: 8px; }
      .grok-icon-btn { background: transparent; border: none; color: var(--grok-text-muted); cursor: pointer; padding: 6px; border-radius: 6px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
      .grok-icon-btn:hover { background: rgba(255,255,255,0.1); color: var(--grok-text-main); }
      .grok-icon-btn.close:hover { background: rgba(239, 68, 68, 0.15); color: var(--grok-danger); }

      .grok-prompt-tabs { display: flex; padding: 0 16px; border-bottom: 1px solid var(--grok-border); background: var(--grok-bg); overflow-x: auto; }
      .grok-prompt-tab { padding: 16px; background: none; border: none; color: var(--grok-text-muted); font-weight: 600; font-size: 14px; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.2s; white-space: nowrap; }
      .grok-prompt-tab:hover { color: var(--grok-text-main); background: rgba(255,255,255,0.03); }
      .grok-prompt-tab.active { color: var(--grok-primary); border-bottom-color: var(--grok-primary); }

      .grok-prompt-content { flex: 1; overflow-y: auto; padding: 24px; scroll-behavior: smooth; }
      .grok-prompt-content::-webkit-scrollbar { width: 8px; }
      .grok-prompt-content::-webkit-scrollbar-track { background: transparent; }
      .grok-prompt-content::-webkit-scrollbar-thumb { background: var(--grok-border); border-radius: 4px; }

      .grok-prompt-form { display: flex; flex-direction: column; gap: 20px; }
      .grok-prompt-label { display: block; font-size: 13px; font-weight: 600; color: var(--grok-text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
      .grok-prompt-select, .grok-prompt-textarea, .grok-prompt-category-input {
        width: 100%; background: black; border: 1px solid var(--grok-border); border-radius: 8px;
        padding: 12px; color: var(--grok-text-main); font-size: 15px; font-family: inherit;
        transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box;
      }
      .grok-prompt-select:focus, .grok-prompt-textarea:focus, .grok-prompt-category-input:focus { outline: none; border-color: var(--grok-primary); box-shadow: 0 0 0 2px rgba(29, 155, 240, 0.2); }
      .grok-prompt-textarea { height: 140px; line-height: 1.5; resize: vertical; }

      .grok-form-actions { display: flex; gap: 10px; align-items: center; }
      .grok-prompt-button, .grok-prompt-add-btn {
        background: var(--grok-primary); color: white; border: none; padding: 12px 20px; border-radius: 24px;
        font-weight: 700; cursor: pointer; transition: transform 0.1s, background 0.2s;
        display: flex; align-items: center; justify-content: center; gap: 8px; flex: 1;
      }
      .grok-prompt-button:hover { background: var(--grok-primary-hover); transform: translateY(-1px); }
      .grok-cancel-btn { background: rgba(244, 33, 46, 0.1); color: var(--grok-danger); border: 1px solid transparent; padding: 12px 20px; border-radius: 24px; font-weight: 700; cursor: pointer; display: none; align-items: center; justify-content: center;}
      .grok-cancel-btn:hover { background: rgba(244, 33, 46, 0.2); }

      .grok-prompt-list { display: flex; flex-direction: column; gap: 12px; }
      .grok-prompt-item { display: flex; gap: 12px; align-items: flex-start; background: transparent; border: 1px solid var(--grok-border); border-radius: 12px; padding: 16px; transition: background 0.2s, border-color 0.2s; }
      .grok-prompt-item:hover { background: rgba(255,255,255,0.02); border-color: #555; }
      .grok-item-check-wrapper { padding-top: 4px; display: flex; align-items: center; justify-content: center; }
      .grok-item-checkbox { width: 18px; height: 18px; accent-color: var(--grok-primary); cursor: pointer; }
      .grok-item-content-wrapper { flex: 1; width: 100%; min-width: 0; }
      .grok-prompt-item-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 15px; margin-bottom: 10px; }
      .grok-prompt-item-text { flex: 1; color: var(--grok-text-main); line-height: 1.5; font-size: 15px; white-space: pre-wrap; }

      .grok-prompt-item-delete { opacity: 0; color: var(--grok-text-muted); background: none; border: none; cursor: pointer; transition: opacity 0.2s, color 0.2s; padding: 4px; }
      .grok-prompt-item:hover .grok-prompt-item-delete { opacity: 1; }
      .grok-prompt-item-delete:hover { color: var(--grok-danger); }

      .grok-prompt-item-footer { display: flex; align-items: center; gap: 12px; margin-top: 12px; flex-wrap: wrap; }
      .grok-prompt-source-alt { font-size: 12px; color: var(--grok-text-muted); margin-top: 8px; padding: 6px 10px; background: rgba(255, 140, 0, 0.08); border-left: 3px solid var(--grok-image-history); border-radius: 4px; line-height: 1.4; }
      .grok-prompt-source-alt strong { color: var(--grok-image-history); }

      .grok-prompt-category-badge { background: rgba(29, 155, 240, 0.1); color: var(--grok-primary); padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; flex-shrink: 0; }
      .grok-prompt-category-badge.image-tag { background: rgba(255, 212, 0, 0.1); color: var(--grok-warning); }
      .grok-prompt-category-badge.auto { background: rgba(0, 186, 124, 0.1); color: var(--grok-success); }
      .grok-prompt-category-badge.auto.image-tag { background: rgba(255, 140, 0, 0.15); color: var(--grok-image-history); border: 1px solid rgba(255, 140, 0, 0.2); }
      .grok-prompt-category-badge.auto.edit-tag { background: rgba(138, 43, 226, 0.15); color: #c48df5; border: 1px solid rgba(138, 43, 226, 0.2); }

      .grok-prompt-copy-btn {
        flex-shrink: 0; background: transparent; border: 1px solid var(--grok-border);
        color: var(--grok-text-muted); padding: 6px 12px; border-radius: 16px;
        font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex;
        align-items: center; gap: 6px; transition: all 0.2s;
      }
      .grok-prompt-copy-btn:hover { border-color: var(--grok-text-main); color: var(--grok-text-main); background: rgba(255,255,255,0.05); }

      .grok-split-view { display: flex; gap: 24px; width: 100%; flex-wrap: wrap; }
      .grok-tag-section { flex: 1; min-width: 300px; background: rgba(255,255,255,0.02); border: 1px solid var(--grok-border); border-radius: 12px; padding: 20px; }
      .grok-tag-header { font-size: 16px; font-weight: 700; color: var(--grok-text-main); margin-bottom: 15px; border-bottom: 1px solid var(--grok-border); padding-bottom: 10px; display: flex; align-items: center; gap: 8px; }
      .grok-video-section { margin-top: 12px; background: rgba(255, 255, 255, 0.03); padding: 10px; border-radius: 8px; border: 1px dashed var(--grok-border); }
      .grok-video-input { width: 100%; background: transparent; border: none; color: var(--grok-text-muted); font-size: 13px; font-family: inherit; resize: none; outline: none; height: 32px; transition: height 0.2s; }
      .grok-video-input:focus { color: var(--grok-text-main); height: 60px; }
      .grok-video-label { font-size: 11px; color: var(--grok-primary); font-weight: 700; text-transform: uppercase; margin-bottom: 4px; display: block; }

      .grok-image-item-grid { display: flex; gap: 16px; }
      .grok-image-content-col { flex: 1; }
      .grok-image-preview-col { width: 120px; display: flex; flex-direction: column; gap: 8px; align-items: center; justify-content: flex-start; }

      .grok-snapshot-thumb { width: 100%; height: 100px; object-fit: cover; border-radius: 8px; border: 1px solid var(--grok-border); cursor: zoom-in; transition: transform 0.2s; background: #000; }
      .grok-snapshot-thumb:hover { transform: scale(1.05); border-color: var(--grok-primary); }
      .grok-snapshot-upload-btn { position: relative; width: 100%; height: 100px; border: 1px dashed var(--grok-border); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-direction: column; color: var(--grok-text-muted); cursor: pointer; font-size: 12px; transition: 0.2s; background: rgba(255,255,255,0.02); }
      .grok-snapshot-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
      .grok-snapshot-del { background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; position: absolute; top: -5px; right: -5px; font-size: 12px; line-height: 1; }
      .grok-snapshot-wrapper { position: relative; width: 100%; }

      .grok-mod-wrapper { display: flex; align-items: center; gap: 10px; flex-grow: 1; min-width: 140px; max-width: 300px; background: rgba(0,0,0,0.2); padding: 4px 10px; border-radius: 20px; border: 1px solid var(--grok-border); margin-right: 8px; }
      .grok-mod-label { font-size: 10px; text-transform: uppercase; color: var(--grok-text-muted); font-weight: 700; white-space: nowrap; }
      .grok-mod-slider { -webkit-appearance: none; appearance: none; flex: 1; height: 4px; background: #333; border-radius: 2px; outline: none; cursor: ew-resize; }
      .grok-mod-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; background: var(--grok-text-main); border-radius: 50%; cursor: pointer; transition: 0.2s; }
      .grok-mod-val { font-size: 12px; font-weight: 700; min-width: 35px; text-align: right; font-variant-numeric: tabular-nums; }
      .grok-mod-val.low { color: var(--grok-danger); }
      .grok-mod-val.med { color: var(--grok-warning); }
      .grok-mod-val.high { color: var(--grok-success); }

      .grok-stats-bar-container { display: flex; align-items: center; gap: 10px; flex-grow: 1; min-width: 140px; margin-right: 8px; background: rgba(0,0,0,0.2); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
      .grok-stats-pill { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 3px 6px; border-radius: 4px; color: #fff; white-space: nowrap; }
      .grok-stats-pill.success { color: var(--grok-success); background: rgba(0, 186, 124, 0.15); }
      .grok-stats-pill.fail { color: var(--grok-danger); background: rgba(244, 33, 46, 0.15); }
      .grok-stats-text { font-size: 11px; color: var(--grok-text-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
      .grok-success-rate-bar { flex: 1; height: 4px; background: #333; border-radius: 2px; overflow: hidden; position: relative; min-width: 40px; }
      .grok-success-rate-fill { height: 100%; background: var(--grok-success); transition: width 0.3s; }

      .grok-toast-container { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 8px; z-index: 11000; pointer-events: none; }
      .grok-toast { background: var(--grok-primary); color: white; padding: 10px 20px; border-radius: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-weight: 600; font-size: 14px; animation: slideUpFade 0.3s ease forwards; display: flex; align-items: center; gap: 8px; }
      @keyframes slideUpFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

      .grok-prompt-category-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .grok-prompt-category-tag { background: var(--grok-surface-hover); border: 1px solid var(--grok-border); color: var(--grok-text-main); padding: 8px 14px; border-radius: 20px; font-size: 13px; display: flex; align-items: center; gap: 8px; }
      .grok-prompt-category-tag.image-type { border-color: rgba(255, 212, 0, 0.3); color: #ffeeaa; }

      .grok-prompt-resize-handle {
        position: absolute; width: 24px; height: 24px; right: 0; bottom: 0; cursor: se-resize; z-index: 10;
        background: linear-gradient(135deg, transparent 50%, #555 50%, #555 55%, transparent 55%, transparent 70%, #555 70%, #555 75%, transparent 75%);
        opacity: 0.7; border-bottom-right-radius: var(--grok-radius);
      }
      .grok-prompt-resize-handle:hover { opacity: 1; }

      .grok-checkbox-wrapper { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 12px; }
      .grok-checkbox { width: 20px; height: 20px; accent-color: var(--grok-primary); cursor: pointer; }

      .grok-keybind-wrapper { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; background: black; border: 1px solid var(--grok-border); padding: 10px; border-radius: 8px; }
      .grok-keybind-display { font-family: monospace; background: #222; color: var(--grok-primary); padding: 4px 8px; border-radius: 4px; border: 1px solid #333; min-width: 80px; text-align: center; font-weight: 700; }
      .grok-keybind-btn { background: var(--grok-surface-hover); border: 1px solid var(--grok-border); color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
      .grok-keybind-btn.recording { background: var(--grok-danger); border-color: var(--grok-danger); animation: pulse 1s infinite; }
      @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.7; } 100% { opacity: 1; } }

      .grok-info-box {
        background: rgba(29, 155, 240, 0.08); border: 1px solid rgba(29, 155, 240, 0.3);
        border-radius: 8px; padding: 12px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 10px;
      }

      .grok-lightbox { position: fixed; inset: 0; z-index: 12000; background: rgba(0,0,0,0.9); display: none; align-items: center; justify-content: center; cursor: zoom-out; }
      .grok-lightbox.open { display: flex; animation: fadeIn 0.2s; }
      .grok-lightbox img, .grok-lightbox video { max-width: 90%; max-height: 90%; border-radius: 4px; box-shadow: 0 0 50px rgba(0,0,0,0.5); }

      .grok-bulk-bar { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: rgba(29, 155, 240, 0.05); border: 1px solid var(--grok-border); border-radius: 12px; margin-bottom: 16px; flex-wrap: wrap; gap:10px; }
      .grok-control-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
      .grok-filter-group { display: flex; gap: 6px; flex-wrap: wrap; }
      .grok-sort-group { display: flex; gap: 4px; align-items: center; padding-left: 10px; border-left: 1px solid var(--grok-border); }
      .grok-prompt-filter-btn { background: transparent; border: 1px solid var(--grok-border); color: var(--grok-text-muted); padding: 6px 14px; border-radius: 20px; cursor: pointer; font-size: 13px; font-weight: 500; transition: 0.2s; }
      .grok-prompt-filter-btn.active { background: var(--grok-primary); border-color: var(--grok-primary); color: white; }
      .grok-prompt-sort-btn { background: transparent; border: none; color: var(--grok-text-muted); padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; text-transform: uppercase; transition: 0.2s; }
      .grok-prompt-sort-btn:hover { color: var(--grok-text-main); background: rgba(255,255,255,0.05); }
      .grok-prompt-sort-btn.active { color: var(--grok-primary); background: rgba(29, 155, 240, 0.1); }

      .grok-bulk-delete-btn { background: rgba(244, 33, 46, 0.1); color: var(--grok-danger); border: 1px solid transparent; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 6px;}
      .grok-bulk-delete-btn:disabled { opacity: 0.5; cursor: not-allowed; background: transparent; color: var(--grok-text-muted); }

      body.grok-clean-mode button[aria-label="More options"],
      body.grok-clean-mode div[aria-label="Text alignment"],
      body.grok-clean-mode button:has(.lucide-volume-off),
      body.grok-clean-mode button:has(.lucide-volume-2),
      body.grok-clean-mode button:has(.lucide-image) { display: none !important; }

      .grok-num-input { background: #000; border: 1px solid var(--grok-border); color: white; padding: 4px 8px; border-radius: 4px; width: 60px; text-align: center; }

      /* Video Preview styles */
      .grok-capture-gif-trigger { cursor: pointer !important; transition: 0.2s; border-color: var(--grok-warning) !important; }
      .grok-capture-gif-trigger:hover { background: rgba(255, 140, 0, 0.15) !important; }
      .grok-preview-del { background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; position: absolute; top: -5px; right: -5px; font-size: 12px; line-height: 1; }
      .grok-preview-badge { position: absolute; bottom: 4px; left: 4px; background: rgba(255,140,0,0.85); color: #fff; font-size: 8px; font-weight: 700; padding: 1px 5px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.5px; pointer-events: none; }

      /* SIDE PANEL */
      #grok-control-panel {
        position: fixed; bottom: 20px; right: 20px;
        min-width: 280px; min-height: 250px; max-width: 90vw; max-height: 90vh;
        background-color: #15202b; border: 1px solid #38444d; border-radius: 12px;
        padding: 15px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: white; z-index: 199998; box-shadow: 0 4px 12px rgba(0,0,0,0.6);
        display: flex; flex-direction: column; gap: 10px;
      }
      #grok-control-panel.hidden { display: none !important; }

      #grok-side-resize-handle { position: absolute; top: 0; left: 0; width: 15px; height: 15px; cursor: nwse-resize; z-index: 99999; }
      #grok-side-resize-handle::after { content: ''; position: absolute; top: 2px; left: 2px; border-top: 6px solid #1d9bf0; border-right: 6px solid transparent; width: 0; height: 0; opacity: 0.7; }
      #grok-side-resize-handle:hover::after { opacity: 1; border-top-color: #fff; }

      .grok-side-header { display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; margin-left: 10px; }
      .grok-side-title { font-weight: bold; font-size: 14px; color: #fff; }
      .grok-side-toggle-btn { background: #00ba7c; border: none; color: white; padding: 4px 12px; border-radius: 15px; font-size: 11px; font-weight: bold; cursor: pointer; }
      .grok-side-toggle-btn.off { background: #f4212e; }

      .grok-side-controls { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #8b98a5; flex-shrink: 0; }
      .grok-side-checkbox { display: flex; align-items: center; cursor: pointer; color: #fff; }
      .grok-side-checkbox input { margin-right: 6px; }
      .grok-side-num-input { width: 40px; background: #273340; border: 1px solid #38444d; color: white; border-radius: 4px; padding: 2px 5px; text-align: center; }

      .grok-side-prompt-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: -6px; flex-shrink: 0; }
      .grok-side-prompt-label { font-size: 11px; font-weight: bold; color: #8b98a5; flex-shrink: 0; }
      .grok-side-nav { display:flex; gap:4px; align-items:center; }
      .grok-side-nav-btn {
        background:#273340; border:1px solid #38444d; color:#8b98a5;
        cursor:pointer; padding:2px 8px; border-radius:4px; font-size:10px;
      }
      .grok-side-nav-btn:hover:not(:disabled) { background:#38444d; color:#fff; border-color:#6b7d8c; }
      .grok-side-nav-btn:disabled { opacity:.35; cursor: default; }
      .grok-side-nav-counter { font-size: 9px; color:#667; min-width: 54px; text-align:center; }

      #grok-panel-prompt {
        width: 100%; flex-grow: 1;
        background: #000; border: 1px solid #38444d; border-radius: 6px;
        color: #fff; padding: 8px; font-size: 12px; font-family: sans-serif;
        resize: none; box-sizing: border-box;
      }
      #grok-panel-prompt:focus { border-color: #1d9bf0; outline: none; }

      .grok-side-btn-row { display: flex; gap: 8px; flex-shrink: 0; }
      .grok-side-action-btn { flex: 1; padding: 8px; border-radius: 6px; border: none; cursor: pointer; font-weight: bold; font-size: 12px; transition: background 0.2s, border-color 0.2s; }
      #btn-open-library { background: #1d9bf0; color: white; }
      #btn-open-library:hover { background: #1a8cd8; }
      #btn-generate { background: #273340; color: #eff3f4; border: 1px solid #38444d; }
      #btn-generate:hover { background: #38444d; border-color: #6b7d8c; }

      #grok-side-status { text-align: center; font-size: 11px; color: #00ba7c; padding-top: 5px; border-top: 1px solid #38444d; flex-shrink: 0; }
      .status-error { color: #f4212e !important; }

      #grok-library-modal {
        position: fixed; right: 20px; width: 350px; height: 400px;
        background: #15202b; border: 1px solid #38444d; border-radius: 12px;
        display: none; flex-direction: column; z-index: 199999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.8);
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }
      #grok-library-modal.active { display: flex; }
      .gl-header { padding: 10px; background: #192734; display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-size: 13px; color: white; border-bottom: 1px solid #38444d; }
      .gl-close { cursor: pointer; font-size: 18px; line-height: 1; color: #8b98a5; }
      .gl-view-list { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
      .gl-list-content { overflow-y: auto; padding: 10px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
      .gl-item { background: #192734; border: 1px solid #38444d; padding: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: white; }
      .gl-item:hover { border-color: #1d9bf0; }
      .gl-item-text { cursor: pointer; flex: 1; margin-right: 10px; }
      .gl-item-text b { display: block; margin-bottom: 2px; }
      .gl-item-text span { color: #888; font-size: 10px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .gl-item-actions { display: flex; gap: 5px; }
      .gl-icon-btn { background: none; border: none; cursor: pointer; font-size: 14px; color: #8b98a5; padding: 2px; }
      .gl-icon-btn:hover { color: white; }
      .gl-create-btn { margin: 10px; padding: 8px; background: #00ba7c; color: white; text-align: center; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px; }
      .gl-view-editor { display: none; flex-direction: column; padding: 15px; height: 100%; gap: 10px; }
      .gl-view-editor.active { display: flex; }
      .gl-input, .gl-textarea { background: #273340; border: 1px solid #38444d; color: white; padding: 8px; border-radius: 4px; font-size: 12px; width: 100%; box-sizing: border-box; }
      .gl-textarea { flex-grow: 1; resize: none; }
      .gl-editor-buttons { display: flex; gap: 10px; margin-top: auto; }
      .gl-btn { flex: 1; padding: 8px; border-radius: 6px; border: none; cursor: pointer; font-weight: bold; color: white; }
      .gl-btn-save { background: #1d9bf0; }
      .gl-btn-cancel { background: #38444d; }

      .grok-prompt-overlay { z-index: 2147483000 !important; }
      .grok-toast-container { z-index: 2147483001 !important; }
      #grok-control-panel { z-index: 2147483002 !important; display:flex !important; visibility:visible !important; opacity:1 !important; }
      #grok-library-modal { z-index: 2147483003 !important; }
      .grok-lightbox { z-index: 2147483004 !important; }

      /* ====== ENHANCER: Context Buttons ====== */
      .gs-context { display:flex; align-items:center; gap:6px; padding:8px 12px; background:rgba(22,24,28,0.95); border:1px solid #2f3336; border-radius:10px; margin-top:8px; flex-wrap:wrap; z-index:9998; }
      .gs-ctx-btn { background:#16181c; border:1px solid #2f3336; color:#e7e9ea; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; display:flex; align-items:center; gap:4px; transition:all 0.15s; white-space:nowrap; }
      .gs-ctx-btn:hover { border-color:#1d9bf0; background:rgba(29,155,240,0.1); }
      .gs-ctx-btn:disabled { opacity:0.4; cursor:default; }
      .gs-ctx-btn.enhancing { background:rgba(29,155,240,0.15); border-color:#1d9bf0; animation:gs-pulse 1s infinite; }
      @keyframes gs-pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
      .gs-model-dropdown { background:#16181c; border:1px solid #2f3336; color:#e7e9ea; padding:5px 8px; border-radius:6px; font-size:11px; cursor:pointer; max-width:150px; }
      .gs-ctx-btn.gs-undo-redo { padding:6px 8px; font-size:14px; min-width:32px; justify-content:center; }

      /* ====== ENHANCER: Command Palette ====== */
      .gs-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:2147483005; display:none; align-items:flex-start; justify-content:center; padding-top:15vh; }
      .gs-overlay.open { display:flex; }
      .gs-palette { background:#0a0a0a; border:1px solid #2a2a2a; border-radius:12px; width:500px; max-width:90vw; max-height:70vh; display:flex; flex-direction:column; box-shadow:0 20px 50px rgba(0,0,0,0.5); animation:gs-slide 0.15s ease-out; overflow:hidden; }
      @keyframes gs-slide { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
      .gs-search-wrap { padding:12px; border-bottom:1px solid #2a2a2a; }
      .gs-search { width:100%; background:#161616; border:1px solid #2a2a2a; border-radius:8px; padding:12px 16px; color:#e5e5e5; font-size:14px; outline:none; box-sizing:border-box; }
      .gs-search:focus { border-color:#3b82f6; }
      .gs-tabs { display:flex; border-bottom:1px solid #2a2a2a; padding:0 12px; }
      .gs-tab { padding:10px 16px; background:none; border:none; border-bottom:2px solid transparent; color:#737373; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.15s; }
      .gs-tab:hover { color:#e5e5e5; }
      .gs-tab.active { color:#3b82f6; border-bottom-color:#3b82f6; }
      .gs-content { overflow-y:auto; flex:1; padding:12px; max-height:50vh; }
      .gs-empty { text-align:center; padding:40px 20px; color:#737373; }
      .gs-empty-icon { font-size:32px; margin-bottom:8px; }
      .gs-section-title { font-size:10px; font-weight:700; color:#737373; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; }
      .gs-item { display:flex; align-items:center; gap:10px; padding:10px; border-radius:8px; cursor:pointer; transition:background 0.1s; }
      .gs-item:hover { background:#161616; }
      .gs-item-icon { font-size:16px; flex-shrink:0; }
      .gs-item-text { flex:1; min-width:0; }
      .gs-item-title { font-size:13px; color:#e5e5e5; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .gs-item-sub { font-size:11px; color:#737373; }
      .gs-item-del { background:none; border:none; color:#737373; cursor:pointer; font-size:14px; padding:4px 6px; border-radius:4px; }
      .gs-item-del:hover { background:rgba(239,68,68,0.1); color:#ef4444; }
      .gs-settings { display:flex; flex-direction:column; gap:16px; }
      .gs-field { display:flex; flex-direction:column; gap:6px; }
      .gs-label { font-size:12px; font-weight:600; color:#e5e5e5; }
      .gs-input { background:#161616; border:1px solid #2a2a2a; border-radius:8px; padding:10px 12px; color:#e5e5e5; font-size:13px; outline:none; }
      .gs-input:focus { border-color:#3b82f6; }
      .gs-textarea { background:#161616; border:1px solid #2a2a2a; border-radius:8px; padding:10px 12px; color:#e5e5e5; font-size:12px; outline:none; resize:vertical; min-height:80px; font-family:inherit; }
      .gs-field-hint { font-size:10px; color:#737373; }
      .gs-model-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
      .gs-model-btn { background:#161616; border:1px solid #2a2a2a; border-radius:8px; padding:8px; cursor:pointer; text-align:center; transition:all 0.15s; }
      .gs-model-btn:hover { border-color:#555; }
      .gs-model-btn.active { border-color:#3b82f6; background:rgba(59,130,246,0.1); }
      .gs-model-name { display:block; font-size:11px; font-weight:600; color:#e5e5e5; }
      .gs-model-badge { display:inline-block; font-size:9px; padding:1px 6px; border-radius:10px; font-weight:600; margin-top:2px; }
      .gs-model-badge.fast { background:rgba(34,197,94,0.15); color:#22c55e; }
      .gs-model-badge.optimal { background:rgba(59,130,246,0.15); color:#3b82f6; }
      .gs-model-badge.smart { background:rgba(168,85,247,0.15); color:#a855f7; }
      .gs-model-badge.creative { background:rgba(245,158,11,0.15); color:#f59e0b; }
      .gs-model-badge.uncensored { background:rgba(239,68,68,0.15); color:#ef4444; }
      .gs-model-badge.powerful { background:rgba(6,182,212,0.15); color:#06b6d4; }
      .gs-model-badge.cheap { background:rgba(115,115,115,0.15); color:#737373; }
      .gs-divider { height:1px; background:#2a2a2a; margin:4px 0; }
      .gs-toggle-row { display:flex; align-items:center; gap:10px; }
      .gs-toggle { position:relative; display:inline-block; width:44px; height:24px; }
      .gs-toggle input { opacity:0; width:0; height:0; }
      .gs-toggle-slider { position:absolute; cursor:pointer; inset:0; background:#333; border-radius:12px; transition:0.3s; }
      .gs-toggle-slider::before { content:''; position:absolute; height:20px; width:20px; left:2px; bottom:2px; background:white; border-radius:50%; transition:0.3s; }
      .gs-toggle input:checked+.gs-toggle-slider { background:#3b82f6; }
      .gs-toggle input:checked+.gs-toggle-slider::before { transform:translateX(20px); }
      .gs-toggle-label { font-size:12px; color:#e5e5e5; }
      .gs-btn-row { display:flex; gap:8px; }
      .gs-action-btn { background:#161616; border:1px solid #2a2a2a; border-radius:6px; padding:8px 12px; color:#e5e5e5; cursor:pointer; font-size:12px; display:flex; align-items:center; gap:6px; transition:all 0.15s; }
      .gs-action-btn:hover { border-color:#3b82f6; background:rgba(59,130,246,0.1); }
      .gs-shortcuts { display:flex; flex-direction:column; gap:6px; }
      .gs-shortcut { font-size:12px; color:#737373; display:flex; align-items:center; gap:6px; }
      .gs-shortcut kbd { background:#161616; border:1px solid #2a2a2a; border-radius:4px; padding:2px 6px; font-family:monospace; font-size:11px; color:#e5e5e5; }

      /* ====== ENHANCER: Floating Pill ====== */
      .gs-pill { position:fixed; top:12px; right:12px; background:#16181c; border:1px solid #2f3336; border-radius:20px; padding:6px 12px; font-family:-apple-system,BlinkMacSystemFont,sans-serif; font-size:12px; color:#e7e9ea; cursor:pointer; z-index:9999; display:flex; align-items:center; gap:8px; transition:all 0.2s; user-select:none; }
      .gs-pill:hover { border-color:#1d9bf0; background:#1d1f23; }
      .gs-pill-count { background:#1d9bf0; color:white; padding:2px 6px; border-radius:10px; font-size:10px; font-weight:600; }
      .gs-pill-key { color:#71767b; font-size:10px; }

      /* ====== SETTINGS: VGEN Panel ====== */
      .gs-settings-section { margin-top:16px; background:rgba(255,255,255,0.02); border:1px solid var(--grok-border); border-radius:10px; padding:14px; }
      .gs-settings-section-title { font-size:13px; font-weight:700; color:#3aff9d; margin-bottom:12px; display:flex; align-items:center; gap:6px; }
      .gs-settings-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
      .gs-settings-label { font-size:12px; font-weight:600; color:var(--grok-text-main); }
      .gs-settings-sublabel { font-size:10px; color:var(--grok-text-muted); }
      .gs-select { background:var(--grok-surface); border:1px solid var(--grok-border); color:var(--grok-text-main); padding:6px 10px; border-radius:6px; font-size:12px; }
      .gs-number-input { background:var(--grok-surface); border:1px solid var(--grok-border); color:var(--grok-text-main); padding:6px 10px; border-radius:6px; font-size:12px; width:70px; }
      .gs-textarea-small { background:var(--grok-surface); border:1px solid var(--grok-border); color:var(--grok-text-main); padding:6px 10px; border-radius:6px; font-size:11px; width:100%; resize:vertical; min-height:40px; font-family:monospace; box-sizing:border-box; }

      /* ====== QUEUE: Controls ====== */
      .gs-queue-item { display:flex; align-items:center; justify-content:space-between; padding:6px 8px; margin-bottom:4px; border-radius:6px; border-left:3px solid #555; background:#2a2a2a; }
      .gs-queue-item.done { background:#1a2a1a; border-left-color:#10b981; opacity:0.6; }
      .gs-queue-item.active { background:#1e3a1e; border-left-color:#4ade80; }
      .gs-queue-name { font-size:11px; color:#ccc; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .gs-queue-remove { background:#dc2626; border:none; color:white; padding:2px 6px; border-radius:4px; cursor:pointer; font-size:10px; margin-left:8px; }
      .gs-queue-remove:disabled { opacity:0.5; cursor:not-allowed; }
      .gs-queue-controls { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:8px; }
      .gs-queue-btn { border:none; color:white; padding:8px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:600; }
      .gs-queue-btn:disabled { opacity:0.5; cursor:not-allowed; }
      .gs-queue-btn.start { background:#10b981; }
      .gs-queue-btn.pause { background:#f59e0b; }
      .gs-queue-btn.stop { background:#dc2626; }
      .gs-queue-log { background:#000; border:1px solid #333; border-radius:8px; padding:8px; max-height:120px; overflow-y:auto; font-size:10px; font-family:'Courier New',monospace; margin-top:8px; }
      .gs-queue-log-line { padding:3px 6px; margin-bottom:2px; border-radius:4px; background:#1a1a1a; border-left:3px solid #4ade80; }
    `);

    // --- STATE ---
    let isOpen = false;
    let currentCategory = '';
    let videoFilterCategory = 'all';
    let imageFilterCategory = 'all';
    let historyFilterMode = 'all';
    let videoSortMode = 'newest';
    let imageSortMode = 'newest';
    let editedSortMode = 'newest';
    let historySortMode = 'newest';
    let isDragging = false, isResizing = false;
    let dragOffset = { x: 0, y: 0 };
    let modalElement = null;
    let isRecordingKeybind = false;
    let recordingTarget = 'main';
    let selectedPromptIds = new Set();
    let lastActivePromptId = null;
    let editingPromptId = null;
    let moderationLockUntil = 0;

    let retryCount = 0;
    let lastRetryTime = 0;
    let isAutoRetryClick = false;
    let currentVideoInputText = '';

    // Store blob URLs for video playback in lightbox (max 20 cached, LRU eviction)
    const MAX_BLOB_CACHE = 20;
    let capturedVideoBlobUrls = {};
    let _blobAccessOrder = [];

    function cacheBlobUrl(promptId, blobUrl) {
      // Evict oldest if at capacity
      if (!capturedVideoBlobUrls[promptId] && _blobAccessOrder.length >= MAX_BLOB_CACHE) {
        const evictId = _blobAccessOrder.shift();
        if (capturedVideoBlobUrls[evictId]) {
          try { URL.revokeObjectURL(capturedVideoBlobUrls[evictId]); } catch (e) {}
          delete capturedVideoBlobUrls[evictId];
        }
      }
      capturedVideoBlobUrls[promptId] = blobUrl;
      // Move to end of access order
      _blobAccessOrder = _blobAccessOrder.filter(id => id !== promptId);
      _blobAccessOrder.push(promptId);
    }

    // Clean up all blob URLs on page unload
    window.addEventListener('beforeunload', () => {
      Object.values(capturedVideoBlobUrls).forEach(url => {
        try { URL.revokeObjectURL(url); } catch (e) {}
      });
    });

    // --- HELPERS ---
    // Create toast container eagerly to avoid DOM lookup on every toast
    let _toastContainer = null;
    function _ensureToastContainer() {
      if (_toastContainer && _toastContainer.isConnected) return _toastContainer;
      _toastContainer = document.querySelector('.grok-toast-container');
      if (!_toastContainer) {
        _toastContainer = document.createElement('div');
        _toastContainer.className = 'grok-toast-container';
        document.body.appendChild(_toastContainer);
      }
      return _toastContainer;
    }

    function showToast(message, type = 'success') {
      const container = _ensureToastContainer();
      const toast = document.createElement('div');
      toast.className = 'grok-toast';
      if(type === 'error' || type === 'mod') toast.style.background = 'var(--grok-danger)';
      if(type === 'retry') toast.style.background = 'var(--grok-warning)';
      if(type === 'mod') toast.innerHTML = `⚠️ <span>${message.replace(/</g,'&lt;')}</span>`;
      else if(type === 'retry') toast.innerHTML = `🔄 <span>${message.replace(/</g,'&lt;')}</span>`;
      else toast.innerHTML = `
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        <span>${message.replace(/</g,'&lt;')}</span>
      `;
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    // Shared HTML escape helper — use for any user content injected via innerHTML
    function _esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }

    function getCategories() {
      let cats = JSON.parse(GM_getValue('grok_categories_v2', 'null'));
      if (!cats) {
        const oldCats = JSON.parse(GM_getValue('grok_categories', '["General"]'));
        cats = oldCats.map(c => {
          if (c === 'Image') return null;
          return { name: c, type: 'video' };
        }).filter(c => c !== null);
        if (!cats.some(c => c.name === 'General Image')) cats.push({ name: 'General Image', type: 'image' });
        saveCategories(cats);
      }
      return cats;
    }
    function saveCategories(cats) {
      GM_setValue('grok_categories_v2', JSON.stringify(cats));
      GM_setValue('grok_categories', JSON.stringify(cats.map(c => c.name)));
    }
    let _promptsCache = null;
    function getPrompts() {
      if (_promptsCache) return _promptsCache.map(p => ({ ...p }));
      _promptsCache = JSON.parse(GM_getValue('grok_prompts', '[]'));
      return _promptsCache.map(p => ({ ...p }));
    }
    function savePrompts(prompts) {
      _promptsCache = prompts;
      GM_setValue('grok_prompts', JSON.stringify(prompts));
    }

    function migratePrompt(p) {
      if (!p.stats) p.stats = { attempts: 0, moderated: 0 };
      if (typeof p.moderation === 'undefined') p.moderation = 0;
      if (p.category === 'Image') p.category = 'General Image';
      return p;
    }

    const _settingsDefaults = {
      autoTrack: true, silentMode: false, floatingMode: false, useAutoStats: true,
      disableVideoLoop: false, hideVideoControls: false, openOnLaunch: true,
      retryEnabled: false, maxRetries: 3, showMediaPreviews: true, showSourceImage: false,
      keybind: { key: 'l', altKey: false, ctrlKey: true, shiftKey: false, metaKey: false },
      sidePanelKeybind: { key: 'k', altKey: true, ctrlKey: false, shiftKey: false, metaKey: false }
    };
    let _settingsCache = null;

    function getSettings() {
      if (_settingsCache) return { ..._settingsCache };
      const saved = JSON.parse(GM_getValue('grok_settings', '{}'));
      _settingsCache = { ..._settingsDefaults, ...saved };
      return { ..._settingsCache };
    }
    function saveSettings(s) {
      _settingsCache = { ..._settingsDefaults, ...s };
      GM_setValue('grok_settings', JSON.stringify(s));
    }

    // Reusable sort comparators for prompt lists
    function sortBySuccessRate(a, b, ascending = false) {
      const pA = migratePrompt(a), pB = migratePrompt(b);
      const rA = pA.stats.attempts ? ((pA.stats.attempts - pA.stats.moderated) / pA.stats.attempts) : 0;
      const rB = pB.stats.attempts ? ((pB.stats.attempts - pB.stats.moderated) / pB.stats.attempts) : 0;
      if (rA !== rB) return ascending ? (rA - rB) : (rB - rA);
      return ascending ? (pB.stats.moderated - pA.stats.moderated) : (pB.stats.attempts - pA.stats.attempts);
    }

    function sortByModeration(a, b, ascending = false) {
      return ascending
        ? ((migratePrompt(a).moderation || 0) - (migratePrompt(b).moderation || 0))
        : ((migratePrompt(b).moderation || 0) - (migratePrompt(a).moderation || 0));
    }

    function getKeybindString(kb) {
      if (!kb) return 'Ctrl + L';
      const parts =[];
      if (kb.ctrlKey) parts.push('Ctrl');
      if (kb.altKey) parts.push('Alt');
      if (kb.shiftKey) parts.push('Shift');
      if (kb.metaKey) parts.push('Meta');
      parts.push((kb.key === ' ' ? 'Space' : kb.key).toUpperCase());
      return parts.join(' + ');
    }

    function compressImage(file, callback) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const MAX_SIZE = 400;
          let width = img.width, height = img.height;
          if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
          else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
          canvas.width = width; canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          callback(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    function enforceVideoLoopState() {
      const s = getSettings();
      document.querySelectorAll('video').forEach(video => {
        if (s.disableVideoLoop) { video.removeAttribute('loop'); video.loop = false; }
        else { video.setAttribute('loop', ''); video.loop = true; }
      });
    }

    // ============================
    // UNIFIED FETCH INTERCEPTOR
    // (Consolidates: Video Enlengenthener + Spicy Mode + Video Gen Overrides)
    // ============================
    const VGEN = {
      enabled: GM_getValue('vgen_enabled', false),
      aspectRatio: GM_getValue('vgen_ar', ''),
      videoLength: GM_getValue('vgen_length', 0),
      swapImageUrl: GM_getValue('vgen_swap_url', ''),
      forceSpicy: GM_getValue('vgen_spicy', false)
    };

    function saveVgenSettings() {
      GM_setValue('vgen_enabled', VGEN.enabled);
      GM_setValue('vgen_ar', VGEN.aspectRatio);
      GM_setValue('vgen_length', VGEN.videoLength);
      GM_setValue('vgen_spicy', VGEN.forceSpicy);
      GM_setValue('vgen_swap_url', VGEN.swapImageUrl || '');
    }

    function extractUuidFromUrl(url) {
      const match = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      return match ? match[1] : null;
    }

    function modifyVideoGenPayload(originalBody) {
      if (!VGEN.enabled) return originalBody;
      try {
        const body = JSON.parse(originalBody);
        if (!body.toolOverrides || !body.toolOverrides.videoGen) return originalBody;

        console.log('[GrokSuite] Intercepted Video Gen request');

        let config = body.responseMetadata?.modelConfigOverride?.modelMap?.videoGenModelConfig;
        if (!config) {
          if (!body.responseMetadata) body.responseMetadata = {};
          if (!body.responseMetadata.modelConfigOverride) body.responseMetadata.modelConfigOverride = {};
          if (!body.responseMetadata.modelConfigOverride.modelMap) body.responseMetadata.modelConfigOverride.modelMap = {};
          body.responseMetadata.modelConfigOverride.modelMap.videoGenModelConfig = {};
          config = body.responseMetadata.modelConfigOverride.modelMap.videoGenModelConfig;
        }

        // Aspect Ratio override
        if (VGEN.aspectRatio) {
          console.log(`[GrokSuite] AR: ${config.aspectRatio} → ${VGEN.aspectRatio}`);
          config.aspectRatio = VGEN.aspectRatio;
        }

        // Video Length override (up to 15s)
        if (VGEN.videoLength > 0) {
          console.log(`[GrokSuite] Length: ${config.videoLength} → ${VGEN.videoLength}`);
          config.videoLength = VGEN.videoLength;
        }

        // Image URL swap
        const swapUrl = VGEN.swapImageUrl?.trim();
        if (swapUrl) {
          const newUuid = extractUuidFromUrl(swapUrl);
          if (newUuid) {
            config.parentPostId = newUuid;
            const urlRegex = /https?:\/\/[^\s"]+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[^\s"]*/i;
            if (body.message?.match(urlRegex)) {
              body.message = body.message.replace(urlRegex, swapUrl);
            }
            if (body.fileAttachments && Array.isArray(body.fileAttachments)) {
              body.fileAttachments = [newUuid];
            }
            console.log('[GrokSuite] Image swapped');
          }
        }

        // Force Spicy Mode
        if (VGEN.forceSpicy) {
          const urlRegex = /^(https?:\/\/[^\s]+)/i;
          const urlMatch = (body.message || '').match(urlRegex);
          const imageUrl = urlMatch ? urlMatch[1] : '';
          const spicyTag = '--mode=extremely-spicy-and-crazy';
          body.message = imageUrl ? `${imageUrl} ${spicyTag}` : spicyTag;
          console.log('[GrokSuite] Spicy mode forced');
        }

        return JSON.stringify(body);
      } catch (e) {
        console.error('[GrokSuite] Payload modification error:', e);
        return originalBody;
      }
    }

    // Single cooperative fetch hook
    const _originalFetch = window.fetch;
    window.fetch = async function(input, init) {
      let url = (input instanceof Request) ? input.url : input;
      if (url?.includes('/rest/app-chat/conversations/new') && init?.method === 'POST' && init?.body) {
        try { init.body = modifyVideoGenPayload(init.body); } catch (e) { console.error('[GrokSuite] Fetch hook error:', e); }
      }
      return _originalFetch.apply(this, arguments);
    };

    // ============================
    // OPENROUTER AI ENHANCEMENT MODULE
    // (Consolidates: Grok Minimal Enhancer)
    // ============================
    const OPENROUTER_MODELS = [
      { id: 'x-ai/grok-4.1-fast',                   name: 'Grok 4 Fast',         badge: 'fast' },
      { id: 'google/gemini-2.5-flash',               name: 'Gemini 2.5 Flash',    badge: 'optimal' },
      { id: 'deepseek/deepseek-v3.2',                name: 'DeepSeek 3.2',        badge: 'fast' },
      { id: 'qwen/qwen3-235b-a22b',                  name: 'Qwen3 235B',          badge: 'smart' },
      { id: 'meta-llama/llama-4-maverick',            name: 'Llama 4 Maverick',    badge: 'fast' },
      { id: 'sao10k/l3.3-euryale-70b',               name: 'Euryale 70B',         badge: 'uncensored' },
      { id: 'nousresearch/hermes-3-llama-3.1-405b',  name: 'Hermes 3 405B',       badge: 'creative' },
      { id: 'google/gemini-2.5-pro',                  name: 'Gemini 2.5 Pro',      badge: 'powerful' },
      { id: 'mistralai/mistral-nemo',                 name: 'Nemo',                badge: 'cheap' },
    ];

    const OPTIMAL_SYSTEM_PROMPT = `Role: You are a Kinematic Telemetry Generator. Convert the user input into a single valid JSON object.

## CRITICAL RULES:
1. **Output JSON ONLY.** No markdown blocks (no \\\`\\\`\\\`json), no conversational text.
2. **NO UNESCAPED QUOTES.** Inside JSON strings, use ONLY single quotes (') for dialogue.
3. **PRESERVE THE SCENE.** Do NOT add, change, or invent any environment, setting, location, or background.
4. **Valid JSON.** Ensure strict JSON compliance (no trailing commas).

## PHYSICS INSTRUCTIONS:
- De-Emotionalize: Convert subjective words into mechanical terms.
- Quantify: Add Hz, in, psi, and degrees where applicable.
- Vocal: Always include vocal data, even if silent.

## OUTPUT FORMAT:
{
  "sequence": "full speed (1x) seamless loop: [Action 1 with Hz/in/psi]; [Action 2]; [Reset]. Continuous [micro-physics].",
  "camera_relation": "[Height], [Distance], [Angle]; [Focus]; [Background - only if specified]",
  "Vocal": "[Specific phrase OR breathing pattern]",
  "Vocal_tone": "[Adjectives: e.g., 'soft, breathy, wet, high-fidelity']"
}

Return ONLY the cleaned JSON.`;

    const AI_STATE = {
      apiKey: GM_getValue('openrouter_api_key', ''),
      selectedModel: GM_getValue('openrouter_model', 'x-ai/grok-4.1-fast'),
      customInstructions: GM_getValue('openrouter_custom_instructions', ''),
      isEnhancing: false,
      undoStack: [],
      redoStack: []
    };

    async function enhancePromptViaOpenRouter(text) {
      if (!AI_STATE.apiKey) {
        showToast('Set OpenRouter API key in settings', 'error');
        return null;
      }
      const systemPrompt = AI_STATE.customInstructions
        ? `${OPTIMAL_SYSTEM_PROMPT}\n\n## ADDITIONAL INSTRUCTIONS:\n${AI_STATE.customInstructions}`
        : OPTIMAL_SYSTEM_PROMPT;

      return new Promise((resolve) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: 'https://openrouter.ai/api/v1/chat/completions',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_STATE.apiKey}`,
            'HTTP-Referer': 'https://grok.com',
            'X-Title': 'Grok Master Suite'
          },
          data: JSON.stringify({
            model: AI_STATE.selectedModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: text }
            ],
            temperature: 0.7,
            max_tokens: 1500
          }),
          timeout: 30000,
          onload: (res) => {
            try {
              const data = JSON.parse(res.responseText);
              if (data.error) {
                showToast(`AI error: ${data.error.message || 'Unknown'}`, 'error');
                resolve(null);
                return;
              }
              const content = data.choices?.[0]?.message?.content;
              if (content) {
                const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                resolve(cleaned);
              } else {
                showToast('Empty response from AI', 'error');
                resolve(null);
              }
            } catch (e) {
              showToast('Failed to parse AI response', 'error');
              resolve(null);
            }
          },
          onerror: () => { showToast('AI request failed', 'error'); resolve(null); },
          ontimeout: () => { showToast('AI request timed out (30s)', 'error'); resolve(null); }
        });
      });
    }

    // ============================
    // MULTI-IMAGE QUEUE PROCESSOR
    // (Consolidates: Grok Advanced Semi-Auto F5)
    // ============================
    const QUEUE_STATE = {
      images: [],
      currentIndex: 0,
      isProcessing: false,
      isPaused: false,
      killDelay: parseInt(GM_getValue('queue_kill_delay', '245'), 10)
    };

    function getUserId() {
      const match = document.cookie.match(/x-userid=([^;]+)/);
      return match ? match[1] : null;
    }

    async function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    async function executeGlitchUpload(file, fileData, killDelay) {
      const userId = getUserId();
      if (!userId) { showToast('No x-userid found — are you logged in?', 'error'); return false; }

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      const ghostFetch = iframe.contentWindow.fetch;

      try {
        // Step 1: Upload
        const uploadRes = await ghostFetch('/rest/app-chat/upload-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, fileMimeType: file.type || 'image/jpeg', content: fileData })
        });
        const uploadData = await uploadRes.json();
        const fileId = uploadData.fileMetadataId;
        console.log(`[GrokSuite] Queue upload OK: ${fileId}`);

        // Step 2: Fire create and snap iframe
        ghostFetch('/rest/media/post/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaType: 'MEDIA_POST_TYPE_IMAGE',
            mediaUrl: `https://assets.grok.com/users/${userId}/${fileId}/content`
          })
        }).catch(() => {});

        // Step 3: Kill switch after delay
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
          localStorage.setItem('grok_suite_pending_like', fileId);
          window.location.href = `https://grok.com/imagine/post/${fileId}`;
        }, killDelay);

        return true;
      } catch (err) {
        console.error('[GrokSuite] Glitch error:', err);
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        return false;
      }
    }

    // Handle pending likes on page load (queue continues across reloads)
    function processPendingQueueActions() {
      const pendingId = localStorage.getItem('grok_suite_pending_like');
      if (!pendingId) return;

      fetch('/rest/media/post/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pendingId })
      }).then(res => {
        if (res.ok) {
          console.log('[GrokSuite] Liked successfully:', pendingId);
          localStorage.removeItem('grok_suite_pending_like');
        }
      }).catch(err => {
        console.error('[GrokSuite] Like failed:', err);
        localStorage.removeItem('grok_suite_pending_like');
      });
    }
    processPendingQueueActions();

    // ============================
    // INDEXEDDB MANAGER FOR VIDEOS
    // ============================
    const DB_NAME = 'GrokVideoDB';
    const STORE_NAME = 'videos';
    let _dbInstance = null;

    function openDB() {
      if (_dbInstance) return Promise.resolve(_dbInstance);
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
          e.target.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => {
          _dbInstance = request.result;
          _dbInstance.onclose = () => { _dbInstance = null; };
          _dbInstance.onversionchange = () => { _dbInstance.close(); _dbInstance = null; };
          resolve(_dbInstance);
        };
        request.onerror = () => reject(request.error);
      });
    }

    async function saveVideoToDB(promptId, blob) {
      try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(blob, promptId);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (e) {
        console.error('[GrokSuite] DB Save Error:', e);
      }
    }

    async function getVideoFromDB(promptId) {
      try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const req = tx.objectStore(STORE_NAME).get(promptId);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(tx.error);
        });
      } catch (e) {
        console.error('[GrokSuite] DB Get Error:', e);
        return null;
      }
    }

    async function deleteVideoFromDB(promptId) {
      try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(promptId);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (e) {
        console.error('[GrokSuite] DB Delete Error:', e);
      }
    }

    async function clearAllVideosFromDB() {
      try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (e) {
        console.error('[GrokSuite] DB Clear Error:', e);
      }
    }

    // ============================
    // VIDEO CAPTURE - NATIVE FETCH
    // ============================

    // ============================
    // CONSOLIDATED MODULE UI
    // (Context Buttons + Command Palette + Pill + VGEN Panel + Queue Panel + Observer)
    // ============================
    const GS_ENHANCER = {
      prompts: JSON.parse(GM_getValue('gs_enhancer_prompts', '[]')),
      isPaletteOpen: false,
      isEnhancing: false,
      undoStack: [],
      redoStack: [],
      lastInputValue: '',
      _cachedInput: null,
      _cachedInputUrl: ''
    };

    // --- Storage Key Migration (from standalone Minimal Enhancer) ---
    (function migrateOldEnhancerKeys() {
      // API key: old key → new key
      if (!GM_getValue('openrouter_api_key', '') && GM_getValue('grok_openrouter_key', '')) {
        GM_setValue('openrouter_api_key', GM_getValue('grok_openrouter_key', ''));
        console.log('[GrokSuite] Migrated API key from grok_openrouter_key');
      }
      // Model: old key → new key
      if (GM_getValue('openrouter_model', '') === 'x-ai/grok-4.1-fast' && GM_getValue('grok_selected_model', '')) {
        const oldModel = GM_getValue('grok_selected_model', '');
        if (oldModel !== 'x-ai/grok-4.1-fast') {
          GM_setValue('openrouter_model', oldModel);
          console.log('[GrokSuite] Migrated model selection from grok_selected_model');
        }
      }
      // Prompts: old key → new key (merge, don't overwrite)
      if (GS_ENHANCER.prompts.length === 0) {
        const oldPrompts = JSON.parse(GM_getValue('grok_prompts_minimal', '[]'));
        if (oldPrompts.length > 0) {
          GS_ENHANCER.prompts = oldPrompts;
          GM_setValue('gs_enhancer_prompts', JSON.stringify(GS_ENHANCER.prompts));
          console.log(`[GrokSuite] Migrated ${oldPrompts.length} prompts from grok_prompts_minimal`);
        }
      }
      // Custom instructions
      if (!GM_getValue('openrouter_custom_instructions', '') && GM_getValue('grok_custom_instructions', '')) {
        GM_setValue('openrouter_custom_instructions', GM_getValue('grok_custom_instructions', ''));
        console.log('[GrokSuite] Migrated custom instructions from grok_custom_instructions');
      }
    })();

    function gsSaveEnhancerPrompts() {
      GM_setValue('gs_enhancer_prompts', JSON.stringify(GS_ENHANCER.prompts));
      gsUpdatePillCount();
    }

    // --- Video Input Helpers ---
    function gsGetVideoInput() {
      const currentUrl = location.href;
      if (GS_ENHANCER._cachedInput && GS_ENHANCER._cachedInput.isConnected && GS_ENHANCER._cachedInputUrl === currentUrl) {
        return GS_ENHANCER._cachedInput;
      }
      GS_ENHANCER._cachedInput = document.querySelector('textarea[aria-label="Make a video"]');
      GS_ENHANCER._cachedInputUrl = currentUrl;
      return GS_ENHANCER._cachedInput;
    }

    function gsSetVideoInput(text) {
      const input = gsGetVideoInput();
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
      return true;
    }

    function gsGetVideoInputText() {
      const input = gsGetVideoInput();
      return input ? input.value.trim() : '';
    }

    // --- Undo / Redo ---
    function gsPushUndo(text) {
      if (text && text !== GS_ENHANCER.undoStack[GS_ENHANCER.undoStack.length - 1]) {
        GS_ENHANCER.undoStack.push(text);
        if (GS_ENHANCER.undoStack.length > 50) GS_ENHANCER.undoStack.shift();
        GS_ENHANCER.redoStack = [];
        gsUpdateUndoRedoButtons();
      }
    }

    function gsUndo() {
      if (GS_ENHANCER.undoStack.length > 0) {
        const current = gsGetVideoInputText();
        if (current) GS_ENHANCER.redoStack.push(current);
        gsSetVideoInput(GS_ENHANCER.undoStack.pop());
        gsUpdateUndoRedoButtons();
        showToast('Undo');
      }
    }

    function gsRedo() {
      if (GS_ENHANCER.redoStack.length > 0) {
        const current = gsGetVideoInputText();
        if (current) GS_ENHANCER.undoStack.push(current);
        gsSetVideoInput(GS_ENHANCER.redoStack.pop());
        gsUpdateUndoRedoButtons();
        showToast('Redo');
      }
    }

    function gsUpdateUndoRedoButtons() {
      const undoBtn = document.getElementById('gsUndo');
      const redoBtn = document.getElementById('gsRedo');
      if (undoBtn) undoBtn.disabled = GS_ENHANCER.undoStack.length === 0;
      if (redoBtn) redoBtn.disabled = GS_ENHANCER.redoStack.length === 0;
    }

    function gsTrackInputChanges() {
      const input = gsGetVideoInput();
      if (!input) return;
      const currentValue = input.value.trim();
      if (currentValue && currentValue !== GS_ENHANCER.lastInputValue && currentValue.length > 5) {
        if (Math.abs(currentValue.length - GS_ENHANCER.lastInputValue.length) > 20 ||
            !currentValue.startsWith(GS_ENHANCER.lastInputValue.substring(0, 20))) {
          gsPushUndo(GS_ENHANCER.lastInputValue);
        }
      }
      GS_ENHANCER.lastInputValue = currentValue;
    }

    // --- Auto Retry (Enhancer) ---
    // NOTE: Moderation retry is handled by the main checkForModeration() in the
    // Ultimate Manager section. This only captures the video input text on click
    // so the main retry system can restore it.
    function gsSetupAutoRetry() {
      document.addEventListener('click', (e) => {
        if (e.target.closest('button[aria-label="Make video"]')) {
          // Capture current text so the main retry system can re-inject it
          const text = gsGetVideoInputText();
          if (text) currentVideoInputText = text;
        }
      }, true);
    }

    // --- Import / Export Enhancer Prompts ---
    function gsExportEnhancerPrompts() {
      const data = { version: '1.0', exportDate: new Date().toISOString(), prompts: GS_ENHANCER.prompts };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grok-enhancer-prompts-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${GS_ENHANCER.prompts.length} prompts`);
    }

    function gsImportEnhancerPrompts() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            let imported = Array.isArray(data) ? data : (data.prompts || []);
            const existingTexts = new Set(GS_ENHANCER.prompts.map(p => p.text));
            let addedCount = 0;
            imported.forEach(p => {
              if (p.text && !existingTexts.has(p.text)) {
                GS_ENHANCER.prompts.push({ id: p.id || Date.now().toString() + Math.random().toString(36).substr(2, 9), text: p.text, timestamp: p.timestamp || Date.now() });
                existingTexts.add(p.text);
                addedCount++;
              }
            });
            gsSaveEnhancerPrompts();
            gsRenderPalettePrompts();
            showToast(`Imported ${addedCount} new prompts`);
          } catch (err) {
            showToast('Invalid file format', 'error');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }

    // --- Floating Pill ---
    function gsCreatePill() {
      if (document.querySelector('.gs-pill')) return;
      const pill = document.createElement('div');
      pill.className = 'gs-pill';
      const countSpan = document.createElement('span');
      countSpan.className = 'gs-pill-count';
      countSpan.textContent = GS_ENHANCER.prompts.length;
      const label = document.createElement('span');
      label.textContent = 'Prompts';
      const key = document.createElement('span');
      key.className = 'gs-pill-key';
      key.textContent = 'Alt+G';
      pill.appendChild(countSpan);
      pill.appendChild(label);
      pill.appendChild(key);
      pill.onclick = () => gsOpenPalette();
      document.body.appendChild(pill);
    }

    function gsUpdatePillCount() {
      const count = document.querySelector('.gs-pill-count');
      if (count) count.textContent = GS_ENHANCER.prompts.length;
    }

    // --- Command Palette ---
    function gsCreatePalette() {
      if (document.getElementById('gsPalette')) return document.getElementById('gsPalette');
      const overlay = document.createElement('div');
      overlay.className = 'gs-overlay';
      overlay.id = 'gsPalette';

      const palette = document.createElement('div');
      palette.className = 'gs-palette';

      const searchWrap = document.createElement('div');
      searchWrap.className = 'gs-search-wrap';
      const search = document.createElement('input');
      search.type = 'text';
      search.className = 'gs-search';
      search.placeholder = 'Search prompts... (Esc to close)';
      search.id = 'gsSearch';
      searchWrap.appendChild(search);
      palette.appendChild(searchWrap);

      const tabs = document.createElement('div');
      tabs.className = 'gs-tabs';
      ['prompts', 'settings'].forEach(name => {
        const tab = document.createElement('button');
        tab.className = 'gs-tab' + (name === 'prompts' ? ' active' : '');
        tab.dataset.tab = name;
        tab.textContent = name.charAt(0).toUpperCase() + name.slice(1);
        tab.onclick = () => {
          tabs.querySelectorAll('.gs-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          if (name === 'settings') gsRenderPaletteSettings();
          else gsRenderPalettePrompts();
        };
        tabs.appendChild(tab);
      });
      palette.appendChild(tabs);

      const content = document.createElement('div');
      content.className = 'gs-content';
      content.id = 'gsContent';
      palette.appendChild(content);

      overlay.appendChild(palette);
      overlay.onclick = (e) => { if (e.target === overlay) gsClosePalette(); };

      let _searchTimeout;
      search.addEventListener('input', (e) => {
        clearTimeout(_searchTimeout);
        _searchTimeout = setTimeout(() => gsRenderPalettePrompts(e.target.value), 150);
      });

      document.body.appendChild(overlay);
      return overlay;
    }

    function gsOpenPalette(tab = 'prompts') {
      let overlay = document.getElementById('gsPalette');
      if (!overlay) overlay = gsCreatePalette();
      overlay.classList.add('open');
      GS_ENHANCER.isPaletteOpen = true;
      overlay.querySelectorAll('.gs-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      if (tab === 'settings') gsRenderPaletteSettings();
      else gsRenderPalettePrompts();
      if (tab === 'prompts') setTimeout(() => { const s = document.getElementById('gsSearch'); if (s) s.focus(); }, 50);
    }

    function gsClosePalette() {
      const overlay = document.getElementById('gsPalette');
      if (overlay) { overlay.classList.remove('open'); GS_ENHANCER.isPaletteOpen = false; }
    }

    function gsRenderPalettePrompts(filter = '') {
      const content = document.getElementById('gsContent');
      if (!content) return;
      const filtered = filter.length >= 2 ? GS_ENHANCER.prompts.filter(p => p.text.toLowerCase().includes(filter.toLowerCase())) : GS_ENHANCER.prompts;

      if (filtered.length === 0) {
        content.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'gs-empty';
        const icon = document.createElement('div');
        icon.className = 'gs-empty-icon';
        icon.textContent = '📭';
        const text = document.createElement('div');
        text.textContent = filter ? 'No matching prompts' : 'No saved prompts yet';
        empty.appendChild(icon);
        empty.appendChild(text);
        content.innerHTML = '';
        content.appendChild(empty);
        return;
      }

      const sorted = [...filtered].sort((a, b) => b.timestamp - a.timestamp);
      content.innerHTML = '';
      const title = document.createElement('div');
      title.className = 'gs-section-title';
      title.textContent = 'Saved Prompts';
      content.appendChild(title);

      sorted.forEach(p => {
        const idx = GS_ENHANCER.prompts.indexOf(p);
        const item = document.createElement('div');
        item.className = 'gs-item';

        const iconEl = document.createElement('div');
        iconEl.className = 'gs-item-icon';
        iconEl.textContent = '📝';

        const textWrap = document.createElement('div');
        textWrap.className = 'gs-item-text';
        const titleEl = document.createElement('div');
        titleEl.className = 'gs-item-title';
        titleEl.textContent = p.text.substring(0, 60) + (p.text.length > 60 ? '...' : '');
        const sub = document.createElement('div');
        sub.className = 'gs-item-sub';
        sub.textContent = new Date(p.timestamp).toLocaleDateString();
        textWrap.appendChild(titleEl);
        textWrap.appendChild(sub);

        const delBtn = document.createElement('button');
        delBtn.className = 'gs-item-del';
        delBtn.textContent = '✕';
        delBtn.onclick = (e) => {
          e.stopPropagation();
          GS_ENHANCER.prompts.splice(idx, 1);
          gsSaveEnhancerPrompts();
          gsRenderPalettePrompts(filter);
          showToast('Deleted');
        };

        item.appendChild(iconEl);
        item.appendChild(textWrap);
        item.appendChild(delBtn);
        item.onclick = (e) => {
          if (e.target.closest('.gs-item-del')) return;
          gsSetVideoInput(p.text);
          gsClosePalette();
          showToast('Pasted');
        };
        content.appendChild(item);
      });
    }

    function gsRenderPaletteSettings() {
      const content = document.getElementById('gsContent');
      if (!content) return;
      content.innerHTML = '';

      const wrap = document.createElement('div');
      wrap.className = 'gs-settings';

      // API Key
      const apiField = document.createElement('div');
      apiField.className = 'gs-field';
      const apiLabel = document.createElement('label');
      apiLabel.className = 'gs-label';
      apiLabel.textContent = 'OpenRouter API Key';
      const apiInput = document.createElement('input');
      apiInput.type = 'password';
      apiInput.className = 'gs-input';
      apiInput.placeholder = 'sk-or-...';
      apiInput.value = AI_STATE.apiKey;
      apiInput.addEventListener('change', (e) => {
        AI_STATE.apiKey = e.target.value.trim();
        GM_setValue('openrouter_api_key', AI_STATE.apiKey);
        showToast('API key saved');
      });
      apiField.appendChild(apiLabel);
      apiField.appendChild(apiInput);
      wrap.appendChild(apiField);

      // Model Grid
      const modelField = document.createElement('div');
      modelField.className = 'gs-field';
      const modelLabel = document.createElement('label');
      modelLabel.className = 'gs-label';
      modelLabel.textContent = 'Model';
      const modelGrid = document.createElement('div');
      modelGrid.className = 'gs-model-grid';
      OPENROUTER_MODELS.forEach(m => {
        const btn = document.createElement('button');
        btn.className = 'gs-model-btn' + (AI_STATE.selectedModel === m.id ? ' active' : '');
        btn.dataset.model = m.id;
        const name = document.createElement('span');
        name.className = 'gs-model-name';
        name.textContent = m.name;
        const badge = document.createElement('span');
        badge.className = `gs-model-badge ${m.badge}`;
        badge.textContent = m.badge;
        btn.appendChild(name);
        btn.appendChild(badge);
        btn.onclick = () => {
          AI_STATE.selectedModel = m.id;
          GM_setValue('openrouter_model', m.id);
          modelGrid.querySelectorAll('.gs-model-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          showToast(`Model: ${m.name}`);
          const dd = document.getElementById('gsModelSelect');
          if (dd) dd.value = m.id;
        };
        modelGrid.appendChild(btn);
      });
      modelField.appendChild(modelLabel);
      modelField.appendChild(modelGrid);
      wrap.appendChild(modelField);

      wrap.appendChild(Object.assign(document.createElement('div'), { className: 'gs-divider' }));

      // Custom Instructions
      const ciField = document.createElement('div');
      ciField.className = 'gs-field';
      const ciLabel = document.createElement('label');
      ciLabel.className = 'gs-label';
      ciLabel.textContent = 'Custom Enhancement Instructions';
      const ciTextarea = document.createElement('textarea');
      ciTextarea.className = 'gs-textarea';
      ciTextarea.placeholder = 'Add custom instructions for the AI enhancer...\n\nExamples:\n• Always include camera movement\n• Focus on lighting details';
      ciTextarea.value = AI_STATE.customInstructions;
      ciTextarea.addEventListener('input', (e) => {
        AI_STATE.customInstructions = e.target.value;
        GM_setValue('openrouter_custom_instructions', AI_STATE.customInstructions);
      });
      const ciHint = document.createElement('div');
      ciHint.className = 'gs-field-hint';
      ciHint.textContent = 'Appended to the kinematic telemetry system prompt';
      ciField.appendChild(ciLabel);
      ciField.appendChild(ciTextarea);
      ciField.appendChild(ciHint);
      wrap.appendChild(ciField);

      wrap.appendChild(Object.assign(document.createElement('div'), { className: 'gs-divider' }));

      // Auto Retry Toggle (wired to main Settings system)
      const retryField = document.createElement('div');
      retryField.className = 'gs-field';
      const retryLabel = document.createElement('label');
      retryLabel.className = 'gs-label';
      retryLabel.textContent = 'Auto Retry on Moderation';
      const retryRow = document.createElement('div');
      retryRow.className = 'gs-toggle-row';
      const toggle = document.createElement('label');
      toggle.className = 'gs-toggle';
      const toggleCb = document.createElement('input');
      toggleCb.type = 'checkbox';
      toggleCb.checked = getSettings().retryEnabled;
      const slider = document.createElement('span');
      slider.className = 'gs-toggle-slider';
      toggle.appendChild(toggleCb);
      toggle.appendChild(slider);
      const toggleLabel = document.createElement('span');
      toggleLabel.className = 'gs-toggle-label';
      toggleLabel.textContent = 'Enable auto retry';
      retryRow.appendChild(toggle);
      retryRow.appendChild(toggleLabel);
      toggleCb.addEventListener('change', (e) => {
        const s = getSettings();
        s.retryEnabled = e.target.checked;
        saveSettings(s);
        // Sync main Settings tab checkbox if open
        const mainCb = document.getElementById('grokRetryEnableToggle');
        if (mainCb) mainCb.checked = s.retryEnabled;
        showToast(s.retryEnabled ? 'Auto retry enabled' : 'Auto retry disabled');
      });
      retryField.appendChild(retryLabel);
      retryField.appendChild(retryRow);
      wrap.appendChild(retryField);

      wrap.appendChild(Object.assign(document.createElement('div'), { className: 'gs-divider' }));

      // Import / Export
      const ioField = document.createElement('div');
      ioField.className = 'gs-field';
      const ioLabel = document.createElement('label');
      ioLabel.className = 'gs-label';
      ioLabel.textContent = 'Import / Export Enhancer Prompts';
      const ioRow = document.createElement('div');
      ioRow.className = 'gs-btn-row';
      const expBtn = document.createElement('button');
      expBtn.className = 'gs-action-btn';
      expBtn.textContent = `📤 Export ${GS_ENHANCER.prompts.length} Prompts`;
      expBtn.onclick = gsExportEnhancerPrompts;
      const impBtn = document.createElement('button');
      impBtn.className = 'gs-action-btn';
      impBtn.textContent = '📥 Import';
      impBtn.onclick = gsImportEnhancerPrompts;
      ioRow.appendChild(expBtn);
      ioRow.appendChild(impBtn);
      ioField.appendChild(ioLabel);
      ioField.appendChild(ioRow);
      wrap.appendChild(ioField);

      wrap.appendChild(Object.assign(document.createElement('div'), { className: 'gs-divider' }));

      // Keyboard Shortcuts
      const kbField = document.createElement('div');
      kbField.className = 'gs-field';
      const kbLabel = document.createElement('label');
      kbLabel.className = 'gs-label';
      kbLabel.textContent = 'Keyboard Shortcuts';
      const kbList = document.createElement('div');
      kbList.className = 'gs-shortcuts';
      [['Alt', 'G', 'Open/close palette'], ['Alt', 'E', 'Enhance prompt'], ['Alt', 'S', 'Save prompt'],
       ['Ctrl', 'Z', 'Undo'], ['Ctrl', 'Y', 'Redo'], ['Esc', '', 'Close palette']
      ].forEach(([k1, k2, desc]) => {
        const row = document.createElement('div');
        row.className = 'gs-shortcut';
        const kbd1 = document.createElement('kbd');
        kbd1.textContent = k1;
        row.appendChild(kbd1);
        if (k2) {
          row.appendChild(document.createTextNode(' + '));
          const kbd2 = document.createElement('kbd');
          kbd2.textContent = k2;
          row.appendChild(kbd2);
        }
        row.appendChild(document.createTextNode(' ' + desc));
        kbList.appendChild(row);
      });
      kbField.appendChild(kbLabel);
      kbField.appendChild(kbList);
      wrap.appendChild(kbField);

      content.appendChild(wrap);
    }

    // --- Context Buttons (injected below video input) ---
    function gsCreateContextButtons() {
      const existing = document.querySelector('.gs-context');
      if (existing) existing.remove();
      const input = gsGetVideoInput();
      if (!input) return;

      let wrapper = input.closest('div[class*="flex"]') || input.parentElement;
      for (let i = 0; i < 5; i++) {
        if (wrapper.parentElement && wrapper.parentElement.querySelector('button')) { wrapper = wrapper.parentElement; break; }
        if (wrapper.parentElement) wrapper = wrapper.parentElement;
      }

      const ctx = document.createElement('div');
      ctx.className = 'gs-context';

      // Model dropdown
      const modelSelect = document.createElement('select');
      modelSelect.className = 'gs-model-dropdown';
      modelSelect.id = 'gsModelSelect';
      modelSelect.title = 'Select Model';
      OPENROUTER_MODELS.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        if (AI_STATE.selectedModel === m.id) opt.selected = true;
        modelSelect.appendChild(opt);
      });
      modelSelect.addEventListener('change', (e) => {
        AI_STATE.selectedModel = e.target.value;
        GM_setValue('openrouter_model', AI_STATE.selectedModel);
        const model = OPENROUTER_MODELS.find(m => m.id === AI_STATE.selectedModel);
        showToast(`Model: ${model ? model.name : AI_STATE.selectedModel}`);
      });
      ctx.appendChild(modelSelect);

      // Enhance button
      const enhanceBtn = document.createElement('button');
      enhanceBtn.className = 'gs-ctx-btn';
      enhanceBtn.id = 'gsEnhance';
      enhanceBtn.innerHTML = '<span>✨</span> Enhance';
      enhanceBtn.onclick = async () => {
        const text = gsGetVideoInputText();
        if (!text) { showToast('Enter a prompt first', 'error'); return; }
        if (GS_ENHANCER.isEnhancing) return;
        gsPushUndo(text);
        GS_ENHANCER.isEnhancing = true;
        enhanceBtn.classList.add('enhancing');
        enhanceBtn.innerHTML = '<span>⏳</span> Enhancing...';
        const enhanced = await enhancePromptViaOpenRouter(text);
        GS_ENHANCER.isEnhancing = false;
        enhanceBtn.classList.remove('enhancing');
        enhanceBtn.innerHTML = '<span>✨</span> Enhance';
        if (enhanced) {
          gsSetVideoInput(enhanced);
          GS_ENHANCER.lastInputValue = enhanced;
          showToast('Enhanced!');
        }
      };
      ctx.appendChild(enhanceBtn);

      // Undo
      const undoBtn = document.createElement('button');
      undoBtn.className = 'gs-ctx-btn gs-undo-redo';
      undoBtn.id = 'gsUndo';
      undoBtn.title = 'Undo (Ctrl+Z)';
      undoBtn.disabled = true;
      undoBtn.textContent = '↩';
      undoBtn.onclick = gsUndo;
      ctx.appendChild(undoBtn);

      // Redo
      const redoBtn = document.createElement('button');
      redoBtn.className = 'gs-ctx-btn gs-undo-redo';
      redoBtn.id = 'gsRedo';
      redoBtn.title = 'Redo (Ctrl+Y)';
      redoBtn.disabled = true;
      redoBtn.textContent = '↪';
      redoBtn.onclick = gsRedo;
      ctx.appendChild(redoBtn);

      // Save
      const saveBtn = document.createElement('button');
      saveBtn.className = 'gs-ctx-btn';
      saveBtn.innerHTML = '<span>💾</span> Save';
      saveBtn.onclick = () => {
        const text = gsGetVideoInputText();
        if (!text) { showToast('Enter a prompt first', 'error'); return; }
        if (GS_ENHANCER.prompts.some(p => p.text === text)) { showToast('Already saved', 'error'); return; }
        GS_ENHANCER.prompts.push({ id: Date.now().toString(), text, timestamp: Date.now() });
        gsSaveEnhancerPrompts();
        showToast('Saved!');
      };
      ctx.appendChild(saveBtn);

      // Library
      const libBtn = document.createElement('button');
      libBtn.className = 'gs-ctx-btn';
      libBtn.textContent = '📚';
      libBtn.title = 'Open Prompt Library';
      libBtn.onclick = () => gsOpenPalette();
      ctx.appendChild(libBtn);

      wrapper.appendChild(ctx);
    }

    // --- VGEN Settings Panel (injected into Settings tab) ---
    function gsInjectSettingsSections() {
      const settingsTab = document.getElementById('grokSettingsTab');
      if (!settingsTab || settingsTab.querySelector('.gs-settings-section')) return;

      // === VGEN OVERRIDES ===
      const vgenSection = document.createElement('div');
      vgenSection.className = 'gs-settings-section';

      const vgenTitle = document.createElement('div');
      vgenTitle.className = 'gs-settings-section-title';
      vgenTitle.textContent = '🎬 Video Gen Overrides';
      vgenSection.appendChild(vgenTitle);

      // Enable toggle
      const enableRow = document.createElement('div');
      enableRow.className = 'gs-settings-row';
      const enableLabel = document.createElement('span');
      enableLabel.className = 'gs-settings-label';
      enableLabel.textContent = 'Enable Interception';
      const enableCb = document.createElement('input');
      enableCb.type = 'checkbox';
      enableCb.id = 'gsVgenEnable';
      enableCb.checked = VGEN.enabled;
      enableCb.style.cssText = 'width:20px; height:20px; accent-color:#3aff9d;';
      enableCb.onchange = () => { VGEN.enabled = enableCb.checked; saveVgenSettings(); showToast(VGEN.enabled ? 'VGEN Interceptor ON' : 'VGEN Interceptor OFF'); };
      enableRow.appendChild(enableLabel);
      enableRow.appendChild(enableCb);
      vgenSection.appendChild(enableRow);

      // Aspect Ratio
      const arRow = document.createElement('div');
      arRow.className = 'gs-settings-row';
      const arLabel = document.createElement('span');
      arLabel.className = 'gs-settings-label';
      arLabel.textContent = 'Aspect Ratio';
      const arSelect = document.createElement('select');
      arSelect.className = 'gs-select';
      arSelect.id = 'gsVgenAR';
      ['Default (Unchanged)', '1:1', '16:9', '9:16', '4:3', '3:4', '2:1', '1:2'].forEach(ar => {
        const opt = document.createElement('option');
        opt.value = ar === 'Default (Unchanged)' ? '' : ar;
        opt.textContent = ar;
        if ((ar === 'Default (Unchanged)' && !VGEN.aspectRatio) || VGEN.aspectRatio === opt.value) opt.selected = true;
        arSelect.appendChild(opt);
      });
      arSelect.onchange = () => { VGEN.aspectRatio = arSelect.value; saveVgenSettings(); };
      arRow.appendChild(arLabel);
      arRow.appendChild(arSelect);
      vgenSection.appendChild(arRow);

      // Video Length
      const lenRow = document.createElement('div');
      lenRow.className = 'gs-settings-row';
      const lenLabel = document.createElement('span');
      lenLabel.className = 'gs-settings-label';
      lenLabel.textContent = 'Video Length (sec)';
      const lenInput = document.createElement('input');
      lenInput.type = 'number';
      lenInput.className = 'gs-number-input';
      lenInput.id = 'gsVgenLength';
      lenInput.min = 0; lenInput.max = 15;
      lenInput.placeholder = '0 = default';
      lenInput.value = VGEN.videoLength || '';
      lenInput.onchange = () => { VGEN.videoLength = parseInt(lenInput.value) || 0; saveVgenSettings(); };
      lenRow.appendChild(lenLabel);
      lenRow.appendChild(lenInput);
      vgenSection.appendChild(lenRow);

      // Image URL Swap
      const urlField = document.createElement('div');
      urlField.style.marginBottom = '10px';
      const urlLabel = document.createElement('div');
      urlLabel.className = 'gs-settings-label';
      urlLabel.textContent = 'Swap Source Image URL';
      urlLabel.style.marginBottom = '4px';
      const urlInput = document.createElement('textarea');
      urlInput.className = 'gs-textarea-small';
      urlInput.id = 'gsVgenImageUrl';
      urlInput.placeholder = 'Paste image URL here to swap source...';
      urlInput.rows = 2;
      urlInput.value = VGEN.swapImageUrl || '';
      urlInput.oninput = () => { VGEN.swapImageUrl = urlInput.value; saveVgenSettings(); };
      urlField.appendChild(urlLabel);
      urlField.appendChild(urlInput);
      vgenSection.appendChild(urlField);

      // Force Spicy
      const spicyRow = document.createElement('div');
      spicyRow.className = 'gs-settings-row';
      const spicyLabel = document.createElement('span');
      spicyLabel.className = 'gs-settings-label';
      spicyLabel.textContent = '🌶️ Force Spicy Mode';
      const spicyCb = document.createElement('input');
      spicyCb.type = 'checkbox';
      spicyCb.id = 'gsVgenSpicy';
      spicyCb.checked = VGEN.forceSpicy;
      spicyCb.style.cssText = 'width:20px; height:20px; accent-color:#dc2626;';
      spicyCb.onchange = () => { VGEN.forceSpicy = spicyCb.checked; saveVgenSettings(); showToast(VGEN.forceSpicy ? '🌶️ Spicy Mode ON' : 'Spicy Mode OFF'); };
      spicyRow.appendChild(spicyLabel);
      spicyRow.appendChild(spicyCb);
      vgenSection.appendChild(spicyRow);
      const spicyNote = document.createElement('div');
      spicyNote.className = 'gs-settings-sublabel';
      spicyNote.textContent = '⚠️ Forces spicy mode and removes all custom prompts from payload';
      vgenSection.appendChild(spicyNote);

      settingsTab.appendChild(vgenSection);

      // === MULTI-IMAGE QUEUE ===
      const queueSection = document.createElement('div');
      queueSection.className = 'gs-settings-section';

      const queueTitle = document.createElement('div');
      queueTitle.className = 'gs-settings-section-title';
      queueTitle.textContent = '📁 Multi-Image Queue';
      queueSection.appendChild(queueTitle);

      // File input
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.multiple = true;
      fileInput.accept = 'image/*';
      fileInput.style.cssText = 'width:100%; font-size:12px; margin-bottom:8px; color:var(--grok-text-main);';
      fileInput.onchange = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        for (const file of files) {
          try {
            const fileData = await fileToBase64(file);
            QUEUE_STATE.images.push({ id: Date.now().toString() + Math.random().toString(36).substr(2, 4), file, fileData });
          } catch (err) {
            console.error('[GrokSuite] Failed to convert:', file.name, err);
          }
        }
        gsQueueLog(`Added ${files.length} image(s) to queue`, 'success');
        gsUpdateQueueDisplay();
        e.target.value = '';
      };
      queueSection.appendChild(fileInput);

      // Kill Delay
      const delayRow = document.createElement('div');
      delayRow.style.marginBottom = '10px';
      const delayLabel = document.createElement('div');
      delayLabel.className = 'gs-settings-label';
      delayLabel.style.marginBottom = '4px';
      const delayVal = document.createElement('span');
      delayVal.id = 'gsDelayVal';
      delayVal.style.cssText = 'color:#4ade80; font-weight:bold;';
      delayVal.textContent = QUEUE_STATE.killDelay;
      delayLabel.textContent = 'Kill Delay: ';
      delayLabel.appendChild(delayVal);
      delayLabel.appendChild(document.createTextNode('ms'));
      const delaySlider = document.createElement('input');
      delaySlider.type = 'range';
      delaySlider.min = 100; delaySlider.max = 400;
      delaySlider.value = QUEUE_STATE.killDelay;
      delaySlider.style.cssText = 'width:100%; accent-color:#dc2626;';
      delaySlider.oninput = () => {
        QUEUE_STATE.killDelay = parseInt(delaySlider.value);
        delayVal.textContent = delaySlider.value;
        GM_setValue('queue_kill_delay', String(QUEUE_STATE.killDelay));
      };
      delayRow.appendChild(delayLabel);
      delayRow.appendChild(delaySlider);
      queueSection.appendChild(delayRow);

      // Queue count
      const queueCount = document.createElement('div');
      queueCount.id = 'gsQueueCount';
      queueCount.style.cssText = 'font-size:12px; color:#ccc; font-weight:600; margin-bottom:6px;';
      queueCount.textContent = 'Queue: 0 images';
      queueSection.appendChild(queueCount);

      // Queue list
      const queueList = document.createElement('div');
      queueList.id = 'gsQueueList';
      queueList.style.cssText = 'max-height:160px; overflow-y:auto; margin-bottom:8px;';
      queueSection.appendChild(queueList);

      // Control buttons
      const controls = document.createElement('div');
      controls.className = 'gs-queue-controls';
      const startBtn = document.createElement('button');
      startBtn.className = 'gs-queue-btn start';
      startBtn.id = 'gsQueueStart';
      startBtn.textContent = '▶️ Start';
      startBtn.onclick = () => {
        QUEUE_STATE.currentIndex = 0;
        QUEUE_STATE.isPaused = false;
        QUEUE_STATE.isProcessing = true;
        gsProcessQueue();
      };
      const pauseBtn = document.createElement('button');
      pauseBtn.className = 'gs-queue-btn pause';
      pauseBtn.id = 'gsQueuePause';
      pauseBtn.textContent = '⏸️ Pause';
      pauseBtn.disabled = true;
      pauseBtn.onclick = () => {
        QUEUE_STATE.isPaused = !QUEUE_STATE.isPaused;
        pauseBtn.textContent = QUEUE_STATE.isPaused ? '▶️ Resume' : '⏸️ Pause';
        gsQueueLog(QUEUE_STATE.isPaused ? 'Paused' : 'Resumed', 'warn');
        if (!QUEUE_STATE.isPaused && QUEUE_STATE.isProcessing) gsProcessQueue();
      };
      const stopBtn = document.createElement('button');
      stopBtn.className = 'gs-queue-btn stop';
      stopBtn.id = 'gsQueueStop';
      stopBtn.textContent = '⏹️ Stop';
      stopBtn.disabled = true;
      stopBtn.onclick = () => {
        QUEUE_STATE.images = [];
        QUEUE_STATE.currentIndex = 0;
        QUEUE_STATE.isProcessing = false;
        QUEUE_STATE.isPaused = false;
        gsUpdateQueueDisplay();
        gsQueueLog('Queue cleared', 'error');
      };
      controls.appendChild(startBtn);
      controls.appendChild(pauseBtn);
      controls.appendChild(stopBtn);
      queueSection.appendChild(controls);

      // Log
      const logBox = document.createElement('div');
      logBox.className = 'gs-queue-log';
      logBox.id = 'gsQueueLog';
      queueSection.appendChild(logBox);

      settingsTab.appendChild(queueSection);
    }

    function gsQueueLog(msg, type = 'info') {
      const logEl = document.getElementById('gsQueueLog');
      if (!logEl) { console.log('[GrokSuite]', msg); return; }
      const colors = { info: '#4ade80', warn: '#fbbf24', error: '#f87171', success: '#34d399', queue: '#60a5fa' };
      const line = document.createElement('div');
      line.className = 'gs-queue-log-line';
      line.style.borderLeftColor = colors[type] || colors.info;
      const time = document.createElement('span');
      time.style.color = '#666';
      time.textContent = `[${new Date().toLocaleTimeString()}] `;
      const text = document.createElement('span');
      text.style.color = colors[type] || colors.info;
      text.textContent = msg;
      line.appendChild(time);
      line.appendChild(text);
      logEl.insertBefore(line, logEl.firstChild);
      while (logEl.children.length > 50) logEl.removeChild(logEl.lastChild);
      console.log('[GrokSuite]', msg);
    }

    function gsUpdateQueueDisplay() {
      const queueList = document.getElementById('gsQueueList');
      const queueCount = document.getElementById('gsQueueCount');
      if (!queueList) return;

      if (queueCount) queueCount.textContent = `Queue: ${QUEUE_STATE.images.length} image(s) (${QUEUE_STATE.currentIndex}/${QUEUE_STATE.images.length} processed)`;

      queueList.innerHTML = '';
      QUEUE_STATE.images.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'gs-queue-item' + (idx < QUEUE_STATE.currentIndex ? ' done' : (idx === QUEUE_STATE.currentIndex && QUEUE_STATE.isProcessing ? ' active' : ''));
        const name = document.createElement('span');
        name.className = 'gs-queue-name';
        const status = idx < QUEUE_STATE.currentIndex ? '✓ ' : (idx === QUEUE_STATE.currentIndex && QUEUE_STATE.isProcessing ? '⏳ ' : '');
        name.textContent = `${status}${idx + 1}. ${item.file.name}`;
        const removeBtn = document.createElement('button');
        removeBtn.className = 'gs-queue-remove';
        removeBtn.textContent = '✕';
        removeBtn.disabled = idx < QUEUE_STATE.currentIndex || (idx === QUEUE_STATE.currentIndex && QUEUE_STATE.isProcessing);
        removeBtn.onclick = () => {
          QUEUE_STATE.images.splice(idx, 1);
          if (idx < QUEUE_STATE.currentIndex) QUEUE_STATE.currentIndex--;
          gsUpdateQueueDisplay();
        };
        row.appendChild(name);
        row.appendChild(removeBtn);
        queueList.appendChild(row);
      });

      const startBtn = document.getElementById('gsQueueStart');
      const pauseBtn = document.getElementById('gsQueuePause');
      const stopBtn = document.getElementById('gsQueueStop');
      if (startBtn) { startBtn.disabled = QUEUE_STATE.images.length === 0 || QUEUE_STATE.isProcessing; }
      if (pauseBtn) { pauseBtn.disabled = !QUEUE_STATE.isProcessing; }
      if (stopBtn) { stopBtn.disabled = QUEUE_STATE.images.length === 0; }
    }

    async function gsProcessQueue() {
      if (QUEUE_STATE.isPaused || QUEUE_STATE.images.length === 0) return;
      if (QUEUE_STATE.currentIndex >= QUEUE_STATE.images.length) {
        gsQueueLog('Queue completed!', 'success');
        QUEUE_STATE.images = [];
        QUEUE_STATE.currentIndex = 0;
        QUEUE_STATE.isProcessing = false;
        gsUpdateQueueDisplay();
        return;
      }
      const item = QUEUE_STATE.images[QUEUE_STATE.currentIndex];
      gsQueueLog(`Processing ${QUEUE_STATE.currentIndex + 1}/${QUEUE_STATE.images.length}: ${item.file.name}`, 'queue');
      gsUpdateQueueDisplay();
      const success = await executeGlitchUpload(item.file, item.fileData, QUEUE_STATE.killDelay);
      if (!success) {
        gsQueueLog(`Failed: ${item.file.name}. Skipping...`, 'error');
        QUEUE_STATE.currentIndex++;
        setTimeout(() => gsProcessQueue(), 1000);
      }
    }

    // --- Keyboard Shortcuts (Enhancer) ---
    function gsSetupKeyboardShortcuts() {
      document.addEventListener('keydown', (e) => {
        // Alt+G - Toggle palette
        if (e.altKey && e.key.toLowerCase() === 'g') {
          e.preventDefault();
          GS_ENHANCER.isPaletteOpen ? gsClosePalette() : gsOpenPalette();
          return;
        }
        // Escape - Close palette
        if (e.key === 'Escape' && GS_ENHANCER.isPaletteOpen) {
          e.preventDefault();
          gsClosePalette();
          return;
        }
        // Alt+E - Quick enhance
        if (e.altKey && e.key.toLowerCase() === 'e') {
          e.preventDefault();
          const btn = document.getElementById('gsEnhance');
          if (btn) btn.click();
          return;
        }
        // Alt+S - Quick save
        if (e.altKey && e.key.toLowerCase() === 's') {
          e.preventDefault();
          const text = gsGetVideoInputText();
          if (text && !GS_ENHANCER.prompts.some(p => p.text === text)) {
            GS_ENHANCER.prompts.push({ id: Date.now().toString(), text, timestamp: Date.now() });
            gsSaveEnhancerPrompts();
            showToast('Saved!');
          }
          return;
        }
        // Ctrl+Z - Undo (when video input focused)
        if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
          const input = gsGetVideoInput();
          if (input && document.activeElement === input && GS_ENHANCER.undoStack.length > 0) {
            e.preventDefault();
            gsUndo();
          }
        }
        // Ctrl+Y / Ctrl+Shift+Z - Redo
        if ((e.ctrlKey && e.key.toLowerCase() === 'y') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z')) {
          const input = gsGetVideoInput();
          if (input && document.activeElement === input && GS_ENHANCER.redoStack.length > 0) {
            e.preventDefault();
            gsRedo();
          }
        }
      });
    }

    // --- MutationObserver for Context Buttons ---
    function gsSetupObserver() {
      let _checkTimer = null;
      const checkAndCreate = () => {
        if (document.visibilityState === 'hidden') return;
        const input = gsGetVideoInput();
        const existing = document.querySelector('.gs-context');
        if (input) {
          if (!existing || !existing.isConnected) {
            if (existing) existing.remove();
            gsCreateContextButtons();
          }
          gsTrackInputChanges();
        } else if (existing) {
          existing.remove();
        }
      };
      const observer = new MutationObserver(() => {
        if (_checkTimer) return;
        _checkTimer = setTimeout(() => { _checkTimer = null; checkAndCreate(); }, 200);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      checkAndCreate();
    }

    // --- Master Init for Consolidated Modules ---
    function initConsolidatedModules() {
      console.log('[GrokSuite] Initializing consolidated modules...');
      gsCreatePill();
      gsSetupObserver();
      gsSetupAutoRetry();
      gsSetupKeyboardShortcuts();
      gsInjectSettingsSections();
      console.log('[GrokSuite] All modules initialized.');
    }
    function getVideoURL() {
      const v = document.querySelector("video#sd-video") || document.querySelector("video");
      if (!v) return null;
      return v.getAttribute("src");
    }

    async function captureVideoPreview(promptId) {
      const url = getVideoURL();
      if (!url) {
        showToast('No video found on page', 'error');
        return;
      }

      showToast('Downloading video locally...', 'retry');

      try {
        let blob;
        // Check if it is a local blob URL
        if (url.startsWith('blob:')) {
           const res = await fetch(url);
           blob = await res.blob();
        } else {
           // Fallback for external URLs
           blob = await new Promise((resolve, reject) => {
             GM_xmlhttpRequest({
               method: 'GET',
               url: url,
               responseType: 'blob',
               onload: (res) => {
                 if (res.response) resolve(res.response);
                 else reject(new Error('Empty response'));
               },
               onerror: reject
             });
           });
        }

        if (!blob || blob.size === 0) throw new Error("Empty blob returned");

        // Save the raw video bytes to IndexedDB permanently
        await saveVideoToDB(promptId, blob);

        // Create temporary element to generate a UI thumbnail
        const blobUrl = URL.createObjectURL(blob);
        const tempVideo = document.createElement('video');
        tempVideo.src = blobUrl;
        tempVideo.muted = true;
        tempVideo.playsInline = true;
        tempVideo.style.display = 'none';
        document.body.appendChild(tempVideo);

        tempVideo.onloadeddata = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 180;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.8);

          tempVideo.remove();
          cacheBlobUrl(promptId, blobUrl); // keep in memory for session (LRU cached)

          let prompts = getPrompts();
          const idx = prompts.findIndex(p => p.id === promptId);
          if (idx !== -1) {
            prompts[idx].videoPreview = thumbnail;
            prompts[idx].hasLocalVideo = true; // flag that we saved it
            savePrompts(prompts);
            refreshActiveTab();
            showToast('Video saved permanently offline!');
          }
        };

        tempVideo.onerror = () => {
          tempVideo.remove();
          URL.revokeObjectURL(blobUrl);
          showToast('Failed to generate video thumbnail', 'error');
        };

      } catch (err) {
        console.error(err);
        showToast('Failed to save video', 'error');
      }
    }

    async function playVideoInLightbox(promptId) {
      const lightbox = document.querySelector('.grok-lightbox');
      if (!lightbox) return;

      // Check session memory cache first
      if (capturedVideoBlobUrls[promptId]) {
        openVideoLightbox(lightbox, capturedVideoBlobUrls[promptId]);
        return;
      }

      showToast('Loading from local database...', 'retry');

      // Pull directly from IndexedDB
      const storedBlob = await getVideoFromDB(promptId);

      if (storedBlob) {
        const blobUrl = URL.createObjectURL(storedBlob);
        cacheBlobUrl(promptId, blobUrl); // Cache for current session (LRU)
        openVideoLightbox(lightbox, blobUrl);
      } else {
        // Fallback incase it wasn't saved locally or DB got cleared
        showToast('Local video missing or expired', 'error');
      }
    }

    function openVideoLightbox(lightbox, blobUrl) {
      lightbox.innerHTML = '';
      const video = document.createElement('video');
      video.src = blobUrl;
      video.autoplay = true;
      video.loop = true;
      video.controls = true;
      video.style.maxWidth = '90%';
      video.style.maxHeight = '90%';
      video.style.borderRadius = '10px';
      video.style.cursor = 'default';
      video.onclick = (e) => e.stopPropagation();
      lightbox.appendChild(video);
      lightbox.style.display = 'flex';
      lightbox.style.cursor = 'zoom-out';
      lightbox.offsetHeight;
      lightbox.classList.add('open');
      lightbox.onclick = (e) => {
        if (e.target === lightbox) {
          video.pause();
          lightbox.classList.remove('open');
          lightbox.style.display = 'none';
          lightbox.innerHTML = '<img src="" id="grokLightboxImg">';
          lightbox.onclick = () => { lightbox.classList.remove('open'); setTimeout(()=>lightbox.style.display='none', 200); };
        }
      };
    }

    function downloadCurrentVideo() {
      const url = getVideoURL();
      if (!url) {
        showToast('No video found on page', 'error');
        return;
      }

      showToast('Downloading video…', 'retry');

      // Native fetch approach with error handling
      if (url.startsWith('blob:')) {
        fetch(url).then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.blob();
        }).then(blob => {
          triggerDownload(blob);
        }).catch((err) => { console.error('[GrokSuite] Blob fetch failed:', err); fallbackDownload(url); });
      } else {
        GM_xmlhttpRequest({
          method: 'GET', url: url, responseType: 'blob',
          onload: function(res) {
            if (!res.response || res.response.size === 0) return fallbackDownload(url);
            triggerDownload(res.response);
          },
          onerror: function() { fallbackDownload(url); }
        });
      }

      function triggerDownload(blob) {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = 'grok-video-' + Date.now() + '.mp4';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        showToast('Video downloaded!');
      }

      function fallbackDownload(fallbackUrl) {
        const a = document.createElement('a');
        a.href = fallbackUrl;
        a.download = 'grok-video-' + Date.now() + '.mp4';
        a.target = '_blank';
        a.click();
        showToast('Download started (fallback)');
      }
    }

    // ============================
    // Shared selectors + helpers
    // ============================
    const SP = {
      // New Tiptap Editor
      TIPTAP_EDITOR: '.tiptap.ProseMirror',

      // Buttons / Indicators
      BTN_MAKE_VIDEO: 'button[aria-label="Make video"]',
      BTN_ADD_IMAGES: 'button[aria-label="Add more images"]',
      BTN_SETTINGS: 'button[aria-label="Settings"]',
      BTN_SUBMIT: 'button[aria-label="Submit"]',
      BTN_IMAGE_GENERATE: 'button[aria-label="Generate"]',

      // Old Selectors (Fallback)
      VIDEO_TEXTAREA: 'textarea[aria-label="Make a video"]',
      IMAGE_EDITOR_TEXTAREA: 'textarea[aria-label="Type to edit image..."]',
      IMAGE_PROMPT_TEXTAREA: 'textarea[aria-label="Image prompt"]',
    };

    function findByXPath(xpath) {
      try { return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue; }
      catch { return null; }
    }

    function isElementVisible(el) {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }

    function getMakeVideoButtonsVisible() {
      return Array.from(document.querySelectorAll(SP.BTN_MAKE_VIDEO)).filter(isElementVisible);
    }

    function isUpArrowSubmitButton(btn) {
      return !!btn?.querySelector('path[d^="M5 11L12 4"]');
    }

    function getLargestByArea(buttons) {
      let best = null, bestArea = -1;
      for (const b of buttons) { const r = b.getBoundingClientRect(); const area = r.width * r.height; if (area > bestArea) { bestArea = area; best = b; } }
      return best;
    }

    function getGrokInputEl() {
      // If we are in edit mode, prioritize the edit textarea
      const editArea = document.querySelector(SP.IMAGE_EDITOR_TEXTAREA);
      if (editArea && editArea.offsetWidth > 0) return editArea;

      // Prioritize the new TipTap editor
      const tipTap = document.querySelector(SP.TIPTAP_EDITOR);
      if (tipTap && tipTap.offsetWidth > 0) return tipTap;

      // Fallback to old textareas
      return document.querySelector(SP.VIDEO_TEXTAREA) || document.querySelector(SP.IMAGE_PROMPT_TEXTAREA) || editArea;
    }

    function getInputText(el) {
      if (!el) return '';
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el.value || '';
      return el.textContent || '';
    }

    // UPDATED: Set input value and ensure smooth scroll/focus behavior
    function setInputValue(el, value) {
      if (!el) return;
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
          setter.call(el, value);
      } else {
          // TipTap / ContentEditable
          el.textContent = value;
          // Trigger TipTap updates often requires a specific event sequence or focus.
          // Using preventScroll so the side panel user isn't dragged around.
          el.focus({ preventScroll: true });
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function detectContextType() {
      // Explicit UI Indicators for Image Edit
      if (document.querySelector('textarea[aria-label="Type to edit image..."]')) return 'edited_image';

      // Explicit UI Indicators for Video/Edit button
      const makeVidBtns = document.querySelectorAll('button[aria-label="Make video"]');
      if (makeVidBtns.length > 0) {
        for (const btn of makeVidBtns) {
           if (btn.textContent.includes('Edit')) return 'edited_image';
        }
        return 'video';
      }

      // Explicit UI Indicators for Image
      if (document.querySelector('[data-placeholder="Type to imagine"]')) return 'image';

      // Check for the "Image" setting text inside the query bar
      const spans = document.querySelectorAll('span.text-sm.font-medium');
      for (const span of spans) {
        if (span.textContent.trim() === 'Image') return 'image';
      }

      if (document.querySelector('button[aria-label="Add more images"]')) return 'image';

      // Look for Image SVG path in Settings
      const imageSvg = document.querySelector('svg path[d*="M14.0996 2.5C15.2032"]');
      if (imageSvg) return 'image';

      // If we see the general 'Submit' without 'Make video', assume image/text
      if (document.querySelector('button[aria-label="Submit"]')) return 'image';

      // Default fallback
      return 'image';
    }

    // --- MODERATION DETECTION ---
    const MODERATION_TEXT_EXACT = "Content Moderated. Try a different idea.";
    const MODERATION_PATTERNS =[
      "content moderated", "try a different idea", "moderated",
      "content policy", "cannot generate", "unable to generate"
    ];
    let lastModerationScanTs = 0;

    function findModerationSignal() {
      const toastRoot =
        document.querySelector('section[aria-label="Notifications alt+T"]') ||
        document.querySelector('section[aria-label*="Notification"]') ||
        document.querySelector('[role="alert"]');
      if (toastRoot) {
        const txt = (toastRoot.textContent || "").toLowerCase();
        if (MODERATION_PATTERNS.some(p => txt.includes(p))) return true;
      }
      const main = document.querySelector('main') || document.body;
      const spans = main.querySelectorAll('span');
      const cap = Math.min(spans.length, 600);
      for (let i = 0; i < cap; i++) {
        if ((spans[i].textContent || "").trim() === MODERATION_TEXT_EXACT) return true;
      }
      return false;
    }

    function checkForModeration() {
      const s = getSettings();
      const now = Date.now();
      if (now - lastModerationScanTs < 350) return;
      lastModerationScanTs = now;
      if (!s.retryEnabled && !s.useAutoStats) return;
      const hasModeration = findModerationSignal();
      if (!hasModeration) return;

      if (s.retryEnabled) {
        let btn = null;
        const type = detectContextType();
        if (type === 'video') {
            btn = Array.from(document.querySelectorAll(SP.BTN_MAKE_VIDEO)).find(b => !b.textContent.includes('Edit')) || document.querySelector(SP.BTN_MAKE_VIDEO);
        } else if (type === 'edited_image') {
            btn = Array.from(document.querySelectorAll(SP.BTN_MAKE_VIDEO)).find(b => b.textContent.includes('Edit'));
            if (!btn) btn = document.querySelector(SP.BTN_SUBMIT) || document.querySelector(SP.BTN_IMAGE_GENERATE);
        } else {
            btn = document.querySelector(SP.BTN_SUBMIT) || document.querySelector(SP.BTN_IMAGE_GENERATE);
        }

        const inputEl = getGrokInputEl();

        if (btn && inputEl && retryCount < s.maxRetries && (now - lastRetryTime > 3000)) {
          if (currentVideoInputText && type === 'video') {
             setInputValue(inputEl, currentVideoInputText);
          }
          setTimeout(() => {
            isAutoRetryClick = true;
            btn.click();
            setTimeout(() => { isAutoRetryClick = false; }, 5000);
          }, 800);
          retryCount++;
          lastRetryTime = now;
          updateRetryStatus();
          showToast(`Auto-Retry ${retryCount}/${s.maxRetries}`, 'retry');
        }
      }

      if (!s.useAutoStats) return;
      if (!lastActivePromptId) return;
      if (now < moderationLockUntil) return;

      let prompts = getPrompts();
      const pIndex = prompts.findIndex(x => x.id === lastActivePromptId);
      if (pIndex !== -1) {
        prompts[pIndex] = migratePrompt(prompts[pIndex]);
        prompts[pIndex].stats.moderated++;
        savePrompts(prompts);
        lastActivePromptId = null;
        if (isOpen) refreshActiveTab();
      }
      moderationLockUntil = Date.now() + 8000;
    }

    function getContextImageAlt() {
      let img = document.querySelector('img.col-start-1.row-start-1.object-cover');
      if (!img) img = document.querySelector('img.object-cover.invisible.pointer-events-none');
      if (!img) {
        const candidates = document.querySelectorAll('img.object-cover');
        for (let i of candidates) {
          if (i.alt && i.alt.length > 15) { img = i; break; }
        }
      }
      return (img && img.alt && img.alt.length > 0) ? img.alt : '';
    }

    function setupAutoTracker() {
      let isGenerationActive = false;
      let lastCaptureTime = 0;

      const capture = (specificText = null, specificType = null) => {
        const now = Date.now();
        if (now - lastCaptureTime < 3000) return;
        if (isGenerationActive && !specificText) return;

        let text = specificText || '';
        let sourceType = specificType || 'Image';

        if (!text) {
          const inputEl = getGrokInputEl();
          if (inputEl) {
             text = getInputText(inputEl).trim();
             const context = detectContextType();
             sourceType = context === 'video' ? 'Video' : (context === 'edited_image' ? 'Edited Image' : 'Image');
          }
        }

        if (!text || text.length < 2) return;
        lastCaptureTime = now;
        if (sourceType === 'Video') isGenerationActive = true;

        let attachedImageAlt = getContextImageAlt();
        if (sourceType === 'Image') attachedImageAlt = '';

        let prompts = getPrompts();
        let existingIndex = prompts.findIndex(p => {
          return (p.text || '').trim() === text.trim() && p.sourceType === sourceType;
        });

        let promptId;
        if (existingIndex !== -1) {
          prompts[existingIndex] = migratePrompt(prompts[existingIndex]);
          prompts[existingIndex].timestamp = Date.now();
          prompts[existingIndex].stats.attempts++;
          if(attachedImageAlt) prompts[existingIndex].attachedAlt = attachedImageAlt;
          promptId = prompts[existingIndex].id;
        } else {
          if (!getSettings().autoTrack) return;
          promptId = 'auto_' + Date.now().toString();
          prompts.push({
            id: promptId, text, rating: 0, category: 'Auto-History',
            sourceType, attachedAlt: attachedImageAlt, timestamp: Date.now(),
            stats: { attempts: 1, moderated: 0 }, moderation: 0
          });
          const msg = attachedImageAlt ? `Auto-Captured (${sourceType} + Source)` : `Auto-Captured (${sourceType})`;
          if (!getSettings().silentMode) showToast(msg);
        }

        savePrompts(prompts);
        lastActivePromptId = promptId;
        if (!isAutoRetryClick) { retryCount = 0; updateRetryStatus(); }

        if (isOpen && document.querySelector('.grok-prompt-tab.active[data-tab="recent"]')) {
          renderPromptsList('grokRecentTab', p => p.category === 'Auto-History', (a,b) => b.timestamp - a.timestamp);
        }
      };

      const detectGenerationProgress = () => {
        const progressEl = document.querySelector('.text-xs.font-semibold.w-\\[4ch\\].mb-\\[1px\\].tabular-nums');
        if (progressEl) {
          const txt = progressEl.textContent.trim();
          if (txt.includes('%')) {
            const val = parseInt(txt);
            if (!isNaN(val) && val >= 5 && val < 100) {
              if (!isGenerationActive) capture(null, 'Video');
            }
          }
        } else {
          if (isGenerationActive) isGenerationActive = false;
        }
      };

      let mainObsThrottle = false;
      let lastLoopEnforceTs = 0;
      let lastProgressScanTs = 0;

      const observer = new MutationObserver(() => {
        if (document.visibilityState === 'hidden') return;
        if (mainObsThrottle) return;
        mainObsThrottle = true;
        setTimeout(() => { mainObsThrottle = false; }, 250);
        try { checkForModeration(); } catch (e) { console.error('[GrokSuite] checkForModeration', e); }
        const now = Date.now();
        if (now - lastLoopEnforceTs > 1500) { lastLoopEnforceTs = now; try { enforceVideoLoopState(); } catch (e) {} }
        if (now - lastProgressScanTs > 400) { lastProgressScanTs = now; try { detectGenerationProgress(); } catch (e) {} }
      });

      observer.observe(document.body, { childList: true, subtree: true });
      window.addEventListener('beforeunload', () => observer.disconnect());

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            const inputEl = getGrokInputEl();
            if (e.target === inputEl || e.target.closest(SP.TIPTAP_EDITOR)) {
                const context = detectContextType();
                const type = context === 'video' ? 'Video' : (context === 'edited_image' ? 'Edited Image' : 'Image');
                capture(getInputText(inputEl).trim(), type);
            }
        }
      }, true);

      document.addEventListener('mousedown', (e) => {
        if (isAutoRetryClick) return;
        const submitBtn = e.target.closest('button[aria-label="Submit"]') || e.target.closest(SP.BTN_MAKE_VIDEO) || e.target.closest('button:has(span:contains("Edit"))');
        if (submitBtn) {
          const inputEl = getGrokInputEl();
          if (inputEl && getInputText(inputEl).trim().length > 0) {
             const context = detectContextType();
             const type = context === 'video' ? 'Video' : (context === 'edited_image' ? 'Edited Image' : 'Image');
             capture(getInputText(inputEl).trim(), type);
          }
        }
      }, true);

      document.addEventListener('input', (e) => {
        if (e.target.matches && (e.target.matches(SP.TIPTAP_EDITOR) || e.target.closest(SP.TIPTAP_EDITOR))) {
          const val = getInputText(e.target);
          if (val && val.trim().length > 0 && detectContextType() === 'video') {
             currentVideoInputText = val;
          }
        }
      }, true);

      // Listener for external components (like the Side Panel generation) to trigger Auto-Tracker captures
      // safely without needing a native mousedown proxy
      window.addEventListener('grokCaptureManual', (e) => {
        if (e.detail && e.detail.text && e.detail.type) {
           capture(e.detail.text, e.detail.type);
        }
      });
    }

    // --- UI CREATION ---
    function createUI() {
      document.querySelector('.grok-prompt-overlay')?.remove();
      document.querySelector('.grok-lightbox')?.remove();

      const lightbox = document.createElement('div');
      lightbox.className = 'grok-lightbox';
      lightbox.innerHTML = '<img src="" id="grokLightboxImg">';
      lightbox.onclick = () => { lightbox.classList.remove('open'); setTimeout(()=>lightbox.style.display='none', 200); };
      document.body.appendChild(lightbox);

      const overlay = document.createElement('div');
      overlay.setAttribute('data-darkreader-ignore', 'true');
      const s = getSettings();
      overlay.className = `grok-prompt-overlay ${s.floatingMode ? 'mode-floating' : 'mode-centered'}`;
      overlay.onclick = (e) => {
        if(!getSettings().floatingMode && e.target === overlay) document.getElementById('grokCloseBtn').click();
      };

      const modal = document.createElement('div');
      modal.className = 'grok-prompt-modal';
      modal.setAttribute('data-darkreader-ignore', 'true');
      modalElement = modal;

      const kbString = getKeybindString(s.keybind);
      const sideKbString = getKeybindString(s.sidePanelKeybind || { key: 'k', altKey: true, ctrlKey: false, shiftKey: false, metaKey: false });

      if (s.floatingMode) {
        const sidekickDefaults = JSON.parse(GM_getValue('grok_sidekick_defaults', 'null'));
        const sidekickPos = GM_getValue('grok_modal_pos_sidekick', null);
        if (sidekickPos) { modal.style.top = sidekickPos.top; modal.style.left = sidekickPos.left; modal.style.width = sidekickPos.width; modal.style.height = sidekickPos.height; }
        else if (sidekickDefaults) { modal.style.top = sidekickDefaults.top; modal.style.left = sidekickDefaults.left; modal.style.width = sidekickDefaults.width; modal.style.height = sidekickDefaults.height; }
        else { modal.style.top = '130px'; modal.style.left = Math.max(0, window.innerWidth - 585) + 'px'; modal.style.width = '565px'; modal.style.height = '745px'; }
      } else {
        const stdDefaults = JSON.parse(GM_getValue('grok_custom_defaults', 'null'));
        const stdPos = GM_getValue('grok_modal_pos_std', null);
        modal.style.position = 'absolute'; modal.style.margin = '0';
        if (stdPos) { modal.style.top = stdPos.top; modal.style.left = stdPos.left; modal.style.width = stdPos.width; modal.style.height = stdPos.height; }
        else if (stdDefaults) { modal.style.top = stdDefaults.top; modal.style.left = stdDefaults.left; modal.style.width = stdDefaults.width; modal.style.height = stdDefaults.height; }
        else { modal.style.width = '1463px'; modal.style.height = '809px'; }
      }

      modal.innerHTML = `
        <div class="grok-prompt-header" id="grokDragHandle">
          <div class="grok-prompt-title">
            <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24" style="color: var(--grok-primary);"><path d="M2 21L23 12L2 3V10L17 12L2 14V21Z"/></svg>
            <span>Grok Manager Ultimate</span>
          </div>
          <div class="grok-header-actions">
            <button class="grok-icon-btn" id="grokResetSizeBtn" title="Reset to Your Default">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/></svg>
            </button>
            <button class="grok-icon-btn close" id="grokCloseBtn" title="Close (Esc)">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div class="grok-prompt-tabs">
          <button class="grok-prompt-tab active" data-tab="generate">New</button>
          <button class="grok-prompt-tab" data-tab="recent">History</button>
          <button class="grok-prompt-tab" data-tab="saved">Video</button>
          <button class="grok-prompt-tab" data-tab="quick">Images</button>
          <button class="grok-prompt-tab" data-tab="edited">Edited</button>
          <button class="grok-prompt-tab" data-tab="categories">Tags</button>
          <button class="grok-prompt-tab" data-tab="settings">Settings</button>
        </div>

        <div class="grok-prompt-content">
          <div id="grokGenerateTab" class="grok-prompt-form">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <label class="grok-prompt-label" style="margin-bottom:0;">Category</label>
                <button id="grokToggleQuickAdd" style="background:none; border:none; color:var(--grok-primary); font-size:11px; font-weight:700; cursor:pointer;">+ Create New</button>
              </div>
              <select class="grok-prompt-select" id="grokCategorySelect"></select>
              <div id="grokQuickAddArea" style="display:none; margin-top:10px; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;">
                <input type="text" id="grokQuickAddInput" class="grok-prompt-category-input" placeholder="New Tag Name..." style="margin-bottom:8px;">
                <div style="display:flex; gap:8px;">
                  <button id="grokQuickAddVidBtn" class="grok-prompt-copy-btn" style="flex:1; justify-content:center;">Video Tag</button>
                  <button id="grokQuickAddImgBtn" class="grok-prompt-copy-btn" style="flex:1; justify-content:center;">Image Tag</button>
                </div>
              </div>
            </div>
            <div>
              <label class="grok-prompt-label">Your Prompt</label>
              <textarea class="grok-prompt-textarea" id="grokPromptInput" placeholder="What do you want to see?"></textarea>
            </div>
            <div class="grok-form-actions">
              <button class="grok-prompt-button" id="grokSaveBtn">Save Prompt</button>
              <button class="grok-cancel-btn" id="grokCancelEditBtn">Cancel Edit</button>
            </div>
          </div>

          <div id="grokRecentTab" class="grok-prompt-list" style="display: none;"></div>
          <div id="grokSavedTab" class="grok-prompt-list" style="display: none;"></div>
          <div id="grokQuickTab" class="grok-prompt-list" style="display: none;"></div>
          <div id="grokEditedTab" class="grok-prompt-list" style="display: none;"></div>

          <div id="grokCategoriesTab" style="display: none; flex-direction: column; gap: 20px;">
            <div class="grok-split-view">
              <div class="grok-tag-section">
                <div class="grok-tag-header">Video / General Tags</div>
                <div style="display:flex; gap:10px; margin-bottom:12px;">
                  <input type="text" class="grok-prompt-category-input" id="grokNewVideoCat" placeholder="e.g. Sci-Fi...">
                  <button class="grok-prompt-add-btn" id="grokAddVideoCatBtn">Add</button>
                </div>
                <div class="grok-prompt-category-list" id="grokVideoCatList"></div>
              </div>
              <div class="grok-tag-section">
                <div class="grok-tag-header">Image Tags</div>
                <div style="display:flex; gap:10px; margin-bottom:12px;">
                  <input type="text" class="grok-prompt-category-input" id="grokNewImageCat" placeholder="e.g. Portraits...">
                  <button class="grok-prompt-add-btn" id="grokAddImageCatBtn">Add</button>
                </div>
                <div class="grok-prompt-category-list" id="grokImageCatList"></div>
              </div>
            </div>
          </div>

          <div id="grokSettingsTab" style="display: none;">
            <label class="grok-prompt-label">Video Auto-Retry (Main Window)</label>
            <div class="grok-checkbox-wrapper">
              <input type="checkbox" id="grokRetryEnableToggle" class="grok-checkbox">
              <div>
                <div style="font-weight:600; color:var(--grok-text-main);">Enable Auto-Retry on Moderation</div>
                <div style="font-size:12px; color:var(--grok-text-muted);">Automatically clicks "Make video" if content is moderated.</div>
              </div>
            </div>
            <div class="grok-info-box" style="flex-direction:row; align-items:center; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:12px; font-weight:600;">Max Retries:</span>
                <input type="number" id="grokMaxRetryInput" class="grok-num-input" value="${s.maxRetries}" min="1" max="50">
              </div>
              <div style="font-size:12px; color:var(--grok-text-muted); font-weight:600;">Status:
                <span id="grokRetryStatus" style="color:var(--grok-primary);">${retryCount}/${s.maxRetries}</span>
              </div>
              <button id="grokRetryResetBtn" class="grok-keybind-btn">Reset Count</button>
            </div>

            <label class="grok-prompt-label">Start Up</label>
            <div class="grok-checkbox-wrapper">
              <input type="checkbox" id="grokAutoOpenToggle" class="grok-checkbox">
              <div>
                <div style="font-weight:600; color:var(--grok-text-main);">Auto-Open on Load</div>
                <div style="font-size:12px; color:var(--grok-text-muted);">Open this menu automatically when visiting Grok.</div>
              </div>
            </div>

            <label class="grok-prompt-label">Tracking Mode</label>
            <div class="grok-checkbox-wrapper">
              <input type="checkbox" id="grokAutoStatsToggle" class="grok-checkbox">
              <div>
                <div style="font-weight:600; color:var(--grok-text-main);">Enable Auto-Stats & Detection (Video)</div>
                <div style="font-size:12px; color:var(--grok-text-muted);"><strong>ON:</strong> Auto-detects moderation for videos.</div>
              </div>
            </div>

            <label class="grok-prompt-label">Video Playback</label>
            <div class="grok-checkbox-wrapper">
              <input type="checkbox" id="grokVideoLoopToggle" class="grok-checkbox">
              <div>
                <div style="font-weight:600; color:var(--grok-text-main);">Disable Video Looping</div>
                <div style="font-size:12px; color:var(--grok-text-muted);">Prevent videos from replaying. (Shortcut: Alt+L)</div>
              </div>
            </div>
            <div class="grok-checkbox-wrapper" style="margin-left: 20px; border-left: 2px solid var(--grok-border); padding-left: 10px; margin-top: -10px;">
              <input type="checkbox" id="grokHideControlsToggle" class="grok-checkbox">
              <div>
                <div style="font-weight:600; color:var(--grok-text-main);">Hide Overlay Controls</div>
                <div style="font-size:12px; color:var(--grok-text-muted);">Hides mute, more options, and format toggles on videos.</div>
              </div>
            </div>

            <label class="grok-prompt-label">View Mode</label>
            <div class="grok-checkbox-wrapper">
              <input type="checkbox" id="grokFloatingModeToggle" class="grok-checkbox">
              <div>
                <div style="font-weight:600; color:var(--grok-text-main);">Floating Sidekick Mode</div>
                <div style="font-size:12px; color:var(--grok-text-muted);">Floating window that stays open.</div>
              </div>
            </div>
            <div class="grok-checkbox-wrapper">
              <input type="checkbox" id="grokShowPreviewsToggle" class="grok-checkbox">
              <div>
                <div style="font-weight:600; color:var(--grok-text-main);">Show Media Thumbnails</div>
                <div style="font-size:12px; color:var(--grok-text-muted);">Show image and video thumbnails in the lists.</div>
              </div>
            </div>

            <label class="grok-prompt-label">Data & History</label>
            <div class="grok-checkbox-wrapper">
              <input type="checkbox" id="grokShowSourceImageToggle" class="grok-checkbox">
              <div>
                <div style="font-weight:600; color:var(--grok-text-main);">Show Source Image UUID</div>
                <div style="font-size:12px; color:var(--grok-text-muted);">Displays the "Source Image: [UUID]" in history for older tracking formats.</div>
              </div>
            </div>

            <label class="grok-prompt-label">External Tools</label>
            <div class="grok-info-box">
              <div style="display:flex; gap:10px; width:100%; align-items: center;">
                <div style="flex:1;">
                  <div style="font-weight:600; font-size:13px; color:var(--grok-text-main);">Side Panel (Snippets/Retry)</div>
                  <div style="font-size:11px; color:var(--grok-text-muted);">Open the mini-tool panel.</div>
                </div>
                <button id="grokOpenSidePanelBtn" class="grok-keybind-btn">Toggle Panel</button>
              </div>
            </div>

            <label class="grok-prompt-label">Window Preferences</label>
            <div class="grok-info-box">
              <div style="display:flex; gap:10px; width:100%;">
                <button id="grokSetDefaultBtn" class="grok-keybind-btn" style="flex:1; background:rgba(29, 155, 240, 0.15); border-color:rgba(29, 155, 240, 0.3);">
                  ${s.floatingMode ? 'Set Sidekick Default' : 'Set Standard Default'}
                </button>
                <button id="grokFactoryResetBtn" class="grok-keybind-btn" style="background:transparent; color:var(--grok-text-muted);" title="Restore Factory Settings">Reset</button>
              </div>
            </div>

            <label class="grok-prompt-label">Shortcuts</label>
            <div class="grok-keybind-wrapper" style="flex-direction:column; align-items:stretch; gap:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:12px; color:#ccc;">Main Window:</span>
                <div style="display:flex; gap:10px;">
                  <div class="grok-keybind-display" id="grokKeybindDisplay">${kbString}</div>
                  <button class="grok-keybind-btn" id="grokKeybindBtn">Change</button>
                </div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:12px; color:#ccc;">Side Panel Toggle:</span>
                <div style="display:flex; gap:10px;">
                  <div class="grok-keybind-display" id="grokSideKeybindDisplay">${sideKbString}</div>
                  <button class="grok-keybind-btn" id="grokSideKeybindBtn">Change</button>
                </div>
              </div>
            </div>

            <label class="grok-prompt-label">Automation</label>
            <div class="grok-checkbox-wrapper">
              <input type="checkbox" id="grokAutoTrackToggle" class="grok-checkbox">
              <div>
                <div style="font-weight:600; color:var(--grok-text-main);">Auto-Capture Prompts</div>
                <div style="font-size:12px; color:var(--grok-text-muted);">Save prompts from inputs automatically.</div>
              </div>
            </div>
            <div class="grok-checkbox-wrapper">
              <input type="checkbox" id="grokSilentModeToggle" class="grok-checkbox">
              <div>
                <div style="font-weight:600; color:var(--grok-text-main);">Silent Mode</div>
                <div style="font-size:12px; color:var(--grok-text-muted);">Disable save notifications.</div>
              </div>
            </div>

            <label class="grok-prompt-label">Data</label>
            <div style="display:flex; gap:10px; align-items:center;">
              <button class="grok-prompt-copy-btn" id="grokExportBtn">Export</button>
              <button class="grok-prompt-copy-btn" id="grokImportBtn">Import</button>
              <input type="file" id="grokImportFile" style="display:none" accept=".json">
              <button class="grok-prompt-copy-btn" id="grokClearBtn" style="color:var(--grok-danger); border-color:var(--grok-danger); margin-left:auto;">Reset Data</button>
            </div>
          </div>
        </div>
        <div class="grok-prompt-resize-handle" id="grokResizeHandle" title="Drag to Resize"></div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      return overlay;
    }

    // ========== RENDER FUNCTIONS ==========

    function generatePromptHTML(p, renderMode, settings) {
      p = migratePrompt(p);
      const useAutoStats = settings.useAutoStats;
      const isAuto = p.category === 'Auto-History' || (p.id || '').startsWith('auto_');
      const videoPromptValue = p.videoPrompt || '';
      let badgeLabel = isAuto ? (p.sourceType || 'Auto-History') : p.category;
      const cats = getCategories();
      const catObj = cats.find(c => c.name === p.category);
      const isImageCat = catObj && catObj.type === 'image';
      const isHistoryMode = renderMode === 'history';
      const isSelected = isHistoryMode && selectedPromptIds.has(p.id) ? 'checked' : '';
      let snapshotHtml = '';
      let videoInputHtml = '';
      const dateString = new Date(p.timestamp).toLocaleString();

      const isVideoType = renderMode === 'video'
        || (renderMode === 'history' && p.sourceType === 'Video')
        || (renderMode === 'history' && !isImageCat && p.sourceType !== 'Image' && p.sourceType !== 'Edited Image');

      // IMAGE snapshot
      if (renderMode === 'image' || renderMode === 'edited') {
        snapshotHtml = p.snapshot
          ? `<div class="grok-snapshot-wrapper"><img src="${p.snapshot}" class="grok-snapshot-thumb" data-src="${p.snapshot}" title="Click to Zoom"><button class="grok-snapshot-del" data-id="${p.id}" title="Remove Snapshot">&times;</button></div>`
          : `<label class="grok-snapshot-upload-btn">+ Snapshot<input type="file" class="grok-snapshot-input" data-id="${p.id}" accept="image/jpeg, image/png, image/webp"></label>`;
      }

      // VIDEO preview thumbnail
      if (renderMode === 'video') {
        snapshotHtml = p.videoPreview
          ? `<div class="grok-snapshot-wrapper">
               <img src="${p.videoPreview}" class="grok-snapshot-thumb grok-video-play-thumb" data-prompt-id="${p.id}" title="Click to Play Video" style="border-color:var(--grok-warning); cursor:pointer;">
               <span class="grok-preview-badge">▶ VIDEO</span>
               <button class="grok-preview-del" data-id="${p.id}" title="Remove Preview">&times;</button>
             </div>`
          : `<div class="grok-snapshot-upload-btn grok-capture-preview-trigger" data-id="${p.id}" title="Capture current video as preview">
               <span style="font-size:20px;">📹</span>
               <span>Capture</span>
             </div>`;
      }

      // History items with existing preview
      if (renderMode === 'history' && p.videoPreview) {
        snapshotHtml = `<div class="grok-snapshot-wrapper">
          <img src="${p.videoPreview}" class="grok-snapshot-thumb grok-video-play-thumb" data-prompt-id="${p.id}" title="Click to Play Video" style="border-color:var(--grok-warning); cursor:pointer;">
          <span class="grok-preview-badge">▶ VIDEO</span>
          <button class="grok-preview-del" data-id="${p.id}" title="Remove Preview">&times;</button>
        </div>`;
      }

      if (renderMode === 'video') {
        videoInputHtml = `<div class="grok-video-section"><label class="grok-video-label">Video Prompt</label><textarea class="grok-video-input" data-id="${p.id}" placeholder="Add video description...">${videoPromptValue}</textarea></div>`;
      }

      const showPreviewCol = (renderMode === 'image' || renderMode === 'edited' || renderMode === 'video' || !!p.videoPreview) && settings.showMediaPreviews;
      const previewCol = showPreviewCol ? `<div class="grok-image-preview-col">${snapshotHtml}</div>` : '';

      let statsHtml = '';
      const isImagePrompt = renderMode === 'image' || renderMode === 'edited' || p.sourceType === 'Image' || p.sourceType === 'Edited Image' || isImageCat;
      if (useAutoStats && !isImagePrompt) {
        const attempts = p.stats.attempts || 0;
        const mods = p.stats.moderated || 0;
        const successCount = Math.max(0, attempts - mods);
        let rate = 0;
        if (attempts > 0) rate = Math.round((successCount / attempts) * 100);
        let pillClass = rate === 100 ? 'success' : (rate < 50 ? 'fail' : '');
        let barColor = 'var(--grok-success)';
        if (rate < 50) barColor = 'var(--grok-danger)'; else if (rate < 80) barColor = 'var(--grok-warning)';
        statsHtml = `
          <div class="grok-stats-bar-container">
            <div class="grok-stats-pill ${pillClass}">${rate}% Success</div>
            <div class="grok-success-rate-bar"><div class="grok-success-rate-fill" style="width: ${rate}%; background: ${barColor};"></div></div>
            <div class="grok-stats-text">${successCount} Success / ${mods} Moderated</div>
          </div>`;
      } else {
        const modVal = p.moderation || 0;
        const modClass = modVal < 40 ? 'low' : (modVal < 80 ? 'med' : 'high');
        if (!isAuto || isImagePrompt) {
          statsHtml = `<div class="grok-mod-wrapper"><label class="grok-mod-label">Mod Pass:</label><input type="range" min="0" max="100" value="${modVal}" class="grok-mod-slider" data-id="${p.id}"><span class="grok-mod-val ${modClass}">${modVal}%</span></div>`;
        }
      }

      let sourceImageHtml = '';
      if (settings.showSourceImage && p.attachedAlt && p.sourceType !== 'Image' && p.sourceType !== 'Edited Image' && !isImageCat) {
        sourceImageHtml = `<div class="grok-prompt-source-alt"><strong>Source Image:</strong> ${_esc(p.attachedAlt)}</div>`;
      }

      const tagClass = (isImageCat || p.sourceType === 'Image') ? 'image-tag' : (p.sourceType === 'Edited Image' ? 'edit-tag' : '');

      return `
        <div class="grok-prompt-item">
          ${isHistoryMode ? `<div class="grok-item-check-wrapper"><input type="checkbox" class="grok-item-checkbox grok-select-item" data-id="${p.id}" ${isSelected}></div>` : ''}
          <div class="grok-item-content-wrapper">
            <div class="grok-image-item-grid">
              <div class="grok-image-content-col">
                <div class="grok-prompt-item-header">
                  <div class="grok-prompt-item-text">${_esc(p.text)}</div>
                  <button class="grok-prompt-item-delete" data-id="${p.id}" title="Delete">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
                ${sourceImageHtml}
                ${videoInputHtml}
              </div>
              ${previewCol}
            </div>
            <div class="grok-prompt-item-footer">
              <span class="grok-prompt-category-badge ${isAuto ? 'auto' : ''} ${tagClass}">${badgeLabel}</span>
              ${statsHtml}
              <button class="grok-prompt-copy-btn" data-text="${(p.text || '').replace(/"/g, '&quot;')}">Copy</button>
              ${(p.videoPreview || p.hasLocalVideo) ? `<button class="grok-prompt-copy-btn play-video-btn" data-id="${p.id}" style="color:var(--grok-primary); border-color:var(--grok-primary);" title="Play Saved Video">▶ Play</button>` : ''}
              ${isVideoType ? `<button class="grok-prompt-copy-btn capture-preview-btn" data-id="${p.id}" style="color:var(--grok-success); border-color:var(--grok-success);" title="Capture current page video as preview">📹 Capture</button>` : ''}
              ${isVideoType ? `<button class="grok-prompt-copy-btn download-video-btn" style="color:var(--grok-warning); border-color:var(--grok-warning);" title="Download current page video as MP4">⬇ MP4</button>` : ''}
              ${isAuto ? `<button class="grok-prompt-copy-btn save-btn" data-id="${p.id}" style="color:var(--grok-primary); border-color:var(--grok-primary);">Save</button>` : ''}
              <span style="margin-left:auto; font-size:11px; color:#555;">${dateString}</span>
            </div>
          </div>
        </div>
      `;
    }

    function bindBulkEvents(container, targetId, currentVisiblePrompts) {
      const selectAllCb = container.querySelector(`#grokSelectAll-${targetId}`);
      const deleteBtn = container.querySelector(`#grokBulkDeleteBtn-${targetId}`);
      const itemCheckboxes = container.querySelectorAll('.grok-select-item');
      const updateBulkUI = () => {
        const allVisibleSelected = currentVisiblePrompts.length > 0 && currentVisiblePrompts.every(p => selectedPromptIds.has(p.id));
        if(selectAllCb) selectAllCb.checked = allVisibleSelected;
        const selectedCount = selectedPromptIds.size;
        if(deleteBtn) {
          deleteBtn.disabled = selectedCount === 0;
          deleteBtn.innerText = selectedCount > 0 ? `Delete Selected (${selectedCount})` : `Delete Selected`;
        }
      };
      if(selectAllCb) selectAllCb.onclick = (e) => {
        const isChecked = e.target.checked;
        currentVisiblePrompts.forEach(p => isChecked ? selectedPromptIds.add(p.id) : selectedPromptIds.delete(p.id));
        itemCheckboxes.forEach(cb => cb.checked = isChecked);
        updateBulkUI();
      };
      itemCheckboxes.forEach(cb => cb.onclick = (e) => {
        e.target.checked ? selectedPromptIds.add(e.target.dataset.id) : selectedPromptIds.delete(e.target.dataset.id);
        updateBulkUI();
      });
      if(deleteBtn) deleteBtn.onclick = () => {
        const count = selectedPromptIds.size;
        if (confirm(`Delete ${count} prompts?`)) {
          let allPrompts = getPrompts().filter(p => !selectedPromptIds.has(p.id));
          savePrompts(allPrompts);
          selectedPromptIds.forEach(id => deleteVideoFromDB(id));
          selectedPromptIds.clear();
          showToast(`Deleted ${count} prompts`);
          refreshActiveTab();
        }
      };
      updateBulkUI();
    }

    function bindControls() {
      document.querySelectorAll('.grok-prompt-filter-btn').forEach(b => b.onclick = () => {
        const mode = b.dataset.mode;
        if (mode === 'image') { imageFilterCategory = b.dataset.f; }
        else if (mode === 'history-type') { historyFilterMode = b.dataset.f; }
        else { videoFilterCategory = b.dataset.f; }
        selectedPromptIds.clear();
        refreshActiveTab();
      });
      document.querySelectorAll('.grok-prompt-sort-btn').forEach(b => b.onclick = () => {
        const target = b.dataset.target;
        const sortType = b.dataset.sort;
        if (target === 'history') historySortMode = sortType;
        else if (target === 'image') imageSortMode = sortType;
        else if (target === 'edited') editedSortMode = sortType;
        else videoSortMode = sortType;
        refreshActiveTab();
      });
    }

    function bindMediaEvents(container) {
      container.querySelectorAll('.grok-video-input').forEach(input => {
        input.addEventListener('blur', (e) => {
          const id = e.target.dataset.id, val = e.target.value;
          let prompts = getPrompts(), p = prompts.find(x => x.id === id);
          if (p && p.videoPrompt !== val) { p.videoPrompt = val; savePrompts(prompts); showToast('Video prompt saved'); }
        });
      });
      container.querySelectorAll('.grok-mod-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
          const val = e.target.value;
          const display = e.target.parentElement.querySelector('.grok-mod-val');
          if(display) { display.innerText = val + '%'; display.className = `grok-mod-val ${val < 40 ? 'low' : (val < 80 ? 'med' : 'high')}`; }
        });
        slider.addEventListener('change', (e) => {
          let prompts = getPrompts(), p = prompts.find(x => x.id === e.target.dataset.id);
          if (p) { p.moderation = parseInt(e.target.value); savePrompts(prompts); }
        });
      });
      container.querySelectorAll('.grok-snapshot-input').forEach(input => {
        input.addEventListener('change', (e) => {
          const file = e.target.files[0]; if (!file) return;
          compressImage(file, (base64) => {
            let prompts = getPrompts(), p = prompts.find(x => x.id === e.target.dataset.id);
            if (p) { p.snapshot = base64; savePrompts(prompts); refreshActiveTab(); showToast('Snapshot attached!'); }
          });
        });
      });
      container.querySelectorAll('.grok-snapshot-del').forEach(btn => btn.addEventListener('click', (e) => {
        if (!confirm('Remove snapshot?')) return;
        let prompts = getPrompts(), p = prompts.find(x => x.id === btn.dataset.id);
        if (p) { delete p.snapshot; savePrompts(prompts); refreshActiveTab(); }
      }));
      // Video capture trigger (preview column)
      container.querySelectorAll('.grok-capture-preview-trigger').forEach(el => {
        el.addEventListener('click', () => { captureVideoPreview(el.dataset.id); });
      });
      // Video preview delete
      container.querySelectorAll('.grok-preview-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!confirm('Remove video preview?')) return;
          let prompts = getPrompts(), p = prompts.find(x => x.id === btn.dataset.id);
          if (p) {
            delete p.videoPreview;
            delete p.hasLocalVideo;
            if (capturedVideoBlobUrls[p.id]) {
              try { URL.revokeObjectURL(capturedVideoBlobUrls[p.id]); } catch(e) {}
              delete capturedVideoBlobUrls[p.id];
            }
            deleteVideoFromDB(p.id);
            savePrompts(prompts);
            refreshActiveTab();
          }
        });
      });
      // Video playback on thumbnail click
      container.querySelectorAll('.grok-video-play-thumb').forEach(img => {
        img.addEventListener('click', (e) => {
          e.stopPropagation();
          const promptId = e.target.dataset.promptId;
          if (promptId) {
            playVideoInLightbox(promptId);
          }
        });
      });
      // Image lightbox (snapshots only - not video thumbs)
      container.querySelectorAll('.grok-snapshot-thumb:not(.grok-video-play-thumb)').forEach(img => img.addEventListener('click', (e) => {
        const lightbox = document.querySelector('.grok-lightbox'), lbImg = document.getElementById('grokLightboxImg');
        if (lbImg) lbImg.src = e.target.dataset.src;
        lightbox.style.display = 'flex'; lightbox.offsetHeight; lightbox.classList.add('open');
      }));
    }

    function bindPromptEvents(container) {
      container.onclick = (e) => {
        const btn = e.target.closest('button');
        if (!btn || btn.classList.contains('grok-bulk-delete-btn')) return;

        if (btn.classList.contains('capture-preview-btn')) {
          captureVideoPreview(btn.dataset.id);
          return;
        }
        if (btn.classList.contains('play-video-btn')) {
          playVideoInLightbox(btn.dataset.id);
          return;
        }
        if (btn.classList.contains('download-video-btn')) {
          downloadCurrentVideo();
          return;
        }
        if (btn.classList.contains('grok-prompt-copy-btn') && btn.dataset.text) {
          const txt = btn.dataset.text;
          navigator.clipboard.writeText(txt).then(() => showToast('Copied to clipboard!'));
          const sidePanel = document.getElementById('grok-control-panel');
          const sideInput = document.getElementById('grok-panel-prompt');
          if (sidePanel && !sidePanel.classList.contains('hidden') && sideInput) {
            sideInput.value = txt;
            sideInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        else if (btn.classList.contains('grok-prompt-item-delete')) {
          if (confirm('Delete this prompt?')) {
            const promptId = btn.dataset.id;
            savePrompts(getPrompts().filter(p => p.id !== promptId));
            deleteVideoFromDB(promptId);
            refreshActiveTab();
          }
        }
        else if (btn.classList.contains('save-btn')) {
          let prompts = getPrompts();
          let p = prompts.find(x => x.id === btn.dataset.id);
          if (p) {
            editingPromptId = p.id;
            document.querySelector('[data-tab="generate"]').click();
            document.getElementById('grokPromptInput').value = p.text;
            const saveBtn = document.getElementById('grokSaveBtn');
            saveBtn.innerText = "Update Saved Prompt";
            saveBtn.style.background = "var(--grok-image-history)";
            document.getElementById('grokCancelEditBtn').style.display = 'inline-flex';
            showToast('Select a Category and click Update');
          }
        }
      };
    }

    function renderPromptsList(targetId, filterFn) {
      const container = document.getElementById(targetId);
      const s = getSettings();
      let prompts = getPrompts();
      if (filterFn) prompts = prompts.filter(filterFn);

      if (targetId === 'grokRecentTab') {
        const retryStyle = s.retryEnabled ? 'display:inline;' : 'display:none;';
        const retryText = s.retryEnabled ? `Auto-Retry: ${retryCount}/${s.maxRetries}` : '';
        const bulkBarHTML = `
          <div class="grok-bulk-bar">
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="grokSelectAll-${targetId}" class="grok-item-checkbox">
                <label for="grokSelectAll-${targetId}" style="font-size:13px; font-weight:600; cursor:pointer; color:var(--grok-text-main);">Select All</label>
              </div>
              <div class="grok-filter-group" style="border-left:1px solid var(--grok-border); padding-left:10px;">
                <button class="grok-prompt-filter-btn ${historyFilterMode === 'all' ? 'active' : ''}" data-f="all" data-mode="history-type">All</button>
                <button class="grok-prompt-filter-btn ${historyFilterMode === 'video' ? 'active' : ''}" data-f="video" data-mode="history-type">Video</button>
                <button class="grok-prompt-filter-btn ${historyFilterMode === 'image' ? 'active' : ''}" data-f="image" data-mode="history-type">Image</button>
                <button class="grok-prompt-filter-btn ${historyFilterMode === 'edited' ? 'active' : ''}" data-f="edited" data-mode="history-type">Edited</button>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
              <div class="grok-sort-group">
                <span style="font-size:10px; color:#555; font-weight:700; text-transform:uppercase; margin-right:4px;">Sort:</span>
                <button class="grok-prompt-sort-btn ${historySortMode === 'newest' ? 'active' : ''}" data-sort="newest" data-target="history">Newest</button>
                <button class="grok-prompt-sort-btn ${historySortMode === 'high' ? 'active' : ''}" data-sort="high" data-target="history">High Success</button>
                <button class="grok-prompt-sort-btn ${historySortMode === 'low' ? 'active' : ''}" data-sort="low" data-target="history">Low Success</button>
              </div>
              <span id="grokRetryStatus-history" style="font-size:11px; font-weight:700; color:var(--grok-warning); margin-right:4px; ${retryStyle}">${retryText}</span>
              <button id="grokBulkDeleteBtn-${targetId}" class="grok-bulk-delete-btn" disabled>Delete Selected</button>
            </div>
          </div>`;

        const allCats = getCategories();
        if (historyFilterMode === 'video') {
          prompts = prompts.filter(p => {
            const m = migratePrompt(p);
            const isVidCat = allCats.some(c => c.name === m.category && c.type === 'video');
            return m.sourceType === 'Video' || (isVidCat && m.sourceType !== 'Image' && m.sourceType !== 'Edited Image');
          });
        } else if (historyFilterMode === 'image') {
          prompts = prompts.filter(p => {
            const m = migratePrompt(p);
            const isImgCat = allCats.some(c => c.name === m.category && c.type === 'image');
            return m.sourceType === 'Image' || isImgCat;
          });
        } else if (historyFilterMode === 'edited') {
          prompts = prompts.filter(p => migratePrompt(p).sourceType === 'Edited Image');
        }

        if (historySortMode === 'high') {
          prompts.sort((a, b) => sortBySuccessRate(a, b, false));
        } else if (historySortMode === 'low') {
          prompts.sort((a, b) => sortBySuccessRate(a, b, true));
        } else {
          prompts.sort((a, b) => b.timestamp - a.timestamp);
        }

        if (prompts.length === 0) {
          container.innerHTML = bulkBarHTML + `<div style="text-align:center; color:#666; padding:40px;">History is empty.</div>`;
          bindControls();
          return;
        }
        container.innerHTML = bulkBarHTML + '<div class="grok-prompt-list">' + prompts.map(p => generatePromptHTML(p, 'history', s)).join('') + '</div>';
        bindMediaEvents(container);
        bindBulkEvents(container, targetId, prompts);
        bindControls();
      }
      else if (targetId === 'grokSavedTab') {
        const videoCats = getCategories().filter(c => c.type === 'video').map(c => c.name);
        const controlsHTML = `
          <div class="grok-control-bar">
            <div class="grok-filter-group">
              <button class="grok-prompt-filter-btn ${videoFilterCategory === 'all' ? 'active' : ''}" data-f="all" data-mode="video">All</button>
              ${videoCats.map(c => `<button class="grok-prompt-filter-btn ${videoFilterCategory === c ? 'active' : ''}" data-f="${c}" data-mode="video">${c}</button>`).join('')}
            </div>
            <div class="grok-sort-group">
              <span style="font-size:10px; color:#555; font-weight:700; text-transform:uppercase; margin-right:4px;">Sort:</span>
              <button class="grok-prompt-sort-btn ${videoSortMode === 'newest' ? 'active' : ''}" data-sort="newest" data-target="video">Newest</button>
              <button class="grok-prompt-sort-btn ${videoSortMode === 'high' ? 'active' : ''}" data-sort="high" data-target="video">${s.useAutoStats ? 'High Success' : 'High Mod'}</button>
              <button class="grok-prompt-sort-btn ${videoSortMode === 'low' ? 'active' : ''}" data-sort="low" data-target="video">${s.useAutoStats ? 'Low Success' : 'Low Mod'}</button>
            </div>
          </div>`;
        if (videoFilterCategory !== 'all') prompts = prompts.filter(p => p.category === videoFilterCategory);
        if (videoSortMode === 'high') {
          prompts.sort((a, b) => s.useAutoStats ? sortBySuccessRate(a, b, false) : sortByModeration(a, b, false));
        } else if (videoSortMode === 'low') {
          prompts.sort((a, b) => s.useAutoStats ? sortBySuccessRate(a, b, true) : sortByModeration(a, b, true));
        } else {
          prompts.sort((a, b) => b.timestamp - a.timestamp);
        }
        if (prompts.length === 0) {
          container.innerHTML = controlsHTML + `<div style="text-align:center; color:#666; padding:40px;">No saved video prompts found.</div>`;
          bindControls();
          return;
        }
        container.innerHTML = controlsHTML + '<div class="grok-prompt-list">' + prompts.map(p => generatePromptHTML(p, 'video', s)).join('') + '</div>';
        bindControls(); bindMediaEvents(container);
      }
      else if (targetId === 'grokQuickTab') {
        const imageCats = getCategories().filter(c => c.type === 'image').map(c => c.name);
        const controlsHTML = `
          <div class="grok-control-bar">
            <div class="grok-filter-group">
              <button class="grok-prompt-filter-btn ${imageFilterCategory === 'all' ? 'active' : ''}" data-f="all" data-mode="image">All</button>
              ${imageCats.map(c => `<button class="grok-prompt-filter-btn ${imageFilterCategory === c ? 'active' : ''}" data-f="${c}" data-mode="image">${c}</button>`).join('')}
            </div>
            <div class="grok-sort-group">
              <span style="font-size:10px; color:#555; font-weight:700; text-transform:uppercase; margin-right:4px;">Sort:</span>
              <button class="grok-prompt-sort-btn ${imageSortMode === 'newest' ? 'active' : ''}" data-sort="newest" data-target="image">Newest</button>
              <button class="grok-prompt-sort-btn ${imageSortMode === 'high' ? 'active' : ''}" data-sort="high" data-target="image">High Success</button>
              <button class="grok-prompt-sort-btn ${imageSortMode === 'low' ? 'active' : ''}" data-sort="low" data-target="image">Low Success</button>
            </div>
          </div>`;
        if (imageFilterCategory !== 'all') prompts = prompts.filter(p => p.category === imageFilterCategory);
        if (imageSortMode === 'high') prompts.sort((a, b) => sortByModeration(a, b, false));
        else if (imageSortMode === 'low') prompts.sort((a, b) => sortByModeration(a, b, true));
        else prompts.sort((a, b) => b.timestamp - a.timestamp);
        if (prompts.length === 0) {
          container.innerHTML = controlsHTML + `<div style="text-align:center; color:#666; padding:40px;">No image prompts saved yet.</div>`;
          bindControls();
          return;
        }
        container.innerHTML = controlsHTML + '<div class="grok-prompt-list">' + prompts.map(p => generatePromptHTML(p, 'image', s)).join('') + '</div>';
        bindControls(); bindMediaEvents(container);
      }
      else if (targetId === 'grokEditedTab') {
        const controlsHTML = `
          <div class="grok-control-bar">
            <div class="grok-filter-group">
              <!-- No specific categories for edits right now -->
            </div>
            <div class="grok-sort-group">
              <span style="font-size:10px; color:#555; font-weight:700; text-transform:uppercase; margin-right:4px;">Sort:</span>
              <button class="grok-prompt-sort-btn ${editedSortMode === 'newest' ? 'active' : ''}" data-sort="newest" data-target="edited">Newest</button>
            </div>
          </div>`;
        prompts.sort((a, b) => b.timestamp - a.timestamp);
        if (prompts.length === 0) {
          container.innerHTML = controlsHTML + `<div style="text-align:center; color:#666; padding:40px;">No edited image prompts saved yet.</div>`;
          bindControls();
          return;
        }
        container.innerHTML = controlsHTML + '<div class="grok-prompt-list">' + prompts.map(p => generatePromptHTML(p, 'edited', s)).join('') + '</div>';
        bindControls(); bindMediaEvents(container);
      }
      bindPromptEvents(container);
    }

    function refreshActiveTab() {
      const activeEl = document.querySelector('.grok-prompt-tab.active');
      if (!activeEl) return;
      const active = activeEl.dataset.tab;
      const allCats = getCategories();
      const imageCatNames = allCats.filter(c => c.type === 'image').map(c => c.name);
      if (active === 'saved') {
        renderPromptsList('grokSavedTab', p => {
          const m = migratePrompt(p);
          if (m.category === 'Auto-History') return false;
          if (imageCatNames.includes(m.category)) return false;
          return true;
        });
      } else if (active === 'recent') {
        renderPromptsList('grokRecentTab', p => p.category === 'Auto-History' || (p.id || '').startsWith('auto_'));
      } else if (active === 'quick') {
        renderPromptsList('grokQuickTab', p => {
          const m = migratePrompt(p);
          if (m.category === 'Auto-History') return false;
          if (m.sourceType === 'Edited Image') return false; // Put these in edited tab
          return imageCatNames.includes(m.category) || m.snapshot || m.sourceType === 'Image';
        });
      } else if (active === 'edited') {
        renderPromptsList('grokEditedTab', p => {
          const m = migratePrompt(p);
          if (m.category === 'Auto-History') return false;
          return m.sourceType === 'Edited Image';
        });
      } else if (active === 'categories') {
        renderCategories();
      }
      updateCounts();
      updateRetryStatus();
    }

    function updateRetryStatus() {
      const s = getSettings();
      const text = `${retryCount}/${s.maxRetries}`;
      const el = document.getElementById('grokRetryStatus');
      if(el) el.innerText = text;
      const elHist = document.getElementById('grokRetryStatus-history');
      if(elHist) {
        if(s.retryEnabled) { elHist.style.display = 'inline'; elHist.innerText = `Auto-Retry: ${text}`; }
        else { elHist.style.display = 'none'; }
      }
      const sideStatus = document.getElementById('grok-side-status');
      if (sideStatus) {
        if (!s.retryEnabled) { sideStatus.textContent = "Auto-Retry Disabled"; sideStatus.className = 'status-error'; }
        else if (retryCount >= s.maxRetries) { sideStatus.textContent = "Max Limit Reached"; sideStatus.className = 'status-error'; }
        else { sideStatus.textContent = `Retrying (${retryCount}/${s.maxRetries})`; sideStatus.className = ''; }
      }
    }

    function renderCategories() {
      const videoList = document.getElementById('grokVideoCatList');
      const imageList = document.getElementById('grokImageCatList');
      const cats = getCategories();
      if (videoList) {
        videoList.innerHTML = cats.filter(c => c.type === 'video').map(c =>
          `<div class="grok-prompt-category-tag">${c.name}<span style="cursor:pointer; color:#666; padding:0 4px;" data-rem="${c.name}">&times;</span></div>`
        ).join('');
      }
      if (imageList) {
        imageList.innerHTML = cats.filter(c => c.type === 'image').map(c =>
          `<div class="grok-prompt-category-tag image-type">${c.name}<span style="cursor:pointer; color:#666; padding:0 4px;" data-rem="${c.name}">&times;</span></div>`
        ).join('');
      }
      document.querySelectorAll('.grok-prompt-category-list [data-rem]').forEach(span => span.onclick = () => {
        let cName = span.dataset.rem;
        let cats = getCategories();
        if (cats.length <= 1) return alert('Keep at least one category.');
        saveCategories(cats.filter(x => x.name !== cName));
        renderCategories(); updateCategorySelect();
      });
    }

    function updateCategorySelect() {
      const sel = document.getElementById('grokCategorySelect');
      if (!sel) return;
      const cats = getCategories();
      const vidCats = cats.filter(c => c.type === 'video');
      const imgCats = cats.filter(c => c.type === 'image');
      const currentVal = sel.value;
      sel.innerHTML = `
        <optgroup label="Video / General">${vidCats.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}</optgroup>
        <optgroup label="Image">${imgCats.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}</optgroup>
      `;
      if(currentVal && cats.some(c => c.name === currentVal)) sel.value = currentVal;
      else if (!currentCategory && vidCats.length > 0) currentCategory = vidCats[0].name;
    }

    function updateCounts() {
      const p = getPrompts();
      const allCats = getCategories();
      const imageCatNames = allCats.filter(c => c.type === 'image').map(c => c.name);

      const imgCount = p.filter(x => {
        const m = migratePrompt(x);
        return m.category !== 'Auto-History' && m.sourceType !== 'Edited Image' && (imageCatNames.includes(m.category) || m.snapshot || m.sourceType === 'Image');
      }).length;

      const editCount = p.filter(x => {
        const m = migratePrompt(x);
        return m.category !== 'Auto-History' && m.sourceType === 'Edited Image';
      }).length;

      const vidCount = p.filter(x => {
        const m = migratePrompt(x);
        return m.category !== 'Auto-History' && !imageCatNames.includes(m.category) && m.sourceType !== 'Edited Image';
      }).length;

      const savedTab = document.querySelector('[data-tab="saved"]');
      const quickTab = document.querySelector('[data-tab="quick"]');
      const editedTab = document.querySelector('[data-tab="edited"]');

      if (savedTab) savedTab.innerText = `Video (${vidCount})`;
      if (quickTab) quickTab.innerText = `Images (${imgCount})`;
      if (editedTab) editedTab.innerText = `Edited (${editCount})`;
    }

    // ============================
    // SIDE PANEL
    // ============================
    // ADDED: Protect against cyclic input updating
    let isSyncingFromPanel = false;

    function initSidePanel() {
      document.getElementById('grok-control-panel')?.remove();
      document.getElementById('grok-library-modal')?.remove();

      if (GM_getValue('grok_side_panel_visible', null) === null) {
        GM_setValue('grok_side_panel_visible', true);
      }

      const DEFAULT_SNIPPETS =[
        { id: 'b1', label: 'Anime Stickers (Provocative - Adults)', text: 'Surrounding the central image: thick decorative border made of overlapping colorful anime-style stickers featuring adult anime women with exaggerated proportions in various provocative poses. Each sticker has a white outline and slight drop shadow. The stickers completely frame all four edges of the image with some overlap into the main content.' },
        { id: 'b2', label: 'Anime Stickers (SFW)', text: 'Surrounding the central image: thick decorative border made of overlapping colorful anime-style stickers featuring anime women in various poses. Each sticker has a white outline and slight drop shadow. The stickers completely frame all four edges of the image with some overlap into the main content.' },
        { id: '1', label: 'Motion: Slow Mo', text: 'slow motion, high frame rate, smooth movement' },
        { id: '2', label: 'Style: Photorealistic', text: 'photorealistic, 8k resolution, highly detailed, unreal engine 5 render' },
        { id: '3', label: 'Lighting: Golden Hour', text: 'golden hour lighting, warm sun rays, lens flare, soft shadows' },
      ];

      function getParsedHistory(key) {
        let val = GM_getValue(key);
        if (typeof val === 'string') {
          try { val = JSON.parse(val); } catch(e) { val =[]; }
        }
        return Array.isArray(val) ? val :[];
      }

      let videoPromptHistory = getParsedHistory('videoPromptHistory');
      let imagePromptHistory = getParsedHistory('imagePromptHistory');
      let editedPromptHistory = getParsedHistory('editedPromptHistory');

      function saveHistories() {
        GM_setValue('videoPromptHistory', JSON.stringify(videoPromptHistory));
        GM_setValue('imagePromptHistory', JSON.stringify(imagePromptHistory));
        GM_setValue('editedPromptHistory', JSON.stringify(editedPromptHistory));
      }

      function addToHistory(prompt, type) {
        if (!prompt || !prompt.trim()) return;
        let arr;
        if (type === 'image') arr = imagePromptHistory;
        else if (type === 'edited') arr = editedPromptHistory;
        else arr = videoPromptHistory;
        const filtered = arr.filter(item => item.text !== prompt);
        filtered.unshift({ id: Date.now().toString(), text: prompt, timestamp: Date.now(), type });
        const limited = filtered.slice(0, 500);
        if (type === 'image') imagePromptHistory = limited;
        else if (type === 'edited') editedPromptHistory = limited;
        else videoPromptHistory = limited;
        saveHistories();
      }

      function getCombinedHistory() {
        const combined =[
          ...videoPromptHistory.map(h => ({...h, source:'video'})),
          ...imagePromptHistory.map(h => ({...h, source:'image'})),
          ...editedPromptHistory.map(h => ({...h, source:'edited'})),
        ];
        return combined.sort((a,b) => b.timestamp - a.timestamp);
      }

      let panelMasterEnabled = true;
      let sideHistoryNavIndex = -1;
      let lastTypedPrompt = '';
      let lastGenerationTimestamp = 0;
      const GENERATION_COOLDOWN_MS = 3000;

      let savedSnippets = GM_getValue('savedSnippets');
      if (typeof savedSnippets === 'string') {
        try { savedSnippets = JSON.parse(savedSnippets); } catch(e) { savedSnippets = DEFAULT_SNIPPETS; }
      }
      if (!Array.isArray(savedSnippets)) savedSnippets = DEFAULT_SNIPPETS;

      let panelSize = GM_getValue('panelSize', { width: '300px', height: '460px' });

      const s = getSettings();
      const sideKbString = getKeybindString(s.sidePanelKeybind || { key: 'k', altKey: true, ctrlKey: false, shiftKey: false, metaKey: false });

      const panel = document.createElement('div');
      panel.id = 'grok-control-panel';
      panel.style.width = panelSize.width;
      panel.style.height = panelSize.height;
      const visible = GM_getValue('grok_side_panel_visible', true);
      if (!visible) panel.classList.add('hidden');

      panel.innerHTML = `
        <div id="grok-side-resize-handle" title="Drag to Resize"></div>
        <div class="grok-side-header">
          <span class="grok-side-title">Grok Tools v57</span>
          <button id="grok-side-toggle-btn" class="grok-side-toggle-btn">ON</button>
          <button id="grok-side-close-x" style="background:none; border:none; color:#8b98a5; cursor:pointer; font-size:16px; font-weight:bold; line-height:1; padding:0 4px;" title="Hide Panel">&times;</button>
        </div>
        <div class="grok-side-controls">
          <label class="grok-side-checkbox"><input type="checkbox" id="grok-autoclick-cb" ${getSettings().retryEnabled ? 'checked' : ''}> Auto-Retry</label>
          <div>Max: <input type="number" id="grok-retry-limit" value="${getSettings().maxRetries}" class="grok-side-num-input" min="1"></div>
        </div>
        <div class="grok-side-prompt-header-row">
          <div class="grok-side-prompt-label">Prompt Editor</div>
          <div class="grok-side-nav">
            <button id="btn-hist-prev" class="grok-side-nav-btn" title="Previous in History (Alt+Left)">◀</button>
            <span id="hist-nav-counter" class="grok-side-nav-counter">-</span>
            <button id="btn-hist-next" class="grok-side-nav-btn" title="Next in History (Alt+Right)">▶</button>
          </div>
        </div>
        <textarea id="grok-panel-prompt" placeholder="Type or paste prompt here..."></textarea>
        <div class="grok-side-btn-row">
          <button id="btn-open-library" class="grok-side-action-btn">+ Snippets</button>
          <button id="btn-generate" class="grok-side-action-btn">Generate</button>
        </div>
        <div id="grok-side-status">Ready</div>
        <div style="font-size:9px; color:#555; text-align:center; flex-shrink:0;">Hide: ${sideKbString}</div>
      `;
      document.body.appendChild(panel);

      const lib = document.createElement('div');
      lib.id = 'grok-library-modal';
      lib.innerHTML = `
        <div class="gl-header"><span>Snippets Library</span><span class="gl-close">&times;</span></div>
        <div class="gl-view-list" id="gl-view-list">
          <div class="gl-list-content" id="gl-list-container"></div>
          <div class="gl-create-btn" id="btn-create-snippet">Create New Snippet</div>
        </div>
        <div class="gl-view-editor" id="gl-view-editor">
          <label style="font-size:11px; color:#8b98a5;">Label</label>
          <input type="text" class="gl-input" id="gl-edit-label" placeholder="e.g. Cinematic Lighting">
          <label style="font-size:11px; color:#8b98a5;">Prompt Text</label>
          <textarea class="gl-textarea" id="gl-edit-text" placeholder="Content to append..."></textarea>
          <div class="gl-editor-buttons">
            <button class="gl-btn gl-btn-cancel" id="btn-edit-cancel">Cancel</button>
            <button class="gl-btn gl-btn-save" id="btn-edit-save">Save Snippet</button>
          </div>
        </div>
      `;
      document.body.appendChild(lib);

      const promptBox = panel.querySelector('#grok-panel-prompt');
      const statusText = panel.querySelector('#grok-side-status');
      const toggleBtn = panel.querySelector('#grok-side-toggle-btn');
      const closeBtn = panel.querySelector('#grok-side-close-x');
      const btnPrev = panel.querySelector('#btn-hist-prev');
      const btnNext = panel.querySelector('#btn-hist-next');
      const counter = panel.querySelector('#hist-nav-counter');

      const listContainer = lib.querySelector('#gl-list-container');
      const editLabel = lib.querySelector('#gl-edit-label');
      const editText = lib.querySelector('#gl-edit-text');
      let editingId = null;

      function updateStatus(msg, type) {
        statusText.textContent = msg;
        statusText.className = type === 'error' ? 'status-error' : '';
      }

      function updateHistoryNavButtons() {
        const history = getCombinedHistory();
        if (history.length === 0) { btnPrev.disabled = true; btnNext.disabled = true; counter.textContent = '-'; return; }
        if (sideHistoryNavIndex === -1) { btnPrev.disabled = false; btnNext.disabled = false; counter.textContent = 'current'; }
        else { btnPrev.disabled = (sideHistoryNavIndex >= history.length - 1); btnNext.disabled = false; counter.textContent = `${sideHistoryNavIndex + 1}/${history.length}`; }
      }

      function navigateHistory(direction) {
        const history = getCombinedHistory();
        if (history.length === 0) { updateStatus('No history available', 'error'); setTimeout(() => updateStatus('Ready'), 1200); return; }
        if (direction === -1) {
          if (sideHistoryNavIndex === -1) sideHistoryNavIndex = 0;
          else if (sideHistoryNavIndex < history.length - 1) sideHistoryNavIndex++;
          else return;
          promptBox.value = history[sideHistoryNavIndex].text;
        } else {
          if (sideHistoryNavIndex === -1) { promptBox.value = ''; }
          else if (sideHistoryNavIndex === 0) { sideHistoryNavIndex = -1; promptBox.value = ''; }
          else { sideHistoryNavIndex--; promptBox.value = history[sideHistoryNavIndex].text; }
        }
        updateHistoryNavButtons();
        if (panelMasterEnabled) {
           lastTypedPrompt = promptBox.value;
           const inputEl = getGrokInputEl();
           if(inputEl) {
               isSyncingFromPanel = true;
               setInputValue(inputEl, promptBox.value);
               isSyncingFromPanel = false;
           }
        }
      }

      btnPrev.addEventListener('click', () => navigateHistory(-1));
      btnNext.addEventListener('click', () => navigateHistory(1));
      promptBox.addEventListener('keydown', (e) => {
        if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); navigateHistory(-1); }
        if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); navigateHistory(1); }
      });

      // UPDATED: Sync to webpage safely to preserve typing caret
      promptBox.addEventListener('input', () => {
        if (!panelMasterEnabled) return;
        isSyncingFromPanel = true;
        const start = promptBox.selectionStart;
        const end = promptBox.selectionEnd;

        sideHistoryNavIndex = -1;
        updateHistoryNavButtons();
        lastTypedPrompt = promptBox.value;
        const inputEl = getGrokInputEl();

        if (inputEl) setInputValue(inputEl, lastTypedPrompt);

        updateStatus('Ready');

        // Restore focus specifically to bypass steal via main site logic, and place caret properly back
        if (document.activeElement !== promptBox) {
            promptBox.focus({ preventScroll: true });
        }
        promptBox.setSelectionRange(start, end);
        isSyncingFromPanel = false;
      });

      // UPDATED: Sync from main webpage (e.g. TipTap) back to the side panel
      document.addEventListener('input', (e) => {
        if (e.target.matches && (e.target.matches(SP.TIPTAP_EDITOR) || e.target.closest(SP.TIPTAP_EDITOR))) {
            if (isSyncingFromPanel) return; // Prevent loop cycle jumping the cursor

            const v = getInputText(e.target);
            if (v !== promptBox.value) {
                promptBox.value = v;
                lastTypedPrompt = v;
                sideHistoryNavIndex = -1;
                updateHistoryNavButtons();
            }
        }
      }, true);

      function doGenerateNow() {
        if (!panelMasterEnabled) { updateStatus('Panel Paused', 'error'); return; }
        const now = Date.now();
        if (now - lastGenerationTimestamp < GENERATION_COOLDOWN_MS) {
          const remaining = Math.ceil((GENERATION_COOLDOWN_MS - (now - lastGenerationTimestamp)) / 1000);
          updateStatus(`Cooldown: ${remaining}s`, 'error'); return;
        }

        let btn = null;
        const type = detectContextType();
        let cat = type === 'video' ? 'video' : (type === 'edited_image' ? 'edited' : 'image');

        if (type === 'video') {
            btn = Array.from(document.querySelectorAll(SP.BTN_MAKE_VIDEO)).find(b => !b.textContent.includes('Edit')) || document.querySelector(SP.BTN_MAKE_VIDEO);
        } else if (type === 'edited_image') {
            btn = Array.from(document.querySelectorAll(SP.BTN_MAKE_VIDEO)).find(b => b.textContent.includes('Edit'));
            if (!btn) btn = document.querySelector(SP.BTN_SUBMIT) || document.querySelector(SP.BTN_IMAGE_GENERATE);
        } else {
            btn = document.querySelector(SP.BTN_SUBMIT) || document.querySelector(SP.BTN_IMAGE_GENERATE);
        }

        if (!btn) { updateStatus('Button not found', 'error'); return; }
        const promptVal = promptBox.value.trim();
        if (promptVal) addToHistory(promptVal, cat);
        updateHistoryNavButtons();

        const inputEl = getGrokInputEl();
        if(inputEl) {
            isSyncingFromPanel = true;
            setInputValue(inputEl, promptBox.value);
            isSyncingFromPanel = false;
        }

        setTimeout(() => {
          if (!btn.disabled) {
             btn.click();

             // Trigger Auto-Tracker Main History capture manually since programmatic clicks bypass mousedown
             const captureType = type === 'video' ? 'Video' : (type === 'edited_image' ? 'Edited Image' : 'Image');
             window.dispatchEvent(new CustomEvent('grokCaptureManual', {
               detail: { text: promptVal, type: captureType }
             }));

             lastGenerationTimestamp = Date.now();
             updateStatus(type === 'video' ? 'Generation Started...' : 'Submitted...');
          }
          else { updateStatus('Button disabled/processing', 'error'); }
        }, 50);
      }

      panel.querySelector('#btn-generate').addEventListener('click', doGenerateNow);

      const resizeHandle = panel.querySelector('#grok-side-resize-handle');
      let resizing = false, startX, startY, startW, startH;

      function updateLibPosition() { const pHeight = panel.offsetHeight; lib.style.bottom = (20 + pHeight + 10) + 'px'; }

      resizeHandle.addEventListener('mousedown', (e) => {
        resizing = true; startX = e.clientX; startY = e.clientY;
        const rect = panel.getBoundingClientRect(); startW = rect.width; startH = rect.height;
        e.preventDefault(); document.body.style.cursor = 'nwse-resize';
      });
      document.addEventListener('mousemove', (e) => {
        if (!resizing) return;
        panel.style.width = Math.max(280, startW + (startX - e.clientX)) + 'px';
        panel.style.height = Math.max(250, startH + (startY - e.clientY)) + 'px';
        updateLibPosition();
      });
      document.addEventListener('mouseup', () => {
        if (!resizing) return;
        resizing = false; document.body.style.cursor = '';
        const rect = panel.getBoundingClientRect();
        GM_setValue('panelSize', { width: rect.width + 'px', height: rect.height + 'px' });
        updateLibPosition();
      });

      function escapeHtml(text) { return text ? text.replace(/&/g, "&amp;").replace(/</g, "&lt;") : ''; }

      function renderSnippets() {
        listContainer.innerHTML = '';
        savedSnippets.forEach(item => {
          const el = document.createElement('div'); el.className = 'gl-item';
          el.innerHTML = `<div class="gl-item-text"><b>${escapeHtml(item.label)}</b><span>${escapeHtml(item.text)}</span></div><div class="gl-item-actions"><button class="gl-icon-btn gl-btn-edit">✎</button><button class="gl-icon-btn gl-btn-del">🗑</button></div>`;
          el.querySelector('.gl-item-text').addEventListener('click', () => {
            const cur = promptBox.value;
            promptBox.value = cur + (cur && !cur.endsWith(' ') ? ' ' : '') + item.text;
            promptBox.dispatchEvent(new Event('input'));
            lib.classList.remove('active');
          });
          el.querySelector('.gl-btn-edit').addEventListener('click', (e) => { e.stopPropagation(); showEditor(item); });
          el.querySelector('.gl-btn-del').addEventListener('click', (e) => {
            e.stopPropagation();
            if(confirm('Delete?')) { savedSnippets = savedSnippets.filter(s=>s.id!==item.id); GM_setValue('savedSnippets', JSON.stringify(savedSnippets)); renderSnippets(); }
          });
          listContainer.appendChild(el);
        });
      }

      function showEditor(item) {
        lib.querySelector('#gl-view-list').style.display = 'none';
        lib.querySelector('#gl-view-editor').classList.add('active');
        editingId = item ? item.id : null;
        editLabel.value = item ? item.label : '';
        editText.value = item ? item.text : '';
        editText.focus();
      }

      lib.querySelector('#btn-create-snippet').onclick = () => showEditor(null);
      lib.querySelector('#btn-edit-save').onclick = () => {
        const label = editLabel.value.trim() || 'Untitled';
        const text = editText.value.trim();
        if (!text) return;
        if (editingId) { const idx = savedSnippets.findIndex(s => s.id === editingId); if (idx > -1) { savedSnippets[idx].label = label; savedSnippets[idx].text = text; } }
        else { savedSnippets.push({ id: Date.now().toString(), label, text }); }
        GM_setValue('savedSnippets', JSON.stringify(savedSnippets));
        lib.querySelector('#gl-view-editor').classList.remove('active');
        lib.querySelector('#gl-view-list').style.display = 'flex';
        renderSnippets();
      };
      lib.querySelector('#btn-edit-cancel').onclick = () => {
        lib.querySelector('#gl-view-editor').classList.remove('active');
        lib.querySelector('#gl-view-list').style.display = 'flex';
      };
      panel.querySelector('#btn-open-library').onclick = () => { lib.classList.add('active'); updateLibPosition(); renderSnippets(); };
      lib.querySelector('.gl-close').onclick = () => lib.classList.remove('active');

      toggleBtn.onclick = () => {
        panelMasterEnabled = !panelMasterEnabled;
        toggleBtn.textContent = panelMasterEnabled ? "ON" : "OFF";
        toggleBtn.classList.toggle('off', !panelMasterEnabled);
        updateStatus(panelMasterEnabled ? "Ready" : "Panel Paused", panelMasterEnabled ? undefined : "error");
      };

      panel.querySelector('#grok-autoclick-cb').onchange = (e) => {
        const st = getSettings();
        saveSettings({ ...st, retryEnabled: e.target.checked });
        updateRetryStatus();
        showToast(e.target.checked ? "Auto-Retry Enabled" : "Auto-Retry Disabled");
      };
      panel.querySelector('#grok-retry-limit').onchange = (e) => {
        let val = parseInt(e.target.value || '3', 10);
        if (isNaN(val)) val = 3;
        val = Math.max(1, Math.min(50, val));
        e.target.value = val;
        const st = getSettings();
        saveSettings({ ...st, maxRetries: val });
        updateRetryStatus();
      };

      closeBtn.onclick = () => { panel.classList.add('hidden'); GM_setValue('grok_side_panel_visible', false); };

      window.addEventListener('grokToggleSidePanel', () => {
        const isHidden = panel.classList.contains('hidden');
        panel.classList.toggle('hidden');
        GM_setValue('grok_side_panel_visible', isHidden);
        if (isHidden) {
          const st = getSettings();
          panel.querySelector('#grok-autoclick-cb').checked = st.retryEnabled;
          panel.querySelector('#grok-retry-limit').value = st.maxRetries;
          const inputEl = getGrokInputEl();
          if (inputEl) {
             const val = getInputText(inputEl);
             if((val || '').trim()) { promptBox.value = val; lastTypedPrompt = val; }
          }
          sideHistoryNavIndex = -1;
          updateHistoryNavButtons();
          updateRetryStatus();
          panel.style.display = 'flex'; panel.style.visibility = 'visible'; panel.style.opacity = '1';
        }
      });

      updateHistoryNavButtons();
    }

    // ============================
    // MAIN INIT
    // ============================
    const overlay = createUI();
    const modal = modalElement;

    setupAutoTracker();
    enforceVideoLoopState();
    initSidePanel();

    setTimeout(() => {
      if (!document.getElementById('grok-control-panel')) {
        try { initSidePanel(); } catch (e) { console.error('[GrokSuite] side panel recovery failed', e); }
      }
    }, 2500);

    setTimeout(() => {
      const p = document.getElementById('grok-control-panel');
      if (p) { p.style.display = 'flex'; p.style.visibility = 'visible'; p.style.opacity = '1'; }
    }, 2000);

    const handle = document.getElementById('grokDragHandle');
    handle.onmousedown = (e) => {
      if(e.target.closest('button')) return;
      isDragging = true;
      const rect = modal.getBoundingClientRect();
      dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (!getSettings().floatingMode) { modal.style.margin = '0'; modal.style.position = 'absolute'; }
    };

    document.addEventListener('mousemove', (e) => {
      if (isDragging) { modal.style.left = (e.clientX - dragOffset.x) + 'px'; modal.style.top = (e.clientY - dragOffset.y) + 'px'; }
      if (isResizing) { modal.style.width = Math.max(380, e.clientX - modal.getBoundingClientRect().left) + 'px'; modal.style.height = Math.max(200, e.clientY - modal.getBoundingClientRect().top) + 'px'; }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging || isResizing) {
        const s = getSettings();
        if (s.floatingMode) GM_setValue('grok_modal_pos_sidekick', { top: modal.style.top, left: modal.style.left, width: modal.style.width, height: modal.style.height });
        else GM_setValue('grok_modal_pos_std', { top: modal.style.top, left: modal.style.left, width: modal.style.width, height: modal.style.height });
      }
      isDragging = false; isResizing = false;
    });

    document.getElementById('grokResizeHandle').onmousedown = (e) => { e.preventDefault(); isResizing = true; };

    document.getElementById('grokCloseBtn').onclick = () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.style.display = 'none', 200);
      isOpen = false;
    };

    document.getElementById('grokSetDefaultBtn').onclick = () => {
      const m = document.querySelector('.grok-prompt-modal');
      const currentDims = { top: m.style.top, left: m.style.left, width: m.style.width, height: m.style.height };
      const isSidekick = getSettings().floatingMode;
      if (isSidekick) { GM_setValue('grok_sidekick_defaults', JSON.stringify(currentDims)); showToast('Sidekick Default Saved!'); }
      else { GM_setValue('grok_custom_defaults', JSON.stringify(currentDims)); showToast('Standard Default Saved!'); }
    };

    document.getElementById('grokFactoryResetBtn').onclick = () => {
      const isSidekick = getSettings().floatingMode;
      if(!confirm(`Reset ${isSidekick ? 'Sidekick' : 'Standard'} window to original factory size?`)) return;
      if (isSidekick) GM_deleteValue('grok_sidekick_defaults');
      else GM_deleteValue('grok_custom_defaults');
      document.getElementById('grokResetSizeBtn').click();
    };

    document.getElementById('grokResetSizeBtn').onclick = (e) => {
      e.stopPropagation();
      const m = document.querySelector('.grok-prompt-modal');
      const isSidekick = getSettings().floatingMode;
      let target;
      if (isSidekick) {
        const custom = JSON.parse(GM_getValue('grok_sidekick_defaults', 'null'));
        target = custom || { top: '130px', left: Math.max(0, window.innerWidth - 585) + 'px', width: '565px', height: '745px' };
      } else {
        const custom = JSON.parse(GM_getValue('grok_custom_defaults', 'null'));
        target = custom || { top: '100px', left: '100px', width: '1463px', height: '809px' };
      }
      m.style.position = isSidekick ? 'fixed' : 'absolute'; m.style.margin = '0';
      m.style.top = target.top; m.style.left = target.left; m.style.width = target.width; m.style.height = target.height;
      if (isSidekick) GM_setValue('grok_modal_pos_sidekick', target);
      else GM_setValue('grok_modal_pos_std', target);
      showToast('Window Reset');
    };

    document.querySelectorAll('.grok-prompt-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.grok-prompt-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        selectedPromptIds.clear();
        const t = tab.dataset.tab;['generate','recent','saved','quick','edited','categories','settings'].forEach(id => {
          document.getElementById('grok'+id.charAt(0).toUpperCase()+id.slice(1)+'Tab').style.display =
            (id === t ? (id==='categories' || id==='generate' || id==='settings' ? 'flex' : 'block') : 'none');
        });
        refreshActiveTab();
      };
    });

    const kbBtn = document.getElementById('grokKeybindBtn');
    const sideKbBtn = document.getElementById('grokSideKeybindBtn');
    kbBtn.onclick = () => { isRecordingKeybind = true; recordingTarget = 'main'; kbBtn.classList.add('recording'); kbBtn.innerText = 'Press keys...'; };
    sideKbBtn.onclick = () => { isRecordingKeybind = true; recordingTarget = 'side'; sideKbBtn.classList.add('recording'); sideKbBtn.innerText = 'Press keys...'; };

    const currentSettings = getSettings();
    if (currentSettings.hideVideoControls) document.body.classList.add('grok-clean-mode');

    document.getElementById('grokAutoTrackToggle').checked = currentSettings.autoTrack;
    document.getElementById('grokSilentModeToggle').checked = currentSettings.silentMode;
    document.getElementById('grokFloatingModeToggle').checked = currentSettings.floatingMode;
    document.getElementById('grokAutoStatsToggle').checked = currentSettings.useAutoStats;
    document.getElementById('grokVideoLoopToggle').checked = currentSettings.disableVideoLoop;
    document.getElementById('grokHideControlsToggle').checked = currentSettings.hideVideoControls;
    document.getElementById('grokAutoOpenToggle').checked = currentSettings.openOnLaunch;
    document.getElementById('grokRetryEnableToggle').checked = currentSettings.retryEnabled;
    document.getElementById('grokShowPreviewsToggle').checked = currentSettings.showMediaPreviews;
    document.getElementById('grokShowSourceImageToggle').checked = currentSettings.showSourceImage;

    document.getElementById('grokAutoTrackToggle').onchange = (e) => { saveSettings({...getSettings(), autoTrack: e.target.checked}); showToast(e.target.checked?'Auto-Capture On':'Auto-Capture Off'); };
    document.getElementById('grokSilentModeToggle').onchange = (e) => { saveSettings({...getSettings(), silentMode: e.target.checked}); showToast(e.target.checked?'Silent Mode On':'Silent Mode Off'); };
    document.getElementById('grokVideoLoopToggle').onchange = (e) => {
      saveSettings({...getSettings(), disableVideoLoop: e.target.checked});
      enforceVideoLoopState();
      showToast(e.target.checked ? 'Video Looping Disabled' : 'Video Looping Enabled');
    };
    document.getElementById('grokHideControlsToggle').onchange = (e) => {
      saveSettings({...getSettings(), hideVideoControls: e.target.checked});
      if (e.target.checked) document.body.classList.add('grok-clean-mode');
      else document.body.classList.remove('grok-clean-mode');
      showToast(e.target.checked ? 'Overlay Controls Hidden' : 'Overlay Controls Visible');
    };
    document.getElementById('grokAutoStatsToggle').onchange = (e) => {
      saveSettings({...getSettings(), useAutoStats: e.target.checked});
      showToast(e.target.checked ? 'Auto-Stats Detection Enabled' : 'Switched to Manual Sliders');
      refreshActiveTab();
    };
    document.getElementById('grokAutoOpenToggle').onchange = (e) => {
      saveSettings({...getSettings(), openOnLaunch: e.target.checked});
      showToast(e.target.checked ? 'Will Open on Load' : 'Will Stay Hidden on Load');
    };
    document.getElementById('grokShowPreviewsToggle').onchange = (e) => {
      saveSettings({...getSettings(), showMediaPreviews: e.target.checked});
      showToast(e.target.checked ? 'Media Previews Visible' : 'Media Previews Hidden');
      refreshActiveTab();
    };
    document.getElementById('grokShowSourceImageToggle').onchange = (e) => {
      saveSettings({...getSettings(), showSourceImage: e.target.checked});
      showToast(e.target.checked ? 'Source Image UUID Visible' : 'Source Image UUID Hidden');
      refreshActiveTab();
    };

    document.getElementById('grokOpenSidePanelBtn').onclick = () => { window.dispatchEvent(new CustomEvent('grokToggleSidePanel')); };

    document.getElementById('grokRetryEnableToggle').onchange = (e) => {
      saveSettings({...getSettings(), retryEnabled: e.target.checked});
      showToast(e.target.checked ? 'Auto-Retry Enabled' : 'Auto-Retry Disabled');
      updateRetryStatus();
    };
    document.getElementById('grokMaxRetryInput').onchange = (e) => {
      let val = parseInt(e.target.value);
      if(val < 1) val = 1; if(val > 50) val = 50;
      e.target.value = val;
      saveSettings({...getSettings(), maxRetries: val});
      updateRetryStatus();
    };
    document.getElementById('grokRetryResetBtn').onclick = () => { retryCount = 0; updateRetryStatus(); showToast('Retry Count Reset'); };

    document.getElementById('grokFloatingModeToggle').onchange = (e) => {
      const isFloating = e.target.checked;
      saveSettings({...getSettings(), floatingMode: isFloating});
      overlay.classList.toggle('mode-floating', isFloating);
      overlay.classList.toggle('mode-centered', !isFloating);
      document.getElementById('grokSetDefaultBtn').innerText = isFloating ? 'Set Sidekick Default' : 'Set Standard Default';
      const m = document.querySelector('.grok-prompt-modal');
      if(isFloating) {
        const pos = GM_getValue('grok_modal_pos_sidekick', null);
        const def = JSON.parse(GM_getValue('grok_sidekick_defaults', 'null'));
        m.style.position = 'fixed';
        if(pos) { m.style.top = pos.top; m.style.left = pos.left; m.style.width = pos.width; m.style.height = pos.height; }
        else if(def) { m.style.top = def.top; m.style.left = def.left; m.style.width = def.width; m.style.height = def.height; }
        else { m.style.top = '130px'; m.style.left = Math.max(0, window.innerWidth - 585) + 'px'; m.style.width = '565px'; m.style.height = '745px'; }
        showToast('Switched to Sidekick');
      } else {
        const pos = GM_getValue('grok_modal_pos_std', null);
        const def = JSON.parse(GM_getValue('grok_custom_defaults', 'null'));
        m.style.position = 'absolute';
        if(pos) { m.style.top = pos.top; m.style.left = pos.left; m.style.width = pos.width; m.style.height = pos.height; }
        else if(def) { m.style.top = def.top; m.style.left = def.left; m.style.width = def.width; m.style.height = def.height; }
        else { m.style.top = '100px'; m.style.left = '100px'; m.style.width = '1463px'; m.style.height = '809px'; }
        showToast('Switched to Standard');
      }
    };

    document.getElementById('grokToggleQuickAdd').onclick = () => {
      const area = document.getElementById('grokQuickAddArea');
      const isHidden = area.style.display === 'none';
      area.style.display = isHidden ? 'block' : 'none';
      if(isHidden) document.getElementById('grokQuickAddInput').focus();
    };

    function quickAddTag(type) {
      const input = document.getElementById('grokQuickAddInput');
      const val = input.value.trim();
      if(!val) return;
      let cats = getCategories();
      if(cats.some(c => c.name === val)) return alert('Category exists');
      cats.push({ name: val, type }); saveCategories(cats);
      renderCategories(); updateCategorySelect();
      document.getElementById('grokCategorySelect').value = val;
      input.value = '';
      document.getElementById('grokQuickAddArea').style.display = 'none';
      showToast(`${type === 'video' ? 'Video' : 'Image'} Tag Created!`);
    }
    document.getElementById('grokQuickAddVidBtn').onclick = () => quickAddTag('video');
    document.getElementById('grokQuickAddImgBtn').onclick = () => quickAddTag('image');

    document.getElementById('grokCancelEditBtn').onclick = () => {
      editingPromptId = null;
      document.getElementById('grokPromptInput').value = '';
      const saveBtn = document.getElementById('grokSaveBtn');
      saveBtn.innerText = "Save Prompt"; saveBtn.style.background = "var(--grok-primary)";
      document.getElementById('grokCancelEditBtn').style.display = 'none';
      showToast('Edit Cancelled');
    };

    document.getElementById('grokSaveBtn').onclick = () => {
      const text = document.getElementById('grokPromptInput').value.trim();
      if (!text) return alert('Please add text.');
      const cat = document.getElementById('grokCategorySelect').value;
      const prompts = getPrompts();
      const catObj = getCategories().find(c => c.name === cat);
      const isImageCat = catObj && catObj.type === 'image';
      let currentAlt = getContextImageAlt();
      if (isImageCat) currentAlt = '';
      if (editingPromptId) {
        const idx = prompts.findIndex(x => x.id === editingPromptId);
        if (idx !== -1) {
          prompts[idx].text = text; prompts[idx].category = cat;
          if (!prompts[idx].attachedAlt && currentAlt) prompts[idx].attachedAlt = currentAlt;
          savePrompts(prompts); showToast('Prompt Updated & Saved!');
        }
        editingPromptId = null;
        document.getElementById('grokSaveBtn').innerText = 'Save Prompt';
        document.getElementById('grokSaveBtn').style.background = 'var(--grok-primary)';
        document.getElementById('grokCancelEditBtn').style.display = 'none';
      } else {
        prompts.push({ id: Date.now().toString(), text, rating: 0, category: cat, attachedAlt: currentAlt, timestamp: Date.now(), stats: { attempts: 0, moderated: 0 }, moderation: 0 });
        savePrompts(prompts); showToast('Prompt Saved!');
      }
      document.getElementById('grokPromptInput').value = '';
      if (isImageCat) document.querySelector('[data-tab="quick"]').click();
      else document.querySelector('[data-tab="saved"]').click();
    };

    document.getElementById('grokAddVideoCatBtn').onclick = () => {
      const val = document.getElementById('grokNewVideoCat').value.trim();
      if (!val) return;
      let cats = getCategories();
      if (cats.some(c => c.name === val)) return alert('Category exists');
      cats.push({ name: val, type: 'video' }); saveCategories(cats);
      document.getElementById('grokNewVideoCat').value = '';
      renderCategories(); updateCategorySelect(); showToast('Video Category added');
    };
    document.getElementById('grokAddImageCatBtn').onclick = () => {
      const val = document.getElementById('grokNewImageCat').value.trim();
      if (!val) return;
      let cats = getCategories();
      if (cats.some(c => c.name === val)) return alert('Category exists');
      cats.push({ name: val, type: 'image' }); saveCategories(cats);
      document.getElementById('grokNewImageCat').value = '';
      renderCategories(); updateCategorySelect(); showToast('Image Category added');
    };

    document.getElementById('grokExportBtn').onclick = () => {
      const blob = new Blob([JSON.stringify({ prompts: getPrompts(), categories: getCategories() }, null, 2)], {type: 'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `grok-prompts-${new Date().toISOString().split('T')[0]}.json`; a.click();
    };
    document.getElementById('grokImportBtn').onclick = () => document.getElementById('grokImportFile').click();
    document.getElementById('grokImportFile').onchange = (e) => {
      const fr = new FileReader();
      fr.onload = (ev) => {
        try {
          const d = JSON.parse(ev.target.result);
          let importedCats = d.categories ||[];
          if (importedCats.length > 0 && typeof importedCats[0] === 'string') importedCats = importedCats.map(c => ({ name: c, type: 'video' }));
          if (confirm('Merge with existing (OK) or Replace All (Cancel)?')) {
            let map = new Map(getPrompts().map(p =>[p.id, p]));
            (d.prompts ||[]).forEach(p => map.set(p.id, { ...map.get(p.id), ...p }));
            savePrompts(Array.from(map.values()));
            const currentCats = getCategories();
            importedCats.forEach(ic => { if (!currentCats.some(cc => cc.name === ic.name)) currentCats.push(ic); });
            saveCategories(currentCats);
          } else {
            savePrompts(d.prompts ||[]);
            saveCategories(importedCats.length ? importedCats :[{name:'General', type:'video'}, {name:'General Image', type:'image'}]);
          }
          showToast('Import Successful'); refreshActiveTab(); renderCategories(); updateCategorySelect();
        } catch(err) { alert('Invalid file format'); }
      };
      fr.readAsText(e.target.files[0]);
    };

    document.addEventListener('keydown', (e) => {
      if (isRecordingKeybind) {
        e.preventDefault(); e.stopPropagation();
        if (['Control','Alt','Shift','Meta'].includes(e.key)) return;
        const newKb = { key: e.key, altKey: e.altKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, metaKey: e.metaKey };

        if (recordingTarget === 'side') {
          saveSettings({...getSettings(), sidePanelKeybind: newKb});
          document.getElementById('grokSideKeybindDisplay').innerText = getKeybindString(newKb);
          sideKbBtn.classList.remove('recording'); sideKbBtn.innerText = 'Change';
        } else {
          saveSettings({...getSettings(), keybind: newKb});
          document.getElementById('grokKeybindDisplay').innerText = getKeybindString(newKb);
          kbBtn.classList.remove('recording'); kbBtn.innerText = 'Change';
        }
        isRecordingKeybind = false;
        showToast('Keybind Saved');
        return;
      }

      // Alt+L loop toggle
      if (e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        const s = getSettings();
        const newState = !s.disableVideoLoop;
        saveSettings({ ...s, disableVideoLoop: newState });
        document.getElementById('grokVideoLoopToggle').checked = newState;
        enforceVideoLoopState();
        showToast(newState ? 'Video Looping Disabled' : 'Video Looping Enabled');
        return;
      }

      const s = getSettings();

      // main modal keybind
      const kb = s.keybind;
      if (e.key.toLowerCase() === kb.key.toLowerCase() &&
          e.altKey === !!kb.altKey && e.ctrlKey === !!kb.ctrlKey &&
          e.shiftKey === !!kb.shiftKey && e.metaKey === !!kb.metaKey) {
        e.preventDefault();
        isOpen = !isOpen;
        if (isOpen) {
          overlay.style.display = 'flex'; overlay.offsetHeight; overlay.classList.add('open');
          updateCounts(); updateCategorySelect(); refreshActiveTab();
        } else {
          overlay.classList.remove('open'); setTimeout(() => overlay.style.display = 'none', 200);
        }
      }

      // side panel keybind
      const sideKb = s.sidePanelKeybind || { key: 'k', altKey: true, ctrlKey: false, shiftKey: false, metaKey: false };
      if (e.key.toLowerCase() === sideKb.key.toLowerCase() &&
          e.altKey === !!sideKb.altKey && e.ctrlKey === !!sideKb.ctrlKey &&
          e.shiftKey === !!sideKb.shiftKey && e.metaKey === !!sideKb.metaKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('grokToggleSidePanel'));
      }

      if (e.key === 'Escape' && isOpen) document.getElementById('grokCloseBtn').click();
    });

    // final refresh
    updateCounts();
    updateCategorySelect();
    updateRetryStatus();

    if (currentSettings.openOnLaunch) {
      isOpen = true;
      overlay.style.display = 'flex';
      overlay.offsetHeight;
      overlay.classList.add('open');
      updateCounts();
      updateCategorySelect();
      refreshActiveTab();
    }

    // Initialize all consolidated modules (Enhancer, VGEN, Queue)
    initConsolidatedModules();
  }

  function safeInit() {
    try {
      initScript();
    } catch (e) {
      console.error('[GrokSuite] FATAL: Script initialization failed:', e);
      // Show a visible error so the user knows something went wrong
      const errDiv = document.createElement('div');
      errDiv.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1a1a2e;color:#f4212e;padding:12px 20px;border-radius:10px;z-index:99999;font-family:sans-serif;font-size:13px;border:1px solid #f4212e;box-shadow:0 4px 12px rgba(0,0,0,0.5);cursor:pointer;';
      errDiv.textContent = '[GrokSuite] Init failed — check console (click to dismiss)';
      errDiv.onclick = () => errDiv.remove();
      document.body.appendChild(errDiv);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeInit);
  else safeInit();

})();