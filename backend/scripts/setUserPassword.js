require("dotenv").config();

const readline = require("readline");
const bcrypt = require("bcryptjs");
const pool = require("../src/config/database");

const ask = (question) =>
  new Promise((resolve) => {
    const input = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    input.question(question, (answer) => {
      input.close();
      resolve(answer.trim());
    });
  });

const askPassword = (prompt) =>
  new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    if (
      !stdin.isTTY ||
      typeof stdin.setRawMode !== "function"
    ) {
      reject(
        new Error(
          "An interactive terminal is required"
        )
      );
      return;
    }

    let password = "";

    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", handleInput);
      stdout.write("\n");
    };

    const handleInput = (character) => {
      if (character === "\u0003") {
        cleanup();
        process.exit(130);
      }

      if (
        character === "\r" ||
        character === "\n"
      ) {
        cleanup();
        resolve(password);
        return;
      }

      if (
        character === "\u0008" ||
        character === "\u007f"
      ) {
        if (password.length > 0) {
          password = password.slice(0, -1);
          stdout.write("\b \b");
        }

        return;
      }

      if (character >= " ") {
        password += character;
        stdout.write("*");
      }
    };

    stdin.on("data", handleInput);
  });

const main = async () => {
  try {
    const username = await ask("Username: ");

    const userResult = await pool.query(
      `
      SELECT id, username
      FROM app.users
      WHERE username = $1
      `,
      [username]
    );

    if (userResult.rows.length === 0) {
      throw new Error("User not found");
    }

    const password = await askPassword(
      "New password: "
    );

    if (password.length < 8) {
      throw new Error(
        "Password must contain at least 8 characters"
      );
    }

    const confirmation = await askPassword(
      "Confirm password: "
    );

    if (password !== confirmation) {
      throw new Error(
        "Password confirmation does not match"
      );
    }

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    await pool.query(
      `
      UPDATE app.users
      SET
        password_hash = $1,
        updated_at = NOW()
      WHERE username = $2
      `,
      [passwordHash, username]
    );

    console.log(
      `Password for "${username}" updated successfully`
    );
  } catch (error) {
    console.error(`Failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

main();