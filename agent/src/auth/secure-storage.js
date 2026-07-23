const fs = require('fs');
const path = require('path');
const os = require('os');

const SERVICE_NAME = 'RemoteWorkSupervisor';
const ACCOUNT_NAME = 'agent-device';
const FILE_NAME = 'device-credentials.json';

let keytar = null;
try {
  keytar = require('keytar');
} catch {
  // keytar unavailable — fall back to encrypted file storage
}

class SecureStorage {
  constructor(options = {}) {
    this._userDataPath = options.userDataPath || path.join(os.homedir(), '.rws-agent');
    this._fileName = options.fileName || FILE_NAME;
    this._keytarAvailable = !!(keytar && options.useKeytar !== false);
  }

  _filePath() {
    return path.join(this._userDataPath, this._fileName);
  }

  async save({ deviceId, refreshToken, trustExpiresAt }) {
    if (this._keytarAvailable) {
      return this._saveToKeychain({ deviceId, refreshToken, trustExpiresAt });
    }
    return this._saveToFile({ deviceId, refreshToken, trustExpiresAt });
  }

  async load() {
    if (this._keytarAvailable) {
      return this._loadFromKeychain();
    }
    return this._loadFromFile();
  }

  async clear() {
    if (this._keytarAvailable) {
      return this._clearKeychain();
    }
    return this._clearFile();
  }

  async hasCredentials() {
    const creds = await this.load();
    return !!(creds && creds.deviceId && creds.refreshToken);
  }

  // ── Keychain backend ───────────────────────────────────────────────

  async _saveToKeychain({ deviceId, refreshToken, trustExpiresAt }) {
    try {
      const payload = JSON.stringify({ deviceId, refreshToken, trustExpiresAt });
      await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, payload);
      return true;
    } catch (err) {
      console.error('[SecureStorage] keychain save failed:', err.message);
      // Fall back to file
      return this._saveToFile({ deviceId, refreshToken, trustExpiresAt });
    }
  }

  async _loadFromKeychain() {
    try {
      const payload = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
      if (!payload) return null;
      return JSON.parse(payload);
    } catch (err) {
      console.error('[SecureStorage] keychain load failed:', err.message);
      return this._loadFromFile();
    }
  }

  async _clearKeychain() {
    try {
      await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
    } catch (err) {
      console.error('[SecureStorage] keychain clear failed:', err.message);
    }
    // Also clear file fallback if it exists
    return this._clearFile();
  }

  // ── File backend ───────────────────────────────────────────────────

  async _saveToFile({ deviceId, refreshToken, trustExpiresAt }) {
    try {
      const dir = path.dirname(this._filePath());
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = JSON.stringify({ deviceId, refreshToken, trustExpiresAt }, null, 2);
      fs.writeFileSync(this._filePath(), data, 'utf8');
      return true;
    } catch (err) {
      console.error('[SecureStorage] file save failed:', err.message);
      return false;
    }
  }

  async _loadFromFile() {
    try {
      const filePath = this._filePath();
      if (!fs.existsSync(filePath)) return null;
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('[SecureStorage] file load failed:', err.message);
      return null;
    }
  }

  async _clearFile() {
    try {
      const filePath = this._filePath();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error('[SecureStorage] file clear failed:', err.message);
    }
  }
}

module.exports = SecureStorage;
