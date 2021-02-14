import * as Discord from "discord.js";
import { defaultPrefix } from "../config";

export default async (client: any, message: Discord.Message) => {
    if (message.author.bot) return;

    let totalPrefix: string;

    if (message.content[0] == "-") {
        totalPrefix = "-";
    }
    // message.content.split(" ").every((el) => {
    //     let found: boolean = false;

    //     if (defaultPrefix.indexOf(el) !== -1) found = true;
    //     else return false;

    //     totalPrefix = el;
    //     return defaultPrefix.indexOf(el) !== -1;
    // });

    if (!totalPrefix) return;

    const args = message.content
        .slice(totalPrefix.length)
        .trim()
        .split(/ +/g);

    const command = args.shift().toLowerCase();

    const cmd = client.commands.get(command) || client.commands.find(
        cmd => cmd.aliases && cmd.aliases.includes(command)
    )


    if (!cmd) return;

    cmd.run(client, message, args);
}