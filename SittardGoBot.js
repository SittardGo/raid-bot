/* jshint esversion: 6 */

const GUILD_ID =  '0';
const ADMIN_IDS = {
    name : '0',
};

const CHANNEL_IDS = {
    main  : '0',
    test  : '0',
    raid  : '0',
};

const EVENTS = {
    'READY' : 'ready',
    'DEBUG' : 'debug',
    'MESSAGE' : 'message',
};

const MOD_ROLE_NAMES = [
    'mod',
    'moderator',
    'moderators',
    'admin',
    'administrator',
    'administrators',
];

const TEAM_ICON_CACHE = {};
const TEAM_ICONS = [
    { team: 'valor', icon: 'valor' },
    { team: 'mystic', icon: 'mystic' },
    { team: 'instinct', icon: 'instinct' },
];

const REGISTER_URL = 'https://discordapp.com/oauth2/authorize?&client_id={CLIENT_ID}&scope=bot&permissions=0';
const DEFAULT_ARGS = [
    [['-u', '--url'], {
        help: 'Get the url for registering the bot',
        action: 'storeConst',
        constant: true
    }]
];

const Discord = require('discord.js');
const EventBus = require('eventbusjs');
const ArgumentParser = require('argparse').ArgumentParser;

let userArgs = {};
let cliArgParser = false;

let clientId = false;
let currentGuild = false;

let client = false;
let token = false;

class Bot {

    constructor(botToken, botClientId, description, version, cliArgs) {
        if (!botToken) {
            throw new Exception('Token not defined');
        }

        client  = new Discord.Client();
        token = botToken;
        clientId = botClientId;

        this.setUsage(description, version, cliArgs);

        // Exit if request for registration url
        if (this.getCliArgs().url) {
            console.log(this.getRegisterURL());
            process.exit(0);
        }

        this.initEvents();
    }

    connect() {
        return client.login(token);
    }

    initEvents() {
        client.on('ready', () => {
            console.log('Bot logged in');
            EventBus.dispatch(EVENTS.READY, this);
        });

        client.on('debug', message => {
            EventBus.dispatch(EVENTS.DEBUG, this, message);
        });

        client.on('message', message => {
            EventBus.dispatch(EVENTS.MESSAGE, this, message);
        });

        client.on('error', e => {
            console.trace(e);
            throw new Exception('A socket error occured');
        });
    }

    setUsage(description = '', version = '1.0', cliArgs = []) {
        cliArgParser = new ArgumentParser({
            description: description,
            version: version,
            addHelp: true,
        });

        DEFAULT_ARGS.concat(cliArgs).map(a => cliArgParser.addArgument(...a));
        userArgs = cliArgParser.parseArgs();
    }

    getCliArgs() {
        return userArgs;
    }

    getClient() {
        return client;
    }

    createEmbed(options = {}) {
        return new Discord.RichEmbed(options);
    }

    getAdminId(name) {
        name = name.toLowerCase();
        
        if (!ADMIN_IDS.hasOwnProperty(name)) {
            return false;
        }

        return ADMIN_IDS[name];
    }

    getChannel(channel) {
        let channelId = this.getChannelId(channel);
        if (!channelId) {
            channelId = channel;
        }

        channel = client.channels.get(channelId);

        if (!channel) {
            return false;
        }

        return channel;
    }

    getChannelId(name) {
        name = name.toLowerCase();

        if (!CHANNEL_IDS.hasOwnProperty(name)) {
            return false;
        }

        return CHANNEL_IDS[name];
    }

    reply(usrMsgObj, botMsgTxt, replyToBots = false) {
        if (!replyToBots && usrMsgObj.author.bot) {
            return;
        }

        return usrMsgObj.channel.send(botMsgTxt);
    }

    send(channel, message) {
        channel = this.getChannel(channel);

        if (!channel) {
            return false;
        }

        return channel.send(message);
    }

    getMessageUsername(msgObj) {
        return (msgObj.member.nickname)?
            msgObj.member.nickname : msgObj.author.username;
    }

    getMsgAuthorId(msgObj) {
        return msgObj.author.id;
    }

    getMsgContent(msgObj) {
        return trim(msgObj.content);
    }

    getMsgChannelId(msgObj) {
        return msgObj.channel.id;
    }

    getGuildChannel(channelId, guildId = false) {
        guildId = (guildId)? guildId : GUILD_ID;
        
        try {
            return new Discord.GuildChannel(
                client.guilds.get(guildId),
                client.channels.get(channelId)
            );
        } catch(e) {
            console.log('Error getting channel', e);
            return false;
        }
    }

    getGuild(guildId = false) {
        guildId = (guildId)? guildId : GUILD_ID;
        return client.guilds.get(guildId);
    }

    getUserById(userId, guildId = false) {
        return this.getGuild(guildId).members.get(userId);
    }

    getTeamIcon(team, guildId = false) {
        team = team.toLowerCase();
        
        let teamObj = TEAM_ICONS.find(t => t.team === team);
        if (!teamObj) {
            return '';
        }

        if (!TEAM_ICON_CACHE[team]) {
            TEAM_ICON_CACHE[team] =
                this.getGuild(guildId).emojis.find('name', teamObj.icon) || '';
        }

        return TEAM_ICON_CACHE[team];
    }

    getTeamOfMember(memberObj) {
        let memberTeam = '';
        
        memberObj.roles.map(r => {
            const role = r.name.toLowerCase();
            memberTeam = TEAM_ICONS.find(t => t.team === role);
        });
        
        return memberTeam.team || '';
    }

    getRegisterURL() {
        return REGISTER_URL.replace('{CLIENT_ID}', clientId);
    }

    userIsMod(memberObj) {
        const res = memberObj.roles.filterArray((r) => {
            return MOD_ROLE_NAMES.indexOf(r.name.toLowerCase()) > -1;
        });

        return res.length > 0;
    }

    on(type, cb, args) {
        if (!EVENTS.hasOwnProperty(type)) {
            console.trace(`Error: unknown event ${type}`);
            return;
        }

        if (typeof cb !== 'function') {
            console.trace('Error: provided callback not a function');
            return;
        }

        if (!args) {
            args = [];
        }

        EventBus.addEventListener(EVENTS[type], (event, ...eventArgs) => {
            cb(event, ...eventArgs.concat(args));
        });
    }
}

module.exports = {
    Bot, EVENTS
};
