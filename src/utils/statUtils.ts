
import * as database from "./database";
import * as pg from "pg";

const pool: pg.Pool = database.pool;

export async function getWinToLossRatio(user_id: string, league_type: string): Promise<number[]> {

    // select from a row from the table where a user id matches this one
    const selectQuery: string = "SELECT * FROM matches WHERE (defender_id=$1 AND league_type=$2) OR (challenger_id=$1 AND league_type=$2)";
    const matches: any = await pool.query(selectQuery, [user_id, league_type]);

    // set a win and loss counter
    let wins: number = 0;
    let losses: number = 0;

    // go through each match and see if a winner_id is the same as the user id or vise versa
    
    for (let i = 0; i < matches.rows.length; i++) {
        
        const match: object = matches.rows[i];

        if (match['winner_id'] === user_id) {
            wins += 1;
        } else {
            losses += 1;
        }

    }

    // return a list
    // wins go first losses go second
    return [wins, losses];

}

