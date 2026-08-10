// ==UserScript==
// @name         (小说漫画)网页自动滚动+跳转
// @author       bluesatan
// @namespace    https://github.com/bluesatan0-0/WebpageAutoScrollNext
// @version      1.8
// @description  网页自动滚动，1~100速度可调，各网站速度独立保存。主控面板可拖拽、吸附边沿、自动隐藏。滚动效果丝滑流畅。新增"顶/底"快速跳转按钮。支持手动指定跳转按钮。支持空格键切换滚动。
// @match        *://*/*
// @grant        none
// @date         2026.08.10
// @license	 MIT license
// @downloadURL https://update.greasyfork.org/scripts/590642/%28%E5%B0%8F%E8%AF%B4%E6%BC%AB%E7%94%BB%29%E7%BD%91%E9%A1%B5%E8%87%AA%E5%8A%A8%E6%BB%9A%E5%8A%A8%2B%E8%B7%B3%E8%BD%AC.user.js
// @updateURL https://update.greasyfork.org/scripts/590642/%28%E5%B0%8F%E8%AF%B4%E6%BC%AB%E7%94%BB%29%E7%BD%91%E9%A1%B5%E8%87%AA%E5%8A%A8%E6%BB%9A%E5%8A%A8%2B%E8%B7%B3%E8%BD%AC.meta.js

// ==/UserScript==
(function () {
  'use strict';
  if (window.top !== window) return;
  let scrolling = false;
  let scrollRAF = null;
  let scrollTimestamp = 0;
  let scrollAccumulated = 0;

  let hideTimeout = null;
  let lastYPosition = null;
  let panelSide = 'left';
  let mouseOnPanel = false;
  let mouseOnMini = false;
  let mouseOnTopBtn = false;
  let mouseOnBottomBtn = false;

  const PANEL_WIDTH = 92;
  const PANEL_HEIGHT = 130;
  const BTN_SIZE = 38;
  const BTN_GAP = 6;
  const STORAGE_KEY = 'autoScrollPanel_v2_viewport';

  const CONFIG_STORAGE_KEY = 'autoScrollConfig_v1';
  const SCROLL_STATE_KEY = 'autoScrollState_v1';
  const DELAY_STORAGE_KEY = 'autoScrollDelay_v1';
  const CONFIG_PANEL_WIDTH = 340;

  let triggeredNextPage = false;
  let configVisible = false;
  let mouseOnConfigPanel = false;
  let nextPageDelayTimer = null;

  // ========== 配置改为"自定义选择器"，不再作为白名单 ==========
  const DEFAULT_RULES = `# 可选：为特定网站自定义下一页按钮选择器
# 格式：域名模式|CSS选择器|文本关键词
# 当自动检测不准时，可在此指定精确选择器
# 示例（请根据实际网站修改）：
# *qidian.com*|a#nextChapter|下一章
# *biquge*|.bottem2 a:nth-child(3)|
`;

  function getSpeedStorageKey() {
    return 'autoScrollSpeed_site_' + location.hostname;
  }

  let savedPos = null;
  try {
    savedPos = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    savedPos = null;
  }

  if (savedPos && (savedPos.side === 'left' || savedPos.side === 'right') && typeof savedPos.y === 'number') {
    panelSide = savedPos.side;
    lastYPosition = savedPos.y;
  } else {
    panelSide = 'left';
    lastYPosition = Math.min(window.innerHeight * 0.4, window.innerHeight - PANEL_HEIGHT);
  }

  const panel = document.createElement('div');
  panel.style.position = 'fixed';
  panel.style.width = PANEL_WIDTH + 'px';
  panel.style.height = PANEL_HEIGHT + 'px';
  panel.style.zIndex = '999998';
  panel.style.background = 'rgba(28, 28, 32, 0.88)';
  panel.style.backdropFilter = 'blur(16px)';
  panel.style.WebkitBackdropFilter = 'blur(16px)';
  panel.style.borderRadius = panelSide === 'left' ? '0 16px 16px 0' : '16px 0 0 16px';
  panel.style.boxShadow = '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)';
  panel.style.border = '1px solid rgba(255,255,255,0.08)';
  panel.style.borderLeft = panelSide === 'left' ? 'none' : '1px solid rgba(255,255,255,0.08)';
  panel.style.borderRight = panelSide === 'right' ? 'none' : '1px solid rgba(255,255,255,0.08)';
  panel.style.padding = '14px 10px 12px 10px';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.justifyContent = 'space-between';
  panel.style.alignItems = 'center';
  panel.style.boxSizing = 'border-box';
  panel.style.cursor = 'grab';
  panel.style.opacity = '1';
  panel.style.pointerEvents = 'auto';
  panel.style.transition = 'opacity 0.25s ease, transform 0.25s ease';

  panel.style.left = panelSide === 'left' ? '0px' : (window.innerWidth - PANEL_WIDTH) + 'px';
  panel.style.top = Math.max(0, Math.min(lastYPosition, window.innerHeight - PANEL_HEIGHT)) + 'px';

  const speedLabel = document.createElement('div');
  speedLabel.innerText = '速度';
  speedLabel.style.color = 'rgba(255,255,255,0.4)';
  speedLabel.style.fontSize = '11px';
  speedLabel.style.fontWeight = '500';
  speedLabel.style.letterSpacing = '1px';
  speedLabel.style.marginBottom = '2px';

  const speedInput = document.createElement('input');
  speedInput.type = 'number';
  speedInput.min = '1';
  speedInput.max = '100';
  let savedSpeed = 10;
  try {
    const stored = localStorage.getItem(getSpeedStorageKey());
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 100) savedSpeed = parsed;
    }
  } catch (e) {}
  speedInput.value = String(savedSpeed);

  speedInput.style.width = '72px';
  speedInput.style.height = '34px';
  speedInput.style.textAlign = 'center';
  speedInput.style.fontSize = '15px';
  speedInput.style.fontWeight = 'bold';
  speedInput.style.border = '1px solid rgba(255,255,255,0.12)';
  speedInput.style.borderRadius = '10px';
  speedInput.style.background = 'rgba(255,255,255,0.06)';
  speedInput.style.color = '#fff';
  speedInput.style.outline = 'none';
  speedInput.style.padding = '0 4px';
  speedInput.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.2)';
  speedInput.style.transition = 'border-color 0.2s, background 0.2s';
  speedInput.style.appearance = 'none';
  speedInput.style.MozAppearance = 'textfield';

  speedInput.addEventListener('focus', () => {
    speedInput.style.borderColor = 'rgba(99,102,241,0.6)';
    speedInput.style.background = 'rgba(255,255,255,0.1)';
  });
  speedInput.addEventListener('blur', () => {
    speedInput.style.borderColor = 'rgba(255,255,255,0.12)';
    speedInput.style.background = 'rgba(255,255,255,0.06)';
  });
  speedInput.addEventListener('change', () => {
    let v = parseInt(speedInput.value, 10);
    if (isNaN(v) || v < 1) v = 1;
    if (v > 100) v = 100;
    speedInput.value = String(v);
    try {
      localStorage.setItem(getSpeedStorageKey(), String(v));
    } catch (e) {}
  });
  speedInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      speedInput.blur();
      if (!scrolling) {
        startScroll();
      }
      resetHideTimer();
    }
  });

  const toggleBtn = document.createElement('button');
  toggleBtn.innerHTML = '▶';
  toggleBtn.style.width = '48px';
  toggleBtn.style.height = '48px';
  toggleBtn.style.border = 'none';
  toggleBtn.style.borderRadius = '50%';
  toggleBtn.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
  toggleBtn.style.color = '#fff';
  toggleBtn.style.fontSize = '18px';
  toggleBtn.style.cursor = 'pointer';
  toggleBtn.style.display = 'flex';
  toggleBtn.style.justifyContent = 'center';
  toggleBtn.style.alignItems = 'center';
  toggleBtn.style.outline = 'none';
  toggleBtn.style.boxShadow = '0 4px 14px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.2)';
  toggleBtn.style.transition = 'transform 0.15s ease, box-shadow 0.2s ease';
  toggleBtn.style.marginTop = '6px';

  toggleBtn.addEventListener('mouseenter', () => {
    toggleBtn.style.transform = 'scale(1.08)';
    toggleBtn.style.boxShadow = '0 6px 20px rgba(99,102,241,0.55), inset 0 1px 0 rgba(255,255,255,0.2)';
  });
  toggleBtn.addEventListener('mouseleave', () => {
    toggleBtn.style.transform = 'scale(1)';
    toggleBtn.style.boxShadow = '0 4px 14px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.2)';
  });

  const configBtn = document.createElement('button');
  configBtn.innerHTML = '⚙';
  configBtn.title = '配置自定义选择器';
  configBtn.style.position = 'absolute';
  configBtn.style.top = '6px';
  configBtn.style.right = '6px';
  configBtn.style.width = '24px';
  configBtn.style.height = '24px';
  configBtn.style.border = 'none';
  configBtn.style.borderRadius = '6px';
  configBtn.style.background = 'rgba(255,255,255,0.06)';
  configBtn.style.color = 'rgba(255,255,255,0.45)';
  configBtn.style.fontSize = '13px';
  configBtn.style.cursor = 'pointer';
  configBtn.style.display = 'flex';
  configBtn.style.justifyContent = 'center';
  configBtn.style.alignItems = 'center';
  configBtn.style.padding = '0';
  configBtn.style.lineHeight = '1';
  configBtn.style.zIndex = '10';
  configBtn.style.transition = 'all 0.2s ease';

  configBtn.addEventListener('mouseenter', () => {
    configBtn.style.background = 'rgba(255,255,255,0.15)';
    configBtn.style.color = 'rgba(255,255,255,0.9)';
  });
  configBtn.addEventListener('mouseleave', () => {
    configBtn.style.background = 'rgba(255,255,255,0.06)';
    configBtn.style.color = 'rgba(255,255,255,0.45)';
  });

  panel.appendChild(configBtn);
  panel.appendChild(speedLabel);
  panel.appendChild(speedInput);
  panel.appendChild(toggleBtn);
  document.body.appendChild(panel);

  const configPanel = document.createElement('div');
  configPanel.style.position = 'fixed';
  configPanel.style.zIndex = '999997';
  configPanel.style.width = CONFIG_PANEL_WIDTH + 'px';
  configPanel.style.background = 'rgba(24, 24, 28, 0.95)';
  configPanel.style.backdropFilter = 'blur(20px)';
  configPanel.style.WebkitBackdropFilter = 'blur(20px)';
  configPanel.style.borderRadius = '16px';
  configPanel.style.boxShadow = '0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)';
  configPanel.style.padding = '18px';
  configPanel.style.display = 'none';
  configPanel.style.flexDirection = 'column';
  configPanel.style.gap = '12px';
  configPanel.style.color = '#e8e8e8';
  configPanel.style.fontSize = '13px';
  configPanel.style.border = '1px solid rgba(255,255,255,0.08)';
  configPanel.style.boxSizing = 'border-box';

  const configTitle = document.createElement('div');
  configTitle.innerText = '自定义选择器配置';
  configTitle.style.fontWeight = 'bold';
  configTitle.style.fontSize = '16px';
  configTitle.style.color = '#fff';
  configTitle.style.display = 'flex';
  configTitle.style.justifyContent = 'space-between';
  configTitle.style.alignItems = 'center';
  configTitle.style.marginBottom = '2px';

  const configCloseX = document.createElement('span');
  configCloseX.innerHTML = '✕';
  configCloseX.style.cursor = 'pointer';
  configCloseX.style.color = 'rgba(255,255,255,0.4)';
  configCloseX.style.fontSize = '18px';
  configCloseX.style.marginLeft = '8px';
  configCloseX.style.transition = 'color 0.2s';
  configCloseX.addEventListener('mouseenter', () => configCloseX.style.color = '#fff');
  configCloseX.addEventListener('mouseleave', () => configCloseX.style.color = 'rgba(255,255,255,0.4)');
  configTitle.appendChild(configCloseX);
  configPanel.appendChild(configTitle);

  const configDesc = document.createElement('div');
  configDesc.innerHTML = '当自动检测"下一页"按钮不准时，可在此指定精确选择器。<br>格式：<b style="color:#a5b4fc">域名模式|CSS选择器|文本关键词</b><br>使用 <b style="color:#a5b4fc">*</b> 作为通配符。留空表示使用自动检测。';
  configDesc.style.color = 'rgba(255,255,255,0.45)';
  configDesc.style.fontSize = '12px';
  configDesc.style.lineHeight = '1.6';
  configPanel.appendChild(configDesc);

  const configTextarea = document.createElement('textarea');
  configTextarea.style.width = '100%';
  configTextarea.style.height = '140px';
  configTextarea.style.background = 'rgba(255,255,255,0.04)';
  configTextarea.style.color = '#e0e0e0';
  configTextarea.style.border = '1px solid rgba(255,255,255,0.1)';
  configTextarea.style.borderRadius = '10px';
  configTextarea.style.padding = '10px';
  configTextarea.style.fontSize = '12px';
  configTextarea.style.resize = 'vertical';
  configTextarea.style.boxSizing = 'border-box';
  configTextarea.style.fontFamily = 'monospace, Consolas, "Courier New"';
  configTextarea.style.lineHeight = '1.6';
  configTextarea.style.outline = 'none';
  configTextarea.style.transition = 'border-color 0.2s';
  configTextarea.spellcheck = false;
  configTextarea.addEventListener('focus', () => {
    configTextarea.style.borderColor = 'rgba(99,102,241,0.5)';
    configTextarea.style.background = 'rgba(255,255,255,0.06)';
  });
  configTextarea.addEventListener('blur', () => {
    configTextarea.style.borderColor = 'rgba(255,255,255,0.1)';
    configTextarea.style.background = 'rgba(255,255,255,0.04)';
  });
  configPanel.appendChild(configTextarea);

  const delayRow = document.createElement('div');
  delayRow.style.display = 'flex';
  delayRow.style.alignItems = 'center';
  delayRow.style.gap = '10px';
  delayRow.style.marginTop = '2px';

  const delayLabel = document.createElement('span');
  delayLabel.innerText = '跳转延迟';
  delayLabel.style.color = 'rgba(255,255,255,0.6)';
  delayLabel.style.fontSize = '13px';
  delayLabel.style.whiteSpace = 'nowrap';

  const delayInput = document.createElement('input');
  delayInput.type = 'number';
  delayInput.min = '0';
  delayInput.max = '10';
  delayInput.step = '0.5';
  let savedDelay = 2;
  try {
    const stored = localStorage.getItem(DELAY_STORAGE_KEY);
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 10) savedDelay = parsed;
    }
  } catch (e) {}
  delayInput.value = String(savedDelay);

  delayInput.style.width = '70px';
  delayInput.style.height = '30px';
  delayInput.style.textAlign = 'center';
  delayInput.style.fontSize = '13px';
  delayInput.style.fontWeight = 'bold';
  delayInput.style.border = '1px solid rgba(255,255,255,0.12)';
  delayInput.style.borderRadius = '8px';
  delayInput.style.background = 'rgba(255,255,255,0.06)';
  delayInput.style.color = '#fff';
  delayInput.style.outline = 'none';
  delayInput.style.padding = '0 4px';
  delayInput.style.appearance = 'none';
  delayInput.style.MozAppearance = 'textfield';

  delayInput.addEventListener('focus', () => {
    delayInput.style.borderColor = 'rgba(99,102,241,0.6)';
    delayInput.style.background = 'rgba(255,255,255,0.1)';
  });
  delayInput.addEventListener('blur', () => {
    delayInput.style.borderColor = 'rgba(255,255,255,0.12)';
    delayInput.style.background = 'rgba(255,255,255,0.06)';
  });
  delayInput.addEventListener('change', () => {
    let v = parseFloat(delayInput.value);
    if (isNaN(v) || v < 0) v = 0;
    if (v > 10) v = 10;
    v = Math.round(v * 2) / 2;
    delayInput.value = String(v);
    try {
      localStorage.setItem(DELAY_STORAGE_KEY, String(v));
    } catch (e) {}
  });

  const delayUnit = document.createElement('span');
  delayUnit.innerText = '秒';
  delayUnit.style.color = 'rgba(255,255,255,0.4)';
  delayUnit.style.fontSize = '12px';

  delayRow.appendChild(delayLabel);
  delayRow.appendChild(delayInput);
  delayRow.appendChild(delayUnit);
  configPanel.appendChild(delayRow);

  const configBtnRow = document.createElement('div');
  configBtnRow.style.display = 'flex';
  configBtnRow.style.gap = '10px';
  configBtnRow.style.justifyContent = 'flex-end';
  configBtnRow.style.marginTop = '4px';

  const resetConfigBtn = document.createElement('button');
  resetConfigBtn.innerText = '恢复默认';
  resetConfigBtn.style.padding = '8px 14px';
  resetConfigBtn.style.border = '1px solid rgba(255,255,255,0.15)';
  resetConfigBtn.style.borderRadius = '8px';
  resetConfigBtn.style.background = 'rgba(255,255,255,0.05)';
  resetConfigBtn.style.color = 'rgba(255,255,255,0.6)';
  resetConfigBtn.style.cursor = 'pointer';
  resetConfigBtn.style.fontSize = '13px';
  resetConfigBtn.style.transition = 'all 0.2s';
  resetConfigBtn.addEventListener('mouseenter', () => {
    resetConfigBtn.style.background = 'rgba(255,255,255,0.1)';
    resetConfigBtn.style.color = '#fff';
  });
  resetConfigBtn.addEventListener('mouseleave', () => {
    resetConfigBtn.style.background = 'rgba(255,255,255,0.05)';
    resetConfigBtn.style.color = 'rgba(255,255,255,0.6)';
  });

  const saveConfigBtn = document.createElement('button');
  saveConfigBtn.innerText = '保存';
  saveConfigBtn.style.padding = '8px 18px';
  saveConfigBtn.style.border = 'none';
  saveConfigBtn.style.borderRadius = '8px';
  saveConfigBtn.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
  saveConfigBtn.style.color = '#fff';
  saveConfigBtn.style.cursor = 'pointer';
  saveConfigBtn.style.fontSize = '13px';
  saveConfigBtn.style.fontWeight = 'bold';
  saveConfigBtn.style.boxShadow = '0 2px 8px rgba(99,102,241,0.35)';
  saveConfigBtn.style.transition = 'transform 0.15s, box-shadow 0.2s';
  saveConfigBtn.addEventListener('mouseenter', () => {
    saveConfigBtn.style.transform = 'translateY(-1px)';
    saveConfigBtn.style.boxShadow = '0 4px 14px rgba(99,102,241,0.5)';
  });
  saveConfigBtn.addEventListener('mouseleave', () => {
    saveConfigBtn.style.transform = 'translateY(0)';
    saveConfigBtn.style.boxShadow = '0 2px 8px rgba(99,102,241,0.35)';
  });

  configBtnRow.appendChild(resetConfigBtn);
  configBtnRow.appendChild(saveConfigBtn);
  configPanel.appendChild(configBtnRow);
  document.body.appendChild(configPanel);

  const topBtn = document.createElement('div');
  topBtn.innerHTML = '↑';
  topBtn.style.position = 'fixed';
  topBtn.style.zIndex = '999999';
  topBtn.style.width = BTN_SIZE + 'px';
  topBtn.style.height = BTN_SIZE + 'px';
  topBtn.style.borderRadius = '50%';
  topBtn.style.background = 'rgba(28, 28, 32, 0.88)';
  topBtn.style.backdropFilter = 'blur(12px)';
  topBtn.style.WebkitBackdropFilter = 'blur(12px)';
  topBtn.style.color = 'rgba(255,255,255,0.7)';
  topBtn.style.display = 'flex';
  topBtn.style.justifyContent = 'center';
  topBtn.style.alignItems = 'center';
  topBtn.style.fontSize = '18px';
  topBtn.style.fontWeight = 'bold';
  topBtn.style.cursor = 'pointer';
  topBtn.style.boxShadow = '0 4px 14px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)';
  topBtn.style.userSelect = 'none';
  topBtn.style.border = '1px solid rgba(255,255,255,0.08)';
  topBtn.style.transition = 'transform 0.15s, color 0.2s';
  topBtn.addEventListener('mouseenter', () => {
    topBtn.style.transform = 'scale(1.1)';
    topBtn.style.color = '#fff';
  });
  topBtn.addEventListener('mouseleave', () => {
    topBtn.style.transform = 'scale(1)';
    topBtn.style.color = 'rgba(255,255,255,0.7)';
  });

  const bottomBtn = document.createElement('div');
  bottomBtn.innerHTML = '↓';
  bottomBtn.style.position = 'fixed';
  bottomBtn.style.zIndex = '999999';
  bottomBtn.style.width = BTN_SIZE + 'px';
  bottomBtn.style.height = BTN_SIZE + 'px';
  bottomBtn.style.borderRadius = '50%';
  bottomBtn.style.background = 'rgba(28, 28, 32, 0.88)';
  bottomBtn.style.backdropFilter = 'blur(12px)';
  bottomBtn.style.WebkitBackdropFilter = 'blur(12px)';
  bottomBtn.style.color = 'rgba(255,255,255,0.7)';
  bottomBtn.style.display = 'flex';
  bottomBtn.style.justifyContent = 'center';
  bottomBtn.style.alignItems = 'center';
  bottomBtn.style.fontSize = '18px';
  bottomBtn.style.fontWeight = 'bold';
  bottomBtn.style.cursor = 'pointer';
  bottomBtn.style.boxShadow = '0 4px 14px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)';
  bottomBtn.style.userSelect = 'none';
  bottomBtn.style.border = '1px solid rgba(255,255,255,0.08)';
  bottomBtn.style.transition = 'transform 0.15s, color 0.2s';
  bottomBtn.addEventListener('mouseenter', () => {
    bottomBtn.style.transform = 'scale(1.1)';
    bottomBtn.style.color = '#fff';
  });
  bottomBtn.addEventListener('mouseleave', () => {
    bottomBtn.style.transform = 'scale(1)';
    bottomBtn.style.color = 'rgba(255,255,255,0.7)';
  });

  document.body.appendChild(topBtn);
  document.body.appendChild(bottomBtn);

  const updateHelperButtonsPosition = () => {
    const panelRect = panel.getBoundingClientRect();
    const centerX = panelRect.left + PANEL_WIDTH / 2;
    const topY = panelRect.top - BTN_SIZE - BTN_GAP;
    const bottomY = panelRect.bottom + BTN_GAP;

    topBtn.style.left = (centerX - BTN_SIZE / 2) + 'px';
    topBtn.style.top = Math.max(8, topY) + 'px';

    bottomBtn.style.left = (centerX - BTN_SIZE / 2) + 'px';
    bottomBtn.style.top = Math.min(window.innerHeight - BTN_SIZE - 8, bottomY) + 'px';
  };

  topBtn.addEventListener('mouseenter', () => {
    mouseOnTopBtn = true;
    resetHideTimer();
  });
  topBtn.addEventListener('mouseleave', () => {
    mouseOnTopBtn = false;
    startAutoHide();
  });

  bottomBtn.addEventListener('mouseenter', () => {
    mouseOnBottomBtn = true;
    resetHideTimer();
  });
  bottomBtn.addEventListener('mouseleave', () => {
    mouseOnBottomBtn = false;
    startAutoHide();
  });

  topBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  bottomBtn.addEventListener('click', () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: maxScroll, behavior: 'smooth' });
    stopScroll();
  });

  const miniButton = document.createElement('div');
  miniButton.innerHTML = '▶';
  miniButton.style.position = 'fixed';
  miniButton.style.zIndex = '999999';
  miniButton.style.width = '32px';
  miniButton.style.height = '32px';
  miniButton.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
  miniButton.style.color = '#fff';
  miniButton.style.borderRadius = '50%';
  miniButton.style.display = 'none';
  miniButton.style.justifyContent = 'center';
  miniButton.style.alignItems = 'center';
  miniButton.style.cursor = 'pointer';
  miniButton.style.fontSize = '12px';
  miniButton.style.boxShadow = '0 4px 14px rgba(99,102,241,0.45)';
  miniButton.style.border = 'none';
  miniButton.style.transition = 'transform 0.15s';
  miniButton.addEventListener('mouseenter', () => {
    miniButton.style.transform = 'scale(1.1)';
  });
  miniButton.addEventListener('mouseleave', () => {
    miniButton.style.transform = 'scale(1)';
  });
  document.body.appendChild(miniButton);

  panel.addEventListener('mouseenter', () => {
    mouseOnPanel = true;
    resetHideTimer();
  });
  panel.addEventListener('mouseleave', () => {
    mouseOnPanel = false;
    startAutoHide();
  });
  miniButton.addEventListener('mouseenter', () => {
    mouseOnMini = true;
    miniButton.style.display = 'none';
    miniButton.style.opacity = '0';
    panel.style.opacity = '1';
    panel.style.pointerEvents = 'auto';
    panel.style.top = miniButton.style.top;
    if (panelSide === 'left') {
      panel.style.left = '0px';
      panel.style.borderRadius = '0 16px 16px 0';
    } else {
      panel.style.left = (window.innerWidth - PANEL_WIDTH) + 'px';
      panel.style.borderRadius = '16px 0 0 16px';
    }
    resetHideTimer();
  });
  miniButton.addEventListener('mouseleave', () => {
    mouseOnMini = false;
    startAutoHide();
  });

  function startAutoHide() {
    if (mouseOnPanel || mouseOnMini || mouseOnTopBtn || mouseOnBottomBtn || mouseOnConfigPanel) return;
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(hidePanel, 1200);
  }
  function hidePanel() {
    const rect = panel.getBoundingClientRect();
    lastYPosition = rect.top;
    const centerX = rect.left + PANEL_WIDTH / 2;
    panelSide = centerX < window.innerWidth / 2 ? 'left' : 'right';

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        side: panelSide,
        y: lastYPosition
      }));
    } catch (e) {}

    panel.style.opacity = '0';
    panel.style.pointerEvents = 'none';
    miniButton.style.display = 'flex';
    topBtn.style.display = 'none';
    bottomBtn.style.display = 'none';

    configVisible = false;
    configPanel.style.display = 'none';

    if (panelSide === 'left') {
      miniButton.style.left = '0';
      miniButton.style.borderRadius = '0 50% 50% 0';
    } else {
      miniButton.style.right = '0';
      miniButton.style.borderRadius = '50% 0 0 50%';
    }

    miniButton.style.top = (lastYPosition + (PANEL_HEIGHT - 32) / 2) + 'px';
    miniButton.style.opacity = '1';
  }
  function resetHideTimer() {
    clearTimeout(hideTimeout);
    if (!mouseOnPanel && !mouseOnMini && !mouseOnTopBtn && !mouseOnBottomBtn && !mouseOnConfigPanel) {
      startAutoHide();
    } else {
      panel.style.opacity = '1';
      panel.style.pointerEvents = 'auto';
      topBtn.style.display = 'flex';
      bottomBtn.style.display = 'flex';
      updateHelperButtonsPosition();
    }
  }

  configBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    configVisible = !configVisible;
    if (configVisible) {
      positionConfigPanel();
      configPanel.style.display = 'flex';
    } else {
      configPanel.style.display = 'none';
    }
    resetHideTimer();
  });

  configPanel.addEventListener('mouseenter', () => {
    mouseOnConfigPanel = true;
    resetHideTimer();
  });
  configPanel.addEventListener('mouseleave', () => {
    mouseOnConfigPanel = false;
    startAutoHide();
  });

  configCloseX.addEventListener('click', () => {
    configVisible = false;
    configPanel.style.display = 'none';
    loadConfig();
    loadDelay();
  });

  saveConfigBtn.addEventListener('click', () => {
    saveConfig();
    saveDelay();
    configVisible = false;
    configPanel.style.display = 'none';
  });

  resetConfigBtn.addEventListener('click', () => {
    if (confirm('确定要恢复默认吗？')) {
      configTextarea.value = DEFAULT_RULES;
      delayInput.value = '2';
    }
  });

  function positionConfigPanel() {
    const rect = panel.getBoundingClientRect();
    if (panelSide === 'left') {
      configPanel.style.left = (rect.right + 12) + 'px';
    } else {
      configPanel.style.left = (rect.left - CONFIG_PANEL_WIDTH - 12) + 'px';
    }
    configPanel.style.top = Math.max(12, Math.min(rect.top, window.innerHeight - 400)) + 'px';
  }

  function loadConfig() {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      configTextarea.value = saved || DEFAULT_RULES;
    } catch (e) {
      configTextarea.value = DEFAULT_RULES;
    }
  }

  function saveConfig() {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, configTextarea.value);
    } catch (e) {}
  }

  function loadDelay() {
    try {
      const saved = localStorage.getItem(DELAY_STORAGE_KEY);
      if (saved !== null) {
        const v = parseFloat(saved);
        if (!isNaN(v) && v >= 0 && v <= 10) {
          delayInput.value = String(Math.round(v * 2) / 2);
          return;
        }
      }
    } catch (e) {}
    delayInput.value = '2';
  }

  function saveDelay() {
    try {
      localStorage.setItem(DELAY_STORAGE_KEY, delayInput.value);
    } catch (e) {}
  }

  function getDelayMs() {
    const v = parseFloat(delayInput.value);
    if (isNaN(v) || v < 0) return 2000;
    return Math.round(v * 1000);
  }

  function parseRules(text) {
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const parts = line.split('|');
        return {
          pattern: (parts[0] || '').trim(),
          selector: (parts[1] || '').trim(),
          keyword: (parts[2] || '').trim()
        };
      });
  }

  function isElementVisible(el) {
    if (!el) return false;
    if (!document.body.contains(el)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
    if (parseFloat(style.opacity) < 0.05) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function findNextButtonGeneric() {
    const keywords = [
      '下一章', '下一页', 'next chapter', '下一节', '下章', '下页',
      '下一话', 'next_chap', 'next chap', '下一回', '下一卷',
      '下一篇', '下回', 'next page', '下一章節', '下一話',
      '下一頁', '下一节', '下节', '下話', '次の章', '次へ',
      '다음', '다음 장', '다음 화', '后一章', '后一节', '后一页'
    ];

    const selector = 'a, button, [role="button"], input[type="button"], input[type="submit"], div, span, li, p, strong, b, em, i, label, td, th, h1, h2, h3, h4, h5, h6';
    const elements = document.querySelectorAll(selector);

    let bestMatch = null;
    let bestScore = 0;

    for (const el of elements) {
      const rawText = (el.innerText || el.textContent || el.value || el.title || el.getAttribute('aria-label') || '').toLowerCase();
      const text = rawText.replace(/\s+/g, ' ').trim();

      let matchedKeyword = null;
      for (const kw of keywords) {
        if (text === kw.toLowerCase() || text.includes(kw.toLowerCase())) {
          matchedKeyword = kw;
          break;
        }
      }

      if (!matchedKeyword) continue;
      if (!isElementVisible(el)) continue;

      let score = 100;
      if (text === matchedKeyword.toLowerCase()) score += 50;
      if (el.tagName === 'A') score += 30;
      if (el.tagName === 'BUTTON') score += 25;
      if (el.onclick || el.getAttribute('onclick')) score += 20;
      if (el.getAttribute('href')) score += 15;
      if (text.length > matchedKeyword.length + 10) score -= 30;
      let depth = 0, parent = el.parentElement;
      while (parent && depth < 10) { depth++; parent = parent.parentElement; }
      score -= depth * 2;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = el;
      }
    }

    if (!bestMatch) {
      const links = document.querySelectorAll('a[href]');
      for (const link of links) {
        const href = (link.getAttribute('href') || '').toLowerCase();
        const text = (link.innerText || link.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (href.includes('next') || href.includes('chapter') || href.match(/\d+/) || href.includes('page')) {
          if (text.includes('下') || text.includes('next') || text.includes('后') || text.includes('▶') || text.includes('→') || text.includes('>')) {
            if (isElementVisible(link)) {
              bestMatch = link;
              break;
            }
          }
        }
      }
    }

    return bestMatch;
  }

  // ========== 查找下一页：优先使用自定义选择器，否则自动检测 ==========
  function findNextPageButton() {
    const rules = parseRules(configTextarea.value);
    const hostname = location.hostname.toLowerCase();

    // 查找匹配当前域名的规则
    const matchedRule = rules.find(rule => {
      if (!rule.pattern) return false;
      const pattern = rule.pattern.replace(/\*/g, '.*');
      try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(hostname);
      } catch (e) {
        return hostname.includes(rule.pattern.replace(/\*/g, ''));
      }
    });

    // 如果匹配到规则且提供了选择器，优先使用
    if (matchedRule && matchedRule.selector) {
      const btn = document.querySelector(matchedRule.selector);
      if (btn && isElementVisible(btn)) {
        if (!matchedRule.keyword) return btn;
        const text = (btn.innerText || btn.textContent || '').toLowerCase();
        if (text.includes(matchedRule.keyword.toLowerCase())) {
          return btn;
        }
      }
    }

    // 否则使用通用自动检测
    return findNextButtonGeneric();
  }

  function restoreScrollState() {
    try {
      const state = JSON.parse(sessionStorage.getItem(SCROLL_STATE_KEY));
      if (state && state.scrolling) {
        if (Date.now() - state.timestamp < 5 * 60 * 1000) {
          speedInput.value = state.speed;
          try {
            localStorage.setItem(getSpeedStorageKey(), state.speed);
          } catch (e) {}
          setTimeout(() => {
            if (!scrolling) {
              startScroll();
            }
          }, 1200);
        }
        sessionStorage.removeItem(SCROLL_STATE_KEY);
      }
    } catch (e) {}
  }

  function tryAutoNextPage() {
    const nextBtn = findNextPageButton();
    if (!nextBtn) return;

    try {
      sessionStorage.setItem(SCROLL_STATE_KEY, JSON.stringify({
        scrolling: true,
        speed: speedInput.value,
        timestamp: Date.now()
      }));
    } catch (e) {}

    const delayMs = getDelayMs();

    nextPageDelayTimer = setTimeout(() => {
      nextPageDelayTimer = null;
      const href = nextBtn.getAttribute('href');
      if (nextBtn.tagName === 'A' && href && href !== '#'
          && !href.startsWith('javascript:') && !href.startsWith('void')) {
        location.href = nextBtn.href;
      } else {
        nextBtn.click();
      }
    }, delayMs);
  }

  function startScroll() {
    let speed = parseInt(speedInput.value, 10);
    if (isNaN(speed) || speed < 1) speed = 1;
    if (speed > 100) speed = 100;
    const baseSpeed = Math.pow(speed / 20, 1.6);
    scrolling = true;
    triggeredNextPage = false;
    if (nextPageDelayTimer) {
      clearTimeout(nextPageDelayTimer);
      nextPageDelayTimer = null;
    }
    toggleBtn.innerHTML = '■';
    toggleBtn.style.background = 'linear-gradient(135deg, #ef4444, #f97316)';
    toggleBtn.style.boxShadow = '0 4px 14px rgba(239,68,68,0.45), inset 0 1px 0 rgba(255,255,255,0.2)';
    scrollTimestamp = 0;
    scrollAccumulated = 0;

    try {
      localStorage.setItem(getSpeedStorageKey(), String(speed));
    } catch (e) {}

    function scrollStep(timestamp) {
      if (!scrolling) return;
      if (!scrollTimestamp) scrollTimestamp = timestamp;
      const delta = timestamp - scrollTimestamp;
      scrollTimestamp = timestamp;

      scrollAccumulated += baseSpeed * (delta / 16.67);
      let scrollNow = Math.floor(scrollAccumulated);
      scrollAccumulated -= scrollNow;

      if (scrollNow > 0) {
        const currentScroll = window.scrollY;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

        if (currentScroll >= maxScroll) {
          stopScroll();
          tryAutoNextPage();
          return;
        }

        window.scrollBy(0, scrollNow);
      }

      scrollRAF = requestAnimationFrame(scrollStep);
    }

    scrollRAF = requestAnimationFrame(scrollStep);
  }

  function stopScroll() {
    scrolling = false;
    if (scrollRAF) {
      cancelAnimationFrame(scrollRAF);
      scrollRAF = null;
    }
    if (nextPageDelayTimer) {
      clearTimeout(nextPageDelayTimer);
      nextPageDelayTimer = null;
    }
    toggleBtn.innerHTML = '▶';
    toggleBtn.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
    toggleBtn.style.boxShadow = '0 4px 14px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.2)';
  }

  toggleBtn.addEventListener('click', () => {
    if (scrolling) stopScroll(); else startScroll();
    resetHideTimer();
  });
  speedInput.addEventListener('input', resetHideTimer);

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      if (scrolling) stopScroll(); else startScroll();
      resetHideTimer();
    }
  });

  let isDragging = false;
  let offsetX, offsetY;
  panel.addEventListener('mousedown', (e) => {
    if (e.target !== speedInput && e.target !== toggleBtn && e.target !== configBtn) {
      isDragging = true;
      const rect = panel.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      panel.style.cursor = 'grabbing';
      panel.style.transform = 'scale(1.02)';
      e.preventDefault();
    }
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    const maxX = window.innerWidth - PANEL_WIDTH;
    const maxY = window.innerHeight - PANEL_HEIGHT;
    panel.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
    panel.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
    if (configVisible) positionConfigPanel();
    resetHideTimer();
  });
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      panel.style.cursor = 'grab';
      panel.style.transform = 'scale(1)';
      const rect = panel.getBoundingClientRect();
      const centerX = rect.left + PANEL_WIDTH / 2;
      panelSide = centerX < window.innerWidth / 2 ? 'left' : 'right';
      if (panelSide === 'left') {
        panel.style.left = '0px';
        panel.style.borderRadius = '0 16px 16px 0';
      } else {
        panel.style.left = (window.innerWidth - PANEL_WIDTH) + 'px';
        panel.style.borderRadius = '16px 0 0 16px';
      }

      lastYPosition = rect.top;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          side: panelSide,
          y: lastYPosition
        }));
      } catch (e) {}

      resetHideTimer();
    }
  });

  window.addEventListener('resize', () => {
    resetHideTimer();
    if (configVisible) positionConfigPanel();
  });

  setTimeout(() => {
    topBtn.style.display = 'flex';
    bottomBtn.style.display = 'flex';
    updateHelperButtonsPosition();
    if (!mouseOnPanel && !mouseOnMini && !mouseOnTopBtn && !mouseOnBottomBtn) {
      startAutoHide();
    }
  }, 300);

  loadConfig();
  loadDelay();
  restoreScrollState();
})();
