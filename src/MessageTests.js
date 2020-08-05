/* jshint esversion: 6 */ 

const regex = {
    // Every command starts with a plus or minus
    command : /^\+|^\-/,
    // Start raid is with 2 plus signs
    startraid: /^\+{2}/,
    // Cancel raid is 1 minus sign and the word cancel
    cancelraid: /^\-{1}\s*\d+\s*cancel/i,
    // Join raid is 1 plus sign and a number (id)
    joinraid: /^\+{1}\s*\d+/,
    // Join raid message has team hint
    withteamhint: /^\+\s*\d+\s*(v|i|m|r)$/i,
    // Join a raid with a level hint
    withlevelhint: /\s*=\s*([0-9]|[0-5][0-9])\s*$/i,
    // Join a raid with a remote hint
    withremotehint: /\s*=\s*(r.*|i.*)\s*\.*$/i,
    // leave raid is 1 minus sign and a number (id) 
    leaveraid: /^\-{1}\s*\d+/,
	// Inform people of the starttime
    starttime: /^\+{1}\s*\d+\s*start/i,
    // Moderator input is plus sign a number and the word mod
    modbreak: /^\+{1}\s*\d+\s*mod/i,
    // Cleanup the overview channels
    cleanup: /^\-{1}\s*cleanup/i,
    // Emit a raid stats for a specific date
    emitstats: /^\+{1}\s*emit\s*\d{4}\-\d{1,2}\-\d{1,2}/i,
    // Reconnect the bot
    reconnect: /^\+{2}\s*reconnect/i,
    // Uncancel a raid is plus sign, a number and the word uncancel
    uncancel: /^\+{1}\s*\d+\s*uncancel/i,
    // Match username in list
    withusername: '^\\d+.\\s[VAR]$',
    // Capture id from command
    getid: /^\-{1}\s*(\d+)|^\+{1}\s*(\d+)/,
    // Ends with the ex tag !EX
    withextag: /!ex$/i,
    escape: /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g,
};

class MessageTests {
    static getTest(test, userInput) {
        test = test.toLowerCase();
        
        if (!regex.hasOwnProperty(test)) {
            return false;
        }

        let r = regex[test];
        if (userInput) {
            r = String(r).replace('[VAR]', this.escapeRegExp(userInput));
            r = new RegExp(r);
        }

        return r;
    }

    static is(test, msg, userInput) {
        const r = this.getTest(test, userInput);
        
        if (!r) {
            return false;
        }

        return r.test(msg);
    }

    static extractId(msg) {
        const matches = msg.match(regex.getid);

        if (!matches) {
            return false;
        }

        // Minus match
        if (matches[1]) {
            return Number(matches[1]);
        }

        // Plus match
        return Number(matches[2]);
    }

    static escapeRegExp(str) {
        return str.replace(regex.escape, "\\$&");
    }

    static stripCommand(test, msg, userInput, onlyOnliners = true) {
        const r = this.getTest(test, userInput);
        
        // This removes any user submitted junk from extra lines
        if (onlyOnliners) {
            msg = msg.split('\n')[0];
        }
        
        if (!r) {
            console.warn(`Test: ${test} not defined`);
            return msg;
        }

        return msg.replace(r, '').trim();
    }
}

module.exports = MessageTests;
