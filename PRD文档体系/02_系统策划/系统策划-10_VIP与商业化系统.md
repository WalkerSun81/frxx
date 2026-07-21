# 系统策划-10_VIP与商业化系统

## 1.1 系统概述

- **系统定位**：核心变现模块，提供付费加速体验
- **设计理念**：付费不破坏平衡，加速体验差异
- **设计目标**：让免费玩家有良好体验，让付费玩家有尊享感

---

## 1.2 VIP等级体系

### 1.2.1 VIP等级表

| VIP等级 | 累计充值 | 解锁内容 |
|:---:|:---:|:---|
| VIP 0 | 0 | 基础功能 |
| VIP 1 | 6元 | 月卡基础功能 |
| VIP 2 | 30元 | 基础特权 |
| VIP 3 | 68元 | 中级特权 |
| VIP 4 | 128元 | 高级特权 |
| VIP 5 | 328元 | 至尊特权 |

### 1.2.2 VIP权益详表

| 权益项 | VIP 0 | VIP 1 | VIP 2 | VIP 3 | VIP 4 | VIP 5 |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **修炼加成** | x1.0 | x1.1 | x1.2 | x1.3 | x1.4 | x1.5 |
| **挂机上限** | 8h | 10h | 12h | 14h | 16h | 20h |
| **突破成功率加成** | +0% | +2% | +4% | +6% | +8% | +10% |
| **体力上限** | 100 | 120 | 150 | 180 | 220 | 300 |
| **体力恢复速度** | 5min/点 | 4min/点 | 3min/点 | 3min/点 | 2min/点 | 2min/点 |
| **每日免费刷新坊市** | 0次 | 1次 | 2次 | 3次 | 5次 | 无限 |
| **宗门任务双倍** | - | - | - | - | - | - |
| **离线收益恢复** | 80% | 85% | 90% | 95% | 100% | 100% |
| **自动战斗** | - | - | - | - | - | - |
| **专属称号** | - | - | - | - | - | - |
| **专属头像框** | - | - | - | - | - | - |
| **客服优先通道** | - | - | - | - | - | - |

### 1.2.3 VIP配置常量

```python
# VIP等级阈值配置
VIP_THRESHOLDS = {
    0: 0,
    1: 6,
    2: 30,
    3: 68,
    4: 128,
    5: 328
}

# VIP修炼加成
VIP_CULTIVATE_MULTIPLIER = {
    0: 1.0,
    1: 1.1,
    2: 1.2,
    3: 1.3,
    4: 1.4,
    5: 1.5
}

# VIP挂机时间上限（秒）
VIP_AFK_LIMIT = {
    0: 28800,   # 8小时
    1: 36000,   # 10小时
    2: 43200,   # 12小时
    3: 50400,   # 14小时
    4: 57600,   # 16小时
    5: 72000    # 20小时
}

# VIP突破成功率加成
VIP_BREAK_BONUS = {
    0: 0,
    1: 0.02,
    2: 0.04,
    3: 0.06,
    4: 0.08,
    5: 0.10
}

# VIP体力上限
VIP_STAMINA_MAX = {
    0: 100,
    1: 120,
    2: 150,
    3: 180,
    4: 220,
    5: 300
}

# VIP体力恢复速度（秒/点）
VIP_STAMINA_RECOVER = {
    0: 300,   # 5分钟
    1: 240,   # 4分钟
    2: 180,   # 3分钟
    3: 180,   # 3分钟
    4: 120,   # 2分钟
    5: 120    # 2分钟
}
```

---

## 1.3 付费商品定价

### 1.3.1 订阅类商品

| 商品ID | 商品名 | 价格 | 周期 | 内容 | 性价比 |
|:---|:---|:---:|:---:|:---|:---:|
| sub_month | 月卡 | 30元 | 30天 | 每日200灵石+50强化石 | 五星 |
| sub_quarter | 季卡 | 68元 | 90天 | 每日300灵石+80强化石+VIP2 | 五星 |
| sub_lifetime | 终身卡 | 128元 | 永久 | 永久x1.2修炼加成 | 四星 |

**月卡ROI计算**：
- 总获得：200x30=6,000灵石 + 50x30=1,500强化石
- 折算价值：6,000灵石约等于60元（坊市价），1,500强化石约等于15元
- 实际价值：75元
- ROI：75/30 = 2.5倍

### 1.3.2 资源类商品

| 商品ID | 商品名 | 价格 | 内容 | 单价 | 备注 |
|:---|:---|:---:|:---|:---:|:---|
| pack_small | 小礼包 | 6元 | 200灵石+命格石x1 | 6元 | 新手付费入门 |
| pack_medium | 中礼包 | 30元 | 1200灵石+强化石x30 | 30元 | 月卡用户升级 |
| pack_large | 大礼包 | 68元 | 4000灵石+强化石x100+3级宝石x2 | 68元 | 季卡用户 |
| pack_fund | 成长基金 | 68元 | 购买后累计返4000灵石 | 68元 | 性价比极高 |

### 1.3.3 功能类商品

| 商品ID | 商品名 | 价格 | 内容 | 用途 |
|:---|:---|:---:|:---|:---|
| item_medal | 命格石 | 6元 | 重置命格1次 | 刷初始 |
| item_medal_10 | 命格石x10 | 50元 | 重置命格10次 | 连抽 |
| item_protect | 护境符 | 6元 | 突破失败保护1次 | 防翻车 |
| item_protect_5 | 护境符x5 | 25元 | 突破失败保护5次 | 防翻车 |
| item_enhance_protect | 强化保护符 | 3元 | 强化失败不降级 | 防掉级 |
| item_enhance_protect_10 | 强化保护符x10 | 25元 | 强化失败不降级x10 | 防掉级 |

### 1.3.4 商品配置表

```python
# 商品配置
PRODUCTS = {
    # 订阅类
    'sub_month': {
        'name': '月卡',
        'price': 30,
        'type': 'subscription',
        'duration_days': 30,
        'daily_rewards': {
            'gold': 200,
            'enhance_stone': 50
        }
    },
    'sub_quarter': {
        'name': '季卡',
        'price': 68,
        'type': 'subscription',
        'duration_days': 90,
        'daily_rewards': {
            'gold': 300,
            'enhance_stone': 80
        },
        'vip_grant': 2
    },
    'sub_lifetime': {
        'name': '终身卡',
        'price': 128,
        'type': 'subscription',
        'duration_days': -1,  # 永久
        'permanent_bonus': {
            'cultivate_multiplier': 1.2
        }
    },
    
    # 资源类
    'pack_small': {
        'name': '小礼包',
        'price': 6,
        'type': 'resource_pack',
        'rewards': {
            'gold': 200,
            'medal': 1
        }
    },
    'pack_medium': {
        'name': '中礼包',
        'price': 30,
        'type': 'resource_pack',
        'rewards': {
            'gold': 1200,
            'enhance_stone': 30
        }
    },
    'pack_large': {
        'name': '大礼包',
        'price': 68,
        'type': 'resource_pack',
        'rewards': {
            'gold': 4000,
            'enhance_stone': 100,
            'gem_level3': 2
        }
    },
    'pack_fund': {
        'name': '成长基金',
        'price': 68,
        'type': 'fund',
        'total_return': 4000,
        'unlock_schedule': [
            {'day': 7, 'gold': 500},
            {'day': 14, 'gold': 500},
            {'day': 21, 'gold': 1000},
            {'day': 30, 'gold': 2000}
        ]
    },
    
    # 功能类
    'item_medal': {
        'name': '命格石',
        'price': 6,
        'type': 'item',
        'item_id': 'medal',
        'quantity': 1
    },
    'item_medal_10': {
        'name': '命格石x10',
        'price': 50,
        'type': 'item',
        'item_id': 'medal',
        'quantity': 10
    },
    'item_protect': {
        'name': '护境符',
        'price': 6,
        'type': 'item',
        'item_id': 'protect',
        'quantity': 1
    },
    'item_protect_5': {
        'name': '护境符x5',
        'price': 25,
        'type': 'item',
        'item_id': 'protect',
        'quantity': 5
    },
    'item_enhance_protect': {
        'name': '强化保护符',
        'price': 3,
        'type': 'item',
        'item_id': 'enhance_protect',
        'quantity': 1
    },
    'item_enhance_protect_10': {
        'name': '强化保护符x10',
        'price': 25,
        'type': 'item',
        'item_id': 'enhance_protect',
        'quantity': 10
    }
}
```

---

## 1.4 付费渗透率设计

### 1.4.1 用户分层

| 用户分层 | 占比 | 付费意愿 | 核心需求 |
|:---|:---:|:---:|:---|
| 零氪 | 60% | 0元 | 基本游戏体验 |
| 微氪 | 25% | 6-30元 | 月卡+礼包 |
| 中氪 | 10% | 30-200元 | 季卡+成长基金+礼包 |
| 重氪 | 4% | 200-1000元 | 全商品购买 |
| 鲸鱼 | 1% | 1000元+ | 极致追求 |

### 1.4.2 ARPU目标

| 指标 | 目标值 | 说明 |
|:---|:---:|:---|
| 注册转付费率 | 5% | 100个注册用户5个付费 |
| 次日留存 | 40% | 第2天仍在玩 |
| 7日留存 | 20% | 第7天仍在玩 |
| 30日留存 | 10% | 第30天仍在玩 |
| LTV | 50元 | 生命周期价值 |
| ARPU | 2.5元 | 平均每用户收入 |

### 1.4.3 付费转化漏斗

```
注册用户 (100%)
    ↓ 40% 次留
活跃用户 (40%)
    ↓ 12.5% 付费转化
付费用户 (5%)
    ↓
首充金额分布：
- 6元：60%
- 30元：25%
- 68元：10%
- 其他：5%
```

---

## 1.5 付费节奏设计

### 1.5.1 新手期（第1-7天）

| 时间点 | 付费触点 | 推荐商品 | 目的 |
|:---|:---|:---|:---|
| 注册即触 | 新手礼包 | 6元小礼包 | 付费意识建立 |
| 第3天 | 月卡弹窗 | 30元月卡 | 首充转化 |
| 第5天 | 成长基金 | 68元成长基金 | 大额转化 |
| 第7天 | 限时礼包 | 30元中礼包 | 周卡转化 |

### 1.5.2 成长期（第8-30天）

| 时间点 | 付费触点 | 推荐商品 | 目的 |
|:---|:---|:---|:---|
| 突破前 | 突破礼包 | 6元护境符 | 防挫败 |
| 强化失败 | 保护符弹窗 | 3元保护符 | 即时转化 |
| 首次橙色装备 | 强化加速 | 6元强化石 | 付费强化 |
| 坊市刷新 | 刷新提示 | VIP特权 | 长期价值 |

### 1.5.3 成熟期（30天+）

| 时间点 | 付费触点 | 推荐商品 | 目的 |
|:---|:---|:---|:---|
| 月卡到期 | 续费提醒 | 30元月卡 | 续订 |
| 活动期间 | 限时礼包 | 68元大礼包 | 活动转化 |
| 版本更新 | 新功能礼包 | 128元季卡 | 大版本推广 |
| 每周礼包 | 周卡礼包 | 30元中礼包 | 持续付费 |

### 1.5.4 付费触点配置

```python
# 付费触点配置
PAYMENT_TRIGGERS = {
    'new_player': {
        'trigger_type': 'login',
        'day_offset': 0,
        'product_id': 'pack_small',
        'title': '新手特惠礼包',
        'subtitle': '限时6元，带你快速入门',
        'show_count': 1
    },
    'first_week_card': {
        'trigger_type': 'login',
        'day_offset': 3,
        'product_id': 'sub_month',
        'title': '月卡特惠',
        'subtitle': '每日领取，仅需30元',
        'show_count': 3
    },
    'growth_fund': {
        'trigger_type': 'login',
        'day_offset': 5,
        'product_id': 'pack_fund',
        'title': '成长基金',
        'subtitle': '68元返还4000灵石，超值',
        'show_count': 5
    },
    'break_protect': {
        'trigger_type': 'break_fail',
        'product_id': 'item_protect',
        'title': '突破保护',
        'subtitle': '下次突破不会失败',
        'show_count': 1
    },
    'enhance_fail': {
        'trigger_type': 'enhance_fail',
        'product_id': 'item_enhance_protect',
        'title': '强化保护',
        'subtitle': '保护本次强化不降级',
        'show_count': 1
    }
}
```

---

## 1.6 付费安全设计

### 1.6.1 支付安全

- 接入官方支付渠道（Apple Store / Google Play / 国内渠道SDK）
- 订单服务端校验
- 发放前验证支付状态
- 防止重复发放（幂等设计）

### 1.6.2 防刷机制

```python
def verify_purchase(player_id, receipt, platform):
    # 1. 验证Receipt签名
    if not verify_receipt_signature(receipt, platform):
        return {'success': False, 'msg': '验证失败'}
    
    # 2. 查询订单是否已处理
    if is_order_processed(receipt['order_id']):
        return {'success': False, 'msg': '订单已处理'}
    
    # 3. 校验金额
    expected_amount = get_product_price(receipt['product_id'])
    if receipt['amount'] < expected_amount:
        return {'success': False, 'msg': '金额不符'}
    
    # 4. 发放物品
    grant_items(player_id, receipt['product_id'])
    
    # 5. 标记订单已处理
    mark_order_processed(receipt['order_id'])
    
    return {'success': True}
```

### 1.6.3 异常订单处理

```python
# 异常订单处理流程
EXCEPTION_HANDLING = {
    'duplicate_order': {
        'action': 'ignore',
        'msg': '订单已处理'
    },
    'amount_mismatch': {
        'action': 'log_and_alert',
        'msg': '金额异常，已记录'
    },
    'fake_receipt': {
        'action': 'ban_player',
        'msg': '检测到作弊行为'
    },
    'server_error': {
        'action': 'retry',
        'max_retry': 3,
        'msg': '处理中，请稍后'
    }
}
```

---

## 1.7 服务端实现要点

### 1.7.1 VIP等级计算

```python
def calculate_vip_level(player_id):
    player = get_player(player_id)
    total_recharge = player['total_recharge']
    
    # VIP等级阈值
    thresholds = [0, 6, 30, 68, 128, 328, 999999]
    
    vip_level = 0
    for i, threshold in enumerate(thresholds):
        if total_recharge >= threshold:
            vip_level = i
    
    return vip_level

def get_vip_bonus(role_id):
    vip_level = calculate_vip_level(get_player_id(role_id))
    
    return {
        'cultivate_multiplier': VIP_CULTIVATE[vip_level],
        'afk_limit': VIP_AFK_LIMIT[vip_level],
        'break_bonus': VIP_BREAK_BONUS[vip_level],
        'stamina_max': VIP_STAMINA_MAX[vip_level],
        'stamina_recover': VIP_STAMINA_RECOVER[vip_level]
    }
```

### 1.7.2 充值记录表

```sql
CREATE TABLE t_recharge (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  player_id BIGINT NOT NULL,
  order_id VARCHAR(64) UNIQUE,
  product_id VARCHAR(32),
  amount DECIMAL(10,2),
  currency VARCHAR(8),
  platform VARCHAR(16),
  status TINYINT DEFAULT 0,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  process_time DATETIME,
  INDEX idx_player_id (player_id),
  INDEX idx_order_id (order_id),
  INDEX idx_status (status)
);
```

### 1.7.3 VIP状态表

```sql
CREATE TABLE t_vip_info (
  player_id BIGINT PRIMARY KEY,
  vip_level TINYINT DEFAULT 0,
  total_recharge DECIMAL(10,2) DEFAULT 0,
  lifetime_card_expire_time DATETIME,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 1.7.4 订阅状态表

```sql
CREATE TABLE t_subscription (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  player_id BIGINT NOT NULL,
  subscription_type VARCHAR(32) NOT NULL,
  start_time DATETIME NOT NULL,
  expire_time DATETIME NOT NULL,
  status TINYINT DEFAULT 1,
  INDEX idx_player_id (player_id),
  INDEX idx_expire_time (expire_time)
);
```

### 1.7.5 订单处理服务

```python
class OrderProcessor:
    """订单处理服务"""
    
    def process_order(self, order_data):
        # 1. 基础验证
        if not self.validate_order(order_data):
            return {'success': False, 'msg': '订单验证失败'}
        
        # 2. 幂等检查
        if self.is_order_processed(order_data['order_id']):
            return {'success': False, 'msg': '订单已处理'}
        
        # 3. 获取商品信息
        product = get_product(order_data['product_id'])
        if not product:
            return {'success': False, 'msg': '商品不存在'}
        
        # 4. 开启事务
        with transaction():
            # 5. 更新累计充值
            self.update_total_recharge(order_data['player_id'], order_data['amount'])
            
            # 6. 发放物品
            self.grant_rewards(order_data['player_id'], product)
            
            # 7. 处理VIP等级
            new_vip_level = self.update_vip_level(order_data['player_id'])
            
            # 8. 处理订阅
            if product['type'] == 'subscription':
                self.process_subscription(order_data['player_id'], product)
            
            # 9. 标记订单已处理
            self.mark_order_processed(order_data)
            
            # 10. 记录日志
            self.log_recharge(order_data, product)
        
        return {
            'success': True,
            'vip_level': new_vip_level,
            'rewards': self.format_rewards(product)
        }
```

---

## 1.8 前端实现要点

### 1.8.1 VIP特权面板

- 当前VIP等级展示
- 各等级特权对比表
- 下一级特权预览
- 充值按钮

### 1.8.2 付费弹窗设计

- 首充双倍标识
- 限时折扣标签
- 剩余时间倒计时
- 购买确认按钮

### 1.8.3 支付流程

```
1. 选择商品 → 点击购买
2. 调起支付渠道SDK
3. 支付成功回调
4. 服务端发放物品
5. 客户端展示获得物品动画
6. 更新VIP状态
```

### 1.8.4 界面组件配置

```javascript
// VIP面板配置
const VIP_PANEL_CONFIG = {
    showUpgradePath: true,
    showCurrentBonus: true,
    showNextLevelBonus: true,
    animatedProgress: true
};

// 付费弹窗配置
const PAYMENT_POPUP_CONFIG = {
    showFirstRechargeDouble: true,
    showLimitedTimeTag: true,
    showCountdown: true,
    confirmButtonAnimates: true
};

// 支付渠道配置
const PAYMENT_CHANNELS = {
    ios: 'apple_iap',
    android: 'google_play',
    cn_android: 'alipay,wechat,unionpay'
};
```

---

## 1.9 运营活动配置

### 1.9.1 首充活动

```python
# 首充双倍配置
FIRST_RECHARGE = {
    'enabled': True,
    'multiplier': 2.0,
    'products': ['pack_small', 'pack_medium', 'pack_large', 'sub_month'],
    'duration_days': 7,  # 注册后7天内有效
    'once_only': True
}
```

### 1.9.2 限时折扣

```python
# 限时折扣活动
LIMITED_DISCOUNT = {
    'event_id': 'weekend_discount',
    'start_time': '2024-01-01 00:00:00',
    'end_time': '2024-01-07 23:59:59',
    'discounts': {
        'pack_large': {'original': 68, 'discounted': 48, 'ratio': 0.7},
        'item_protect_5': {'original': 25, 'discounted': 18, 'ratio': 0.72}
    }
}
```

### 1.9.3 累充回馈

```python
# 累充回馈活动
CUMULATIVE_RECHARGE = {
    'event_id': 'cumulative_100',
    'threshold_rewards': [
        {'cumulative': 30, 'rewards': {'gold': 500}},
        {'cumulative': 68, 'rewards': {'gold': 1000, 'gem_level2': 2}},
        {'cumulative': 128, 'rewards': {'gold': 2000, 'gem_level3': 1}},
        {'cumulative': 328, 'rewards': {'gold': 5000, 'gem_level4': 1}}
    ]
}
```

---

## 1.10 关键数值配置表

| 配置项 | 数值 | 说明 |
|:---|:---:|:---|
| VIP 0充值阈值 | 0元 | 免费玩家 |
| VIP 1充值阈值 | 6元 | 小额付费 |
| VIP 2充值阈值 | 30元 | 月卡级别 |
| VIP 3充值阈值 | 68元 | 季卡级别 |
| VIP 4充值阈值 | 128元 | 终身卡 |
| VIP 5充值阈值 | 328元 | 重氪级别 |
| 月卡定价 | 30元/30天 | 日均1元 |
| 季卡定价 | 68元/90天 | 日均0.76元 |
| 终身卡定价 | 128元/永久 | 一次性 |
| 小礼包定价 | 6元 | 新手入门 |
| 中礼包定价 | 30元 | 中等付费 |
| 大礼包定价 | 68元 | 高性价比 |
| 成长基金定价 | 68元 | 返还4000灵石 |
| 目标付费转化率 | 5% | 注册用户 |
| 目标ARPU | 2.5元 | 平均每用户 |
| 目标LTV | 50元 | 生命周期价值 |
