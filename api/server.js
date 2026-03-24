const express = require('express');
const cors = require('cors');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const adapter = new FileSync(path.join(__dirname, 'db.json'));
const db = low(adapter);

// 初始化資料庫
try {
    db.defaults({ licenses: [], activations: [] }).write();
} catch (e) {
    console.log('無法初始化資料庫檔案，這在 Vercel 是正常的。');
}

// 封裝一個安全寫入的方法，解決 Vercel 唯讀檔案系統問題
const safeWrite = () => {
    try {
        db.write();
    } catch (e) {
        // console.warn('警告: 無法寫入檔案 (可能是 Vercel 唯讀環境)，資料將僅保留在記憶體中。');
    }
};

const app = express();
app.use(cors());
app.use(express.json());

// --- API Endpoints ---

// 啟用授權
app.post('/activate', (req, res) => {
    const { licenseKey, deviceId } = req.body;

    if (!licenseKey || !deviceId) {
        return res.status(400).json({ success: false, message: '缺少授權碼或裝置 ID。' });
    }

    // 1. 檢查授權碼是否存在
    const license = db.get('licenses').find({ key: licenseKey }).value();
    if (!license) {
        return res.status(404).json({ success: false, message: '無效的授權碼。' });
    }

    // 2. 檢查授權碼是否已被使用
    const existingActivation = db.get('activations').find({ key: licenseKey }).value();
    if (existingActivation) {
        // 如果是被同一台裝置重複啟用，則通過
        if (existingActivation.deviceId === deviceId) {
            return res.json({ success: true, message: '裝置已啟用。' });
        }
        return res.status(403).json({ success: false, message: '此授權碼已被另一台裝置使用。' });
    }

    // 3. 綁定授權碼與裝置
    db.get('activations').push({ key: licenseKey, deviceId: deviceId, activatedAt: new Date().toISOString() }).value();
    safeWrite();
    
    res.json({ success: true, message: '程式啟用成功！' });
});

// 驗證裝置
app.post('/verify', (req, res) => {
    const { deviceId } = req.body;

    if (!deviceId) {
        return res.status(400).json({ success: false, message: '缺少裝置 ID。' });
    }

    const activation = db.get('activations').find({ deviceId: deviceId }).value();

    if (activation) {
        res.json({ success: true, isActivated: true });
    } else {
        res.json({ success: true, isActivated: false });
    }
});

// --- 管理 API (可選) ---
// 新增一個授權碼 (未來您可以建立一個管理後台來呼叫它)
app.post('/admin/add-license', (req, res) => {
    const { newKey } = req.body;
    if (!newKey) {
        return res.status(400).json({ message: '缺少 newKey' });
    }
    db.get('licenses').push({ key: newKey, createdAt: new Date().toISOString() }).value();
    safeWrite();
    res.status(201).json({ message: `授權碼 ${newKey} 已新增。` });
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`授權伺服器正在監聽 port ${PORT}`);
    });
}

module.exports = app;
