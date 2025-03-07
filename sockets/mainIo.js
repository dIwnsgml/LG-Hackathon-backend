const { mainIo } = require("./io");

mainIo.on("connection", async(socket) => {
  try {
    let session;

    if (
      process.env.NODE_ENV === "production" ||
      process.env.NODE_ENV === "test"
    ) {
      session = socket.request.session;
    } else {
      session = {
        cookie: {
          path: "/",
          _expires: null,
          originalMaxAge: null,
          httpOnly: true,
          secure: false,
        },
        user_id: process.env.TESTER_ID,
      };
    }
    const userId = session.user_id;
    console.log("socket joined");

    if (!userId) return;

    try {
      //join my socket server
      socket.join(userId);
    } catch (err) {
      console.log(err);
    }

    
  } catch (err) {
    console.log(err);
  }
});
