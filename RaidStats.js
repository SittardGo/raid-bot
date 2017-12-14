/* jshint esversion: 6 */ 
const fs = require('fs');

const LOG_LOCATION     = './logs/';

const DAILY_MESSAGE = 
`** Dagelijks Raid overzicht **
\`-------------------------------\`
\`- Raider van de dag - \`
**{MOST_RAIDED}** met **{RAID_COUNT}** raids!

\`- Team met meeste raiders - \`
{ICON} **{TEAM}** met **{RAID_TEAM_COUNT}** raiders {OTHER_TEAMS} |
\`-------------------------------\`
\`- Populairste raid - \`
{BUSY_RAID_OP} met {BUSY_RAID_COUNT} deelnemers.

\`- Meeste raids gestart - \`
**{MOST_OP}** met {MOST_OP_COUNT} raids.

\`- Raids gecanceld - \`
{CANCELED_COUNT} raids zijn er gecanceld.

\`- Pechvogel van de dag - \`
**{MOST_IN_CANCELED}** heeft zich opgegeven voor {MOST_CANCEL_COUNT} gecancelde raids
`;

class RaidStats {

    static emitDailyStats(bot, channel) {
        const stats = this.getDailyStats();
        console.log(stats);

        const mostRaids = stats.mostRaids.userIds.map(uId => {
            return bot.getUserById(uId).toString();
        });

        const mostOp = stats.mostOp.userIds.map(uId => {
            return bot.getUserById(uId).toString();
        });

        const mostCancled = stats.mostCancled.userIds.map(uId => {
            return bot.getUserById(uId).toString();
        });
        
        let bestTeam = '';
        Object.keys(stats.teamCounts).reduce((best, curr) => {
            if (stats.teamCounts[curr] > best) {
                bestTeam = curr;
                return stats.teamCounts[curr];
            }

            return best;
        }, 0);

        let icon = '', team = '', tcount = 0, otherTeams = '';
        for (let ct in stats.teamCounts) {
            if (ct === bestTeam) {
                icon = bot.getTeamIcon(ct);
                team = ct.charAt(0).toUpperCase() + ct.slice(1);
                tcount = stats.teamCounts[ct];
                continue;
            }
            otherTeams += `| ${ct}: ${stats.teamCounts[ct]} `;
        }

        let message = DAILY_MESSAGE
            .replace('{MOST_RAIDED}'       , mostRaids.join(' & '))
            .replace('{RAID_COUNT}'        , stats.mostRaids.count)
            .replace('{ICON}'              , icon)
            .replace('{TEAM}'              , team)
            .replace('{RAID_TEAM_COUNT}'   , tcount)
            .replace('{OTHER_TEAMS}'       , otherTeams)
            .replace('{BUSY_RAID_OP}'      , stats.busiestRaid.op)
            .replace('{BUSY_RAID_COUNT}'   , stats.busiestRaid.count)
            .replace('{MOST_OP}'           , mostOp.join(' & '))
            .replace('{MOST_OP_COUNT}'     , stats.mostOp.count)
            .replace('{CANCELED_COUNT}'    , stats.canceledRaids)
            .replace('{MOST_IN_CANCELED}'  , mostCancled.join(' & '))
            .replace('{MOST_CANCEL_COUNT}' , stats.mostCancled.count);

        console.log(message);
        bot.send(channel, message);
        return;
    }

    static emitMonthlyStats(bot, channel) {
        //
    }

    static getDailyStats(timestamp = Date.now()) {
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
            mostCancled: {
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
        stats.mostCancled = this.getHighestCountUser(canceledRaiders);

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
            `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}.json`;

        fs.writeFileSync(
            LOG_LOCATION+filename,
            JSON.stringify(lists, null, 2)
        );
    }

    static getLog(day) {
        if (typeof day === 'number') {
            day = new Date(day);
            day = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
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