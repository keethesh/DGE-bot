//---------------------------------------------------------------------
// Audio
// Contains functions for voice channel stuff.
//---------------------------------------------------------------------

const Audio = {};

Audio.ytdl = null;
try {
	Audio.ytdl = require('ytdl-core');
} catch(e) {}

Audio.DBM = null;

Audio.queue = [];
Audio.volumes = [];
Audio.connections = [];
Audio.dispatchers = [];

Audio.isConnected = function(cache) {
	if(!cache.server) return false;
	const id = cache.server.id;
	return this.connections[id];
};

Audio.isPlaying = function(cache) {
	if(!cache.server) return false;
	const id = cache.server.id;
	return this.dispatchers[id];
};

Audio.setVolume = function(volume, cache) {
	if(!cache.server) return;
	const id = cache.server.id;
	if(this.dispatchers[id]) {
		this.volumes[id] = volume;
		this.dispatchers[id].setVolumeLogarithmic(volume);
	}
};

Audio.connectToVoice = function(voiceChannel) {
	const promise = voiceChannel.join();
	promise.then(function(connection) {
		this.connections[voiceChannel.guild.id] = connection;
		connection.on('disconnect', function() {
			this.connections[voiceChannel.guild.id] = null;
			this.volumes[voiceChannel.guild.id] = null;
		}.bind(this));
	}.bind(this)).catch(console.error);
	return promise;
};

Audio.addToQueue = function(item, cache) {
	if(!cache.server) return;
	const id = cache.server.id;
	if(!this.queue[id]) this.queue[id] = [];
	this.queue[id].push(item);
	this.playNext(id);
};

Audio.clearQueue = function(cache) {
	if(!cache.server) return;
	const id = cache.server.id;
	this.queue[id] = [];
};

Audio.playNext = function(id, forceSkip) {
	if(!this.connections[id]) return;
	if(!this.dispatchers[id] || !!forceSkip) {
		if(this.queue[id].length > 0) {
			const item = this.queue[id].shift();
			this.playItem(item, id);
		} else {
			this.connections[id].disconnect();
		}
	}
};

Audio.playItem = function(item, id) {
	if(!this.connections[id]) return;
	if(this.dispatchers[id]) {
		this.dispatchers[id]._forceEnd = true;
		this.dispatchers[id].end();
	}
	const type = item[0];
	let setupDispatcher = false;
	switch(type) {
		case 'file':
			setupDispatcher = this.playFile(item[2], item[1], id);
			break;
		case 'url':
			setupDispatcher = this.playUrl(item[2], item[1], id);
			break;
		case 'yt':
			setupDispatcher = this.playYt(item[2], item[1], id);
			break;
	}
	if(setupDispatcher && !this.dispatchers[id]._eventSetup) {
		this.dispatchers[id].on('end', function() {
			const isForced = this.dispatchers[id]._forceEnd;
			this.dispatchers[id] = null;
			if(!isForced) {
				this.playNext(id);
			}
		}.bind(this));
		this.dispatchers[id]._eventSetup = true;
	}
};

Audio.playFile = function(url, options, id) {
	this.dispatchers[id] = this.connections[id].playFile(this.DBM.Actions.getLocalFile(url), options);
	return true;
};

Audio.playUrl = function(url, options, id) {
	this.dispatchers[id] = this.connections[id].playArbitraryInput(url, options);
	return true;
};

Audio.playYt = function(url, options, id) {
	if(!this.ytdl) return false;
	const stream = this.ytdl(url, {
		filter: 'audioonly'
	});
	this.dispatchers[id] = this.connections[id].playStream(stream, options);
	return true;
};

module.exports = Audio;