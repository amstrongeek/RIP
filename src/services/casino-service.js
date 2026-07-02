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

export function createPublicBlackjackTable() {
  return callCasinoRpc("casino_create_public_blackjack");
}

export function quickMatchBlackjack() {
  return callCasinoRpc("casino_quick_match_blackjack");
}

export function listPublicBlackjackTables() {
  return callCasinoRpc("casino_list_public_blackjack");
}

export function getCasinoHealth() {
  return callCasinoRpc("casino_get_health");
}

export function claimWelcomeBonus() {
  return callCasinoRpc("casino_claim_welcome_bonus");
}

export function playInstantGame(gameKey, wager, choice = {}) {
  return callCasinoRpc("casino_play_boosted", {
    game_key_input: String(gameKey || ""),
    wager_input: Math.trunc(Number(wager) || 0),
    choice_input: choice
  });
}

export function getCasinoBoosts() {
  return callCasinoRpc("casino_get_boosts");
}

export function activateCasinoBoost(boostKey) {
  return callCasinoRpc("casino_activate_boost", {
    boost_key_input: String(boostKey || "")
  });
}

export function getCasinoLiveFeed(limit = 10) {
  return callCasinoRpc("casino_get_live_feed", {
    limit_count: Math.max(1, Math.min(20, Math.trunc(Number(limit) || 10)))
  });
}

export function getRecentCasinoRounds(limit = 12) {
  return callCasinoRpc("casino_get_recent_rounds", {
    limit_count: Math.max(1, Math.min(40, Math.trunc(Number(limit) || 12)))
  });
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
