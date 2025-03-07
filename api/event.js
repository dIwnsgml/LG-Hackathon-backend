const express = require("express");
const Router = express.Router();

Router.get("/", async (req, res) => {
  autoSignin(req, res, async (userId) => {
    try {
      const connection = pool.promise();
      const [[[userInfo]], groups, friends] = await Promise.all([
        connection.query(
          `SELECT user_id, name, email, timezone, verified FROM users WHERE user_id = ?`,
          [userId]
        ),
        userGroupsCache(connection, userId),
        userFriendsCache(connection, userId),
      ]);
      if (!userInfo) {
        const response = RESPONSE_MESSAGES.noUser();
        return res.status(response.status).send(response);
      }
      userInfo.groups = groups;
      userInfo.friends = friends;
      res.status(200).send({
        success: true,
        status: 200,
        data: {
          userInfo,
        },
      });
      addActiveUserCache(userId);
    } catch (err) {
      console.log(err);
      const response = RESPONSE_MESSAGES.error();
      return res.status(response.status).send(response);
    }
  });
});