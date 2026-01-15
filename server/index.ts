import express from "express";
import { registerRoutes } from "./routes";

const app = express();
const PORT = 3001;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

registerRoutes(app);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
