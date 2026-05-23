const express = require('express');
const cors = require('cors');
const path = require('path');
const { loadData, saveData } = require('./storage');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname)); // для script.js, db.js, service-worker.js из корня

// API routes
app.get('/api/workouts', async (req, res) => {
    try {
        const data = await loadData();
        res.json(data.workouts || []);
    } catch (error) {
        console.error('Error loading workouts:', error);
        res.status(500).json({ error: 'Failed to load workouts' });
    }
});

app.post('/api/workouts', async (req, res) => {
    try {
        const data = await loadData();
        data.workouts = req.body.workouts || [];
        await saveData(data);
        res.json({ success: true, count: data.workouts.length });
    } catch (error) {
        console.error('Error saving workouts:', error);
        res.status(500).json({ error: 'Failed to save workouts' });
    }
});

app.get('/api/sync', async (req, res) => {
    try {
        const data = await loadData();
        res.json(data);
    } catch (error) {
        console.error('Error loading sync data:', error);
        res.status(500).json({ error: 'Failed to load sync data' });
    }
});

app.post('/api/sync', async (req, res) => {
    try {
        await saveData(req.body);
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving sync data:', error);
        res.status(500).json({ error: 'Failed to save sync data' });
    }
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Static files served from: ${path.join(__dirname, 'public')}`);
});