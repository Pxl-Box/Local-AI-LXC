document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let currentView = 'chat';
    let models = [];
    let currentModel = '';

    // --- DOM Elements ---
    const navItems = document.querySelectorAll('.nav-item');
    const viewPanels = document.querySelectorAll('.view-panel');
    const viewTitle = document.getElementById('view-title');
    const modelSelect = document.getElementById('model-select');
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const refreshBtn = document.getElementById('refresh-models');
    
    // Installer elements
    const modelNameInput = document.getElementById('model-name-input');
    const pullModelBtn = document.getElementById('pull-model-btn');
    const terminalOutput = document.getElementById('terminal-output');

    // --- Navigation ---
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.getAttribute('data-view');
            if (!view) return;
            switchView(view);
        });
    });

    function switchView(viewId) {
        currentView = viewId;
        
        // Update nav
        navItems.forEach(item => {
            if (item.getAttribute('data-view') === viewId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Update panels
        viewPanels.forEach(panel => {
            if (panel.id === `${viewId}-view`) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });

        // Update header
        const titles = {
            'chat': 'Chat Console',
            'installer': 'Model Hub (CLI)',
            'gallery': 'Image Gallery'
        };
        viewTitle.textContent = titles[viewId] || 'LXC AI';
        
        if (viewId === 'gallery') loadImages();
    }

    // --- Model Management ---
    async function fetchModels() {
        try {
            const res = await fetch('/api/models');
            const data = await res.json();
            models = data.models || [];
            
            modelSelect.innerHTML = models.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
            if (models.length > 0) {
                currentModel = models[0].name;
            } else {
                modelSelect.innerHTML = '<option value="">No models found</option>';
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
            modelSelect.innerHTML = '<option value="">Error loading models</option>';
        }
    }

    refreshBtn.addEventListener('click', fetchModels);
    modelSelect.addEventListener('change', (e) => currentModel = e.target.value);

    // --- Chat Logic ---
    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text || !currentModel) return;

        // Add user message to UI
        appendMessage('user', text);
        userInput.value = '';
        userInput.style.height = 'auto';

        // Add AI skeleton
        const aiMsgDiv = appendMessage('ai', '...');
        aiMsgDiv.textContent = ''; // Clear skeleton

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: currentModel,
                    messages: [{ role: 'user', content: text }]
                })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiText = '';

            while(true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const json = JSON.parse(line);
                        if (json.message && json.message.content) {
                            aiText += json.message.content;
                        } else if (json.response) { // Ollama generate format
                            aiText += json.response;
                        }
                        aiMsgDiv.textContent = aiText;
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    } catch (e) {
                        // Handle potential partial JSON or non-JSON lines
                        console.warn('JSON parse error in stream:', e);
                    }
                }
            }
        } catch (error) {
            aiMsgDiv.textContent = 'Error: Failed to connect to AI engine.';
            console.error('Chat error:', error);
        }
    }

    function appendMessage(role, text) {
        const div = document.createElement('div');
        div.className = `message ${role}`;
        div.textContent = text;
        chatContainer.appendChild(div);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return div;
    }

    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // --- Installer (Pull Model) ---
    pullModelBtn.addEventListener('click', async () => {
        const name = modelNameInput.value.trim();
        if (!name) return;

        terminalOutput.innerHTML = `<div>> Initializing pull for <b>${name}</b>...</div>`;
        terminalOutput.innerHTML += `<div class="terminal-loading">Status: Downloading <div class="dot"></div><div class="dot" style="animation-delay: 0.2s"></div><div class="dot" style="animation-delay: 0.4s"></div></div>`;

        try {
            const response = await fetch('/api/models/pull', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while(true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const json = JSON.parse(line);
                        if (json.status) {
                            terminalOutput.innerHTML += `<div>[Ollama] ${json.status} ${json.completed ? `(${Math.round((json.completed/json.total)*100)}%)` : ''}</div>`;
                            terminalOutput.scrollTop = terminalOutput.scrollHeight;
                        }
                    } catch (e) {}
                }
            }
            terminalOutput.innerHTML += `<div style="color: #6366f1; margin-top: 10px;">> Model ${name} installed successfully!</div>`;
            fetchModels(); // Refresh list
        } catch (error) {
            terminalOutput.innerHTML += `<div style="color: #ef4444;">> Error: Pull failed. Check network or model name.</div>`;
        }
    });

    // --- Image Gallery ---
    async function loadImages() {
        const grid = document.getElementById('image-grid');
        grid.innerHTML = '<div style="color: var(--text-secondary);">Loading images...</div>';
        try {
            const res = await fetch('/api/images');
            const images = await res.json();
            
            if (images.length === 0) {
                grid.innerHTML = '<div style="color: var(--text-secondary);">No images generated yet. Try a model with image generation capabilities!</div>';
                return;
            }

            grid.innerHTML = images.map(img => `
                <img src="/images/${img}" class="gallery-image" alt="${img}" onclick="window.open('/images/${img}', '_blank')">
            `).join('');
        } catch (error) {
            grid.innerHTML = '<div style="color: #ef4444;">Failed to load images.</div>';
        }
    }

    // Auto-resize textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
    });

    // Initial load
    fetchModels();
});
