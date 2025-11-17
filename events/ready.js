const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);

		// Get the first guild (server) the bot is in
		const guild = client.guilds.cache.first();

		if (!guild) {
			console.error('Bot is not in any guild!');
			return;
		}

		// Use the specific application channel ID
		const applicationChannel = client.channels.cache.get('1434215324265222164');

		// If application channel doesn't exist, log error and return
		if (!applicationChannel) {
			console.error('Application channel not found! Make sure the bot has access to channel ID: 1434215324265222164');
			return;
		}

		// Create the application embed
		const applicationEmbed = new EmbedBuilder()
			.setTitle('🎮 Join Andromeda Gaming!')
			.setDescription('Welcome to Andromeda Gaming! Click the button below to submit your application and become a member of our community.')
			.setColor(0x5865F2)
			.addFields(
				{ name: '📝 Application Process', value: 'Fill out the form with your information and we\'ll review your application!' },
				{ name: '✨ What happens next?', value: 'After submitting, you\'ll receive the Member role and your nickname will be updated!' },
			)
			.setFooter({ text: 'Andromeda Gaming Applications' })
			.setTimestamp();

		// Create the application button
		const button = new ButtonBuilder()
			.setCustomId('create_application')
			.setLabel('Apply Now')
			.setStyle(ButtonStyle.Success)
			.setEmoji('📝');

		const row = new ActionRowBuilder().addComponents(button);

		// Send the embed with the button
		await applicationChannel.send({
			embeds: [applicationEmbed],
			components: [row],
		});

		console.log(`Application embed sent to #${applicationChannel.name}`);
	},
};
