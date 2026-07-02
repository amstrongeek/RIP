async function callClickerRpc(name, parameters = {}) {
  if (!window.RipSupabase || !window.RipSupabase.isConfigured()) {
    throw new Error("supabase-config-missing");
  }

  const client = await window.RipSupabase.getClient();
  const { data, error } = await client.rpc(name, parameters);
  if (error) throw error;
  return data;
}

export function getClickerState() {
  return callClickerRpc("clicker_get_state");
}

export function submitClickerTaps(count) {
  return callClickerRpc("clicker_tap", {
    tap_count_input: Math.max(1, Math.min(50, Math.trunc(Number(count) || 1)))
  });
}

export function buyClickerUpgrade(upgradeKey) {
  return callClickerRpc("clicker_buy_upgrade", {
    upgrade_key_input: String(upgradeKey || "").trim().toLowerCase()
  });
}
