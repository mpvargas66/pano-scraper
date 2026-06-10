import { runScraper } from "../../src/scraper";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === "production" && !authHeader?.endsWith(expectedToken || "")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await runScraper();
    return res.status(200).json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
    });
  }
}
