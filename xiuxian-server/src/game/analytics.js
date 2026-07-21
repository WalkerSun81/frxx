function logGameEvent(db, roleId, eventName, data = {}) {
  db.run(
    'INSERT INTO t_game_event (role_id, event_name, event_data) VALUES (?, ?, ?)',
    [roleId, eventName, JSON.stringify(data)]
  );
}

module.exports = { logGameEvent };
