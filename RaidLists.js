/* jshint esversion: 6 */ 
const RESET_START_TIME = 20;
const RESET_END_TIME   = 4;

class RaidLists {

    constructor() {
        this.index = 0;
        this.lists = [];
        this.prevLists = [];
        this.hasReset = true;
    }

    get(id) {       
        for (var i = this.lists.length - 1; i >= 0; i--) {
            if (this.lists[i].id === id) {
                return this.lists[i];
            }
        }
        
        return false;
    }

    create(raidOP, userId) {
        this.hasReset = false;
        this.index++;
        
        const raid = {
            id : this.index,
            op: raidOP.trim().replace('**', ''),
            userId: userId,
            users: [],
            canceled: false,
            canceledBy: false,
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

    override(id, op) {
        this.get(id).op = op;
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

    reset() {
        const currH = new Date().getHours();
        const state = this.hasReset;
        
        if (currH > RESET_END_TIME && currH < RESET_START_TIME) {
            return false;
        }

        this.prevLists = Object.assign([], this.lists);
        
        this.index = 0;
        this.lists = [];
        this.hasReset = true;

        return !state;
    }
}

module.exports = RaidLists;
