// State
let picks = [];
let currentType = 'text';
let imageBase64 = '';

// DOM Elements
const picksList = document.getElementById('picks-list');
const searchInput = document.getElementById('search-input');
const addBtn = document.getElementById('add-btn');
const modalOverlay = document.getElementById('modal-overlay');
const closeModal = document.getElementById('close-modal');
const savePickBtn = document.getElementById('save-pick');
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
    const container = picksList;
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadPicks();
    setupEventListeners();
});

function loadPicks() {
    chrome.storage.local.get(['picks'], (result) => {
        picks = result.picks || [];
        renderPicks();
    });
}

function savePicks() {
    chrome.storage.local.set({ picks });
}

function exportPicks() {
    if (picks.length === 0) {
        showToast('No data to export');
        return;
    }
    const dataStr = JSON.stringify(picks, null, 2);
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

function importPicks(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedPicks = JSON.parse(event.target.result);
            if (!Array.isArray(importedPicks)) {
                throw new Error('Invalid format');
            }
            // Basic validation
            const isValid = importedPicks.every(p => p.id && p.type && p.content);
            if (!isValid) {
                throw new Error('Invalid data structure');
            }

            if (confirm(`Import ${importedPicks.length} picks? This will merge with your existing data.`)) {
                // Merge and avoid duplicates by ID
                const existingIds = new Set(picks.map(p => p.id));
                const newPicks = importedPicks.filter(p => !existingIds.has(p.id));
                picks = [...newPicks, ...picks];
                savePicks();
                renderPicks();
                showToast(`Imported ${newPicks.length} new picks`);
            }
        } catch (err) {
            console.error('Import failed', err);
            showToast('Invalid JSON file');
        }
        importFile.value = ''; // Reset file input
    };
    reader.readAsText(file);
}

function renderPicks(query = '') {
    const searchTerm = query.toLowerCase();
    const filtered = picks.filter(p => 
        p.title.toLowerCase().includes(searchTerm) || 
        p.content.toLowerCase().includes(searchTerm)
    );

    picksList.innerHTML = '';
    
    if (filtered.length === 0) {
        picksList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-muted); animation: fadeIn 0.5s ease-out;">
                <div style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;">📂</div>
                <p style="font-weight: 600;">No picks found</p>
                <p style="font-size: 12px; margin-top: 4px;">Try a different search or add a new pick!</p>
            </div>
        `;
        return;
    }

    filtered.forEach((pick, index) => {
        const card = document.createElement('div');
        card.className = 'pick-card';
        card.draggable = true;
        card.dataset.index = index;
        card.style.animationDelay = `${index * 0.05}s`;
        
        let icon = '📄';
        if (pick.type === 'image') icon = '🖼️';
        if (pick.type === 'link') icon = '🔗';

        card.innerHTML = `
            <div class="drag-handle">⋮⋮</div>
            <div class="pick-icon type-${pick.type}">${icon}</div>
            <div class="pick-info">
                <h3>${escapeHtml(pick.title)}</h3>
                <p>${pick.type === 'image' ? 'Image Content' : escapeHtml(pick.content.substring(0, 50))}${pick.content.length > 50 ? '...' : ''}</p>
            </div>
            <div class="action-buttons">
                <button class="btn-action btn-edit" data-id="${pick.id}" title="Edit">✏️</button>
                <button class="btn-action btn-delete" data-id="${pick.id}" title="Delete">🗑️</button>
            </div>
        `;

        // Drag and Drop Events
        card.addEventListener('dragstart', (e) => {
            draggedItemIndex = index;
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            draggedItemIndex = null;
            stopAutoScroll();
            const allCards = picksList.querySelectorAll('.pick-card');
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
                const itemToMove = picks.splice(draggedItemIndex, 1)[0];
                picks.splice(index, 0, itemToMove);
                savePicks();
                renderPicks(searchInput.value);
            }
        });

        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-action') || e.target.closest('.drag-handle')) return;
            copyToClipboard(pick);
            
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
            openEditModal(pick);
        });

        const delBtn = card.querySelector('.btn-delete');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            card.style.transform = 'scale(0.9) translateX(20px)';
            card.style.opacity = '0';
            setTimeout(() => deletePick(pick.id), 300);
        });

        picksList.appendChild(card);
    });
}

function openEditModal(pick) {
    modalTitle.innerText = 'Edit Pick';
    editIdInput.value = pick.id;
    newTitleInput.value = pick.title;
    
    if (pick.type === 'image') {
        imageBase64 = pick.content;
        currentType = 'image';
        typeImageBtn.classList.add('active');
        typeTextBtn.classList.remove('active');
        newContentInput.classList.add('hidden');
        imagePreviewContainer.classList.remove('hidden');
        imagePreview.src = imageBase64;
    } else {
        newContentInput.value = pick.content;
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

async function copyToClipboard(pick) {
    try {
        if (pick.type === 'image') {
            const response = await fetch(pick.content);
            const blob = await response.blob();
            await navigator.clipboard.write([
                new ClipboardItem({ [blob.type]: blob })
            ]);
        } else {
            await navigator.clipboard.writeText(pick.content);
        }
        // Inline feedback is now provided in renderPicks
    } catch (err) {
        console.error('Copy failed', err);
        showToast('Failed to copy');
    }
}

function deletePick(id) {
    picks = picks.filter(p => p.id !== id);
    savePicks();
    renderPicks(searchInput.value);
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
    picksList.addEventListener('dragover', (e) => {
        e.preventDefault();
        handleAutoScroll(e);
    });

    picksList.addEventListener('dragleave', () => {
        stopAutoScroll();
    });

    searchInput.addEventListener('input', (e) => renderPicks(e.target.value));

    addBtn.addEventListener('click', () => {
        modalTitle.innerText = 'New Pick';
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

    exportBtn.addEventListener('click', exportPicks);
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', importPicks);

    savePickBtn.addEventListener('click', () => {
        const title = newTitleInput.value.trim();
        const content = currentType === 'image' ? imageBase64 : newContentInput.value.trim();
        const editId = editIdInput.value;

        if (!content) return;

        let type = currentType;
        if (type === 'text' && content.startsWith('http')) type = 'link';

        if (editId) {
            // Update existing
            const index = picks.findIndex(p => p.id === editId);
            if (index !== -1) {
                picks[index] = {
                    ...picks[index],
                    type,
                    title: title || (type === 'text' ? content.substring(0, 20) : 'Untitled'),
                    content
                };
            }
        } else {
            // Create new
            const newPick = {
                id: Date.now().toString(),
                type,
                title: title || (type === 'text' ? content.substring(0, 20) : 'Untitled'),
                content,
                createdAt: Date.now()
            };
            picks.unshift(newPick);
        }

        savePicks();
        renderPicks(searchInput.value);
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
