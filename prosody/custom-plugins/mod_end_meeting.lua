-- mod_end_meeting.lua
-- Custom Prosody module for EA-Video
-- Loaded on the MUC component (muc.meet.jitsi) via XMPP_MUC_MODULES
--
-- Strategy: When a room is destroyed via HTTP API, it is blacklisted.
-- If anyone tries to re-create a blacklisted room, we LET them join,
-- then destroy the room after a short delay. This way the Jitsi client
-- receives a proper <destroy> notification and shows "Meeting has ended"
-- instead of silently retrying.

module:depends("http");

local st = require "util.stanza";

module:log("info", "mod_end_meeting loaded on host: %s", module.host);

-- ========== Destroyed rooms blacklist ==========
local destroyed_rooms = {};

-- Cleanup old entries every hour (remove > 24h)
module:add_timer(3600, function()
    local cutoff = os.time() - 86400;
    for name, ts in pairs(destroyed_rooms) do
        if ts < cutoff then
            destroyed_rooms[name] = nil;
        end
    end
    return 3600;
end);

-- ========== Room cache ==========
local rooms_cache = {};

module:hook("muc-room-created", function(event)
    local room = event.room;
    if not room then return; end
    local room_name = (room.jid or ""):match("^(.-)@");
    if not room_name then return; end

    rooms_cache[room_name] = room;
    module:log("info", "Room cached via event: %s", room_name);

    if destroyed_rooms[room_name] then
        -- Blacklisted room was re-created. Let it exist briefly so occupants
        -- can join and receive the proper Jitsi <destroy> notification.
        module:log("info", "Blacklisted room re-created, scheduling destruction in 2s: %s", room_name);
        module:add_timer(2, function()
            -- Re-fetch room in case it was already destroyed
            local r = rooms_cache[room_name];
            if r then
                module:log("info", "Auto-destroying blacklisted room: %s", room_name);
                r:destroy(nil, "Meeting has ended");
                rooms_cache[room_name] = nil;
            end
        end);
    end
end);

module:hook("muc-room-destroyed", function(event)
    local room = event.room;
    if not room then return; end
    local room_name = (room.jid or ""):match("^(.-)@");
    if room_name then
        rooms_cache[room_name] = nil;
        module:log("info", "Room removed from cache: %s", room_name);
    end
end);

-- ========== Jitsi utility library ==========
local jitsi_get_room;
local ok, jitsi_util = pcall(function() return module:require "util" end);
if ok and jitsi_util and type(jitsi_util.get_room_from_jid) == "function" then
    jitsi_get_room = jitsi_util.get_room_from_jid;
    module:log("info", "Jitsi util.get_room_from_jid available");
else
    module:log("info", "Jitsi util not available, will use fallback methods");
end

-- ========== Combined room lookup ==========
local function find_room(room_name)
    local room_jid = room_name .. "@" .. module.host;

    local room = rooms_cache[room_name];
    if room then
        module:log("debug", "Room found via cache: %s", room_name);
        return room;
    end

    if jitsi_get_room then
        room = jitsi_get_room(room_jid);
        if room then
            module:log("debug", "Room found via Jitsi util: %s", room_name);
            return room;
        end
    end

    local host_session = prosody.hosts[module.host];
    if host_session then
        local muc = host_session.modules and host_session.modules.muc;
        if muc then
            if type(muc.get_room_from_jid) == "function" then
                room = muc.get_room_from_jid(room_jid);
                if room then return room; end
            end
            if type(muc.rooms) == "table" then
                room = muc.rooms[room_jid];
                if room then return room; end
            end
        end
    end

    module:log("warn", "Room NOT found by any method: %s", room_name);
    return nil;
end

-- ========== HTTP API ==========
local function handle_destroy(event)
    local room_name = event.request.url.query;
    if not room_name or room_name == "" then
        return { status_code = 400; body = "Missing room name in query string" };
    end

    local cache_count = 0;
    for _ in pairs(rooms_cache) do cache_count = cache_count + 1; end
    module:log("info", "Destroy request for room: %s (cached_rooms=%d)", room_name, cache_count);

    -- Blacklist FIRST (prevents race condition)
    destroyed_rooms[room_name] = os.time();

    local room = find_room(room_name);
    if room then
        room:destroy(nil, "Meeting time has expired");
        rooms_cache[room_name] = nil;
        module:log("info", "Room DESTROYED and blacklisted: %s@%s", room_name, module.host);
        return { status_code = 200; body = "Room destroyed" };
    else
        module:log("warn", "Room not found but blacklisted: %s", room_name);
        return { status_code = 200; body = "Room not found, blacklisted" };
    end
end

local function handle_health(event)
    local cache_count = 0;
    for _ in pairs(rooms_cache) do cache_count = cache_count + 1; end
    local blacklist_count = 0;
    for _ in pairs(destroyed_rooms) do blacklist_count = blacklist_count + 1; end
    return {
        status_code = 200;
        body = string.format("OK | cached_rooms=%d | blacklisted=%d | jitsi_util=%s",
            cache_count, blacklist_count, tostring(jitsi_get_room ~= nil));
    };
end

module:provides("http", {
    default_path = "/end-meeting";
    route = {
        ["GET /destroy"] = handle_destroy;
        ["POST /destroy"] = handle_destroy;
        ["GET /health"] = handle_health;
    };
});

module:log("info", "mod_end_meeting ready (jitsi_util=%s)", tostring(jitsi_get_room ~= nil));
