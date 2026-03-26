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

function renderPicks(query = '') {
    picksList.innerHTML = '';
    
    const filtered = picks.filter(p => 
        p.title.toLowerCase().includes(query.toLowerCase()) || 
        p.content.toLowerCase().includes(query.toLowerCase())
    );

    if (filtered.length === 0) {
        picksList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #999;">
                <p>No picks found.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(pick => {
        const card = document.createElement('div');
        card.className = 'pick-card';
        
        let icon = '📄';
        if (pick.type === 'image') icon = '🖼️';
        if (pick.type === 'link') icon = '🔗';

        card.innerHTML = `
            <div class="pick-icon type-${pick.type}">${icon}</div>
            <div class="pick-info">
                <h3>${pick.title}</h3>
                <p>${pick.type === 'image' ? 'Image Content' : pick.content}</p>
            </div>
            <button class="btn-delete" data-id="${pick.id}">🗑️</button>
        `;

        card.addEventListener('click', () => copyToClipboard(pick));
        
        const delBtn = card.querySelector('.btn-delete');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deletePick(pick.id);
        });

        picksList.appendChild(card);
    });
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
        showToast('Copied!');
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
    searchInput.addEventListener('input', (e) => renderPicks(e.target.value));

    addBtn.addEventListener('click', () => modalOverlay.classList.remove('hidden'));
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

    savePickBtn.addEventListener('click', () => {
        const title = newTitleInput.value.trim();
        const content = currentType === 'image' ? imageBase64 : newContentInput.value.trim();

        if (!content) return;

        let type = currentType;
        if (type === 'text' && content.startsWith('http')) type = 'link';

        const newPick = {
            id: Date.now().toString(),
            type,
            title: title || (type === 'text' ? content.substring(0, 20) : 'Untitled'),
            content,
            createdAt: Date.now()
        };

        picks.unshift(newPick);
        savePicks();
        renderPicks();
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
