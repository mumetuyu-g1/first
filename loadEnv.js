// loadEnv.js
// Fetches the .env file and parses KEY=VALUE pairs into window.env
// This must be loaded BEFORE firebase-config.js

(async function loadEnv() {
  window.env = {};
  try {
    const response = await fetch('.env');
    if (!response.ok) {
      console.warn('[loadEnv] .env file not found or could not be loaded. Firebase will use placeholder values.');
      return;
    }
    const text = await response.text();
    text.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) return;
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();
      window.env[key] = value;
    });
    console.log('[loadEnv] Environment variables loaded successfully.');
  } catch (err) {
    console.warn('[loadEnv] Could not load .env:', err);
  }
})();
