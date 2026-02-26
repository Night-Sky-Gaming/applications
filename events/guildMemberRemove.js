const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
	name: Events.GuildMemberRemove,
	async execute(member) {
		const client = member.client;
		const userId = member.user.id;

		// Check if this user has a pending application
		const appData = client.applicationData?.get(userId);
		if (!appData) return;

		console.log(`Applicant ${member.user.tag} left the server. Auto-closing their application.`);

		// Close the application thread if one exists
		if (appData.threadId) {
			try {
				const applicationChannel = client.channels.cache.get('1434215324265222164');
				if (applicationChannel) {
					const thread = await applicationChannel.threads.fetch(appData.threadId);
					if (thread) {
						await thread.send('🚪 This application has been automatically closed because the applicant left the server.');
						await thread.setLocked(true);
						await thread.setArchived(true);
					}
				}
			}
			catch (threadError) {
				console.error('Error closing application thread on member leave:', threadError);
			}
		}

		// Update the embed in new-applications channel
		const newApplicationsChannel = client.channels.cache.get('1440071317956067328');
		if (newApplicationsChannel) {
			try {
				const messages = await newApplicationsChannel.messages.fetch({ limit: 50 });
				for (const msg of messages.values()) {
					if (
						msg.embeds.length > 0 &&
						msg.components.length > 0 &&
						msg.embeds[0].footer?.text === `User ID: ${userId}`
					) {
						const closedEmbed = EmbedBuilder.from(msg.embeds[0])
							.setColor(0x808080)
							.setTitle('🚪 Application Closed — Member Left')
							.addFields({
								name: 'Reason',
								value: 'The applicant left the server.',
								inline: true,
							});

						await msg.edit({
							embeds: [closedEmbed],
							components: [],
						});
						break;
					}
				}
			}
			catch (fetchError) {
				console.error('Error updating application message on member leave:', fetchError);
			}
		}

		// Clean up application data
		client.applicationData.delete(userId);
	},
};

