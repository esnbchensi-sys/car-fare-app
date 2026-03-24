const express = require('express');
const cors = require('cors');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const adapter = new FileSync(path.resolve(__dirname, 'db.json'));
const db = low(adapter);

// 初始化資料庫 (確保結構完整)
try {
    const existing = db.getState();
    if (!existing.licenses) db.set('licenses', []).write();
    if (!existing.activations) db.set('activations', []).write();
} catch (e) {
    console.error('初始化資料庫出錯:', e);
}

// 封裝一個安全寫入的方法，解決 Vercel 唯讀檔案系統問題
const safeWrite = () => {
    try {
        db.write();
        console.log('資料庫已寫入。');
    } catch (e) {
        // Vercel 唯讀是正常的，資料會暫留在記憶體中直到 Function 重啟
    }
};

const app = express();
// 調整 CORS 以確保 PWA 能正確存取
app.use(cors({
    origin: '*', // 允許所有來源
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// --- API Endpoints ---

// 健康檢查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '1.1.0' });
});

// 啟用授權 (支援多裝置)
app.post('/activate', (req, res) => {
    const { licenseKey, deviceId } = req.body;
    console.log(`收到啟用請求: Key=${licenseKey}, ID=${deviceId}`);

    if (!licenseKey || !deviceId) {
        return res.status(400).json({ success: false, message: '缺少授權碼或裝置 ID。' });
    }

    // 1. 檢查授權碼是否存在
    const license = db.get('licenses').find({ key: licenseKey }).value();
    if (!license) {
        return res.status(404).json({ success: false, message: '無效的授權碼，請重新檢查。' });
    }

    // 2. 檢查此裝置是否已經啟用過此授權碼
    const existingForThisDevice = db.get('activations').find({ key: licenseKey, deviceId: deviceId }).value();
    if (existingForThisDevice) {
        console.log('同一裝置重複啟用，允許。');
        return res.json({ success: true, message: '裝置已啟用。' });
    }

    // 3. 檢查授權碼使用次數是否已達上限
    const currentUses = db.get('activations').filter({ key: licenseKey }).size().value();
    const maxUses = license.maxUses || 1; // 預設為 1 次

    if (currentUses >= maxUses) {
        console.warn(`授權碼 ${licenseKey} 已達使用上限 (${maxUses})`);
        return res.status(403).json({ success: false, message: `此授權碼已達最大啟用裝置數 (${maxUses})。` });
    }

    // 4. 綁定授權碼與裝置
    db.get('activations').push({ 
        key: licenseKey, 
        deviceId: deviceId, 
        activatedAt: new Date().toISOString() 
    }).write();
    safeWrite();
    
    console.log(`啟用成功！目前使用數: ${currentUses + 1}/${maxUses}`);
    res.json({ success: true, message: '程式啟用成功！' });
});

// 驗證裝置 (只需確認 deviceId 是否有任何有效的啟用紀錄)
app.post('/verify', (req, res) => {
    const { deviceId } = req.body;
    console.log(`收到驗證請求: ID=${deviceId}`);

    if (!deviceId) {
        return res.status(400).json({ success: false, message: '缺少裝置 ID。' });
    }

    const activation = db.get('activations').find({ deviceId: deviceId }).value();

    if (activation) {
        console.log('驗證通過。');
        res.json({ success: true, isActivated: true });
    } else {
        console.log('未啟用。');
        res.json({ success: true, isActivated: false });
    }
});

// --- 管理 API ---
// 新增或更新授權碼
app.post('/admin/set-license', (req, res) => {
    const { key, maxUses } = req.body;
    if (!key || !maxUses) {
        return res.status(400).json({ message: '缺少 key 或 maxUses' });
    }
    
    const existing = db.get('licenses').find({ key: key }).value();
    if (existing) {
        db.get('licenses').find({ key: key }).assign({ maxUses: parseInt(maxUses) }).write();
    } else {
        db.get('licenses').push({ 
            key: key, 
            maxUses: parseInt(maxUses), 
            createdAt: new Date().toISOString() 
        }).write();
    }
    
    safeWrite();
    res.json({ message: `授權碼 ${key} 設定完成，最大裝置數: ${maxUses}` });
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`授權伺服器正在監聽 port ${PORT}`);
    });
}

module.exports = app;
