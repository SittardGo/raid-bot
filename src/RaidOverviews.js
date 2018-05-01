/* jshint esversion: 6 */ 
const overviews = [];

class RaidOverviews {
    constructor(bot, channels = []) {
        if (!channels) {
            return;
        }

        channels.map(id => overviews.push({ id: id, raids: []}));
        this.bot = bot;
        this.bot.on('READY', _ => { this.cleanUp(); });
    }

    cleanUp() {
        overviews.map(ch => {
            ch.raids = [];
            const chObj = this.bot.getChannel(ch.id);
            if (!chObj) {
                return;
            }

            chObj.bulkDelete(80);
        });
    }

    create(raidId, msg) {
        overviews.map(ch => {
            const sending = this.bot.send(ch.id, msg);
            if (!sending) {
                console.log('could not send message in overview channel');
                return;
            }
            sending.then(msgObj => {
                ch.raids.push({ raidId: raidId, msg: msgObj });
            });
        });
    }

    cancel(raidId) {
        overviews.map(ch => {
            ch.raids.map(r => {
                if (r.raidId !== raidId) {
                    return;
                }

                r.msg.edit(`~~${r.msg}~~ **cancelled**`);
            });
        });
    }

    unCancel(raidId) {
        overviews.map(ch => {
            ch.raids.map(r => {
                if (r.raidId !== raidId) {
                    return;
                }

                r.msg.edit(r.msg.toString()
                    .replace(/~~/g, '')
                    .replace('**cancelled**', '')
                    .trim()
                );
            });
        });
    }

    mod(raidId, msg) {
        overviews.map(ch => {
            ch.raids.map(r => {
                if (r.raidId !== raidId) {
                    return;
                }

                r.msg.edit(msg);
            });
        });
    }
}

module.exports = RaidOverviews;