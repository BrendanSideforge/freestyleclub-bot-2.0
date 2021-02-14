import * as Discord from "discord.js";
import * as database from "../utils/database";

export default async (client: any) => {

    console.log(`Logged in as ${client.user.tag} ${client.user.id}`);

    await database.createTables();

};