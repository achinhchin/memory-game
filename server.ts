import { Elysia } from "elysia";
import { readFileSync } from "fs";
import { join } from "path";

const html = readFileSync(join(import.meta.dir, "index.html"), "utf-8");

new Elysia()
    .get("/memorygame", () => new Response(html, {
        headers: { "Content-Type": "text/html" }
    }))
    .listen(80);

console.log("🎮 Memory Game server running at http://localhost:80/memorygame");
