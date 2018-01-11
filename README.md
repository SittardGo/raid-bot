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
  * Leave a raid: `- [raid id]`
  * Cancel a raid: `- cancel [raid id]`
  * Uncancel a raid: `+ uncancel [raid id]`
  * Edit raid text: `+ mod [raid text]`
