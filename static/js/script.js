let panes = {
    left: { current_path: '', history: [] },
    right: { current_path: '', history: [] }
};

document.addEventListener('DOMContentLoaded', () => {
    loadPane('left');
    loadPane('right');
    setupDragAndDrop();
});

let draggedItem = null;

function setupDragAndDrop() {
    ['left', 'right'].forEach(side => {
        const pane = document.getElementById(`${side}-pane`);

        pane.addEventListener('dragover', (e) => {
            e.preventDefault();
            pane.classList.add('drag-over');
        });

        pane.addEventListener('dragleave', () => {
            pane.classList.remove('drag-over');
        });

        pane.addEventListener('drop', async (e) => {
            e.preventDefault();
            pane.classList.remove('drag-over');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                // External files (OS to Browser)
                uploadFiles(side, files);
            } else if (draggedItem && draggedItem.sourceSide !== side) {
                // Inter-pane copy
                copyItem(draggedItem.path, panes[side].current_path);
            }
        });
    });
}

async function uploadFiles(side, files) {
    const targetPath = panes[side].current_path;
    for (let file of files) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const resp = await fetch(`/api/upload?path=${encodeURIComponent(targetPath)}`, {
                method: 'POST',
                body: formData
            });
            if (resp.ok) refreshPane(side);
        } catch (err) {
            console.error('Upload failed:', err);
        }
    }
}

async function copyItem(srcPath, destDir) {
    try {
        const resp = await fetch('/api/copy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ src: srcPath, dest_dir: destDir })
        });
        const data = await resp.json();
        if (data.success) {
            refreshPane('left');
            refreshPane('right');
        } else {
            alert(`Copy failed: ${data.error}`);
        }
    } catch (err) {
        console.error('Copy failed:', err);
    }
}

async function loadPane(side, path = null) {
    const url = path ? `/api/list?path=${encodeURIComponent(path)}` : '/api/list';
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            alert(`Error: ${data.error}`);
            return;
        }

        panes[side].current_path = data.current_path;
        renderPane(side, data);
    } catch (err) {
        console.error(`Failed to load ${side} pane:`, err);
    }
}

function renderPane(side, data) {
    const tbody = document.getElementById(`${side}-list-body`);
    const breadcrumb = document.getElementById(`${side}-breadcrumb`);

    breadcrumb.textContent = data.current_path;
    breadcrumb.onclick = () => loadPane(side, data.current_path);

    tbody.innerHTML = '';

    // Add ".." entry if parent exists
    if (data.parent_path) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="row-icon"><i class="fas fa-level-up-alt"></i></span> ..</td>
            <td></td>
            <td></td>
        `;
        tr.onclick = () => loadPane(side, data.parent_path);
        tbody.appendChild(tr);
    }

    data.items.forEach(item => {
        const tr = document.createElement('tr');
        tr.draggable = true;

        const icon = item.is_dir ? 'fa-folder' : 'fa-file';
        const size = item.is_dir ? '<DIR>' : formatBytes(item.size);
        const date = new Date(item.modified * 1000).toLocaleString();

        tr.innerHTML = `
            <td title="${item.name}">
                <span class="row-icon"><i class="fas ${icon}"></i></span>
                ${item.name}
            </td>
            <td class="size-col">${size}</td>
            <td class="date-col">${date}</td>
        `;

        tr.addEventListener('dragstart', (e) => {
            draggedItem = { path: item.path, sourceSide: side };
            e.dataTransfer.setData('text/plain', item.name);
        });

        tr.onclick = () => {
            if (item.is_dir) {
                loadPane(side, item.path);
            } else {
                window.open(`/api/download?path=${encodeURIComponent(item.path)}`, '_blank');
            }
        };

        tbody.appendChild(tr);
    });
}

function refreshPane(side) {
    loadPane(side, panes[side].current_path);
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
