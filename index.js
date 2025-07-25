const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Correct webhook URLs for your two workflows
const SAVE_WEBHOOK = process.env.SAVE_WEBHOOK || 'https://strege.app.n8n.cloud/webhook/discord-brain-input';
const QUERY_WEBHOOK = process.env.QUERY_WEBHOOK || 'https://strege.app.n8n.cloud/webhook/discord-brain';

// Command routing definitions
const INPUT_COMMANDS = [
  '!save', 'save:', '!complete', '!update', '!delete', '!clear', '!backup'
];

const QUERY_COMMANDS = [
  '!ask', '!search', '!find', '!help', '!status', '!stats', '!export', '!settings', '!config'
];

client.on('ready', () => {
  console.log(`🧠 Second Brain Bot ready! Logged in as ${client.user.tag}`);
  console.log(`📥 Input Webhook: ${SAVE_WEBHOOK}`);
  console.log(`📤 Query Webhook: ${QUERY_WEBHOOK}`);
});

client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;
  
  const content = message.content.toLowerCase().trim();
  const originalContent = message.content.trim();
  
  // Determine command type and routing
  const routingInfo = determineRouting(content, message);
  
  if (!routingInfo) return; // Not a command we handle
  
  // Add appropriate reaction for feedback
  const reactionMap = {
    save: '💾', ask: '🤔', complete: '🔍', update: '✏️', delete: '🗑️',
    search: '🔍', number: '🔢', voice: '🎤', help: '❓', status: '📊'
  };
  
  if (reactionMap[routingInfo.commandType]) {
    await message.react(reactionMap[routingInfo.commandType]).catch(console.error);
  }
  
  // Send to appropriate n8n workflow
  try {
    const payload = {
      // Message data
      content: originalContent,
      contentLower: content,
      commandType: routingInfo.commandType,
      
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
    
    // Route to correct webhook
    const webhookUrl = routingInfo.webhook;
    const workflowType = routingInfo.workflow;
    
    console.log(`📡 Routing ${routingInfo.commandType} to ${workflowType} workflow`);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'SecondBrain-Discord-Bot/1.0'
      },
      body: JSON.stringify(payload),
      timeout: 10000
    });
    
    if (response.ok) {
      await message.react('✅').catch(console.error);
      console.log(`✅ ${routingInfo.commandType.toUpperCase()} → ${workflowType}: ${originalContent.substring(0, 50)}...`);
    } else {
      await message.react('❌').catch(console.error);
      console.error(`❌ ${workflowType} webhook error: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    console.error('❌ Error sending to n8n:', error);
    await message.react('❌').catch(console.error);
    
    if (['save', 'complete'].includes(routingInfo.commandType)) {
      try {
        await message.reply('⚠️ Sorry, there was an error processing your command. Please try again.');
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError);
      }
    }
  }
});

// Helper function to determine routing
function determineRouting(content, message) {
  // Number selection (1-9) → Input workflow
  if (/^[1-9]$/.test(content)) {
    return {
      commandType: 'number',
      webhook: SAVE_WEBHOOK,
      workflow: 'INPUT'
    };
  }
  
  // Bot mention → Query workflow  
  if (message.mentions.has(client.user)) {
    return {
      commandType: 'ask',
      webhook: QUERY_WEBHOOK,
      workflow: 'QUERY'
    };
  }
  
  // Voice messages → Input workflow
  if (message.attachments.some(att => att.contentType?.startsWith('audio/'))) {
    return {
      commandType: 'voice',
      webhook: SAVE_WEBHOOK,
      workflow: 'INPUT'
    };
  }
  
  // Input workflow commands (content management)
  for (const cmd of INPUT_COMMANDS) {
    if (content.startsWith(cmd)) {
      const commandType = cmd.replace('!', '').replace(':', '');
      return {
        commandType: commandType,
        webhook: SAVE_WEBHOOK,
        workflow: 'INPUT'
      };
    }
  }
  
  // Query workflow commands (information retrieval)  
  for (const cmd of QUERY_COMMANDS) {
    if (content.startsWith(cmd)) {
      const commandType = cmd.replace('!', '').replace(':', '');
      return {
        commandType: commandType,
        webhook: QUERY_WEBHOOK,
        workflow: 'QUERY'
      };
    }
  }
  
  return null; // Not a recognized command
}

// Error handling
client.on('error', error => {
  console.error('❌ Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('❌ Unhandled promise rejection:', error);
});

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
