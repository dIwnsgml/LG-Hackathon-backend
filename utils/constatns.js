const USER_ID_COOKIE_OPTIONS = {
  maxAge: 1000 * 60 * 60 * 24 * 30,
  secure: true,
  httpOnly: true,
  signed: true,
  sameSite: "strict",
};

const REDIS_EXP = {
  USERINFO: 60 * 60,
};

module.exports = {
  USER_ID_COOKIE_OPTIONS,
  REDIS_EXP,
};
