const MODULE_NAME = 'aero_mobile_ui';

const DEFAULT_SETTINGS = Object.freeze({
    theme: 'day',
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
    root.setAttribute('data-aero-hide-wand', String(Boolean(s.hideWand)));
    root.setAttribute('data-aero-compact', String(Boolean(s.compactMeta)));
}

/**
 * 瞬间直达最底部最新消息（跳过一切动画，避免 Discord 式逐帧加载卡顿）
 */
function instantJumpToBottom() {
    const chat = document.getElementById('chat');
    if (!chat) return;

    // 1. 先关闭横菜单
    const optionsMenu = document.getElementById('options');
    if (optionsMenu && optionsMenu.style.display !== 'none') {
        optionsMenu.style.display = 'none';
    }

    // 2. 临时关闭平滑滚动并直接瞬移到底部
    const prevBehavior = chat.style.scrollBehavior;
    chat.style.scrollBehavior = 'auto';
    chat.scrollTop = chat.scrollHeight;

    // 3. 下一帧再校准一次，防止字体/图片回流导致差几十像素
    requestAnimationFrame(() => {
        chat.scrollTop = chat.scrollHeight;
        chat.dispatchEvent(new Event('scroll', { bubbles: true }));
        chat.style.scrollBehavior = prevBehavior;
    });
}

/**
 * 往底栏横菜单 (#options .options-content) 注入“直达最新消息”按钮
 */
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

    // 放在菜单最上方，点开横菜单拇指直接能按到
    optionsContent.prepend(btn);
}

/**
 * 将单条 .mes 重组为“双表面三层结构”，同时保证所有按钮留在 .mes_block 内部：
 * .mes_block (flex column)
 *   ├─ 表面 A (.aero-mes-header): 3:4立绘 + (楼层/姓名/操作/编辑确认组) + (时间/Token/用时)
 *   └─ 表面 B (.mes_reasoning_details / .mes_text / .edit_textarea)
 */
function restructureMessage(mesEl) {
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

    // 第 1 行：身份层 + 原生操作按钮组 + 编辑确认/取消按钮组
    const rowIdentity = document.createElement('div');
    rowIdentity.className = 'aero-row-identity';

    const identityMain = document.createElement('div');
    identityMain.className = 'aero-identity-main';
    if (mesId) identityMain.appendChild(mesId);
    if (nameText) identityMain.appendChild(nameText);

    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'aero-actions-wrap';
    if (mesButtons) actionsWrap.appendChild(mesButtons);
    if (mesEditButtons) actionsWrap.appendChild(mesEditButtons);

    rowIdentity.append(identityMain, actionsWrap);

    // 第 2 行：元数据层（时间 · Token · 生成用时）
    const rowMeta = document.createElement('div');
    rowMeta.className = 'aero-row-meta';
    if (timestamp) rowMeta.appendChild(timestamp);
    if (tokens) rowMeta.appendChild(tokens);
    if (timer) rowMeta.appendChild(timer);

    infoCol.append(rowIdentity, rowMeta);
    header.append(avatarSlot, infoCol);

    // 关键：插入到 .mes_block 内部最前面，保留 ST 所有 mesBlock.find(...) 查询
    mesBlock.prepend(header);
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

function initAndroidViewportFix() {
    if (!window.visualViewport) return;
    const syncHeight = () => {
        document.documentElement.style.setProperty('--aero-vvh', `${window.visualViewport.height}px`);
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
    injectJumpToBottomMenuItem();
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