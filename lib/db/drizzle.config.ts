import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  // Use a forward-slash glob so drizzle-kit resolves schema files reliably on Windows.
  schema: path.resolve(__dirname, "./src/schema/*.ts").replaceAll("\\", "/"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
