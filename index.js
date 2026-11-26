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
}

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
        data[i + 3] = Math.floor(Math.random() * 24);
    }
    ctx.putImageData(img, 0, 0);
    document.documentElement.style.setProperty('--aero-grain-img', `url(${canvas.toDataURL('image/png')})`);
}

function mountAuroraStage() {
    if (document.getElementById('aero-aurora-stage')) return;

    const stage = document.createElement('div');
    stage.id = 'aero-aurora-stage';
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML = `
      <div class="aero-stage-wash"></div>
      <div class="aero-stage-ribbons">
        <svg class="aero-ribbon aero-ribbon-1" viewBox="0 0 400 800" preserveAspectRatio="none">
          <defs>
            <linearGradient id="aeroGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="var(--spec-emerald-bright)" stop-opacity="0.46" />
              <stop offset="48%" stop-color="var(--spec-cyan)" stop-opacity="0.38" />
              <stop offset="100%" stop-color="var(--spec-violet)" stop-opacity="0.32" />
            </linearGradient>
          </defs>
          <path d="M-60,110 C110,20 260,320 460,200 L460,380 C250,480 90,190 -60,310 Z" fill="url(#aeroGrad1)" />
        </svg>
        <svg class="aero-ribbon aero-ribbon-2" viewBox="0 0 400 800" preserveAspectRatio="none">
          <defs>
            <linearGradient id="aeroGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="var(--spec-solar)" stop-opacity="0.38" />
              <stop offset="50%" stop-color="var(--spec-coral)" stop-opacity="0.32" />
              <stop offset="100%" stop-color="var(--spec-cyan)" stop-opacity="0.36" />
            </linearGradient>
          </defs>
          <path d="M-50,490 C130,380 270,640 470,460 L470,630 C260,790 110,550 -50,670 Z" fill="url(#aeroGrad2)" />
        </svg>
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
    initStaticGrainTexture();
    mountAuroraStage();
    applyAppearance();
    initAndroidViewportFix();
    injectJumpToBottomMenuItem();
    await mountSettingsPanel();

    const { eventSource, event_types } = getCtx();

    eventSource.on(event_types.CHAT_CHANGED, () => {
        document.documentElement.setAttribute('data-aero-generating', 'false');
        requestAnimationFrame(scanChatMessages);
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

    // 过滤 dryRun 和 quiet 静默后台任务，只响应真实前台生成
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