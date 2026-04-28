// Browser inspection workspace tool for UI validation.
// Wraps Playwright chromium to snapshot and screenshot the react-renderer viewport.
// Reuses a singleton browser across calls within the same minibob process.

import { join } from "path";
import { mkdirSync } from "fs";

interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

interface BrowserInspectArgs {
  /** What to do: screenshot, snapshot (accessibility tree), content (text), navigate */
  action: "screenshot" | "snapshot" | "content" | "navigate";
  /** URL to visit. Defaults to http://localhost:3001/app */
  url?: string;
  /** File path for screenshot output. Defaults to .playwright-mcp/ui-<timestamp>.png */
  outputPath?: string;
  /** Extra wait after page load (ms). Defaults to 1500 */
  waitMs?: number;
}

let _browser: any = null;
let _chromium: any = null;

async function getChromium() {
  if (!_chromium) {
    // Lazy import so module loads even when playwright is absent.
    try {
      const pw = await import("@playwright/test");
      _chromium = pw.chromium;
    } catch {
      throw new Error(
        "playwright not installed — run `bun install` in repos/react-renderer",
      );
    }
  }
  return _chromium;
}

async function getBrowser() {
  if (!_browser) {
    const chromium = await getChromium();
    _browser = await chromium.launch({ headless: true });
  }
  return _browser;
}

export async function execute(args: BrowserInspectArgs): Promise<ToolResult> {
  const url = args.url ?? "http://localhost:3001/app";
  const waitMs = args.waitMs ?? 1500;

  try {
    const browser = await getBrowser();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
      if (waitMs > 0) await page.waitForTimeout(waitMs);

      switch (args.action) {
        case "screenshot": {
          const dir = ".playwright-mcp";
          try {
            mkdirSync(dir, { recursive: true });
          } catch {}
          const filePath =
            args.outputPath ?? join(dir, `ui-${Date.now()}.png`);
          await page.screenshot({ path: filePath, fullPage: true });
          return {
            success: true,
            output: `Screenshot saved: ${filePath}\nView live at: ${url}`,
          };
        }

        case "snapshot": {
          const title = await page.title();
          // Use evaluate to get a lightweight DOM outline since accessibility
          // API is deprecated in newer Playwright versions.
          const outline: string = await page.evaluate(() => {
            function walk(el: Element, depth: number): string {
              if (depth > 6) return "";
              const tag = el.tagName.toLowerCase();
              const role = el.getAttribute("role") ?? "";
              const label =
                el.getAttribute("aria-label") ??
                el.getAttribute("aria-labelledby") ??
                "";
              const text = (el.textContent ?? "").trim().slice(0, 80);
              const attrs = [role && `role=${role}`, label && `label="${label}"`]
                .filter(Boolean)
                .join(" ");
              const line = `${"  ".repeat(depth)}<${tag}${attrs ? " " + attrs : ""}>${text ? ' "' + text + '"' : ""}\n`;
              return (
                line +
                Array.from(el.children)
                  .map((c) => walk(c, depth + 1))
                  .join("")
              );
            }
            return walk(document.body, 0);
          });
          return {
            success: true,
            output: `Page: "${title}" (${url})\n\nDOM outline:\n${outline.slice(0, 6000)}`,
          };
        }

        case "content": {
          const title = await page.title();
          const text: string = await page.evaluate(
            () => document.body.innerText,
          );
          return {
            success: true,
            output: `Page: "${title}"\n\nText content:\n${text.slice(0, 5000)}`,
          };
        }

        case "navigate": {
          const title = await page.title();
          return {
            success: true,
            output: `Navigated to ${url} — "${title}"`,
          };
        }

        default:
          return {
            success: false,
            output: "",
            error: `Unknown action: ${(args as any).action}`,
          };
      }
    } finally {
      await context.close();
    }
  } catch (err) {
    return { success: false, output: "", error: String(err) };
  }
}
