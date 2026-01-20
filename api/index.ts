import type { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
    try {
        console.log("Dynamically loading server/index.ts...");
        // Use dynamic import to catch initialization errors
        const module = await import('../server/index');
        const app = module.app;

        // Forward the request to the express app
        app(req, res);
    } catch (error: any) {
        console.error("CRITICAL STARTUP ERROR:", error);
        res.status(200).json({ // Return 200 to ensure Vercel shows the body
            status: "error",
            message: "Application failed to start",
            details: error.message,
            stack: error.stack,
            env: {
                nodeEnv: process.env.NODE_ENV,
                hasDatabaseUrl: !!process.env.DATABASE_URL
            }
        });
    }
}
