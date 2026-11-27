const MODULE_NAME = 'aero_mobile_ui';

const DEFAULT_SETTINGS = Object.freeze({
    theme: 'day',
    proseGlass: 'balanced',
    fontStyle: 'sans',
    enableRibbons: true,
    enableGrain: true,
    enableBgWindow: true,
    bgBlend: 'balanced',
    hideWand: true,
    compactMeta: false,
});

function getCtx() {
    return SillyTavern.getContext();
}

function getSettings() {
    const { extensionSettings } = getCtx();
    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = structuredClone(DEFAULT_SETTINGS);
    }
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
        if (extensionSettings[MODULE_NAME][k] === undefined) {
            extensionSettings[MODULE_NAME][k] = v;
        }
    }
    return extensionSettings[MODULE_NAME];
}

function applyChromeThemeColor(color = '#075B50') {
    const existing = document.querySelectorAll('meta[name="theme-color"]');
    if (existing.length > 0) {
        existing.forEach((el, idx) => {
            if (idx === 0) {
                el.removeAttribute('media');
                el.setAttribute('content', color);
            } else {
                el.remove();
            }
        });
    } else {
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = color;
        document.head.appendChild(meta);
    }
}

/**
 * 实时检测 ST 是否已设置背景图（全局 #bg1 或聊天专属 #bg_custom）
 */
function syncStBackgroundState() {
    const ids = ['bg1', 'bg2', 'bg_custom'];
    const hasImg = ids.some((id) => {
        const el = document.getElementById(id);
        if (!el) return false;
        const bg = el.style.backgroundImage || getComputedStyle(el).backgroundImage;
        return Boolean(bg && bg !== 'none' && bg.includes('url('));
    });
    document.documentElement.setAttribute('data-aero-has-st-bg', String(hasImg));
}

function initBgObserver() {
    const targets = ['bg1', 'bg2', 'bg_custom']
        .map((id) => document.getElementById(id))
        .filter(Boolean);
    if (targets.length === 0) return;
    const obs = new MutationObserver(() => syncStBackgroundState());
    targets.forEach((el) => obs.observe(el, { attributes: true, attributeFilter: ['style', 'class'] }));
    syncStBackgroundState();
}

function applyAppearance() {
    const s = getSettings();
    const root = document.documentElement;
    root.setAttribute('data-aero-theme', s.theme);
    root.setAttribute('data-aero-prose-glass', s.proseGlass || 'balanced');
    root.setAttribute('data-aero-font', s.fontStyle || 'sans');
    root.setAttribute('data-aero-ribbons', String(Boolean(s.enableRibbons)));
    root.setAttribute('data-aero-grain', String(Boolean(s.enableGrain)));
    root.setAttribute('data-aero-bg-window', String(Boolean(s.enableBgWindow)));
    root.setAttribute('data-aero-bg-blend', s.bgBlend || 'balanced');
    root.setAttribute('data-aero-hide-wand', String(Boolean(s.hideWand)));
    root.setAttribute('data-aero-compact', String(Boolean(s.compactMeta)));

    const blendWrap = document.getElementById('aero_bg_blend_wrap');
    if (blendWrap) {
        blendWrap.style.display = s.enableBgWindow ? 'flex' : 'none';
    }

    syncStBackgroundState();
    applyChromeThemeColor('#075B50');
}

/**
 * 修复 B2 透明度乘法归零问题：提升离屏噪点切片自身对比度
 */
function initStaticGrainTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = ctx.createImageData(size, size);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
        const v = Math.random() > 0.5 ? 255 : 0;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = Math.floor(40 + Math.random() * 90);
    }
    ctx.putImageData(img, 0, 0);
    document.documentElement.style.setProperty('--aero-grain-img', `url(${canvas.toDataURL('image/png')})`);
}

/**
 * 改用纯 CSS 极光光弧实体（彻底摆脱 SVG stop 变量兼容性问题）
 */
function mountAuroraStage() {
    if (document.getElementById('aero-aurora-stage')) return;

    const stage = document.createElement('div');
    stage.id = 'aero-aurora-stage';
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML = `
      <div class="aero-stage-wash"></div>
      <div class="aero-stage-ribbons">
        <div class="aero-ribbon aero-ribbon-1"></div>
        <div class="aero-ribbon aero-ribbon-2"></div>
      </div>
      <div class="aero-stage-grain"></div>
    `;

    document.body.prepend(stage);
}

function instantJumpToBottom() {
    const chat = document.getElementById('chat');
    if (!chat) return;

    const optionsMenu = document.getElementById('options');
    if (optionsMenu && optionsMenu.style.display !== 'none') {
        optionsMenu.style.display = 'none';
    }

    const prevBehavior = chat.style.scrollBehavior;
    chat.style.scrollBehavior = 'auto';
    chat.scrollTop = chat.scrollHeight;

    requestAnimationFrame(() => {
        chat.scrollTop = chat.scrollHeight;
        chat.dispatchEvent(new Event('scroll', { bubbles: true }));
        chat.style.scrollBehavior = prevBehavior;
    });
}

function injectJumpToBottomMenuItem() {
    const optionsContent = document.querySelector('#options .options-content');
    if (!optionsContent || document.getElementById('aero_jump_to_bottom')) return;

    const btn = document.createElement('a');
    btn.id = 'aero_jump_to_bottom';
    btn.className = 'interactable';
    btn.innerHTML = `<i class="fa-lg fa-solid fa-angles-down"></i><span>直达最新消息</span>`;
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        instantJumpToBottom();
    });

    optionsContent.prepend(btn);
}

function restructureMessage(mesEl, isLiveNew = false) {
    if (!mesEl || !mesEl.classList?.contains('mes')) return;
    if (mesEl.dataset.aeroStructured === '1') return;

    const avatarWrapper = mesEl.querySelector(':scope > .mesAvatarWrapper');
    const mesBlock = mesEl.querySelector(':scope > .mes_block');
    if (!avatarWrapper || !mesBlock) return;

    const avatar = avatarWrapper.querySelector('.avatar');
    const mesId = avatarWrapper.querySelector('.mesIDDisplay') || mesEl.querySelector('.mesIDDisplay');
    const timer = avatarWrapper.querySelector('.mes_timer') || mesEl.querySelector('.mes_timer');
    const tokens = avatarWrapper.querySelector('.tokenCounterDisplay') || mesEl.querySelector('.tokenCounterDisplay');

    const chName = mesBlock.querySelector(':scope > .ch_name');
    const nameText = chName?.querySelector('.name_text');
    const timestamp = chName?.querySelector('.timestamp');
    const mesButtons = chName?.querySelector('.mes_buttons');
    const mesEditButtons = chName?.querySelector('.mes_edit_buttons');

    const header = document.createElement('header');
    header.className = 'aero-mes-header';

    const avatarSlot = document.createElement('div');
    avatarSlot.className = 'aero-avatar-slot';
    if (avatar) avatarSlot.appendChild(avatar);

    const infoCol = document.createElement('div');
    infoCol.className = 'aero-info-col';

    const rowIdentity = document.createElement('div');
    rowIdentity.className = 'aero-row-identity';

    const identityMain = document.createElement('div');
    identityMain.className = 'aero-identity-main';
    if (mesId) identityMain.appendChild(mesId);
    if (nameText) identityMain.appendChild(nameText);

    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'aero-actions-wrap';
    if (mesButtons) actionsWrap.appendChild(mesButtons);

    rowIdentity.append(identityMain, actionsWrap);

    const rowMeta = document.createElement('div');
    rowMeta.className = 'aero-row-meta';
    if (timestamp) rowMeta.appendChild(timestamp);
    if (tokens) rowMeta.appendChild(tokens);
    if (timer) rowMeta.appendChild(timer);

    infoCol.append(rowIdentity, rowMeta);
    header.append(avatarSlot, infoCol);

    mesBlock.prepend(header);
    if (mesEditButtons) {
        header.after(mesEditButtons);
    }

    // 让 ... 展开菜单（.extraMesButtons）像铅笔编辑条一样下拉推开正文，不再覆盖短消息
    if (mesButtons) {
        const extraButtons = mesButtons.querySelector('.extraMesButtons');
        if (extraButtons) {
            const syncExtraMenuSpace = () => {
                const buttonsVisible = getComputedStyle(mesButtons).display !== 'none';
                const extraStyle = getComputedStyle(extraButtons);
                const isOpen =
                    buttonsVisible &&
                    extraStyle.display !== 'none' &&
                    extraStyle.visibility !== 'hidden' &&
                    extraButtons.offsetHeight > 0;
                header.style.marginBottom = isOpen ? `${extraButtons.offsetHeight}px` : '';
            };

            const attrObs = new MutationObserver(() => {
                syncExtraMenuSpace();
                requestAnimationFrame(syncExtraMenuSpace);
            });
            attrObs.observe(extraButtons, { attributes: true, attributeFilter: ['style', 'class'] });
            attrObs.observe(mesButtons, { attributes: true, attributeFilter: ['style', 'class'] });

            if (typeof ResizeObserver !== 'undefined') {
                const resizeObs = new ResizeObserver(syncExtraMenuSpace);
                resizeObs.observe(extraButtons);
            }
            syncExtraMenuSpace();
        }
    }

    avatarWrapper.classList.add('aero-emptied');
    if (chName) chName.classList.add('aero-emptied');

    if (isLiveNew) {
        mesEl.classList.add('aero-mes-enter');
    }

    mesEl.dataset.aeroStructured = '1';
}

function scanChatMessages() {
    const chat = document.getElementById('chat');
    if (!chat) return;
    chat.querySelectorAll(':scope > .mes').forEach((el) => restructureMessage(el, false));
}

function initChatObserver() {
    const chat = document.getElementById('chat');
    if (!chat) return;

    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType === 1 && node.classList.contains('mes')) {
                    restructureMessage(node, false);
                }
            }
        }
    });
    observer.observe(chat, { childList: true });
}

function initAndroidViewportFix() {
    if (!window.visualViewport) return;
    const syncHeight = () => {
        document.documentElement.style.setProperty('--aero-vvh', `${window.visualViewport.height}px`);
    };
    window.visualViewport.addEventListener('resize', syncHeight, { passive: true });
    window.visualViewport.addEventListener('scroll', syncHeight, { passive: true });
    syncHeight();
}

function bindSettingSelect(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    const settings = getSettings();
    const { saveSettingsDebounced } = getCtx();
    el.value = settings[key];
    el.addEventListener('change', (e) => {
        settings[key] = e.target.value;
        applyAppearance();
        saveSettingsDebounced();
    });
}

function bindSettingCheckbox(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    const settings = getSettings();
    const { saveSettingsDebounced } = getCtx();
    el.checked = Boolean(settings[key]);
    el.addEventListener('change', (e) => {
        settings[key] = e.target.checked;
        applyAppearance();
        saveSettingsDebounced();
    });
}

async function mountSettingsPanel() {
    const container = document.getElementById('extensions_settings2');
    if (!container || document.getElementById('aero_mobile_ui_settings')) return;

    try {
        const res = await fetch(new URL('./settings.html', import.meta.url));
        const rawHtml = await res.text();
        const { DOMPurify } = SillyTavern.libs;
        const cleanHtml = DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml;
        $(container).append(cleanHtml);

        bindSettingSelect('aero_theme_mode', 'theme');
        bindSettingSelect('aero_prose_glass', 'proseGlass');
        bindSettingSelect('aero_font_style', 'fontStyle');
        bindSettingSelect('aero_bg_blend', 'bgBlend');

        bindSettingCheckbox('aero_enable_ribbons', 'enableRibbons');
        bindSettingCheckbox('aero_enable_grain', 'enableGrain');
        bindSettingCheckbox('aero_enable_bg_window', 'enableBgWindow');
        bindSettingCheckbox('aero_hide_wand', 'hideWand');
        bindSettingCheckbox('aero_compact_meta', 'compactMeta');

        applyAppearance();
    } catch (err) {
        console.error('[Aero Mobile UI] 挂载设置面板失败:', err);
    }
}

jQuery(async () => {
    applyChromeThemeColor('#075B50');
    initStaticGrainTexture();
    mountAuroraStage();
    initBgObserver();
    applyAppearance();
    initAndroidViewportFix();
    injectJumpToBottomMenuItem();
    await mountSettingsPanel();

    const { eventSource, event_types } = getCtx();

    eventSource.on(event_types.CHAT_CHANGED, () => {
        document.documentElement.setAttribute('data-aero-generating', 'false');
        requestAnimationFrame(() => {
            scanChatMessages();
            syncStBackgroundState();
        });
    });

    eventSource.on(event_types.USER_MESSAGE_RENDERED, (mesId) => {
        const el = document.querySelector(`#chat > .mes[mesid="${mesId}"]`);
        if (el) restructureMessage(el, true);
    });

    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (mesId) => {
        const el = document.querySelector(`#chat > .mes[mesid="${mesId}"]`);
        if (el) restructureMessage(el, true);
    });

    eventSource.on(event_types.MESSAGE_RENDERED, (mesId) => {
        const el = document.querySelector(`#chat > .mes[mesid="${mesId}"]`);
        if (el) restructureMessage(el, false);
    });

    eventSource.on(event_types.MESSAGE_SWIPED, (mesId) => {
        const el = document.querySelector(`#chat > .mes[mesid="${mesId}"]`);
        if (el) restructureMessage(el, false);
    });

    eventSource.on(event_types.GENERATION_STARTED, (type, _options, dryRun) => {
        if (dryRun || type === 'quiet') return;
        document.documentElement.setAttribute('data-aero-generating', 'true');
    });
    eventSource.on(event_types.GENERATION_ENDED, () => {
        document.documentElement.setAttribute('data-aero-generating', 'false');
    });
    eventSource.on(event_types.GENERATION_STOPPED, () => {
        document.documentElement.setAttribute('data-aero-generating', 'false');
    });

    scanChatMessages();
    initChatObserver();
});
