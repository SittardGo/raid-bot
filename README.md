# Pokémon Go Raid Discord bot

## Features

 * Automatic adding / removing users
 * Switch teams when joining with team hints
 * Team icons (if added to the guild as emoji with the same name)
 * Logs
 * Auto-emitting daily raid stats

## Installation

First edit `SittardGoBot.js` to enter your guild specific id's:

  * guild id
  * admin user id's
  * channel id's

Then edit `index.js` to include your bot token and client id (both specific for your bot, created at https://appdiscordapp.com/developers/). The test id's are optional, these override the standard id's when de flag `DEV_MODE` is set to `true`.

```bash
$ npm install
$ node index.js
```

## Usage

  * Create a raid: `++ [raid text]`
  * Join a raid: `+ [raid id]`
  * Join a raid on team Instinct: `+ [raid id] i`
  * Leave a raid: `- [raid id]`
  * Cancel a raid: `- cancel [raid id]`
  * Edit raid text: `+ mod [raid text]`
