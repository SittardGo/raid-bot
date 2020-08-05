# Pokémon Go Raid Discord bot

## Features

 * Automatic adding / removing users
 * Switch teams when joining with team hints
 * Team icons (if added to the guild as emoji with the same name)
 * Logs
 * Auto-emitting daily raid stats

## Installation

First do:

```bash
$ npm install
$ node index.js -g
```

When running the index with the `-g` flag, you invoke the generation of a configuration file. This file has to be filled in and located in the project root. The values guild-id, bot-token, client-id, version and description are required (and specific for your bot, created at https://appdiscordapp.com/developers/)).

The bot will look for `config.dev.json` of the `DEV_MODE` is set to true, otherwise it will look for `config.json`.

After this you can run the bot:

```bash
$ node index.js
```

## Usage in Discord

  * Create a raid: `++ [raid text]`
  * Join a raid: `+ [raid id]`
  * Join a raid on team Instinct: `+ [raid id] i`
  * Join a raid with a level 12 acount: `+ [raid id] =12`
  * Join a raid as remote player: `+ [raid id] r` or `+ [raid id] =r`
  * Leave a raid: `- [raid id]`
  * Cancel a raid: `- [raid id] cancel`
  * Uncancel a raid: `+ [raid id] uncancel `
  * Edit raid text: `+ mod [raid text]`
  * let other (remote) players know to join the lobby: `+ [raid id] start`
