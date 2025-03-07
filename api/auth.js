const express = require("express");
const Router = express.Router();
const { DateTime } = require("luxon");
const {
  validateEmail,
  validateStrictString,
  validatePassword,
} = require("../utils/validate");
const { generateRandomId, hashing } = require("../utils/tools");
const RESPONSE_MESSAGES = require("../utils/responses");
const crypto = require("node:crypto");
const pool = require("../model/pool");
const { USER_ID_COOKIE_OPTIONS } = require("../utils/constatns");

async function autoSignin(
  req,
  res,
  success = () => {},
  fail = () => {
    const response = RESPONSE_MESSAGES.noSession(null);
    return res.status(response.status).send(response);
  }
) {
  try {
    if (process.env.NODE_ENV === "development") {
      req.session.user_id = process.env.TESTER_ID;
      return success(process.env.TESTER_ID);
    }

    if (req.session.user_id) {
      return success(req.session.user_id);
    }

    if (req.signedCookies.userId) {
      req.session.user_id = req.signedCookies.userId;
      return success(req.signedCookies.userId);
    }

    const authHeader = req.headers.authorization;
    const userId = req.headers["user-id"];
    const deviceId = req.headers["device-id"];

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ") ||
      !userId ||
      !deviceId
    ) {
      return fail();
    }

    const token = authHeader.split(" ")[1];
    if (!token) return fail();

    const savedToken = await getDeviceToken(userId, deviceId);
    if (savedToken !== token) return fail(); // Token mismatch

    success(userId);
  } catch (err) {
    console.log(err);
    return fail();
  }
}

async function createAccount({ name, email, userInfo }) {
  try {
    const created_at = DateTime.now().set({ millisecond: 0 }).toSeconds();
    // Sanitize inputs
    //check email
    const isValidEmail = validateEmail(email);
    if (!isValidEmail.isValid) {
      return {
        success: false,
        status: 400,
        message: isValidEmail.reason,
        error: { reason: isValidEmail.reason },
      };
    }

    const user_id = generateRandomId(10);

    const isValidName = validateStrictString(name, "Name", 25, 1);
    if (!isValidName.isValid) {
      return {
        success: false,
        status: 400,
        message: isValidName.reason,
        error: { reason: isValidName.reason },
      };
    }
    const connection = pool.promise();

    const [[checkEmail]] = await connection.query(
      "SELECT email FROM users WHERE email = ?",
      email
    );

    if (checkEmail) {
      return {
        success: false,
        status: 400,
        message: "Email already in use",
        error: { reason: "Email already in use" },
      };
    }

    const user = {
      name,
      email,
      user_id,
      created_at,
      ...userInfo,
    };

    await connection.query("INSERT INTO users SET ?", user);

    return {
      success: true,
      status: 200,
      message: "Account Created!",
      data: { user_id },
    };
  } catch (err) {
    console.log(err);
  }
}

Router.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    const isValidEmail = validateEmail(email);
    if (!isValidEmail.isValid) {
      return res.status(400).send({
        success: false,
        status: 400,
        message: isValidEmail.reason,
        error: { reason: isValidEmail.reason },
      });
    }

    const connection = pool.promise();

    const [[userInfo]] = await connection.query(
      "SELECT user_id, salt, hashed_password, email, name, hashed_password FROM users WHERE email = ?",
      email
    );

    if (!userInfo) {
      const response = RESPONSE_MESSAGES.noUser();
      return res.status(response.status).send(response);
    }

    const hashedPassword = crypto
      .pbkdf2Sync(password, userInfo.salt, 99097, 32, "sha512")
      .toString("hex");

    if (hashedPassword !== userInfo.hashed_password) {
      const response = RESPONSE_MESSAGES.wrongPassword();
      return res.status(response.status).send(response);
    }

    // Generate a new session ID
    req.session.regenerate((err) => {
      if (err) {
        console.log("Error regenerating session ID:", err);
        const response = RESPONSE_MESSAGES.error();
        return res.status(response.status).send(response);
      }

      req.session.user_id = userInfo.user_id;

      res.cookie("userId", userInfo.user_id, USER_ID_COOKIE_OPTIONS);

      res.status(200).send({ success: true, status: 200, message: "Success!" });
    });
  } catch (err) {
    console.log(err);
    const response = RESPONSE_MESSAGES.error();
    return res.status(response.status).send(response);
  }
});

Router.post("/signup", async (req, res) => {
  try {
    const { email, name, password } = req.body;

    const isValidPassword = validatePassword(password, 30);

    if (!isValidPassword.isValid) {
      return res.status(400).send({
        success: false,
        status: 400,
        message: isValidPassword.reason,
        error: { reason: isValidPassword.reason },
      });
    }

    const [salt, hashed_password] = hashing(password);

    const response = await createAccount({
      name,
      email,
      userInfo: {
        salt,
        hashed_password,
      },
    });

    const { success, data } = response;

    if (!success) {
      return res.status(400).send(response);
    }

    const { user_id } = data;

    req.session.regenerate((err) => {
      if (err) {
        console.log("Error regenerating session ID:", err);
        const response = RESPONSE_MESSAGES.error();
        return res.status(response.status).send(response);
      }
      req.session.user_id = user_id;
    });

    res.cookie("userId", user_id, USER_ID_COOKIE_OPTIONS);

    res.status(200).send({
      success: true,
      status: 200,
      message: "Account Created!",
    });
  } catch (err) {
    console.log(err);
    const response = RESPONSE_MESSAGES.error();
    return res.status(response.status).send(response);
  }
});

Router.get("/logout", function (req, res) {
  try {
    console.log("logout");
    req.session.destroy((err) => {
      if (err) {
        console.log("Error destroying session:", err);
      }
      res.clearCookie("userId");
      res.status(200).send({ success: true, status: 200 });
    });
  } catch (err) {
    console.log(err);
    const response = RESPONSE_MESSAGES.error();
    return res.status(response.status).send(response);
  }
});

module.exports = {
  autoSignin,
  Router,
};
