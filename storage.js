const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

async function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return { workouts: [], lastSync: null };
        }
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        console.error('Error loading data file:', error);
        return { workouts: [], lastSync: null };
    }
}

async function saveData(data) {
    try {
        data.lastSync = new Date().toISOString();
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving data file:', error);
        return false;
    }
}

module.exports = { loadData, saveData };