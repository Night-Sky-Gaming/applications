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

		// Try to find the #application channel
		let applicationChannel = guild.channels.cache.find(
			channel => channel.name === 'application' && channel.type === ChannelType.GuildText,
		);

		// If application channel doesn't exist, find the default text channel
		if (!applicationChannel) {
			console.error('Application channel not found! Attempting to send to default text channel...');

			// Try to find the system channel or any text channel the bot can send messages to
			applicationChannel = guild.systemChannel || guild.channels.cache.find(
				channel => channel.type === ChannelType.GuildText && channel.permissionsFor(guild.members.me).has('SendMessages'),
			);

			if (!applicationChannel) {
				console.error('No available text channel found to send the application message!');
				return;
			}

			// Send error embed to the default channel
			const errorEmbed = new EmbedBuilder()
				.setTitle('⚠️ Configuration Error')
				.setDescription('The #application channel does not exist. Please create a channel named "application" for the application system to work properly.')
				.setColor(0xFF0000)
				.setTimestamp();

			await applicationChannel.send({ embeds: [errorEmbed] });
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
