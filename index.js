const fs = require('node:fs');
const path = require('node:path');

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');

console.log('Bot starting...');
console.log('Discord.js loaded successfully');

// Create a new client instance
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
	],
});

console.log('Client created successfully');

// Load commands
client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
// Check if commands folder exists before trying to load
if (fs.existsSync(foldersPath)) {
	const commandFiles = fs
		.readdirSync(foldersPath)
		.filter((file) => file.endsWith('.js'));

	for (const file of commandFiles) {
		const filePath = path.join(foldersPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		}
		else {
			console.log(
				`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
			);
		}
	}
	console.log(`Loaded ${client.commands.size} command(s).`);
}
else {
	console.log('No commands folder found. Skipping command loading.');
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs
	.readdirSync(eventsPath)
	.filter((file) => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	}
	else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

// Add error handlers
client.on('error', error => {
	console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
	console.error('Unhandled promise rejection:', error);
});

// Log in to Discord with your client's token
console.log('Attempting to log in to Discord...');
client.login(token).catch(error => {
	console.error('Failed to log in to Discord:');
	console.error(error);
	process.exit(1);
});
