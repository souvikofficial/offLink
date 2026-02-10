# offLink

**offLink** is a robust, offline-first location tracking system designed to work reliably in challenging network conditions. It features a mobile application for data collection and a web dashboard for real-time monitoring and administration.

## 🚀 Features

- **Offline-First Architecture**: Seamlessly collects location data even without an internet connection, syncing automatically when connectivity is restored.
- **Real-Time Tracking**: Monitor device locations in real-time through a responsive web dashboard.
- **Cross-Platform Mobile App**: Built with Capacitor and React to run on both Android and iOS.
- **Data Retention Policies**: Automated cleanup of old location data to manage storage efficiently.
- **Secure Authentication**: JWT-based authentication ensures data security and privacy.

## 📂 Project Structure

This monorepo is organized into three main workspaces:

- **`client-mobile`**: The mobile application built with Vite, React, and Capacitor. Handles background location tracking, local SQLite storage, and data synchronization.
- **`client-web`**: The administrative dashboard built with Next.js. Provides interfaces for user management, device monitoring, and data visualization.
- **`server`**: The backend API built with NestJS and Prisma. Manages database interactions, authentication, and API endpoints.

## 🛠️ Tech Stack

- **Frontend**: React, Next.js, TailwindCSS
- **Mobile**: Capacitor, Ionic/React, SQLite
- **Backend**: NestJS, PostgreSQL (via Prisma), Passport (JWT)
- **Tools**: TypeScript, ESLint, Prettier

## 🏁 Getting Started

### Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [PostgreSQL](https://www.postgresql.org/)
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/offLink.git
    cd offLink
    ```

2.  **Install dependencies for all workspaces:**
    ```bash
    # Install server dependencies
    cd server
    npm install

    # Install web client dependencies
    cd ../client-web
    npm install

    # Install mobile client dependencies
    cd ../client-mobile
    npm install
    ```

### ⚙️ Environment Configuration

Create `.env` files in the respective directories based on the examples below.

#### Server (`server/.env`)
```env
# Database Connection
DATABASE_URL="postgresql://user:password@localhost:5432/offlink_db?schema=public"

# Application Port
PORT=3000

# JWT Secret
JWT_SECRET="your-super-secret-key"

# Data Retention (in days)
RETENTION_DAYS=30
```

#### Web Client (`client-web/.env.local`)
```env
# API URL
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

#### Mobile Client (`client-mobile/.env`)
*Note: Mobile client configuration might require rebuilding the app to take effect.*
```env
VITE_API_URL="http://YOUR_LOCAL_IP:3000"
```

### 🏃‍♂️ Running the Project

#### 1. Start the Server
```bash
cd server
npx prisma migrate dev  # Run database migrations
npm run start:dev
```
The server will start on `http://localhost:3000`.

#### 2. Start the Web Dashboard
```bash
cd client-web
npm run dev
```
The dashboard will be available at `http://localhost:3001` (or next available port).

#### 3. Run the Mobile App
**For Browser Development:**
```bash
cd client-mobile
npm run dev
```

**For Android:**
```bash
cd client-mobile
npm run build
npx cap sync
npx cap open android
```
*Run the app from Android Studio.*

**For iOS:**
```bash
cd client-mobile
npm run build
npx cap sync
npx cap open ios
```
*Run the app from Xcode.*

## 🤝 Contribution

Contributions are welcome! Please fork the repository and submit a pull request.

## 📄 License

This project is licensed under the [MIT License](LICENSE).
