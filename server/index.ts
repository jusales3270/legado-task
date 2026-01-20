import express, { type Request, type Response, type NextFunction } from "express";
import { registerRoutes } from "./routes";

const app = express();
const PORT = 3001;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  console.error("Global Error Handler:", err);
  res.status(status).json({ message });
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const message = `[${new Date().toISOString()}] ${req.method} ${req.url}`;
  console.log(message);
  next();
});

registerRoutes(app);

// Only start the server if we're running locally (not in Vercel)
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

export { app };
