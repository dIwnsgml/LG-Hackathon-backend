const crypto = require("node:crypto");

function generateRandomId(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }

  return result;
}

function hashing(password) {
  let salt = crypto.randomBytes(32).toString("hex");
  return [
    salt,
    crypto.pbkdf2Sync(password, salt, 99097, 32, "sha512").toString("hex"),
  ];
}

module.exports = {
  generateRandomId,
  hashing,
};
