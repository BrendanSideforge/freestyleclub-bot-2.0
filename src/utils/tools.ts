import * as Discord from "discord.js";
import * as database from "./database";
import * as pg from "pg";

const pool: pg.Pool = database.pool;

// regex
const regex_mention: RegExp = /<@(?:!|)(\d+)>/;
const regex_namediscrim: RegExp = /(.{2,32})#(\d{4})/;
const regex_id: RegExp = /(^\d+$)/;
const regex_name: RegExp = /(.{2,32})/;
const role_mention: RegExp = /<@&(\d+)>/;
const channel_mention: RegExp = /#<(\d+)>/;

// guild: Discord.Guild, client: any, 

export async function getMember(guild: Discord.Guild, client: any, memberArg: string): Promise<any>  {
    const mention_matches: Array<string> = memberArg.match(regex_mention);
    const namediscrim_matches: Array<string> = memberArg.match(regex_namediscrim);
    const id_matches: Array<string> = memberArg.match(regex_id);
    const name_matches: Array<string> = memberArg.match(regex_name);

    // console.log(`Mention Matches: ${mention_matches}`);
    // console.log(`Name#Discrim Matches: ${namediscrim_matches}`);
    // console.log(`ID Matches: ${id_matches}`);
    // console.log(`Name Matches: ${name_matches}`);

    // check if the mention matches are 
    if (mention_matches != null) {
        const firstMention: string = mention_matches[1];
        const guildMembers: any = guild.members.cache;
        let foundMember: Discord.GuildMember = null;

        // set the found member
        guildMembers.each(member => {
            if (member.user.id === firstMention) {
                foundMember = member;
            }
        });

        if (!foundMember) {
            return null;
        }

        return foundMember;
    } else if (namediscrim_matches != null) {
        const firstNameDiscrim: string = `${namediscrim_matches[1]}#${namediscrim_matches[2]}`;
        const guildMembers: any = guild.members.cache;
        let foundMember: Discord.GuildMember = null;

        // set the found member
        guildMembers.each(member => {
            if (`${member.user.username.toLowerCase()}#${member.user.discriminator}` === firstNameDiscrim.toLowerCase()) {
                foundMember = member;
            }
        });

        if (!foundMember) {
            return null;
        }

        return foundMember;

    } else if (id_matches != null) {
        const firstId: string = id_matches[1];
        const guildMembers: any = guild.members.cache;
        let foundMember: Discord.GuildMember = null;

        // set the found member
        guildMembers.each(member => {
            if (member.user.id === firstId) {
                foundMember = member;
            }
        })

        if (!foundMember) {
            return null;
        }

        return foundMember;
    } else if (name_matches != null) {
        const firstName: string = name_matches[1];
        const guildMembers: any = guild.members.cache;
        let foundMember: Discord.GuildMember = null;

        // set the found member
        guildMembers.each(member => {
            if (member.user.username.toLowerCase() === firstName.toLowerCase()) {
                foundMember = member;
            }
        });
        if (!foundMember) {
            return null;
        }

        return foundMember;
    } else {
        return null;
    }

}

export function removeTags(name: string) {

    let splitName: string = name;

    for (let i: number = 0; i < name.split(" ").length; i++) {
        if (name.split(" ")[i][0] === "[" && name.split(" ")[i][name.split(" ")[i].length - 1] === "]") {
            splitName = splitName.replace(name.split(" ")[i], "");
        }
    }

    return splitName.trim();

}

export function getMedals(name: string): object {

    const medals: Array<string> = ['👑','💎','🥇','🥈','🥉'];
    let userMedal: string;
    let userIndex: number;


    for (let i: number = 0; i < medals.length; i++) {
        if (name.includes(medals[i])) {
            userMedal = medals[i];
            userIndex = i;
        }
    }

    const userInformation: object = {
        medal: userMedal,
        index: userIndex
    }

    return userInformation;

}

export async function lock(client: any, guild: any, channel_id: string, messageIds: Array<string>, jumpUrl: string): Promise<any> {

    let lockedChannel: any;

    guild.channels.cache.forEach((channel) => {

        if (channel.id === channel_id) {
            lockedChannel = channel;
        }
    });


    lockedChannel.overwritePermissions([
        {
            id: lockedChannel.guild.roles.everyone.id,
            deny: ['SEND_MESSAGES']
        }
    ]);

    for (let i: number = 0; i < messageIds.length; i++) {
        const msg: any = lockedChannel.messages.cache.get(messageIds[i]);
        await msg.delete();
    }

    const matchResults = jumpUrl ? `[View Match Results](${jumpUrl})` : '';

    const embed: Discord.MessageEmbed = new Discord.MessageEmbed()
        .addField(":lock: Match Concluded", [
            "This channel has been locked, direct all messages to <#658089954328707074>",
            "",
            `${matchResults}`
        ].join("\n"));

    const msg: Discord.Message = await lockedChannel.send(embed);
    
    client.startMatchMessages = [];
    client.startMatchMessages.push(msg.id);
    console.log(client.startMatchMessages);

    // await pool.query("INSERT INTO locked_messages (message_id) VALUES ($1)", [msg.id]);

}
