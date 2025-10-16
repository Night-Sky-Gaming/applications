const { Events, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		// Handle slash commands
		if (interaction.isChatInputCommand()) {
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			try {
				await command.execute(interaction);
			}
			catch (error) {
				console.error(`Error executing ${interaction.commandName}`);
				console.error(error);
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({
						content: 'There was an error while executing this command!',
						flags: MessageFlags.Ephemeral,
					});
				}
				else {
					await interaction.reply({
						content: 'There was an error while executing this command!',
						flags: MessageFlags.Ephemeral,
					});
				}
			}
		}
		// Handle button interactions
		else if (interaction.isButton()) {
			if (interaction.customId === 'create_application') {
				// Create the modal
				const modal = new ModalBuilder()
					.setCustomId('application_modal')
					.setTitle('Andromeda Gaming Application');

				// Create the text inputs
				const usernameInput = new TextInputBuilder()
					.setCustomId('username_input')
					.setLabel('Username')
					.setStyle(TextInputStyle.Short)
					.setMinLength(2)
					.setMaxLength(32)
					.setPlaceholder('Enter your preferred username...')
					.setRequired(true);

				const ageInput = new TextInputBuilder()
					.setCustomId('age_input')
					.setLabel('Age')
					.setStyle(TextInputStyle.Short)
					.setMinLength(1)
					.setMaxLength(3)
					.setPlaceholder('Enter your age...')
					.setRequired(true);

				const recruiterInput = new TextInputBuilder()
					.setCustomId('recruiter_input')
					.setLabel('Recruiter Discord Tag')
					.setStyle(TextInputStyle.Short)
					.setMinLength(2)
					.setMaxLength(37)
					.setPlaceholder('Enter your recruiter\'s Discord tag...')
					.setRequired(true);

				const reasonInput = new TextInputBuilder()
					.setCustomId('reason_input')
					.setLabel('Why do you want to join Andromeda Gaming?')
					.setStyle(TextInputStyle.Paragraph)
					.setMinLength(10)
					.setMaxLength(1000)
					.setPlaceholder('Tell us why you want to join...')
					.setRequired(true);

				const gamesInput = new TextInputBuilder()
					.setCustomId('games_input')
					.setLabel('Main games you play')
					.setStyle(TextInputStyle.Paragraph)
					.setMinLength(3)
					.setMaxLength(500)
					.setPlaceholder('List your main games...')
					.setRequired(true);

				// Add inputs to action rows
				const row1 = new ActionRowBuilder().addComponents(usernameInput);
				const row2 = new ActionRowBuilder().addComponents(ageInput);
				const row3 = new ActionRowBuilder().addComponents(recruiterInput);
				const row4 = new ActionRowBuilder().addComponents(reasonInput);
				const row5 = new ActionRowBuilder().addComponents(gamesInput);

				// Add all action rows to the modal
				modal.addComponents(row1, row2, row3, row4, row5);

				// Show the modal
				await interaction.showModal(modal);
			}
		}
		// Handle modal submissions
		else if (interaction.isModalSubmit()) {
			if (interaction.customId === 'application_modal') {
				// Get the values from the modal
				const username = interaction.fields.getTextInputValue('username_input').trim();
				const age = interaction.fields.getTextInputValue('age_input').trim();
				const recruiter = interaction.fields.getTextInputValue('recruiter_input').trim();
				const reason = interaction.fields.getTextInputValue('reason_input').trim();
				const games = interaction.fields.getTextInputValue('games_input').trim();

				// Get the guild
				const guild = interaction.client.guilds.cache.first();

				if (!guild) {
					await interaction.reply({
						content: 'Unable to find the server. Please try again later.',
						flags: MessageFlags.Ephemeral,
					});
					return;
				}

				try {
					// Fetch the member from the guild
					const member = await guild.members.fetch(interaction.user.id);

					if (!member) {
						await interaction.reply({
							content: 'Unable to find you in the server. Please try again later.',
							flags: MessageFlags.Ephemeral,
						});
						return;
					}

					// Try to find the "Member" role
					const memberRole = guild.roles.cache.find(role => role.name === 'Member');

					if (!memberRole) {
						console.error('Member role not found!');

						// Send error message to default text channel
						const defaultChannel = guild.systemChannel || guild.channels.cache.find(
							channel => channel.type === ChannelType.GuildText && channel.permissionsFor(guild.members.me).has('SendMessages'),
						);

						if (defaultChannel) {
							const errorEmbed = new EmbedBuilder()
								.setTitle('⚠️ Configuration Error')
								.setDescription('The "Member" role does not exist. Please create a role named "Member" for the application system to work properly.')
								.setColor(0xFF0000)
								.setTimestamp();

							await defaultChannel.send({ embeds: [errorEmbed] });
						}

						await interaction.reply({
							content: 'There was an error processing your application. The Member role is not configured. Please contact a server administrator.',
							flags: MessageFlags.Ephemeral,
						});
						return;
					}

					// Add the Member role to the user
					let roleAdded = true;
					try {
						await member.roles.add(memberRole);
					}
					catch (roleError) {
						roleAdded = false;
						console.error('Error adding Member role:', roleError.message);
					}

					// Change the user's nickname to their username
					let nicknameChanged = true;
					let nicknameErrorReason = '';
					try {
						// Check if we can actually change the nickname before attempting
						if (member.id === guild.ownerId) {
							nicknameChanged = false;
							nicknameErrorReason = 'You are the server owner';
						}
						else if (!guild.members.me.permissions.has('ManageNicknames')) {
							nicknameChanged = false;
							nicknameErrorReason = 'Bot lacks Manage Nicknames permission';
						}
						else if (member.roles.highest.position >= guild.members.me.roles.highest.position) {
							nicknameChanged = false;
							nicknameErrorReason = 'Your role is higher than or equal to the bot\'s role';
						}
						else {
							await member.setNickname(username);
						}
					}
					catch (nickError) {
						nicknameChanged = false;
						nicknameErrorReason = nickError.message;
						console.error('Error setting nickname:', nickError.message);
					}

					// Send success message
					let descriptionText = `Welcome to Andromeda Gaming, **${username}**!`;
					
					// Add warnings if something didn't work
					if (!roleAdded) {
						descriptionText += '\n\n⚠️ **Error:** Could not add the Member role. Please contact an administrator.';
					}
					if (!nicknameChanged) {
						descriptionText += `\n\n⚠️ **Note:** Could not change your nickname automatically (${nicknameErrorReason}). Please contact a moderator if you want your nickname changed.`;
					}

					const successEmbed = new EmbedBuilder()
						.setTitle(roleAdded ? '✅ Application Submitted!' : '⚠️ Application Submitted (with issues)')
						.setDescription(descriptionText)
						.setColor(roleAdded && nicknameChanged ? 0x00FF00 : 0xFFA500)
						.addFields(
							{ name: 'Username', value: username, inline: true },
							{ name: 'Age', value: age, inline: true },
							{ name: 'Recruiter', value: recruiter, inline: true },
							{ name: 'Why join?', value: reason },
							{ name: 'Main Games', value: games },
						)
						.setFooter({ text: roleAdded ? 'You have been given the Member role!' : 'Application received!' })
						.setTimestamp();

					await interaction.reply({
						embeds: [successEmbed],
						flags: MessageFlags.Ephemeral,
					});

					console.log(`Application submitted by ${interaction.user.tag} (${username}) - Role: ${roleAdded ? 'Added' : 'Failed'}, Nickname: ${nicknameChanged ? 'Changed' : 'Failed'}`);
				}
				catch (error) {
					console.error('Error processing application:', error);
					await interaction.reply({
						content: 'There was an error processing your application. Please try again later.',
						flags: MessageFlags.Ephemeral,
					});
				}
			}
		}
	},
};
