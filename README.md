# SalonBook — Backend API

SalonBook is a full-stack salon appointment booking platform designed to simplify salon service management, appointment scheduling, and online payments.

This repository contains the **backend REST API** for SalonBook, built with Node.js, Express.js, TypeScript, and MongoDB.

## Live Links

- **Live Website:** https://b14-a9-salon-book-client.vercel.app
- **Backend API:** https://salonbook-server-b6wo.onrender.com
- **API Health Check:** https://salonbook-server-b6wo.onrender.com/api/health

## Technologies Used

- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** MongoDB Atlas
- **Authentication:** Better Auth
- **Payment Gateway:** Stripe Checkout
- **Deployment:** Render
- **Additional Tools:** CORS, dotenv, Git, GitHub

## Key Features

### Authentication and Authorization
- User registration and login
- Secure authentication using Better Auth
- Session-based authentication
- Protected API endpoints
- Role-based access control for users and administrators

### Service Management
- Retrieve available salon services
- Manage service information
- Support administrative service management

### Appointment Management
- Create salon appointments
- View appointment history
- Manage appointment status
- Confirm and cancel appointments
- Access user-specific booking information

### Payment Integration
- Stripe Checkout integration
- Secure payment session creation
- Stripe webhook endpoint for payment events
- Payment status management

### Admin Management
- User management
- Appointment management
- Administrative access to protected operations

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | API welcome message |
| GET | `/api/health` | Server health check |
| ALL | `/api/auth/*` | Better Auth authentication routes |
| GET | `/api/me` | Get current authenticated user |
| — | `/api/services` | Salon service routes |
| — | `/api/appointments` | Appointment management routes |
| — | `/api/users` | User management routes |
| POST | `/api/payments/checkout` | Create Stripe Checkout session |
| POST | `/api/stripe/webhook` | Handle Stripe webhook events |

*Available HTTP methods for service, appointment, and user routes depend on their respective route definitions.*

## Project Structure

```text
b14-a9-salonbook-server/
├── src/
│   ├── config/
│   │   ├── auth.ts
│   │   └── db.ts
│   ├── routes/
│   │   ├── services.routes.ts
│   │   ├── appointments.routes.ts
│   │   ├── users.routes.ts
│   │   ├── payments.routes.ts
│   │   └── stripe-webhook.routes.ts
│   ├── app.ts
│   └── server.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Environment Variables

Create a `.env` file in the root directory and configure the following variables:

```env
PORT=5000
NODE_ENV=development

MONGODB_URI=your_mongodb_connection_string
DB_NAME=salonbook

BETTER_AUTH_SECRET=your_auth_secret
BETTER_AUTH_URL=http://localhost:5000
CLIENT_URL=http://localhost:3000

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

Never commit actual environment variables or secret keys to GitHub.

## Installation and Setup

**1. Clone the repository**

```bash
git clone https://github.com/GM-FARIHA-TASNIM/b14-a9-salonbook-server.git
cd b14-a9-salonbook-server
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

Create the `.env` file and provide the required credentials.

**4. Start the development server**

```bash
npm run dev
```

The backend runs locally at:

```text
http://localhost:5000
```

**5. Build for production**

```bash
npm run build
```

**6. Start the production server**

```bash
npm start
```

## Deployment

The backend is deployed on **Render**, with MongoDB Atlas as the cloud database.

Production configuration includes:

- Environment variables managed through Render
- MongoDB Atlas database connection
- Better Auth configuration for the deployed frontend
- CORS configuration for authorized frontend origins
- Stripe Checkout and webhook integration

## Security

- Environment-based secret management
- Session-based authentication
- Protected routes
- Role-based authorization
- CORS configuration
- Stripe webhook signature verification

## Frontend Integration

The frontend is developed using Next.js, TypeScript, and Tailwind CSS and deployed on Vercel.

Frontend URL:

https://b14-a9-salon-book-client.vercel.app

The frontend communicates with this backend through REST API requests.

## Author

**Fariha Tasnim**

Computer Science and Engineering  
Bangladesh Army International University of Science and Technology (BAIUST)

GitHub: https://github.com/GM-FARIHA-TASNIM

---

**SalonBook — Simplifying salon appointments and service management.**
