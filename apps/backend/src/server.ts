import "dotenv/config"

import crypto from "crypto"
import fs from "fs"
import path from "path"
import express, { type Request, type Response, type NextFunction } from "express"
import cors from "cors"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"

const app = express()
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000
const HOST = process.env.HOST || "127.0.0.1"

const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID || ""
const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET || ""
const NOTION_TOKEN_STORE_PATH = process.env.NOTION_TOKEN_STORE_PATH || ""
const NOTION_TOKEN_ENC_KEY = process.env.NOTION_TOKEN_ENC_KEY || ""
const NOTION_EXTENSION_REDIRECT_ORIGIN = process.env.NOTION_EXTENSION_REDIRECT_ORIGIN || ""
const AUDIT_LOG_PATH = process.env.AUDIT_LOG_PATH || ""
const NOTION_RATE_LIMIT = Number(process.env.NOTION_RATE_LIMIT || 30)
const NOTION_RATE_WINDOW_MS = Number(process.env.NOTION_RATE_WINDOW_MS || 60_000)
const NOTION_MAX_CONTENT_CHARS = Number(process.env.NOTION_MAX_CONTENT_CHARS || 20_000)

const NOTION_TOKEN_URL = "https://api.notion.com/v1/oauth/token"
const NOTION_REVOKE_URL = "https://api.notion.com/v1/oauth/revoke"
const NOTION_API_BASE = "https://api.notion.com/v1"
const NOTION_API_VERSION = "2022-06-28"

const jsonParser = express.json({ limit: "200kb" })

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true)
        return
      }
      if (allowedOrigins.length === 0) {
        callback(null, true)
        return
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error("Origin not allowed"))
    }
  })
)

if (allowedOrigins.length === 0) {
  console.warn("CORS_ALLOWED_ORIGINS is not set; API requests will be accepted from any origin.")
}
if (!NOTION_CLIENT_ID || !NOTION_CLIENT_SECRET) {
  console.warn("NOTION_CLIENT_ID or NOTION_CLIENT_SECRET not set; Notion OAuth endpoints will fail until configured.")
}

app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (err?.message === "Origin not allowed") {
    res.status(403).json({ success: false, error: "Origin not allowed." })
    return
  }
  next(err)
})

interface TokenRecord {
  accessToken: string
  workspaceId?: string
  workspaceName?: string
  botId?: string
  pageId?: string
  createdAt: number
  lastUsedAt: number
  keyHash: string
}

const tokenStore = new Map<string, TokenRecord>()
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

const parseEncryptionKey = (value: string) => {
  if (!value) return null
  const trimmed = value.trim()
  const asBase64 = Buffer.from(trimmed, "base64")
  if (asBase64.length === 32) return asBase64
  const asHex = Buffer.from(trimmed, "hex")
  if (asHex.length === 32) return asHex
  return null
}

const encryptionKey = parseEncryptionKey(NOTION_TOKEN_ENC_KEY)
const persistTokens = Boolean(NOTION_TOKEN_STORE_PATH && encryptionKey)

if (NOTION_TOKEN_STORE_PATH && !encryptionKey) {
  console.warn("NOTION_TOKEN_STORE_PATH set without NOTION_TOKEN_ENC_KEY; tokens will not persist.")
}

const encryptPayload = (plaintext: string) => {
  if (!encryptionKey) return ""
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext]).toString("base64")
}

const decryptPayload = (payload: string) => {
  if (!encryptionKey) return ""
  const data = Buffer.from(payload, "base64")
  const iv = data.subarray(0, 12)
  const tag = data.subarray(12, 28)
  const ciphertext = data.subarray(28)
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}

const loadTokenStore = () => {
  if (!persistTokens) return
  if (!NOTION_TOKEN_STORE_PATH) return
  if (!fs.existsSync(NOTION_TOKEN_STORE_PATH)) return
  try {
    const raw = fs.readFileSync(NOTION_TOKEN_STORE_PATH, "utf8")
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (parsed?.v !== 1 || typeof parsed.payload !== "string") return
    const decrypted = decryptPayload(parsed.payload)
    if (!decrypted) return
    const data = JSON.parse(decrypted)
    const entries: [string, TokenRecord][] = data?.records || []
    entries.forEach(([key, record]) => tokenStore.set(key, record))
  } catch (error) {
    console.error("Failed to load token store:", error)
  }
}

let persistQueue = Promise.resolve()
const persistTokenStore = () => {
  if (!persistTokens || !NOTION_TOKEN_STORE_PATH) return
  const payload = JSON.stringify({ v: 1, records: Array.from(tokenStore.entries()) })
  const encrypted = encryptPayload(payload)
  if (!encrypted) return
  persistQueue = persistQueue
    .then(() => fs.promises.mkdir(path.dirname(NOTION_TOKEN_STORE_PATH), { recursive: true }))
    .then(() => fs.promises.writeFile(NOTION_TOKEN_STORE_PATH, JSON.stringify({ v: 1, payload: encrypted }), { mode: 0o600 }))
    .catch((error) => console.error("Failed to persist token store:", error))
}

loadTokenStore()

let auditQueue = Promise.resolve()
const appendAuditLog = (entry: Record<string, unknown>) => {
  const baseEntry = {
    ts: new Date().toISOString(),
    ...entry
  }
  const line = JSON.stringify(baseEntry)
  if (!AUDIT_LOG_PATH) {
    console.info(line)
    return
  }
  auditQueue = auditQueue
    .then(() => fs.promises.mkdir(path.dirname(AUDIT_LOG_PATH), { recursive: true }))
    .then(() => fs.promises.appendFile(AUDIT_LOG_PATH, line + "\n", { mode: 0o600 }))
    .catch((error) => console.error("Audit log write failed:", error))
}

const hashClientKey = (key: string) => crypto.createHash("sha256").update(key).digest("hex")

const isValidClientId = (value: string) => /^[0-9a-f-]{36}$/i.test(value)
const isValidClientKey = (value: string) => typeof value === "string" && value.length >= 40 && value.length <= 128

const verifyClient = (clientId: string, clientKey: string) => {
  const record = tokenStore.get(clientId)
  if (!record) return null
  const incoming = Buffer.from(hashClientKey(clientKey), "hex")
  const stored = Buffer.from(record.keyHash, "hex")
  if (incoming.length !== stored.length) return null
  if (!crypto.timingSafeEqual(incoming, stored)) return null
  return record
}

const normalizeNotionPageId = (value: string) => value.replace(/[^a-f0-9]/gi, "")

const isValidNotionPageId = (value: string) => normalizeNotionPageId(value).length === 32

const enforceRateLimit = (clientId: string) => {
  const now = Date.now()
  const existing = rateLimitMap.get(clientId)
  if (!existing || now > existing.resetAt) {
    rateLimitMap.set(clientId, { count: 1, resetAt: now + NOTION_RATE_WINDOW_MS })
    return true
  }
  if (existing.count >= NOTION_RATE_LIMIT) return false
  existing.count += 1
  return true
}

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 8000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

const notionHeaders = (token: string) => ({
  "Authorization": `Bearer ${token}`,
  "Content-Type": "application/json",
  "Notion-Version": NOTION_API_VERSION
})

const formatSourceUrl = (sourceUrl?: string | null) => {
  if (!sourceUrl) return null
  try {
    const parsed = new URL(sourceUrl)
    return parsed.toString()
  } catch {
    return null
  }
}

const buildNotionPayload = (content: string, sourceUrl?: string | null) => ({
  children: [
    {
      object: "block",
      type: "quote",
      quote: {
        rich_text: [{ type: "text", text: { content } }]
      }
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          { type: "text", text: { content: "Source: " } },
          { type: "text", text: { content: sourceUrl || "Web", link: sourceUrl ? { url: sourceUrl } : null } }
        ],
        color: "gray"
      }
    }
  ]
})

const getRequestId = (req: Request) => {
  const header = req.headers["x-request-id"]
  if (typeof header === "string" && header.trim()) return header.trim()
  return crypto.randomUUID()
}

// Initialize MCP Server
const server = new Server(
  {
    name: "toss-gateway",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
)

const transports = new Map<string, SSEServerTransport>()

// Register Tools
const listTools = () => ({
  tools: [
    {
      name: "notion_append",
      description: "Append text to a Notion page via server-side OAuth.",
      inputSchema: {
        type: "object",
        properties: {
          clientId: { type: "string" },
          clientKey: { type: "string" },
          content: { type: "string" },
          sourceUrl: { type: "string" }
        },
        required: ["clientId", "clientKey", "content"]
      }
    }
  ]
})

const handleNotionAppend = async (args: any) => {
  const { clientId, clientKey, content, sourceUrl } = args
  if (!clientId || !clientKey || !content) {
    throw new Error("Missing clientId, clientKey, or content")
  }
  if (!isValidClientId(clientId) || !isValidClientKey(clientKey)) {
    throw new Error("Reconnect Notion to save references.")
  }
  const record = verifyClient(clientId, clientKey)
  if (!record) {
    throw new Error("Reconnect Notion to save references.")
  }
  if (!record.pageId) {
    throw new Error("Set a Notion page to save references.")
  }

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Content is required")
  }
  if (content.length > NOTION_MAX_CONTENT_CHARS) {
    throw new Error("Content exceeds size limit")
  }

  if (!enforceRateLimit(clientId)) {
    throw new Error("Notion is having trouble right now. Try again.")
  }

  const resolvedSource = formatSourceUrl(sourceUrl)
  const payload = buildNotionPayload(content, resolvedSource)

  appendAuditLog({
    event: "notion.mcp.append.start",
    clientId,
    pageId: record.pageId,
    contentLength: content.length,
    contentHash: crypto.createHash("sha256").update(content).digest("hex"),
    sourceHost: sanitizeSourceHost(resolvedSource)
  })

  try {
    const response = await fetchWithTimeout(`${NOTION_API_BASE}/blocks/${record.pageId}/children`, {
      method: "PATCH",
      headers: notionHeaders(record.accessToken),
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      appendAuditLog({
        event: "notion.mcp.append.failed",
        clientId,
        pageId: record.pageId,
        status: response.status
      })
      throw new Error("Notion is having trouble right now. Try again.")
    }

    record.lastUsedAt = Date.now()
    tokenStore.set(clientId, record)
    persistTokenStore()

    appendAuditLog({
      event: "notion.mcp.append.success",
      clientId,
      pageId: record.pageId
    })

    return {
      content: [{ type: "text", text: "Saved reference." }]
    }
  } catch (err: any) {
    appendAuditLog({
      event: "notion.mcp.append.error",
      clientId,
      pageId: record.pageId,
      error: err?.message || "unknown"
    })
    return {
      isError: true,
      content: [{ type: "text", text: "Couldn't save reference." }]
    }
  }
}

const callTool = async (request: any) => {
  if (request.params.name === "notion_append") {
    return await handleNotionAppend(request.params.arguments as any)
  }
  throw new Error("Tool not found")
}

server.setRequestHandler(ListToolsRequestSchema, async () => listTools())
server.setRequestHandler(CallToolRequestSchema, async (request) => callTool(request))

const readJsonBody = async (req: Request) => {
  let body = ""
  req.setEncoding("utf8")
  for await (const chunk of req) {
    body += chunk
  }
  if (!body) {
    throw new Error("Empty request body")
  }
  return JSON.parse(body)
}

const buildErrorResponse = (id: unknown, code: number, message: string) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message }
})

const requireNotionConfig = () => {
  if (!NOTION_CLIENT_ID || !NOTION_CLIENT_SECRET) {
    return "Notion is having trouble right now. Try again."
  }
  return null
}

const validateRedirect = (redirectUri: string) => {
  if (!NOTION_EXTENSION_REDIRECT_ORIGIN) return true
  try {
    const parsed = new URL(redirectUri)
    return parsed.origin === NOTION_EXTENSION_REDIRECT_ORIGIN
  } catch {
    return false
  }
}

const sanitizeSourceHost = (sourceUrl?: string | null) => {
  if (!sourceUrl) return null
  try {
    return new URL(sourceUrl).host
  } catch {
    return null
  }
}

// SSE Transport Endpoint for Extensions
app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res)
  transports.set(transport.sessionId, transport)
  res.on("close", () => {
    transports.delete(transport.sessionId)
  })
  await server.connect(transport)
})

app.post("/messages", async (req, res) => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : null
  if (sessionId) {
    const transport = transports.get(sessionId)
    if (!transport) {
      res.status(404).send("Unknown session")
      return
    }
    await transport.handlePostMessage(req, res)
    return
  }

  let message: any
  try {
    message = await readJsonBody(req)
  } catch (error: any) {
    res.status(400).json(buildErrorResponse(null, -32600, error.message))
    return
  }

  if (!message || typeof message !== "object" || !message.method) {
    res.status(400).json(buildErrorResponse(message?.id, -32600, "Invalid JSON-RPC request"))
    return
  }

  try {
    if (message.method === "tools/list") {
      const parsed = ListToolsRequestSchema.safeParse(message)
      if (!parsed.success) {
        res.status(400).json(buildErrorResponse(message.id, -32600, "Invalid tools/list request"))
        return
      }
      res.json({ jsonrpc: "2.0", id: message.id ?? null, result: listTools() })
      return
    }

    if (message.method === "tools/call") {
      const parsed = CallToolRequestSchema.safeParse(message)
      if (!parsed.success) {
        res.status(400).json(buildErrorResponse(message.id, -32600, "Invalid tools/call request"))
        return
      }
      const request = parsed.data
      const result = await callTool(request)
      res.json({ jsonrpc: "2.0", id: message.id ?? null, result })
      return
    }

    res.status(404).json(buildErrorResponse(message.id, -32601, "Method not found"))
  } catch (error: any) {
    res.status(500).json(buildErrorResponse(message.id, -32603, error.message))
  }
})

app.post("/notion/oauth/exchange", jsonParser, async (req, res) => {
  const requestId = getRequestId(req)
  const { code, redirectUri, clientId, clientKey } = req.body ?? {}

  if (!code || !redirectUri || !clientId || !clientKey) {
    res.status(400).json({ success: false, error: "Notion is having trouble right now. Try again." })
    return
  }
  if (!isValidClientId(clientId) || !isValidClientKey(clientKey)) {
    res.status(400).json({ success: false, error: "Reconnect Notion to save references." })
    return
  }

  if (!validateRedirect(redirectUri)) {
    res.status(400).json({ success: false, error: "Notion is having trouble right now. Try again." })
    return
  }

  const configError = requireNotionConfig()
  if (configError) {
    res.status(500).json({ success: false, error: configError })
    return
  }

  appendAuditLog({
    event: "notion.oauth.exchange.start",
    requestId,
    clientId
  })

  try {
    const encoded = Buffer.from(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`).toString("base64")
    const tokenRes = await fetchWithTimeout(NOTION_TOKEN_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${encoded}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri
      })
    })

    const data = await tokenRes.json().catch(() => ({}))
    if (!tokenRes.ok || !data?.access_token) {
      appendAuditLog({
        event: "notion.oauth.exchange.failed",
        requestId,
        clientId,
        status: tokenRes.status
      })
      res.status(400).json({ success: false, error: "Notion is having trouble right now. Try again." })
      return
    }

    const record: TokenRecord = {
      accessToken: data.access_token,
      workspaceId: data.workspace_id,
      workspaceName: data.workspace_name,
      botId: data.bot_id,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      keyHash: hashClientKey(clientKey)
    }

    tokenStore.set(clientId, record)
    persistTokenStore()

    appendAuditLog({
      event: "notion.oauth.exchange.success",
      requestId,
      clientId,
      workspaceId: data.workspace_id || null
    })

    res.json({ success: true, workspaceName: data.workspace_name || "" })
  } catch (error: any) {
    appendAuditLog({
      event: "notion.oauth.exchange.error",
      requestId,
      clientId,
      error: error?.message || "unknown"
    })
    res.status(500).json({ success: false, error: "Notion is having trouble right now. Try again." })
  }
})

app.post("/notion/status", jsonParser, (req, res) => {
  const { clientId, clientKey } = req.body ?? {}
  if (!clientId || !clientKey) {
    res.status(400).json({ success: false, error: "Reconnect Notion to save references." })
    return
  }
  if (!isValidClientId(clientId) || !isValidClientKey(clientKey)) {
    res.status(400).json({ success: false, error: "Reconnect Notion to save references." })
    return
  }
  const record = verifyClient(clientId, clientKey)
  if (!record) {
    res.json({ connected: false })
    return
  }
  res.json({ connected: true, workspaceName: record.workspaceName || "", pageIdSet: Boolean(record.pageId) })
})

app.post("/notion/test", jsonParser, async (req, res) => {
  const requestId = getRequestId(req)
  const { clientId, clientKey, pageId } = req.body ?? {}

  if (!clientId || !clientKey || !pageId) {
    res.status(400).json({ success: false, error: "Set a Notion page to save references." })
    return
  }
  if (!isValidClientId(clientId) || !isValidClientKey(clientKey)) {
    res.status(400).json({ success: false, error: "Reconnect Notion to save references." })
    return
  }

  const record = verifyClient(clientId, clientKey)
  if (!record) {
    res.status(401).json({ success: false, error: "Reconnect Notion to save references." })
    return
  }

  if (!enforceRateLimit(clientId)) {
    res.status(429).json({ success: false, error: "Notion is having trouble right now. Try again." })
    return
  }

  const normalizedPageId = normalizeNotionPageId(pageId)
  if (!isValidNotionPageId(pageId)) {
    res.status(400).json({ success: false, error: "Set a Notion page to save references." })
    return
  }

  appendAuditLog({
    event: "notion.test.start",
    requestId,
    clientId,
    pageId: normalizedPageId
  })

  try {
    const response = await fetchWithTimeout(`${NOTION_API_BASE}/blocks/${normalizedPageId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${record.accessToken}`,
        "Notion-Version": NOTION_API_VERSION
      }
    })

    if (!response.ok) {
      appendAuditLog({
        event: "notion.test.failed",
        requestId,
        clientId,
        pageId: normalizedPageId,
        status: response.status
      })
      res.status(400).json({ success: false, error: "Notion is having trouble right now. Try again." })
      return
    }

    record.pageId = normalizedPageId
    record.lastUsedAt = Date.now()
    tokenStore.set(clientId, record)
    persistTokenStore()

    appendAuditLog({
      event: "notion.test.success",
      requestId,
      clientId,
      pageId: normalizedPageId
    })

    res.json({ success: true, workspaceName: record.workspaceName || "" })
  } catch (error: any) {
    appendAuditLog({
      event: "notion.test.error",
      requestId,
      clientId,
      pageId: normalizedPageId,
      error: error?.message || "unknown"
    })
    res.status(500).json({ success: false, error: "Notion is having trouble right now. Try again." })
  }
})

app.post("/notion/save", jsonParser, async (req, res) => {
  const requestId = getRequestId(req)
  const { clientId, clientKey, content, sourceUrl } = req.body ?? {}

  if (!clientId || !clientKey || !content) {
    res.status(400).json({ success: false, error: "Couldn't save reference." })
    return
  }
  if (!isValidClientId(clientId) || !isValidClientKey(clientKey)) {
    res.status(400).json({ success: false, error: "Reconnect Notion to save references." })
    return
  }

  const record = verifyClient(clientId, clientKey)
  if (!record) {
    res.status(401).json({ success: false, error: "Reconnect Notion to save references." })
    return
  }

  if (!record.pageId) {
    res.status(400).json({ success: false, error: "Set a Notion page to save references." })
    return
  }

  if (typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ success: false, error: "Content is required." })
    return
  }

  if (content.length > NOTION_MAX_CONTENT_CHARS) {
    res.status(400).json({ success: false, error: "Content exceeds size limit." })
    return
  }

  if (!enforceRateLimit(clientId)) {
    res.status(429).json({ success: false, error: "Notion is having trouble right now. Try again." })
    return
  }

  const resolvedSource = formatSourceUrl(sourceUrl)
  const contentHash = crypto.createHash("sha256").update(content).digest("hex")

  appendAuditLog({
    event: "notion.save.start",
    requestId,
    clientId,
    pageId: record.pageId,
    contentLength: content.length,
    contentHash,
    sourceHost: sanitizeSourceHost(resolvedSource)
  })

  try {
    const payload = buildNotionPayload(content, resolvedSource)
    const response = await fetchWithTimeout(`${NOTION_API_BASE}/blocks/${record.pageId}/children`, {
      method: "PATCH",
      headers: notionHeaders(record.accessToken),
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      appendAuditLog({
        event: "notion.save.failed",
        requestId,
        clientId,
        pageId: record.pageId,
        status: response.status
      })
      res.status(400).json({ success: false, error: "Couldn't save reference." })
      return
    }

    record.lastUsedAt = Date.now()
    tokenStore.set(clientId, record)
    persistTokenStore()

    appendAuditLog({
      event: "notion.save.success",
      requestId,
      clientId,
      pageId: record.pageId
    })

    res.json({ success: true })
  } catch (error: any) {
    appendAuditLog({
      event: "notion.save.error",
      requestId,
      clientId,
      pageId: record.pageId,
      error: error?.message || "unknown"
    })
    res.status(500).json({ success: false, error: "Couldn't save reference." })
  }
})

app.post("/notion/disconnect", jsonParser, async (req, res) => {
  const requestId = getRequestId(req)
  const { clientId, clientKey } = req.body ?? {}

  if (!clientId || !clientKey) {
    res.status(400).json({ success: false, error: "Reconnect Notion to save references." })
    return
  }
  if (!isValidClientId(clientId) || !isValidClientKey(clientKey)) {
    res.status(400).json({ success: false, error: "Reconnect Notion to save references." })
    return
  }

  const record = verifyClient(clientId, clientKey)
  if (!record) {
    res.json({ success: true })
    return
  }

  appendAuditLog({
    event: "notion.disconnect.start",
    requestId,
    clientId
  })

  try {
    const configError = requireNotionConfig()
    if (!configError) {
      const encoded = Buffer.from(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`).toString("base64")
      await fetchWithTimeout(NOTION_REVOKE_URL, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${encoded}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ token: record.accessToken })
      }).catch(() => {})
    }
  } catch (error) {
    console.warn("Failed to revoke Notion token")
  }

  tokenStore.delete(clientId)
  persistTokenStore()

  appendAuditLog({
    event: "notion.disconnect.success",
    requestId,
    clientId
  })

  res.json({ success: true })
})

app.get("/health", (_, res) => {
  res.json({ status: "ok" })
})

app.listen(PORT, HOST, () => {
  console.log(`Toss Backend Gateway running on http://${HOST}:${PORT}`)
})
