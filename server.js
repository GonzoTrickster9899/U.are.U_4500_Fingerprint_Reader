const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2/promise');
// You'll need to find or create a library to interact with the U.are.U 4500 Fingerprint Reader
const fingerprintReader = require('uareu-4500-reader');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'fingerprint_db'
};

let db;

async function initDatabase() {
    db = await mysql.createConnection(dbConfig);
    await db.execute(`
        CREATE TABLE IF NOT EXISTS fingerprints (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            fingerprint_data BLOB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

io.on('connection', (socket) => {
    socket.on('startRegistration', async () => {
        try {
            const fingerprintData = await fingerprintReader.capture();
            await db.execute('INSERT INTO fingerprints (user_id, fingerprint_data) VALUES (?, ?)', [1, fingerprintData]);
            socket.emit('registrationComplete', { image: fingerprintData.toString('base64') });
        } catch (error) {
            socket.emit('error', error.message);
        }
    });

    socket.on('startVerification', async () => {
        try {
            const capturedFingerprint = await fingerprintReader.capture();
            const [rows] = await db.execute('SELECT fingerprint_data FROM fingerprints WHERE user_id = ?', [1]);
            
            if (rows.length > 0) {
                const storedFingerprint = rows[0].fingerprint_data;
                const match = fingerprintReader.compare(capturedFingerprint, storedFingerprint);
                socket.emit('verificationResult', { match, image: capturedFingerprint.toString('base64') });
            } else {
                socket.emit('error', 'No registered fingerprint found');
            }
        } catch (error) {
            socket.emit('error', error.message);
        }
    });
});

initDatabase().then(() => {
    server.listen(3000, () => {
        console.log('Server is running on http://localhost:3000');
    });
}).catch(console.error);