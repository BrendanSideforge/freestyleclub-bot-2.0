import { match } from "assert";
import * as Discord from "discord.js";
import { PassThrough } from "stream";
import { isNotEmittedStatement, isReturnStatement, reduceEachTrailingCommentRange } from "typescript";
import * as Tools from "../utils/tools";
import * as stats from "../utils/statUtils";
import * as Config from "../config";
import * as Timers from "../utils/timers";
import { pool } from "../utils/database";

export const aliases = [
    "sm",
    "start-match"
]

export default async (client: any, message: Discord.Message, args: Array<string>) => {

    let pastMessages: Array<string> = [];
    let defender: any = null;
    let challenger: any = null;
    let defenderPoints: Array<string> = [];
    let challengerPoints: Array<string> = [];
    let currentCategory: number = 1;
    let categories: object = {
        1: 'content',
        2: 'flow',
        3: 'delivery'
    };
    let currentRound: number = 1;
    let matchType: string = null;
    let decision: string = null;
    let judges: any = [];
    let winner_quote: string = null;
    let host: any = null;
    let winner: any = null;
    let editing: boolean = false;
    let editingTypes: object = {
        round_one: false,
        round_two: false,
        round_three: false,
        round_four: false,
        round_five: false,
        judges: false,
        host: false,
        winner_quote: false
    };
    let matchChannel: any;
    let league_type: string;
    let audienceMatchMessages: Array<string> = [];

    await message.delete();

    async function getLeagueType(): Promise<any> {

        /*
        -----------
        G-League

        Beginner league

        -----------
        League
        
        Serious league

        -----------

        Skrimage

        Stats are not logged
        */


        const leagueTypeEmbed: Discord.MessageEmbed = new Discord.MessageEmbed()
            .setColor("#000000")
            .addField("What is the match league type?", [
                `:one: League`,
                `:two: G League`,
                `:three: Skrimage`,
                `:x: Cancel Match Setup`
            ].join("\n"));

        await message.channel.send(leagueTypeEmbed).then(async (reactionMessage: Discord.Message) => {

            await reactionMessage.react("1️⃣");
            await reactionMessage.react("2️⃣");
            await reactionMessage.react("3️⃣");
            await reactionMessage.react("❌");

            const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                (reaction: any, user: Discord.GuildMember) => ['1️⃣', '2️⃣', '3️⃣', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id)
            );

            collector.on('collect', async (reaction: any) => {
                await reactionMessage.delete();

                if (reaction.emoji.name === "1️⃣") {
                    await deleteLastMessage();
                    league_type = "League"
                    pastMessages.push(reactionMessage.id);
                } else if (reaction.emoji.name === "2️⃣") {
                    await deleteLastMessage();
                    league_type = "G League"
                    pastMessages.push(reactionMessage.id);
                } else if (reaction.emoji.name === "3️⃣") {
                    await deleteLastMessage();
                    league_type = "Skrimage"
                    pastMessages.push(reactionMessage.id);
                } else if (reaction.emoji.name === "❌") {
                    pastMessages.push(reactionMessage.id);
                    await deleteLastMessage();
                    await cancelMatchSetup();
                    return;
                }

                await findDefender();

            });

        })


    }

    async function openAudience(): Promise<any> {

        /*

        Opens the audience channel for everyone.

        */

        let audienceChannel: any;

        message.guild.channels.cache.forEach((channel) => {
            if (channel.id === '742467212698189865') {
                audienceChannel = channel;
            }
        });

        audienceChannel.overwritePermissions([
            {
                id: audienceChannel.guild.roles.everyone.id,
                allow: ['SEND_MESSAGES']
            }
        ]);

        const audienceMessageEmbed: Discord.MessageEmbed = new Discord.MessageEmbed()
            .setAuthor(`${Tools.removeTags(defender.displayName)} VS ${Tools.removeTags(challenger.displayName)}`)
            .setDescription(":unlock: Live battle chat has been unlocked!")

        const msg: Discord.Message = await audienceChannel.send(audienceMessageEmbed);
        audienceMatchMessages.push(msg.id);
        client.startMatchMessages.push(msg.id);

    }

    async function determineCall(): Promise<any> {
        /*
        -----------
        KO

        Someone can not get enough points to catch up so it just ends early.
        -----------
        Unanimous 

        If someone gets majority all around but isn't KO
        -----------
        Split

        Just give split decision if none of the other calls are found
        */

        if (matchType === 'regular' || matchType === 'title') {

            // we can find out majority by seeing if they have greater than 2 of each round
            let defenderRoundOnes: number = 0;
            let defenderRoundTwos: number = 0;
            let defenderRoundThrees: number = 0;

            for (let i = 0; i < defenderPoints.length; i++) {

                if (defenderPoints[i].includes('round 1')) {
                    defenderRoundOnes += 1;
                } else if (defenderPoints[i].includes('round 2')) {
                    defenderRoundTwos += 1;
                } else if (defenderPoints[i].includes('round 3')) {
                    defenderRoundThrees += 1;
                }

            }

            let challengerRoundOnes: number = 0;
            let challengerRoundTwos: number = 0;
            let challengerRoundThrees: number = 0;

            for (let i = 0; i < challengerPoints.length; i++) {

                if (challengerPoints[i].includes('round 1')) {
                    challengerRoundOnes += 1;
                } else if (challengerPoints[i].includes('round 2')) {
                    challengerRoundTwos += 1;
                } else if (challengerPoints[i].includes('round 3')) {
                    challengerRoundThrees += 1;
                }

            }

            let defenderMajorities: number = 0;
            
            if (defenderRoundOnes >= 2) {defenderMajorities += 1}
            if (defenderRoundTwos >= 2) {defenderMajorities += 1}
            if (defenderRoundThrees >= 2) {defenderMajorities += 1};

            let challengerMajorities: number = 0;

            if (challengerRoundOnes >= 2) {challengerMajorities += 1}
            if (challengerRoundTwos >= 2) {challengerMajorities += 1}
            if (challengerRoundThrees >= 2) {challengerMajorities += 1};

            const remainingPoints: number = 9-(defenderPoints.length+challengerPoints.length);
            
            if (remainingPoints + defenderPoints.length < challengerPoints.length || remainingPoints + challengerPoints.length < defenderPoints.length) {
                if (currentRound <= 2) {
                    decision = "KO";
                }

                if (remainingPoints > 0) {
                    decision = "KO";
                }
            } 
            if (defenderMajorities >= 3 && defenderRoundThrees + challengerRoundThrees > 0 || challengerMajorities >= 3 && defenderRoundThrees + challengerRoundThrees > 0) {
                decision = "Unanimous Decision";
            } else if (defenderRoundThrees + challengerRoundThrees > 0) {
                decision = "Split Decision";
            }


        } else {

            // we can find out majority by seeing if they have greater than 2 of each round
            let defenderRoundOnes: number = 0;
            let defenderRoundTwos: number = 0;
            let defenderRoundThrees: number = 0;
            let defenderRoundFours: number = 0;
            let defenderRoundFives: number = 0;

            for (let i = 0; i < defenderPoints.length; i++) {

                if (defenderPoints[i].includes('round 1')) {
                    defenderRoundOnes += 1;
                } else if (defenderPoints[i].includes('round 2')) {
                    defenderRoundTwos += 1;
                } else if (defenderPoints[i].includes('round 3')) {
                    defenderRoundThrees += 1;
                } else if (defenderPoints[i].includes('round 4')) {
                    defenderRoundFours += 1;
                } else if (defenderPoints[i].includes('round 5')) {
                    defenderRoundFives += 1;
                }

            }

            let challengerRoundOnes: number = 0;
            let challengerRoundTwos: number = 0;
            let challengerRoundThrees: number = 0;
            let challengerRoundFours: number = 0;
            let challengerRoundFives: number = 0;

            for (let i = 0; i < challengerPoints.length; i++) {

                if (challengerPoints[i].includes('round 1')) {
                    challengerRoundOnes += 1;
                } else if (challengerPoints[i].includes('round 2')) {
                    challengerRoundTwos += 1;
                } else if (challengerPoints[i].includes('round 3')) {
                    challengerRoundThrees += 1;
                } else if (challengerPoints[i].includes('round 4')) {
                    challengerRoundFours += 1;
                } else if (challengerPoints[i].includes('round 5')) {
                   challengerRoundFives += 1;
                }
            }

            let defenderMajorities: number = 0;
            
            if (defenderRoundOnes >= 2) {defenderMajorities += 1}
            if (defenderRoundTwos >= 2) {defenderMajorities += 1}
            if (defenderRoundThrees >= 2) {defenderMajorities += 1};
            if (defenderRoundFours >= 2) {defenderMajorities += 1};
            if (defenderRoundFives >= 2) {defenderMajorities += 1};

            let challengerMajorities: number = 0;

            if (challengerRoundOnes >= 2) {challengerMajorities += 1}
            if (challengerRoundTwos >= 2) {challengerMajorities += 1}
            if (challengerRoundThrees >= 2) {challengerMajorities += 1};

            const remainingPoints: number = 15-(defenderPoints.length+challengerPoints.length);

            if (remainingPoints + defenderPoints.length < challengerPoints.length || remainingPoints + challengerPoints.length < defenderPoints.length) {
                decision = "KO";
            } else {
                decision = "Split Decision";
            }

        }

    }

    async function createTitles(): Promise<any> {

        // await message.guild.channels.create(defender.username, {type: 'voice'})
        //     .then(async (channel: Discord.VoiceChannel) => {
        //         channel.setParent('784595421108109312');
        //     })

        // await message.guild.channels.create("VS", {type: 'voice'})
        //     .then(async (channel: Discord.VoiceChannel) => {
        //         channel.setParent('784595421108109312');
        //     })

        // await message.guild.channels.create(challenger.username, {type: 'voice'})
        //     .then(async (channel: Discord.VoiceChannel) => {
        //         channel.setParent('784595421108109312');
        //     })

        await openAudience();
    }

    async function getTKOWinner(): Promise<any> {

        let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
            .setColor("#000000")
            .addField("Who is the TKO winner?", [
                `:one: **Defender:** ${defender}`,
                `:two: **Challenger:** ${challenger}`
            ].join("\n"));
        
        await message.channel.send(embed).then(async (reactionMessage: Discord.Message) => {
            await reactionMessage.react("1️⃣");
            await reactionMessage.react("2️⃣");
            await reactionMessage.react("❌");

            const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                (reaction: any, user: Discord.GuildMember) => ['1️⃣', '2️⃣', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id) && !pastMessages.includes(`tko-${currentRound}`)
            );

            collector.on('collect', async (reaction: any) => {

                await reactionMessage.delete();

                if (reaction.emoji.name === '1️⃣') {
                    decision = "TKO";
                    winner = defender;
                    await findJudges();
                } else if (reaction.emoji.name === '2️⃣') {
                    decision = "TKO";
                    winner = challenger;
                    await findJudges();
                } else if (reaction.emoji.name === '❌') {
                    await checkRound(`${currentRound}`);
                }
            });
        })
    }

    async function findDefender(): Promise<any> {

        let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
            .setColor("#000000")
            .addField("Who is the defender?", [
                "discord id, username, username#discrim, or mention"
            ].join("\n"), false);
        
        const askMsg: Discord.Message = await message.channel.send(embed);

        const collector = new Discord.MessageCollector(
            // @ts-ignore
            message.channel,
            (msg: Discord.Message) => msg.author.id === message.author.id && !pastMessages.includes('defender')
        );

        collector.on('collect', async (msg: Discord.Message) => {

            try {
                await askMsg.delete();
            } catch(e) {
                console.log(e);
            }

            await msg.delete();

            if (msg.content.toLowerCase() == "cancel") {
                await cancelMatchSetup();

                pastMessages.push('defender');
                return;
            }

            const foundUser: Discord.GuildMember = await Tools.getMember(message.guild, client, msg.content);

            if (!foundUser) {
                await message.channel.send(":warning: I could not find that defender, could you mention them again?");
                return;
            }

            if (editing) {
                let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
                .setColor("#000000")
                .addField(`Are you sure you want to continue?`, [
                    foundUser
                ].join("\n"), false);

                await message.channel.send(embed).then(async (reactionMessage: any) => {

                    await reactionMessage.react("✅");
                    await reactionMessage.react("❌");

                    const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                        (reaction: any, user: Discord.GuildMember) => ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id)
                    );
                    
                    collector.on('collect', async (reaction: any) => {
                        await reactionMessage.delete();

                        if (reaction.emoji.name === "✅") {
                            defender = foundUser;
                            await sendMenu();
                        } else if (reaction.emoji.name === "❌") {
                            await findChallenger();
                        }
                    });

                });

                return
            }

            defender = foundUser;
            pastMessages.push('defender');

            await findChallenger();

        })

    }

    async function findChallenger(): Promise<any> {

        let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
            .setColor("#000000")
            .addField("Who is the challenger?", [
                "discord id, username, username#discrim, or mention"
            ].join("\n"), false);
        
        const askMsg: Discord.Message = await message.channel.send(embed);
        
        const collector = new Discord.MessageCollector(
            // @ts-ignore
            message.channel,
            (msg: Discord.Message) => msg.author.id === message.author.id && !pastMessages.includes('challenger')
        );

        collector.on('collect', async (msg: Discord.Message) => {

            try {
                await askMsg.delete();
            } catch(e) {
                console.log(e);
            }

            await msg.delete();

            if (msg.content.toLowerCase() == "cancel") {
                await cancelMatchSetup();
                pastMessages.push('challenger');
                return;
            }

            const foundUser: Discord.GuildMember = await Tools.getMember(message.guild, client, msg.content);

            if (!foundUser) {
                await message.channel.send(":warning: I could not find that challenger, could you mention them again?");
                return;
            }

            if (editing) {
                let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
                .setColor("#000000")
                .addField(`Are you sure you want to continue?`, [
                    foundUser
                ].join("\n"), false);

                await message.channel.send(embed).then(async (reactionMessage: any) => {

                    await reactionMessage.react("✅");
                    await reactionMessage.react("❌");

                    const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                        (reaction: any, user: Discord.GuildMember) => ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id)
                    );
                    
                    collector.on('collect', async (reaction: any) => {
                        await reactionMessage.delete();

                        if (reaction.emoji.name === "✅") {
                            challenger = foundUser;
                            await sendMenu();
                        } else if (reaction.emoji.name === "❌") {
                            await findChallenger();
                        }
                    });

                });

                return
            }

            challenger = foundUser;
            pastMessages.push('challenger');

            await createTitles();
            await startRoundOne('content');
        })

    }

    async function getRoundWins(round: string): Promise<any> {

        let defenderRounds: Array<string> = [];
        let challengerRounds: Array<string> = [];
        let roundObject: object = {
            content: null,
            flow: null,
            delivery: null
        }

        for (let i = 0; i < defenderPoints.length; i++) {
            if (defenderPoints[i].includes(`round ${round}`)) {

                if (defenderPoints[i] === `round ${round} content`) {roundObject['content'] = defender}
                if (defenderPoints[i] === `round ${round} flow`) {roundObject['flow'] = defender}
                if (defenderPoints[i] === `round ${round} delivery`) {roundObject['delivery'] = defender}
            }
        }

        for (let i = 0; i < challengerPoints.length; i++) {
            if (challengerPoints[i].includes(`round ${round}`)) {

                if (challengerPoints[i] === `round ${round} content`) {roundObject['content'] = challenger}
                if (challengerPoints[i] === `round ${round} flow`) {roundObject['flow'] = challenger}
                if (challengerPoints[i] === `round ${round} delivery`) {roundObject['delivery'] = challenger}
            }
        }
        return roundObject;

    }

    function clearRounds(round: string) {

        for (let i = 0; i < defenderPoints.length; i++) {
            if (defenderPoints[i].includes(`round ${round}`)) {
                defenderPoints.splice(i);
            }
        }

        for (let i = 0; i < challengerPoints.length; i++) {
            if (challengerPoints[i].includes(`round ${round}`)) {
                challengerPoints.splice(i);
            }
        }

    }

    async function findJudges(): Promise<any> {
        let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
            .setColor("#000000")
            .addField("Who are the match judges?", [
                "discord id, username, username#discrim, or mention"
            ].join("\n"), false);
        
        const askMsg: Discord.Message = await message.channel.send(embed);

        const collector = new Discord.MessageCollector(
            // @ts-ignore
            message.channel,
            (msg: Discord.Message) => msg.author.id === message.author.id
        );

        collector.on('collect', async (msg: Discord.Message) => {
            
            if (!editingTypes['judges'] && pastMessages.includes('judges-1')) {
                return;
            }

            try {
                await askMsg.delete();
            } catch(e) {
                console.log(e);
            }

            await msg.delete();

            if (msg.content.toLowerCase() == "cancel") {
                await cancelMatchSetup();
                pastMessages.push('judges-1');
                return;
            }
            let users: any = [];
            for (let i = 0; i < msg.content.split(" ").length; i++) {
                const foundUser: Discord.GuildMember = await Tools.getMember(message.guild, client, msg.content.split(" ")[i]);

                if (!foundUser) {
                    await message.channel.send(":warning: I could not find that judge, could you mention them again?");
                    return;
                }

                users.push(foundUser);
            }

            if (editingTypes['judges']) {
                editingTypes['judges'] = false;
                let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
                    .setColor("#000000")
                    .addField(`Are you sure you want to continue?`, [
                        users.join(" ")
                    ].join("\n"), false);

                await message.channel.send(embed).then(async (reactionMessage: any) => {

                    await reactionMessage.react("✅");
                    await reactionMessage.react("❌");

                    const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                        (reaction: any, user: Discord.GuildMember) => ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id)
                    );
                    
                    collector.on('collect', async (reaction: any) => {
                        await reactionMessage.delete();

                        if (reaction.emoji.name === "✅") {
                            judges = [];
                            judges.push.apply(judges, users);
                            await sendMenu();
                        } else if (reaction.emoji.name === "❌") {
                            editingTypes['judges'] = true;
                            await findJudges();
                        }
                    });

                });

                return
            }

            pastMessages.push('judges-1');

            judges = users;
            await findHost();
        })
    }

    async function findHost(): Promise<any> {

        let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
            .setColor("#000000")
            .addField("Who is the match host?", [
                "discord id, username, username#discrim, or mention"
            ].join("\n"), false);
        
        const askMsg: Discord.Message = await message.channel.send(embed);
        
        const collector = new Discord.MessageCollector(
            // @ts-ignore
            message.channel,
            (msg: Discord.Message) => msg.author.id === message.author.id
        );

        collector.on('collect', async (msg: Discord.Message) => {

            if (!editingTypes['host'] && pastMessages.includes('host')) {
                return;
            }

            try {
                await askMsg.delete();
            } catch(e) {
                console.log(e);
            }

            await msg.delete();

            if (msg.content.toLowerCase() == "cancel") {
                await cancelMatchSetup();
                return;
            }

            const foundUser: Discord.GuildMember = await Tools.getMember(message.guild, client, msg.content);

            if (!foundUser) {
                await message.channel.send(":warning: I could not find that host, could you mention them again?");
                return;
            }

            if (editingTypes['host']) {
                editingTypes['host'] = false;
                let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
                    .setColor("#000000")
                    .addField(`Are you sure you want to continue?`, [
                        foundUser
                    ].join("\n"), false);

                await message.channel.send(embed).then(async (reactionMessage: any) => {

                    await reactionMessage.react("✅");
                    await reactionMessage.react("❌");

                    const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                        (reaction: any, user: Discord.GuildMember) => ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id)
                    );
                    
                    collector.on('collect', async (reaction: any) => {
                        await reactionMessage.delete();

                        if (reaction.emoji.name === "✅") {
                            host = foundUser;
                            await sendMenu();
                        } else if (reaction.emoji.name === "❌") {
                            editingTypes['host'] = true;
                            await findHost();
                        }
                    });

                });

                return
            }

            pastMessages.push('host');

            host = foundUser;
            await getWinnerQuote();
        })
    }

    async function getWinnerQuote(): Promise<any> {
        let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
            .setColor("#000000")
            .addField("What is the winner quote?", [
                "text entry"
            ].join("\n"), false);
        
        const askMsg: Discord.Message = await message.channel.send(embed);
        
        const collector = new Discord.MessageCollector(
            // @ts-ignore
            message.channel,
            (msg: Discord.Message) => msg.author.id === message.author.id
        );

        collector.on('collect', async (msg: Discord.Message) => {
            if (!editingTypes['winner_quote'] && pastMessages.includes('winner_quote')) {
                return;
            }

            try {
                await askMsg.delete();
            } catch(e) {
                console.log(e);
            }

            await msg.delete();

            if (msg.content.toLowerCase() == "cancel") {
                await cancelMatchSetup();
                pastMessages.push('winner quote');
                return;
            }
            
            if (editingTypes['winner_quote']) {
                editingTypes['winner_quote'] = false;
                let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
                    .setColor("#000000")
                    .addField(`Are you sure you want to continue?`, [
                        msg.content
                    ].join("\n"), false);

                await message.channel.send(embed).then(async (reactionMessage: any) => {

                    await reactionMessage.react("✅");
                    await reactionMessage.react("❌");

                    const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                        (reaction: any, user: Discord.GuildMember) => ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id)
                    );
                    
                    collector.on('collect', async (reaction: any) => {
                        await reactionMessage.delete();

                        if (reaction.emoji.name === "✅") {
                            winner_quote = msg.content;
                            await sendMenu();
                        } else if (reaction.emoji.name === "❌") {
                            editingTypes['winner_quote'] = true;
                            await getWinnerQuote();
                        }
                    });

                });

                return
            }

            pastMessages.push('winner_quote');
            
            winner_quote = msg.content;
            await checkMatch();
        })
    }

    async function checkRound(round: string): Promise<any> {

        const checkedObject: object = await getRoundWins(round);
        let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
            .setColor("#000000")
            .addField(`Does everything look good for round ${round}?`, [
                `**Content:** <@${checkedObject['content'].id}>`,
                `**Flow:** <@${checkedObject['flow'].id}>`,
                `**Delivery:** <@${checkedObject['delivery'].id}>`,
                "",
                `${defenderPoints.length} - <@${defender.id}>`,
                `${challengerPoints.length} - <@${challenger.id}>`
            ].join("\n"), false);

        await message.channel.send(embed).then(async (reactionMessage: Discord.Message) => {
            await reactionMessage.react("✅");
            await reactionMessage.react("📝");
            await reactionMessage.react("🔨");
            await reactionMessage.react("❌");

            const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                (reaction: any, user: Discord.GuildMember) => ['✅', '📝', '🔨', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id)
            )

            collector.on('collect', async (reaction: any) => {
                await reactionMessage.delete();
                if (reaction.emoji.name == "✅") {
                    if (round == '1') {
                        await startRoundTwo('content');
                        return;
                    } else if (round == '2') {
                        if (matchType === "title" || matchType === "regular") {
                            await determineCall();

                            if (decision === "KO") {
                                await findJudges();
                            } else {
                                await startRoundThree('content');
                            }
                        } else {
                            await startRoundThree('content');
                        }
                    } else if (round == '3') {
                        if (matchType === "champion") {
                            await determineCall();

                            if (decision === "KO") {
                                await findJudges();
                            } else {
                                await startRoundFour('content');
                            }
                        } else {
                            await findJudges();
                        }
                    } else if (round == '4') {
                        if (matchType === "champion") {
                            await determineCall();

                            if (decision === "KO") {
                                await findJudges();
                            } else {
                                await startRoundFive('content');
                            }
                        }
                        await startRoundFive('content');
                    } else if (round == '5') {
                        await findJudges();
                    }
                } else if (reaction.emoji.name == '📝') {
                    if (round == '1') {
                        clearRounds('1');
                        await startRoundOne('content');
                        return;
                    } else if (round == '2') {
                        clearRounds('2');
                        await startRoundTwo('content');
                        return;
                    } else if (round == '3') {
                        clearRounds('3');
                        await startRoundThree('content');
                        return;
                    } else if (round == '4') {
                        clearRounds('4');
                        await startRoundFour('content');
                        return;
                    } else if (round == '5') {
                        clearRounds('5');
                        await startRoundFive('content');
                        return;
                    }

                } else if (reaction.emoji.name == '🔨') {
                    await getTKOWinner();
                    return;
                } else if (reaction.emoji.name == '❌') {
                    await cancelMatchSetup();
                    pastMessages.push(reactionMessage.id);
                    return;
                }

                pastMessages.push(reactionMessage.id);
            })
        })

    }

    async function startRoundOne(category: string): Promise<any> {
        currentRound = 1;

        let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
            .setColor("#000000")
            .addField(`Who won round one ${category}?`, [
                `:one: **Defender:** <@${defender.id}>`,
                `:two: **Challenger:** <@${challenger.id}>`,
                `:x: Cancel Match Setup`
            ].join("\n"), false);
        
        // @ts-ignore
        await message.channel.send(embed).then(async (reactionMessage: Discord.Message) => {

            await reactionMessage.react("1️⃣");
            await reactionMessage.react("2️⃣");
            await reactionMessage.react("❌");

            const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                (reaction: any, user: Discord.GuildMember) => ['1️⃣', '2️⃣', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id) && !pastMessages.includes('round 1')
            );

            collector.on('collect', async (reaction: any) => {
                await reactionMessage.delete();

                if (editing && currentCategory === 1 ) {
                    await clearRounds('1');
                }

                if (reaction.emoji.name === '1️⃣') {
                    defenderPoints.push(`round 1 ${category}`);
                } else if (reaction.emoji.name === '2️⃣') {
                    challengerPoints.push(`round 1 ${category}`);
                } else if (reaction.emoji.name === '❌') {
                    pastMessages.push('round 1');
                    await cancelMatchSetup();
                    return;
                }

                pastMessages.push(reactionMessage.id);

                if (currentCategory === 3 && !editing) {
                    await checkRound('1');
                    currentCategory = 1;
                    return;
                } else if (currentCategory === 3 && editing) {
                    
                    const checkedObject: object = await getRoundWins('1');
                    let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
                        .setColor("#000000")
                        .addField(`Are you sure you want to continue?`, [
                            `**Content:** ${checkedObject['content']}`,
                            `**Flow:** ${checkedObject['flow']}`,
                            `**Delivery:** ${checkedObject['delivery']}`,
                            "",
                            `${defenderPoints.length} - <@${defender.id}>`,
                            `${challengerPoints.length} - <@${challenger.id}>`
                        ].join("\n"), false);

                    await message.channel.send(embed).then(async (reactionMessage: any) => {

                        await reactionMessage.react("✅");
                        await reactionMessage.react("❌");

                        const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                            (reaction: any, user: Discord.GuildMember) => ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id) && !pastMessages.includes('round 1')
                        );
                        
                        collector.on('collect', async (reaction: any) => {
                            await reactionMessage.delete();

                            if (reaction.emoji.name === "✅") {
                                currentCategory = 1;
                                await sendMenu();
                            } else if (reaction.emoji.name === "❌") {
                                currentCategory = 1;
                                await startRoundOne('content');
                            }
                        });

                    });
                    
                    return;

                }
                currentCategory = currentCategory + 1;
                await startRoundOne(categories[currentCategory]);
            })

        })
        
    }


    async function startRoundTwo(category: string): Promise<any> {
        currentRound = 2;
        let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
            .setColor("#000000")
            .addField(`Who won round two ${categories[currentCategory]}?`, [
                `:one: **Defender:** <@${defender.id}>`,
                `:two: **Challenger:** <@${challenger.id}>`,
                `:x: Cancel Match Setup`
            ].join("\n"), false);
        
        // @ts-ignore
        await message.channel.send(embed).then(async (reactionMessage: Discord.Message) => {

            await reactionMessage.react("1️⃣");
            await reactionMessage.react("2️⃣");
            await reactionMessage.react("❌");

            const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                (reaction: any, user: Discord.GuildMember) => ['1️⃣', '2️⃣', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id) && !pastMessages.includes('round 2')
            );

            collector.on('collect', async (reaction: any) => {
                await reactionMessage.delete();

                if (editing && currentCategory === 1 ) {
                    await clearRounds('2');
                }

                if (reaction.emoji.name === '1️⃣') {
                    defenderPoints.push(`round 2 ${category}`);
                } else if (reaction.emoji.name === '2️⃣') {
                    challengerPoints.push(`round 2 ${category}`);
                } else if (reaction.emoji.name === '❌') {
                    pastMessages.push('round 2');
                    await cancelMatchSetup();
                    return;
                }

                pastMessages.push(reactionMessage.id);

                if (currentCategory === 3 && !editing) {
                    await checkRound('2');
                    currentCategory = 1;
                    return;
                } else if (currentCategory === 3 && editing) {
                    
                    const checkedObject: object = await getRoundWins('2');
                    let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
                        .setColor("#000000")
                        .addField(`Are you sure you want to continue?`, [
                            `**Content:** ${checkedObject['content']}`,
                            `**Flow:** ${checkedObject['flow']}`,
                            `**Delivery:** ${checkedObject['delivery']}`,
                            "",
                            `${defenderPoints.length} - <@${defender.id}>`,
                            `${challengerPoints.length} - <@${challenger.id}>`
                        ].join("\n"), false);

                    await message.channel.send(embed).then(async (reactionMessage: any) => {

                        await reactionMessage.react("✅");
                        await reactionMessage.react("❌");

                        const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                            (reaction: any, user: Discord.GuildMember) => ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id) && !pastMessages.includes('round 2')
                        );
                        
                        collector.on('collect', async (reaction: any) => {
                            await reactionMessage.delete();

                            if (reaction.emoji.name === "✅") {
                                currentCategory = 1;
                                await sendMenu();
                            } else if (reaction.emoji.name === "❌") {
                                currentCategory = 1;
                                await startRoundTwo('content');
                            }
                        });

                    });
                    
                    return;

                }
                currentCategory = currentCategory + 1;
                await startRoundTwo(categories[currentCategory]);
            })

        })
        
    }

    async function startRoundThree(category: string): Promise<any> {
        currentRound = 3;
        let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
            .setColor("#000000")
            .addField(`Who won round three ${categories[currentCategory]}?`, [
                `:one: **Defender:** <@${defender.id}>`,
                `:two: **Challenger:** <@${challenger.id}>`,
                `:x: Cancel Match Setup`
            ].join("\n"), false);
        
        // @ts-ignore
        await message.channel.send(embed).then(async (reactionMessage: Discord.Message) => {

            await reactionMessage.react("1️⃣");
            await reactionMessage.react("2️⃣");
            await reactionMessage.react("❌");

            const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                (reaction: any, user: Discord.GuildMember) => ['1️⃣', '2️⃣', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id) && !pastMessages.includes('round 3')
            );

            collector.on('collect', async (reaction: any) => {

                await reactionMessage.delete();

                if (editing && currentCategory === 1 ) {
                    await clearRounds('3');
                }

                if (reaction.emoji.name === '1️⃣') {
                    defenderPoints.push(`round 3 ${category}`);
                } else if (reaction.emoji.name === '2️⃣') {
                    challengerPoints.push(`round 3 ${category}`);
                } else if (reaction.emoji.name === '❌') {
                    pastMessages.push('round 3');
                    await cancelMatchSetup();
                    return;
                }

                pastMessages.push(reactionMessage.id);

                if (currentCategory === 3 && !editing) {
                    await checkRound('3');
                    currentCategory = 1;
                    return;
                } else if (currentCategory === 3 && editing) {
                    
                    const checkedObject: object = await getRoundWins('3');
                    let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
                        .setColor("#000000")
                        .addField(`Are you sure you want to continue?`, [
                            `**Content:** ${checkedObject['content']}`,
                            `**Flow:** ${checkedObject['flow']}`,
                            `**Delivery:** ${checkedObject['delivery']}`,
                            "",
                            `${defenderPoints.length} - <@${defender.id}>`,
                            `${challengerPoints.length} - <@${challenger.id}>`
                        ].join("\n"), false);

                    await message.channel.send(embed).then(async (reactionMessage: any) => {

                        await reactionMessage.react("✅");
                        await reactionMessage.react("❌");

                        const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                            (reaction: any, user: Discord.GuildMember) => ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id) && !pastMessages.includes('round 3')
                        );
                        
                        collector.on('collect', async (reaction: any) => {
                            await reactionMessage.delete();

                            if (reaction.emoji.name === "✅") {
                                currentCategory = 1;
                                await sendMenu();
                            } else if (reaction.emoji.name === "❌") {
                                currentCategory = 1;
                                await startRoundThree('content');
                            }
                        });

                    });
                    
                    return;

                }
                currentCategory = currentCategory + 1;
                await startRoundThree(categories[currentCategory]);
            })

        })
        
    }

    async function startRoundFour(category: string): Promise<any> {
        currentRound = 4;
        let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
            .setColor("#000000")
            .addField(`Who won round four ${category}?`, [
                `:one: **Defender:** <@${defender.id}>`,
                `:two: **Challenger:** <@${challenger.id}>`,
                `:x: Cancel Match Setup`
            ].join("\n"), false);
        
        // @ts-ignore
        await message.channel.send(embed).then(async (reactionMessage: Discord.Message) => {

            await reactionMessage.react("1️⃣");
            await reactionMessage.react("2️⃣");
            await reactionMessage.react("❌");

            const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                (reaction: any, user: Discord.GuildMember) => ['1️⃣', '2️⃣', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id) && !pastMessages.includes('round 4')
            );

            collector.on('collect', async (reaction: any) => {

                await reactionMessage.delete();

                if (editing && currentCategory === 1 ) {
                    await clearRounds('4');
                }

                if (reaction.emoji.name === '1️⃣') {
                    defenderPoints.push(`round 4 ${category}`);
                } else if (reaction.emoji.name === '2️⃣') {
                    challengerPoints.push(`round 4 ${category}`);
                } else if (reaction.emoji.name === '❌') {
                    pastMessages.push('round 4');
                    await cancelMatchSetup();
                    return;
                }

                pastMessages.push(reactionMessage.id);

                if (currentCategory === 3 && !editing) {
                    await checkRound('4');
                    currentCategory = 1;
                    return;
                } else if (currentCategory === 3 && editing) {
                    
                    const checkedObject: object = await getRoundWins('4');
                    let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
                        .setColor("#000000")
                        .addField(`Are you sure you want to continue?`, [
                            `**Content:** ${checkedObject['content']}`,
                            `**Flow:** ${checkedObject['flow']}`,
                            `**Delivery:** ${checkedObject['delivery']}`,
                            "",
                            `${defenderPoints.length} - <@${defender.id}>`,
                            `${challengerPoints.length} - <@${challenger.id}>`
                        ].join("\n"), false);

                    await message.channel.send(embed).then(async (reactionMessage: any) => {

                        await reactionMessage.react("✅");
                        await reactionMessage.react("❌");

                        const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                            (reaction: any, user: Discord.GuildMember) => ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id) && !pastMessages.includes('round 4')
                        );
                        
                        collector.on('collect', async (reaction: any) => {
                            await reactionMessage.delete();

                            if (reaction.emoji.name === "✅") {
                                currentCategory = 1;
                                await sendMenu();
                            } else if (reaction.emoji.name === "❌") {
                                currentCategory = 1;
                                await startRoundFour('content');
                            }
                        });

                    });
                    
                    return;

                }
                currentCategory = currentCategory + 1;
                await startRoundFour(categories[currentCategory]);
            })

        })
        
    }

    async function startRoundFive(category: string): Promise<any> {
        currentRound = 5;
        let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
            .setColor("#000000")
            .addField(`Who won round five ${category}?`, [
                `:one: **Defender:** <@${defender.id}>`,
                `:two: **Challenger:** <@${challenger.id}>`,
                `:x: Cancel Match Setup`
            ].join("\n"), false);
        
        // @ts-ignore
        await message.channel.send(embed).then(async (reactionMessage: Discord.Message) => {

            await reactionMessage.react("1️⃣");
            await reactionMessage.react("2️⃣");
            await reactionMessage.react("❌");

            const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                (reaction: any, user: Discord.GuildMember) => ['1️⃣', '2️⃣', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id) && !pastMessages.includes('round 5')
            );

            collector.on('collect', async (reaction: any) => {

                await reactionMessage.delete();

                if (editing && currentCategory === 1 ) {
                    await clearRounds('5');
                }

                if (reaction.emoji.name === '1️⃣') {
                    defenderPoints.push(`round 5 ${category}`);
                } else if (reaction.emoji.name === '2️⃣') {
                    challengerPoints.push(`round 5 ${category}`);
                } else if (reaction.emoji.name === '❌') {
                    pastMessages.push('round 5');
                    await cancelMatchSetup();
                    return;
                }

                pastMessages.push(reactionMessage.id);

                if (currentCategory === 3 && !editing) {
                    await checkRound('5');
                    currentCategory = 1;
                    return;
                } else if (currentCategory === 3 && editing) {
                    
                    const checkedObject: object = await getRoundWins('5');
                    let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
                        .setColor("#000000")
                        .addField(`Are you sure you want to continue?`, [
                            `**Content:** ${checkedObject['content']}`,
                            `**Flow:** ${checkedObject['flow']}`,
                            `**Delivery:** ${checkedObject['delivery']}`,
                            "",
                            `${defenderPoints.length} - <@${defender.id}>`,
                            `${challengerPoints.length} - <@${challenger.id}>`
                        ].join("\n"), false);

                    await message.channel.send(embed).then(async (reactionMessage: any) => {

                        await reactionMessage.react("✅");
                        await reactionMessage.react("❌");

                        const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                            (reaction: any, user: Discord.GuildMember) => ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id) && !pastMessages.includes('round 5')
                        );
                        
                        collector.on('collect', async (reaction: any) => {
                            await reactionMessage.delete();

                            if (reaction.emoji.name === "✅") {
                                currentCategory = 1;
                                await sendMenu();
                            } else if (reaction.emoji.name === "❌") {
                                currentCategory = 1;
                                await startRoundFive('content');
                            }
                        });

                    });
                    
                    return;

                }
                currentCategory = currentCategory + 1;
                await startRoundFive(categories[currentCategory]);
            })

        })
        
    }

    async function getTotalRounds(): Promise<any> { 

        let totalRoundObject: object;
        if (matchType === "regular" || matchType === "title") {
            totalRoundObject = {
                'round 1': {
                    content: 'N/A',
                    flow: 'N/A',
                    delivery: 'N/A'
                },
                'round 2': {
                    content: 'N/A',
                    flow: 'N/A',
                    delivery: 'N/A'
                },
                'round 3': {
                    content: 'N/A',
                    flow: 'N/A',
                    delivery: 'N/A'
                }
            } 
        } else if (matchType === "champion") {
            totalRoundObject = {
                'round 1': {
                    content: 'N/A',
                    flow: 'N/A',
                    delivery: 'N/A'
                },
                'round 2': {
                    content: 'N/A',
                    flow: 'N/A',
                    delivery: 'N/A'
                },
                'round 3': {
                    content: 'N/A',
                    flow: 'N/A',
                    delivery: 'N/A'
                },
                'round 4': {
                    content: 'N/A',
                    flow: 'N/A',
                    delivery: 'N/A'
                },
                'round 5': {
                    content: 'N/A',
                    flow: 'N/A',
                    delivery: 'N/A'
                }
            } 
        }

            for (let i = 0; i < defenderPoints.length; i++) {
                if (defenderPoints[i].includes('round 1 content')) {
                    totalRoundObject['round 1'].content = `${defender}`;
                } else if (defenderPoints[i].includes('round 1 flow')) {
                    totalRoundObject['round 1'].flow = `${defender}`;
                } else if (defenderPoints[i].includes('round 1 delivery')) {
                    totalRoundObject['round 1'].delivery = `${defender}`;
                } else if (defenderPoints[i].includes('round 2 content')) {
                    totalRoundObject['round 2'].content = `${defender}`;
                } else if (defenderPoints[i].includes('round 2 flow')) {
                    totalRoundObject['round 2'].flow = `${defender}`;
                } else if (defenderPoints[i].includes('round 2 delivery')) {
                    totalRoundObject['round 2'].delivery = `${defender}`;
                } else if (defenderPoints[i].includes('round 3 content')) {
                    totalRoundObject['round 3'].content = `${defender}`;
                } else if (defenderPoints[i].includes('round 3 flow')) {
                    totalRoundObject['round 3'].flow = `${defender}`;
                } else if (defenderPoints[i].includes('round 3 delivery')) {
                    totalRoundObject['round 3'].delivery = `${defender}`;
                } else if (defenderPoints[i].includes('round 4 content')) {
                    totalRoundObject['round 4'].content = `${defender}`;
                } else if (defenderPoints[i].includes('round 4 flow')) {
                    totalRoundObject['round 4'].flow = `${defender}`;
                } else if (defenderPoints[i].includes('round 4 delivery')) {
                    totalRoundObject['round 4'].delivery = `${defender}`;
                }else if (defenderPoints[i].includes('round 5 content')) {
                    totalRoundObject['round 5'].content = `${defender}`;
                } else if (defenderPoints[i].includes('round 5 flow')) {
                    totalRoundObject['round 5'].flow = `${defender}`;
                } else if (defenderPoints[i].includes('round 5 delivery')) {
                    totalRoundObject['round 5'].delivery = `${defender}`;
                }
            
            }

            for (let i = 0; i < challengerPoints.length; i++) {
                if (challengerPoints[i].includes('round 1 content')) {
                    totalRoundObject['round 1'].content = `${challenger}`;
                } else if (challengerPoints[i].includes('round 1 flow')) {
                    totalRoundObject['round 1'].flow = `${challenger}`;
                } else if (challengerPoints[i].includes('round 1 delivery')) {
                    totalRoundObject['round 1'].delivery = `${challenger}`;
                } else if (challengerPoints[i].includes('round 2 content')) {
                    totalRoundObject['round 2'].content = `${challenger}`;
                } else if (challengerPoints[i].includes('round 2 flow')) {
                    totalRoundObject['round 2'].flow = `${challenger}`;
                } else if (challengerPoints[i].includes('round 2 delivery')) {
                    totalRoundObject['round 2'].delivery = `${challenger}`;
                } else if (challengerPoints[i].includes('round 3 content')) {
                    totalRoundObject['round 3'].content = `${challenger}`;
                } else if (challengerPoints[i].includes('round 3 flow')) {
                    totalRoundObject['round 3'].flow = `${challenger}`;
                } else if (challengerPoints[i].includes('round 3 delivery')) {
                    totalRoundObject['round 3'].delivery = `${challenger}`;
                } else if (challengerPoints[i].includes('round 4 content')) {
                    totalRoundObject['round 4'].content = `${challenger}`;
                } else if (challengerPoints[i].includes('round 4 flow')) {
                    totalRoundObject['round 4'].flow = `${challenger}`;
                } else if (challengerPoints[i].includes('round 4 delivery')) {
                    totalRoundObject['round 4'].delivery = `${challenger}`;
                }else if (challengerPoints[i].includes('round 5 content')) {
                    totalRoundObject['round 5'].content = `${challenger}`;
                } else if (challengerPoints[i].includes('round 5 flow')) {
                    totalRoundObject['round 5'].flow = `${challenger}`;
                } else if (challengerPoints[i].includes('round 5 delivery')) {
                    totalRoundObject['round 5'].delivery = `${challenger}`;
                }
            }

            return totalRoundObject;

    }

    async function collectStats(): Promise<any> {

        let judgeIDs: Array<string> = [];

        judges.forEach((judge: any) => {
            judgeIDs.push(judge.id);
        });
        const winnerRatio: Array<number> = defenderPoints.length > challengerPoints.length ? [defenderPoints.length, challengerPoints.length] : [challengerPoints.length, defenderPoints.length];

        const insertQuery: string = `
            INSERT INTO matches (
                guild_id,
                defender_id,
                challenger_id,
                judges,
                host_id,
                winner_id,
                loser_id,
                ratio,
                decision,
                defender_category_wins,
                defender_category_losses,
                challenger_category_wins,
                challenger_category_losses,
                match_type,
                inserted_at,
                winner_quote,
                league_type
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
            )
        `;
        await client.db.query(insertQuery, [
            message.guild.id,
            defender.id,
            challenger.id,
            judgeIDs,
            host.id,
            winner.id,
            defender.id === winner.id ? defender.id : challenger.id,
            winnerRatio,
            decision,
            defenderPoints,
            challengerPoints,
            challengerPoints,
            defenderPoints,
            matchType,
            new Date(),
            winner_quote,
            league_type
        ]);

        if (league_type !== "Skrimage") {
            if (defender.displayName.includes('🔰')) {
                const ratio: Array<number> = await stats.getWinToLossRatio(defender.id, 'G League');
                const newName: string = Tools.removeTags(defender.displayName);
                await defender.setNickname(`[🔰${ratio[0]}-${ratio[1]}] ${newName}`);
            }

            if (challenger.displayName.includes('🔰')) {
                const ratio: Array<number> = await stats.getWinToLossRatio(challenger.id, 'G League');
                const newName: string = Tools.removeTags(challenger.displayName);
                await challenger.setNickname(`[🔰${ratio[0]}-${ratio[1]}] ${newName}`);
            }

            if (challenger.displayName.includes('🔱')) {
            
                const challengerRatio: Array<number> = await stats.getWinToLossRatio(challenger.id, league_type);
                const challengerNewName: string = Tools.removeTags(challenger.displayName);
                await challenger.setNickname(`[🔱${challengerRatio[0]}-${challengerRatio[1]}] ${challengerNewName}`);
            }

            if (defender.displayName.includes('🔱')) {

                const defenderRatio: Array<number> = await stats.getWinToLossRatio(defender.id, league_type);
                const defenderNewName: string = Tools.removeTags(defender.displayName);
                await defender.setNickname(`[🔱${defenderRatio[0]}-${defenderRatio[1]}] ${defenderNewName}`);
            }
        }

        if (matchType === "title") {
            
            let defenderInformation: object = Tools.getMedals(defender.displayName);
            let challengerInformation: object = Tools.getMedals(challenger.displayName);

            if (winner.id === challenger.id) {

                if (defenderInformation['index'] === challengerInformation['index']) {
                    const defenderName: string = defender.displayName.replace(defenderInformation['medal'], '');
                    await defender.setNickname(defenderName);
                }

                if (defenderInformation['index'] >= challengerInformation['index']) {
                    const defenderName: string = defender.displayName.replace(defenderInformation['medal'], challengerInformation['medal']);
                    await defender.setNickname(defenderName);

                    const challengerName: string = challenger.displayName.replace(challengerInformation['medal'], defenderInformation['medal']);
                    await challenger.setNickname(challengerName);
                }

                if (defenderInformation['index'] <= challengerInformation['index']) {
                    const defenderName: string = defender.displayName.replace(defenderInformation['medal'], '');
                    await defender.setNickname(defenderName);
                }

            }

        }
    }

    async function sendMatch(embed): Promise<any> {

        let matchChannel: any;

        message.guild.channels.cache.forEach(async (channel: any) => {

            if (channel.id === '740750559187042334') {
                matchChannel = channel;
            }

        });

        const matchMessage: Discord.Message = await matchChannel.send(embed);
        await collectStats();

        const matchUrl: string = `https://discord.com/channels/${matchMessage.guild.id}/${matchChannel.id}/${matchMessage.id}`

        let audienceChannel: any;

        message.guild.channels.cache.forEach((channel) => {
    
            if (channel.id === '742467212698189865') {
                audienceChannel = channel;
            }
        });

        const audienceEmbed: Discord.MessageEmbed = new Discord.MessageEmbed()
            .setAuthor("Match concluded!")
            .setDescription(`There are **5 minutes** left until this chat closes.\n\n[View Match Results](${matchUrl})`);

        const msg: Discord.Message = await audienceChannel.send(audienceEmbed);
        audienceMatchMessages.push(msg.id);
        client.startMatchMessages.push(msg.id);

        await Timers.createTimer(client, message.guild, "audience-lock", 60* 5, { messageIds: audienceMatchMessages, jumpUrl: matchUrl });

    }

    async function sendMenu(): Promise<any> {

        let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
            .setColor("#000000")
            .setTitle("Match Edit")
            .setDescription([
                ":one: Round One",
                ":two: Round Two",
                ":three: Round Three",
                matchType === "champion" ? ":four: Round Four" : null,
                matchType === "champion" ? ":five: Round Five" : null,
                matchType === "champion" ? ":six: Judges" : ":four: Judges",
                matchType === "champion" ? ":seven: Host" : ":five: Host",
                matchType === "champion" ? ":eight: Winner Quote" : ":six: Winner Quote"
            ]);
        
        await message.channel.send(embed).then(async (reactionMessage: Discord.Message) => {
            
            editing = true;

            await reactionMessage.react("1️⃣");
            await reactionMessage.react("2️⃣");
            await reactionMessage.react("3️⃣");
            if (matchType === "champion") {
                await reactionMessage.react("4️⃣");
                await reactionMessage.react("5️⃣");
                await reactionMessage.react("6️⃣");
                await reactionMessage.react("7️⃣");
                await reactionMessage.react("8️⃣");
            } else {
                await reactionMessage.react("4️⃣");
                await reactionMessage.react("5️⃣");
                await reactionMessage.react("6️⃣");
            }
            await reactionMessage.react("❌");

            const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                (reaction: any, user: Discord.GuildMember) => ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '❌', '💣'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id)
            );

            collector.on('collect', async (reaction: any) => {
                await reactionMessage.delete();

                if (reaction.emoji.name ===  "1️⃣") {
                    
                    await startRoundOne('content');
                    editingTypes['round_one'] = true;

                } else if (reaction.emoji.name === "2️⃣") {
                    
                    await startRoundTwo('content');
                    editingTypes['round_two'] = true;

                } else if (reaction.emoji.name === "3️⃣") {
                    
                    await startRoundThree('content');
                    editingTypes['round_three'] = true;

                } else if (reaction.emoji.name === "4️⃣") {
                    
                    if (matchType === "champion") {
                        await startRoundFour('content');
                        editingTypes['round_four'] = true;
                    } else {
                        await findJudges();
                        editingTypes['judges'] = true;
                    }
                    
                } else if (reaction.emoji.name === "5️⃣") {

                    if (matchType === "champion") {
                        await startRoundFive('content');
                        editingTypes['round_five'] = true;
                    } else {
                        editingTypes['host'] = true;
                        await findHost();
                    }

                } else if (reaction.emoji.name === "6️⃣") {
                    
                    if (matchType === "champion") {
                        await findJudges();
                        editingTypes['judges'] = true;
                    } else {
                        await getWinnerQuote();
                        editingTypes['winner_quote'] = true;
                    }

                } else if (reaction.emoji.name === "7️⃣") {
                    
                    editingTypes['host'] = true;
                    await findHost();

                } else if (reaction.emoji.name === "8️⃣") {

                    editingTypes['winner_quote'] = true;
                    await getWinnerQuote();
                } else if (reaction.emoji.name === '❌') {
                    await checkMatch();
                } // else if (reaction.emoji.name === '💣') {
                //     await cancelMatchSetup();
                // }

            })

        })

    }

    async function getMatchEmbed() {
        const roundsTotal: object = await getTotalRounds();
        let roundsFormat: Array<string> = [];
        const roundIcons: Array<string> = [':one:', ':two:', ':three:', ':four:', ':five:']

        for (let i = 0; i < Object.keys(roundsTotal).length; i++) {
            roundsFormat.push(
                `**__\`${Object.keys(roundsTotal)[i].toUpperCase()}:\`__**\n**Content:** ${roundsTotal[Object.keys(roundsTotal)[i]].content}\n**Flow:** ${roundsTotal[Object.keys(roundsTotal)[i]].flow}\n**Delivery:** ${roundsTotal[Object.keys(roundsTotal)[i]].delivery}`
            )
        };

        let judgesFormatted: any = [];
        judges.forEach(async (user) => {
            judgesFormatted.push(`<@${user.id}>`);
        });

        if (!winner) {
            winner = defenderPoints.length > challengerPoints.length ? defender : challenger;
        }
        const winnerRatio: Array<number> = defenderPoints.length > challengerPoints.length ? [defenderPoints.length, challengerPoints.length] : [challengerPoints.length, defenderPoints.length];
        
        if (decision !== "TKO") {
            await determineCall();
        }

        const defenderRatio: any = await stats.getWinToLossRatio(defender.id, league_type);
        const challengerRatio: any = await stats.getWinToLossRatio(challenger.id, league_type);

        let vs_placeholder: string;
        if (league_type === "Skrimage") {
            vs_placeholder = "VS"
        } else {
            vs_placeholder = `\`${defenderRatio[0]}-${defenderRatio[1]}\` vs \`${challengerRatio[0]}-${challengerRatio[1]}\``;
        }

        const formattedDescription: string = `
        ${Tools.removeTags(defender.displayName)} ${vs_placeholder} ${Tools.removeTags(challenger.displayName)}

        **__\`MATCH DECRIPTION\`__**
        **Host:** <@${host.id}>
        **Judges:** ${judgesFormatted.join(" ")}
        **Winner:** <@${winner.id}>
        :white_small_square: Ratio: ${winnerRatio[0]}-${winnerRatio[1]}
        :white_small_square: Call: ${decision}

        ${roundsFormat.join("\n\n")}

        **__\`WINNER QUOTE\`__**
        "${winner_quote}"
        `   

        let matchColor: string;

        if (league_type === "League") {
            matchColor = "#e65858";
        } else if (league_type === "G League") {
            matchColor = "#5fe658";
        } else if (league_type === "Skrimage") {
            matchColor = "#";
        } else if (matchType === "title") {
            matchColor = "#e5dd58";
        } else {
            matchColor = "#";
        }

        const embed: Discord.MessageEmbed = new Discord.MessageEmbed()
            .setColor(matchColor)
            .setAuthor(`${league_type ? league_type : ''} Match Conclusion!`)
            .setDescription(formattedDescription);
        
        return embed;
    }

    async function checkMatch(): Promise<any> {

        const matchEmbed: Discord.MessageEmbed = await getMatchEmbed();

        await message.channel.send(matchEmbed).then(async (reactionMessage: Discord.Message) => {

            await reactionMessage.react("✅");
            await reactionMessage.react("📝");
            await reactionMessage.react("❌");

            const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                (reaction: any, user: Discord.GuildMember) => ['✅', '📝', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id)
            );

            collector.on('collect', async (reaction: any) => {
                await reactionMessage.delete();

                if (reaction.emoji.name === "✅") {
                    pastMessages.push(reactionMessage.id);
                    await sendMatch(matchEmbed);
                } else if (reaction.emoji.name === "📝") {
                    await sendMenu();
                } else if (reaction.emoji.name === "❌") {
                    pastMessages.push(reactionMessage.id);
                    await cancelMatchSetup();
                }

            });

        })
    }

    async function regularMatchSetup(): Promise<any> {
        
        await getLeagueType();
    }

    async function titleMatchSetup(): Promise<any> {

        await findDefender();
    }

    async function championMatchSetup(): Promise<any> {
        
        await findDefender();
    }

    async function cancelMatchSetup(): Promise<any> {
        await message.channel.send(":ok_hand: The match setup has been cancelled.");

        let audienceChannel: any;

        message.guild.channels.cache.forEach((channel) => {
    
            if (channel.id === '742467212698189865') {
                audienceChannel = channel;
            }
        });

        const embed: Discord.MessageEmbed = new Discord.MessageEmbed()
            .setAuthor("Match Cancelled")
            .setDescription("There are **5 minutes** left until this chat closes.");

        const msg: Discord.Message = await audienceChannel.send(embed);
        audienceMatchMessages.push(msg.id);
        client.startMatchMessages.push(msg.id);

        await Timers.createTimer(client, message.guild, "audience-lock", 10, { messageIds: audienceMatchMessages, jumpUrl: null });
        return;
    }

    async function deleteLastMessage(): Promise<any> {

        // const lastMessageQuery: string = "SELECT * FROM locked_messages";
        // const lastMsg: any = await pool.query(lastMessageQuery);

        let lockedChannel: any;

        message.guild.channels.cache.forEach((channel) => {
    
            if (channel.id === '742467212698189865') {
                lockedChannel = channel;
            }
        });

        for (let i: number = 0; i < client.startMatchMessages.length; i++) {
            const msg: any = lockedChannel.messages.cache.get(client.startMatchMessages[i]);
            await msg.delete();
        }

        client.startMatchMessagdes = [];

    //     if (lastMsg.rows.length === 0) {
    //     } else {

    //         const lockedMsg: any = lockedChannel.messages.cache.get(lastMsg.rows[0]['message_id']);
    //         await lockedMsg.delete();

    //         const deleteLockMsg: string = "DELETE FROM locked_messages WHERE message_id=$1";
    //         await pool.query(deleteLockMsg, lastMsg.rows[0]['message_id']);

    //     }

    }

    async function setupMatch(): Promise<any> {

        let embed: Discord.MessageEmbed = new Discord.MessageEmbed()
            .setColor("#000000")
            .addField("What kind of match are you setting up?", [
                ":one: Regular (3 rounds)",
                ":two: Title (3 rounds)",
                ":three: Champion (5 rounds)",
                ":x: Cancel Match Setup"
            ].join("\n"), false);

        await message.channel.send(embed).then(async (reactionMessage: Discord.Message) => {

            await reactionMessage.react("1️⃣");
            await reactionMessage.react("2️⃣");
            await reactionMessage.react("3️⃣");
            await reactionMessage.react("❌");

            const collector: Discord.ReactionCollector = reactionMessage.createReactionCollector(
                (reaction: any, user: Discord.GuildMember) => ['1️⃣', '2️⃣', '3️⃣', '❌'].includes(reaction.emoji.name) && user.id === message.author.id && !pastMessages.includes(reactionMessage.id)
            );

            collector.on('collect', async (reaction: any) => {
                await reactionMessage.delete();
                if (reaction.emoji.name === '1️⃣') {
                    await regularMatchSetup();
                    matchType = 'regular';

                    message.guild.channels.cache.forEach(channel => {
                        if (channel.id === Config.regularMatchChannel) {
                            matchChannel = channel;
                        }
                    });
                } else if (reaction.emoji.name === '2️⃣') {
                    await titleMatchSetup();
                    matchType = 'title';

                    message.guild.channels.cache.forEach(channel => {
                        if (channel.id === Config.titleMatchChannel) {
                            matchChannel = channel;
                        }
                    });
                } else if (reaction.emoji.name === '3️⃣') {
                    await championMatchSetup();
                    matchType = 'champion';

                    message.guild.channels.cache.forEach(channel => {
                        if (channel.id === Config.titleMatchChannel) {
                            matchChannel = channel;
                        }
                    });
                } else if (reaction.emoji.name === '❌') {
                    await deleteLastMessage();
                    await cancelMatchSetup();
                } else {
                    return;
                }

                pastMessages.push(reactionMessage.id);

            })

        });

    };

    await setupMatch();

}