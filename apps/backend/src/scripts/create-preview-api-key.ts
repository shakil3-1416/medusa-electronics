import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createApiKeysWorkflow } from "@medusajs/medusa/core-flows"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const TITLE = "Local real-catalog preview (development only)"
const ENV_KEY = "MEDUSA_PREVIEW_SECRET_KEY"

/**
 * Creates a secret API key for the storefront's development-only real-catalog
 * preview and writes it to the git-ignored apps/storefront/.env.local.
 * The token is never printed. Idempotent: an existing configured key is kept.
 * Revoke it in Admin > Settings > Secret API Keys when no longer needed.
 */
export default async function createPreviewApiKey({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  if (process.env.NODE_ENV === "production") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Preview keys are for local development only")
  }

  const envPath = resolve(process.cwd(), "../storefront/.env.local")
  const env = existsSync(envPath) ? readFileSync(envPath, "utf8") : ""
  if (new RegExp(`^${ENV_KEY}=sk_`, "m").test(env)) {
    logger.info(`${ENV_KEY} already configured in storefront .env.local; nothing to do`)
    return
  }

  const { result } = await createApiKeysWorkflow(container).run({
    input: { api_keys: [{ title: TITLE, type: "secret", created_by: "" }] },
  })
  const token = (result[0] as { token?: string }).token
  if (!token?.startsWith("sk_")) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Secret key token was not returned")
  }

  const lines = env
    .split("\n")
    .filter((l) => l && !l.startsWith(`${ENV_KEY}=`) && !l.startsWith("ENABLE_REAL_CATALOG_PREVIEW="))
  lines.push(
    "# Development-only real-catalog preview (server-side Admin API access). Never commit.",
    `${ENV_KEY}=${token}`,
    "ENABLE_REAL_CATALOG_PREVIEW=1"
  )
  writeFileSync(envPath, lines.join("\n") + "\n", { mode: 0o600 })
  logger.info(`Created secret API key "${TITLE}" and wrote it to storefront .env.local (not printed)`)
}
