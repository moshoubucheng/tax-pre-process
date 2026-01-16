# Tax Pre-Process

税理士事務所向け領収書前処理システム

## Tech Stack

- **API**: Hono on Cloudflare Workers
- **Frontend**: React + Tailwind CSS on Cloudflare Pages
- **Database**: Cloudflare D1
- **Storage**: Cloudflare R2
- **AI**: Claude API (OCR & Chat)

## Setup

### 1. Prerequisites

- Node.js 20+
- Cloudflare Account
- Claude API Key

### 2. Install Dependencies

```bash
npm install
```

### 3. Cloudflare Setup

```bash
# Login to Cloudflare
npx wrangler login

# Create D1 database
npx wrangler d1 create tax-db

# Create R2 bucket
npx wrangler r2 bucket create tax-receipts
```

Update `api/wrangler.toml` with your D1 database ID.

### 4. Set Secrets

```bash
cd api

# Set Claude API key
npx wrangler secret put CLAUDE_API_KEY

# Set JWT secret (generate a random string)
npx wrangler secret put JWT_SECRET
```

### 5. Initialize Database

```bash
# Local development
npm run db:migrate -w api

# Production
npm run db:migrate:prod -w api
```

### 6. Development

```bash
# Start API (port 8787)
npm run dev:api

# Start Web (port 5173)
npm run dev:web
```

## Deployment

### GitHub Actions (Recommended)

1. Create GitHub repository
2. Add secret: `CLOUDFLARE_API_TOKEN`
3. Add variable: `API_URL` (your Workers URL)
4. Push to `main` branch

### Manual Deployment

```bash
# Deploy API
npm run deploy:api

# Build and deploy Web
npm run build:web
npx wrangler pages deploy ./web/dist --project-name=tax-pre-process
```

## Project Structure

```
├── api/                  # Cloudflare Workers API
│   ├── src/
│   │   ├── routes/       # API routes
│   │   ├── middleware/   # Auth middleware
│   │   ├── services/     # Business logic
│   │   ├── db/           # Database schema & queries
│   │   └── types/        # TypeScript types
│   └── wrangler.toml
│
├── web/                  # React Frontend
│   ├── src/
│   │   ├── pages/        # Page components
│   │   ├── components/   # Reusable components
│   │   ├── hooks/        # Custom hooks
│   │   └── lib/          # Utilities
│   └── vite.config.ts
│
└── .github/workflows/    # CI/CD
```

## License

MIT
