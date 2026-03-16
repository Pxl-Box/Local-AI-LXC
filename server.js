const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Ollama Wrapper Endpoints ---

// List local models
app.get('/api/models', async (req, res) => {
    try {
        const response = await axios.get(`${OLLAMA_URL}/api/tags`);
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching models:', error.message);
        res.status(500).json({ error: 'Failed to fetch models from Ollama' });
    }
});

// Pull a new model
app.post('/api/models/pull', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Model name is required' });

    try {
        // We use a stream for pulling if possible, but for a simple JSON response:
        const response = await axios.post(`${OLLAMA_URL}/api/pull`, { name }, { responseType: 'stream' });
        
        // Pipe the Ollama stream directly to the client
        res.setHeader('Content-Type', 'application/json');
        response.data.pipe(res);
    } catch (error) {
        console.error('Error pulling model:', error.message);
        res.status(500).json({ error: 'Failed to pull model' });
    }
});

// Delete a model
app.delete('/api/models/:name', async (req, res) => {
    const { name } = req.params;
    try {
        await axios.delete(`${OLLAMA_URL}/api/delete`, { data: { name } });
        res.json({ message: `Model ${name} deleted successfully` });
    } catch (error) {
        console.error('Error deleting model:', error.message);
        res.status(500).json({ error: 'Failed to delete model' });
    }
});

// Chat endpoint (Streaming)
app.post('/api/chat', async (req, res) => {
    const { model, messages, stream = true } = req.body;
    
    try {
        const response = await axios.post(`${OLLAMA_URL}/api/chat`, {
            model,
            messages,
            stream
        }, { responseType: 'stream' });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        response.data.pipe(res);
    } catch (error) {
        console.error('Chat error:', error.message);
        res.status(500).json({ error: 'Chat failed' });
    }
});

// --- Image Gallery ---

// List generated images (assuming they are in public/images)
app.get('/api/images', (req, res) => {
    const imagesDir = path.join(__dirname, 'public', 'images');
    fs.readdir(imagesDir, (err, files) => {
        if (err) return res.status(500).json({ error: 'Failed to read images directory' });
        
        const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));
        res.json(imageFiles);
    });
});

// Serve the frontend for any other route (SPA)
app.get('(.*)', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    console.log(`Connected to Ollama at ${OLLAMA_URL}`);
});
