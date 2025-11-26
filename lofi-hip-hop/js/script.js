var splitted = 'https://github.com/serbinskis/serbinskis.github.io/releases/tag/lofi-hip-hop'.split('/');
var playlist;
var preloaded = {};
var audio = new Audio();
var marqueeSong;
var marqueeArtist;

function isElementOverflowing(element) {
    var overflowX = element.offsetWidth < element.scrollWidth;
    var overflowY = element.offsetHeight < element.scrollHeight;
    return (overflowX || overflowY);
}

function bytesToSize(bytes) {
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes == 0) { return '0 Byte'; }
    var i = parseInt(Math.floor(Math.log(bytes)/Math.log(1024)));
    return Math.round(bytes/Math.pow(1024, i), 2) + ' ' + sizes[i];
}

function base64ToBlob(base64, type) {
    var byteString = atob(base64);
    var arrayBuffer = new ArrayBuffer(byteString.length);
    var uintArray = new Uint8Array(arrayBuffer);

    for (var i = 0; i < byteString.length; i++) {
        uintArray[i] = byteString.charCodeAt(i);
    }

    return new Blob([arrayBuffer], { type });
}

async function loadPlaylist() {
    var response = await new Promise(resolve => {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', `https://api.github.com/repos/${splitted[3]}/${splitted[4]}/releases/tags/${splitted[7]}`);
        xhr.onload = () => resolve(xhr.response);
        xhr.send();
    });

    return JSON.parse(response).assets.filter(a => /\.(mp3|wav|ogg|m4a|aac|flac|weba)$/i.test(a.name));
}

async function loadFile(url) {
    return await new Promise(resolve => {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.responseType = 'blob';
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = (e) => console.error("Proxy Error:", e);
        xhr.send();
    });
}

async function preload() {
    var rnum = Math.floor(Math.random() * Math.floor(playlist.length));
    var targetUrl = playlist[rnum].browser_download_url;
    var proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(targetUrl);
    var buffer = await loadFile(proxyUrl);
    var name = playlist[rnum].name;
    var type = `audio/${name.split('.').pop()}`;

    preloaded = { name: name, size: bytesToSize(buffer.size), type: type, blob: buffer }
    console.log(`Preloaded '${preloaded.name}' | Size: ${preloaded.size}`);
}

async function shuffleMusic() {
    $('#button')[0].disabled = true;

    if (Object.entries(preloaded).length == 0) {
        await preload();
    }

    await playSound(preloaded);
    await preload();

    $('#button')[0].disabled = false;
}

async function playSound(sound) {
    console.log(`Playing '${sound.name}' | Size: ${sound.size}`);
    await loadTags(sound.blob);

    audio.onended = shuffleMusic;
    audio.src = URL.createObjectURL(sound.blob);
    audio.pause();
    audio.currentTime = 0;
    audio.play();
}

function checkMarquee() {
    if (marqueeSong) { marqueeSong.marquee('destroy'); }
    if (marqueeArtist) { marqueeArtist.marquee('destroy'); }

    setTimeout(() => {
        if (isElementOverflowing($('.song')[0])) {
            marqueeSong = $('.song').marquee({ direction: 'left', duplicated: true, startVisible: true });
        }

        if (isElementOverflowing($('.artist')[0])) {
            marqueeArtist = $('.artist').marquee({ direction: 'left', duplicated: true, startVisible: true });
        }
    }, 1000);
}

async function loadTags(blob) {
    return await new Promise(resolve => {
        new jsmediatags.Reader(blob)
            .setTagsToRead(['title', 'album', 'artist', 'picture'])
            .read({
                onSuccess: function(tag) {
                    var tags = tag.tags;

                    if ((tags.title) && (tags.album)) {
                        var name = `${tags.title}${' - '}${tags.album}`
                    } else if ((tags.title) && !(tags.album)) {
                        var name = tags.title;
                    } else if (!(tags.title) && (tags.album)) {
                        var name = tags.album;
                    } else {
                        var name = 'Unknown name';
                    }

                    $('#songLeft')[0].textContent = name;
                    $('#songRight')[0].textContent = name;

                    $('#artistLeft')[0].textContent = tags.artist || 'Unknown artist';
                    $('#artistRight')[0].textContent = tags.artist || 'Unknown artist';

                    checkMarquee();

                    if (tags.picture) {
                        var base64 = '';
                        for (var i = 0; i < tags.picture.data.length; i++) {
                            base64 += String.fromCharCode(tags.picture.data[i]);
                        }

                        base64 = `data:${tags.picture.format};base64,${window.btoa(base64)}`;
                        $('#coverLeft')[0].setAttribute('src', base64);
                        $('#coverRight')[0].setAttribute('src', base64);
                    } else {
                        $('#coverLeft')[0].setAttribute('src', '..\resources\cover.png');
                        $('#coverRight')[0].setAttribute('src', '..\resources\cover.png');
                    }

                    console.log('Loaded metadata.\n ');
                    resolve();
                },
                onError: function(error) {
                    console.log(error);
                    resolve();
                }
            });
    });
}

(async () => {
    $('#button')[0].onclick = shuffleMusic;
    playlist = await loadPlaylist();
    shuffleMusic();
})();

