const readline = require("readline");
const dotenv = require("dotenv");

//this should be placed before require query because otherwise, .env won't be loaded
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: "../.env.production" });
} else if (process.env.NODE_ENV === "test") {
  dotenv.config({ path: "../.env.test" });
} else {
  dotenv.config({ path: "../.env.development" });
}

const {
  createUsersTable,
  createAnnouncementsTable,
  createAnnouncementLikesTable,
} = require("../utils/query");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Promisified question function
function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

// Async function to handle input with await
async function processCommands() {
  while (true) {
    const command = (
      await question(`
        Choose an option:
        1. Mariadb update
        2. 
      `)
    )
      .trim()
      .toLowerCase();

    if (command === "exit") {
      console.log("Goodbye!");
      rl.close();
      break;
    }

    // Example: Command needing an additional parameter
    if (command === "1") {
      const version = parseInt(await question("Enter version: "));
      if (version === 1) {
        mariaDBV1();
      }
    }
  }
}

// Run the async function
processCommands().catch(console.error);

async function mariaDBV1() {
  try {
    await createUsersTable();
    await createAnnouncementsTable();
    await createAnnouncementLikesTable();

    console.log("Initialized mariadb");
  } catch (err) {
    console.log(err);
  }
}
