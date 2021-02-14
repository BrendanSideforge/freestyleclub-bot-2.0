import * as Discord from "discord.js";
import * as Config from "../config";
import * as Tools from "../utils/tools";
import * as StatUtils from "../utils/statUtils";

export default async function(client: any, message: Discord.Message, args: Array<string>) {

    const leagueType: string = args[0].toLowerCase();

    if (leagueType === "league") {
        let leagueRole: any = null;
        const server: any = message.guild;

        [...server.roles.cache].forEach((role: any) => {
            // see if the role id is the same as the league role id
            if (role[1].id === Config.leagueRoleId) {
                leagueRole = role[1];
            }
        });

        const member: any = await Tools.getMember(server, client, args[1]);
        await member.roles.add(leagueRole);

        await member.setNickname(`[🔱0-0] ${member.user.username}`);
        await message.channel.send(":thumbsup:");
    } else if (leagueType === "gleague") {
        let gleagueRole: any = null;
        const server: any = message.guild;

        [...server.roles.cache].forEach((role: any) => {
            // see if the role id is the same as the league role id
            if (role[1].id === Config.gleagueRoleId) {
                gleagueRole = role[1];
            }
        });

        const member: any = await Tools.getMember(server, client, args[1]);
        await member.roles.add(gleagueRole);

        await member.setNickname(`[🔰0-0] ${member.user.username}`);
        await message.channel.send(":thumbsup:");
    } else {
        await message.channel.send(":x: There is only 2 acceptable options: `league` or `gleague`.")
    }

}