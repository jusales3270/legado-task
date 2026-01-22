import { pgTable, text, uuid, timestamp, serial, varchar, date, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// ===== ENUMS =====
export const userRoles = ["admin", "client"] as const;
export type UserRole = typeof userRoles[number];

export const urgencyLevels = ["baixa", "normal", "urgente", "critica"] as const;
export type UrgencyLevel = typeof urgencyLevels[number];

export const submissionStatuses = ["pendente", "em_analise", "em_producao", "concluido", "arquivado"] as const;
export type SubmissionStatus = typeof submissionStatuses[number];

export const fileTypes = ["video", "audio", "image", "document", "other"] as const;
export type FileType = typeof fileTypes[number];

// ===== USERS TABLE =====
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("client"),
  profilePhoto: text("profile_photo"),
  phone: varchar("phone", { length: 50 }),
  company: varchar("company", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ===== CLIENT SUBMISSIONS (Portal do Cliente) =====
export const clientSubmissions = pgTable("client_submissions", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => users.id),
  title: varchar("title", { length: 500 }),
  urgency: varchar("urgency", { length: 20 }).notNull().default("normal"),
  requestedDueDate: date("requested_due_date"),
  notes: text("notes"),
  status: varchar("status", { length: 50 }).notNull().default("pendente"),
  adminNotes: text("admin_notes"),
  assignedBoardId: integer("assigned_board_id"),
  assignedCardId: integer("assigned_card_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertClientSubmissionSchema = createInsertSchema(clientSubmissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClientSubmission = z.infer<typeof insertClientSubmissionSchema>;
export type ClientSubmission = typeof clientSubmissions.$inferSelect;

// ===== SUBMISSION ATTACHMENTS (Arquivos dos envios) =====
export const submissionAttachments = pgTable("submission_attachments", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => clientSubmissions.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  fileUrl: text("file_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  fileType: varchar("file_type", { length: 50 }).notNull().default("other"),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  durationSeconds: integer("duration_seconds"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSubmissionAttachmentSchema = createInsertSchema(submissionAttachments).omit({
  id: true,
  createdAt: true,
});

export type InsertSubmissionAttachment = z.infer<typeof insertSubmissionAttachmentSchema>;
export type SubmissionAttachment = typeof submissionAttachments.$inferSelect;

// ===== KANBAN BOARDS =====
export const boards = pgTable("boards", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  color: varchar("color", { length: 50 }),
  isFavorite: boolean("is_favorite").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBoardSchema = createInsertSchema(boards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBoard = z.infer<typeof insertBoardSchema>;
export type Board = typeof boards.$inferSelect;

// ===== BOARD MEMBERS =====
export const boardMembers = pgTable("board_members", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).notNull().default("member"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBoardMemberSchema = createInsertSchema(boardMembers).omit({
  id: true,
  createdAt: true,
});

export type InsertBoardMember = z.infer<typeof insertBoardMemberSchema>;
export type BoardMember = typeof boardMembers.$inferSelect;

// ===== KANBAN LISTS =====
export const lists = pgTable("lists", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  position: integer("position").notNull().default(0),
  color: varchar("color", { length: 50 }),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertListSchema = createInsertSchema(lists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertList = z.infer<typeof insertListSchema>;
export type List = typeof lists.$inferSelect;

// ===== KANBAN CARDS =====
export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  listId: integer("list_id").notNull().references(() => lists.id, { onDelete: "cascade" }),
  submissionId: integer("submission_id").references(() => clientSubmissions.id),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
  dueDate: date("due_date"),
  priority: varchar("priority", { length: 20 }),
  coverImage: text("cover_image"),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCardSchema = createInsertSchema(cards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cards.$inferSelect;

// ===== CARD MEMBERS =====
export const cardMembers = pgTable("card_members", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCardMemberSchema = createInsertSchema(cardMembers).omit({
  id: true,
  createdAt: true,
});

export type InsertCardMember = z.infer<typeof insertCardMemberSchema>;
export type CardMember = typeof cardMembers.$inferSelect;

// ===== TAGS (Etiquetas) =====
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
});

export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tags.$inferSelect;

// ===== CARD TAGS =====
export const cardTags = pgTable("card_tags", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCardTagSchema = createInsertSchema(cardTags).omit({
  id: true,
  createdAt: true,
});

export type InsertCardTag = z.infer<typeof insertCardTagSchema>;
export type CardTag = typeof cardTags.$inferSelect;

// ===== CARD ATTACHMENTS =====
export const cardAttachments = pgTable("card_attachments", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  fileUrl: text("file_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  fileType: varchar("file_type", { length: 50 }).notNull().default("other"),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  transcription: text("transcription"),
  transcriptionStatus: varchar("transcription_status", { length: 50 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCardAttachmentSchema = createInsertSchema(cardAttachments).omit({
  id: true,
  createdAt: true,
});

export type InsertCardAttachment = z.infer<typeof insertCardAttachmentSchema>;
export type CardAttachment = typeof cardAttachments.$inferSelect;

// ===== CARD CHECKLISTS =====
export const cardChecklists = pgTable("card_checklists", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCardChecklistSchema = createInsertSchema(cardChecklists).omit({
  id: true,
  createdAt: true,
});

export type InsertCardChecklist = z.infer<typeof insertCardChecklistSchema>;
export type CardChecklist = typeof cardChecklists.$inferSelect;

// ===== CHECKLIST ITEMS =====
export const checklistItems = pgTable("checklist_items", {
  id: serial("id").primaryKey(),
  checklistId: integer("checklist_id").notNull().references(() => cardChecklists.id, { onDelete: "cascade" }),
  text: varchar("text", { length: 500 }).notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChecklistItemSchema = createInsertSchema(checklistItems).omit({
  id: true,
  createdAt: true,
});

export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;
export type ChecklistItem = typeof checklistItems.$inferSelect;

// ===== CARD COMMENTS =====
export const cardComments = pgTable("card_comments", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isInternal: boolean("is_internal").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCardCommentSchema = createInsertSchema(cardComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCardComment = z.infer<typeof insertCardCommentSchema>;
export type CardComment = typeof cardComments.$inferSelect;

// ===== ACTIVITY LOG =====
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: integer("entity_id").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertActivityLogSchema = createInsertSchema(activityLog).omit({
  id: true,
  createdAt: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLog.$inferSelect;

// ===== RELATIONS =====
export const usersRelations = relations(users, ({ many }) => ({
  submissions: many(clientSubmissions),
  boardMemberships: many(boardMembers),
  ownedBoards: many(boards),
  cardMemberships: many(cardMembers),
  comments: many(cardComments),
}));

export const clientSubmissionsRelations = relations(clientSubmissions, ({ one, many }) => ({
  client: one(users, {
    fields: [clientSubmissions.clientId],
    references: [users.id],
  }),
  attachments: many(submissionAttachments),
  cards: many(cards),
}));

export const submissionAttachmentsRelations = relations(submissionAttachments, ({ one }) => ({
  submission: one(clientSubmissions, {
    fields: [submissionAttachments.submissionId],
    references: [clientSubmissions.id],
  }),
}));

export const boardsRelations = relations(boards, ({ one, many }) => ({
  owner: one(users, {
    fields: [boards.ownerId],
    references: [users.id],
  }),
  members: many(boardMembers),
  lists: many(lists),
  tags: many(tags),
}));

export const boardMembersRelations = relations(boardMembers, ({ one }) => ({
  board: one(boards, {
    fields: [boardMembers.boardId],
    references: [boards.id],
  }),
  user: one(users, {
    fields: [boardMembers.userId],
    references: [users.id],
  }),
}));

export const listsRelations = relations(lists, ({ one, many }) => ({
  board: one(boards, {
    fields: [lists.boardId],
    references: [boards.id],
  }),
  cards: many(cards),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  list: one(lists, {
    fields: [cards.listId],
    references: [lists.id],
  }),
  submission: one(clientSubmissions, {
    fields: [cards.submissionId],
    references: [clientSubmissions.id],
  }),
  members: many(cardMembers),
  tags: many(cardTags),
  attachments: many(cardAttachments),
  checklists: many(cardChecklists),
  comments: many(cardComments),
}));

export const cardMembersRelations = relations(cardMembers, ({ one }) => ({
  card: one(cards, {
    fields: [cardMembers.cardId],
    references: [cards.id],
  }),
  user: one(users, {
    fields: [cardMembers.userId],
    references: [users.id],
  }),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  board: one(boards, {
    fields: [tags.boardId],
    references: [boards.id],
  }),
  cardTags: many(cardTags),
}));

export const cardTagsRelations = relations(cardTags, ({ one }) => ({
  card: one(cards, {
    fields: [cardTags.cardId],
    references: [cards.id],
  }),
  tag: one(tags, {
    fields: [cardTags.tagId],
    references: [tags.id],
  }),
}));

export const cardAttachmentsRelations = relations(cardAttachments, ({ one }) => ({
  card: one(cards, {
    fields: [cardAttachments.cardId],
    references: [cards.id],
  }),
  uploader: one(users, {
    fields: [cardAttachments.uploadedBy],
    references: [users.id],
  }),
}));

export const cardChecklistsRelations = relations(cardChecklists, ({ one, many }) => ({
  card: one(cards, {
    fields: [cardChecklists.cardId],
    references: [cards.id],
  }),
  items: many(checklistItems),
}));

export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  checklist: one(cardChecklists, {
    fields: [checklistItems.checklistId],
    references: [cardChecklists.id],
  }),
}));

export const cardCommentsRelations = relations(cardComments, ({ one }) => ({
  card: one(cards, {
    fields: [cardComments.cardId],
    references: [cards.id],
  }),
  user: one(users, {
    fields: [cardComments.userId],
    references: [users.id],
  }),
}));

// ===== LEGACY TABLES (backward compatibility) =====
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => users.id),
  fileUrl: text("file_url").notNull(),
  fileName: varchar("file_name", { length: 500 }),
  fileSize: varchar("file_size", { length: 50 }),
  urgency: varchar("urgency", { length: 20 }).notNull().default("Normal"),
  dueDate: date("due_date"),
  status: varchar("status", { length: 50 }).notNull().default("Inbox"),
  description: text("description"),
  isArchived: varchar("is_archived", { length: 10 }).notNull().default("false"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;
