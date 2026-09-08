import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const playwrightRoot = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
if (!playwrightRoot) throw new Error("CODEX_PRIMARY_RUNTIME_NODE_MODULES is required for visual QA.");
const playwright = await import(`${playwrightRoot}/playwright/index.js`);
const { chromium } = playwright.default;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto(pathToFileURL(resolve(import.meta.dirname, "../test/fixture.html")).href);
await page.waitForSelector("#dal-panel");
await page.screenshot({ path: resolve(import.meta.dirname, "../test/audio-lab-qa.png") });
const panel = await page.locator("#dal-panel").boundingBox();
if (!panel || panel.width < 350 || panel.width > 400 || panel.x + panel.width !== 1440) throw new Error(`Unexpected panel bounds: ${JSON.stringify(panel)}`);
await page.getByPlaceholder("Paste a track, album, or playlist link").fill("not a spotify link");
await page.getByRole("button", { name: "Load" }).click();
const status = await page.locator("#dal-status").textContent();
if (!status?.includes("valid Spotify")) throw new Error("Invalid-link feedback did not appear.");
await page.getByRole("button", { name: "Close Audio Lab" }).click();
if (!(await page.locator("#dal-launcher").isVisible())) throw new Error("Launcher did not appear after closing.");
if (errors.length) throw new Error(`Page errors: ${errors.join(" | ")}`);
await browser.close();
console.log("Visual QA passed; screenshot written to test/audio-lab-qa.png");
