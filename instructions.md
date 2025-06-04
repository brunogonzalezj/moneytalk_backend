You are a highly experienced backend engineer with over 30 years of experience in Node.js, Express, TypeScript, MySQL, and Prisma ORM. Please create a production-ready backend application that aligns with the React frontend described above. The backend must meet the following requirements:

1. *Tech Stack & Tooling*
    - Node.js (v18+) with TypeScript.
    - Express.js (v4+) as the web framework.
    - Prisma ORM (v4+) for MySQL database modeling and migrations.
    - JWT-based authentication with refresh tokens (using jsonwebtoken).
    - Integration with OpenAI’s API (e.g., Whisper + GPT) for NLP categorization of transactions.
    - Usage of environment variables for secrets—provide a .env.example.

2. *Database Schema (Prisma Models)*
    - *User*:
        - id (Int, auto-increment, primary key)
        - email (String, unique)
        - passwordHash (String)
        - displayName (String)
        - createdAt, updatedAt (DateTime)
    - *Category*:
        - id (Int, auto-increment)
        - name (String, unique)
        - type (Enum: INCOME or EXPENSE)
        - createdAt (DateTime)
    - *Transaction*:
        - id (Int, auto-increment)
        - userId (Int, foreign key → User)
        - categoryId (Int, foreign key → Category)
        - amount (Decimal)
        - description (String)
        - date (DateTime)
        - createdAt, updatedAt (DateTime)

    - *RefreshToken*:
        - id (Int, auto-increment)
        - userId (Int, foreign key → User)
        - token (String, unique)
        - expiresAt (DateTime)

    - Generate initial migration and seed the Category table with sensible defaults (e.g., Food, Transport, Salary, Entertainment, Others).

3. *Folder Structure*
    - /src
        - /controllers (authController.ts, transactionController.ts, categoryController.ts, reportController.ts)
        - /services (authService.ts, transactionService.ts, categoryService.ts, reportService.ts, aiService.ts)
        - /middlewares (authMiddleware.ts, errorHandler.ts, validateRequest.ts)
        - /prisma (client.ts)
        - /routes (authRoutes.ts, transactionRoutes.ts, categoryRoutes.ts, reportRoutes.ts)
        - /utils (hashPassword.ts, comparePassword.ts, generateTokens.ts, validateEnv.ts)
        - /types (custom types/interfaces)
        - app.ts (Express app configuration)
        - server.ts (entry point that starts the server)
    - /prisma (schema.prisma, migrations folder)
    - .env.example
    - tsconfig.json
    - package.json

4. *Authentication & Authorization*
    - **Signup (POST /api/auth/signup):
        - Validate body (email, password, displayName).
        - Hash password with bcrypt (salt rounds ≥ 10).
        - Create user in database.
        - Generate accessToken (expires in 15m) and refreshToken (expires in 7d).
        - Save refreshToken in DB.
        - Return { accessToken, refreshToken, user: { id, email, displayName } }.

    - **Login (POST /api/auth/login):
        - Validate credentials.
        - On success, generate new tokens (invalidate old refresh token in DB).
        - Return new accessToken, refreshToken, user info.

    - **Refresh Token (POST /api/auth/refresh):
        - Validate refresh token from body.
        - If valid and not expired, issue new accessToken and refreshToken (invalidate old DB record).

    - *Auth Middleware* (authMiddleware.ts) to protect all /api/transactions, /api/reports, etc., by verifying JWT and attaching req.user = { id, email }.

5. *Transaction Endpoints*
    - **Create Transaction (POST /api/transactions):
        - Body: { amount: number, description: string, date: string (ISO), voiceText?: string }.
        - If voiceText is provided, call aiService.categorizeTransaction(voiceText) to return { categoryName, amountExtracted, descriptionExtracted } and override fields accordingly.
        - Look up or create the Category by categoryName (case-insensitive).
        - Create a new Transaction record.
        - Return the created transaction object.

    - **Get Transactions (GET /api/transactions?page=1&limit=20):
        - Paginated.
        - Use req.user.id to filter.
        - Return { data: Transaction[], pagination: { page, totalPages, totalCount } }.

    - **Update Transaction (PUT /api/transactions/:id):
        - Only allow if transaction.userId === req.user.id.
        - Validate updates.
        - Update fields.
        - Return updated transaction.

    - **Delete Transaction (DELETE /api/transactions/:id):
        - Same ownership check.
        - Soft-delete or permanent delete (choose one).
        - Return { success: true }.

6. *Category Endpoints*
    - **Get All Categories (GET /api/categories):
        - Return an array of categories (id, name, type).
    - **Create Category (POST /api/categories):
        - Only an admin user (assume a simple role flag on User → “role”).
        - Validate body { name, type }.
        - Insert into DB or return 409 if exists.

7. *Report Endpoint*
    - *GET /api/reports/summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD*:
        - Aggregate transactions for the authenticated user over the date range.
        - Return { totalIncome, totalExpense, byCategory: [ { categoryName, amount } ] }.

8. *AI Service Integration*
    - **aiService.ts**:
        - Function categorizeTransaction(voiceText: string): Promise<{ categoryName: string, amountExtracted: number, descriptionExtracted: string }>:
            - Call OpenAI Whisper (or equivalent) if needing transcription (pass-through if voiceText is already text).
            - Use GPT-powered request to classify the text into one of the existing categories (Food, Transport, Salary, Entertainment, Others).
            - Parse a JSON response from GPT that includes "category", "amount" (as a number), and "description".
            - Throw an error if the model cannot parse.

9. *Error Handling & Validation*
    - Global errorHandler middleware that sends { error: string, details?: any } on any uncaught exception.
    - Use a validateRequest middleware on all routes with Joi or Zod to enforce request schemas.
    - Return proper HTTP status codes (400 for validation errors, 401 for unauthorized, 403 for forbidden, 404 for not found, 500 for server errors).

10. *Security & Performance*
    - Rate-limit login and signup endpoints (e.g., 5 requests per minute) using express-rate-limit.
    - Helmet for basic HTTP header hardening.
    - CORS configured to allow only the frontend origin.
    - Data validation + type safety via TypeScript.
    - Prisma’s findMany calls should only select needed fields (avoid overfetch).
    - Use database connection pooling via Prisma defaults.

11. *Testing*
    - Write unit tests for at least two service functions (e.g., authService.signupUser and transactionService.createTransaction) using Jest.
    - Provide a simple integration test that spins up an in-memory MySQL (or a test container) to hit /api/auth/signup, /api/auth/login, and then create a transaction.

12. *Environment & Scripts*
    - .env.example showing:

      DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"
      JWT_ACCESS_SECRET="your_access_secret"
      JWT_REFRESH_SECRET="your_refresh_secret"
      OPENAI_API_KEY="your_openai_key"
      CORS_ORIGIN="http://localhost:5173"

    - package.json scripts:
        - dev: ts-node-dev src/server.ts
        - build: tsc
        - start: node dist/server.js
        - migrate: prisma migrate dev
        - seed: prisma db seed
        - test: jest --coverage

13. *Documentation*
    - README.md explaining:
        - How to install (npm install).
        - Environment setup (cp .env.example .env).
        - Running migrations (npm run migrate).
        - Seeding (npm run seed).
        - Starting dev server (npm run dev).
        - How to run tests (npm run test).

Ensure all TypeScript types/interfaces are correctly defined (e.g., UserPayload, TransactionPayload, etc.), and that Prisma’s generated client is used for all DB interactions. Follow best practices for file organization, error handling, and security. Do not include any actual secret values—only examples in .env.example.