const MODULE_NAME = 'aero_mobile_ui';

const DEFAULT_SETTINGS = Object.freeze({
    theme: 'day',          // 'day' | 'night'
    hideWand: true,        // 默认隐藏魔法棒
    compactMeta: false,    // 极简紧凑微调
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
    root.setAttribute('data-aero-hide-wand', String(Boolean(s.hideWand)));
    root.setAttribute('data-aero-compact', String(Boolean(s.compactMeta)));
}

/**
 * 将单条 .mes 重组为“双表面三层结构”：
 * 表面 A (.aero-mes-header): 左侧 3:4 竖图立绘 + 右侧双行(身份/操作锚点 + 动态元数据)
 * 表面 B (.mes_block): 100% 全宽独立正文平面
 */
function restructureMessage(mesEl) {
    if (!mesEl || !mesEl.classList?.contains('mes')) return;
    if (mesEl.dataset.aeroStructured === '1') return;

    const avatarWrapper = mesEl.querySelector(':scope > .mesAvatarWrapper');
    const mesBlock = mesEl.querySelector(':scope > .mes_block');
    if (!avatarWrapper || !mesBlock) return;

    // 1. 提取原生节点（只搬运节点，保留所有原生绑定与插件钩子）
    const avatar = avatarWrapper.querySelector('.avatar');
    const mesId = avatarWrapper.querySelector('.mesIDDisplay') || mesEl.querySelector('.mesIDDisplay');
    const timer = avatarWrapper.querySelector('.mes_timer') || mesEl.querySelector('.mes_timer');
    const tokens = avatarWrapper.querySelector('.tokenCounterDisplay') || mesEl.querySelector('.tokenCounterDisplay');

    const chName = mesBlock.querySelector(':scope > .ch_name');
    const nameText = chName?.querySelector('.name_text');
    const timestamp = chName?.querySelector('.timestamp');
    const mesButtons = chName?.querySelector('.mes_buttons');

    // 2. 创建表面 A：信息铭牌栏
    const header = document.createElement('header');
    header.className = 'aero-mes-header';

    const avatarSlot = document.createElement('div');
    avatarSlot.className = 'aero-avatar-slot';
    if (avatar) avatarSlot.appendChild(avatar);

    const infoCol = document.createElement('div');
    infoCol.className = 'aero-info-col';

    // 第 1 行：身份层（楼层定位 + 姓名）+ 低存在感操作区
    const rowIdentity = document.createElement('div');
    rowIdentity.className = 'aero-row-identity';

    const identityMain = document.createElement('div');
    identityMain.className = 'aero-identity-main';
    if (mesId) identityMain.appendChild(mesId);
    if (nameText) identityMain.appendChild(nameText);

    rowIdentity.appendChild(identityMain);
    if (mesButtons) rowIdentity.appendChild(mesButtons);

    // 第 2 行：元数据层（时间 · Token · 生成用时）
    const rowMeta = document.createElement('div');
    rowMeta.className = 'aero-row-meta';
    if (timestamp) rowMeta.appendChild(timestamp);
    if (tokens) rowMeta.appendChild(tokens);
    if (timer) rowMeta.appendChild(timer);

    infoCol.append(rowIdentity, rowMeta);
    header.append(avatarSlot, infoCol);

    // 3. 插入到正文表面 B (.mes_block) 上方，并移除空壳
    mesEl.insertBefore(header, mesBlock);
    avatarWrapper.classList.add('aero-emptied');
    if (chName) chName.classList.add('aero-emptied');

    mesEl.dataset.aeroStructured = '1';
}

function scanChatMessages() {
    const chat = document.getElementById('chat');
    if (!chat) return;
    chat.querySelectorAll(':scope > .mes').forEach(restructureMessage);
}

function initChatObserver() {
    const chat = document.getElementById('chat');
    if (!chat) return;

    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType === 1 && node.classList.contains('mes')) {
                    restructureMessage(node);
                }
            }
        }
    });
    observer.observe(chat, { childList: true });
}

/**
 * 修正 Android Chrome 软键盘弹出时的可视视口高度
 */
function initAndroidViewportFix() {
    if (!window.visualViewport) return;
    const syncHeight = () => {
        const vv = window.visualViewport;
        document.documentElement.style.setProperty('--aero-vvh', `${vv.height}px`);
    };
    window.visualViewport.addEventListener('resize', syncHeight, { passive: true });
    window.visualViewport.addEventListener('scroll', syncHeight, { passive: true });
    syncHeight();
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

        const settings = getSettings();
        const { saveSettingsDebounced } = getCtx();

        const themeSelect = document.getElementById('aero_theme_mode');
        const wandCheck = document.getElementById('aero_hide_wand');
        const compactCheck = document.getElementById('aero_compact_meta');

        if (themeSelect) {
            themeSelect.value = settings.theme;
            themeSelect.addEventListener('change', (e) => {
                settings.theme = e.target.value;
                applyAppearance();
                saveSettingsDebounced();
            });
        }

        if (wandCheck) {
            wandCheck.checked = Boolean(settings.hideWand);
            wandCheck.addEventListener('change', (e) => {
                settings.hideWand = e.target.checked;
                applyAppearance();
                saveSettingsDebounced();
            });
        }

        if (compactCheck) {
            compactCheck.checked = Boolean(settings.compactMeta);
            compactCheck.addEventListener('change', (e) => {
                settings.compactMeta = e.target.checked;
                applyAppearance();
                saveSettingsDebounced();
            });
        }
    } catch (err) {
        console.error('[Aero Mobile UI] 挂载设置面板失败:', err);
    }
}

jQuery(async () => {
    applyAppearance();
    initAndroidViewportFix();
    await mountSettingsPanel();

    const { eventSource, event_types } = getCtx();
    eventSource.on(event_types.CHAT_CHANGED, () => requestAnimationFrame(scanChatMessages));
    eventSource.on(event_types.MESSAGE_RENDERED, (mesId) => {
        const el = document.querySelector(`#chat > .mes[mesid="${mesId}"]`);
        if (el) restructureMessage(el);
    });
    eventSource.on(event_types.MESSAGE_SWIPED, (mesId) => {
        const el = document.querySelector(`#chat > .mes[mesid="${mesId}"]`);
        if (el) restructureMessage(el);
    });

    scanChatMessages();
    initChatObserver();
});