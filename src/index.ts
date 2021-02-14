import * as Discord from "discord.js";
import { token, defaultPrefix, PrivilegedIntents } from "./config";
import * as database from "./utils/database";
import * as fs from "fs";

const client: any = new Discord.Client({
    shards: 'auto',
    partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
    ws: {
      intents: [
        'GUILDS',
        'GUILD_MESSAGES',
        'GUILD_MESSAGE_REACTIONS',
        PrivilegedIntents.GUILD_MEMBERS,
      ],
    },
    fetchAllMembers: true
});
client.commands = new Discord.Collection();
client.db = database.pool;
client.startMatchMessages = [];

fs.readdir('./dist/events', (err, files) => {
    if (err) return console.error(err);

    files.forEach(async file => {
        if (!file.endsWith(".js")) return;
        
        const event = await (await import(`./events/${file}`)).default;
        let eventName: string = file.split(".")[0];
        client.on(eventName, event.bind(null, client));
    });
})

fs.readdir('./dist/commands/', (err, files) => {
    if (err) return console.error(err);

    files.forEach(async file => {
        if (!file.endsWith(".js")) return;
        
        const props = await await import(`./commands/${file}`);
        let commandName: string = file.split(".")[0];
        console.log(`Loaded the command: ${commandName}`);
        client.commands.set(commandName, {
            run: props.default,
            aliases: props.aliases
        });
    });
})

client.login(token);