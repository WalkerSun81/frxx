/**
 * api.js — fetch 封装
 * 所有与后端的 HTTP 通信通过此模块
 */
const API = (() => {
  const BASE = '';  // 同域部署

  let _token = null;

  function setToken(t) { _token = t; localStorage.setItem('xiuxian_token', t); }
  function getToken() {
    if (!_token) _token = localStorage.getItem('xiuxian_token');
    return _token;
  }
  function clearToken() { _token = null; localStorage.removeItem('xiuxian_token'); }

  async function request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const resp = await fetch(BASE + path, {
      method: options.method || 'POST',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await resp.json();
    if (data.code === 1003) clearToken();
    return data;
  }

  // ---------- Phase 0: 基础 ----------
  function health()           { return request('/api/health', { method: 'GET' }); }
  function login(deviceId)    { return request('/api/login', { body: { device_id: deviceId } }); }

  // ---------- Phase 1: 角色 ----------
  function createRole(name)   { return request('/api/role/create', { body: { name } }); }
  function getRoleInfo(roleId) { return request(`/api/role/info?role_id=${roleId}`, { method: 'GET' }); }

  // ---------- Phase 1: 灵根 ----------
  function randomElement(roleId) { return request('/api/element/random', { body: { role_id: roleId } }); }
  function confirmElement(roleId, data) {
    return request('/api/element/confirm', { body: { role_id: roleId, ...data } });
  }

  // ---------- Phase 1: 命格 ----------
  function randomTalent(roleId) { return request('/api/talent/random', { body: { role_id: roleId } }); }
  function confirmTalent(roleId, talents) {
    return request('/api/talent/confirm', { body: { role_id: roleId, talents } });
  }

  // ---------- Phase 2: 修炼 ----------
  function cultivate(roleId)     { return request('/api/role/cultivate', { body: { role_id: roleId } }); }
  function tick(roleId)          { return request('/api/role/tick', { body: { role_id: roleId } }); }
  function autoCultivate(roleId) { return request('/api/role/auto_cultivate', { body: { role_id: roleId } }); }
  function breakthrough(roleId)  { return request('/api/role/breakthrough', { body: { role_id: roleId } }); }
  function startAfk(roleId)      { return request('/api/role/start_afk', { body: { role_id: roleId } }); }
  function offlineReward(roleId) { return request('/api/role/offline_reward', { body: { role_id: roleId } }); }

  // ---------- Phase 3: 战斗 ----------
  function battleMaps(roleId)    { return request(`/api/battle/maps?role_id=${roleId}`, { method: 'GET' }); }
  function challenge(roleId, mapId, layer) {
    return request('/api/battle/challenge', { body: { role_id: roleId, map_id: mapId, layer } });
  }
  function battleBuild(roleId) { return request(`/api/battle/build?role_id=${roleId}`, { method: 'GET' }); }
  function saveBattleBuild(roleId, strategy, skills) {
    return request('/api/battle/build', { body: { role_id: roleId, strategy, skills } });
  }
  function claimRewardChoice(choiceId, optionIndex) {
    return request('/api/battle/reward-choice', { body: { choice_id: choiceId, option_index: optionIndex } });
  }
  function pendingRewardChoice(roleId) { return request(`/api/battle/reward-choice?role_id=${roleId}`, { method: 'GET' }); }

  // ---------- Phase 4: 装备 ----------
  function equipItem(equipId, slotType) {
    return request('/api/equipment/equip', { body: { equipment_id: equipId, slot_type: slotType } });
  }
  function unequipItem(roleId, slotType) {
    return request('/api/equipment/unequip', { body: { role_id: roleId, slot_type: slotType } });
  }
  function enhanceItem(equipId) {
    return request('/api/equipment/enhance', { body: { equipment_id: equipId } });
  }

  // ---------- Phase 6: 商城 ----------
  function shopBuy(roleId, itemId, count) {
    return request('/api/shop/buy', { body: { role_id: roleId, item_id: itemId, count: count || 1 } });
  }

  // ---------- Phase 5: 宝石与生活技能 ----------
  function gemList(roleId) { return request(`/api/gem/list?role_id=${roleId}`, { method: 'GET' }); }
  function mountGem(roleId, gemId, equipmentId, slotIndex) { return request('/api/gem/mount', { body: { role_id: roleId, gem_id: gemId, equipment_id: equipmentId, slot_index: slotIndex } }); }
  function unmountGem(roleId, equipmentId, slotIndex) { return request('/api/gem/unmount', { body: { role_id: roleId, equipment_id: equipmentId, slot_index: slotIndex } }); }
  function composeGem(roleId, gemIds) { return request('/api/gem/compose', { body: { role_id: roleId, gem_ids: gemIds } }); }
  function lifeInfo(roleId) { return request(`/api/life/info?role_id=${roleId}`, { method: 'GET' }); }
  function collect(roleId) { return request('/api/life/collect', { body: { role_id: roleId } }); }
  function craft(roleId) { return request('/api/life/craft', { body: { role_id: roleId } }); }

  return { setToken, getToken, clearToken, health, login,
    createRole, getRoleInfo, randomElement, confirmElement, randomTalent, confirmTalent,
    cultivate, tick, autoCultivate, breakthrough, startAfk, offlineReward,
    battleMaps, challenge, battleBuild, saveBattleBuild, claimRewardChoice, pendingRewardChoice, equipItem, unequipItem, enhanceItem, shopBuy,
    gemList, mountGem, unmountGem, composeGem, lifeInfo, collect, craft };
})();
