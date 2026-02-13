// @ts-check

/**
 * Game Configuration and Constants
 */
const GameConfig = {
    PEER_OPTS: { debug: 1 }, // PeerJS Server Configuration (Free Cloud)
    DIRECTION_FORWARD: 1, // Normal direction, dont change this
    DIRECTION_REVERSE: -1, // Reverse direction, dont change this
    CAN_MIGRATE: true, // If host migration is allowed
    MIGRATION_ATTEMPTS: 3, // Amount of attempts to migrate host before giving up
    MIGRATION_TIME: 3 * 1000, // Time for host migration in ms (NO WAY SOMEONE CANNOT SEND PACKET IN THIS TIME)
    NEXT_GAME_TIMEOUT: 10, // Time before next game starts (seconds)
    TURN_DELAY: Math.round(2.0 * 1000), // Delay between turns (ms)
    UNO_CARD_AMOUNT: 2, // Amount of cards to take when someone presses uno
    REJOIN_TIME: 1000 * 60 * 2, // Time that player has to rejoin
    USERNAME_REGEX: /^.{2,24}$/, // Username regex rules
    INVITE_REGEX: /^$|^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, // Invite code rules, using UUID v4 format, also allows empty string
    FRAME_LOCATION: 'resources/frame.png',

    AVATAR_REGEX: /^data:image\/(png|jpeg|jpg|gif);base64,[A-Za-z0-9+/=]+$/,
    AVATAR_MAX_SIZE: 200 * 1024, // Maximum avatar size in bytes
    AVATAR_SIZE: 130, // Avatar size in pixels

    SETTING_TIMEOUT: 700, // Milliseconds before changing setting on long press
    SETTING_INTERVAL: 20, // Milliseconds for changing setting on long press

    MAX_PLAYERS: { default: 4, minimum: 2, maximum: 100, }, // Maximum amount of players,
    MAX_CARDS: { default: 100, minimum: 2, maximum: 999, }, // Maximum amount of cards which can hold player
    START_CARDS: { default: 7, minimum: 1, maximum: 100, }, // Amount of cards every player will get
    PLAYER_TIME: { default: 60, minimum: 0, maximum: 999, }, // Time for player to select action

    DRAW_TO_MATCH: true, // Draw cards until get playable one
    CAN_STACK_CARDS: true, // Can put same cards at one turn
    CAN_JUMP_IN: true, // Can jump in when cards are same
    CAN_UNO: true, // Can do uno when 1 card
    CAN_REJOIN: true, // Can player rejoin in short time

    ERROR_CODES: {
        '200.0': { code: 200, message: 'OK.' },
        '400.0': { code: 400, message: 'Bad request.' },
        '404.0': { code: 404, message: 'Not Found.' },
        '500.0': { code: 500, message: 'Internal Server Error.' },

        '1001.0': { code: 1001, message: 'There was an error uploading avatar!' },
        '1002.0': { code: 1002, message: 'Game already started!' },
        '1003.0': { code: 1003, message: 'Max players!' },
        '1004.0': { code: 1004, message: 'Invalid username! Username is too short or too long!' },
        '1005.0': { code: 1005, message: 'Invalid invite! Keep empty to create game!' },
        '1006.0': { code: 1006, message: 'Invalid avatar!' },
        '1007.0': { code: 1007, message: 'File is too big!' },

        '2001.0': { code: 2001, message: 'You have been kicked from this game!' },
    },

    COLORS: ['BLUE', 'GREEN', 'RED', 'YELLOW'],

    CARDS: {
        standart: [
            { color: 'BLUE', type: 'ZERO' },
            { color: 'BLUE', type: 'ONE' },
            { color: 'BLUE', type: 'TWO' },
            { color: 'BLUE', type: 'THREE' },
            { color: 'BLUE', type: 'FOUR' },
            { color: 'BLUE', type: 'FIVE' },
            { color: 'BLUE', type: 'SIX' },
            { color: 'BLUE', type: 'SEVEN' },
            { color: 'BLUE', type: 'EIGHT' },
            { color: 'BLUE', type: 'NINE' },

            { color: 'GREEN', type: 'ZERO' },
            { color: 'GREEN', type: 'ONE' },
            { color: 'GREEN', type: 'TWO' },
            { color: 'GREEN', type: 'THREE' },
            { color: 'GREEN', type: 'FOUR' },
            { color: 'GREEN', type: 'FIVE' },
            { color: 'GREEN', type: 'SIX' },
            { color: 'GREEN', type: 'SEVEN' },
            { color: 'GREEN', type: 'EIGHT' },
            { color: 'GREEN', type: 'NINE' },

            { color: 'RED', type: 'ZERO' },
            { color: 'RED', type: 'ONE' },
            { color: 'RED', type: 'TWO' },
            { color: 'RED', type: 'THREE' },
            { color: 'RED', type: 'FOUR' },
            { color: 'RED', type: 'FIVE' },
            { color: 'RED', type: 'SIX' },
            { color: 'RED', type: 'SEVEN' },
            { color: 'RED', type: 'EIGHT' },
            { color: 'RED', type: 'NINE' },

            { color: 'YELLOW', type: 'ZERO' },
            { color: 'YELLOW', type: 'ONE' },
            { color: 'YELLOW', type: 'TWO' },
            { color: 'YELLOW', type: 'THREE' },
            { color: 'YELLOW', type: 'FOUR' },
            { color: 'YELLOW', type: 'FIVE' },
            { color: 'YELLOW', type: 'SIX' },
            { color: 'YELLOW', type: 'SEVEN' },
            { color: 'YELLOW', type: 'EIGHT' },
            { color: 'YELLOW', type: 'NINE' },
        ],
        special: [
            { color: 'BLUE', type: 'REVERSE' },
            { color: 'BLUE', type: 'BLOCK' },
            { color: 'BLUE', type: 'PLUS_TWO' },
              
            { color: 'GREEN', type: 'REVERSE' },
            { color: 'GREEN', type: 'BLOCK' },
            { color: 'GREEN', type: 'PLUS_TWO' },
              
            { color: 'RED', type: 'REVERSE' },
            { color: 'RED', type: 'BLOCK' },
            { color: 'RED', type: 'PLUS_TWO' },
              
            { color: 'YELLOW', type: 'REVERSE' },
            { color: 'YELLOW', type: 'BLOCK' },
            { color: 'YELLOW', type: 'PLUS_TWO' },
              
            { color: 'ANY', type: 'COLOR_CHANGE' },
            { color: 'ANY', type: 'PLUS_FOUR' },
        ],
        cover: { color: 'ANY', type: 'UNO_CARD' }
    }
}

export const UnoConfig = {
    ...GameConfig,

    /**
     * Generates the full UNO card order array.
     *
     * The order follows standard UNO deck rules:
     *   1. For each color in UnoConfig.COLORS:
     *      - All standard number cards (0–9) of that color
     *      - All special action cards (REVERSE, BLOCK, PLUS_TWO) of that color
     *   2. All wild cards (COLOR_CHANGE, PLUS_FOUR) last
     *
     * @returns {Array<{color: string, type: string}>} An array of card objects ordered for sorting.
     * Each card object has:
     *   - color: The card color, one of UnoConfig.COLORS or 'ANY' for wild cards
     *   - type: The card type, e.g., 'ZERO', 'ONE', 'REVERSE', 'PLUS_FOUR', etc.
     */

    CARD_ORDER: () => {
        const CARD_ORDERED = /** @type {Array<{color: string, type: string}>} */([]);
        GameConfig.COLORS.forEach(color => {
            // Standard number cards
            GameConfig.CARDS.standart.filter(c => c.color === color).forEach(c => CARD_ORDERED.push(c));

            // Special action cards for that color
            GameConfig.CARDS.special.filter(c => c.color === color).forEach(c => CARD_ORDERED.push(c));
        });
        // Add wild cards at the end
        GameConfig.CARDS.special.filter(c => c.color === 'ANY').forEach(c => CARD_ORDERED.push(c));
        return CARD_ORDERED;
    },
}

// @ts-ignore
window.config = UnoConfig;