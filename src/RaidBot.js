/* jshint esversion: 6 */ 

/**
 * TODO:
 * - Mention everyone in list when modbreak is performed
 * - Uncancel a raid
 * - Store raidlists intermediate for recovery
 **/

const SittardGoBot = require('sittard-go-bot');
const MessageTests = require('./MessageTests');
const RaidLists    = require('./RaidLists');
const RaidStats    = require('./RaidStats');
const fs           = require('fs');

const DEV_MODE = false;

const MESSAGES = {
    missing_raid_id       : 'Raid nummer missend',
    invalid_raid_id       : 'Raid {ID} is niet actief',
    invalid_canceled_raid : 'Raid **{ID}** was gecanceld',
    raid_emition_fail     : 'Er is iets mis gegaan contacteer een Administrator',
    count_users           : 'Deelnemers: **{COUNT}**',
    auto_join_msg         : '`(auto-join met +{ID})`',
    raid_cancelled        : 'Raid nr. **{ID}** gecanceld',
};

const COLORS = {
    yellow : '15844367',
    blue   : '3447003',
    red    : '15158332',
    grey   : '0',
};

const ADD_TEAM_ICONS = true;
const REMOVE_COMMAND = false;
const RESET_CHECK_INTERVAL = 60*60*1000;
const RAID_EVENT_PREFIX = '`EX-Test |`';

class RaidBot {

    constructor() {
        if (
            !fs.existsSync(__dirname+'/../config.dev.json') &&
            !fs.existsSync(__dirname+'/../config.json')
        ) {
            new SittardGoBot.Bot();
            process.exit(0);
        }
        
        if (DEV_MODE) {
            this.bot = new SittardGoBot.Bot(
                require(__dirname+'/../config.dev.json')
            );

            this.bot.on('ERROR', function() {
                process.exit(0);
            });

        } else {
            this.bot = new SittardGoBot.Bot(
                require(__dirname+'./../config.json')
            );
        }
            
        this.raidLists = new RaidLists();
        this.bot.on('MESSAGE', this.receiveMessage.bind(this));

        // Pulse to check for a raid lists reset
        setInterval(_ => {
            const hasReset = this.raidLists.reset();
            
            if (!hasReset) {
                return;
            }
            
            RaidStats.writeLog(this.raidLists.prevLists);
            RaidStats.emitDailyStats(
                this.bot,
                'raid',
                new RegExp('^'+RAID_EVENT_PREFIX)
            );

            if (RaidStats.isLastDayOfMonth()) {
                // RaidStats.emitMonthlyStats(this.bot, 'raid');
            }

        }, RESET_CHECK_INTERVAL);

        this.bot.connect()
            .then(_ => {
                // for test invoking
            })
            .catch(e => console.log('error', e));
    }

    receiveMessage(e, msgObj) {
        const msgTxt = msgObj.content.trim();

        if (!MessageTests.is('command', msgTxt)) {
            return;
        }

        // New List
        if (MessageTests.is('startraid', msgTxt)) {
            this.createRaid(msgObj, msgTxt);
            return;
        }

        const raidId = MessageTests.extractId(msgTxt);

        // This should never happen (regex checks for numbers)
        if (!raidId) {
            this.bot.reply(msgObj, MESSAGES.missing_raid_id);
            return;
        }

        // Return a message if id isn't valid
        const searchRes = this.raidLists.isValidId(raidId);
        if (searchRes.valid === false) {
            return this.emitInvalid(searchRes, msgObj, raidId);
        }

        // Modbreak
        if (MessageTests.is('modbreak', msgTxt)) {
            this.doModBreak(msgObj, raidId, msgTxt);
            return;
        }

        // Cancel raid
        if (MessageTests.is('cancelraid', msgTxt)) {
            this.cancelRaid(msgObj, raidId);
            return;
        }

        // Join raid
        if (MessageTests.is('joinraid', msgTxt)) {
            this.joinRaid(msgObj, raidId);
            return;
        }

        // Leave raid
        if (MessageTests.is('leaveraid', msgTxt)) {
            const resLeave = this.raidLists.leave(
                raidId, msgObj.author.id
            );
            
            if (resLeave) {
                this.emitRaid(msgObj, raidId);
            }
            return;
        }
    }

    createRaid(msgObj, msgTxt) {
        let raidOP = MessageTests.stripCommand('startraid', msgTxt).trim();
        let raidOG = this.bot.getMessageUsername(msgObj);
        
        raidOP = this.opModifier(raidOP, msgObj);

        const newId = this.raidLists.create(raidOP, msgObj.author.id);

        // Testing raid stats
        if (newId > 4 && DEV_MODE) {
            this.raidLists.reset(true);
            RaidStats.writeLog(this.raidLists.prevLists);
            RaidStats.emitDailyStats(this.bot, 'raid', new RegExp('^'+RAID_EVENT_PREFIX));
            return;
        }

        console.log(`raid started by ${raidOG}: ${raidOP} (id: ${newId})`);

        this.joinRaid(msgObj, newId, msgObj.author.id);
    }


    opModifier(raidOP, msgObj) {
        if (this.bot.getMsgChannelId(msgObj) === this.bot.getChannelId('raidevent')) {
            return RAID_EVENT_PREFIX + raidOP;
        }

        return raidOP;
    }

    cancelRaid(msgObj, raidId) {
        const res = this.raidLists.cancel(raidId, msgObj.author.id);
        if (!res) {
            return;
        }

        console.log(
            `Raid ${raidId} canceled by: `+
            this.bot.getMessageUsername(msgObj)
        );

        const raid = this.raidLists.get(raidId);

        let reply = MESSAGES.raid_cancelled
            .replace('{ID}', raidId) +
            ` (${this.raidLists.getOP(raidId)})\n`;
        
        const notified = [];
        
        raid.users.map(u => {
            if (notified.indexOf(u.userId) > -1) {
                return;
            }

            notified.push(u.userId);
            reply += this.bot.getGuild().members.get(u.userId).toString()+' ';
        });

        this.bot.reply(msgObj, reply);
    }

    joinRaid(msgObj, raidId) {
        const username = this.bot.getMessageUsername(msgObj);
        const msgTxt = msgObj.content.trim();
        let team = false;

        if (MessageTests.is('withTeamHint', msgTxt)) {
            switch(msgTxt.split('').pop().toLowerCase()) {
                case 'v': team = 'valor'; break;
                case 'i': team = 'instinct'; break;
                case 'm': team = 'mystic'; break;
            }
        } else {
            team = this.bot.getTeamOfMember(msgObj.member);
        }

        this.raidLists.join(raidId, msgObj.author.id, username, team);
        
        this.emitRaid(msgObj, raidId);
    }

    doModBreak(msgObj, raidId, msgTxt) {
        let modTxt = MessageTests
            .stripCommand('modbreak', msgTxt)
            .trim();

        modTxt = this.opModifier(modTxt, msgObj);

        this.raidLists.override(raidId, modTxt);

        this.emitRaid(msgObj, raidId);
    }

    emitRaid(msgObj, raidId) {
        const raid = this.raidLists.get(raidId);

        if (!raid) {
            this.bot.reply(msgObj, MESSAGES.raid_emition_fail);
            return;
        }

        const counts = { valor: 0, mystic: 0, instinct: 0 };
        
        let op = `**${raid.op}**\n`+
            MESSAGES.auto_join_msg.replace('{ID}', raidId);

        raid.users.map(u => {
            if (!counts.hasOwnProperty(u.team)) {
                return;
            }

            counts[u.team]++;
        });


        // User list
        let c = 0;
        op += raid.users.reduce((txt, u) => {
            c++;
            txt += '\n';

            let txtC = (String(c).length < 2)? c+' ' : c;
            
            return txt+`\`${txtC}|\` ${u.username}`;
        }, '');

        // footer
        let leadingTeam = false, leadingCount = 0, hTxt = '';
        for (let c in counts) {
            if (counts[c] > leadingCount) {
                leadingCount = counts[c];
                leadingTeam = c;
            }
            hTxt += ` ${this.getTeamFooter(c)} ${counts[c]}`;
        }
        
        op += `\n\u200B\n*${hTxt.trim()}*`;
        
        let color = COLORS.grey;
        switch(leadingTeam) {
            case 'valor'    : color = COLORS.red; break;
            case 'instinct' : color = COLORS.yellow; break;
            case 'mystic'   : color = COLORS.blue; break;
        }

        const card = this.bot.createEmbed({
            description: op,
            color: color,
        });

        this.bot.reply(msgObj, card)
            .catch(_ => console.log('error', _));
    }

    getTeamFooter(name) {
        const icon = (ADD_TEAM_ICONS)?
            this.bot.getTeamIcon(name) : ' ';

        name = icon + ' ' +
            name.charAt(0).toUpperCase() +
            name.slice(1);

        // name var includes team name..
        // Now only returning the icon
        return icon;
    }

    emitInvalid(searchRes, msgObj, raidId) {
        const msg = (searchRes.reason === 'canceled') ?
            MESSAGES.invalid_canceled_raid: 
            MESSAGES.invalid_raid_id;

        this.bot.reply(msgObj, msg.replace('{ID}', raidId));
    }
}

module.exports = RaidBot;