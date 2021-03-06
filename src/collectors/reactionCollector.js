const { Message, ReactionCollector: DjsReactionCollector, MessageEmbed, EmojiResolvable, CollectorOptions: DjsCollectorOptions, UserResolvable } = require("discord.js");
const { validateOptions } = require('../util/validate');
const findRecursively = require('../util/find');

class Controller {
    constructor(botMessage, collector, pages) {
        this._botMessage = botMessage;
        this._collector = collector;
        this._pages = pages;
        this._lastPage = null;
        this._currentPage = null;
    }
    stop() {
        if (this.messagesCollector)
            this.messagesCollector.stop();
        return this._collector.stop();
    }
    resetTimer(options) {
        if (this.messagesCollector)
            this.messagesCollector.resetTimer(options)
        this.collector.resetTimer(options);
    }
    goTo(pageId) {
        const idList = findRecursively({ obj: this.pages, key: 'id', type: 'object' });
        const page = idList.find(page => page.id === pageId);
        if (!page)
            throw 'Invalid action: Couldn\'t go to page \'' + pageId + '\', this page doens\'t exists.';
        this.currentPage = page;
        this.update();
    }
    get canBack() {
        return this.lastPage != null;
    }
    back() {
        if (!this.canBack)
            throw 'Invalid action: Cannot back without last page valid.';
        let aux = this.currentPage;
        this.currentPage = this.lastPage;
        this.lastPage = aux;
        this.update();
    }
    async update(onlyMessage = false) {
        if (onlyMessage)
            return await this.botMessage.edit(this.currentPage);

        await this.botMessage.reactions.removeAll();
        await this.botMessage.edit(this.currentPage);
        if (this.currentPage.reactions)
            await Promise.all(this.currentPage.reactions.map(x => this.botMessage.react(x)));
        if (this.currentPage.backEmoji)
            await this.botMessage.react(this.currentPage.backEmoji)
    }
    get botMessage() {
        return this._botMessage;
    }
    get lastPage() {
        return this._lastPage;
    }
    set messagesCollector(value) {
        this._messagesCollector = value;
    }
    get messagesCollector() {
        return this._messagesCollector;
    }
    get collector() {
        return this._collector;
    }
    get currentPage() {
        return this._currentPage;
    }
    set currentPage(value) {
        this.lastPage = this.currentPage || value;
        this._currentPage = value;
    }
    set lastPage(value) {
        this._lastPage = value;
    }
    get pages() {
        return this._pages;
    }
}


class ReactionCollector {
    /**
     * See example in {@link https://github.com/IDjinn/Discord.js-Collector/blob/master/examples/reaction-collector/menu.js}
     * @return {Collector} collector;
     */
    static async menu(options, ...args) {
        const { botMessage, user, pages, collectorOptions } = validateOptions(options, 'reactMenu');

        const keys = Object.keys(pages);
        const allReactions = findRecursively({ obj: pages, key: 'reactions', result: keys, type: 'array' });
        findRecursively({ obj: pages, key: 'backEmoji', result: allReactions, type: 'value' });
        const needCollectMessages = findRecursively({ obj: pages, key: 'onMessage' }).length > 0;

        const filter = (r, u) => u.id === user.id && (allReactions.includes(r.emoji.id) || allReactions.includes(r.emoji.name)) && !user.bot;
        const collector = botMessage.createReactionCollector(filter, collectorOptions);
        const controller = new Controller(botMessage, collector, pages);
        collector.on('collect', async (reaction) => {
            try {
                const emoji = reaction.emoji.id || reaction.emoji.name;
                if (controller.currentPage && emoji == controller.currentPage.backEmoji && controller.canBack) {
                    controller.back();
                    return;
                }

                controller.currentPage = controller.currentPage && controller.currentPage.pages ? controller.currentPage.pages[emoji] : pages[emoji];
                if (controller.currentPage) {
                    if (typeof controller.currentPage.onReact === 'function')
                        await controller.currentPage.onReact(controller, reaction, ...args);
                    if (controller.currentPage.clearReactions) {
                        await botMessage.reactions.removeAll();
                    }
                    else if (controller.currentPage.reactions) {
                        await botMessage.reactions.removeAll();
                        await Promise.all(controller.currentPage.reactions.map((r) => botMessage.react(r)));
                    }
                    else {
                        await reaction.users.remove(user.id);
                    }
                }
                else {
                    await reaction.users.remove(user.id);
                }

                await controller.update(true);
            } catch (e) {
                console.error(e);
            }
        });
        await Promise.all(Object.keys(pages).map(r => botMessage.react(r)));
        collector.on('end', async () => await botMessage.reactions.removeAll());

        if (needCollectMessages) {
            const messagesCollector = botMessage.channel.createMessageCollector((message) => message.author.id === user.id, collectorOptions);
            controller.messagesCollector = messagesCollector;
            messagesCollector.on('collect', async (message) => {
                try {
                    if (message.deletable)
                        await message.delete();
                    if (controller.currentPage && typeof controller.currentPage.onMessage === 'function')
                        await controller.currentPage.onMessage(controller, message, ...args);
                } catch (e) {
                    console.error(e);
                }
            });

            collector.on('end', () => messagesCollector.stop());
        }
        return controller;
    }

    /**
     * @description This method can be used to create easier react pagination, with multiple embeds pages.
     * @param  {PaginatorOptions} options
     * @param  {Message} options.botMessage - Message from Bot to create reaction collector.
     * @param  {UserResolvable} options.user - UserResolvable who will react. 
     * @param  {MessageEmbed[]} options.pages - Array with embeds.
     * @param  {EmojiResolvable[]} [options.reactions] - Array with back/skip reactions.
     * @param  {DjsCollectorOptions?} [options.collectorOptions] - Default discord.js collector options
     * @param  {boolean?} [options.deleteReaction] - Default True - The Bot will remove reaction after user react?
     * @param  {boolean?} [options.deleteAllOnEnd] - Default True - The Bot will remove reaction after collector end?
     * @note {Function[]?} options.onReact cannot be set in this method. (yet)
     * See full example in {@link https://github.com/IDjinn/Discord.js-Collector/blob/master/examples/reaction-collector/paginator.js}
     * @example
     *   const botMessage = await message.channel.send('Simple paginator...');
     *   ReactionCollector.paginator({
     *       botMessage,
     *       user: message.author,
     *       pages: [
     *           new MessageEmbed({ description: 'First page content...' }),
     *           new MessageEmbed({ description: 'Second page content...' })
     *       ]
     *   });
     * @returns void
     */
    static async paginator(options) {
        const { botMessage, user, pages, collectorOptions, reactionsMap, deleteReaction, deleteAllOnEnd } = validateOptions(options, 'reactPaginator');
        if (!pages || pages.length === 0)
            throw 'Invalid input: pages is null or empty';

        let i = 0;
        await botMessage.edit({ embed: pages[0] });
        const collector = this.__createReactionCollector({
            botMessage,
            user,
            reactionsMap,
            collectorOptions,
            deleteReaction,
            deleteAllOnEnd,
        },
            botMessage,
            i,
            pages
        );
        return collector;
    }

    /**
     * @description This method can be used in multiples emoji choices.
     * @param  {CollectorOptions} options
     * @param  {Message} options.botMessage - Message from Bot to create reaction collector.
     * @param  {UserResolvable} options.user - UserResolvable who will react. 
     * @param  [options.reactions] - Object with reactions and functions.
     * @param  {DjsCollectorOptions?} [options.collectorOptions] - Default discord.js collector options
     * @param  {boolean?} [options.deleteReaction] - The Bot will remove reaction after user react?
     * @param  {boolean?} [options.deleteAllOnEnd] - The Bot will remove reaction after collector end?
     * See example in {@link https://github.com/IDjinn/Discord.js-Collector/tree/master/examples/reaction-collector/question.js}
     * @note onReact(reation, ...args) = When user react, will trigger this function
     * @returns DjsReactionCollector
     */
    static question(options, ...args) {
        return this.__createReactionCollector(validateOptions(options, 'reactQuestion'), ...args);
    }

    /**
     * @description This method can be used in async methods, returning only boolean value, more easier to use inside if tratament or two choices.
     * @param  {AsyncCollectorOptions} options
     * @param  {Message} options.botMessage - Message from Bot to create reaction collector.
     * @param  {UserResolvable} options.user - UserResolvable who will react. 
     * @param  {EmojiResolvable[]} [options.reactions] - Array with 2 emojis, first one is "Yes" and second one is "No".
     * @param  {DjsCollectorOptions} [options.collectorOptions] - Default discord.js collector options
     * @param  {boolean} [options.deleteReaction] - The Bot will remove reaction after user react?
     * @param  {boolean} [options.deleteAllOnEnd] - The Bot will remove reaction after collector end?
     * See full example in {@link https://github.com/IDjinn/Discord.js-Collector/blob/master/examples/reaction-collector/yesNoQuestion.js}
     * @example 
     * const botMessage = await message.channel.send('Simple yes/no question');
     * if (await ReactionCollector.yesNoQuestion({ user: message.author, botMessage }))
     *     message.channel.send('You\'ve clicked in yes button!');
     * else
     *     message.channel.send('You\'ve clicked in no button!');
     * @returns {Promise<boolean>}
     */
    static async yesNoQuestion(options) {
        return this.__createYesNoReactionCollector(validateOptions(options, 'yesNoQuestion'));
    }


    /**
     * @description Internal methods, do not use.
     * @param  {CollectorOptions} _options
     * @returns {DjsReactionCollector}
     */
    static async __createReactionCollector(_options, ...args) {
        try {
            const { botMessage, reactionsMap, user, collectorOptions, deleteReaction, deleteAllOnEnd } = _options;
            const reactions = Object.keys(reactionsMap);
            await Promise.all(reactions.map(r => botMessage.react(r)));
            const filter = (r, u) => u.id === user.id && (reactions.includes(r.emoji.id) || reactions.includes(r.emoji.name)) && !user.bot;
            const collector = botMessage.createReactionCollector(filter, collectorOptions);
            collector.on('collect', async (reaction) => {
                const emoji = reaction.emoji.id || reaction.emoji.name;
                if (deleteReaction)
                    await reaction.users.remove(user.id);
                if (typeof reactionsMap[emoji] === 'function')
                    reactionsMap[emoji](reaction, ...args);
            });
            if (deleteAllOnEnd)
                collector.on('end', async () => await botMessage.reactions.removeAll());
            return collector;
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * @description Internal methods, do not use.
     * @param  {AsyncCollectorOptions} _options
     * @returns {Promise<boolean>}
     */
    static async __createYesNoReactionCollector(_options) {
        return new Promise(async (resolve) => {
            const { botMessage, reactions, user, collectorOptions, deleteReaction, deleteAllOnEnd } = _options;
            await Promise.all(reactions.map(r => botMessage.react(r)));
            const filter = (r, u) => u.id === user.id && (reactions.includes(r.emoji.id) || reactions.includes(r.emoji.name)) && !user.bot;
            const caughtReactions = await botMessage.awaitReactions(filter, collectorOptions);
            if (caughtReactions.size > 0) {
                const reactionCollected = caughtReactions.first();
                if (deleteReaction)
                    await reactionCollected.users.remove(user.id);
                if (deleteAllOnEnd)
                    await reactionCollected.message.reactions.removeAll();
                return resolve(reactions.indexOf(reactionCollected.emoji ? (reactionCollected.emoji.name || reactionCollected.emoji.id) : (reactionCollected.name || reactionCollected.id)) === 0);
            }
            return resolve(false);
        });
    }
}

module.exports = ReactionCollector;
module.exports.Controller = Controller;