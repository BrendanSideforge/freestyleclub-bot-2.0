import * as Discord from "discord.js";
import * as Tools from "../utils/tools";
import { getWinToLossRatio } from "../utils/statUtils";

export default async function (client: any, oldUser: any, newUser: any) {
    
    const name: string = Tools.removeTags(newUser.displayName);

    if (newUser.displayName.includes('🔰') && !oldUser.displayName.includes('🔰')) {
        const ratio: Array<number> = await getWinToLossRatio(newUser.id, 'G League');
        await newUser.setNickname(`[🔰${ratio[0]}-${ratio[1]}] ${name}`);
    }

    if (newUser.displayName.includes('🔱') && oldUser.displayName.includes('🔰')) {
        const ratio: Array<number> = await getWinToLossRatio(newUser.id, 'League');
        await newUser.setNickname(`[🔱${ratio[0]}-${ratio[1]}] ${name}`);
    }

}