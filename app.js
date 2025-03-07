const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const cors = require("cors");
const dotenv = require("dotenv");
const morgan = require("morgan"); //for logger
const bodyParser = require("body-parser");
const helmet = require("helmet");
const crypto = require("node:crypto");
const cookieParser = require("cookie-parser");
const session = require("express-session");

if (process.env.NODE_ENV === "development") {
  dotenv.config({ path: ".env.development" });
} else if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: ".env.production" });
} else {
  dotenv.config({ path: ".env.test" });
}

//redis
const { RedisStore } = require("connect-redis");
const redisClient = require("./model/redis");
const redisStore = new RedisStore({
  client: redisClient,
  ttl: 60 * 60 * 24 * 3,
});

const sessionMiddleWare = session({
  store: redisStore,
  secret: process.env.SECRET_ID,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    signed: true,
    sameSite: "strict",
  },
});

module.exports = { server, sessionMiddleWare };

//API
const authAPI = require("./api/auth").Router;
const accountAPI = require("./api/account");
const announcementAPI = require("./api/announcement");

//middlewares

//cors
app.use(
  cors({
    origin: process.env.SERVER_CORS.split(", "),
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS", "HEAD"],
    credentials: true,
  })
);

//logger
process.env.LOGGER === "true" ? app.use(morgan("dev")) : null;

//helmet for cyber security
app.use(helmet.permittedCrossDomainPolicies());
app.use(helmet.referrerPolicy());
app.use(helmet.xssFilter());
app.use(helmet.hsts());
app.use(helmet.ieNoOpen());
app.use(helmet.noSniff());
//app.use(helmet.contentSecurityPolicy());
app.use(helmet.dnsPrefetchControl());
app.use(helmet.frameguard());
app.use(helmet.hidePoweredBy());
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("hex");
  res.setHeader("X-XSS-protection", "1; mode=block");
  //console.log(res.locals.cspNonce)
  next();
});
app.use(helmet.frameguard({ action: "SAMEORIGIN" }));
const cspOptions = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    frameSrc: ["'self'"],
  },
};
app.use(helmet.contentSecurityPolicy(cspOptions));

//body parser
app.use(bodyParser.json());

//cookie parser
app.use(cookieParser(process.env.SECRET_ID));

app.use(sessionMiddleWare);

//api
app.use("/auth", authAPI);
app.use("/account", accountAPI);
app.use("/announcement", announcementAPI);

server.listen(process.env.PORT, process.env.IP, () => {
  console.log(`Server running http://${process.env.IP}:${process.env.PORT}`);
});
