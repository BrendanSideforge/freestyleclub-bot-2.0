import * as pg from "pg";

export const pool = new pg.Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'tfc_v2',
    password: 'BS103261',
    port: 5432
});

export async function createTables(): Promise<any> {

    await pool.query("DROP TABLE locked_messages");

    await pool.query(`
        CREATE TABLE IF NOT EXISTS matches (
            guild_id text,
            defender_id text,
            challenger_id text,
            judges text[],
            host_id text,
            winner_id text,
            loser_id text,
            ratio integer[],
            decision text,
            defender_category_wins text[],
            defender_category_losses text[],
            challenger_category_wins text[],
            challenger_category_losses text[],
            match_type text,
            inserted_at timestamp,
            winner_quote text,
            league_type text
        )
    `);

    await pool.query(`
    
    CREATE TABLE IF NOT EXISTS timers (
        timer_id INTEGER PRIMARY KEY,
        seconds INTEGER,
        extra JSONB
    )
    `);

    await pool.query(`
    
    CREATE TABLE IF NOT EXISTS locked_messages (
        message_id BIGINT PRIMARY KEY
    )

    `)

}