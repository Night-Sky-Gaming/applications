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

				const guild = interaction.guild;

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

						// Add ONLY the main game role (not other games)
						let mainGameRoleAdded = false;
						let mainGameRoleMissing = false;

						if (appData && appData.mainGame) {
							console.log(`Looking for main game role: "${appData.mainGame}"`);
							console.log('Available roles:', guild.roles.cache.map(r => `"${r.name}"`).join(', '));
							
							const mainGameRole = guild.roles.cache.find(
								(role) => role.name === appData.mainGame,
							);
							
							if (mainGameRole) {
								console.log(`Found role: ${mainGameRole.name} (ID: ${mainGameRole.id})`);
								try {
									await member.roles.add(mainGameRole);
									mainGameRoleAdded = true;
									console.log(`Successfully added role ${mainGameRole.name} to ${member.user.tag}`);
								}
								catch (roleError) {
									console.error(
										`Error adding main game role ${appData.mainGame}:`,
										roleError.message,
									);
									mainGameRoleMissing = true;
								}
							}
							else {
								console.log(`Role "${appData.mainGame}" not found in server`);
								mainGameRoleMissing = true;
							}
						}							// Update the message
							const originalEmbed = interaction.message.embeds[0];
							const acceptedEmbed = EmbedBuilder.from(originalEmbed)
								.setColor(0x00ff00)
								.setTitle('✅ Application Accepted')
								.addFields({
									name: 'Processed By',
									value: `${interaction.user.tag}`,
									inline: true,
								});

						if (mainGameRoleAdded) {
							acceptedEmbed.addFields({
								name: 'Main Game Type Role Added',
								value: appData.mainGame,
							});
						}

						if (mainGameRoleMissing) {
							acceptedEmbed.addFields({
								name: '⚠️ Main Game Type Role Missing',
								value: appData.mainGame || 'Unknown',
							});
						}

						if (appData && appData.otherGames && appData.otherGames.length > 0) {
							acceptedEmbed.addFields({
								name: 'ℹ️ Other Game Types (Level 5+ Access)',
								value: appData.otherGames.join(', '),
							});
						}							await interaction.update({
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

						// Close the application thread
						if (appData && appData.threadId) {
							try {
								const applicationChannel = guild.channels.cache.find(
									(channel) =>
										channel.name === 'application' &&
										channel.type === ChannelType.GuildText,
								);
								if (applicationChannel) {
									const thread = await applicationChannel.threads.fetch(appData.threadId);
									if (thread) {
										await thread.setLocked(true);
										await thread.setArchived(true);
									}
								}
							} catch (threadError) {
								console.error('Error closing application thread:', threadError);
							}
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
						// Deny application - show modal to get rejection reason
						const rejectModal = new ModalBuilder()
							.setCustomId(`reject_reason_modal_${userId}`)
							.setTitle('Application Rejection Reason');

						const reasonInput = new TextInputBuilder()
							.setCustomId('reject_reason_input')
							.setLabel('Reason for rejection')
							.setStyle(TextInputStyle.Paragraph)
							.setMinLength(10)
							.setMaxLength(500)
							.setPlaceholder('Enter the reason for rejecting this application...')
							.setRequired(true);

						const reasonRow = new ActionRowBuilder().addComponents(reasonInput);
						rejectModal.addComponents(reasonRow);

						await interaction.showModal(rejectModal);
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

				// Add inputs to action rows
				const row1 = new ActionRowBuilder().addComponents(usernameInput);
				const row2 = new ActionRowBuilder().addComponents(ageInput);

				// Add all action rows to the modal
				modal.addComponents(row1, row2);

				// Show the modal
				await interaction.showModal(modal);
			}
			// Handle skip other games button
			else if (interaction.customId.startsWith('skip_other_games_')) {
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
				
				// Complete the application with no other games
				await completeApplicationSubmission(interaction, appData, []);
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

			// Create a select menu for main game type (single selection)
			 const mainGameSelect = new StringSelectMenuBuilder()
				.setCustomId(`main_game_select_${interaction.user.id}`)
				.setPlaceholder('Select your MAIN game type')
				.setMinValues(1)
				.setMaxValues(1)
				.addOptions(
					new StringSelectMenuOptionBuilder()
						.setLabel('Battle Royale')
						.setValue('Battle Royale'),
					new StringSelectMenuOptionBuilder()
						.setLabel('FPS')
						.setValue('FPS'),
					new StringSelectMenuOptionBuilder()
						.setLabel('3rd PS')
						.setValue('3rd PS'),
					new StringSelectMenuOptionBuilder()
						.setLabel('Social')
						.setValue('Social'),
					new StringSelectMenuOptionBuilder()
						.setLabel('Open World')
						.setValue('Open World'),
					new StringSelectMenuOptionBuilder()
						.setLabel('MOBA')
						.setValue('MOBA'),
					new StringSelectMenuOptionBuilder()
						.setLabel('Sports')
						.setValue('Sports'),
				);				const selectRow = new ActionRowBuilder().addComponents(mainGameSelect);

				// Store the application data temporarily (we'll use this when they select games)
				// We'll store it in the client's temporary storage
				if (!interaction.client.pendingApplications) {
					interaction.client.pendingApplications = new Map();
				}

				interaction.client.pendingApplications.set(interaction.user.id, {
					username,
					age,
				});			// Send the main game type selection menu
			const selectEmbed = new EmbedBuilder()
				.setTitle('📝 Select Your Main Game Type')
				.setDescription(
					'Please select your **MAIN game type** from the dropdown menu below.\n\n' +
					'You will receive the role for this game type upon acceptance.',
				)
					.setColor(0x5865f2)
					.setTimestamp();

				await interaction.reply({
					embeds: [selectEmbed],
					components: [selectRow],
					flags: MessageFlags.Ephemeral,
				});
			}
			// Handle reject reason modal submission
			else if (interaction.customId.startsWith('reject_reason_modal_')) {
				const userId = interaction.customId.split('_').pop();
				const rejectReason = interaction.fields
					.getTextInputValue('reject_reason_input')
					.trim();

				const guild = interaction.guild;

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
							content: 'Unable to find this user in the server. They may have left.',
							flags: MessageFlags.Ephemeral,
						});
						return;
					}

					// Send DM to the user with rejection reason
					let dmSent = true;
					try {
						const dmEmbed = new EmbedBuilder()
							.setTitle('❌ Application Declined')
							.setDescription(
								'Your application to Andromeda Gaming has been declined.\n\n' +
								'**Reason:**\n```\n' + rejectReason + '\n```'
							)
							.setColor(0xff0000)
							.setTimestamp();

						await member.send({ embeds: [dmEmbed] });
					}
					catch (dmError) {
						dmSent = false;
						console.log(`Could not DM user ${member.user.tag}`);
					}

					// Update the message in the new-applications channel
					const originalEmbed = interaction.message.embeds[0];
					const deniedEmbed = EmbedBuilder.from(originalEmbed)
						.setColor(0xff0000)
						.setTitle('❌ Application Denied')
						.addFields(
							{
								name: 'Processed By',
								value: `${interaction.user.tag}`,
								inline: true,
							},
							{
								name: 'Rejection Reason',
								value: '```\n' + rejectReason + '\n```',
							}
						);

					if (!dmSent) {
						deniedEmbed.addFields({
							name: '⚠️ DM Status',
							value: 'Could not send DM to user (DMs may be disabled)',
						});
					}

					await interaction.update({
						embeds: [deniedEmbed],
						components: [],
					});

					// Close the application thread
					const appData = interaction.client.applicationData?.get(userId);
					if (appData && appData.threadId) {
						try {
							const applicationChannel = interaction.client.channels.cache.get('1434215324265222164');
							if (applicationChannel) {
								const thread = await applicationChannel.threads.fetch(appData.threadId);
								if (thread) {
									await thread.setLocked(true);
									await thread.setArchived(true);
								}
							}
						} catch (threadError) {
							console.error('Error closing application thread:', threadError);
						}
					}

					// Clean up application data
					if (interaction.client.applicationData) {
						interaction.client.applicationData.delete(userId);
					}
				}
				catch (error) {
					console.error('Error processing rejection:', error);
					await interaction.reply({
						content: `Error processing rejection: ${error.message}`,
						flags: MessageFlags.Ephemeral,
					});
				}
			}
		}
		// Handle select menu interactions
		else if (interaction.isStringSelectMenu()) {
			// Handle main game selection
			if (interaction.customId.startsWith('main_game_select_')) {
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
				
				// Get the selected main game (only one)
				const mainGame = interaction.values[0];
				
				// Store main game in application data
				appData.mainGame = mainGame;
				interaction.client.pendingApplications.set(interaction.user.id, appData);

			// Create a select menu for other game types (multiple selection)
			const otherGamesSelect = new StringSelectMenuBuilder()
				.setCustomId(`other_games_select_${interaction.user.id}`)
				.setPlaceholder('Select other game types you play (optional)')
				.setMinValues(0)
				.setMaxValues(6) // Max 6 since they already selected 1 as main
				.addOptions(
					new StringSelectMenuOptionBuilder()
						.setLabel('Battle Royale')
						.setValue('Battle Royale'),
					new StringSelectMenuOptionBuilder()
						.setLabel('FPS')
						.setValue('FPS'),
					new StringSelectMenuOptionBuilder()
						.setLabel('3rd PS')
						.setValue('3rd PS'),
					new StringSelectMenuOptionBuilder()
						.setLabel('Social')
						.setValue('Social'),
					new StringSelectMenuOptionBuilder()
						.setLabel('Open World')
						.setValue('Open World'),
					new StringSelectMenuOptionBuilder()
						.setLabel('MOBA')
						.setValue('MOBA'),
					new StringSelectMenuOptionBuilder()
						.setLabel('Sports')
						.setValue('Sports'),
				);				const selectRow = new ActionRowBuilder().addComponents(otherGamesSelect);

			// Add a skip button for users who only play their main game type
			const skipButton = new ButtonBuilder()
				.setCustomId(`skip_other_games_${interaction.user.id}`)
				.setLabel('Skip - I only play my main game type')
				.setStyle(ButtonStyle.Secondary);				const buttonRow = new ActionRowBuilder().addComponents(skipButton);

			// Send the other game types selection menu
			const selectEmbed = new EmbedBuilder()
				.setTitle('📝 Select Other Game Types (Optional)')
				.setDescription(
					`**Your Main Game Type:** ${mainGame}\n\n` +
					'Select any **other game types** you play from the dropdown menu below.\n\n' +
					'⚠️ **Note:** You will get access to these game type channels once you reach **Level 5**.\n\n' +
					'If you only play your main game type, click the "Skip" button.',
				)
					.setColor(0x5865f2)
					.setTimestamp();

				await interaction.update({
					embeds: [selectEmbed],
					components: [selectRow, buttonRow],
				});
			}
			// Handle other games selection
			else if (interaction.customId.startsWith('other_games_select_')) {
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
				// Array of selected other games
				const otherGames = interaction.values;
				
				// Complete the application submission
				await completeApplicationSubmission(interaction, appData, otherGames);
			}
		}
	},
};

// Helper function to complete application submission
async function completeApplicationSubmission(interaction, appData, otherGames) {
	const mainGame = appData.mainGame;

	// Defer the interaction immediately to prevent timeout
	await interaction.deferUpdate();

	// Get the guild
	const guild = interaction.guild;

	if (!guild) {
		await interaction.followUp({
			content: 'Unable to find the server. Please try again later.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	try {
		// Fetch the member from the guild
		const member = await guild.members.fetch(interaction.user.id);

		if (!member) {
			await interaction.followUp({
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

			await interaction.followUp({
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

		// Build game fields text
		const mainGameText = mainGame;
		const otherGamesText = otherGames.length > 0 ? otherGames.join(', ') : 'None';

		// Get account creation date
		const accountCreated = member.user.createdAt.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});

		// Create a thread in the 'application' channel
		let threadLink = null;
		let threadId = null;
		const applicationChannel = interaction.client.channels.cache.get('1434215324265222164');

		if (applicationChannel) {
			try {
				const currentDate = new Date().toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
				});
				const threadName = `${appData.username}'s application - ${currentDate}`;

			// Create thread
			const thread = await applicationChannel.threads.create({
				name: threadName,
				autoArchiveDuration: 60, // Archive after 60 minutes of inactivity
				type: ChannelType.PrivateThread,
				reason: `Application thread for ${member.user.tag}`,
			});

			// Add the applicant to the thread so they can participate
			await thread.members.add(member.user.id);

			// Send initial message to thread
			const threadEmbed = new EmbedBuilder()
				.setTitle(`${appData.username}'s Application`)
				.setDescription(`Application submitted by ${member.user.tag}`)
				.setColor(0x5865f2)
				.addFields(
					{ name: 'Username', value: appData.username, inline: true },
					{ name: 'Age', value: appData.age, inline: true },
					{ name: 'Account Created', value: accountCreated, inline: true },
					{ name: 'Main Game Type', value: mainGameText, inline: true },
					{ name: 'Other Game Types', value: otherGamesText, inline: true },
				)
				.setThumbnail(member.user.displayAvatarURL())
				.setTimestamp();

			await thread.send({ embeds: [threadEmbed] });

			// Tag the role and the applicant user
			await thread.send({ content: `<@&1434216081177972848> ${member.user}` });

			threadLink = thread.url;
			threadId = thread.id;			// Note: Private threads don't create a starter message in the parent channel,
			// so there's no need to delete anything
		}
		catch (threadError) {
			console.error('Error creating application thread:', threadError);
		}
		}
		else {
			console.error('application channel not found!');
		}

		const successEmbed = new EmbedBuilder()
			.setTitle(
				roleAdded
					? '✅ Application Submitted!'
					: '⚠️ Application Submitted (with issues)',
			)
			.setDescription(descriptionText + (threadLink ? `\n\n**[View Your Application Thread](${threadLink})**` : ''))
			.setColor(roleAdded && nicknameChanged ? 0x00ff00 : 0xffa500)
			.addFields(
				{ name: 'Username', value: appData.username, inline: true },
				{ name: 'Age', value: appData.age, inline: true },
				{ name: 'Account Created', value: accountCreated, inline: true },
				{ name: 'Main Game Type', value: mainGameText, inline: true },
				{ name: 'Other Game Types', value: otherGamesText, inline: true },
			)
			.setFooter({
				text: 'Your application is pending moderator review!',
			})
			.setTimestamp();

		await interaction.editReply({
			embeds: [successEmbed],
			components: [],
		});		// Send application to new-applications channel for moderators
		const newApplicationsChannel = interaction.client.channels.cache.get('1440071317956067328');

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
					{ name: 'Account Created', value: accountCreated, inline: true },
					{ name: 'Main Game Type', value: mainGameText, inline: true },
					{ name: 'Other Game Types (Level 5+)', value: otherGamesText, inline: true },
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
				mainGame: mainGame,
				otherGames: otherGames,
				threadId: threadId,
			});

			await newApplicationsChannel.send({
				embeds: [applicationEmbed],
				components: [buttonRow],
			});

			// Send thread link message to new-applications channel
			if (threadLink) {
				await newApplicationsChannel.send({
					content: threadLink,
				});
			}
		}
		else {
			console.error('new-applications channel not found!');
		}

		// Clean up the pending application data
		interaction.client.pendingApplications.delete(interaction.user.id);

		console.log(
			`Application submitted by ${interaction.user.tag} (${appData.username}) - Role: ${roleAdded ? 'Added' : 'Failed'}, Nickname: ${nicknameChanged ? 'Changed' : 'Failed'}, Main Game: ${mainGame}, Other Games: ${otherGames.join(', ')}`,
		);
	}
	catch (error) {
		console.error('Error processing application:', error);
		await interaction.followUp({
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
