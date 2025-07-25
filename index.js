const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Webhook URLs - using one unified webhook for better routing
const N8N_WEBHOOK = process.env.N8N_WEBHOOK || 'https://YOUR-INSTANCE.app.n8n.cloud/webhook/discord-brain';

// Command definitions for future-proofing
const COMMANDS = {
  // Current commands
  SAVE: ['!save', 'save:'],
  ASK: ['!ask'],
  COMPLETE: ['!complete'],
  
  // Future commands
  UPDATE: ['!update'],
  DELETE: ['!delete'],
  SEARCH: ['!search', '!find'],
  STATUS: ['!status'],
  HELP: ['!help'],
  EXPORT: ['!export'],
  BACKUP: ['!backup'],
  STATS: ['!stats'],
  CLEAR: ['!clear'],
  SETTINGS: ['!settings', '!config'],
  
  // Special patterns
  MENTION: 'mention',
  NUMBER_SELECTION: 'number',
  VOICE_NOTE: 'voice'
};

client.on('ready', () => {
  console.log(`🧠 Second Brain Bot ready! Logged in as ${client.user.tag}`);
  console.log(`📡 Webhook: ${N8N_WEBHOOK}`);
});

client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;
  
  const content = message.content.toLowerCase().trim();
  const originalContent = message.content.trim();
  
  // Determine command type
  const commandType = detectCommandType(content, message);
  
  if (!commandType) return; // Not a command we handle
  
  // Add appropriate reaction for feedback
  const reactionMap = {
    save: '💾',
    ask: '🤔', 
    complete: '🔍',
    update: '✏️',
    delete: '🗑️',
    search: '🔍',
    number: '🔢',
    voice: '🎤'
  };
  
  if (reactionMap[commandType]) {
    await message.react(reactionMap[commandType]).catch(console.error);
  }
  
  // Send to n8n
  try {
    const payload = {
      // Message data
      content: originalContent,
      contentLower: content,
      commandType: commandType,
      
      // Author data
      author: {
        id: message.author.id,
        username: message.author.username,
        displayName: message.author.displayName,
        bot: message.author.bot
      },
      
      // Channel data
      channel: {
        id: message.channel.id,
        name: message.channel.name,
        type: message.channel.type
      },
      
      // Message metadata
      message: {
        id: message.id,
        url: message.url,
        timestamp: message.createdTimestamp,
        editedTimestamp: message.editedTimestamp
      },
      
      // Server data
      guild: message.guild ? {
        id: message.guild.id,
        name: message.guild.name
      } : null,
      
      // Voice/attachment data
      attachments: message.attachments.map(att => ({
        id: att.id,
        name: att.name,
        url: att.url,
        size: att.size,
        contentType: att.contentType
      })),
      
      // System timestamp
      timestamp: new Date().toISOString()
    };
    
    const response = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'SecondBrain-Discord-Bot/1.0'
      },
      body: JSON.stringify(payload),
      timeout: 10000 // 10 second timeout
    });
    
    if (response.ok) {
      // Success reaction
      await message.react('✅').catch(console.error);
      console.log(`✅ ${commandType.toUpperCase()} command processed: ${originalContent.substring(0, 50)}...`);
    } else {
      // Error reaction
      await message.react('❌').catch(console.error);
      console.error(`❌ Webhook error: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    console.error('❌ Error sending to n8n:', error);
    await message.react('❌').catch(console.error);
    
    // Optional: Send error message to user for critical commands
    if (['save', 'complete'].includes(commandType)) {
      try {
        await message.reply('⚠️ Sorry, there was an error processing your command. Please try again.');
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError);
      }
    }
  }
});

// Voice message handling
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  // Handle voice messages separately
  if (message.attachments.size > 0) {
    const voiceAttachment = message.attachments.find(att => 
      att.contentType && att.contentType.startsWith('audio/')
    );
    
    if (voiceAttachment) {
      await message.react('🎤').catch(console.error);
      // Voice processing will be handled by the main message handler
    }
  }
});

// Error handling
client.on('error', error => {
  console.error('❌ Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('❌ Unhandled promise rejection:', error);
});

// Helper function to detect command type
function detectCommandType(content, message) {
  // Number selection (1-9)
  if (/^[1-9]$/.test(content)) {
    return 'number';
  }
  
  // Bot mention
  if (message.mentions.has(client.user)) {
    return 'ask';
  }
  
  // Voice messages
  if (message.attachments.some(att => att.contentType?.startsWith('audio/'))) {
    return 'voice';
  }
  
  // Text commands
  for (const [type, commands] of Object.entries(COMMANDS)) {
    if (Array.isArray(commands)) {
      for (const cmd of commands) {
        if (content.startsWith(cmd)) {
          return type.toLowerCase();
        }
      }
    }
  }
  
  return null; // Not a recognized command
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🔄 Shutting down Discord bot...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🔄 Shutting down Discord bot...');
  client.destroy();
  process.exit(0);
});

// Login
client.login(process.env.DISCORD_TOKEN);
