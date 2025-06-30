// subir.js

window.uploadFile = async function () {
    const input = document.getElementById('input');
    const file = input.files[0];
    if (!file) return alert('Please select a file.');

    const upload = document.querySelector('button[onclick="uploadFile()"]');
    upload.disabled = true;
    showNotification(`Uploading model <em>${file.name}</em>. Do not reload the page.`);

    try {
        const objectKey = file.name;

        const data = new FormData();
        const renamedFile = new File([file], objectKey); // important: file with path
        data.append('model-file', renamedFile);

        // Opcionalmente manejar ZIPs (aunque en tu caso no los usas)
        if (file.name.endsWith('.zip')) {
            const entrypoint = window.prompt('Please enter the filename of the main design inside the archive.');
            data.append('model-zip-entrypoint', entrypoint);
        }

        const resp = await fetch('/api/models', {
            method: 'POST',
            body: data
        });
        if (!resp.ok) throw new Error(await resp.text());

        const model = await resp.json();
        window.location.hash = model.urn;

        const event = new CustomEvent('model-uploaded', { detail: model.urn });
        document.dispatchEvent(event);

    } catch (err) {
        alert(`Could not upload model. See console.`);
        console.error(err);
    } finally {
        clearNotification();
        upload.disabled = false;
        input.value = '';
    }
};

function showNotification(message) {
    const overlay = document.getElementById('overlay');
    if (!overlay) {
        const el = document.createElement('div');
        el.id = 'overlay';
        el.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#00000080;z-index:1000;display:flex;align-items:center;justify-content:center;color:white';
        el.innerHTML = `<div class="notification">${message}</div>`;
        document.body.appendChild(el);
    } else {
        overlay.innerHTML = `<div class="notification">${message}</div>`;
        overlay.style.display = 'flex';
    }
}

function clearNotification() {
    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.innerHTML = '';
        overlay.style.display = 'none';
    }
}

window.uploadFile = uploadFile;
