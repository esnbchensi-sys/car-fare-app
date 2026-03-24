const express = require('express');
const cors = require('cors');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({ licenses: [], activations: [] }).write();
const app = express();
app.use(cors());
app.use(express.json());
app.post('/activate', (req, res) => {
    const { licenseKey, deviceId } = req.body;
    const license = db.get('licenses').find({ key: licenseKey }).value();
    if (!license) return res.status(404).json({ success: false, message: '無效的授權碼。' });
    const existingActivation = db.get('activations').find({ key: licenseKey }).value();
    if (existingActivation) {
        if (existingActivation.deviceId === deviceId) return res.json({ success: true, message: '裝置已啟用。' });
        return res.status(403).json({ success: false, message: '此授權碼已被另一台裝置使用。' });
    }
    db.get('activations').push({ key: licenseKey, deviceId: deviceId, activatedAt: new Date().toISOString() }).write();
    res.json({ success: true, message: '程式啟用成功！' });
});
app.post('/verify', (req, res) => {
    const { deviceId } = req.body;
    const activation = db.get('activations').find({ deviceId: deviceId }).value();
    res.json({ success: true, isActivated: !!activation });
});
module.exports = app;
