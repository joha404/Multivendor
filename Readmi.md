# 🛒 Multivendor E-commerce Platform

A multivendor e-commerce platform (Website + App) where the platform owner sells products directly, and verified third-party sellers can also list and sell products through the same marketplace.

একটি মাল্টিভেন্ডর ই-কমার্স প্ল্যাটফর্ম (ওয়েবসাইট + অ্যাপ), যেখানে প্ল্যাটফর্মের মালিক নিজে সরাসরি প্রোডাক্ট বিক্রি করেন, এবং একইসাথে ভেরিফাইড থার্ড-পার্টি সেলাররাও একই মার্কেটপ্লেসের মাধ্যমে প্রোডাক্ট বিক্রি করতে পারেন।

---

## 📌 Key Concept | মূল কনসেপ্ট

> **Sellers do not create products.** Admin owns the entire product catalog (Product + Category + Variant). A Seller can only browse the existing catalog and create a **Seller Listing** — their own price & stock — against an existing product variant. Think Amazon/Daraz's "Sold by" / "Buy Box" model.

> **সেলার নিজে প্রোডাক্ট তৈরি করতে পারে না।** পুরো প্রোডাক্ট ক্যাটালগ (Product + Category + Variant) Admin নিয়ন্ত্রণ করে। একজন Seller শুধু এক্সিস্টিং ক্যাটালগ ব্রাউজ করে একটা variant-এর বিপরীতে নিজের দাম ও স্টক দিয়ে **Seller Listing** তৈরি করতে পারে — অনেকটা Amazon/Daraz-এর "Sold by"/"Buy Box" মডেলের মতো।

---

## ✨ Features | ফিচারসমূহ

- Role-based access: Super Admin, Admin, Moderator, Seller, General User
- Email-code verification before an account is created
- Unlimited-depth Category tree (Category → Sub-category → Sub-sub-category...)
- Dynamic variant/attribute system (Color, Size, Weight, etc.) — no code change needed to add new attribute types
- Admin-owned product catalog; Sellers list against it (price/stock only)
- Seller onboarding with document verification
- Seller Listing approval workflow (anti-scam/anti-fraud)
- "Request New Product" flow for sellers
- Multi-seller cart & orders (auto split into per-seller sub-orders)
- Payment integration (SSLCommerz / bKash / Stripe)
- Commission & payout tracking per seller
- Reviews, wishlist, notifications
- Full audit logging for Admin/Moderator actions

---

## 🧰 Tech Stack | টেক স্ট্যাক

| Layer                        | Technology                           |
| ---------------------------- | ------------------------------------ |
| Frontend (Web)               | React, Redux Toolkit, Tailwind CSS   |
| Frontend (App)               | React Native                         |
| Backend                      | Node.js, Express.js                  |
| ORM                          | Prisma                               |
| Database                     | PostgreSQL                           |
| Auth                         | JWT (Access + Refresh Token), bcrypt |
| File Storage                 | Cloudinary / AWS S3                  |
| Payment                      | SSLCommerz / bKash / Stripe          |
| Caching (optional)           | Redis                                |
| Search (optional, for scale) | Meilisearch / Elasticsearch          |

---

## 👤 User Roles | ইউজার রোল

| Role             | Summary                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| **Super Admin**  | Full unrestricted access. Creates Admins, overrides any decision.                                  |
| **Admin**        | Manages Moderators/Sellers, Category/Product/Variant catalog, Users, reports.                      |
| **Moderator**    | Verifies sellers, approves/rejects Seller Listings, processes orders, handles complaints/returns.  |
| **Seller**       | Verified vendor. Lists (never creates) products with own price/stock. Views own orders & earnings. |
| **General User** | Guest/unassigned-role user with browsing access only.                                              |

Full permission matrix: see [`docs/multivendor-ecommerce-doc.md`](./multivendor-ecommerce-doc.md).

---

## 🗂️ Project Structure | প্রজেক্ট স্ট্রাকচার

```
src/
 ├── config/              # env, database connection
 ├── middlewares/          # auth, role-check (authorize), error handler
 ├── modules/
 │    ├── auth/
 │    ├── user/
 │    ├── category/
 │    ├── product/            # Admin-only catalog CRUD
 │    ├── variant/            # VariantAttribute / VariantAttributeValue
 │    ├── seller/             # SellerProfile, verification
 │    ├── sellerListing/       # Seller price/stock listings + approval
 │    ├── productRequest/      # Seller → Admin "add new product" requests
 │    ├── cart/
 │    ├── wishlist/
 │    ├── order/
 │    ├── payment/
 │    ├── review/
 │    ├── commission/
 │    ├── payout/
 │    └── notification/
 ├── utils/
 ├── app.ts
 └── server.ts

prisma/
 └── schema.prisma
```

Each module follows: `*.route.ts` → `*.controller.ts` → `*.service.ts` → `*.validation.ts`.

---

## 🚀 Getting Started | শুরু করবেন যেভাবে

### 1. Clone & install

```bash
git clone <your-repo-url>
cd <project-folder>
npm install
```

### 2. Environment variables

Create a `.env` file in the root:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/<db_name>?schema=public"

# Auth
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Email (use either SMTP_* or Gmail app-password credentials)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
# GMAIL_USERNAME=your-address@gmail.com
# GMAIL_PASSWORD=your-google-app-password

# File storage (Cloudinary example)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Payment (fill whichever you use)
SSLCOMMERZ_STORE_ID=
SSLCOMMERZ_STORE_PASSWORD=
BKASH_APP_KEY=
BKASH_APP_SECRET=
```

### 3. Set up the database

```bash
npx prisma migrate dev --name init
npx prisma generate
```

For an existing database, create a migration that maps any legacy `BUYER` role values to `GENERAL_USER` before applying the enum change.

### 4. Email-verified registration

Codes expire after 10 minutes and allow five incorrect attempts. Verification-code resend has a 60-second cooldown.

| Method | Endpoint | Request body | Purpose |
| --- | --- | --- | --- |
| POST | `/api/users` | `name`, `email`, `password`, optional `phone` | Starts registration and emails a code; it does not create an account yet. |
| POST | `/api/users/verify-email` | `email`, `code` | Verifies the registration code and creates a `GENERAL_USER` account. |
| POST | `/api/users/resend-verification-code` | `email` | Sends a fresh registration verification code. |
| POST | `/api/users/forgot-password` | `email` | Emails a password-reset code if the account exists. |
| POST | `/api/users/reset-password` | `email`, `code`, `password` | Verifies the reset code and changes the password. |

### 5. Run the server

```bash
npm run dev
```

---

## 📜 Suggested npm Scripts | প্রস্তাবিত স্ক্রিপ্ট

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "prisma:generate": "prisma generate"
  }
}
```

---

## 🔐 Core Rule to Enforce in Code | কোডে অবশ্যই মানতে হবে এমন নিয়ম

> Sellers must **never** be able to write directly to `Product` or `ProductVariant` — only to `SellerListing`. Enforce this with role middleware (`authorize('ADMIN', 'SUPER_ADMIN')`) on the `/api/products` and `/api/variants` routes, not just in the frontend UI.

> সেলার যেন **কখনোই** সরাসরি `Product` বা `ProductVariant`-এ লিখতে না পারে — শুধু `SellerListing`-এ পারবে। এটা `/api/products` ও `/api/variants` রুটে role middleware (`authorize('ADMIN', 'SUPER_ADMIN')`) দিয়ে এনফোর্স করুন, শুধু frontend UI দিয়ে না।

---

## 🗺️ Development Roadmap | ডেভেলপমেন্ট রোডম্যাপ

1. Auth + role management + DB schema
2. Category / Variant system + Product CRUD (Admin only)
3. Seller onboarding & verification
4. Seller Listing (create/approve) + Product Request flow
5. Cart, Checkout, Order flow, Payment integration
6. Moderator dashboard, order fulfillment, disputes
7. Reviews, Wishlist, Notifications
8. Commission / Payout system
9. Admin analytics & reports
10. Mobile app (React Native, reusing the same API)
11. Performance: Redis caching, dedicated search engine, load testing

---

## 📄 Related Docs | সংশ্লিষ্ট ডকুমেন্ট

- [`multivendor-ecommerce-doc.md`](./multivendor-ecommerce-doc.md) — full project documentation (roles, workflows, API structure)
- [`schema.prisma`](./schema.prisma) — full database schema

---

## 📃 License

MIT (or your preferred license — update as needed).
