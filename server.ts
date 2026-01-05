import { Elysia, t } from "elysia";
import { readFileSync } from "fs";
import { join } from "path";
import { Database } from "bun:sqlite";

// Load HTML
const html = readFileSync(join(import.meta.dir, "index.html"), "utf-8");

// Database Setup
const db = new Database("scores.db", { create: true });
db.run(`
    CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        score INTEGER,
        timestamp INTEGER
    )
`);

type ScoreEntry = { name: string; score: number; timestamp: number };

class ScoreStore {
    private scores: ScoreEntry[] = [];
    private pendingScores: ScoreEntry[] = [];
    private CHECKPOINT_INTERVAL = 10000; // 10 seconds

    constructor() {
        // Load initial high scores from DB
        const savedScores = db.query("SELECT name, score, timestamp FROM scores ORDER BY score DESC, timestamp DESC").all() as ScoreEntry[];
        this.scores = savedScores;

        // Start periodic backup
        setInterval(() => this.checkpoint(), this.CHECKPOINT_INTERVAL);

        // Backup on exit
        process.on("SIGINT", () => {
            this.checkpoint();
            process.exit(0);
        });
    }

    add(name: string, score: number) {
        const entry: ScoreEntry = { name, score, timestamp: Date.now() };
        this.scores.push(entry);
        this.pendingScores.push(entry);

        // Keep scores sorted descending
        this.scores.sort((a, b) => b.score - a.score);
    }

    getTop(limit = 10) {
        return this.scores.slice(0, limit);
    }

    private checkpoint() {
        if (this.pendingScores.length === 0) return;

        console.log(`Saving ${this.pendingScores.length} new scores to DB...`);
        const insert = db.prepare("INSERT INTO scores (name, score, timestamp) VALUES ($name, $score, $timestamp)");
        const flush = db.transaction((scores: ScoreEntry[]) => {
            for (const s of scores) insert.run({ $name: s.name, $score: s.score, $timestamp: s.timestamp });
        });

        flush(this.pendingScores);
        this.pendingScores = [];
    }
}

const store = new ScoreStore();

new Elysia()
    .get("/memorygame", () => new Response(html, {
        headers: { "Content-Type": "text/html" }
    }))
    .get("/api/scores", () => store.getTop(10))
    .post("/api/score", ({ body }) => {
        store.add(body.name, body.score);
        return { success: true };
    }, {
        body: t.Object({
            name: t.String(),
            score: t.Number()
        })
    })
    .listen(80);

console.log("🎮 Memory Game server running at http://localhost:80/memorygame");
