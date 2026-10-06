# 💊 Pharma Desk — Intelligent Pharmacy Management Portal

Pharma Desk is a modern, full-stack MERN (MongoDB, Express, React, Node.js) web application designed for pharmacies to manage their inventory, billing, customers, and reminders. It features role-based access control, automated daily inventory checks, OCR-based smart medicine registration, PDF invoice generation, and dual-channel (email + browser) medication reminders.

---

## 🚀 Key Features

### 1. User Roles & Access Control
The application supports three roles, each with a tailored workspace and security checks:
*   **Superadmin**: Controls user management, system diagnostics, overall dashboards, and has override permissions.
*   **Pharmacist Portal**: A high-efficiency panel designed for pharmacy operators:
    *   **Dashboard**: Shows statistics like sales history (last 7 days chart), total stock count, expired batches, and expiring-soon lists.
    *   **Catalog Database Manager**: The add-medicine form is limited to medicine name, manufacturer, expiry date, purchase cost, sale cost, quantity, and rack. Stock labels are End Stock (0), Low Stock (1–4), Stock Available (5–20), and High Stock (over 20).
    *   **Expiry Watch**: Every medicine expiring within 180 days appears in the expiry list; the scheduler creates an advance alert six months before expiry and follows up with shorter-window alerts.
    *   **Invoice Worksheet**: An integrated point-of-sale compiler with per-unit purchase-cost snapshots, invoice-only sale-price overrides, editable quantities, discounts, and cash-only checkout. It records customer name and phone, supports registered customers and walk-in guests, and places the checkout action at the top of the sticky invoice panel.
    *   **Stock & returns**: Audited stock adjustments and partial sale returns update inventory with transactional writes. Return refunds honor invoice discounts, and profit reports use recorded purchase costs and actual sale prices.
    *   **Return history**: Fully returned invoices are omitted from regular customer and sales history. Their invoice and return audit records remain stored; staff can include them in the all-bills response with `GET /api/bills?includeReturned=true`. Partial returns show remaining quantities and net paid totals.
    *   **Medicine export**: Use **Export Excel** on the Medicine Inventory page to download the complete current medicine list using the stable name, manufacturer, expiry, purchase cost, sale cost, quantity, and rack columns.
    *   **Alerts & Reminders page**: A simplified, friendly dashboard listing daily automated checks (expired medicine, low stock, patient reminders) with "Run now" capabilities.
*   **Customer Portal**: A consumer-facing panel:
    *   **Medicine Shop**: A catalog to search, filter by category, and buy medicines.
    *   **Invoice History**: Lists past purchases with downloadable PDF receipts.
    *   **Medication Reminders**: Allows patients to set medication alarms (medicine name, time) to receive reminders.

### 2. OCR Smart Label Scanning
*   Utilizes **Tesseract.js** directly on the server to parse uploaded photos of medicine packages.
* Only recognized medicine-name patterns are used to pre-fill a name; ambiguous text is not guessed. Explicitly labeled decimal prices may be shown as suggestions, but unlabeled values and digit-only OCR output are never silently converted into decimal prices. Verify OCR results before saving.
*   The English OCR language model is installed with the server dependencies and loaded locally, so label recognition does not need to download its model when the pharmacy is offline.
* Medicine entry and bill item lookup support the current device's live browser camera or an image chooser. A phone camera works by opening the application in a supported mobile browser; a laptop browser cannot remotely control a phone camera over USB or Bluetooth. Live camera access requires user permission and a secure browser context (localhost is supported; LAN/mobile access generally requires HTTPS).

### 3. Compliance & Expiry Protection
*   The billing panel automatically detects if any medicine in the current invoice worksheet has expired.
*   Blocks the checkout action and displays a compliance warning banner to prevent illegal distribution of expired drugs.

### 4. Printable Receipts & Invoice History
*   Features a dedicated printable receipt page (`/pharmacist/receipt/:id`) configured with clean CSS print media queries.
*   Receipts (both print views and downloadable PDF documents) display the medicine's actual formatted **Expiry Date** (e.g. `Jan 2028`) instead of the compliance status text to meet auditing standards.

### 5. Dual-Channel Alerts & Reminders
*   **Daily Automated Reports**: Hourly background cron jobs check for expired items, low stock levels, and upcoming reminder times.
*   **Hourly SMTP Email Dispatcher**: Sends detailed emails to patients reminding them of their scheduled doses.
*   **Real-time Web Browser Notifications**: Triggers desktop notification banners inside the patient's browser when they have the application open.

---

## 🛠️ Technology Stack

### Frontend
*   **Core**: React 19, Vite (as build tool)
*   **Routing**: React Router DOM v6
*   **State & Queries**: TanStack React Query v5 (efficient server-state caching)
*   **Styling**: TailwindCSS v3 (for responsive design), Lucide React (for modern icons)
*   **Charts**: Recharts (for sales and billing graphs)

### Backend
*   **Runtime**: Node.js & Express
*   **Database**: MongoDB replica set & Mongoose ORM (transactions keep sales, returns, stock, and audit logs in sync)
*   **Authentication**: JSON Web Tokens (JWT) & Bcrypt.js (password hashing)
*   **OCR Parsing**: Tesseract.js
*   **Invoice Rendering**: PDFKit (dynamic PDF generation)
*   **Task Scheduling**: Node-Cron (for backend background processes)
*   **Email Engine**: Nodemailer (via SMTP)

---

## 📂 Project Structure

```
├── client/                      # React Frontend
│   ├── src/
│   │   ├── components/          # Reusable UI components (Navbar, Sidebar, etc.)
│   │   ├── context/             # AuthContext, ThemeContext
│   │   ├── hooks/               # Custom React hooks (useBrowserNotifications)
│   │   ├── pages/               # Page components (PharmacistDashboard, Login, etc.)
│   │   ├── App.jsx              # Main React routing configuration
│   │   └── index.css            # Styling core
│   └── package.json
├── server/                      # Node.js Express Backend
│   ├── config/                  # Database connections
│   ├── controllers/             # Request handlers (billing, medicines, notifications)
│   ├── middleware/              # JWT validation & RBAC checkers
│   ├── models/                  # Mongoose Schemas (User, Medicine, Bill, Notification, Reminder)
│   ├── routes/                  # API endpoints
│   ├── utils/                   # Notification scheduler, transporters, OCR scanning helpers
│   ├── seed.js                  # Database seeder script
│   ├── server.js                # Main server entrypoint
│   └── package.json
├── package.json                 # Monorepo root configurations & scripts
└── README.md
```

---

## ⚙️ Step-by-Step Installation & Setup Guide (For New / Different Systems)

This section provides comprehensive instructions for deploying, installing, and running **Pharma Desk** on any fresh Windows, macOS, or Linux system.

---

### Step 1: Install Prerequisites
Before running the application, make sure the target system has the following software installed:

1. **Node.js (LTS Version - v20.19 or higher; Node.js 22 or 24 LTS recommended)**
   * Download and install from [Node.js Official Website](https://nodejs.org/).
   * Verify installation in terminal/command prompt:
     ```bash
     node -v
     npm -v
     ```
2. **MongoDB Database Service** (Choose **Option A** or **Option B**):
   * **Option A: Local MongoDB (Recommended for offline/development)**
     * Download and install [MongoDB Community Server](https://www.mongodb.com/try/download/community).
     * Download and install [MongoDB Compass](https://www.mongodb.com/try/download/compass) (Graphical Interface to view database).
     * Ensure the MongoDB service is running (default port is `27017`).
   * **Option B: MongoDB Atlas (Cloud database)**
     * Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
     * Create a free cluster, whitelist your IP address (or select `0.0.0.0/0` for access from anywhere), and obtain your application connection string (e.g. `mongodb+srv://...`).

---

### Step 2: Environment Configuration (.env)
1. Go to the `server/` directory.
2. Duplicate or copy the `.env.example` file and rename it to `.env`.
3. Open `.env` in any text editor and fill in the configuration variables:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/pharmadesk?replicaSet=rs0&directConnection=true
JWT_ACCESS_SECRET=your_access_token_secret_here
JWT_REFRESH_SECRET=your_refresh_token_secret_here
CLIENT_URL=http://localhost:5173

# SMTP Configuration (Required for Medication Email Reminders)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
```

#### 💡 Environment Config Notes for Different Systems:
* **`MONGO_URI`**:
  * If running **local MongoDB**, configure `replication.replSetName: rs0` in `mongod.cfg`, restart MongoDB, and initiate the single-node replica set with `mongosh --eval "rs.initiate()"`. Then use `mongodb://127.0.0.1:27017/pharmadesk?replicaSet=rs0&directConnection=true` when running Node directly on Windows; direct connection avoids following the Docker-only replica-set hostname. Stock-changing sales and returns use MongoDB transactions and do not run against a standalone server.
  * The included Docker Compose setup configures and initializes its MongoDB service as a single-node replica set automatically.
  * If running **MongoDB Atlas cloud**, replace it with your Atlas connection string (e.g., `mongodb+srv://username:password@cluster.xxxx.mongodb.net/Sardar Medical Store?retryWrites=true&w=majority`).
* **`JWT Secrets`**:
  * You can generate high-entropy secure keys on any platform by executing this command in your terminal:
    ```bash
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    ```
* **`SMTP_USER` & `SMTP_PASS`**:
  * Required if you wish to test automated patient email notifications.
  * For **Gmail**, you cannot use your standard password due to security blocks. Enable **2-Step Verification** on the Google Account, navigate to Google App Passwords settings, generate a 16-character **App Password**, and use that string for `SMTP_PASS`.

---

### Step 3: Install Dependencies
Open your terminal (PowerShell, Command Prompt, or bash) in the **root directory** of the extracted project (where the root `package.json` is located) and run:

```bash
npm run install:all
```
*This script automatically runs npm installation inside the root directory, the frontend `client/` directory, and the backend `server/` directory.*

---

### Step 4: Seed Mock Data (Disposable Test Database Only)
WARNING: `npm run seed` deletes existing users, medicines, bills, reminders, and notifications before inserting demo data. Never run it on real pharmacy data. On a new empty database, the app automatically creates login accounts; use the seed script only with a disposable test database.

```bash
npm run seed
```

---

### Step 5: Run the Project
From the project root, run `npm run dev`. The predev check verifies the local MongoDB replica set is transaction-ready and starts the persistent Docker database only when needed. The launcher reuses healthy Pharma Desk services already running and starts only missing services; it does not kill processes using the required ports. Install dependencies once with `npm run install:all` first.

```bash
npm run dev
```

* **Frontend Client (React/Vite)**: Runs on **[http://localhost:5173](http://localhost:5173)**
* **Backend Server (Express API)**: Runs on **[http://localhost:5000](http://localhost:5000)**

Run `npm test` from the project root to execute the backend unit suite and the 5,000-record medicine-export test.

### Backups and restores

`npm run db:backup` creates timestamped and latest JSON snapshots of users, medicines, bills, reminders, notifications, stock adjustments, and Udhar records under `server/backups/`. Keep a copy on separate storage; a local backup is not protection against disk loss. Restore with `npm run db:restore -- <backup-file>`. Restore validates the archive checksum when present, creates a pre-restore backup, and replaces included collections inside a MongoDB transaction. Use a replica-set MongoDB deployment (the included Docker Compose setup provides one); never test restore against the live pharmacy database. Older backups that do not contain stock-adjustment or Udhar collections leave those collections untouched.

---

## 🧪 Test Accounts
After running the seeder script (`npm run seed`), you can log in using the following pre-configured credentials:

* **Superadmin**: `aheerdawood014@gmail.com` / `Dawood@@5786`
* **Pharmacist**: `mlksardar6@gmail.com` / `Dawood@@5786`
* **Customer**: `aheerraza0@gmail.com` / `Dawood@@5786`
