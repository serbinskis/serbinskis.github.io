// @ts-check

import { UnoConfig } from './config.js';
import { GameManager } from './game.js';
import { HostDisconnectPayload, Packet, PeerConnectPayload, PeerDisconnectPayload } from './packets.js';

// When connecting to host, it will expose other peers, this is intended behavior
// This is in case if host migrates, we need to be able to connect to other peers directly
// For this reason, if we are client, we only will listen to host and not other peers
// Host will handle all other connections

export class NetworkManager extends EventTarget {
    static HEARTBEAT_INTERVAL = 500;
    /** @protected @type {string} */ peerId = ''; // PeerJS ID visible to others, we need to know this in case if host migrates
    /** @protected @type {boolean} */ _isHost = false;
    /** @protected @type {any} */ peer = null;
    /** @protected @type {any} */ connection = null;
    /** @protected @type {Object<string, any>} */ connections = {};
    /** @protected @type {Map<string, Function>} */ eventHandlers = new Map();
    /** @protected @type {number|any} */ heartbeat_interval = 0;

    constructor() {
        super();
        this.eventHandlers = new Map();
    }

    /**
     * Initializes the PeerJS connection.
     *
     * @param {string | null} [hostId=null] - The ID to connect to. If null, a new Peer will be created as a host.
     * @param {boolean} [supressError=false] - Whether to suppress error alerts on connection failure.
     * @returns {Promise<string | null>} A promise that resolves with the client's own Peer ID upon successful connection,
     * or rejects with an error if the connection fails.
     */
    async init(hostId = null, supressError = false) {
        this.setHost(!hostId);
        /**@type {string|null} **/ let id = this.getPeerId();
        if (!this.peer) { id = await this.initPeer(); }
        if (!id) { return null; }

        if (hostId) { await this.connectPeer(hostId, supressError); }
        if (hostId && !this.connection) { return null; }
        this.heartbeat(NetworkManager.HEARTBEAT_INTERVAL);
        return (this.peerId = id);
    }

    /** Disconnects from the current peer and clears all connections. */
    disconnectPeer() {
        if (this.connection) { this.connection.close(); }
        this.connections = {};
        this.connection = null;
    }

    /**
     * Initializes the PeerJS connection to the host.
     *
     * @param {string} peerId - The ID to connect to. If null, a new Peer will be created as a host.
     * @param {boolean} [supressError=false] - Whether to suppress error alerts on connection failure.
     * @returns {Promise<boolean>} A promise that resolves with the client's own Peer ID upon successful connection,
     * or rejects with an error if the connection fails.
     */
    async connectPeer(peerId, supressError = false) {
        if (this.connection) { this.connection.close(); } // Close connection with old host

        return new Promise(async (resolve, reject) => {
            if (!this.peer) { return false; }
            this.connection = this.peer.connect(peerId);
            this.heartbeat(NetworkManager.HEARTBEAT_INTERVAL); // We also have to periodically check if we still have connection with the host

            this.connection.on('error', (/** @type {Error} */ err) => {
                this.connection = null;
                if (!supressError) { alert("Network Error: " + err); }
                reject(false);
            });

            this.connection.on('open', () => {
                // Used for send method, which just uses broadcast, which uses this map
                this.connections[peerId] = this.connection;
                resolve(true);
            });

            this.connection.on('close', () => {
                this.connection = null;
                delete this.connections[peerId];
                this.handlePacket(peerId, new HostDisconnectPayload(peerId, 'Connection closed'));
            });

            // This part essentialy runs as client, note this is client-host conenctions
            // All messages are only from the host, and not anybody else

            this.connection.on('data', (/** @type {any} */ data) => {
                this.handlePacket(peerId, data);
            });
        });
    }

    /**
     * Initializes the PeerJS connection as host.
     *
     * @returns {Promise<string | null>} A promise that resolves with the client's own Peer ID upon successful connection.
     */
    async initPeer() {
        return new Promise((resolve, reject) => {
            if (this.peer) { this.peer.disconnect(); }
            // @ts-ignore
            this.peer = new Peer(UnoConfig.PEER_OPTS);

            // First we connect to the peer, something like lobby, it give us
            // our id, by which we can connect to other users, or receive connections.

            this.peer.once('open', (/** @type {String} */ id) => {
                this.peerId = String(id);
                console.log(`[NetworkManager] Ready. ID: ${id}`);
                resolve(this.peerId);
            });

            this.peer.once('error', (/** @type {Error} */ err) => {
                this.peer = null;
                alert("Network Error: " + err);
                reject(null);
            });

            // Doesn't matter if we are host or client we will handle incomming connections, but
            // if we are client we will just ignore packets, only host will process them.
            // This is needed for host migration, because when host disconnects, we will try to connect
            // to next in the list player, and he will become host, that means that each player, need to be
            // ready for becoming a host, therefore we accept connections, and if we become host we then
            // send packet that we are ready for communcation, and after that game continuous

            // NOT TRUE ANYMORE, NOW HOST AND CLIENTS ARE SOMEWHAT SEPARATED, BUT MIGRATION IS STILL POSSIBLE

            // This also means that anyone with malicous intent can connect to other players, but they won't be able to
            // do anything because we won't accept their packets, we only will allow them to be connected (NO WE WONT)

            this.peer.on('connection', (/** @type {any} */ conn) => {
                conn.on('open', () => {
                    if (!this.isHost()) { return conn.close(); } // Only host will process new connections, clients will ignore them
                    this.connections[conn.peer] = conn;
                    this.handlePacket(conn.peer, new PeerConnectPayload(conn.peer));
                });

                conn.on('close', () => {
                    if (!this.isHost()) { return; } // Only host will process new connections, clients will ignore them
                    delete this.connections[conn.peer];
                    this.handlePacket(conn.peer, new PeerDisconnectPayload(conn.peer, 'Connection closed'));
                });

                conn.on('data', (/** @type {any} */ data) => {
                    if (!this.isHost()) { return; } // Only host will process new data, clients will ignore them
                    this.handlePacket(conn.peer, data);
                });
            });
        });
    }

    /**
     * Sends a periodic heartbeat to manage connections.
     * Ensures that any disconnected or failed peers are removed from the connection list.
     * 
     * @param {number} [interval=0] The interval in milliseconds. If > 0, the heartbeat repeats. If 0, it runs once. If < 0, it is disabled.
     */
    heartbeat(interval = 0) {
        clearTimeout(this.heartbeat_interval);
        if (interval < 0) { return; }
        if (interval > 0) { this.heartbeat_interval = setTimeout(() => this.heartbeat(interval), interval); }

        Object.values(this.connections).forEach(conn => {
            if (!['disconnected', 'failed'].includes(conn.peerConnection.connectionState)) { return; }
            delete this.connections[conn.peer];
            if (this.isHost()) { this.handlePacket(conn.peer, new PeerDisconnectPayload(conn.peer, 'Timed out')); }
            if (!this.isHost()) { this.handlePacket(conn.peer, new HostDisconnectPayload(conn.peer, 'Timed out')); }
        });
    }

    /**
     * Checks if the current instance is the host.
     * @returns {boolean} True if the instance is the host, false otherwise.
     */
    isHost() {
        return this._isHost;
    }

    /**
     * Sets the host status of the current instance.
     * @param {boolean} isHost - True to set as host, false otherwise.
     */
    setHost(isHost) {
        this._isHost = isHost;
    }

    /**
     * @returns {string} Returns peer id
     */
    getPeerId() {
        return this.peerId;
    }

    /**
     * Send message to host or broadcast
     * It is pretty much same as broadcast for clients,
     * but clients should only have one connection to host
     * @param {Packet} packet 
     */
    send(packet) {
        this.broadcast(packet);
    }

    /**
     * Send to specific peer (Host only)
     * @param {string} peerId
     * @param {Packet} packet
     */
    sendTo(peerId, packet) {
        if (this.connections[peerId]) { this.connections[peerId].send(packet.stringify()); }
    }

    /**
     * Broadcast message to all connected peers, host excluded
     * @param {Packet} packet - The packet to broadcast.
     */
    broadcast(packet) {
        // For some reason just sending object doesnt work, it just throws an error
        Object.values(this.connections).forEach(c => c.send(packet.stringify()));
    }

    /**
     * Registers an event handler for a specific packet type.
    * @template {Packet} T
    * @param {{ PACKET: string, prototype: T }} PacketClass
    * @param {(peer: string, packet: T, manager: GameManager) => void} cb
    */
    on(PacketClass, cb) {
        this.eventHandlers.set(PacketClass.PACKET, (/** @type {String} */ peer, /** @type {T} */ packet) => cb(peer, packet, GameManager.getInstance()));
    }

    /**
     * Handles a packet received from another peer.
     * @param {string} peerId - 
     * @param {any | Packet} packet - The packet data to be handled.
     * @param {boolean} [suppress=false] - Whether to suppress broadcasting the packet if this instance is the host.
     */
    handlePacket(peerId, /** @type {Packet|null} */ packet, suppress = false) {
        // This handles hosts and clients packets at the same time
        // If packet is class, that means we invoked handlePacket on host side (SOMEWHERE IN GAME LOGIC)
        // to handle it and broadcast at the same time

        // If packet is object then it was received from outside, which means
        // we just handle it either as client or host

        if (this.isHost() && !suppress && (packet instanceof Packet)) { this.broadcast(packet); } //TODO: verify if this is safe
        if (!(packet instanceof Packet)) { packet = Packet.parse(packet); } // Convert string or object to Packet instance
        if (!packet?.validate()) { console.warn('[NetworkManager] Received invalid packet:', packet?.getPacketType()); return; } // Question mark also checks for null
        console.log(`[NetworkManager] handlePacket -> peerId: ${peerId}, type: ${packet.getPacketType()} packet:`);
        console.dir(packet.clone(), { depth: null });
        this.emit(peerId, packet);
    }

    /**
     * Emits an event for the given packet type.
     * @param {string} peerId - 
     * @param {Packet} packet - The packet data to emit.
     */
    emit(peerId, packet) {
        this.eventHandlers.get(packet?.packetType)?.(peerId, packet);
    }
}