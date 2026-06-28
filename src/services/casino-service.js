async function callCasinoRpc(name, parameters = {}) {
  if (!window.RipSupabase || !window.RipSupabase.isConfigured()) {
    throw new Error("supabase-config-missing");
  }

  const client = await window.RipSupabase.getClient();
  const { data, error } = await client.rpc(name, parameters);

  if (error) {
    throw error;
  }

  return data;
}

export function createBlackjackTable() {
  return callCasinoRpc("casino_create_blackjack");
}

export function getCasinoHealth() {
  return callCasinoRpc("casino_get_health");
}

export function joinBlackjackTable(code) {
  return callCasinoRpc("casino_join_blackjack", {
    game_code_input: String(code || "").trim().toUpperCase()
  });
}

export function getBlackjackState(gameId) {
  return callCasinoRpc("casino_get_blackjack_state", {
    game_id_input: gameId
  });
}

export function setBlackjackBet(gameId, bet) {
  return callCasinoRpc("casino_set_blackjack_bet", {
    game_id_input: gameId,
    bet_input: Math.trunc(Number(bet) || 0)
  });
}

export function startBlackjack(gameId) {
  return callCasinoRpc("casino_start_blackjack", {
    game_id_input: gameId
  });
}

export function hitBlackjack(gameId) {
  return callCasinoRpc("casino_hit_blackjack", {
    game_id_input: gameId
  });
}

export function standBlackjack(gameId) {
  return callCasinoRpc("casino_stand_blackjack", {
    game_id_input: gameId
  });
}

export function forfeitBlackjack(gameId) {
  return callCasinoRpc("casino_forfeit_blackjack", {
    game_id_input: gameId
  });
}

export function leaveBlackjackTable(gameId) {
  return callCasinoRpc("casino_leave_blackjack", {
    game_id_input: gameId
  });
}

export function startLadderGame(wager) {
  return callCasinoRpc("casino_start_ladder", {
    wager_input: Math.trunc(Number(wager) || 0)
  });
}

export function getLadderState(gameId) {
  return callCasinoRpc("casino_get_ladder_state", {
    game_id_input: gameId
  });
}

export function submitLadderGuess(gameId, guess) {
  return callCasinoRpc("casino_ladder_guess", {
    game_id_input: gameId,
    guess_input: String(guess || "")
  });
}

export function cashOutLadder(gameId) {
  return callCasinoRpc("casino_cashout_ladder", {
    game_id_input: gameId
  });
}
