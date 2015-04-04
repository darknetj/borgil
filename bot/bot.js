var util = require('util');

var ClientManager = require('./manager');


// This is a minimal API that bot plugins can use to access the client manager.
var Bot = module.exports = function (config) {
    this.config = config;
    this._manager = new ClientManager(config);
};


// A shortcut to allow the bot instance to include plugins.
Bot.prototype.use = function (name) {
    this._currentPlugin = name;
    require('../plugins/' + name).call(this, this);
    delete this._currentPlugin;
};


// a wrapper for the plugin caller, with error handling
function callPlugin(bot, client, currentPlugin, callback, arg) {
    try {
        callback.call(bot, arg);
    }
    catch (e) {
        bot._manager.emit('pluginError', client, currentPlugin, e.message);
    }
}


// Add a listener for a particular type of IRC message.
Bot.prototype.listen = function (type, pattern, callback) {
    var bot = this,
        currentPlugin = this._currentPlugin;

    if (['message', 'message#', 'pm'].indexOf(type) > -1) {
        this._manager.addListener(type, function (client, nick, target, text, msg) {
            var match = text.match(pattern);
            if (match) {
                callPlugin(bot, client, currentPlugin, callback, {
                    network: client.__network,
                    nick: nick,
                    target: target,
                    replyto: target == client.nick ? nick : target,
                    text: text,
                    match: match
                });
            }
        });
    }
};


// Add a listener for a particular command.
Bot.prototype.addCommand = function (command, callback, ignorePrivate, ignorePublic) {
    var bot = this,
        currentPlugin = this._currentPlugin;

    var type = 'message';
    if (ignorePrivate && ignorePublic) return;
    else if (ignorePrivate) type = 'message#';
    else if (ignorePublic) type = 'pm';

    if (!command) return;
    if (util.isArray(command)) command = command.filter(function (cmd) {
        return typeof cmd == 'string' && cmd;
    }).join('|');

    this._manager.addListener(type, function (client, nick, target, text, msg) {
        var match = text.match('^' + bot.config.commandchar + '(' + command + ')(?:\\s+(.*?))?\\s*$');
        if (match) {
            callPlugin(bot, client, currentPlugin, callback, {
                network: client.__network,
                nick: nick,
                target: target,
                replyto: target == client.nick ? nick : target,
                command: match[1],
                text: match[2] || '',
                args: (match[2] || '').split(/\s+/)
            });
        }
    });
};

// Send a message to the specified target.
Bot.prototype.say = function (network, target, text) {
    this._manager.clients[network].say(target, text);
};


// Current information on connected networks.
Object.defineProperty(Bot.prototype, 'networks', {
    get: function () {
        var clients = this._manager.clients;

        return Object.keys(this._manager.clients).reduce(function (networks, network) {
            networks[network] = {
                channels: clients[network].chans,
                nick: clients[network].nick
            };
            return networks;
        }, {});
    }
});

// Current channel buffers.
Object.defineProperty(Bot.prototype, 'buffers', {
    get: function () {
        return this._manager.buffers;
    }
});
