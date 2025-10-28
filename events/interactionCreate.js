const {
	Events,
	MessageFlags,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ActionRowBuilder,
	EmbedBuilder,
	ChannelType,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		// Handle slash commands
		if (interaction.isChatInputCommand()) {
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				console.error(
					`No command matching ${interaction.commandName} was found.`,
				);
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
			// Handle accept/deny application buttons
			if (
				interaction.customId.startsWith('accept_application_') ||
				interaction.customId.startsWith('deny_application_')
			) {
				const userId = interaction.customId.split('_').pop();
				const isAccept = interaction.customId.startsWith('accept_application_');

				const guild = interaction.client.guilds.cache.first();

				if (!guild) {
					await interaction.reply({
						content: 'Unable to find the server.',
						flags: MessageFlags.Ephemeral,
					});
					return;
				}

				try {
					const member = await guild.members.fetch(userId);

					if (!member) {
						await interaction.reply({
							content:
								'Unable to find this user in the server. They may have left.',
							flags: MessageFlags.Ephemeral,
						});
						return;
					}

					if (isAccept) {
						// Accept application - give Member role and game roles
						const memberRole = guild.roles.cache.find(
							(role) => role.name === 'Member',
						);

						if (!memberRole) {
							await interaction.reply({
								content:
									'The "Member" role does not exist. Please create it first.',
								flags: MessageFlags.Ephemeral,
							});
							return;
						}

						// Get application data
						const appData = interaction.client.applicationData?.get(userId);

						try {
							// Add Member role
							await member.roles.add(memberRole);

							// Remove Applicant role
							const applicantRole = guild.roles.cache.find(
								(role) => role.name === 'Applicant',
							);
							if (applicantRole && member.roles.cache.has(applicantRole.id)) {
								await member.roles.remove(applicantRole);
							}

							// Add game roles if they exist
							const rolesAdded = [];
							const rolesMissing = [];

							if (appData && appData.games) {
								for (const gameName of appData.games) {
									const gameRole = guild.roles.cache.find(
										(role) => role.name === gameName,
									);
									if (gameRole) {
										try {
											await member.roles.add(gameRole);
											rolesAdded.push(gameName);
										}
										catch (roleError) {
											console.error(
												`Error adding role ${gameName}:`,
												roleError.message,
											);
											rolesMissing.push(gameName);
										}
									}
									else {
										rolesMissing.push(gameName);
									}
								}
							}

							// Update the message
							const originalEmbed = interaction.message.embeds[0];
							const acceptedEmbed = EmbedBuilder.from(originalEmbed)
								.setColor(0x00ff00)
								.setTitle('✅ Application Accepted')
								.addFields({
									name: 'Processed By',
									value: `${interaction.user.tag}`,
									inline: true,
								});

							if (rolesAdded.length > 0) {
								acceptedEmbed.addFields({
									name: 'Game Roles Added',
									value: rolesAdded.join(', '),
								});
							}

							if (rolesMissing.length > 0) {
								acceptedEmbed.addFields({
									name: '⚠️ Game Roles Missing',
									value: rolesMissing.join(', '),
								});
							}

							await interaction.update({
								embeds: [acceptedEmbed],
								components: [],
							});

							// Notify the user
							try {
								const dmEmbed = new EmbedBuilder()
									.setTitle('✅ Application Accepted!')
									.setDescription(
										'Your application to Andromeda Gaming has been accepted!',
									)
									.setColor(0x00ff00)
									.setTimestamp();

								await member.send({ embeds: [dmEmbed] });
							}
							catch {
								console.log(`Could not DM user ${member.user.tag}`);
							}

							// Clean up application data
							if (interaction.client.applicationData) {
								interaction.client.applicationData.delete(userId);
							}
						}
						catch (error) {
							console.error('Error accepting application:', error);
							await interaction.reply({
								content: `Error accepting application: ${error.message}`,
								flags: MessageFlags.Ephemeral,
							});
						}
					}
					else {
						// Deny application - kick user
						try {
							await member.kick('Application denied');

							// Update the message
							const originalEmbed = interaction.message.embeds[0];
							const deniedEmbed = EmbedBuilder.from(originalEmbed)
								.setColor(0xff0000)
								.setTitle('❌ Application Denied')
								.addFields({
									name: 'Processed By',
									value: `${interaction.user.tag}`,
									inline: true,
								});

							await interaction.update({
								embeds: [deniedEmbed],
								components: [],
							});

							// Clean up application data
							if (interaction.client.applicationData) {
								interaction.client.applicationData.delete(userId);
							}
						}
						catch (kickError) {
							console.error('Error kicking user:', kickError);

							// Update message to show kick failed
							const originalEmbed = interaction.message.embeds[0];
							const deniedEmbed = EmbedBuilder.from(originalEmbed)
								.setColor(0xff0000)
								.setTitle('❌ Application Denied (Kick Failed)')
								.addFields(
									{
										name: 'Processed By',
										value: `${interaction.user.tag}`,
										inline: true,
									},
									{
										name: '⚠️ Error',
										value: `Could not kick user: ${kickError.message}`,
									},
								);

							await interaction.update({
								embeds: [deniedEmbed],
								components: [],
							});

							await interaction.followUp({
								content: `⚠️ Could not kick user: ${kickError.message}`,
								flags: MessageFlags.Ephemeral,
							});
						}
					}
				}
				catch (error) {
					console.error('Error processing application action:', error);
					await interaction.reply({
						content: `Error processing application: ${error.message}`,
						flags: MessageFlags.Ephemeral,
					});
				}
			}
			// Handle create application button
			else if (interaction.customId === 'create_application') {
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

				// Add inputs to action rows
				const row1 = new ActionRowBuilder().addComponents(usernameInput);
				const row2 = new ActionRowBuilder().addComponents(ageInput);
				const row3 = new ActionRowBuilder().addComponents(recruiterInput);
				const row4 = new ActionRowBuilder().addComponents(reasonInput);

				// Add all action rows to the modal
				modal.addComponents(row1, row2, row3, row4);

				// Show the modal
				await interaction.showModal(modal);
			}
		}
		// Handle modal submissions
		else if (interaction.isModalSubmit()) {
			if (interaction.customId === 'application_modal') {
				// Get the values from the modal
				const username = interaction.fields
					.getTextInputValue('username_input')
					.trim();
				const age = interaction.fields.getTextInputValue('age_input').trim();
				const recruiter = interaction.fields
					.getTextInputValue('recruiter_input')
					.trim();
				const reason = interaction.fields
					.getTextInputValue('reason_input')
					.trim();

				// Create a select menu for games
				const gamesSelect = new StringSelectMenuBuilder()
					.setCustomId(`games_select_${interaction.user.id}`)
					.setPlaceholder('Select the games you play')
					.setMinValues(1)
					.setMaxValues(8)
					.addOptions(
						new StringSelectMenuOptionBuilder()
							.setLabel('Fortnite')
							.setValue('Fortnite'),
						new StringSelectMenuOptionBuilder()
							.setLabel('R6 Siege X')
							.setValue('R6 Siege X'),
						new StringSelectMenuOptionBuilder()
							.setLabel('Overwatch')
							.setValue('Overwatch'),
						new StringSelectMenuOptionBuilder()
							.setLabel('Magic the Gathering')
							.setValue('Magic the Gathering'),
						new StringSelectMenuOptionBuilder().setLabel('BR').setValue('BR'),
						new StringSelectMenuOptionBuilder().setLabel('FPS').setValue('FPS'),
						new StringSelectMenuOptionBuilder()
							.setLabel('Tabletop')
							.setValue('Tabletop'),
						new StringSelectMenuOptionBuilder()
							.setLabel('MOBA')
							.setValue('MOBA'),
					);

				const selectRow = new ActionRowBuilder().addComponents(gamesSelect);

				// Store the application data temporarily (we'll use this when they select games)
				// We'll store it in the client's temporary storage
				if (!interaction.client.pendingApplications) {
					interaction.client.pendingApplications = new Map();
				}

				interaction.client.pendingApplications.set(interaction.user.id, {
					username,
					age,
					recruiter,
					reason,
				});

				// Send the games selection menu
				const selectEmbed = new EmbedBuilder()
					.setTitle('📝 Select Your Games')
					.setDescription(
						'Please select the games you play from the dropdown menu below:',
					)
					.setColor(0x5865f2)
					.setTimestamp();

				await interaction.reply({
					embeds: [selectEmbed],
					components: [selectRow],
					flags: MessageFlags.Ephemeral,
				});
			}
		}
		// Handle select menu interactions
		else if (interaction.isStringSelectMenu()) {
			if (interaction.customId.startsWith('games_select_')) {
				// Get the stored application data
				if (
					!interaction.client.pendingApplications ||
					!interaction.client.pendingApplications.has(interaction.user.id)
				) {
					await interaction.reply({
						content:
							'Your application data expired. Please submit your application again.',
						flags: MessageFlags.Ephemeral,
					});
					return;
				}

				const appData = interaction.client.pendingApplications.get(
					interaction.user.id,
				);
				// Array of selected game names
				const selectedGames = interaction.values;

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
							content:
								'Unable to find you in the server. Please try again later.',
							flags: MessageFlags.Ephemeral,
						});
						return;
					}

					// Try to find the "Applicant" role
					const applicantRole = guild.roles.cache.find(
						(role) => role.name === 'Applicant',
					);

					if (!applicantRole) {
						console.error('Applicant role not found!');

						// Send error message to default text channel
						const defaultChannel =
							guild.systemChannel ||
							guild.channels.cache.find(
								(channel) =>
									channel.type === ChannelType.GuildText &&
									channel.permissionsFor(guild.members.me).has('SendMessages'),
							);

						if (defaultChannel) {
							const errorEmbed = new EmbedBuilder()
								.setTitle('⚠️ Configuration Error')
								.setDescription(
									'The "Applicant" role does not exist. Please create a role named "Applicant" for the application system to work properly.',
								)
								.setColor(0xff0000)
								.setTimestamp();

							await defaultChannel.send({ embeds: [errorEmbed] });
						}

						await interaction.reply({
							content:
								'There was an error processing your application. The Applicant role is not configured. Please contact a server administrator.',
							flags: MessageFlags.Ephemeral,
						});
						return;
					}

					// Add the Applicant role to the user
					let roleAdded = true;
					try {
						await member.roles.add(applicantRole);
					}
					catch (roleError) {
						roleAdded = false;
						console.error('Error adding Applicant role:', roleError.message);
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
						else if (
							member.roles.highest.position >=
							guild.members.me.roles.highest.position
						) {
							nicknameChanged = false;
							nicknameErrorReason =
								'Your role is higher than or equal to the bot\'s role';
						}
						else {
							await member.setNickname(appData.username);
						}
					}
					catch (nickError) {
						nicknameChanged = false;
						nicknameErrorReason = nickError.message;
						console.error('Error setting nickname:', nickError.message);
					}

					// Send success message
					let descriptionText =
						'Your application has been submitted for review!';

					// Add warnings if something didn't work
					if (!roleAdded) {
						descriptionText +=
							'\n\n⚠️ **Error:** Could not add the Applicant role. Please contact an administrator.';
					}
					if (!nicknameChanged) {
						descriptionText += `\n\n⚠️ **Note:** Could not change your nickname automatically (${nicknameErrorReason}). Please contact a moderator if you want your nickname changed.`;
					}

					const successEmbed = new EmbedBuilder()
						.setTitle(
							roleAdded
								? '✅ Application Submitted!'
								: '⚠️ Application Submitted (with issues)',
						)
						.setDescription(descriptionText)
						.setColor(roleAdded && nicknameChanged ? 0x00ff00 : 0xffa500)
						.addFields(
							{ name: 'Username', value: appData.username, inline: true },
							{ name: 'Age', value: appData.age, inline: true },
							{ name: 'Recruiter', value: appData.recruiter, inline: true },
							{ name: 'Why join?', value: appData.reason },
							{ name: 'Games', value: selectedGames.join(', ') },
						)
						.setFooter({
							text: 'Your application is pending moderator review!',
						})
						.setTimestamp();

					await interaction.update({
						embeds: [successEmbed],
						components: [],
					});

					// Send application to new-applications channel for moderators
					const newApplicationsChannel = guild.channels.cache.find(
						(channel) =>
							channel.name === 'new-applications' &&
							channel.type === ChannelType.GuildText,
					);

					if (newApplicationsChannel) {
						const applicationEmbed = new EmbedBuilder()
							.setTitle('📋 New Application')
							.setDescription(
								`**Applicant:** ${member.user.tag} (${member.user.id})`,
							)
							.setColor(0x5865f2)
							.addFields(
								{ name: 'Username', value: appData.username, inline: true },
								{ name: 'Age', value: appData.age, inline: true },
								{ name: 'Recruiter', value: appData.recruiter, inline: true },
								{ name: 'Why join?', value: appData.reason },
								{ name: 'Games', value: selectedGames.join(', ') },
							)
							.setThumbnail(member.user.displayAvatarURL())
							.setFooter({ text: `User ID: ${member.user.id}` })
							.setTimestamp();

						// Create Accept and Deny buttons
						const acceptButton = new ButtonBuilder()
							.setCustomId(`accept_application_${member.user.id}`)
							.setLabel('Accept')
							.setStyle(ButtonStyle.Success)
							.setEmoji('✅');

						const denyButton = new ButtonBuilder()
							.setCustomId(`deny_application_${member.user.id}`)
							.setLabel('Deny')
							.setStyle(ButtonStyle.Danger)
							.setEmoji('❌');

						const buttonRow = new ActionRowBuilder().addComponents(
							acceptButton,
							denyButton,
						);

						// Store the application data for later use when buttons are clicked
						if (!interaction.client.applicationData) {
							interaction.client.applicationData = new Map();
						}

						interaction.client.applicationData.set(member.user.id, {
							username: appData.username,
							age: appData.age,
							recruiter: appData.recruiter,
							reason: appData.reason,
							games: selectedGames,
						});

						await newApplicationsChannel.send({
							embeds: [applicationEmbed],
							components: [buttonRow],
						});
					}
					else {
						console.error('new-applications channel not found!');
					}

					// Clean up the pending application data
					interaction.client.pendingApplications.delete(interaction.user.id);

					console.log(
						`Application submitted by ${interaction.user.tag} (${appData.username}) - Role: ${roleAdded ? 'Added' : 'Failed'}, Nickname: ${nicknameChanged ? 'Changed' : 'Failed'}, Games: ${selectedGames.join(', ')}`,
					);
				}
				catch (error) {
					console.error('Error processing application:', error);
					await interaction.reply({
						content:
							'There was an error processing your application. Please try again later.',
						flags: MessageFlags.Ephemeral,
					});
					// Clean up on error
					if (interaction.client.pendingApplications) {
						interaction.client.pendingApplications.delete(interaction.user.id);
					}
				}
			}
		}
	},
};
