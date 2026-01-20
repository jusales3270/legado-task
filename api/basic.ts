import type { Request, Response } from 'express';

export default function handler(req: Request, res: Response) {
    res.status(200).json({
        message: "Basic serverless function working!",
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV
    });
}
