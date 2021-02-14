import * as Discord from "discord.js";
import * as configs from "../config";

export default async function(client: any, message: any, args: Array<string>) {

    const server: Discord.Guild = message.guild;
    let leagueRole: any;

    [...server.roles.cache].forEach(role => {
        // check if the role id is the same as the league role id
        if (role[1]['id'] === configs.gleagueRoleId) {
            leagueRole = role[1];
        }
    });

    let leagueMembers: any = [];

    leagueRole.members.forEach(member => {

        leagueMembers.push(member);
        
    });

    const pages: number = Math.round(leagueMembers.length/5);

    const embed: Discord.MessageEmbed = new Discord.MessageEmbed()
        .setColor("#000000")
        .setAuthor(`G League Members (${leagueMembers.length})`)
        .setDescription(leagueMembers.slice(0, 10).join("\n"))
        .setFooter(`Pages (1/${pages})`);

    await message.channel.send(embed).then(async (reactionMessage: Discord.Message) => {

        if (leagueMembers.length >= 5) {
            await reactionMessage.react("⏮️");
            await reactionMessage.react("◀️");
            await reactionMessage.react("⏹️");
            await reactionMessage.react("▶️");
            await reactionMessage.react("⏭️");
        } else {
            return;
        }

        let cancelled: boolean;
        let x: number = 0;

        const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
            (reaction: any, user: Discord.GuildMember) => ['⏮️', '◀️', '⏹️', '▶️', '⏭️'].includes(reaction.emoji.name) && user.id === message.author.id && !cancelled
        );

        collector.on('collect', async (reaction: any) => {

            if (reaction.emoji.name === "⏮️") {
                x = 0;
            } else if (reaction.emoji.name === "◀️") {
                x -= 10;
                if (x < 0) {
                    x = 0;
                }
            } else if (reaction.emoji.name === "⏹️") {
                await reactionMessage.delete();
            } else if (reaction.emoji.name === "▶️") {
                x += 5;
                if (x > leagueMembers.length) {
                    x = leagueMembers.length - 10;
                }
            } else if (reaction.emoji.name === "⏭️") {
                x += leagueMembers.length-10;
            }

            const embed: Discord.MessageEmbed = new Discord.MessageEmbed()
                .setColor('#000000')
                .setAuthor(`G League Members (${leagueMembers.length})`)
                .setDescription(leagueMembers.slice(x, x+10).join("\n"))
                .setFooter(`Pages (${Math.round(x/5+1)}/${pages})`);
            
            await reactionMessage.edit(embed);

        })

    })
}