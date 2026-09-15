const validateEnvironment = require("./config/validateEnvironment");

validateEnvironment();

const app = require("./app");

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(
    `Server running at http://localhost:${PORT}`
  );
});