const STORAGE_KEY = "rip-local-rooms-v1";

function readRooms() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (error) {
    return [];
  }
}

function writeRooms(rooms) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms.slice(-12)));
}

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function cleanPlayer(user) {
  return {
    id: user && user.id ? user.id : "guest",
    pseudo: user && user.pseudo ? user.pseudo : "Player",
    ready: false
  };
}

export function listLocalRooms() {
  return readRooms().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function createLocalRoom(gameKey, user) {
  const rooms = readRooms();
  const room = {
    code: makeCode(),
    gameKey,
    status: "waiting",
    players: [cleanPlayer(user)],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  rooms.push(room);
  writeRooms(rooms);
  return room;
}

export function joinLocalRoom(code, user) {
  const rooms = readRooms();
  const cleanCode = String(code || "").trim().toUpperCase();
  const room = rooms.find((candidate) => candidate.code === cleanCode);

  if (!room) {
    throw new Error("room_not_found");
  }

  const player = cleanPlayer(user);
  if (!room.players.some((candidate) => candidate.id === player.id)) {
    room.players.push(player);
  }

  room.updatedAt = new Date().toISOString();
  writeRooms(rooms);
  return room;
}

export function setLocalReady(code, user, ready) {
  const rooms = readRooms();
  const room = rooms.find((candidate) => candidate.code === String(code || "").trim().toUpperCase());

  if (!room) {
    throw new Error("room_not_found");
  }

  const player = room.players.find((candidate) => candidate.id === (user && user.id));
  if (player) {
    player.ready = Boolean(ready);
  }

  if (room.players.length > 0 && room.players.every((candidate) => candidate.ready)) {
    room.status = "playing";
  }

  room.updatedAt = new Date().toISOString();
  writeRooms(rooms);
  return room;
}

export function finishLocalRoom(code) {
  const rooms = readRooms();
  const room = rooms.find((candidate) => candidate.code === String(code || "").trim().toUpperCase());

  if (!room) {
    throw new Error("room_not_found");
  }

  room.status = "done";
  room.updatedAt = new Date().toISOString();
  writeRooms(rooms);
  return room;
}
