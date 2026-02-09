document.addEventListener('DOMContentLoaded', () => {
    // === 1. Loader ===
    const loader = document.getElementById('loader');
    const keyhole = document.querySelector('.keyhole');
    function hideLoader() {
        if (!loader || loader.style.display === 'none') return;
        if (keyhole) keyhole.style.animation = 'none';
        loader.style.opacity = '0';
        loader.style.visibility = 'hidden'; 
        setTimeout(() => { loader.style.display = 'none'; }, 500);
    }
    window.addEventListener('load', () => setTimeout(hideLoader, 1500));
    setTimeout(hideLoader, 4000);

    // === 2. 并行加载内容 (大事件 & 文章) ===
    loadEvents();
    loadPosts();
});

// === 初始化卡片特效 (务必在 HTML 生成后调用) ===
function initCardEffects() {
    const cards = document.querySelectorAll('.event-card');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 滚动入场 (IntersectionObserver)
    if (!prefersReducedMotion && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });
        cards.forEach(card => observer.observe(card));
    } else {
        cards.forEach(card => card.classList.add('in-view'));
    }

    // 鼠标聚光灯 (Spotlight)
    if (!prefersReducedMotion) {
        cards.forEach(card => {
            card.addEventListener('pointermove', (e) => {
                if (e.pointerType === 'touch') return;
                const r = card.getBoundingClientRect();
                card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
                card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
            });
        });
    }
}

// === 加载大事件 (New) ===
async function loadEvents() {
    const container = document.getElementById('timelineContainer');
    if (!container) return;

    try {
        // 1. Fetch JSON (Base Data)
        const res = await fetch('assets/events.json', { cache: 'no-store' });
        const data = await res.json();
        // Handle nested structure { events: [...] } or array [...]
        const jsonEvents = Array.isArray(data) ? data : (data.events || []);

        // 2. Load Local Overrides
        const localEvents = JSON.parse(localStorage.getItem('my_events') || '[]');
        const deletedIds = JSON.parse(localStorage.getItem('deleted_events') || '[]');

        // 3. Merge: JSON + Local
        // We need a way to identify JSON events to filter deleted ones.
        // Using "date|title" as ID for JSON events.
        let allEvents = [
            ...jsonEvents.map(e => ({ ...e, id: e.id || `json|${e.date}|${e.title}`, source: 'json' })),
            ...localEvents.map(e => ({ ...e, source: 'local' }))
        ];

        // 4. Filter Deleted
        allEvents = allEvents.filter(e => !deletedIds.includes(e.id));

        // 5. Sort
        allEvents.sort((a, b) => {
            if (a.date === 'FUTURE') return 1;
            if (b.date === 'FUTURE') return -1;
            return a.date.localeCompare(b.date);
        });

        // 6. Render
        if (allEvents.length === 0) {
            container.innerHTML = `<p style="text-align:center; color:#666;">暂无大事件</p>`;
        } else {
            container.innerHTML = allEvents.map(evt => `
                <article class="event-card">
                    <span class="shine" aria-hidden="true"></span>
                    <div class="date">${escapeHtml(evt.date)}</div>
                    <h3 class="card-title">${escapeHtml(evt.title)}</h3>
                    <p class="card-desc">${escapeHtml(evt.content)}</p>
                </article>
            `).join('');
            
            initCardEffects();
        }

    } catch (err) {
        console.error(err);
        container.innerHTML = `<p style="text-align:center; color:#666;">大事件数据加载失败: ${err.message}</p>`;
    }
}

// === 加载文章逻辑 (Posts) ===
let globalPosts = []; // Store for click handler

async function loadPosts() {
    const listEl = document.getElementById('postList');
    const modal = document.getElementById('postModal');
    const closeBtn = document.getElementById('postCloseBtn');
    const titleEl = document.getElementById('postTitle');
    const infoEl = document.getElementById('postInfo');
    const contentEl = document.getElementById('postContent');

    if (!listEl || !modal || !contentEl || typeof marked === 'undefined') return;

    const openModal = () => {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    };
    const closeModal = () => {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    };

    modal.addEventListener('click', (e) => { if (e.target.dataset.close === '1') closeModal(); });
    closeBtn?.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    let jsonPosts = [];
    try {
        const res = await fetch('assets/posts.json', { cache: 'no-store' });
        const data = await res.json();
        jsonPosts = Array.isArray(data) ? data : (data.posts || []);
        // Assign IDs to JSON posts
        jsonPosts = jsonPosts.map(p => ({
            ...p,
            id: p.id || `json|${p.date}|${p.title}`,
            source: 'json'
        }));
    } catch (err) {
        console.warn("Failed to load posts.json");
    }

    // Load Local & Deleted
    const localPosts = JSON.parse(localStorage.getItem('my_posts') || '[]');
    const deletedIds = JSON.parse(localStorage.getItem('deleted_posts') || '[]');

    // Merge
    globalPosts = [...jsonPosts, ...localPosts].filter(p => !deletedIds.includes(p.id));

    // Sort
    globalPosts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (globalPosts.length === 0) {
        listEl.innerHTML = `<div style="padding:20px;color:#666;">暂无文章</div>`;
    } else {
        listEl.innerHTML = globalPosts.map((p, idx) => {
            const tags = Array.isArray(p.tags) ? p.tags : [];
            return `
                <button class="post-item" data-idx="${idx}">
                    <div class="post-item__title">${escapeHtml(p.title || 'Untitled')}</div>
                    <div class="post-item__meta">
                        <span class="post-item__date">${escapeHtml(p.date || '')}</span>
                        <span class="post-item__tags">${tags.map(t => `<em>#${escapeHtml(t)}</em>`).join(' ')}</span>
                    </div>
                </button>
            `;
        }).join('');
    }

    // Remove old listeners to avoid duplicates
    listEl.onclick = async (e) => {
        const btn = e.target.closest('.post-item');
        if (!btn) return;

        const idx = Number(btn.dataset.idx);
        const p = globalPosts[idx];
        if (!p) return;

        titleEl.textContent = p.title || 'Untitled';
        infoEl.textContent = `${p.date || ''} · ${p.tags ? p.tags.join(' / ') : ''}`;
        contentEl.innerHTML = `<p style="text-align:center;padding:40px;">LOADING REVELATION...</p>`;
        openModal();

        try {
            let mdText = '';
            if (p.content) {
                // Local inline content
                mdText = p.content;
            } else if (p.file) {
                // Remote file
                const mdRes = await fetch(`posts/${p.file}`, { cache: 'no-store' });
                if (!mdRes.ok) throw new Error("File not found");
                mdText = await mdRes.text();
            } else {
                mdText = "*No content available*";
            }

            contentEl.innerHTML = marked.parse(mdText);
            enhanceMarkdownImages(contentEl);
            addCopyButtons(contentEl);
        } catch (err) {
            contentEl.innerHTML = `<p style="color:var(--accent-orange)">ERROR: DATA CORRUPTED<br>${escapeHtml(String(err))}</p>`;
        }
    };
}

function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function enhanceMarkdownImages(root) {
    root.querySelectorAll('img').forEach(img => {
        img.classList.add('md-img');
        img.loading = 'lazy';
    });
}

function addCopyButtons(root) {
    root.querySelectorAll('pre > code').forEach(code => {
        const pre = code.parentElement;
        if (pre.dataset.copyReady) return;
        pre.dataset.copyReady = '1';
        
        const btn = document.createElement('button');
        btn.className = 'copy-btn';
        btn.textContent = 'COPY';
        btn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(code.innerText);
                btn.textContent = 'COPIED';
                setTimeout(() => btn.textContent = 'COPY', 1000);
            } catch { btn.textContent = 'ERR'; }
        });
        pre.appendChild(btn);
    });
}

// === Event Manager Logic ===

let editingEventId = null; // Track which event is being edited

function openEventManager() {
    const modal = document.getElementById('eventModal');
    if (modal) {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        renderEventManager();
    }
}

function closeEventManager() {
    const modal = document.getElementById('eventModal');
    if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }
}

async function renderEventManager() {
    const container = document.getElementById('eventManagerContent');
    if (!container) return;

    // Load current data
    let jsonEvents = [];
    try {
        const res = await fetch('assets/events.json', { cache: 'no-store' });
        const data = await res.json();
        jsonEvents = Array.isArray(data) ? data : (data.events || []);
        jsonEvents = jsonEvents.map(e => ({ ...e, id: e.id || `json|${e.date}|${e.title}`, source: 'json' }));
    } catch (e) {
        console.warn("Failed to load JSON events for manager:", e);
    }

    const localEvents = JSON.parse(localStorage.getItem('my_events') || '[]');
    const deletedIds = JSON.parse(localStorage.getItem('deleted_events') || '[]');

    // Merge and Sort
    let allEvents = [...jsonEvents, ...localEvents].filter(e => !deletedIds.includes(e.id));
    allEvents.sort((a, b) => {
        if (a.date === 'FUTURE') return 1;
        if (b.date === 'FUTURE') return -1;
        return a.date.localeCompare(b.date);
    });

    // Template
    const formHtml = `
        <div style="margin-bottom: 30px; border-bottom: 1px solid #333; padding-bottom: 20px;">
            <h4 style="margin-bottom: 10px; color: var(--accent-blue);">${editingEventId ? '✎ 编辑事件' : '+ 添加新事件'}</h4>
            <div style="display: grid; gap: 10px;">
                <input type="text" id="evtDate" placeholder="日期 (YYYY.MM.DD 或 FUTURE)" style="width:100%; padding:8px; background:#111; border:1px solid #333; color:#fff;">
                <input type="text" id="evtTitle" placeholder="标题" style="width:100%; padding:8px; background:#111; border:1px solid #333; color:#fff;">
                <textarea id="evtContent" placeholder="内容描述" rows="3" style="width:100%; padding:8px; background:#111; border:1px solid #333; color:#fff;"></textarea>
                <div style="display: flex; gap: 10px;">
                    <button onclick="saveEvent()" style="padding: 8px 16px; background: ${editingEventId ? 'var(--accent-orange)' : 'var(--accent-blue)'}; color: #000; border: none; cursor: pointer; font-weight: bold; flex: 1;">
                        ${editingEventId ? '更新事件' : '保存事件'}
                    </button>
                    ${editingEventId ? `<button onclick="cancelEdit()" style="padding: 8px 16px; background: #333; color: #fff; border: none; cursor: pointer;">取消</button>` : ''}
                </div>
            </div>
        </div>
    `;

    const listHtml = `
        <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h4 style="color: var(--accent-orange);">现有事件列表 (${allEvents.length})</h4>
                <button onclick="exportEvents()" style="padding:4px 8px; font-size:12px; background:var(--accent-blue); color:#000; border:none; cursor:pointer; font-weight:bold;">💾 保存到硬盘 / 导出JSON</button>
            </div>
            <ul style="list-style: none; max-height: 400px; overflow-y: auto;">
                ${allEvents.map(e => `
                    <li style="display: flex; justify-content: space-between; align-items: start; background: rgba(255,255,255,0.05); margin-bottom: 8px; padding: 10px; border-radius: 4px;">
                        <div style="flex: 1; padding-right: 10px;">
                            <div style="font-weight: bold; color: var(--accent-blue); font-size: 0.9em;">${escapeHtml(e.date)}</div>
                            <div style="font-weight: bold;">${escapeHtml(e.title)}</div>
                            <div style="font-size: 0.8em; color: #aaa; margin-top: 4px;">${escapeHtml(e.content)}</div>
                            <div style="font-size: 0.7em; color: #555; margin-top: 2px;">来源: ${e.source === 'json' ? '预设文件' : '本地存储'}</div>
                        </div>
                        <div style="display: flex; gap: 5px; flex-direction: column;">
                            <button onclick="startEdit('${e.id}')" style="background: #003366; color: #4db8ff; border: 1px solid #004080; padding: 4px 8px; cursor: pointer; font-size: 12px;">编辑</button>
                            <button onclick="deleteEvent('${e.id}')" style="background: #330000; color: #ff4444; border: 1px solid #660000; padding: 4px 8px; cursor: pointer; font-size: 12px;">删除</button>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;

    container.innerHTML = formHtml + listHtml;
    
    // If editing, fill the form
    if (editingEventId) {
        const evt = allEvents.find(e => e.id === editingEventId);
        if (evt) {
            document.getElementById('evtDate').value = evt.date;
            document.getElementById('evtTitle').value = evt.title;
            document.getElementById('evtContent').value = evt.content;
        }
    } else {
        // If adding new, auto-fill today's date
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        document.getElementById('evtDate').value = `${yyyy}.${mm}.${dd}`;
    }
}

function startEdit(id) {
    editingEventId = id;
    renderEventManager();
}

function cancelEdit() {
    editingEventId = null;
    renderEventManager();
}

function saveEvent() {
    const date = document.getElementById('evtDate').value.trim();
    const title = document.getElementById('evtTitle').value.trim();
    const content = document.getElementById('evtContent').value.trim();

    if (!date || !title) {
        alert("请至少填写日期和标题");
        return;
    }

    if (editingEventId) {
        // === Update Logic ===
        
        // If it was a JSON event, we need to "delete" the original and "add" a new local one
        // If it was a local event, we just update it.
        
        if (editingEventId.startsWith('json|')) {
             // 1. Blacklist the old JSON ID
            const deletedIds = JSON.parse(localStorage.getItem('deleted_events') || '[]');
            if (!deletedIds.includes(editingEventId)) {
                deletedIds.push(editingEventId);
                localStorage.setItem('deleted_events', JSON.stringify(deletedIds));
            }
            
            // 2. Add as new local event
             const newEvent = {
                id: 'local_' + Date.now(),
                date,
                title,
                content,
                source: 'local'
            };
            const localEvents = JSON.parse(localStorage.getItem('my_events') || '[]');
            localEvents.push(newEvent);
            localStorage.setItem('my_events', JSON.stringify(localEvents));
            
        } else {
            // It is a local event, update directly
            let localEvents = JSON.parse(localStorage.getItem('my_events') || '[]');
            const idx = localEvents.findIndex(e => e.id === editingEventId);
            if (idx !== -1) {
                localEvents[idx] = { ...localEvents[idx], date, title, content };
                localStorage.setItem('my_events', JSON.stringify(localEvents));
            }
        }
        
        editingEventId = null; // Exit edit mode
        
    } else {
        // === Create Logic ===
        const newEvent = {
            id: 'local_' + Date.now(),
            date,
            title,
            content,
            source: 'local'
        };

        const localEvents = JSON.parse(localStorage.getItem('my_events') || '[]');
        localEvents.push(newEvent);
        localStorage.setItem('my_events', JSON.stringify(localEvents));
    }

    // Clear form (but keep today's date)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('evtDate').value = `${yyyy}.${mm}.${dd}`;
    
    document.getElementById('evtTitle').value = '';
    document.getElementById('evtContent').value = '';

    // Refresh
    renderEventManager();
    loadEvents(); // Refresh main timeline
}

function deleteEvent(id) {
    if (!confirm("确定要删除这个事件吗？(仅本地生效)")) return;

    if (id.startsWith('json|')) {
        // Add to blacklist
        const deletedIds = JSON.parse(localStorage.getItem('deleted_events') || '[]');
        if (!deletedIds.includes(id)) {
            deletedIds.push(id);
            localStorage.setItem('deleted_events', JSON.stringify(deletedIds));
        }
    } else {
        // Remove from local storage
        let localEvents = JSON.parse(localStorage.getItem('my_events') || '[]');
        localEvents = localEvents.filter(e => e.id !== id);
        localStorage.setItem('my_events', JSON.stringify(localEvents));
    }

    renderEventManager();
    loadEvents();
}

async function exportEvents() {
    // Re-fetch clean list to generate full JSON
    let jsonEvents = [];
    try {
        const res = await fetch('assets/events.json');
        const data = await res.json();
        jsonEvents = Array.isArray(data) ? data : (data.events || []);
    } catch {}

    const localEvents = JSON.parse(localStorage.getItem('my_events') || '[]');
    const deletedIds = JSON.parse(localStorage.getItem('deleted_events') || '[]');

    // Construct final list (without IDs if you want clean JSON, or with?)
    // Standard format for events.json is just array of objects.
    
    // We need to merge and EXCLUDE deleted ones.
    const merged = [
        ...jsonEvents.filter(e => !deletedIds.includes(e.id && e.id.startsWith('json|') ? e.id : `json|${e.date}|${e.title}`)),
        ...localEvents
    ].map(e => ({
        date: e.date,
        title: e.title,
        content: e.content
    }));

    merged.sort((a, b) => {
        if (a.date === 'FUTURE') return 1;
        if (b.date === 'FUTURE') return -1;
        return a.date.localeCompare(b.date);
    });

    const jsonStr = JSON.stringify({ events: merged }, null, 2);
    
    // === Try API Save First ===
    try {
        const res = await fetch('/api/save-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonStr
        });
        if (res.ok) {
            const ret = await res.json();
            if (ret.success) {
                // Success! Clear local storage to prevent duplicates/confusion
                localStorage.removeItem('my_events');
                localStorage.removeItem('deleted_events');
                alert("✅ 成功！\n已将更改写入 events.json。\n页面将刷新以加载最新数据。");
                location.reload();
                return;
            }
        }
    } catch (e) {
        // API not available, fall back to clipboard
        console.log("Local API unavailable, falling back to clipboard");
    }

    // === Fallback: Clipboard ===
    try {
        await navigator.clipboard.writeText(jsonStr);
        alert("已复制完整 JSON 配置！\\n请打开 E:\\\\Myblogs\\\\0r4n9ler\\\\assets\\\\events.json 并覆盖内容以永久保存。");
    } catch (err) {
        console.error(err);
        alert("复制失败，请查看控制台");
    }
}

// === Article Manager Logic ===

let editingPostId = null;

function openPostManager() {
    const modal = document.getElementById('articleManagerModal');
    if (modal) {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        renderPostManager();
    }
}

function closePostManager() {
    const modal = document.getElementById('articleManagerModal');
    if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        editingPostId = null; // Reset edit state
    }
}

async function renderPostManager() {
    const container = document.getElementById('articleManagerContent');
    if (!container) return;

    // Load Data (similar to loadPosts but for manager)
    let jsonPosts = [];
    try {
        const res = await fetch('assets/posts.json', { cache: 'no-store' });
        const data = await res.json();
        jsonPosts = Array.isArray(data) ? data : (data.posts || []);
        jsonPosts = jsonPosts.map(p => ({ ...p, id: p.id || `json|${p.date}|${p.title}`, source: 'json' }));
    } catch {}

    const localPosts = JSON.parse(localStorage.getItem('my_posts') || '[]');
    const deletedIds = JSON.parse(localStorage.getItem('deleted_posts') || '[]');

    let allPosts = [...jsonPosts, ...localPosts].filter(p => !deletedIds.includes(p.id));
    allPosts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const formHtml = `
        <div style="margin-bottom: 30px; border-bottom: 1px solid #333; padding-bottom: 20px;">
            <h4 style="margin-bottom: 10px; color: var(--accent-blue);">${editingPostId ? '✎ 编辑文章' : '+ 撰写新文章'}</h4>
            <div style="display: grid; gap: 10px;">
                <input type="text" id="postTitleInput" placeholder="文章标题" style="width:100%; padding:8px; background:#111; border:1px solid #333; color:#fff;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <input type="text" id="postDateInput" placeholder="日期 (YYYY-MM-DD)" style="width:100%; padding:8px; background:#111; border:1px solid #333; color:#fff;">
                    <input type="text" id="postTagsInput" placeholder="标签 (用逗号分隔)" style="width:100%; padding:8px; background:#111; border:1px solid #333; color:#fff;">
                </div>
                <div style="margin-bottom:5px;">
                    <label style="color:#aaa; font-size:12px; display:block; margin-bottom:5px;">导入 Markdown 文件 (仅限 .md):</label>
                    <input type="file" id="mdFileInput" accept=".md" style="color:#fff; font-size:12px;" onchange="handleMdFileSelect(this)">
                </div>
                <textarea id="postContentInput" placeholder="Markdown 内容..." rows="10" style="width:100%; padding:8px; background:#111; border:1px solid #333; color:#fff; font-family: monospace;"></textarea>
                <div style="display: flex; gap: 10px;">
                    <button onclick="savePost()" style="padding: 8px 16px; background: ${editingPostId ? 'var(--accent-orange)' : 'var(--accent-blue)'}; color: #000; border: none; cursor: pointer; font-weight: bold; flex: 1;">
                        ${editingPostId ? '更新文章' : '发布文章 (本地)'}
                    </button>
                    ${editingPostId ? `<button onclick="cancelEditPost()" style="padding: 8px 16px; background: #333; color: #fff; border: none; cursor: pointer;">取消</button>` : ''}
                </div>
            </div>
        </div>
    `;

    const listHtml = `
        <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h4 style="color: var(--accent-orange);">现有文章列表 (${allPosts.length})</h4>
                <button onclick="exportPosts()" style="padding:4px 8px; font-size:12px; background:var(--accent-blue); color:#000; border:none; cursor:pointer; font-weight:bold;">💾 保存到硬盘 / 导出JSON</button>
            </div>
            <ul style="list-style: none; max-height: 400px; overflow-y: auto;">
                ${allPosts.map(p => `
                    <li style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); margin-bottom: 8px; padding: 10px; border-radius: 4px;">
                        <div style="flex: 1; padding-right: 10px;">
                            <div style="font-weight: bold; color: var(--accent-blue); font-size: 0.9em;">${escapeHtml(p.date)}</div>
                            <div style="font-weight: bold;">${escapeHtml(p.title)}</div>
                            <div style="font-size: 0.7em; color: #555; margin-top: 2px;">来源: ${p.source === 'json' ? '文件' : '本地'}</div>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button onclick="startEditPost('${p.id}')" style="background: #003366; color: #4db8ff; border: 1px solid #004080; padding: 4px 8px; cursor: pointer; font-size: 12px;">编辑</button>
                            <button onclick="deletePost('${p.id}')" style="background: #330000; color: #ff4444; border: 1px solid #660000; padding: 4px 8px; cursor: pointer; font-size: 12px;">删除</button>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;

    container.innerHTML = formHtml + listHtml;

    // Fill form if editing
    if (editingPostId) {
        const post = allPosts.find(p => p.id === editingPostId);
        if (post) {
            document.getElementById('postTitleInput').value = post.title || '';
            document.getElementById('postDateInput').value = post.date || '';
            document.getElementById('postTagsInput').value = (post.tags || []).join(', ');
            
            // Load content
            if (post.content) {
                document.getElementById('postContentInput').value = post.content;
            } else if (post.file) {
                document.getElementById('postContentInput').value = "Loading content...";
                try {
                    const res = await fetch(`posts/${post.file}`);
                    if (res.ok) {
                        document.getElementById('postContentInput').value = await res.text();
                    } else {
                        document.getElementById('postContentInput').value = "Error loading file content.";
                    }
                } catch {
                     document.getElementById('postContentInput').value = "Error loading file content.";
                }
            }
        }
    } else {
        // Auto-fill date
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        document.getElementById('postDateInput').value = `${yyyy}-${mm}-${dd}`;
    }
}

async function startEditPost(id) {
    editingPostId = id;
    await renderPostManager();
}

function cancelEditPost() {
    editingPostId = null;
    renderPostManager();
}

function savePost() {
    const title = document.getElementById('postTitleInput').value.trim();
    const date = document.getElementById('postDateInput').value.trim();
    const tagsStr = document.getElementById('postTagsInput').value.trim();
    const content = document.getElementById('postContentInput').value;

    if (!title || !date) {
        alert("标题和日期必填");
        return;
    }

    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];

    const newPost = {
        id: 'local_post_' + Date.now(),
        title,
        date,
        tags,
        content,
        source: 'local'
    };

    if (editingPostId) {
        // Handle Edit
        if (editingPostId.startsWith('json|')) {
            // Blacklist original
            const deletedIds = JSON.parse(localStorage.getItem('deleted_posts') || '[]');
            if (!deletedIds.includes(editingPostId)) {
                deletedIds.push(editingPostId);
                localStorage.setItem('deleted_posts', JSON.stringify(deletedIds));
            }
        } else {
            // Remove old local
             let localPosts = JSON.parse(localStorage.getItem('my_posts') || '[]');
             localPosts = localPosts.filter(p => p.id !== editingPostId);
             localStorage.setItem('my_posts', JSON.stringify(localPosts));
        }
    }

    // Add new local
    const localPosts = JSON.parse(localStorage.getItem('my_posts') || '[]');
    localPosts.push(newPost);
    localStorage.setItem('my_posts', JSON.stringify(localPosts));

    editingPostId = null;
    renderPostManager();
    loadPosts();
}

function deletePost(id) {
    if (!confirm("确定删除此文章吗？(仅本地生效)")) return;

    if (id.startsWith('json|')) {
        const deletedIds = JSON.parse(localStorage.getItem('deleted_posts') || '[]');
        deletedIds.push(id);
        localStorage.setItem('deleted_posts', JSON.stringify(deletedIds));
    } else {
        let localPosts = JSON.parse(localStorage.getItem('my_posts') || '[]');
        localPosts = localPosts.filter(p => p.id !== id);
        localStorage.setItem('my_posts', JSON.stringify(localPosts));
    }
    renderPostManager();
    loadPosts();
}

function handleMdFileSelect(input) {
    const file = input.files[0];
    if (!file) return;
    
    // Strict check for .md extension
    if (!file.name.toLowerCase().endsWith('.md')) {
        alert("仅支持上传 .md (Markdown) 文件！");
        input.value = ''; // Clear selection
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        const contentEl = document.getElementById('postContentInput');
        if (contentEl) {
            contentEl.value = content;
        }
        
        // Auto-fill title from filename if empty
        const titleEl = document.getElementById('postTitleInput');
        if (titleEl && !titleEl.value) {
            titleEl.value = file.name.replace(/\.md$/i, '');
        }
    };
    reader.readAsText(file);
}

async function exportPosts() {
    let jsonPosts = [];
    try {
        const res = await fetch('assets/posts.json');
        const data = await res.json();
        jsonPosts = Array.isArray(data) ? data : (data.posts || []);
    } catch {}

    const localPosts = JSON.parse(localStorage.getItem('my_posts') || '[]');
    const deletedIds = JSON.parse(localStorage.getItem('deleted_posts') || '[]');

    const validJsonPosts = jsonPosts.filter(p => {
        const id = p.id || `json|${p.date}|${p.title}`;
        return !deletedIds.includes(id);
    });

    const finalPosts = [...validJsonPosts, ...localPosts].map(p => ({
        title: p.title,
        date: p.date,
        tags: p.tags,
        file: p.file, // Keep file if exists
        content: p.content // Keep content if exists (local)
    }));

    finalPosts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const jsonStr = JSON.stringify({ posts: finalPosts }, null, 2);
    
    // === Try API Save First ===
    try {
        const res = await fetch('/api/save-posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonStr
        });
        if (res.ok) {
            const ret = await res.json();
            if (ret.success) {
                // Success! Clear local storage
                localStorage.removeItem('my_posts');
                localStorage.removeItem('deleted_posts');
                alert("✅ 成功！\n已将更改写入 posts.json。\n页面将刷新以加载最新数据。");
                location.reload();
                return;
            }
        }
    } catch (e) {
        // API not available
        console.log("Local API unavailable, falling back to clipboard");
    }

    // === Fallback: Clipboard ===
    try {
        await navigator.clipboard.writeText(jsonStr);
        alert("已复制完整文章 JSON！\\n请覆盖 assets/posts.json。\\n注意：新文章的内容直接嵌入在 JSON 中，这是为了方便单文件迁移。如果你希望保持 posts/ 目录整洁，请手动将 content 内容移动到 .md 文件并更新 JSON 的 file 字段。");
    } catch (e) {
        console.error(e);
        alert("复制失败");
    }
}
