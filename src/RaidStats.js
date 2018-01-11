/* jshint esversion: 6 */ 
const fs = require('fs');

const LOG_LOCATION     = __dirname+'/../logs/';

const DAILY_MESSAGE =  {
    "description": "**Dagelijks Raid overzicht**",
    "color": 0,
    "thumbnail": {
      "url": "https://sittardgo.nl/images/{TEAM}_color.png"
    },
    "fields": [
      {
        "name": "Raider(s) van de dag",
        "value": "{MOST_RAIDED} met {RAID_COUNT} raid(s)!",
      },
      {
        "name": "Team met meeste raiders",
        "value": "{ICON} {TEAM_CAP} met {RAID_TEAM_COUNT} raider(s) {OTHER_TEAMS} |"
      },
      {
        "name": "Populairste raid",
        "value": "{BUSY_RAID_OP} met {BUSY_RAID_COUNT} deelnemers"
      },
      {
        "name": "Meeste raids gestart",
        "value": "{MOST_OP} met {MOST_OP_COUNT} raid(s)"
      },
      {
        "name": "Raids gecanceld",
        "value": "{CANCELED_COUNT} raid(s) zijn er gecanceld"
      },
      {
        "name": "Pechvogel(s) van de dag",
        "value": "{MOST_IN_CANCELED} was opgegeven voor {MOST_CANCEL_COUNT} gecancelde raid(s)"
      }
    ]
};

class RaidStats {

    static emitDailyStats(bot, channel, opIgnorePattern = false) {
        const stats = this.getDailyStats(Date.now(), opIgnorePattern);

        /**
         * There is an android bug which will not
         * resolve @-mentions in a  rich embed.
         * For now just use the usernames and the
         * mention resolvement is commented out.
         */
        const mostRaids = stats.mostRaids.userIds.map(uId => {
            return bot.getUsernameOfUserId(uId);
            // return bot.getUserById(uId).toString();
        });

        const mostOp = stats.mostOp.userIds.map(uId => {
            return bot.getUsernameOfUserId(uId);
            // return bot.getUserById(uId).toString();
        });

        const mostCanceled = stats.mostCanceled.userIds.map(uId => {
            return bot.getUsernameOfUserId(uId);
            // return bot.getUserById(uId).toString();
        });
        
        let bestTeam = '';
        Object.keys(stats.teamCounts).reduce((best, curr) => {
            if (stats.teamCounts[curr] > best) {
                bestTeam = curr;
                return stats.teamCounts[curr];
            }

            return best;
        }, 0);

        let icon       = '',
            team       = '',
            teamCap    = '',
            tcount     = 0,
            otherTeams = '';
        
        for (let ct in stats.teamCounts) {
            if (ct === bestTeam) {
                icon    = bot.getTeamIcon(ct);
                team    = ct;
                teamCap = ct.charAt(0).toUpperCase() + ct.slice(1);
                tcount  = stats.teamCounts[ct];
                continue;
            }

            otherTeams += `| ${ct}: ${stats.teamCounts[ct]} `;
        }

        const message = Object.assign({}, DAILY_MESSAGE);

        message.thumbnail.url = message.thumbnail.url.replace('{TEAM}', team);

        message.fields = message.fields.map(f => {
            f.value = f.value
                .replace('{MOST_RAIDED}'       , mostRaids.join(' & '))
                .replace('{RAID_COUNT}'        , stats.mostRaids.count)
                .replace('{ICON}'              , icon)
                .replace('{TEAM}'              , team)
                .replace('{TEAM_CAP}'          , teamCap)
                .replace('{RAID_TEAM_COUNT}'   , tcount)
                .replace('{OTHER_TEAMS}'       , otherTeams)
                .replace('{BUSY_RAID_OP}'      , stats.busiestRaid.op)
                .replace('{BUSY_RAID_COUNT}'   , stats.busiestRaid.count)
                .replace('{MOST_OP}'           , mostOp.join(' & '))
                .replace('{MOST_OP_COUNT}'     , stats.mostOp.count)
                .replace('{CANCELED_COUNT}'    , stats.canceledRaids)
                .replace('{MOST_IN_CANCELED}'  , mostCanceled.join(' & '))
                .replace('{MOST_CANCEL_COUNT}' , stats.mostCanceled.count);
            return f;
        });

        bot.send(channel, bot.createEmbed(message));
        return;
    }

    static emitMonthlyStats(bot, channel) {
        //
    }

    static getDailyStats(timestamp = Date.now(), opIgnorePattern = false) {
        const log = this.getLog(timestamp);

        if (log === false) {
            return false;
        }

        const raiders = {};
        const raiderOps = {};
        const canceledRaiders = {};
        const stats = {
            mostRaids: {
                userIds: [], count: 0
            },
            busiestRaid: {
                op: '', count: 0, raidId: 0
            },
            mostOp: {
                userIds: [], count: 0
            },
            mostCanceled: {
                userIds: [], count: 0
            },
            teamCounts: {
                valor: 0,
                instinct: 0,
                mystic: 0
            },
            canceledRaids: 0,
        };

        log.map(raid => {
            if (opIgnorePattern instanceof RegExp) {
                if (opIgnorePattern.test(raid.op)) {
                    return;
                }
            }

            if (raid.canceled) {
                stats.canceledRaids++;
                
                const currCanceledRaiders = [];
                raid.users.map(u => {
                    if (currCanceledRaiders.indexOf(u.userId) > -1) {
                        return;
                    }

                    currCanceledRaiders.push(u.userId);
                    this.addOrIncrement(canceledRaiders, u.userId);
                });

                return;
            }

            if (raid.users.length > stats.busiestRaid.count) {
                stats.busiestRaid.op = raid.op;
                stats.busiestRaid.count  = raid.users.length;
                stats.busiestRaid.raidId = raid.id;
            }

            this.addOrIncrement(raiderOps, raid.userId);

            const currRaiders = [];
            raid.users.map(u => {
                stats.teamCounts[u.team]++;

                if (currRaiders.indexOf(u.userId) > -1) {
                    return;
                }
                
                currRaiders.push(u.userId);
                this.addOrIncrement(raiders, u.userId);
            });
        });
        
        stats.mostRaids   = this.getHighestCountUser(raiders);
        stats.mostOp      = this.getHighestCountUser(raiderOps);
        stats.mostCanceled = this.getHighestCountUser(canceledRaiders);

        return stats;
    }

    static getHighestCountUser(list) {
        const ret = { userIds: [], count: 0 };
        
        for (let uId in list) {
            if (list[uId] < ret.count) {
                continue;
            }

            if (list[uId] === ret.count) {
                ret.userIds.push(uId);
                continue;
            }

            ret.userIds = [uId];
            ret.count = list[uId];
        }

        return ret;
    }

    static isLastDayOfMonth() {
        const testDate = new Date();
        testDate.setDate(testDate.getDate() + 1);
        return testDate.getDate() === 1;
    }

    static writeLog(lists) {
        const d = new Date();
        const filename =
            `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}.json`;

        fs.writeFileSync(
            LOG_LOCATION+filename,
            JSON.stringify(lists, null, 2)
        );
    }

    static getLog(day) {
        if (typeof day === 'number') {
            day = new Date(day);
            day = `${day.getFullYear()}-${day.getMonth()+1}-${day.getDate()}`;
        }

        const file = LOG_LOCATION+day+'.json';

        if (!fs.existsSync(file)) {
            return false;
        }

        return require(file);
    }

    static addOrIncrement(statsObj, id) {
        if (!statsObj[id]) {
            statsObj[id] = 1;
            return;
        }

        statsObj[id]++;
    }
}

module.exports = RaidStats;