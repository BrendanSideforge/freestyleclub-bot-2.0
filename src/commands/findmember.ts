import * as Discord from "discord.js";
import * as Tools from "../utils/tools";
import * as Stats from "../utils/statUtils";
import * as Timers from "../utils/timers";
import * as Database from "../utils/database";

export default async (client: any, message: Discord.Message, args: Array<string>) => {

    const member: any = await Tools.getMember(message.guild, client, args[0]);
    
    console.log(Tools.getMedals(member.displayName));

}