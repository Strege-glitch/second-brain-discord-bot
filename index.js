const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Your n8n webhooks
const QUERY_WEBHOOK = process.env.QUERY_WEBHOOK || 'https://YOUR-INSTANCE.app.n8n.cloud/webhook/discord-brain';
const SAVE_WEBHOOK = process.env.SAVE_WEBHOOK || 'https://YOUR-INSTANCE.app.n8n.cloud/webhook/discord-brain-input';

client.on('ready', () => {
  console.log(`Bot is ready! Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  const content = message.content.toLowerCase();
  
  // Handle SAVE commands
  if (content.startsWith('!save') || content.startsWith('save:')) {
    await message.react('💾');
    
    try {
      const response = await fetch(SAVE_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: message.content,
          author: {
            id: message.author.id,
            username: message.author.username,
            bot: message.author.bot
          },
          channel: {
            id: message.channel.id,
            name: message.channel.name
          },
          message: {
            id: message.id,
            url: message.url
          },
          timestamp: new Date().toISOString()
        })
      });
      
      if (response.ok) {
        await message.react('✅');
      } else {
        await message.react('❌');
      }
    } catch (error) {
      console.error('Save error:', error);
      await message.react('❌');
    }
  }
  
  // Handle QUERY commands
  else if (content.startsWith('!ask') || message.mentions.has(client.user)) {
    await message.react('🤔');
    
    try {
      const response = await fetch(QUERY_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: message.content,
          author: {
            id: message.author.id,
            username: message.author.username,
            bot: message.author.bot
          },
          channel: {
            id: message.channel.id,
            name: message.channel.name
          },
          message: {
            id: message.id,
            url: message.url
          },
          timestamp: new Date().toISOString()
        })
      });
      
      if (response.ok) {
        await message.react('✅');
      }
    } catch (error) {
      console.error('Query error:', error);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
