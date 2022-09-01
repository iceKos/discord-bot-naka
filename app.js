const express = require('express')
const dotenv = require('dotenv');
dotenv.config();
// Require the necessary discord.js classes
const { Client, ButtonBuilder, GatewayIntentBits, SlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonStyle, Routes, Partials } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { DISCORD_TOKEN, APP_ID, PUBLIC_KEY, GUILD_ID, WELLCOME_CHANNEL_ID, API_NAKAMOTO } = process.env;
const app = express()
const port = 3000
const axios = require("axios")
// Create a new client instance
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    // Login to Discord with your client's DISCORD_TOKEN
    client.login(DISCORD_TOKEN)
        .then(() => {

            // register command to bot discord
            const commands = [
                new SlashCommandBuilder().setName('ping').setDescription('Replies with pong!'),
                new SlashCommandBuilder().setName('server').setDescription('Replies with server info!'),
                new SlashCommandBuilder().setName('user').setDescription('Replies with user info!'),
                new SlashCommandBuilder()
                    .setName('link_account')
                    .setDescription('Asks you a series of questions!')
                //.addStringOption(option => option.setName('input').setDescription('Your email?').setRequired(true))

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
                            var role = interaction.guild.roles.cache.find(role => role.name === "member");
                            if (role) {
                                var member = interaction.guild.members.cache.get(interaction.member.user.id) || await interaction.guild.members.fetch(user.id).catch(err => { });
                                var data = member.roles.add(role)
                            }

                            var owner = await interaction.guild.fetchOwner()

                            if (owner.user.id != interaction.member.user.id) {
                                member.setNickname(`${interaction.member.user.username} LV 1`)
                            }

                            await interaction.reply({ content: `✅ Thank you to join us! <@${interaction.member.user.id}>.\n You email is \`${email}\` \n [LET PLAY GAME](https://nakamoto.games)`, ephemeral: true });
                        } else {
                            await interaction.reply({ content: `❗️ ${result.message}`, ephemeral: true })
                        }
                    } catch (error) {
                        await interaction.reply({ content: error.message, ephemeral: true })
                    }


                }else{
                    return
                }
            });

            client.on('messageReactionAdd', async (reaction, user) => {
                // When a reaction is received, check if the structure is partial
                if (reaction.partial) {
                    // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
                    try {
                        await reaction.fetch();
                    } catch (error) {
                        console.error('Something went wrong when fetching the message:', error);
                        // Return as `reaction.message.author` may be undefined/null
                        return;
                    }
                }

                console.log("owner message user_id :", reaction.message.author.id, ",", "user reaction user_id", user.id);

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

async function wellcomeMessage(_client) {
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('link_account_button')
                .setLabel('Link Account')
                .setStyle(ButtonStyle.Primary),
        );
    _client.channels.cache.get(WELLCOME_CHANNEL_ID).send({ content: 'Welcome and rule', components: [row] });
    console.log("wellcome and rule");
}

function validateEmail(email) {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
};


// When the client is ready, run this code (only once)-
client.once('ready', async () => {
    console.log('Ready!');
    await wellcomeMessage(client)
});


;