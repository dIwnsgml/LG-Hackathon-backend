const express = require("express");
const Router = express.Router();
const { autoSignin } = require("./auth");
const pool = require("../model/pool");
const RESPONSE_MESSAGES = require("../utils/responses");
const {
  validateString,
  validateLength,
  validateStrictString,
  validateBoolean,
} = require("../utils/validate");
const { generateRandomId } = require("../utils/tools");
const { mainIo } = require("../sockets/io");

Router.get("/", async (req, res) => {
  try {
    const connection = pool.promise();
    const [announcements] = await connection.query(
      `
        SELECT 
          a.name,
          a.created_at,
          a.views,
          a.announcement_id,
          u.user_id AS author_user_id,
          u.name AS author_name,
          GROUP_CONCAT(DISTINCT al.user_id) AS likes
        FROM announcements a
        LEFT JOIN users u ON u.user_id = a.user_id
        LEFT JOIN announcement_likes al ON al.announcement_id = a.announcement_id
        GROUP BY a.announcement_id, a.name, a.created_at, a.views, u.user_id, u.name
        ORDER BY a.created_at DESC
      `
    );
    announcements.map((announcement) => {
      announcement.likes = announcement.likes
        ? announcement.likes.split(",")
        : [];

      const author = {
        name: announcement.author_name,
        user_id: announcement.author_user_id,
      };
      announcement.author = author;
    });

    res.status(200).send({
      success: true,
      status: 200,
      data: {
        announcements,
      },
    });
  } catch (err) {
    console.log(err);
    const response = RESPONSE_MESSAGES.error();
    return res.status(response.status).send(response);
  }
});

Router.get("/:id", async (req, res) => {
  try {
    const announcementId = req.params.id;

    const isValidAnnouncementId = validateStrictString(
      announcementId,
      "announcement id",
      10,
      10
    );
    if (!isValidAnnouncementId.isValid) {
      const response = RESPONSE_MESSAGES.noAnnouncement();
      return res.status(response.status).send(response);
    }

    const connection = pool.promise();
    const [[announcement]] = await connection.query(
      `
        SELECT 
          a.announcement_id,
          a.name,
          a.created_at,
          a.views,
          a.contents,
          u.user_id AS author_user_id,
          u.name AS author_name,
          GROUP_CONCAT(DISTINCT al.user_id) AS likes
        FROM announcements a
        LEFT JOIN users u ON u.user_id = a.user_id
        LEFT JOIN announcement_likes al ON al.announcement_id = a.announcement_id
        WHERE a.announcement_id = ?
        GROUP BY a.announcement_id, a.name, a.created_at, a.views, a.contents, u.user_id, u.name
      `,
      [announcementId]
    );
    if (!announcement) {
      const response = RESPONSE_MESSAGES.noAnnouncement();
      return res.status(response.status).send(response);
    }

    announcement.likes = announcement.likes
      ? announcement.likes.split(",")
      : [];

    const author = {
      name: announcement.author_name,
      user_id: announcement.author_user_id,
    };
    announcement.author = author;

    setTimeout(() => {
      mainIo.emit("announcement:viewed", {
        announcement_id: announcementId,
      });
    }, 1000);

    await connection.query(
      `UPDATE announcements SET views = views + 1 WHERE announcement_id = ?`,
      [announcementId]
    );

    res.status(200).send({
      success: true,
      status: 200,
      data: {
        announcement,
      },
    });
  } catch (err) {
    console.log(err);
    const response = RESPONSE_MESSAGES.error();
    return res.status(response.status).send(response);
  }
});

Router.put("/", async (req, res) => {
  autoSignin(req, res, async (userId) => {
    try {
      const { name, contents } = req.body;

      const isValidName = validateString(name, "제목", 40);
      if (!isValidName.isValid) {
        return res.status(400).send({
          success: false,
          status: 400,
          message: isValidName.reason,
          error: { reason: isValidName.reason },
        });
      }

      console.log(contents.length);

      const isValidContents = validateLength(contents, "내용", 100000);
      if (!isValidContents.isValid) {
        return res.status(400).send({
          success: false,
          status: 400,
          message: isValidContents.reason,
          error: { reason: isValidContents.reason },
        });
      }

      const connection = pool.promise();
      const [[userInfo]] = await connection.query(
        `SELECT is_admin FROM users WHERE user_id = ?`,
        [userId]
      );

      if (!userInfo) {
        const response = RESPONSE_MESSAGES.noUser();
        return res.status(response.status).send(response);
      }

      if (!userInfo.is_admin) {
        const response = RESPONSE_MESSAGES.forbidden();
        return res.status(response.status).send(response);
      }

      const announcement_id = generateRandomId(10);
      const created_at = Math.floor(Date.now() / 1000);

      const newAnnouncement = {
        name,
        contents,
        announcement_id,
        user_id: userId,
        created_at,
      };

      await connection.query(`INSERT INTO announcements SET ?`, [
        newAnnouncement,
      ]);

      res.status(200).send({
        success: true,
        status: 200,
        message: `Announcement published!`,
        data: {
          announcement: newAnnouncement,
        },
      });
    } catch (err) {
      console.log(err);
      const response = RESPONSE_MESSAGES.error();
      return res.status(response.status).send(response);
    }
  });
});

Router.post("/like", async (req, res) => {
  autoSignin(req, res, async (userId) => {
    try {
      const { announcement_id, like } = req.body;

      const isValidAnnouncementId = validateStrictString(
        announcement_id,
        "announcement id",
        10,
        10
      );
      if (!isValidAnnouncementId.isValid) {
        const response = RESPONSE_MESSAGES.noAnnouncement();
        return res.status(response.status).send(response);
      }

      const isValidlike = validateBoolean(like, "like", true);

      if (!isValidlike.isValid) {
        return res.status(400).send({
          success: false,
          status: 400,
          message: isValidlike.reason,
          error: { reason: isValidlike.reason },
        });
      }

      const connection = pool.promise();

      await connection.query(
        `DELETE FROM announcement_likes WHERE user_id = ? AND announcement_id = ?`,
        [userId, announcement_id]
      );
      if (like) {
        const newLike = {
          user_id: userId,
          announcement_id,
        };

        await connection.query(`INSERT INTO announcement_likes SET ?`, newLike);

        mainIo.emit(`announcement:liked`, { announcement_id, user_id: userId });
      } else {
        mainIo.emit(`announcement:unliked`, {
          announcement_id,
          user_id: userId,
        });
      }

      console.log(like);

      res.status(200).send({
        success: true,
        status: 200,
      });
    } catch (err) {
      console.log(err);
      const response = RESPONSE_MESSAGES.error();
      return res.status(response.status).send(response);
    }
  });
});

module.exports = Router;
