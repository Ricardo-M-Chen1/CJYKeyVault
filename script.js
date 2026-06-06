

// ==================== 加密工具 ====================
function xorEncryptDecrypt(text, key) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        result += String.fromCharCode(charCode);
    }
    return result;
}
async function aesEncrypt(text, key) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(key.padEnd(32, '0').slice(0, 32)),
        'AES-GCM',
        false,
        ['encrypt']
    );
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        keyMaterial,
        data
    );
    return btoa(String.fromCharCode(...iv, ...new Uint8Array(encrypted)));
}

async function aesDecrypt(ciphertext, key) {
    const decoder = new TextDecoder();
    const data = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const iv = data.slice(0, 12);
    const encrypted = data.slice(12);
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(key.padEnd(32, '0').slice(0, 32)),
        'AES-GCM',
        false,
        ['decrypt']
    );
    const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        keyMaterial,
        encrypted
    );
    return decoder.decode(decrypted);
}

async function encrypt(text, type, key) {
    if (type === 'xor') return xorEncryptDecrypt(text, key);
    
    if (type === 'aes') return await aesEncrypt(text, key);
    return text;
}

async function decrypt(text, type, key) {
    if (type === 'xor') return xorEncryptDecrypt(text, key);
    if (type === 'aes') return await aesDecrypt(text, key);
    return text;
}
// ==================== 全局状态管理 ====================
let passwords = JSON.parse(localStorage.getItem('passwords') || '[]');
let accessToken = localStorage.getItem('baiduAccessToken') || '';
// ==================== 密码管理核心功能 ====================
function renderPasswordList() {
    const container = document.getElementById('passwordListContainer');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    const filteredPasswords = passwords.filter(item => 
        item.siteName.toLowerCase().includes(searchTerm) ||
        item.username.toLowerCase().includes(searchTerm)
    );
    if (filteredPasswords.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">暂无密码记录</p >';
        return;
    }

    container.innerHTML = filteredPasswords.map(item => `
        <div class="password-item">
            <div class="item-info">
                <div class="item-title">${item.siteName}</div>
                <div class="item-username">${item.username}</div>
            </div>
            <div class="item-actions">
                <button class="btn-icon" onclick="togglePassword('${item.id}')" title="显示/隐藏">👁️</button>
                <button class="btn-icon" onclick="copyToClipboard('${item.id}')" title="复制">📋</button>
                <button class="btn-icon" onclick="openEditModal('${item.id}')" title="编辑">✏️</button>
                <button class="btn-icon" onclick="deletePassword('${item.id}')" title="删除">🗑️</button>
            </div>
        </div>
    `).join('');
}

function generatePassword() {
    const length = parseInt(document.getElementById('passwordLength').value);
    const includeUppercase = document.getElementById('includeUppercase').checked;
    const includeLowercase = document.getElementById('includeLowercase').checked;
    const includeNumbers = document.getElementById('includeNumbers').checked;
    const includeSymbols = document.getElementById('includeSymbols').checked;

    let charset = '';
    if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (includeNumbers) charset += '0123456789';
    if (includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (charset === '') {
        alert('请至少选择一个字符类型');
        return;
    }

    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    document.getElementById('generatedPassword').value = password;
}

async function togglePassword(id) {
    const key = document.getElementById('encryptKey').value;
    if (!key) {
        alert('请先输入加密密钥！');
        return;
    }
    const item = passwords.find(p => p.id === id);
    if (!item) return;

    try {
        const decryptedPwd = await decrypt(item.password, item.encryptType || 'xor', key);
        alert("账号：" + item.username + "\n密码：" + decryptedPwd);
    } catch (e) {
        alert("密钥错误或解密失败！");
    }
}

async function copyToClipboard(id) {
    const key = document.getElementById('encryptKey').value;
    if (!key) {
        alert('请先输入加密密钥！');
        return;
    }
    const item = passwords.find(p => p.id === id);
    if (!item) return;

    try {
        const decryptedPwd = await decrypt(item.password, item.encryptType || 'xor', key);
        navigator.clipboard.writeText(decryptedPwd).then(() => {
            alert('密码已复制到剪贴板');
        }).catch(err => {
            console.error('复制失败:', err);
        });
    } catch (e) {
        alert("密钥错误或解密失败！");
    }
}
function openAddModal() {
    document.getElementById('modalTitle').textContent = '添加密码';
    document.getElementById('editId').value = '';
    document.getElementById('siteName').value = '';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('notes').value = '';
    document.getElementById('passwordModal').style.display = 'flex';
}
function openEditModal(id) {
    const item = passwords.find(p => p.id === id);
    if (!item) return;

    document.getElementById('modalTitle').textContent = '编辑密码';
    document.getElementById('editId').value = item.id;
    document.getElementById('siteName').value = item.siteName;
    document.getElementById('username').value = item.username;
    document.getElementById('password').value = ''; // 不显示旧密码，更安全
    document.getElementById('notes').value = item.notes || '';
    document.getElementById('passwordModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('passwordModal').style.display = 'none';
}

async function savePassword(e) {
    e.preventDefault();
    const key = document.getElementById('encryptKey').value;
    if (!key) {
        alert('请先输入加密密钥！');
        return;
    }
    const type = document.getElementById('encryptType').value;
    const id = document.getElementById('editId').value;
    const rawPwd = document.getElementById('password').value;
    const encryptedPwd = await encrypt(rawPwd, type, key);

    const passwordData = {
        id: id || Date.now().toString(),
        siteName: document.getElementById('siteName').value,
        username: document.getElementById('username').value,
        password: encryptedPwd,
        notes: document.getElementById('notes').value,
        encryptType: type,
        updatedAt: new Date().toISOString()
    };

    if (id) {
        const index = passwords.findIndex(p => p.id === id);
        passwords[index] = passwordData;
    } else {
        passwords.push(passwordData);
    }

    localStorage.setItem('passwords', JSON.stringify(passwords));
    renderPasswordList();
    closeModal();
}

function deletePassword(id) {
    if (confirm('确定要删除这条密码记录吗？')) {
        passwords = passwords.filter(p => p.id !== id);
        localStorage.setItem('passwords', JSON.stringify(passwords));
        renderPasswordList();
    }
}

// ==================== 百度网盘同步功能 ====================
async function getBaiduAuthUrl() {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: BAIDU_CONFIG.CLIENT_ID,
        redirect_uri: BAIDU_CONFIG.REDIRECT_URI,
        scope: 'basic,netdisk',
        display: 'page'
    });
    return `${BAIDU_CONFIG.AUTH_URL}?${params.toString()}`;
}

async function getAccessToken(code) {
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: BAIDU_CONFIG.CLIENT_ID,
        client_secret: BAIDU_CONFIG.CLIENT_SECRET,
        redirect_uri: BAIDU_CONFIG.REDIRECT_URI,
        code: code
    });

    try {
        const response = await fetch(BAIDU_CONFIG.TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        const data = await response.json();
        
        if (data.access_token) {
            accessToken = data.access_token;
            localStorage.setItem('baiduAccessToken', accessToken);
            updateSyncStatus(true);
            return true;
        }
        return false;
    } catch (error) {
        console.error('获取AccessToken失败:', error);
        return false;
    }
}

async function syncWithBaidu() {
    if (!accessToken) {
        const authUrl = await getBaiduAuthUrl();
        window.open(authUrl, '_blank');
        const code = prompt('请输入授权后返回的code:');
        if (code) {
            await getAccessToken(code);
        }
        return;
    }

    try {
        const encryptedData = btoa(JSON.stringify(passwords));
        
        const uploadParams = new URLSearchParams({
            method: 'upload',
            access_token: accessToken,
            path: BAIDU_CONFIG.FILE_PATH,
            ondup: 'overwrite'
        });

        const uploadResponse = await fetch(
            `${BAIDU_CONFIG.API_BASE_URL}/pan/file?${uploadParams.toString()}`,
            {
                method: 'POST',
                body: new Blob([encryptedData], { type: 'application/json' })
            }
        );

        const result = await uploadResponse.json();
        if (result.errno === 0) {
            alert('同步成功！');
            updateSyncStatus(true);
        } else {
            alert('同步失败: ' + result.errmsg);
        }
    } catch (error) {
        console.error('同步失败:', error);
        alert('同步失败，请检查网络和权限设置');
    }
}

async function syncFromBaidu() {
    if (!accessToken) {
        alert('请先完成百度网盘授权');
        return;
    }

    try {
        const downloadParams = new URLSearchParams({
            method: 'download',
            access_token: accessToken,
            path: BAIDU_CONFIG.FILE_PATH
        });

        const downloadResponse = await fetch(
            `${BAIDU_CONFIG.API_BASE_URL}/pan/file?${downloadParams.toString()}`
        );
        
        if (downloadResponse.ok) {
            const encryptedData = await downloadResponse.text();
            const decryptedData = atob(encryptedData);
            passwords = JSON.parse(decryptedData);
            localStorage.setItem('passwords', JSON.stringify(passwords));
            renderPasswordList();
            alert('恢复成功！');
        } else {
            alert('恢复失败，未找到密码库文件');
        }
    } catch (error) {
        console.error('恢复失败:', error);
        alert('恢复失败，请检查网络和文件路径');
    }
}

function updateSyncStatus(isOnline) {
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    
    if (isOnline) {
        indicator.classList.add('online');
        text.textContent = '已同步';
    } else {
        indicator.classList.remove('online');
        text.textContent = '未同步';
    }
}

// ==================== 初始化 ====================
document.getElementById('passwordForm').addEventListener('submit', savePassword);
document.getElementById('searchInput').addEventListener('input', renderPasswordList);
renderPasswordList();
updateSyncStatus(!!accessToken);

const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
if (code) {
    getAccessToken(code).then(success => {
        if (success) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    });
}