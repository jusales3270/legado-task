import type { Express, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { exec } from "child_process";
import { db } from "./db";
import { users, tasks, clientSubmissions, submissionAttachments, boards, lists, cards } from "../shared/schema";
import { eq, desc } from "drizzle-orm";
import { supabase, STORAGE_BUCKET, ensureBucketExists } from "./supabase";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB limit for large video files
});

export async function registerRoutes(app: Express): Promise<void> {
  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // ===== AUTHENTICATION ROUTES =====

  // Register new user
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name, role = "client" } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: "Email, password, and name are required" });
      }

      // Check if user already exists
      const existingUser = await db.select().from(users).where(eq(users.email, email));
      if (existingUser.length > 0) {
        return res.status(400).json({ error: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
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
      res.status(500).json({ error: "Falha no acesso" });
    }
  });

  // ===== TASK ROUTES =====

  // Create task (client submission)
  app.post("/api/tasks", async (req: Request, res: Response) => {
    try {
      const { clientId, fileUrl, fileName, fileSize, urgency, dueDate, description } = req.body;

      if (!fileUrl) {
        return res.status(400).json({ error: "File URL is required" });
      }

      if (!clientId) {
        return res.status(400).json({ error: "Client ID is required" });
      }

      // Validate that the client exists
      const [client] = await db.select().from(users).where(eq(users.id, clientId));
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const [newTask] = await db
        .insert(tasks)
        .values({
          clientId: parseInt(clientId),
          fileUrl,
          fileName,
          fileSize,
          urgency: urgency || "Normal",
          dueDate: dueDate || null,
          status: "Inbox",
          description,
        })
        .returning();

      res.json(newTask);
    } catch (error) {
      console.error("Create task error:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // Get all tasks (for admin)
  app.get("/api/tasks", async (_req: Request, res: Response) => {
    try {
      const allTasks = await db.select().from(tasks);
      res.json(allTasks);
    } catch (error) {
      console.error("Get tasks error:", error);
      res.status(500).json({ error: "Failed to get tasks" });
    }
  });

  // Get tasks by client
  app.get("/api/tasks/client/:clientId", async (req: Request, res: Response) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const clientTasks = await db.select().from(tasks).where(eq(tasks.clientId, clientId));
      res.json(clientTasks);
    } catch (error) {
      console.error("Get client tasks error:", error);
      res.status(500).json({ error: "Failed to get client tasks" });
    }
  });

  // Update task status (when admin adds to board)
  app.patch("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.id);
      const { status } = req.body;

      const [updatedTask] = await db
        .update(tasks)
        .set({ status, updatedAt: new Date() })
        .where(eq(tasks.id, taskId))
        .returning();

      if (!updatedTask) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json(updatedTask);
    } catch (error) {
      console.error("Update task error:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // ===== USER ROUTES =====

  // Get all users (for admin to see client names)
  app.get("/api/users", async (_req: Request, res: Response) => {
    try {
      const allUsers = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        profilePhoto: users.profilePhoto,
      }).from(users);
      res.json(allUsers);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  // Get single user by ID
  app.get("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const [user] = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        profilePhoto: users.profilePhoto,
      }).from(users).where(eq(users.id, userId));
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Update user profile (name and/or profile photo)
  app.patch("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const { name, profilePhoto } = req.body;

      const updateData: { name?: string; profilePhoto?: string; updatedAt: Date } = {
        updatedAt: new Date(),
      };

      if (name) updateData.name = name;
      if (profilePhoto !== undefined) updateData.profilePhoto = profilePhoto;

      const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          profilePhoto: users.profilePhoto,
        });

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Change user password
  app.post("/api/users/:id/change-password", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current and new password are required" });
      }

      if (newPassword.length < 4) {
        return res.status(400).json({ error: "New password must be at least 4 characters" });
      }

      // Get user with password
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password (user must have a password set)
      if (!user.password) {
        return res.status(400).json({ error: "User does not have a password set" });
      }
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Hash and update new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db
        .update(users)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(users.id, userId));

      res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Upload profile photo
  app.post("/api/users/:id/upload-photo", upload.single("photo"), async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);

      if (!req.file) {
        return res.status(400).json({ error: "No photo uploaded" });
      }

      const photoUrl = `/uploads/${req.file.filename}`;

      const [updatedUser] = await db
        .update(users)
        .set({ profilePhoto: photoUrl, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          profilePhoto: users.profilePhoto,
        });

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Upload photo error:", error);
      res.status(500).json({ error: "Failed to upload photo" });
    }
  });

  // ===== FILE UPLOAD ROUTES =====

  // Helper function to generate video thumbnail
  const generateVideoThumbnail = async (videoPath: string, thumbnailPath: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const command = `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 -vf "scale=320:-1" -y "${thumbnailPath}"`;
      
      exec(command, (error) => {
        if (error) {
          console.error("FFmpeg error:", error.message);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  };

  // File upload endpoint
  app.post("/api/upload", upload.single("file"), async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const publicUrl = `/uploads/${req.file.filename}`;
    let thumbnailUrl: string | undefined;

    // Check if file is a video and generate thumbnail
    const isVideo = req.file.mimetype.startsWith("video/");
    if (isVideo) {
      const thumbnailFilename = `thumb_${req.file.filename.replace(/\.[^.]+$/, ".jpg")}`;
      const thumbnailPath = path.join(uploadDir, thumbnailFilename);
      const videoPath = path.join(uploadDir, req.file.filename);

      const success = await generateVideoThumbnail(videoPath, thumbnailPath);
      if (success && fs.existsSync(thumbnailPath)) {
        thumbnailUrl = `/uploads/${thumbnailFilename}`;
      }
    }

    res.json({
      url: publicUrl,
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype,
      thumbnailUrl,
    });
  });

  // Serve uploaded files
  app.use("/uploads", (req: Request, res: Response, next) => {
    const filePath = path.join(uploadDir, req.path);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  // Delete file endpoint
  app.delete("/api/upload/:filename", (req: Request, res: Response) => {
    const filePath = path.join(uploadDir, req.params.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  // ===== CLIENT SUBMISSIONS ROUTES =====

  // Create a new client submission
  app.post("/api/client-submissions", async (req: Request, res: Response) => {
    try {
      const { clientId, title, urgency, requestedDueDate, notes } = req.body;

      if (!clientId) {
        return res.status(400).json({ error: "Client ID é obrigatório" });
      }

      const [submission] = await db
        .insert(clientSubmissions)
        .values({
          clientId: parseInt(clientId),
          title: title || "Novo envio",
          urgency: urgency || "normal",
          requestedDueDate: requestedDueDate || null,
          notes: notes || null,
          status: "pendente",
        })
        .returning();

      res.json(submission);
    } catch (error) {
      console.error("Create submission error:", error);
      res.status(500).json({ error: "Falha ao criar envio" });
    }
  });

  // Get all submissions for a client
  app.get("/api/client-submissions", async (req: Request, res: Response) => {
    try {
      const clientId = req.query.clientId as string;

      if (!clientId) {
        return res.status(400).json({ error: "Client ID é obrigatório" });
      }

      const submissions = await db
        .select()
        .from(clientSubmissions)
        .where(eq(clientSubmissions.clientId, parseInt(clientId)))
        .orderBy(desc(clientSubmissions.createdAt));

      res.json(submissions);
    } catch (error) {
      console.error("Get submissions error:", error);
      res.status(500).json({ error: "Falha ao buscar envios" });
    }
  });

  // Get all submissions (admin view)
  app.get("/api/admin/submissions", async (req: Request, res: Response) => {
    try {
      const allSubmissions = await db
        .select({
          submission: clientSubmissions,
          client: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(clientSubmissions)
        .leftJoin(users, eq(clientSubmissions.clientId, users.id))
        .orderBy(desc(clientSubmissions.createdAt));

      const submissionsWithAttachments = await Promise.all(
        allSubmissions.map(async (item) => {
          const attachments = await db
            .select()
            .from(submissionAttachments)
            .where(eq(submissionAttachments.submissionId, item.submission.id));
          return {
            ...item,
            attachments,
          };
        })
      );

      res.json(submissionsWithAttachments);
    } catch (error) {
      console.error("Get admin submissions error:", error);
      res.status(500).json({ error: "Falha ao buscar envios" });
    }
  });

  // ===== CHUNKED UPLOAD ENDPOINTS =====
  
  const chunksDir = path.join(process.cwd(), "uploads", "chunks");
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }

  // Initialize a chunked upload session
  app.post("/api/chunked-upload/init", async (req: Request, res: Response) => {
    try {
      const { fileName, fileSize, mimeType, submissionId } = req.body;
      
      if (!fileName || !fileSize || !submissionId) {
        return res.status(400).json({ error: "fileName, fileSize e submissionId são obrigatórios" });
      }

      // Generate a unique upload ID
      const uploadId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const uploadSessionDir = path.join(chunksDir, uploadId);
      fs.mkdirSync(uploadSessionDir, { recursive: true });

      // Store session metadata
      const sessionData = {
        uploadId,
        fileName,
        fileSize,
        mimeType: mimeType || "application/octet-stream",
        submissionId: parseInt(submissionId),
        uploadedChunks: [] as number[],
        createdAt: new Date().toISOString(),
      };
      
      fs.writeFileSync(
        path.join(uploadSessionDir, "session.json"),
        JSON.stringify(sessionData, null, 2)
      );

      res.json({ uploadId, chunkSize: 10 * 1024 * 1024 }); // 10MB chunks
    } catch (error) {
      console.error("Init chunked upload error:", error);
      res.status(500).json({ error: "Falha ao iniciar upload" });
    }
  });

  // Get upload session status (for resuming)
  app.get("/api/chunked-upload/:uploadId/status", async (req: Request, res: Response) => {
    try {
      const { uploadId } = req.params;
      const sessionPath = path.join(chunksDir, uploadId, "session.json");
      
      if (!fs.existsSync(sessionPath)) {
        return res.status(404).json({ error: "Sessão de upload não encontrada" });
      }

      const sessionData = JSON.parse(fs.readFileSync(sessionPath, "utf-8"));
      res.json({
        uploadedChunks: sessionData.uploadedChunks,
        fileName: sessionData.fileName,
        fileSize: sessionData.fileSize,
      });
    } catch (error) {
      console.error("Get upload status error:", error);
      res.status(500).json({ error: "Falha ao buscar status do upload" });
    }
  });

  // Upload a single chunk
  app.put("/api/chunked-upload/:uploadId/chunk/:chunkIndex", upload.single("chunk"), async (req: Request, res: Response) => {
    try {
      const { uploadId, chunkIndex } = req.params;
      const chunkIdx = parseInt(chunkIndex);
      const sessionDir = path.join(chunksDir, uploadId);
      const sessionPath = path.join(sessionDir, "session.json");
      
      if (!fs.existsSync(sessionPath)) {
        return res.status(404).json({ error: "Sessão de upload não encontrada" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Chunk não enviado" });
      }

      // Move chunk to session directory
      const chunkPath = path.join(sessionDir, `chunk_${chunkIdx}`);
      fs.renameSync(req.file.path, chunkPath);

      // Update session
      const sessionData = JSON.parse(fs.readFileSync(sessionPath, "utf-8"));
      if (!sessionData.uploadedChunks.includes(chunkIdx)) {
        sessionData.uploadedChunks.push(chunkIdx);
        sessionData.uploadedChunks.sort((a: number, b: number) => a - b);
      }
      fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));

      res.json({ 
        success: true, 
        chunkIndex: chunkIdx,
        uploadedChunks: sessionData.uploadedChunks.length 
      });
    } catch (error) {
      console.error("Upload chunk error:", error);
      res.status(500).json({ error: "Falha ao enviar chunk" });
    }
  });

  // Finalize chunked upload - merge chunks and upload to storage
  app.post("/api/chunked-upload/:uploadId/finalize", async (req: Request, res: Response) => {
    try {
      const { uploadId } = req.params;
      const sessionDir = path.join(chunksDir, uploadId);
      const sessionPath = path.join(sessionDir, "session.json");
      
      if (!fs.existsSync(sessionPath)) {
        return res.status(404).json({ error: "Sessão de upload não encontrada" });
      }

      const sessionData = JSON.parse(fs.readFileSync(sessionPath, "utf-8"));
      const { fileName, fileSize, mimeType, submissionId, uploadedChunks } = sessionData;

      // Calculate expected chunks
      const chunkSize = 10 * 1024 * 1024; // 10MB
      const expectedChunks = Math.ceil(fileSize / chunkSize);
      
      if (uploadedChunks.length < expectedChunks) {
        return res.status(400).json({ 
          error: `Upload incompleto: ${uploadedChunks.length}/${expectedChunks} chunks recebidos` 
        });
      }

      // Merge chunks into final file
      const ext = path.extname(fileName);
      const finalFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
      const finalPath = path.join(uploadDir, finalFileName);
      
      const writeStream = fs.createWriteStream(finalPath);
      
      for (let i = 0; i < expectedChunks; i++) {
        const chunkPath = path.join(sessionDir, `chunk_${i}`);
        if (!fs.existsSync(chunkPath)) {
          writeStream.close();
          return res.status(400).json({ error: `Chunk ${i} não encontrado` });
        }
        const chunkData = fs.readFileSync(chunkPath);
        writeStream.write(chunkData);
      }
      
      await new Promise<void>((resolve) => writeStream.end(resolve));

      // Determine file type
      let fileType: "video" | "audio" | "image" | "document" | "other" = "other";
      if (mimeType.startsWith("video/")) fileType = "video";
      else if (mimeType.startsWith("audio/")) fileType = "audio";
      else if (mimeType.startsWith("image/")) fileType = "image";
      else if (mimeType.includes("pdf") || mimeType.includes("document")) fileType = "document";

      let fileUrl: string = `/uploads/${finalFileName}`;
      let thumbnailUrl: string | undefined;

      // Generate thumbnail for videos
      if (fileType === "video") {
        const thumbnailFilename = `thumb_${finalFileName.replace(/\.[^.]+$/, ".jpg")}`;
        const thumbPath = path.join(uploadDir, thumbnailFilename);
        const success = await generateVideoThumbnail(finalPath, thumbPath);
        if (success && fs.existsSync(thumbPath)) {
          thumbnailUrl = `/uploads/${thumbnailFilename}`;
        }
      }

      // Upload to Supabase if available
      if (supabase) {
        await ensureBucketExists();

        const timestamp = Date.now();
        const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
        const storagePath = `submissions/${submissionId}/${timestamp}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, fs.readFileSync(finalPath), {
            contentType: mimeType,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(storagePath);
          fileUrl = urlData.publicUrl;

          // Upload thumbnail to Supabase
          if (thumbnailUrl && fs.existsSync(path.join(uploadDir, `thumb_${finalFileName.replace(/\.[^.]+$/, ".jpg")}`))) {
            const thumbFilePath = `submissions/${submissionId}/${timestamp}_thumb_${safeName.replace(/\.[^.]+$/, ".jpg")}`;
            const thumbLocalPath = path.join(uploadDir, `thumb_${finalFileName.replace(/\.[^.]+$/, ".jpg")}`);
            
            const { error: thumbUploadError } = await supabase.storage
              .from(STORAGE_BUCKET)
              .upload(thumbFilePath, fs.readFileSync(thumbLocalPath), {
                contentType: "image/jpeg",
              });

            if (!thumbUploadError) {
              const { data: thumbUrlData } = supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(thumbFilePath);
              thumbnailUrl = thumbUrlData.publicUrl;
              fs.unlinkSync(thumbLocalPath);
            }
          }

          // Clean up local file
          fs.unlinkSync(finalPath);
        }
      }

      // Save attachment to database
      const actualFileSize = fs.existsSync(finalPath) ? fs.statSync(finalPath).size : fileSize;
      const [attachment] = await db
        .insert(submissionAttachments)
        .values({
          submissionId,
          fileName,
          fileUrl,
          thumbnailUrl,
          fileType,
          fileSize: actualFileSize,
          mimeType,
        })
        .returning();

      // Clean up chunk session directory
      fs.rmSync(sessionDir, { recursive: true, force: true });

      res.json(attachment);
    } catch (error) {
      console.error("Finalize chunked upload error:", error);
      res.status(500).json({ error: "Falha ao finalizar upload" });
    }
  });

  // Upload file for a submission (uses Supabase Storage) - legacy single upload
  app.post("/api/client-submissions/:submissionId/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      const submissionId = parseInt(req.params.submissionId);

      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      let fileUrl: string;
      let thumbnailUrl: string | undefined;

      // Determine file type
      let fileType: "video" | "audio" | "image" | "document" | "other" = "other";
      if (req.file.mimetype.startsWith("video/")) fileType = "video";
      else if (req.file.mimetype.startsWith("audio/")) fileType = "audio";
      else if (req.file.mimetype.startsWith("image/")) fileType = "image";
      else if (req.file.mimetype.includes("pdf") || req.file.mimetype.includes("document")) fileType = "document";

      // Generate thumbnail for videos BEFORE uploading to Supabase (while local file exists)
      const videoPath = path.join(uploadDir, req.file.filename);
      const thumbnailFilename = `thumb_${req.file.filename.replace(/\.[^.]+$/, ".jpg")}`;
      const thumbPath = path.join(uploadDir, thumbnailFilename);
      
      if (fileType === "video") {
        const success = await generateVideoThumbnail(videoPath, thumbPath);
        if (success && fs.existsSync(thumbPath)) {
          thumbnailUrl = `/uploads/${thumbnailFilename}`;
        }
      }

      // Try to upload to Supabase Storage
      if (supabase) {
        await ensureBucketExists();

        const timestamp = Date.now();
        const safeName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `submissions/${submissionId}/${timestamp}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filePath, fs.readFileSync(videoPath), {
            contentType: req.file.mimetype,
          });

        if (uploadError) {
          console.error("Supabase upload error:", uploadError.message);
          fileUrl = `/uploads/${req.file.filename}`;
        } else {
          const { data: urlData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(filePath);
          fileUrl = urlData.publicUrl;

          // Upload thumbnail to Supabase if it was generated
          if (thumbnailUrl && fs.existsSync(thumbPath)) {
            const thumbFilePath = `submissions/${submissionId}/${timestamp}_thumb_${safeName.replace(/\.[^.]+$/, ".jpg")}`;
            const { error: thumbUploadError } = await supabase.storage
              .from(STORAGE_BUCKET)
              .upload(thumbFilePath, fs.readFileSync(thumbPath), {
                contentType: "image/jpeg",
              });

            if (!thumbUploadError) {
              const { data: thumbUrlData } = supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(thumbFilePath);
              thumbnailUrl = thumbUrlData.publicUrl;
              // Delete local thumbnail
              fs.unlinkSync(thumbPath);
            }
          }

          // Delete local video file after successful Supabase upload
          fs.unlinkSync(videoPath);
        }
      } else {
        fileUrl = `/uploads/${req.file.filename}`;
      }

      // Save attachment metadata to database
      const [attachment] = await db
        .insert(submissionAttachments)
        .values({
          submissionId,
          fileName: req.file.originalname,
          fileUrl,
          thumbnailUrl,
          fileType,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        })
        .returning();

      res.json(attachment);
    } catch (error) {
      console.error("Upload submission file error:", error);
      res.status(500).json({ error: "Falha ao enviar arquivo" });
    }
  });

  // Get attachments for a submission
  app.get("/api/client-submissions/:submissionId/attachments", async (req: Request, res: Response) => {
    try {
      const submissionId = parseInt(req.params.submissionId);

      const attachments = await db
        .select()
        .from(submissionAttachments)
        .where(eq(submissionAttachments.submissionId, submissionId));

      res.json(attachments);
    } catch (error) {
      console.error("Get attachments error:", error);
      res.status(500).json({ error: "Falha ao buscar anexos" });
    }
  });

  // Update submission status (admin action)
  app.patch("/api/client-submissions/:id", async (req: Request, res: Response) => {
    try {
      const submissionId = parseInt(req.params.id);
      const { status, adminNotes, assignedBoardId, assignedCardId } = req.body;

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (status) updateData.status = status;
      if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
      if (assignedBoardId !== undefined) updateData.assignedBoardId = assignedBoardId;
      if (assignedCardId !== undefined) updateData.assignedCardId = assignedCardId;

      const [updated] = await db
        .update(clientSubmissions)
        .set(updateData)
        .where(eq(clientSubmissions.id, submissionId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Update submission error:", error);
      res.status(500).json({ error: "Falha ao atualizar envio" });
    }
  });

  // Create card from submission (moves to Kanban)
  app.post("/api/client-submissions/:id/create-card", async (req: Request, res: Response) => {
    try {
      const submissionId = parseInt(req.params.id);
      const { listId, boardId } = req.body;

      if (!listId) {
        return res.status(400).json({ error: "List ID é obrigatório" });
      }

      // Get submission
      const [submission] = await db
        .select()
        .from(clientSubmissions)
        .where(eq(clientSubmissions.id, submissionId));

      if (!submission) {
        return res.status(404).json({ error: "Envio não encontrado" });
      }

      // Get client info
      const [client] = await db
        .select()
        .from(users)
        .where(eq(users.id, submission.clientId));

      // Create card
      const [card] = await db
        .insert(cards)
        .values({
          listId: parseInt(listId),
          submissionId,
          title: submission.title || `Envio de ${client?.name || "Cliente"}`,
          description: submission.notes || "",
          position: 0,
          dueDate: submission.requestedDueDate,
          priority: submission.urgency,
        })
        .returning();

      // Update submission with card reference
      await db
        .update(clientSubmissions)
        .set({
          assignedBoardId: parseInt(boardId),
          assignedCardId: card.id,
          status: "em_producao",
          updatedAt: new Date(),
        })
        .where(eq(clientSubmissions.id, submissionId));

      res.json(card);
    } catch (error) {
      console.error("Create card from submission error:", error);
      res.status(500).json({ error: "Falha ao criar card" });
    }
  });

  // Audio transcription endpoint using OpenAI Whisper
  app.post("/api/transcribe-audio", async (req: Request, res: Response) => {
    try {
      const { audioUrl, transcriptionType } = req.body;

      if (!audioUrl || !transcriptionType) {
        return res.status(400).json({ error: "audioUrl and transcriptionType are required" });
      }

      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      if (!OPENAI_API_KEY) {
        console.error("OPENAI_API_KEY is not configured");
        return res.status(500).json({ error: "Chave da API OpenAI não configurada" });
      }

      console.log("Fetching audio file from:", audioUrl);

      let audioBuffer: Buffer;
      let fileName = "audio.mp3";

      if (audioUrl.startsWith("/uploads/")) {
        const filePath = path.join(uploadDir, audioUrl.replace("/uploads/", ""));
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: "Arquivo de áudio não encontrado" });
        }
        audioBuffer = fs.readFileSync(filePath);
        fileName = path.basename(filePath);
      } else {
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
          console.error("Failed to fetch audio:", audioResponse.status);
          return res.status(500).json({ error: "Falha ao buscar arquivo de áudio" });
        }
        const arrayBuffer = await audioResponse.arrayBuffer();
        audioBuffer = Buffer.from(arrayBuffer);
        const urlPath = new URL(audioUrl).pathname;
        fileName = path.basename(urlPath) || "audio.mp3";
      }

      console.log("Audio file loaded, size:", audioBuffer.length, "bytes");

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

      const tempFilePath = path.join(uploadDir, `temp_${Date.now()}_${fileName}`);
      fs.writeFileSync(tempFilePath, audioBuffer);

      console.log("Sending audio to OpenAI Whisper for transcription...");

      let transcription: string;
      try {
        const whisperResponse = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tempFilePath),
          model: "whisper-1",
          language: "pt",
          response_format: "text",
        });

        transcription = whisperResponse as unknown as string;
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }

      if (transcriptionType === "summarize" && transcription) {
        console.log("Summarizing transcription with GPT...");
        const summaryResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Você é um assistente especializado em sumarização. Forneça um resumo conciso e claro do texto a seguir, destacando os pontos principais.",
            },
            {
              role: "user",
              content: `Resuma o seguinte texto:\n\n${transcription}`,
            },
          ],
        });
        transcription = summaryResponse.choices[0]?.message?.content || transcription;
      }

      if (!transcription) {
        console.error("No transcription generated");
        return res.status(500).json({ error: "Nenhuma transcrição gerada" });
      }

      console.log("Transcription successful");

      res.json({
        transcription,
        type: transcriptionType,
      });
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      if (err.status === 429) {
        return res.status(429).json({
          error: "Limite de taxa excedido. Por favor, tente novamente em alguns instantes.",
        });
      }
      console.error("Error in transcribe-audio endpoint:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}
