# LegadoTask - Client Upload Portal & Kanban Board

## Overview

LegadoTask is a role-based project management application that serves two distinct user types:

- **Admins**: Access a full-featured Kanban board system for managing tasks, boards, and team workflows
- **Clients**: Access a simplified upload portal for submitting large video files with metadata (urgency, deadline, notes)

The application acts as a "gateway" that routes authenticated users to the appropriate interface based on their role. Client uploads are converted into tasks that appear on admin Kanban boards.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with SWC for fast compilation
- **Routing**: React Router DOM v6 with role-based protected routes
- **State Management**: 
  - TanStack Query for server state
  - Custom store pattern (`src/lib/store.ts`) for local Kanban board state with pub/sub pattern
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Theme**: Dark mode preferred with next-themes support

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with tsx for development
- **API Pattern**: RESTful endpoints under `/api` prefix
- **File Uploads**: Multer with disk storage, 2GB limit for video files
- **Authentication**: Custom JWT-less session using bcryptjs for password hashing

### Client-Server Communication
- Vite dev server proxies `/api` and `/uploads` routes to Express backend (port 3001)
- Frontend runs on port 5000, backend on port 3001
- Concurrent development via `concurrently` package

### Database Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Key Tables**:
  - `users`: Role-based users (admin/client) with password auth using bcryptjs
  - `tasks`: Client submissions with file URLs, urgency, due dates, status; `clientId` is an integer foreign key referencing users.id
  - `profiles`: Extended user profile data
- **Demo Credentials**:
  - Admin: admin@demo.com / 1234 (routes to /kanban)
  - Client: client@demo.com / 123456 (routes to /client-portal)

### Role-Based Routing Pattern
- Login redirects based on `user.role` stored in localStorage
- Admins route to `/kanban` (board management)
- Clients route to `/client-portal` (file upload interface)
- Protected route wrapper validates role before rendering

### Kanban Board Features
- Drag-and-drop via @dnd-kit library
- Board/list/card hierarchy with CRUD operations
- Calendar view integration
- Trello import functionality
- Rich card details with attachments, checklists, comments
- **Mobile Optimization**: 
  - Trello-style single column view with horizontal snap scrolling
  - Column indicator dots at bottom for navigation
  - Touch-friendly 85vw column width
  - Responsive header with icon-only buttons on mobile

### Mobile Responsiveness
- Uses Tailwind `sm:` breakpoint (640px) for mobile-first design
- Client Portal: Compact header, touch-friendly dropzone, responsive form elements
- Kanban: Snap scrolling columns (`snap-x snap-mandatory`), column indicators
- Login: Adjusted logo size and spacing for smaller screens

## External Dependencies

### Database
- **PostgreSQL**: Primary database via `DATABASE_URL` environment variable
- Drizzle Kit for migrations (`db:push`, `db:generate`, `db:migrate`)

### File Storage
- Local disk storage in `uploads/` directory
- Files served statically via Express
- Supabase Storage integration for production (when credentials available)
- **Chunked Upload System**: For files >50MB, uploads are split into 10MB chunks
  - Endpoints: `/api/chunked-upload/init`, `/chunk/:index`, `/finalize`
  - **Parallel Uploads**: 4 chunks uploaded simultaneously for faster transfer
  - Supports pause/resume functionality
  - Automatic thumbnail generation for videos before upload
  - Chunks stored temporarily in `uploads/chunks/` directory

### Audio Transcription
- **OpenAI Whisper API** for accurate audio-to-text transcription
- Endpoint: `/api/transcribe-audio`
- Supports two modes:
  - `transcribe`: Full word-by-word transcription
  - `summarize`: Transcription + GPT-4o-mini summarization
- Requires `OPENAI_API_KEY` environment variable
- Supports MP3, WAV, M4A audio formats

### UI Component Libraries
- shadcn/ui (Radix primitives): Full suite of accessible components
- Lucide React: Icon library
- recharts: Chart/analytics components
- embla-carousel: Carousel functionality
- react-day-picker: Calendar/date picker
- vaul: Drawer component

### Form & Validation
- react-hook-form with @hookform/resolvers
- Zod for schema validation (via drizzle-zod)

### Drag & Drop
- @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities

### Date Handling
- date-fns with ptBR locale support