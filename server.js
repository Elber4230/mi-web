const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;
const appDir = path.join(__dirname, "app");

app.use(express.static(appDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(appDir, "index.html"));
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Servidor listo en http://localhost:${port}`);
});
