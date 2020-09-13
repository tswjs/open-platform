const zlib = require('zlib');
const crypto = require('crypto');

const ALGORITHM_KEY_SIZE = 16;
const ALGORITHM_NONCE_SIZE = 12;
const PBKDF2_NAME = 'sha256';
const PBKDF2_SALT_SIZE = 16;
const PBKDF2_ITERATIONS = 1024;
const CHARSET_NAME = 'UTF-8';
const CURRENT_VERSION = 'v2:';
const ALGORITHM_NAME = 'aes-128-gcm';

function encrypt(plaintext, key) {
  const nonce = crypto.randomBytes(ALGORITHM_NONCE_SIZE);
  const cipher = crypto.createCipheriv(ALGORITHM_NAME, key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([nonce, ciphertext, cipher.getAuthTag()]);
}

const encode = (appid, appkey, data) => {
  const buff = zlib.deflateSync(Buffer.from(JSON.stringify(data), CHARSET_NAME));
  const password = appid + appkey;
  const salt = crypto.randomBytes(PBKDF2_SALT_SIZE);
  const key = crypto.pbkdf2Sync(Buffer.from(password, CHARSET_NAME), salt, PBKDF2_ITERATIONS, ALGORITHM_KEY_SIZE, PBKDF2_NAME);
  const ciphertextAndNonceAndSalt = Buffer.concat([salt, encrypt(buff, key)]);
  return CURRENT_VERSION + ciphertextAndNonceAndSalt.toString('base64');
};

module.exports = {
  encode
}