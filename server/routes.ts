import express, { type Request, type Response, type NextFunction } from "express";
import { type Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";

import { db } from "./db.js";
import { uploadToSupabase, createSignedUploadUrl } from "./supabase.js";
import {
  users,
  clientSubmissions,
  submissionAttachments,
  boards,
  lists,
  cards,
  tags,
  cardTags,
  cardMembers,
  cardAttachments,
  cardChecklists,
  checklistItems,
  cardComments,
  activityLog,
  boardMembers
} from "../shared/schema.js";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";

import os from "os";

const app = express();
app.use(express.json());

export function registerRoutes(app: Express): Server {
  // Use /tmp for Vercel, process.cwd() for local
  const isVercel = process.env.VERCEL === '1';
  const uploadDir = isVercel ? path.join(os.tmpdir(), "uploads") : path.join(process.cwd(), "uploads");
  const chunksDir = isVercel ? path.join(os.tmpdir(), "chunks") : path.join(process.cwd(), "chunks");

  // Ensure directories exist
  try {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    if (!fs.existsSync(chunksDir)) fs.mkdirSync(chunksDir, { recursive: true });
  } catch (err) {
    console.error("Failed to create directories:", err);
  }


  // Multer using memory storage (for Supabase upload)
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit
    }
  });

  // Add diagnostics endpoint early
  app.get("/api/diagnostics", async (_req, res) => {
    try {
      const result = {
        db: false,
        usersTable: false,
        adminUser: false,
        adminFixed: false,
        message: "",
        env: process.env.NODE_ENV
      };

      // Check DB connection
      try {
        await db.execute(sql`SELECT 1`);
        result.db = true;
      } catch (e: any) {
        result.message = `DB Connection Error: ${e.message}`;
        return res.json(result);
      }

      // Check users table
      try {
        await db.select().from(users).limit(1);
        result.usersTable = true;
      } catch (e: any) {
        result.message = `Users Table Error: ${e.message}`;
        return res.json(result);
      }

      // Check/Fix Admin User
      const [admin] = await db.select().from(users).where(eq(users.email, "admin@demo.com"));
      if (admin) {
        result.adminUser = true;
        // Verify if password needs reset (always reset to be safe)
        const hashedPassword = await bcrypt.hash("1234", 10);
        await db.update(users)
          .set({ password: hashedPassword, role: "admin", isActive: true })
          .where(eq(users.email, "admin@demo.com"));
        result.adminFixed = true;
        result.message = "Admin password reset to '1234' (Node bcrypt).";
      } else {
        // Create admin if missing
        const hashedPassword = await bcrypt.hash("1234", 10);
        await db.insert(users).values({
          email: "admin@demo.com",
          password: hashedPassword,
          name: "Administrador",
          role: "admin",
          isActive: true
        });
        result.adminUser = true;
        result.adminFixed = true;
        result.message = "Admin user created.";
      }

      // Check boards table and creation
      try {
        const [testBoard] = await db.insert(boards).values({
          title: "Diagnóstico Teste",
          description: "Teste automático de criação",
          ownerId: admin.id,
          color: "#000000"
        }).returning();

        // Clean up
        await db.delete(boards).where(eq(boards.id, testBoard.id));
        result.message += " Board creation test PASSED.";
      } catch (e: any) {
        result.message += ` Board Insert Error: ${e.message}`;
      }

      res.json(result);
    } catch (error: any) {
      console.error("Diagnostics error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/basic", (_req, res) => {
    res.json({ message: "Basic serverless function working!", timestamp: new Date().toISOString(), env: process.env.NODE_ENV || "development" });
  });

  // Client Registration (Create passwordless account)
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, name, role = "client" } = req.body;

      if (!email || !name) {
        return res.status(400).json({ error: "Email and name are required" });
      }

      const [existingUser] = await db.select().from(users).where(eq(users.email, email));
      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }

      // Generate random password for client (they will use email-only login)
      const randomPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const [newUser] = await db
        .insert(users)
        .values({
          email,
          password: hashedPassword,
          name,
          role: role === "admin" ? "admin" : "client",
        })
        .returning();

      res.json({
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Failed to register user" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email: rawEmail, password } = req.body;

      if (!rawEmail || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      // Normalize email to lowercase
      const email = rawEmail.toLowerCase().trim();

      // Find user
      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check password (admins must have passwords)
      if (!user.password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // Client login (email only, no password required)
  app.post("/api/auth/client-login", async (req: Request, res: Response) => {
    try {
      const { email: rawEmail } = req.body;

      if (!rawEmail) {
        return res.status(400).json({ error: "Email é obrigatório" });
      }

      // Normalize email to lowercase
      const email = rawEmail.toLowerCase().trim();

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Email inválido" });
      }

      // Check if user exists
      const [existingUser] = await db.select().from(users).where(eq(users.email, email));

      if (existingUser) {
        // If user is admin, block access (admins must use password login)
        if (existingUser.role === "admin") {
          return res.status(403).json({ error: "Administradores devem usar login com senha" });
        }

        // Return existing client user
        return res.json({
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role,
        });
      }

      // Create new client user with random password
      const randomPassword = Math.random().toString(36).substring(2, 15);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      // Extract name from email (before @)
      const nameFromEmail = email.split("@")[0].replace(/[._-]/g, " ");
      const capitalizedName = nameFromEmail
        .split(" ")
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      const [newUser] = await db
        .insert(users)
        .values({
          email,
          password: hashedPassword,
          name: capitalizedName,
          role: "client",
        })
        .returning();

      res.json({
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      });
    } catch (error) {
      console.error("Client login error:", error);
      res.status(500).json({ error: error.message || "Falha no acesso" });
    }
  });

  // ========== GENERAL UPLOAD API (Admin Kanban) ==========
  app.post("/api/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log("Uploading file:", req.file.originalname, req.file.mimetype, req.file.size);

      const result = await uploadToSupabase(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      if (!result) {
        throw new Error("Failed to upload to Supabase");
      }

      res.json({
        url: result.url,
        thumbnailUrl: result.url, // For simple preview
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
      });
    } catch (error) {
      console.error("Upload handler error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // ========== CLIENT SUBMISSIONS ==========

  // ========== ADMIN INBOX ==========
  app.get("/api/admin/submissions", async (req: Request, res: Response) => {
    try {
      const allSubmissions = await db
        .select()
        .from(clientSubmissions)
        .orderBy(desc(clientSubmissions.createdAt));

      const result = await Promise.all(
        allSubmissions.map(async (submission) => {
          const [client] = await db
            .select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(eq(users.id, submission.clientId));

          const attachments = await db
            .select()
            .from(submissionAttachments)
            .where(eq(submissionAttachments.submissionId, submission.id));

          return {
            submission,
            client: client || null,
            attachments: attachments || [],
          };
        })
      );

      res.json(result);
    } catch (error) {
      console.error("Admin inbox error:", error);
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  });

  // ========== CLIENT SUBMISSIONS ==========

  // Create Submission
  app.post("/api/client-submissions", async (req: Request, res: Response) => {
    try {
      const { clientId, title, urgency, requestedDueDate, notes } = req.body;

      if (!clientId) {
        return res.status(400).json({ error: "Client ID required" });
      }

      const [submission] = await db
        .insert(clientSubmissions)
        .values({
          clientId,
          title: title || "Sem título",
          urgency: urgency || "normal",
          requestedDueDate: requestedDueDate ? new Date(requestedDueDate).toISOString() : null,
          notes,
          status: "pendente",
        })
        .returning();

      res.json(submission);
    } catch (error) {
      console.error("Submission error:", error);
      res.status(500).json({ error: "Failed to create submission" });
    }
  });

  // Client Upload (Simple) - Proxy (Keep for small files or fallback, but ideally use Direct)
  app.post("/api/client-submissions/:id/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      const submissionId = parseInt(req.params.id);
      if (!req.file) return res.status(400).json({ error: "No file provided" });

      const result = await uploadToSupabase(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      if (!result) throw new Error("Supabase upload failed");

      // Save attachment record
      const [attachment] = await db.insert(submissionAttachments).values({
        submissionId,
        fileName: req.file.originalname,
        fileUrl: result.url,
        fileType: req.file.mimetype.split('/')[0], // 'image', 'video', etc
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      }).returning();

      res.json(attachment);
    } catch (error) {
      console.error("Submission upload error:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // Link Direct Upload to Submission
  app.post("/api/client-submissions/:id/attachments", async (req: Request, res: Response) => {
    try {
      const submissionId = parseInt(req.params.id);
      const { fileName, fileUrl, fileType, fileSize, mimeType } = req.body;

      if (!fileName || !fileUrl) {
        return res.status(400).json({ error: "File details required" });
      }

      const [attachment] = await db.insert(submissionAttachments).values({
        submissionId,
        fileName,
        fileUrl,
        fileType: fileType || mimeType?.split('/')[0] || 'unknown',
        fileSize: fileSize || 0,
        mimeType: mimeType || 'application/octet-stream',
      }).returning();

      res.json(attachment);
    } catch (error) {
      console.error("Attachment link error:", error);
      res.status(500).json({ error: "Failed to link attachment" });
    }
  });

  // Get Signed Upload URL for Direct Upload
  app.post("/api/upload-url", async (req: Request, res: Response) => {
    try {
      const { fileName, fileType } = req.body;
      if (!fileName || !fileType) return res.status(400).json({ error: "fileName and fileType required" });

      const result = await createSignedUploadUrl(fileName, fileType);
      if (!result) {
        return res.status(500).json({ error: "Failed to generate upload URL" });
      }

      res.json(result);
    } catch (e: any) {
      console.error("Upload URL error:", e);
      res.status(500).json({ error: e.message || "Internal Server Error" });
    }
  });

  // Legacy/Compatibility route (just in case)
  app.post("/api/submissions", async (req: Request, res: Response) => {
    // Redirect logic or duplicate
    return res.status(307).redirect(307, "/api/client-submissions");
  });

  // Get Client Submissions
  app.get("/api/clients/:clientId/submissions", async (req: Request, res: Response) => {
    try {
      const clientId = parseInt(req.params.clientId);

      const results = await db
        .select()
        .from(clientSubmissions)
        .where(eq(clientSubmissions.clientId, clientId))
        .orderBy(desc(clientSubmissions.createdAt));

      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  });

  // ========== KANBAN API ==========

  // Get Boards (Admin)
  app.get("/api/boards", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.query.userId as string);

      if (!userId) {
        return res.status(400).json({ error: "User ID needed" });
      }

      const userBoards = await db
        .select()
        .from(boards)
        .where(eq(boards.ownerId, userId))
        .orderBy(desc(boards.updatedAt));

      res.json(userBoards);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch boards" });
    }
  });

  // Create Board
  app.post("/api/boards", async (req: Request, res: Response) => {
    try {
      const { title, description, ownerId, color } = req.body;

      const [board] = await db
        .insert(boards)
        .values({
          title,
          description,
          ownerId,
          color: color || "#3b82f6",
        })
        .returning();

      // Default lists
      await db.insert(lists).values([
        { boardId: board.id, title: "A Fazer", position: 0, color: "#e2e8f0" },
        { boardId: board.id, title: "Em Progresso", position: 1, color: "#3b82f6" },
        { boardId: board.id, title: "Concluído", position: 2, color: "#22c55e" },
      ]);

      res.json(board);
    } catch (error) {
      res.status(500).json({ error: `Failed to create board: ${error.message}` });
    }
  });

  // Get Board Details (Lists & Cards)
  app.get("/api/boards/:id", async (req: Request, res: Response) => {
    try {
      const boardId = parseInt(req.params.id);

      const [board] = await db.select().from(boards).where(eq(boards.id, boardId));

      if (!board) {
        return res.status(404).json({ error: "Board not found" });
      }

      const boardLists = await db
        .select()
        .from(lists)
        .where(eq(lists.boardId, boardId))
        .orderBy(lists.position);

      const boardCards = await db
        .select()
        .from(cards)
        .where(inArray(cards.listId, boardLists.map(l => l.id)));

      res.json({ ...board, lists: boardLists, cards: boardCards });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch board details" });
    }
  });

  // ========== LISTS API ==========

  // Create List
  app.post("/api/lists", async (req: Request, res: Response) => {
    try {
      const { boardId, title, position, color } = req.body;

      const [list] = await db
        .insert(lists)
        .values({
          boardId,
          title,
          position: position || 0,
          color,
        })
        .returning();

      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to create list" });
    }
  });

  // Update List
  app.put("/api/lists/:id", async (req: Request, res: Response) => {
    try {
      const listId = parseInt(req.params.id);
      const { title, position, color, isArchived } = req.body;

      // Extract only defined fields to avoid overwriting with undefined
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (position !== undefined) updates.position = position;
      if (color !== undefined) updates.color = color;
      if (isArchived !== undefined) updates.isArchived = isArchived;

      const [updatedList] = await db
        .update(lists)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(lists.id, listId))
        .returning();

      res.json(updatedList);
    } catch (error) {
      res.status(500).json({ error: "Failed to update list" });
    }
  });

  // Delete List
  app.delete("/api/lists/:id", async (req: Request, res: Response) => {
    try {
      const listId = parseInt(req.params.id);
      await db.delete(lists).where(eq(lists.id, listId));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete list" });
    }
  });

  // ========== CARDS API ==========

  // Create Card
  app.post("/api/cards", async (req: Request, res: Response) => {
    try {
      const { listId, title, description, position, priority, dueDate, coverImage, memberIds, tagIds } = req.body;

      // 1. Create the card
      const [card] = await db
        .insert(cards)
        .values({
          listId,
          title,
          description,
          position: position || 0,
          priority: priority || "medium",
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          coverImage,
        })
        .returning();

      // 2. Add members if provided
      if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
        await db.insert(cardMembers).values(
          memberIds.map((userId: number) => ({
            cardId: card.id,
            userId,
          }))
        );
      }

      // 3. Add tags if provided
      if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
        await db.insert(cardTags).values(
          tagIds.map((tagId: number) => ({
            cardId: card.id,
            tagId,
          }))
        );
      }

      res.json(card);
    } catch (error) {
      console.error("Create card error:", error);
      res.status(500).json({ error: "Failed to create card" });
    }
  });

  // Update Card
  app.put("/api/cards/:id", async (req: Request, res: Response) => {
    try {
      const cardId = parseInt(req.params.id);
      const { listId, title, description, position, priority, dueDate, coverImage, isArchived } = req.body;

      const updates: any = {};
      if (listId !== undefined) updates.listId = listId;
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (position !== undefined) updates.position = position;
      if (priority !== undefined) updates.priority = priority;
      if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
      if (coverImage !== undefined) updates.coverImage = coverImage;
      if (isArchived !== undefined) updates.isArchived = isArchived;

      const [updatedCard] = await db
        .update(cards)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(cards.id, cardId))
        .returning();

      res.json(updatedCard);
    } catch (error) {
      console.error("Update card error:", error);
      res.status(500).json({ error: "Failed to update card" });
    }
  });

  // Delete Card
  app.delete("/api/cards/:id", async (req: Request, res: Response) => {
    try {
      const cardId = parseInt(req.params.id);
      await db.delete(cards).where(eq(cards.id, cardId));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete card" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
