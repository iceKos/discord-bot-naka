const express = require('express')
const fs = require('fs')
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const cron = require('node-cron');
dotenv.config();
// Require the necessary discord.js classes
const { Client, EmbedBuilder, ButtonBuilder, GatewayIntentBits, SlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonStyle, Routes, Partials, CategoryChannel } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { DISCORD_TOKEN, APP_ID, PUBLIC_KEY, GUILD_ID, API_NAKAMOTO, SERVER_MESSAGE_CHANNEL_ID, COINMARKETCAP_API_KEY } = process.env;
const app = express()
const port = 3000
const axios = require("axios")
const coin = JSON.parse(fs.readFileSync("./coin.json", "utf8"))
// Create a new client instance
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions],
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

app.get('/', (req, res) => {
    res.json({
        status: 200,
        message: "Service it working"
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



app.listen(port, () => {
    // Login to Discord with your client's DISCORD_TOKEN
    client.login(DISCORD_TOKEN)
        .then(() => {

            // register command to bot discord
            const commands = [
                new SlashCommandBuilder().setName('ping').setDescription('Replies with pong!'),
                new SlashCommandBuilder().setName('server').setDescription('Replies with server info!')
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
                } else if (interaction.isModalSubmit()) {
                    const email = interaction.fields.getTextInputValue('emailNakamoto');

                    if (!validateEmail(email)) return await interaction.reply({ content: `❗️ incoret email format plase try again later`, ephemeral: true });

                    try {
                        var result = await submit_link_account_with_email(email, interaction.member.user.id)

                        if (result.status == true) {
                            var { level } = result.data
                            if (level == undefined) {
                                level = 0
                            }
                            var role = interaction.guild.roles.cache.find(role => role.name === "member");
                            if (role) {
                                var member = interaction.guild.members.cache.get(interaction.member.user.id) || await interaction.guild.members.fetch(user.id).catch(err => { });
                                var data = member.roles.add(role)
                                var owner = await interaction.guild.fetchOwner()
                                if (owner.user.id != interaction.member.user.id) {
                                    if (member) {
                                        await member.setNickname(`${interaction.member.user.username} LV ${level}`)
                                    }
                                }
                            }
                            await interaction.reply({ content: `✅ Thank you to join us <@${interaction.member.user.id}>!\nYour email is \`${email}\` \nGo to our platform to claim your rewards! [let's play games](https://nakamoto.games)`, ephemeral: true });
                        } else {
                            await interaction.reply({ content: `❗️ ${result.message}`, ephemeral: true })
                        }
                    } catch (error) {
                        console.log(error);
                        await interaction.reply({ content: error.message, ephemeral: true })
                    }


                } else {
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
        })
        .catch((error) => {
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

function validateEmail(email) {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
};

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

            await guild.channels.cache.filter(x => x.parentId == cryptoCategory.id).forEach(async (channelItem) => {
                await channelItem.delete()
            })
            for (const coinName of Object.keys(dataCoinMarketCap)) {
                var channelCoin = await guild.channels.create({
                    type: TYPE_CHANNEL.TEXT,
                    name: `${coinName}-USDT`,
                    parent: cryptoCategory.id
                })
                var sideColor = (dataCoinMarketCap[coinName].quote.USD.percent_change_24h > 0) ? 0x6BFA12 : 0xFA122C
                // inside a command, event listener, etc.
                const exampleEmbed = new EmbedBuilder()
                    .setColor(sideColor)
                    .setTitle(dataCoinMarketCap[coinName].name)
                    // .setURL('https://discord.js.org/')
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

                await channelCoin.send({ embeds: [exampleEmbed] });
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

// When the client is ready, run this code (only once)-
client.once('ready', async () => {
    console.log('Ready!');
    //await wellcomeMessage(client)
    cron.schedule('*/5 * * * *', function () {
        coinTracking().catch(console.dir);
    });
});
