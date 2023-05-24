const express = require('express')
const fs = require('fs')
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const _ = require('underscore')
dotenv.config();
// Require the necessary discord.js classes
const { GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, Client, hyperlink, EmbedBuilder, ButtonBuilder, GatewayIntentBits, SlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonStyle, Routes, Partials, CategoryChannel } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { DISCORD_TOKEN, APP_ID, PUBLIC_KEY, GUILD_ID, API_NAKAMOTO, SERVER_MESSAGE_CHANNEL_ID, COINMARKETCAP_API_KEY, WELLCOME_CHANNEL_ID } = process.env;
const app = express()
const port = 3000
const axios = require("axios")
var coin = JSON.parse(fs.readFileSync("./coin.json", "utf8"))
const PASSWORD_COMMAND = "naka_token"
// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildScheduledEvents,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

var TYPE_CHANNEL = {
    TEXT: 0,
    VOICE: 2,
    CATEGORIES: 4
}

app.use(bodyParser.json());
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
);
//GuildScheduledEventEntityMetadataOptions
var storeData = {
    "singleplayer": [],
    "multiplayer": [],
    "free2play": [],
    "survivor": []
}


app.get('/', (req, res) => {
    res.json({
        status: 200,
        message: "Service it working",
        version: "1.1.2"
    })
})

app.post("/tigger/levelup/:discord_id", async (req, res) => {
    try {
        const { discord_id } = req.params
        const { level } = req.body;
        var guild = client.guilds.cache.get(GUILD_ID)
        var member = await guild.members.fetch(discord_id)

        if (member) {
            await member.setNickname(`${member.user.username} LV ${level}`)
            await member.send(`Congratulations <@${discord_id}> your level is now ${level}`)
            await client.channels.cache.get(SERVER_MESSAGE_CHANNEL_ID).send({ content: `Congratulations <@${discord_id}> your level is now ${level}` });

            res.json({
                status: true,
                data: "level up success"
            })
        } else {
            res.json({
                status: true,
                data: "member not found"
            })
        }

    } catch (error) {
        console.log(error);
        res.status(404).json({
            status: true,
            data: error.message
        })
    }


})

app.post("/tigger/sync_level", async (req, res) => {
    var { data } = req.body
    var guild = client.guilds.cache.get(GUILD_ID)
    var role = await guild.roles.cache.find(role => role.name === "member");


    for (const user of data) {
        const { discord_id, level } = user
        try {

            var member = await guild.members.cache.get(discord_id) || await guild.members.fetch(discord_id).catch(err => { });

            if (member) {
                await member.setNickname(`${member.user.username} LV ${level}`)
                console.log(`${member.user.username} LV ${level}`, "DONE");
                if (role) {
                    await member.roles.add(role)
                    console.log(member.user.username, "set role done ");
                }
            } else {
                console.log("Not found User discord");
            }
        } catch (error) {
            console.log("cannot setNickname", user, error.message);
        }

    }

    res.send("sync levels")
})


app.post("/tigger/inviteation", async (req, res) => {
    const { data, game_type } = req.body

    // check duplicate data 
    if (JSON.stringify(data) == JSON.stringify(storeData[game_type])) {
        console.log("ignore to render embedded");
        res.send("OK")
        return
    }

    storeData[game_type] = data

    const guild = client.guilds.cache.get(GUILD_ID)
    var game_channels_map = {
        "singleplayer": "🕹-p2e-singleplayer",
        "multiplayer": "🕹-p2e-multiplayers",
        "free2play": "🕹-free2play2earn",
        "survivor": "🕹-p2e-survivor"
    }

    var channel_name = game_channels_map[game_type]
    if (channel_name == undefined) {
        res.status(404).send("game type not found")
        return
    }

    const channel = await guild.channels.cache.find((channelItem) => channelItem.name == channel_name)
    if (channel) {
        var messages = await channel.messages.fetch({ limit: 100 })
        var current_game_list = []
        var new_game_list = []
        messages.forEach(mes => {
            if (mes.embeds.length > 0) {
                current_game_list.push(mes.embeds[0].data.title)
            }
        });



        new_game_list = data.map(game => game.game_name)
        let game_name_has_remove = _.difference(current_game_list, new_game_list)

        // remove message game
        await messages.forEach(async msg_obj => {
            if (msg_obj.embeds.length > 0) {
                if (game_name_has_remove.includes(String(msg_obj.embeds[0].data.title))) {
                    if (msg_obj.thread) {
                        await msg_obj.thread.delete()
                    }
                    await msg_obj.delete()
                }
            }
        })


        for (const gameRecord of data) {


            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(gameRecord.game_name)
                .setURL(gameRecord.game_url)
                .setAuthor({ name: 'Nakamoto.games', iconURL: 'https://files.naka.im/seo/favicon.png', url: 'https://www.nakamoto.games/' })
                .setThumbnail(gameRecord.game_image)

            for (const item_list of gameRecord.item_list) {
                var link_join_game = `[${item_list.room_list.length} ROOM](${item_list.room_list_url})`
                if (game_type == "free2play") {
                    embed.addFields({ name: `LINK`, value: link_join_game, inline: true })
                } else {
                    embed.addFields({ name: `${item_list.item_name} ${item_list.item_size}`, value: link_join_game, inline: true })
                }

            }
            embed.setTimestamp()

            var findMessageEmbed = messages.find(mes => {
                if (mes.embeds.length > 0) {
                    return String(mes.embeds[0].data.title) == String(gameRecord.game_name)
                } else {
                    return false
                }
            })

            if (findMessageEmbed) {
                await findMessageEmbed.edit({ embeds: [embed] })
                if (findMessageEmbed.thread) {
                    await findMessageEmbed.thread.delete()
                }
            } else {
                console.log("ignore message");
                findMessageEmbed = await channel.send({ embeds: [embed] })
            }

            // var thread = await findMessageEmbed.startThread({
            //     name: `Room List : ${findMessageEmbed.embeds[0].title} `,
            // });

            // for (const item_list of gameRecord.item_list) {
            //     for (const room of item_list.room_list) {

            //         const row = new ActionRowBuilder()
            //             .addComponents(
            //                 new ButtonBuilder()

            //                     .setLabel(`${item_list.item_name} ${item_list.item_size} : Room ${room.room_number}`)
            //                     .setStyle(ButtonStyle.Link)
            //                     .setURL(room.item_image)
            //             );
            //         await thread.send({ components: [row] })
            //     }
            // }


            // console.log(`Created thread: ${thread.name}`);
        }
    }

    res.send("OK")

})


app.listen(port, () => {
    // Login to Discord with your client's DISCORD_TOKEN
    client.login(DISCORD_TOKEN)
        .then(() => {

            // register command to bot discord
            const commands = [
                new SlashCommandBuilder().setName('create_top_player').setDescription("this command use for test create topplayer only"),
                new SlashCommandBuilder().setName('create_event').setDescription("this command use for test create event only"),
                new SlashCommandBuilder().setName('ping').setDescription('Replies with pong!'),
                new SlashCommandBuilder().setName('server').setDescription('Replies with server info!'),
                new SlashCommandBuilder().setName('add_coin').setDescription('Add new coin to list tracking')
                    .addStringOption(option =>
                        option.setName('coin')
                            .setDescription('type your coin to tracking')
                            .setRequired(true))
                    .addStringOption(option =>
                        option.setName('password')
                            .setDescription('type your password')
                            .setRequired(true)),
                new SlashCommandBuilder().setName('remove_coin').setDescription('Remove  coin from list tracking')
                    .addStringOption(option =>
                        option.setName('coin')
                            .setDescription('type your coin to remove tracking')
                            .setRequired(true))
                    .addStringOption(option =>
                        option.setName('password')
                            .setDescription('type your password')
                            .setRequired(true)),
                new SlashCommandBuilder().setName('list_coin').setDescription('Show coin registered.'),
                new SlashCommandBuilder().setName('show_id_user').setDescription('Show id of user')
                    .addStringOption(option =>
                        option.setName('user_mention')
                            .setDescription('type user discord tag')
                            .setRequired(true))
                    .addStringOption(option =>
                        option.setName('password')
                            .setDescription('type your password')
                            .setRequired(true))
            ]
                .map(command => command.toJSON());

            const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

            rest.put(Routes.applicationGuildCommands(APP_ID, GUILD_ID), { body: commands })
                .then((data) => console.log(`Successfully registered ${data.length} application commands.`))
                .catch(console.error);

            // handle interaction listen
            client.on('interactionCreate', async interaction => {

                if (interaction.isChatInputCommand()) {
                    const { commandName } = interaction;
                    const string = interaction.options.getString('input');

                    if (commandName === 'ping') {
                        await interaction.reply('Pong!');
                    } else if (commandName === 'server') {
                        await interaction.reply(`Server name: ${interaction.guild.name}\nTotal members: ${interaction.guild.memberCount}`);
                    } else if (commandName === 'user') {
                        await interaction.reply(`Your tag: ${interaction.user.tag}\nYour id: ${interaction.user.id}`);
                    } else if (commandName === 'link_account') {
                        const modal = new ModalBuilder()
                            .setCustomId('nakamoto-email-modal')
                            .setTitle('Nakamoto');

                        // Create the text input components
                        const favoriteColorInput = new TextInputBuilder()
                            .setCustomId('emailNakamoto')
                            // The label is the prompt the user sees for this input
                            .setLabel("What's your email in nakamoto.games ?")
                            // Short means only a single line of text
                            .setStyle(TextInputStyle.Short);

                        // An action row only holds one text input,
                        // so you need one action row per text input.
                        const firstActionRow = new ActionRowBuilder().addComponents(favoriteColorInput);

                        // Add inputs to the modal
                        modal.addComponents(firstActionRow);
                        await interaction.showModal(modal)
                    } else if (commandName == "add_coin") {
                        var coin_input = interaction.options.getString('coin')
                        var password = interaction.options.getString('password')
                        if (password) {
                            if (password != PASSWORD_COMMAND) {
                                await interaction.reply({ content: `You not have permission for this command`, ephemeral: true })
                                return
                            }
                        } else {
                            await interaction.reply({ content: `invalid command ${commandName}`, ephemeral: true })
                            return
                        }
                        if (coin_input) {
                            add_coin(coin_input)
                            await interaction.reply({ content: "```text\n" + coin.join("\n") + " ```", ephemeral: true })
                        } else {
                            await interaction.reply({ content: `invalid command ${commandName}`, ephemeral: true })
                        }

                    } else if (commandName == "remove_coin") {
                        var coin_input = interaction.options.getString('coin')
                        var password = interaction.options.getString('password')
                        if (password) {
                            if (password != PASSWORD_COMMAND) {
                                await interaction.reply({ content: `You not have permission for this command`, ephemeral: true })
                                return
                            }
                        } else {
                            await interaction.reply({ content: `invalid command ${commandName}`, ephemeral: true })
                            return
                        }
                        if (coin_input) {
                            await remove_coin(coin_input)
                            await interaction.reply({ content: "```text\n" + coin.join("\n") + " ```", ephemeral: true })
                        } else {
                            await interaction.reply({ content: `invalid command ${commandName}`, ephemeral: true })
                        }

                        return
                    } else if (commandName == "list_coin") {
                        await interaction.reply({ content: "```text\n" + coin.join("\n") + " ```", ephemeral: true })
                        return
                    } else if (commandName == "show_id_user") {
                        var mentions = interaction.options.getString('user_mention')
                        var password = interaction.options.getString('password')
                        if (password) {
                            if (password != PASSWORD_COMMAND) {
                                await interaction.reply({ content: `You not have permission for this command`, ephemeral: true })
                                return
                            }
                        } else {
                            await interaction.reply({ content: `invalid command ${commandName}`, ephemeral: true })
                            return
                        }
                        await interaction.reply({ content: mentions.replace(/[\\<>@#&!]/g, ""), ephemeral: true })
                        return
                    } else if (commandName === 'create_event') {
                        try {
                            await CreateEvent()
                            await interaction.reply({ content: "Create Event it done", ephemeral: true })
                        } catch (error) {
                            await interaction.reply({ content: "Create Event Error", ephemeral: true })
                        }
                    } else if (commandName === 'create_top_player') {
                        try {
                            await renderTopPlayer()
                            await interaction.reply({ content: "Create top player it done", ephemeral: true })
                        } catch (error) {
                            await interaction.reply({ content: "Create top player Error", ephemeral: true })
                        }
                    }
                } else if (interaction.isButton()) {

                    switch (interaction.customId) {
                        case "link_account_button": {
                            const modal = new ModalBuilder()
                                .setCustomId('nakamoto-email-modal')
                                .setTitle('Nakamoto');

                            // Create the text input components
                            const favoriteColorInput = new TextInputBuilder()
                                .setCustomId('emailNakamoto')
                                // The label is the prompt the user sees for this input
                                .setLabel("What's your email in nakamoto.games ?")
                                // Short means only a single line of text
                                .setStyle(TextInputStyle.Short);

                            // An action row only holds one text input,
                            // so you need one action row per text input.
                            const firstActionRow = new ActionRowBuilder().addComponents(favoriteColorInput);

                            // Add inputs to the modal
                            modal.addComponents(firstActionRow);
                            await interaction.showModal(modal)
                            break;
                        }
                        default:
                            break;
                    }
                    return
                } else if (interaction.isModalSubmit()) {
                    const email = interaction.fields.getTextInputValue('emailNakamoto');

                    if (!validateEmail(email)) return await interaction.reply({ content: `❗️ incoret email format plase try again later`, ephemeral: true });

                    var member = (interaction.member == null) ? interaction.user : interaction.member.user


                    try {

                        var result = await submit_link_account_with_email(email, member.id)

                        if (result.status == true) {
                            var { level } = result.data
                            if (level == undefined) {
                                level = 0
                            }

                            var guild = await client.guilds.cache.get(GUILD_ID)

                            var role = await guild.roles.cache.find(role => role.name === "member");

                            if (role) {
                                var member = await guild.members.cache.get(member.id) || await guild.members.fetch(member.id).catch(err => { });

                                var data = await member.roles.add(role)
                                var owner = await guild.fetchOwner()
                                if (owner.user.id != member.id) {
                                    if (member) {
                                        await member.setNickname(`${member.user.username} LV ${level}`)
                                    }
                                }
                            }
                            // prepare for reward coupon

                            await interaction.reply({ content: `✅ Thank you to join us <@${member.id}>!\nYour email is \`${email}\` \n Coupon code \`ILOVENAKA\`  Go to our platform to claim your rewards! [let's play games](https://www.nakamoto.games/coupon)`, ephemeral: true });
                            //await interaction.reply({ content: `✅ Thank you to join us <@${member.user.id}>!\nYour email is \`${email}\` \nGo to our platform to claim your rewards! [let's play games](https://nakamoto.games)`, ephemeral: true });

                        } else {
                            await interaction.reply({ content: `❗️ ${result.message}`, ephemeral: true })
                        }
                    } catch (error) {
                        console.log(error);
                        await interaction.reply({ content: error.message, ephemeral: true })
                    }

                    return

                } else {
                    console.log(interaction);
                    return
                }
            });

            client.on('messageReactionAdd', async (reaction, user) => {
                // When a reaction is received, check if the structure is partial
                if (reaction.partial) {
                    // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
                    try {
                        var reaction_item = await reaction.fetch();

                    } catch (error) {
                        console.error('Something went wrong when fetching the message:', error);
                        // Return as `reaction.message.author` may be undefined/null
                        return;
                    }
                }

                var response = await reaction_event(reaction.message.author.id, 10)
                if (response.status == true) {
                    console.log("increse Exp it done");
                } else {
                    console.log(response.message)
                }
                //console.log("owner message user_id :", reaction.message.author.id, ",", "user reaction user_id", user.id);

            });

            client.on('messageReactionRemove', async (reaction, user) => {
                var response = await reaction_event(reaction.message.author.id, -10)
                if (response.status == true) {
                    console.log("decrese Exp it done");
                } else {
                    console.log(response.message)
                }
            });

            client.on('guildMemberAdd', async (member) => {
                console.log("new player comening member", member.id);
                await wellcomeMessageDM(member)
                //await member.guild.channels.get(SERVER_MESSAGE_CHANNEL_ID).send("Welcome");
            });


        })
        .catch((error) => {
            console.log(DISCORD_TOKEN);
            console.log("Discord Server it not ready", error.message);
            process.exit(0);
        })

})

async function submit_link_account_with_email(email, discord_account_id) {
    return axios.put(`${API_NAKAMOTO}/api/profile/link-profile-discord`, {
        email: email,
        discord_id: String(discord_account_id)
    })
        .then((response) => {
            return response.data
        })
        .catch((error) => {
            console.log(error);
            throw new Error("Cannot connect to API nakamoto.game")
        })
}


async function reaction_event(discord_account_id, exp) {
    return axios.post(`${API_NAKAMOTO}/api/profile/discord/reaction/${discord_account_id}`, { exp })
        .then((response) => {
            return response.data
        })
        .catch((error) => {
            console.log(error);
            throw new Error("Cannot connect to API nakamoto.game")
        })
}

async function CreateEvent() {
    try {
        var guild = client.guilds.cache.get(GUILD_ID)
        if (guild) {

            // Get the current date
            const currentDate = new Date();

            // Get the date for tomorrow
            const tomorrowDate = new Date();
            tomorrowDate.setDate(currentDate.getDate() + 1);

            // Get the date for the next two days
            const nextTwoDaysDate = new Date();
            nextTwoDaysDate.setDate(currentDate.getDate() + 2);

            var event = await guild.scheduledEvents.create({
                name: "Test Event",
                description: "For test only",
                scheduledStartTime: tomorrowDate.toISOString(),
                scheduledEndTime: nextTwoDaysDate.toISOString(),
                entityType: GuildScheduledEventEntityType.External,
                privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
                entityMetadata: { location: "https://www.nakamoto.games" }
            })

            return true
        } else {
            throw new Error("guild not found ")
        }
    } catch (error) {
        console.log(error);
        throw error
    }

}

async function wellcomeMessage(_client) {
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('link_account_button')
                .setLabel('Link Account')
                .setStyle(ButtonStyle.Success),
        )



    await _client.channels.cache.get(WELLCOME_CHANNEL_ID).send({ content: `link your Discord's account (Email) with our platform`, components: [row] });
    await _client.channels.cache.get(WELLCOME_CHANNEL_ID).send({ content: `After linked your Discord's account (Email) with our platform,  you need to check our documentation: https://docs.nakamoto.games/ to getting to know more about us. 🙂` });
}

async function wellcomeMessageDM(member) {
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('link_account_button')
                .setLabel('Link Account')
                .setStyle(ButtonStyle.Success),
        )



    await member.send({ content: `link your Discord's account (Email) with our platform`, components: [row] });
    await member.send({ content: `After linked your Discord's account (Email) with our platform,  you need to check our documentation: https://docs.nakamoto.games/ to getting to know more about us. 🙂` });
}

function validateEmail(email) {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
};

function add_coin(new_coin) {
    coin.push(String(new_coin).toUpperCase())
    fs.writeFileSync("./coin.json", JSON.stringify(coin, null, 4))
}

async function remove_coin(coin_remove) {
    coin = coin.filter((symbol) => {
        return !(String(symbol).toLowerCase() == String(coin_remove).toLowerCase())
    })
    // remov channels
    const guild = client.guilds.cache.get(GUILD_ID)
    await guild.channels.cache.filter(x => {
        return String(`${coin_remove}-USDT`).toLowerCase() == x.name
    }).forEach(async (channelItem) => {
        await channelItem.delete()
    })
    fs.writeFileSync("./coin.json", JSON.stringify(coin, null, 4))
}

async function coinTracking() {
    try {
        var dataCoinMarketCap = await getCoinMarketCap(coin)

        if (Object.keys(dataCoinMarketCap).length > 0) {
            const guild = client.guilds.cache.get(GUILD_ID)

            // find category channel
            var findCategory = await guild.channels.cache.find((x) => x.name == "Cryptocurrency")

            var cryptoCategory = null
            if (findCategory) { // category exists
                cryptoCategory = findCategory
            } else {
                var category = await guild.channels.create({
                    type: TYPE_CHANNEL.CATEGORIES,
                    name: "Cryptocurrency",
                })
                cryptoCategory = category
            }

            for (const coinName of Object.keys(dataCoinMarketCap)) {
                var findChannelCoin = await guild.channels.cache.find(x => x.name == String(`${coinName}-USDT`).toLocaleLowerCase())
                var channelCoin = null

                var sideColor = (dataCoinMarketCap[coinName].quote.USD.percent_change_24h > 0) ? 0x6BFA12 : 0xFA122C
                // inside a command, event listener, etc.
                const exampleEmbed = new EmbedBuilder()
                    .setColor(sideColor)
                    .setTitle(dataCoinMarketCap[coinName].name)
                    .setURL(`https://coinmarketcap.com/currencies/${dataCoinMarketCap[coinName].slug}/`)
                    .setAuthor({ name: 'Nakamoto.games', iconURL: 'https://files.naka.im/seo/favicon.png', url: 'https://www.nakamoto.games/' })
                    .setThumbnail(`https://s2.coinmarketcap.com/static/img/coins/64x64/${dataCoinMarketCap[coinName].id}.png`)
                    .addFields(
                        { name: 'Current Price', value: String(dataCoinMarketCap[coinName].quote.USD.price), inline: true },
                        { name: '24hr Volumn', value: String(dataCoinMarketCap[coinName].quote.USD.volume_24h), inline: true },
                        { name: 'Volumn Change', value: String(dataCoinMarketCap[coinName].quote.USD.volume_change_24h), inline: true },
                    )
                    .addFields(
                        { name: '% Change 24h', value: String(dataCoinMarketCap[coinName].quote.USD.percent_change_24h), inline: true },
                        { name: '% Change 7d', value: String(dataCoinMarketCap[coinName].quote.USD.percent_change_7d), inline: true },
                        { name: '% Change 30d', value: String(dataCoinMarketCap[coinName].quote.USD.percent_change_30d), inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'nakamoto.games', iconURL: 'https://files.naka.im/seo/favicon.png' });


                if (findChannelCoin) {
                    channelCoin = findChannelCoin
                    var messages = await channelCoin.messages.fetch({ limit: 10 })
                    messages.forEach(async message => {
                        if (message.embeds.length > 0) {
                            await message.edit({ embeds: [exampleEmbed] })
                        } else {
                            console.log("ignore mossage");
                        }
                    })
                } else {
                    channelCoin = await guild.channels.create({
                        type: TYPE_CHANNEL.TEXT,
                        name: `${coinName}-USDT`,
                        parent: cryptoCategory.id
                    })
                    await channelCoin.send({ embeds: [exampleEmbed] });
                }
            }

            console.log("Coin Tracker process it done", new Date());
        } else {
            console.log("empty coin");
        }



    } catch (error) {
        console.log(error);
    }

}

async function getCoinMarketCap(coinArray = []) {
    try {
        var response = await axios.get("https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest", {
            headers: {
                ["X-CMC_PRO_API_KEY"]: COINMARKETCAP_API_KEY
            },
            params: {
                symbol: coinArray.join(",")
            }
        })

        var data_return = {

        }

        Object.keys(response.data.data).forEach((key) => {
            // console.log(response.data.data);

            if (response.data.data[key].length > 0) {
                data_return[key] = response.data.data[key][0]
            }
        })

        return data_return

    } catch (error) {
        throw new Error(error)
    }
}

async function renderTopPlayer(data ) {
    var rank = [{"_id":"61b0d7f5a9c230548a429347","naka_earn":23887.916222279764,"username":"Cryptodoi","avatar":"https://nakamoto-prod-new.s3.eu-central-1.amazonaws.com/naka-punk-new/8932.png"},{"_id":"635c15429d357003fd07284f","naka_earn":21275.43474227977,"username":"Mojo","avatar":"https://nakamoto-s3.s3.ap-southeast-1.amazonaws.com/setting/avatar/avatar_3/f776bba25a55d3bf53181642d26812d7/image/f776bba25a55d3bf53181642d26812d7.Rank3.png"},{"_id":"61e26d3ebca1be50a6494d0f","naka_earn":12328.145851332036,"username":"Hybis","avatar":"https://nakamoto-s3.s3.ap-southeast-1.amazonaws.com/setting/avatar/avatar_7/243f64b5f7316e94169161ad6ab4efd8/image/243f64b5f7316e94169161ad6ab4efd8.Rank7.png"},{"_id":"61e81f7eab90065c46f79aa5","naka_earn":11816.39871,"username":"Waen","avatar":"https://nakamoto-s3.s3.ap-southeast-1.amazonaws.com/setting/avatar/avatar_17/59949370e16c7ba1e565712fd32d6901/image/7cab444d0c6030ab382e7bb5a1c58524.avatar17.png"},{"_id":"61e28933bca1be50a649a6ed","naka_earn":10771.411001332042,"username":"Chai","avatar":"https://nakamoto-s3.s3.ap-southeast-1.amazonaws.com/setting/avatar/avatar_10/1573269daada86835f0a811ced27bfc3/image/1573269daada86835f0a811ced27bfc3.avatar10.png"},{"_id":"61feedff61f04a6fa627c7cd","naka_earn":10608.94503,"username":"Goodiepie","avatar":"https://nakamoto-s3.s3.ap-southeast-1.amazonaws.com/setting/avatar/avatar_4/8590739e7447041975cd522cd17c39ef/image/8590739e7447041975cd522cd17c39ef.Rank4.png"},{"_id":"61fd74e461f04a6fa62260ee","naka_earn":10208.935110000002,"username":"Jannil","avatar":"https://nakamoto-s3.s3.ap-southeast-1.amazonaws.com/setting/avatar/avatar_21/464ab071e51cdc365ffe9a787f11a8f2/image/464ab071e51cdc365ffe9a787f11a8f2.giphy%20%281%29.gif"},{"_id":"61b10b80ea379415e8b88f14","naka_earn":9927.239640000002,"username":"Danniej123","avatar":"https://nakamoto-s3.s3.ap-southeast-1.amazonaws.com/setting/avatar/avatar_4/8590739e7447041975cd522cd17c39ef/image/8590739e7447041975cd522cd17c39ef.Rank4.png"},{"_id":"635c19c79d357003fd0740d1","naka_earn":8909.499240000001,"username":"Pon","avatar":"https://nakamoto-s3.s3.ap-southeast-1.amazonaws.com/setting/avatar/avatar_9/733422c3072d271daa25e15b01863c2e/image/733422c3072d271daa25e15b01863c2e.avatar9.png"},{"_id":"61b0f211c5c7011225d4cbfb","naka_earn":8769.57011,"username":"patrykoS","avatar":"https://nakamoto-prod-new.s3.eu-central-1.amazonaws.com/naka-punk-new/4171.png"}]
    const cat_name = 'GAME-PLAYER'
    const guild = client.guilds.cache.get(GUILD_ID)
    var find_top_player_chanel = await guild.channels.cache.find((data) => {
        return data.name == cat_name
    })
    var game_cat = null
    if(find_top_player_chanel) {
        game_cat = find_top_player_chanel
    } else {
        var cat = await guild.channels.create({
            type : TYPE_CHANNEL.CATEGORIES,
            name : cat_name
        })
        game_cat = cat
    }
    // console.log(game_cat)
    // find category channel
    var find_top_player_chanel = await guild.channels.cache.find((data) => {
        return data.parentId == game_cat.id && data.name == 'top-player'
    })
    if (find_top_player_chanel) {
        await find_top_player_chanel.delete()
    } 
    find_top_player_chanel = await guild.channels.create({
        type: TYPE_CHANNEL.TEXT,
        name : 'top-player',
        parent : game_cat.id
    })
    var runing = 1
    for (const data of rank) {
        try {
            const exampleEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`No. #${runing}`)
            .setURL('https://discord.js.org/')
            .setAuthor({ name: 'Nakamoto.games', iconURL: 'https://www.nakamoto.games/favicon.png', url: 'https://www.nakamoto.games/' })
            .setDescription(`Username : ${data.username}`)
            .setThumbnail(`${data.avatar}`)
            .addFields(
                { name: 'Naka Earn', value: `${data.naka_earn}` },
                // { name: '\u200B', value: '\u200B' },
                // { name: 'Inline field title', value: 'Some value here', inline: true },
                // { name: 'Inline field title', value: 'Some value here', inline: true },
            )
            // .addFields({ name: 'Inline field title', value: 'Some value here', inline: true })
            // .setImage('https://i.imgur.com/AfFp7pu.png')
            .setTimestamp()
            .setFooter({ text: 'nakamoto.games', iconURL: 'https://www.nakamoto.games/favicon.png' });
    
            await find_top_player_chanel.send({ embeds: [exampleEmbed] });
            runing++

        } catch (error) {
            console.log(error)
            continue;
        }
       
    }
        

    
    
}

// When the client is ready, run this code (only once)-
client.once('ready', async () => {
    console.log('Ready!');
    //await wellcomeMessage(client)
    // await coinTracking()
    cron.schedule('*/7 * * * *', function () {
        coinTracking().catch(console.dir);
    });
});
