
import * as database from "./database";
import * as pg from "pg";
import * as Tools from "./tools";

const pool: pg.Pool = database.pool;

export async function startTimer(client: any, guild: any, timerId: number, event: string, ms: number, extra: object): Promise<any> {

    setTimeout(async function() {

        const timerQuery: string = "SELECT * FROM timers WHERE timer_id=$1";
        const timer: any = await pool.query(timerQuery, [timerId]);

        if (timer.rows.length === 0) {
            return;
        }

        if (event === "audience-lock") {
            await Tools.lock(client, guild, '742467212698189865', extra['messageIds'], extra['jumpUrl']);
        }

        const deleteTimer: string = "DELETE FROM timers where timer_id=$1";
        await pool.query(deleteTimer, [timerId]);

    }, ms);

}

export async function createTimer(client: any, guild: any, event: string, seconds: number, extra: object): Promise<any> {

    const totalTimerQuery: string = "SELECT * FROM timers";
    const timers: any = await pool.query(totalTimerQuery);

    const timerID: number = timers.rows.length + 1;
    const ms: number = seconds * 1000;

    await startTimer(client, guild, timerID, event, ms, extra);

    const insertQuery: string = "INSERT INTO timers (timer_id, seconds, extra) VALUES ($1, $2, $3)";
    await pool.query(insertQuery, [timerID, seconds, null]);

}
