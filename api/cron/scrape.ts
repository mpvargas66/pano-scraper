import { runScraper } from "../../scraper";
import { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Vercel Cron job handler
 * Configured in vercel.json to run daily at 00:00 UTC
 * 
 * Usage:
 *   curl https://your-domain.vercel.app/api/cron/scrape
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Verify request comes from Vercel (production)
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
    console.error("Cron handler error:", error);
    return res.status(500).json({
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
    });
  }
}
