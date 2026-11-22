import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { db, mongoClient } from "./db.js";

const isProduction = process.env.NODE_ENV === "production";

const clientURL = (process.env.CLIENT_URL || "http://localhost:3000").replace(
  /\/+$/,
  "",
);

const serverURL = (
  process.env.BETTER_AUTH_URL || "http://localhost:5000"
).replace(/\/+$/, "");

export const auth = betterAuth({
  appName: "SalonBook",

  baseURL: serverURL,

  database: mongodbAdapter(db, {
    client: mongoClient,
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },

  socialProviders:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {},

  trustedOrigins: isProduction
    ? [clientURL]
    : [clientURL, "http://localhost:3000"],

  advanced: {
    useSecureCookies: isProduction,

    defaultCookieAttributes: {
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      httpOnly: true,
      path: "/",
    },
  },
});
