/* jshint esversion: 6 */
const fs = require('fs');

const RESET_START_TIME = 20;
const RESET_END_TIME   = 4;
const RECOVER_FILE     = __dirname+'/../logs/recover.json';

class RaidLists {

    constructor() {
        this.index = 0;
        this.lists = [];
        this.prevLists = [];
        this.hasReset = true;

        if (fs.existsSync(RECOVER_FILE)) {
            this.lists = require(RECOVER_FILE);
            this.hasReset = false;
            this.index = this.lists.length;

            fs.unlinkSync(RECOVER_FILE);
        }
    }

    get(id) {
        for (var i = this.lists.length - 1; i >= 0; i--) {
            if (this.lists[i].id === id) {
                return this.lists[i];
            }
        }

        return false;
    }

    create(raidOP, userId, exTrigger = false) {
        this.hasReset = false;
        this.index++;

        // Sanitize the OP
        raidOP = raidOP
            .replace(/!ex/i, '')     // Remove trigger indicators
            .replace(/`ex.+`/i, '')  // ...
            .replace(/ex-?/i, '')    // ...
            .replace(/trigger/i, '') // ...
            .replace('**', '')       //  Remove bold tags
            .trim();

        const raid = {
            id : this.index,
            op: raidOP,
            userId: userId,
            users: [],
            canceled: false,
            canceledBy: false,
            exTrigger: exTrigger,
            date: Date.now()
        };

        this.lists.push(raid);

        return this.index;
    }

    join(raidId, userId, username, team) {
        const raid = this.get(raidId);
        if (!raid) {
            return false;
        }

        raid.users.push({
            userId: userId,
            username: username,
            team: team
        });

        return true;
    }

    leave(raidId, userId) {
        const raid = this.get(raidId);
        if (!raid) {
            return false;
        }

        for (var i = raid.users.length - 1; i >= 0; i--) {
            if (raid.users[i].userId === userId) {
                delete(raid.users[i]);
                raid.users = raid.users.filter(u => true);
                return true;
            }
        }

        return false;
    }

    cancel(id, userId) {
        const raid = this.get(id);
        if (!raid) {
            return false;
        }

        raid.canceled = true;
        raid.canceledBy = userId;

        return true;
    }

    starttime(id, userId) {
        const raid = this.get(id);
        if (!raid) {
            return false;
        }

        raid.canceled = false;
        raid.canceledBy = userId;

        return true;
    }

    unCancel(id) {
        const raid = this.get(id);
        if (!raid) {
            return false;
        }

        raid.canceled = false;
        raid.canceledBy = false;

        return true;
    }

    override(id, op, exTrigger = false) {
        // Sanitize the OP
        op = op
            .replace(/!ex/i, '')     // Remove trigger indicators
            .replace(/`ex.+`/i, '')  // ...
            .replace(/ex-?/i, '')    // ...
            .replace(/trigger/i, '') // ...
            .replace('**', '')       //  Remove bold tags
            .trim();

        this.get(id).op = op;
        this.get(id).exTrigger = exTrigger;
    }

    isValidId(id) {
        const list = this.get(id);

        if (list === false) {
            return { valid: false, reason: 'invalid' };
        }

        if (list.canceled === true) {
            return { valid: false, reason: 'canceled' };
        }

        return { valid: true };
    }

    getOP(id) {
        const list = this.get(id);
        if (!list) {
            return '';
        }

        return list.op;
    }

    createRecoverFile() {
        fs.writeFileSync(
            RECOVER_FILE,
            JSON.stringify(this.lists, null, 2)
        );
    }

    reset(force = false) {
        const currH = new Date().getHours();
        const state = this.hasReset;

        if (
            currH > RESET_END_TIME &&
            currH < RESET_START_TIME &&
            force === false
        ) {
            return false;
        }

        this.prevLists = Object.assign([], this.lists);

        this.index = 0;
        this.lists = [];
        this.hasReset = true;

        if (fs.existsSync(RECOVER_FILE)) {
            fs.unlinkSync(RECOVER_FILE);
        }

        return !state;
    }
}

module.exports = RaidLists;
