
---
# CHANGELOG - V1.4.3

• Fix unexpected token in Constants.js

---
# CHANGELOG - V1.4.2

• Fix typings

---
# CHANGELOG - V1.4.1

• Reactions arrays now is object, key value with key is Emoji and value is function when user react.
• Now you can give more params to react functions, all ...args given in question(options, ...args) for e.g.g will be available in reactions functions after default params.
• Improve examples in docs, improve [README.md](./README.md)
• Fix typings
• Reactions roles will emit events when user win/lose role or all reactions was removed from message.

---
# CHANGELOG - V1.4.0

• Refractor reaction menu, more options and new menu Controller, to stop, reset timer, back and go to pages.

---
# CHANGELOG - V1.3.7

• Fix format in README.md

---
# CHANGELOG - V1.3.6

• Fix invalid main file.

---
# CHANGELOG - V1.3.5

• Added onMessage and onReact in menu pages.

---
# CHANGELOG - V1.3.4

• Fixed types, changed how react menu works, now suport for multiple pages and subpages.
• Improve README with links and Sumary.

---
# CHANGELOG - V1.3.0

• Added Reaction Role system, now you can create easy reaction roles with a internal storage, if your bot shutdown, all users will won the roles when it's up!

---
# CHANGELOG - V1.2.0

• New functions to create reactions menu, you can use with `ReactionCollector.menu(options)`

---
# CHANGELOG - V1.1.0

• Now collectors work in DM Channels, but cannot delete user reaction/message
• [BETA] Added ReactionRoleManager, easy mode to create reactions roles with storage system, when finish i will share examples and gifs explaining how this work.
