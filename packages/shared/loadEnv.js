import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Locate repo root: packages/shared/loadEnv.js -> ../../.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, "../../.env");

dotenv.config({ path: rootEnvPath });
