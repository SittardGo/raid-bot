/* jshint esversion: 6 */ 
const fs           = require('fs');
const SittardGoBot = require('sittard-go-bot');
const MessageTests = require('./MessageTests');
const RaidLists    = require('./RaidLists');
const RaidStats    = require('./RaidStats');
const RaidOverviews = require('./RaidOverviews');

const DEV_MODE = false;

const MESSAGES = {
    missing_raid_id       : 'Raid nummer missend',
    invalid_raid_id       : 'Raid {ID} is niet actief',
    invalid_canceled_raid : 'Raid **{ID}** was gecanceld',
    raid_emition_fail     : 'Er is iets mis gegaan contacteer een Administrator',
    count_users           : 'Deelnemers: **{COUNT}**',
    auto_join_msg         : '`(auto-join met +{ID})`',
    raid_cancelled        : 'Raid nr. **{ID}** gecanceld',
    raid_uncancelled      : 'Raid nr. **{ID}** is weer actief!',
    raid_err_uncancelled  : 'Vraag een mod om een gecancelde raid te hervatten',
    raid_changed          : 'Raid nr {ID} is aangepast: {OP}\n',
};

const COLORS = {
    yellow : '15844367',
    blue   : '3447003',
    red    : '15158332',
    grey   : '0',
};

const ADD_TEAM_ICONS       = true;
const REMOVE_COMMAND       = false;
const RESET_CHECK_INTERVAL = 60*60*1000;
const EX_TRIGGER_PREFIX    = '`EX-Trigger` ';
const EX_COORD_ROLE        = 'ex-coordinators';

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
            this.config = require(__dirname+'/../config.dev.json')
            this.bot = new SittardGoBot.Bot(this.config);

            this.bot.on('ERROR', function() {
                process.exit(0);
            });

        } else {
            this.config = require(__dirname+'./../config.json');
            this.bot = new SittardGoBot.Bot(this.config);
        }

        this.raidLists = new RaidLists();
        this.raidOverviews = new RaidOverviews(
            this.bot,
            this.config['channel-ids']['raid-overviews']
        );

        this.bot.on('MESSAGE', this.receiveMessage.bind(this));

        // Pulse to check for a raid lists reset
        setInterval(_ => {
            const hasReset = this.raidLists.reset();
            
            if (!hasReset) {
                return;
            }
            
            RaidStats.writeLog(this.raidLists.prevLists);
            RaidStats.emitStats(this.bot, 'raid');
            this.raidOverviews.cleanUp();
            
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

        // Emit stats of specific date
        if (MessageTests.is('emitStats', msgTxt)) {
            const authId = this.bot.getMsgAuthorId(msgObj);
            
            if (authId !== this.bot.getAdminId('renzo')) {
                return;
            }

            const dateTxt = msgTxt.replace(/\+\s*emit\s*/i, '').trim();
            const date = new Date(dateTxt);

            RaidStats.emitStats(
                this.bot,
                this.bot.getMsgChannelId(msgObj),
                RaidStats.getDailyStats(date.getTime())
            );

            return;
        }

        // reconnect
        if (MessageTests.is('reconnect', msgTxt)) {
            const authId = this.bot.getMsgAuthorId(msgObj);
            
            if (authId !== this.bot.getAdminId('renzo')) {
                return;
            }

            console.log('reconnecting...');
            this.bot.reconnect();
            
            return
        }

        // New List
        if (MessageTests.is('startraid', msgTxt)) {
            this.createRaid(msgObj, msgTxt);
            this.raidLists.createRecoverFile();
            return;
        }

        const raidId = MessageTests.extractId(msgTxt);
        
        // Uncancel raid
        if (MessageTests.is('uncancel', msgTxt) && raidId) {
            this.unCancelRaid(msgObj, raidId);
            this.raidLists.createRecoverFile();
            return;
        }

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

        // Cancel raid
        } else if (MessageTests.is('cancelraid', msgTxt)) {
            this.cancelRaid(msgObj, raidId);

        // Join raid
        } else if (MessageTests.is('joinraid', msgTxt)) {
            this.joinRaid(msgObj, raidId);

        // Leave raid
        } else if (MessageTests.is('leaveraid', msgTxt)) {
            const resLeave = this.raidLists.leave(
                raidId, msgObj.author.id
            );
            
            if (resLeave) {
                this.emitRaid(msgObj, raidId);
            }
        }

        this.raidLists.createRecoverFile();
    }

    createRaid(msgObj, msgTxt) {
        let raidOP = MessageTests.stripCommand('startraid', msgTxt).trim();
        let raidOG = this.bot.getMessageUsername(msgObj);
        
        const newId = this.raidLists.create(
            raidOP,
            msgObj.author.id,
            this.isTrigger(raidOP, msgObj)
        );

        // Testing raid stats
        if (newId > 2 && DEV_MODE) {
            // this.raidLists.reset(true);
            
            // RaidStats.writeLog(this.raidLists.prevLists);
            // RaidStats.emitStats(this.bot, 'raid');
            // this.raidOverviews.cleanUp();

            // return;
        }

        console.log(`raid started by ${raidOG}: ${raidOP} (id: ${newId})`);

        const idTxt = (String(newId).length < 2)? newId+' ' : newId;
        this.raidOverviews.create(newId, `\`${idTxt}|\` ${raidOP}`);
        this.joinRaid(msgObj, newId, msgObj.author.id);
    }


    isTrigger(raidOP, msgObj) {
        if (!MessageTests.is('withExTag', raidOP)) {
            return false;
        }

        if (!this.bot.userHasRole(msgObj.member, EX_COORD_ROLE)) {
            return false;
        }

        return true;
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

        let reply = MESSAGES.raid_cancelled
            .replace('{ID}', raidId) +
            ` (${this.raidLists.getOP(raidId)})\n`;
        
        this.raidOverviews.cancel(raidId);
        this.notifyRaiders(raidId, msgObj, reply);
    }

    unCancelRaid(msgObj, raidId) {
        // test for mod
        if (!this.bot.userIsMod(msgObj.member)) {
            this.bot.reply(msgObj, MESSAGES.raid_err_uncancelled);
            return;
        }

        const res = this.raidLists.unCancel(raidId);
        if (!res) {
            return;
        }

        console.log(
            `Raid ${raidId} un-canceled by: `+
            this.bot.getMessageUsername(msgObj)
        );

        let reply = MESSAGES.raid_uncancelled
            .replace('{ID}', raidId) +
            ` (${this.raidLists.getOP(raidId)})\n`;
        
        this.raidOverviews.unCancel(raidId);
        this.notifyRaiders(raidId, msgObj, reply);
    }

    notifyRaiders(raidId, msgObj, prefix = '') {
        const raid     = this.raidLists.get(raidId);
        const notified = [];
        let reply      = prefix;

        if (!raid) {
            return;
        }

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
        const raid = this.raidLists.get(raidId);
        
        if (!raid) {
            return;
        }

        const modTxt = MessageTests
            .stripCommand('modbreak', msgTxt)
            .trim();

        const isTrigger = (raid.exTrigger === false)?
            this.isTrigger(modTxt, msgObj) : true;

        this.raidLists.override(raidId, modTxt, isTrigger);
        this.emitRaid(msgObj, raidId);

        const reply = MESSAGES.raid_changed
            .replace('{ID}', raidId)
            .replace('{OP}', modTxt);

        const idTxt = (String(raidId).length < 2)? raidId+' ' : raidId;
        this.raidOverviews.mod(raidId, `\`${idTxt}|\` ${modTxt}`);
        this.notifyRaiders(raidId, msgObj, reply);
    }

    emitRaid(msgObj, raidId) {
        const raid = this.raidLists.get(raidId);

        if (!raid) {
            this.bot.reply(msgObj, MESSAGES.raid_emition_fail);
            return;
        }

        const counts = { valor: 0, instinct: 0, mystic: 0 };
        
        let op = `**${raid.op}**\n`+
            MESSAGES.auto_join_msg.replace('{ID}', raidId);

        if (raid.exTrigger) {
            op = EX_TRIGGER_PREFIX + op;
        }

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
        let leadingTeam = false, leadingCount = 0, fTxt = '';
        for (let c in counts) {
            if (counts[c] > leadingCount) {
                leadingCount = counts[c];
                leadingTeam = c;
            }
            fTxt += ` ${this.getTeamFooter(c)} ${counts[c]}`;
        }
        
        op += `\n\u200B\n*${fTxt.trim()}*`;
        
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