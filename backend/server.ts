import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Ensure backend directory exists
const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(path.join(dbDir, 'database.sqlite'));

// Create table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`);

// Prepared statements for better performance
const insertPatientStmt = db.prepare('INSERT OR REPLACE INTO patients (id, data, updatedAt) VALUES (@id, @data, @updatedAt)');
const getPatientStmt = db.prepare('SELECT * FROM patients WHERE id = ?');
const getAllPatientsStmt = db.prepare('SELECT * FROM patients');

app.get('/api/patients', (req, res) => {
  try {
    const rows = getAllPatientsStmt.all();
    const patients = rows.map((row: any) => JSON.parse(row.data));
    res.json(patients);
  } catch (error) {
    console.error('Failed to get patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

app.get('/api/patients/:id', (req, res) => {
  try {
    const row: any = getPatientStmt.get(req.params.id);
    if (row) {
      res.json(JSON.parse(row.data));
    } else {
      res.status(404).json({ error: 'Patient not found' });
    }
  } catch (error) {
    console.error(`Failed to get patient ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

app.post('/api/patients', (req, res) => {
  try {
    const record = req.body;
    if (!record || !record.id) {
      return res.status(400).json({ error: 'Invalid record or missing id' });
    }

    insertPatientStmt.run({
      id: record.id,
      data: JSON.stringify(record),
      updatedAt: record.updatedAt || new Date().toISOString()
    });

    res.status(201).json({ success: true, id: record.id });
  } catch (error) {
    console.error('Failed to save patient:', error);
    res.status(500).json({ error: 'Failed to save patient' });
  }
});

const deletePatientStmt = db.prepare('DELETE FROM patients WHERE id = ?');
app.delete('/api/patients/:id', (req, res) => {
  try {
    deletePatientStmt.run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(`Failed to delete patient ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete patient' });
  }
});

app.listen(PORT, () => {
  console.log(`Minimal Backend Server running on http://localhost:${PORT}`);
  console.log(`Data stored at ${path.join(dbDir, 'database.sqlite')}`);
});
