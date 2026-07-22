import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { config } from "./config.js";

let database: NeonQueryFunction<false, false> | null = null;

export function db(): NeonQueryFunction<false, false> {
  if (!database) database = neon(config.databaseUrl());
  return database;
}
