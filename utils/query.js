const pool = require("../model/pool");

//these async functions are only used for initializing the database (used only once)

async function createUsersTable() {
  const connection = pool.promise();
  await connection.query(`
  CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(10) NOT NULL PRIMARY KEY,
    name VARCHAR(40),
    email VARCHAR(60) DEFAULT '',
    created_at INT(10),
    is_admin SMALLINT DEFAULT 0,
    hashed_password VARCHAR(64), 
    salt VARCHAR(64)
  );
  `);
}

async function createAnnouncementsTable() {
  const connection = pool.promise();
  await connection.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      announcement_id VARCHAR(10) NOT NULL,
      user_id VARCHAR(10) NOT NULL,
      name VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      created_at INT(10),
      contents MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      views SMALLINT UNSIGNED DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(user_id),
      PRIMARY KEY (announcement_id)
    );  
    `);
}

async function createAnnouncementLikesTable() {
  const connection = pool.promise();
  await connection.query(`
    CREATE TABLE IF NOT EXISTS announcement_likes (
      announcement_id VARCHAR(10) NOT NULL,
      user_id VARCHAR(10) NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(user_id),
      FOREIGN KEY (announcement_id) REFERENCES announcements(announcement_id),
      UNIQUE KEY unique_announcement_like (announcement_id, user_id)
    );  
    `);
}

module.exports = {
  createUsersTable,
  createAnnouncementsTable,
  createAnnouncementLikesTable,
};
