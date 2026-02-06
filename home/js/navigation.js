var navigationItems = [
    {
        name: "Home",
        href: "/home",
        icon: "fas fa-home",
    },
    {
        name: "UNO Game",
        href: "/uno-game",
        icon: "fa-solid fa-dice-six",
    },
    {
        name: "File Hosting",
        href: "/file-hosting",
        icon: "fa-solid fa-cloud",
    },
    {
        name: "Steam Workshop Download",
        href: "/steam-workshop-download",
        icon: "fa-brands fa-steam-symbol",
    },
    {
        name: "Text Playground",
        href: "/text-playground",
        icon: "fa-solid fa-flask",
    },
    {
        name: "Bad Apple!! MBR",
        href: "/bad-apple-mbr",
        icon: "fas fa-apple-alt",
    },
    {
        name: "Lofi Hip Hop",
        href: "/lofi-hip-hop",
        icon: "fas fa-music",
    },
    {
        name: "Road Signs",
        href: "/road-signs",
        icon: "fa-solid fa-traffic-light",
    },
    {
        name: "MSI Control",
        href: "https://github.com/serbinskis/Delphi/tree/master/MSIControl",
        icon: "fas fa-cogs",
    },
    {
        name: "Soundboard",
        href: "https://github.com/serbinskis/Delphi/tree/master/Soundborad",
        icon: "fas fa-volume-up",
    },
    {
        name: "Clipboard History",
        href: "https://github.com/serbinskis/Delphi/tree/master/ClipboardHistory",
        icon: "fa-solid fa-paste",
    },
    {
        name: "Mini Recycle Bin",
        href: "https://github.com/serbinskis/Delphi/tree/master/MiniRecycleBin",
        icon: "fas fa-trash-alt",
    },
    {
        name: "Auto Start",
        href: "https://github.com/serbinskis/Delphi/tree/master/AutoStart",
        icon: "fa-brands fa-usps",
    },
    {
        name: "MBR/UEFI - Image Builder",
        href: "https://github.com/serbinskis/Delphi/tree/master/MBR%20UEFI%20-%20Image%20Builder",
        icon: "fas fa-dice-d6",
    },
    {
        name: "MBR/UEFI - Note Builder",
        href: "https://github.com/serbinskis/Delphi/tree/master/MBR%20UEFI%20-%20Note%20Builder",
        icon: "fas fa-dice-d6",
    },
    {
        name: "nzip Compression",
        href: "https://github.com/serbinskis/nzip-java",
        icon: "fa-solid fa-file-zipper",
    },
    {
        name: "24-bit Float Converter",
        href: "https://github.com/serbinskis/float24-cpp",
        icon: "fa-solid fa-teeth",
    },
    {
        name: "Beans Game C++",
        href: "https://github.com/serbinskis/beans-game-cpp",
        icon: "fa-brands fa-space-awesome",
    },
    {
        name: "Windows Activator",
        href: "https://github.com/serbinskis/windows-activate",
        icon: "fa-brands fa-windows",
    },
    {
        name: "Microsoft Office Activator",
        href: "https://github.com/serbinskis/microsoft-office/",
        icon: "fa-solid fa-file-word",
    },
    {
        name: "SMPTweaks - Minecraft Plugin",
        href: "https://github.com/serbinskis/minecraft-plugins/tree/master/SMPTweaks",
        icon: "fa-solid fa-hammer",
    },
    {
        name: "Content Warning - Cheat",
        href: "https://github.com/serbinskis/content-mod",
        icon: "fa-solid fa-triangle-exclamation",
    },
    {
        name: "serbinskis-utils - NodeJS Library",
        href: "https://github.com/serbinskis/serbinskis-utils/tree/main",
        icon: "fa-brands fa-node-js",
    },
]

function isElementOverflowing(element) {
    var overflowX = element.offsetWidth < element.scrollWidth;
    var overflowY = element.offsetHeight < element.scrollHeight;
    return (overflowX || overflowY);
}

function bindMarquee(element) {
    $(element).bind("mouseover", function(event) {
        if (!isElementOverflowing($(this)[0])) { return; } else { $(this).marquee("destroy"); }
        $(this).marquee({ direction: "left", duplicated: true, startVisible: true, delayBeforeStart: 300, speed: 70 });
        $(this).bind("mouseleave", function(event) { $(this).marquee("destroy"); bindMarquee(this); });
    });
}

function createNavigation() {
    var navigationContainer = document.createElement("div");
    navigationContainer.className = "navigationContainer";

    var navigation = document.createElement("div");
    navigation.className = "navigation";
    navigation.appendChild(document.createElement("ul"));

    var toggle = document.createElement("div");
    toggle.className = "toggle";

    navigationContainer.appendChild(navigation);
    navigationContainer.appendChild(toggle);
    document.documentElement.insertBefore(navigationContainer, document.body);
}

function createItem(item) {
    if (!document.querySelector(".navigationContainer .navigation ul")) { createNavigation(); }
    var i = document.createElement("i");
    i.className = item.icon;

    var icon = document.createElement("span");
    icon.className = "icon";
    icon.appendChild(i);

    var title = document.createElement("span");
    title.className = "title navigation-title";
    title.title = item.name;
    title.innerHTML = item.name;

    var a = document.createElement("a");
    var ports = (item?.ports || [0, 0]);
    var port = ((window.location.protocol == "https:") && ports[1]) ? ports[1] : ports[0];
    var protocol = ((window.location.protocol == "https:") && ports[1]) ? "https" : "http"
    a.href = item.ports ? `${protocol}://${window.location.host}:${port}${item.href}` : item.href;
    a.appendChild(icon);
    a.appendChild(title);

    var li = document.createElement("li");
    if (item.onclick) { li.addEventListener("click", item.onclick) };
    li.appendChild(a);

    var navigation = document.querySelector(".navigationContainer .navigation ul");
    navigation.appendChild(li);
}

async function loadScript(url) {
    return await new Promise(resolve => {
        var script = document.createElement("script");
        script.type = "text/javascript";
        script.src = url;
        script.onload = script.onerror = resolve;
        document.getElementsByTagName("head")[0].appendChild(script);
    });
}

(async () => {
    var iframes = Array.from(document.querySelectorAll("iframe#serbinskis")).map(e => ["src", e]);
    var links = Array.from(document.querySelectorAll("link#serbinskis")).map(e => ["href", e]);

    iframes.concat(links).forEach(([key, elm]) => {
        if (location.hostname.includes('github.io')) {
            location.replace(`${location.href}/github`);
        }

        if (location.href.includes("http://") && !elm[key].includes("http://")) {
            elm[key] = iframe.src.replace("https://", "http://");
        }

        if (location.href.includes("https://") && !elm[key].includes("https://")) {
            elm[key] = elm[key].replace(/:(\d+)/, `:${8443 + (parseInt(elm[key].match(/:(\d+)/)[1]) - 80)}`).replace("http://", "https://");
        };

        if (new URL(elm[key]).hostname != location.hostname) {
            elm[key] = elm[key].replace(new URL(elm[key]).hostname, location.hostname);
        }

        if (elm.tagName.toLowerCase() === 'iframe') {
            const fallbackUrl = window.location.origin + window.location.pathname.replace(/\/$/, '') + '/github';
            let loaded = false;
            elm.onload = () => { loaded = true; };
            elm.onerror = () => { window.location.href = fallbackUrl; };
            setTimeout(() => { if (!loaded) { window.location.href = fallbackUrl; }}, 3000);
        }
    });

    await loadScript("https://kit.fontawesome.com/fd6213b064.js");
    await loadScript("https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js");
    await loadScript("https://cdn.jsdelivr.net/npm/jquery.marquee@1.6.0/jquery.marquee.min.js");

    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = "/home/css/navigation.css";
    link.media = "all";
    document.getElementsByTagName("head")[0].appendChild(link);

    link.onload = () => {
        navigationItems.forEach(item => createItem(item));
        if (document.location.pathname == '/home/') { setTimeout(() => document.getElementsByClassName("toggle")[0].click(), 100); }
        //if (document.location.pathname != '/home/') { setTimeout(() => document.getElementsByClassName("toggle")[0].click(), 500); }
        bindMarquee(".navigation-title");

        document.querySelector(".toggle").onclick = () => {
            document.querySelector(".toggle").classList.toggle("active");
            document.querySelector(".navigation").classList.toggle("active");
            document.querySelector(".navigationContainer").classList.toggle("active");
        }
    };
})();