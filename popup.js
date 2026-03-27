// State
let clicks = [];
let currentType = 'text';
let activeTab = 'all';
let imageBase64 = '';

// DOM Elements
const clicksList = document.getElementById('clicks-list');
const searchInput = document.getElementById('search-input');
const addBtn = document.getElementById('add-btn');
const modalOverlay = document.getElementById('modal-overlay');
const closeModal = document.getElementById('close-modal');
const saveClickBtn = document.getElementById('save-click');
const typeTextBtn = document.getElementById('type-text');
const typeImageBtn = document.getElementById('type-image');
const fileInput = document.getElementById('file-input');
const newTitleInput = document.getElementById('new-title');
const newContentInput = document.getElementById('new-content');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageBtn = document.getElementById('remove-image');
const charGrid = document.querySelector('.char-grid');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');

const modalTitle = document.getElementById('modal-title');
const editIdInput = document.getElementById('edit-id');

// Drag and Drop State
let draggedItemIndex = null;
let scrollInterval = null;
let scrollDirection = 0; // -1 for up, 1 for down, 0 for none

function handleAutoScroll(e) {
    const container = clicksList;
    const rect = container.getBoundingClientRect();
    const threshold = 60; // pixels from top/bottom to start scrolling
    const scrollSpeed = 8;

    let newDirection = 0;
    if (e.clientY < rect.top + threshold) {
        newDirection = -1;
    } else if (e.clientY > rect.bottom - threshold) {
        newDirection = 1;
    }

    if (newDirection !== scrollDirection) {
        stopAutoScroll();
        scrollDirection = newDirection;
        if (scrollDirection !== 0) {
            scrollInterval = setInterval(() => {
                container.scrollTop += scrollDirection * scrollSpeed;
            }, 16);
        }
    }
}

function stopAutoScroll() {
    if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
    }
    scrollDirection = 0;
}

function base64ToBlob(base64, mime) {
    const byteString = atob(base64.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mime });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadClicks();
    setupEventListeners();
});

function loadClicks() {
    chrome.storage.local.get(['clicks'], (result) => {
        clicks = result.clicks || [];
        renderClicks();
    });
}

function saveClicks() {
    chrome.storage.local.set({ clicks });
}

function exportClicks() {
    if (clicks.length === 0) {
        showToast('No data to export');
        return;
    }
    const dataStr = JSON.stringify(clicks, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `copyclick_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported successfully');
}

function importClicks(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedClicks = JSON.parse(event.target.result);
            if (!Array.isArray(importedClicks)) {
                throw new Error('Invalid format');
            }
            // Basic validation
            const isValid = importedClicks.every(p => p.id && p.type && p.content);
            if (!isValid) {
                throw new Error('Invalid data structure');
            }

            if (confirm(`Import ${importedClicks.length} clicks? This will merge with your existing data.`)) {
                // Merge and avoid duplicates by ID
                const existingIds = new Set(clicks.map(p => p.id));
                const newClicks = importedClicks.filter(p => !existingIds.has(p.id));
                clicks = [...newClicks, ...clicks];
                saveClicks();
                renderClicks();
                showToast(`Imported ${newClicks.length} new clicks`);
            }
        } catch (err) {
            console.error('Import failed', err);
            showToast('Invalid JSON file');
        }
        importFile.value = ''; // Reset file input
    };
    reader.readAsText(file);
}

function renderClicks(query = '') {
    const searchTerm = query.toLowerCase();
    const filtered = clicks.filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(searchTerm) || 
                             p.content.toLowerCase().includes(searchTerm);
        const matchesTab = activeTab === 'all' || p.type === activeTab;
        return matchesSearch && matchesTab;
    });

    clicksList.innerHTML = '';
    
    if (filtered.length === 0) {
        clicksList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-muted); animation: fadeIn 0.5s ease-out;">
                <div style="margin-bottom: 16px; opacity: 0.6; display: flex; justify-content: center;">
                    <svg width="64" height="64" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="empty-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#FF6B6B" />
                                <stop offset="100%" stop-color="#FFD93D" />
                            </linearGradient>
                        </defs>
                        <rect width="128" height="128" rx="36" fill="url(#empty-bg)" />
                        <path d="M85 45C80 38 70 34 60 34C40 34 28 48 28 64C28 80 40 94 60 94C70 94 80 90 85 83" stroke="white" stroke-width="12" stroke-linecap="round" />
                        <circle cx="85" cy="64" r="6" fill="white" />
                    </svg>
                </div>
                <p style="font-weight: 600;">No clicks found</p>
                <p style="font-size: 12px; margin-top: 4px;">Try a different search or add a new click!</p>
            </div>
        `;
        return;
    }

    filtered.forEach((click, index) => {
        const card = document.createElement('div');
        card.className = 'click-card';
        card.draggable = true;
        card.dataset.index = index;
        card.style.animationDelay = `${index * 0.05}s`;
        
        let icon = '📄';
        if (click.type === 'image') icon = '🖼️';
        if (click.type === 'link') icon = '🔗';

        card.innerHTML = `
            <div class="drag-handle">⋮⋮</div>
            <div class="click-icon type-${click.type}">${icon}</div>
            <div class="click-info">
                <h3>${escapeHtml(click.title)}</h3>
            </div>
            <div class="action-buttons">
                <button class="btn-action btn-edit" data-id="${click.id}" title="Edit">✏️</button>
                <button class="btn-action btn-delete" data-id="${click.id}" title="Delete">🗑️</button>
            </div>
        `;

        card.addEventListener('dragstart', (e) => {
            draggedItemIndex = index;
            card.classList.add('dragging');
            
            if (click.type === 'image') {
                try {
                    const parts = click.content.split(';');
                    const mime = parts[0].split(':')[1];
                    const blob = base64ToBlob(click.content, mime);
                    const file = new File([blob], click.title || "image.png", { type: mime });
                    
                    // Modern way
                    e.dataTransfer.items.add(file);
                    
                    // Chromium specific: Drag to desktop/folders
                    const downloadUrl = `${mime}:${click.title || 'image.png'}:${click.content}`;
                    e.dataTransfer.setData('DownloadURL', downloadUrl);
                    
                    // Web compatibility
                    e.dataTransfer.setData('text/html', `<img src="${click.content}" alt="${click.title}">`);
                    e.dataTransfer.setData('text/uri-list', click.content);
                    e.dataTransfer.setData('text/plain', click.content);
                } catch (err) {
                    console.error('Failed to add image to drag data', err);
                }
            } else {
                e.dataTransfer.setData('text/plain', click.content);
                if (click.type === 'link') {
                    e.dataTransfer.setData('text/uri-list', click.content);
                }
            }
            
            e.dataTransfer.effectAllowed = 'copy';
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            draggedItemIndex = null;
            stopAutoScroll();
            const allCards = clicksList.querySelectorAll('.click-card');
            allCards.forEach(c => c.classList.remove('drag-over'));
        });

        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            handleAutoScroll(e);
            card.classList.add('drag-over');
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('drag-over');
        });

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            stopAutoScroll();
            if (draggedItemIndex !== null && draggedItemIndex !== index) {
                const itemToMove = clicks.splice(draggedItemIndex, 1)[0];
                clicks.splice(index, 0, itemToMove);
                saveClicks();
                renderClicks(searchInput.value);
            }
        });

        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-action') || e.target.closest('.drag-handle')) return;
            copyToClipboard(click);
            
            // Visual feedback
            const originalBg = card.style.background;
            card.style.background = '#f0fdf4';
            card.style.borderColor = '#22c55e';
            const h3 = card.querySelector('h3');
            const originalText = h3.innerText;
            h3.innerText = 'Copied! ✅';
            
            setTimeout(() => {
                card.style.background = originalBg;
                card.style.borderColor = '';
                h3.innerText = originalText;
            }, 1000);
        });

        const editBtn = card.querySelector('.btn-edit');
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(click);
        });

        const delBtn = card.querySelector('.btn-delete');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            card.style.transform = 'scale(0.9) translateX(20px)';
            card.style.opacity = '0';
            setTimeout(() => deleteClick(click.id), 300);
        });

        clicksList.appendChild(card);
    });
}

function openEditModal(click) {
    modalTitle.innerText = 'Edit Click';
    editIdInput.value = click.id;
    newTitleInput.value = click.title;
    
    if (click.type === 'image') {
        imageBase64 = click.content;
        currentType = 'image';
        typeImageBtn.classList.add('active');
        typeTextBtn.classList.remove('active');
        newContentInput.classList.add('hidden');
        imagePreviewContainer.classList.remove('hidden');
        imagePreview.src = imageBase64;
    } else {
        newContentInput.value = click.content;
        currentType = 'text';
        typeTextBtn.classList.add('active');
        typeImageBtn.classList.remove('active');
        newContentInput.classList.remove('hidden');
        imagePreviewContainer.classList.add('hidden');
    }
    
    modalOverlay.classList.remove('hidden');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function copyToClipboard(click) {
    try {
        if (click.type === 'image') {
            const response = await fetch(click.content);
            const blob = await response.blob();
            await navigator.clipboard.write([
                new ClipboardItem({ [blob.type]: blob })
            ]);
        } else {
            await navigator.clipboard.writeText(click.content);
        }
        // Inline feedback is now provided in renderClicks
    } catch (err) {
        console.error('Copy failed', err);
        showToast('Failed to copy');
    }
}

function deleteClick(id) {
    clicks = clicks.filter(p => p.id !== id);
    saveClicks();
    renderClicks(searchInput.value);
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 60px;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        z-index: 1000;
        animation: fadeInOut 2s forwards;
    `;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// Event Listeners
function setupEventListeners() {
    clicksList.addEventListener('dragover', (e) => {
        e.preventDefault();
        handleAutoScroll(e);
    });

    clicksList.addEventListener('dragleave', () => {
        stopAutoScroll();
    });

    searchInput.addEventListener('input', (e) => renderClicks(e.target.value));

    newContentInput.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        imageBase64 = event.target.result;
                        currentType = 'image';
                        typeImageBtn.classList.add('active');
                        typeTextBtn.classList.remove('active');
                        newContentInput.classList.add('hidden');
                        imagePreviewContainer.classList.remove('hidden');
                        imagePreview.src = imageBase64;
                        if (!newTitleInput.value) newTitleInput.value = `Pasted Image ${new Date().toLocaleTimeString()}`;
                    };
                    reader.readAsDataURL(file);
                }
                e.preventDefault();
                break;
            }
        }
    });

    // Tab Filtering
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTab = btn.dataset.tab;
            renderClicks(searchInput.value);
        });
    });

    const pinBtn = document.getElementById('pin-btn');

    // Pin to Side Panel
    pinBtn.addEventListener('click', async () => {
        if (typeof chrome !== 'undefined' && chrome.sidePanel) {
            try {
                const window = await chrome.windows.getCurrent();
                await chrome.sidePanel.open({ windowId: window.id });
                // Optional: close the popup after opening side panel
                window.close();
            } catch (err) {
                console.error('Failed to open side panel:', err);
                // Fallback: alert user if side panel fails
                showToast('Side panel not supported or failed to open', 'error');
            }
        } else {
            showToast('Side panel is only available in Chrome extension', 'error');
        }
    });

    addBtn.addEventListener('click', () => {
        modalTitle.innerText = 'New Click';
        editIdInput.value = '';
        modalOverlay.classList.remove('hidden');
    });
    closeModal.addEventListener('click', () => {
        modalOverlay.classList.add('hidden');
        resetForm();
    });

    typeTextBtn.addEventListener('click', () => {
        currentType = 'text';
        typeTextBtn.classList.add('active');
        typeImageBtn.classList.remove('active');
        newContentInput.classList.remove('hidden');
        imagePreviewContainer.classList.add('hidden');
    });

    typeImageBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                imageBase64 = event.target.result;
                currentType = 'image';
                typeImageBtn.classList.add('active');
                typeTextBtn.classList.remove('active');
                newContentInput.classList.add('hidden');
                imagePreviewContainer.classList.remove('hidden');
                imagePreview.src = imageBase64;
                if (!newTitleInput.value) newTitleInput.value = file.name;
            };
            reader.readAsDataURL(file);
        }
    });

    removeImageBtn.addEventListener('click', () => {
        imageBase64 = '';
        currentType = 'text';
        typeTextBtn.classList.add('active');
        typeImageBtn.classList.remove('active');
        newContentInput.classList.remove('hidden');
        imagePreviewContainer.classList.add('hidden');
    });

    charGrid.addEventListener('click', (e) => {
        if (e.target.tagName === 'SPAN') {
            newContentInput.value += e.target.innerText;
        }
    });

    exportBtn.addEventListener('click', exportClicks);
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', importClicks);

    saveClickBtn.addEventListener('click', () => {
        const title = newTitleInput.value.trim();
        const content = currentType === 'image' ? imageBase64 : newContentInput.value.trim();
        const editId = editIdInput.value;

        if (!content) return;

        let type = currentType;
        if (type === 'text' && content.startsWith('http')) type = 'link';

        if (editId) {
            // Update existing
            const index = clicks.findIndex(p => p.id === editId);
            if (index !== -1) {
                clicks[index] = {
                    ...clicks[index],
                    type,
                    title: title || (type === 'text' ? content.substring(0, 20) : 'Untitled'),
                    content
                };
            }
        } else {
            // Create new
            const newClick = {
                id: Date.now().toString(),
                type,
                title: title || (type === 'text' ? content.substring(0, 20) : 'Untitled'),
                content,
                createdAt: Date.now()
            };
            clicks.unshift(newClick);
        }

        saveClicks();
        renderClicks(searchInput.value);
        modalOverlay.classList.add('hidden');
        resetForm();
    });
}

function resetForm() {
    newTitleInput.value = '';
    newContentInput.value = '';
    imageBase64 = '';
    currentType = 'text';
    typeTextBtn.classList.add('active');
    typeImageBtn.classList.remove('active');
    newContentInput.classList.remove('hidden');
    imagePreviewContainer.classList.add('hidden');
}

// Animation CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, 20px); }
        15% { opacity: 1; transform: translate(-50%, 0); }
        85% { opacity: 1; transform: translate(-50%, 0); }
        100% { opacity: 0; transform: translate(-50%, -20px); }
    }
`;
document.head.appendChild(style);
