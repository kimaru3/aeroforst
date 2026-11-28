const MODULE_NAME = 'aero_mobile_ui';

const DEFAULT_SETTINGS = Object.freeze({
    theme: 'day',
    proseGlass: 'balanced',
    hideWand: true,
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

function applyChromeThemeColor(color = '#16BE8E') {
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

function applyAppearance() {
    const s = getSettings();
    const root = document.documentElement;
    root.setAttribute('data-aero-theme', s.theme);
    root.setAttribute('data-aero-prose-glass', s.proseGlass || 'balanced');
    root.setAttribute('data-aero-hide-wand', String(Boolean(s.hideWand)));

    applyChromeThemeColor('#16BE8E');
}

function getSelfExtensionFolder() {
    const pathname = new URL('.', import.meta.url).pathname;
    const parts = pathname.split('/').filter(Boolean);
    const tpIdx = parts.lastIndexOf('third-party');
    if (tpIdx !== -1 && parts[tpIdx + 1]) {
        return {
            full: `third-party/${decodeURIComponent(parts[tpIdx + 1])}`,
            short: decodeURIComponent(parts[tpIdx + 1]),
        };
    }
    const last = parts[parts.length - 1];
    return last ? { full: decodeURIComponent(last), short: decodeURIComponent(last) } : null;
}

async function postExtensionEndpoint(endpoint, candidates, headers) {
    let lastStatus = 0;
    for (const body of candidates) {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        lastStatus = res.status;
        if (res.ok) return { ok: true, res };
        if (res.status !== 404) return { ok: false, res, status: res.status };
    }
    return { ok: false, status: lastStatus || 404 };
}

async function checkAndUpdateExtension() {
    const btn = document.getElementById('aero_check_update_btn');
    const mgrBtn = document.getElementById('aero_open_mgr_btn');
    const reloadBtn = document.getElementById('aero_reload_btn');
    const statusEl = document.getElementById('aero_update_status');
    const selfFolder = getSelfExtensionFolder();

    if (!selfFolder) {
        if (statusEl) statusEl.textContent = '未能识别扩展目录，请点击右侧「管理扩展」更新。';
        if (mgrBtn) mgrBtn.style.display = 'inline-flex';
        return;
    }

    const { getRequestHeaders } = getCtx();
    const jsonHeaders = {
        ...getRequestHeaders(),
        'Content-Type': 'application/json',
    };

    if (btn) btn.disabled = true;
    if (statusEl) statusEl.textContent = `正在检查（${selfFolder.short}）...`;

    try {
        let matchedName = selfFolder.full;
        let isGlobal = false;

        try {
            const discRes = await fetch('api/extensions/discover', { headers: getRequestHeaders() });
            if (discRes.ok) {
                const list = await discRes.json();
                if (Array.isArray(list)) {
                    const found = list.find(
                        (item) =>
                            item.name === selfFolder.full ||
                            item.name === selfFolder.short ||
                            item.name?.endsWith(`/${selfFolder.short}`),
                    );
                    if (found) {
                        matchedName = found.name;
                        isGlobal = found.type === 'global';
                    }
                }
            }
        } catch (_) {
            // 忽略 discover 探测异常
        }

        const candidates = [
            { extensionName: matchedName, global: isGlobal },
            { extensionName: selfFolder.short, global: isGlobal },
            { extensionName: matchedName, global: !isGlobal },
            { extensionName: selfFolder.short, global: !isGlobal },
        ];

        const verCheck = await postExtensionEndpoint('api/extensions/version', candidates, jsonHeaders);
        if (verCheck.ok) {
            const verData = await verCheck.res.json();
            if (verData.isUpToDate) {
                const branch = verData.currentBranchName || 'main';
                if (statusEl) statusEl.textContent = `当前已是最新版本（分支：${branch}）`;
                window.toastr?.info('Aero Mobile UI 已是最新版本');
                return;
            }
        }

        if (statusEl) statusEl.textContent = '正在拉取 GitHub 更新...';
        const updCheck = await postExtensionEndpoint('api/extensions/update', candidates, jsonHeaders);
        if (!updCheck.ok) {
            if (mgrBtn) mgrBtn.style.display = 'inline-flex';
            throw new Error(`HTTP ${updCheck.status}，请点右侧「管理扩展」更新`);
        }

        const updText = await updCheck.res.text();
        if (updText.includes('up to date') || updText.includes('up-to-date')) {
            if (statusEl) statusEl.textContent = '当前已是最新版本，无需刷新。';
            window.toastr?.info('Aero Mobile UI 已是最新版本');
        } else {
            if (statusEl) statusEl.textContent = '更新成功！请点右侧「刷新生效」应用新版。';
            if (reloadBtn) reloadBtn.style.display = 'inline-flex';
            window.toastr?.success('更新成功，请刷新页面生效');
        }
    } catch (err) {
        console.error('[Aero Mobile UI] 更新检查异常:', err);
        if (statusEl) statusEl.textContent = `检查异常：${err.message || err}`;
        if (mgrBtn) mgrBtn.style.display = 'inline-flex';
    } finally {
        if (btn) btn.disabled = false;
    }
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
    let fullWidth = window.innerWidth;
    let fullHeight = Math.max(window.innerHeight, window.visualViewport?.height || 0);
    document.documentElement.style.setProperty('--aero-full-h', `${fullHeight}px`);

    let rafId = 0;
    const syncHeight = () => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            rafId = 0;
            const curW = window.innerWidth;
            const curH = window.visualViewport ? window.visualViewport.height : window.innerHeight;
            document.documentElement.style.setProperty('--aero-vvh', `${curH}px`);

            if (Math.abs(curW - fullWidth) > 20) {
                fullWidth = curW;
                fullHeight = Math.max(window.innerHeight, curH);
                document.documentElement.style.setProperty('--aero-full-h', `${fullHeight}px`);
            } else if (curH > fullHeight) {
                fullHeight = curH;
                document.documentElement.style.setProperty('--aero-full-h', `${fullHeight}px`);
            }
        });
    };

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncHeight, { passive: true });
        window.visualViewport.addEventListener('scroll', syncHeight, { passive: true });
    } else {
        window.addEventListener('resize', syncHeight, { passive: true });
    }
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
        bindSettingCheckbox('aero_hide_wand', 'hideWand');

        const updateBtn = document.getElementById('aero_check_update_btn');
        const mgrBtn = document.getElementById('aero_open_mgr_btn');
        const reloadBtn = document.getElementById('aero_reload_btn');
        if (updateBtn) updateBtn.addEventListener('click', checkAndUpdateExtension);
        if (mgrBtn) mgrBtn.addEventListener('click', () => document.getElementById('manage_extensions')?.click());
        if (reloadBtn) reloadBtn.addEventListener('click', () => window.location.reload());

        applyAppearance();
    } catch (err) {
        console.error('[Aero Mobile UI] 挂载设置面板失败:', err);
    }
}

jQuery(async () => {
    applyChromeThemeColor('#16BE8E');
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