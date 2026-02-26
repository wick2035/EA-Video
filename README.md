# EA-Video 在线问诊系统 — 部署指南

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                      你的服务器 (Linux)                          │
│                                                                  │
│   ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌──────┐  ┌──────┐ │
│   │  MySQL   │  │  Jitsi   │  │ Prosody │  │Jicofo│  │ JVB  │ │
│   │  :58107  │  │  Web     │  │ (XMPP)  │  │      │  │:58104│ │
│   │          │  │  :58103  │  │         │  │      │  │(UDP) │ │
│   └──────────┘  └──────────┘  └─────────┘  └──────┘  └──────┘ │
│                                                                  │
│   ┌──────────┐  ┌──────────────────────────────────────────┐    │
│   │  coturn  │  │  Backend (Node.js Express)  :58102       │    │
│   │  :58105  │  │  REST API + Socket.io                    │    │
│   │  :58106  │  └──────────────────────────────────────────┘    │
│   │  :58110  │                                                   │
│   │  ~58200  │                                                   │
│   └──────────┘                                                   │
└─────────────────────────────────────────────────────────────────┘
        ▲
        │  互联网
        ▼
┌──────────────────────┐
│   你的本地电脑        │
│   Frontend (React)   │
│   npm run dev :5173  │
└──────────────────────┘
```

**服务器运行**：MySQL、Jitsi Meet 全套（web/prosody/jicofo/jvb）、coturn、Backend API
**本地运行**：React 前端 (Vite dev server)，通过代理连接服务器上的 Backend API

### 关键自定义组件

| 文件 | 说明 |
|------|------|
| `prosody/custom-plugins/mod_end_meeting.lua` | 自定义 Prosody 模块：会议销毁 + 黑名单阻止重新进入 |
| `backend/src/services/prosodyService.js` | Backend 调用 Prosody HTTP API 销毁 MUC 房间 |
| `jitsi/custom-config.js` | Jitsi 配置覆盖（E2EE、P2P、禁用欢迎页等） |
| `jitsi/custom-interface_config.js` | Jitsi 界面配置（去水印、品牌定制） |
| `jitsi/custom-body.html` | Jitsi 根路径自定义页面（显示"请使用授权链接"） |

---

## 第一部分：服务器环境准备

### 1.1 系统要求

- **操作系统**：Ubuntu 20.04 / 22.04 LTS（推荐）或 CentOS 7+
- **最低配置**：2 核 CPU、4GB RAM、40GB 硬盘
- **推荐配置**：4 核 CPU、8GB RAM、80GB SSD
- **需要 root 或 sudo 权限**

### 1.2 安装 Docker 和 Docker Compose

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 将当前用户加入 docker 组（免 sudo）
sudo usermod -aG docker $USER

# 重新登录使权限生效
exit
# 重新 SSH 登录

# 验证 Docker 安装
docker --version
docker compose version
```

### 1.3 安装 Git

```bash
sudo apt install git -y
```

### 1.4 防火墙端口放通

```bash
# 使用 ufw（Ubuntu）
sudo ufw allow 58101/tcp   # Frontend（如果将来也部署到服务器）
sudo ufw allow 58102/tcp   # Backend API + WebSocket
sudo ufw allow 58103/tcp   # Jitsi Web HTTPS
sudo ufw allow 58104/udp   # JVB 视频媒体流
sudo ufw allow 58105/tcp   # coturn TURN (TCP)
sudo ufw allow 58105/udp   # coturn STUN/TURN (UDP)
sudo ufw allow 58106/tcp   # coturn TURNS (TLS)
sudo ufw allow 58107/tcp   # MySQL（可选，仅远程调试需要）
sudo ufw allow 58110:58200/udp   # coturn 中继端口池
sudo ufw allow 58110:58200/tcp   # coturn 中继端口池 (TCP)

# 确认 ufw 已启用
sudo ufw enable

```

```bash
sudo ufw status
```

如果使用云服务器（阿里云/腾讯云/AWS），还需要在**安全组/Security Group** 中放通以上端口。

### 1.5 获取服务器公网 IP

```bash
curl -4 ifconfig.me
# 记录此 IP，后面配置要用，例如：203.0.113.50
```

---

## 第二部分：部署项目到服务器

### 2.1 上传项目代码

**方式 A：Git 方式（推荐）**

```bash
# 在服务器上
cd /opt
sudo git clone <你的仓库地址> ea-video
cd ea-video
sudo chown -R $USER:$USER .
```

**方式 B：SCP/SFTP 上传**

```bash
# 在你的本地电脑上执行（排除 node_modules 和 dist）
scp -r ./EA-Video user@你的服务器IP:/opt/ea-video
```

### 2.2 配置环境变量

```bash
cd /opt/ea-video

# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
nano .env
```

**关键修改项（将示例值替换为你的实际值）**：

```env
# ============================================
# EA-Video Environment Configuration
# ============================================

# --- MySQL ---
MYSQL_ROOT_PASSWORD=你的MySQL_root密码_要强密码
MYSQL_USER=ea_video_user
MYSQL_PASSWORD=你的MySQL用户密码_要强密码
MYSQL_PORT=58107

# --- Jitsi JWT Authentication ---
JWT_APP_ID=ea_video_telehealth
JWT_APP_SECRET=用下面命令生成的64位随机字符串

# --- Jitsi Internal Passwords ---
JICOFO_AUTH_PASSWORD=用下面命令生成的随机字符串
JVB_AUTH_PASSWORD=用下面命令生成的随机字符串

# --- Jitsi Public Access ---
JITSI_IMAGE_VERSION=stable
JITSI_PUBLIC_URL=https://你的域名或IP:58103
JITSI_HTTPS_PORT=58103

# --- TURN/STUN ---
TURN_HOST=你的服务器公网IP
TURN_PORT=58105
TURNS_PORT=58106
TURN_CREDENTIALS=用下面命令生成的随机字符串
TURN_REALM=ea-video
JVB_ADVERTISE_IPS=你的服务器公网IP

# --- JVB Media ---
JVB_PORT=58104

# --- Backend ---
BACKEND_PORT=58102
API_SECRET=用下面命令生成的随机字符串

# --- Frontend ---
FRONTEND_PORT=58101
VITE_API_URL=http://你的服务器公网IP:58102
VITE_JITSI_DOMAIN=你的服务器公网IP:58103
```

**生成随机密码/密钥的命令**：

```bash
# 生成 64 字符 hex 字符串（用于 JWT_APP_SECRET）
openssl rand -hex 32

# 生成 32 字符随机字符串（用于各种密码）
openssl rand -base64 24
```

**具体示例（假设服务器 IP 为 203.0.113.50）**：

```bash
# 批量生成所有需要的密码
echo "JWT_APP_SECRET: $(openssl rand -hex 32)"
echo "JICOFO_AUTH_PASSWORD: $(openssl rand -base64 24)"
echo "JVB_AUTH_PASSWORD: $(openssl rand -base64 24)"
echo "TURN_CREDENTIALS: $(openssl rand -base64 24)"
echo "API_SECRET: $(openssl rand -base64 24)"
echo "MYSQL_ROOT_PASSWORD: $(openssl rand -base64 24)"
echo "MYSQL_PASSWORD: $(openssl rand -base64 24)"
```

### 2.3 配置 coturn 密钥

coturn 配置文件中的密钥需要和 `.env` 中 `TURN_CREDENTIALS` 保持一致：

```bash
nano coturn/turnserver.conf
```

将 `static-auth-secret=` 后面的值替换为你在 `.env` 中设置的 `TURN_CREDENTIALS` 值：

```conf
# 替换前
static-auth-secret=${TURN_CREDENTIALS:-change_me_turn_secret}

# 替换后（用你的实际值）
static-auth-secret=你在.env中设置的TURN_CREDENTIALS值
```

同时修改 `server-name`：

```conf
# 替换为你的服务器 IP 或域名
server-name=203.0.113.50
```

---

## 第三部分：数据库创建与启动服务

### 3.1 数据库自动创建原理

MySQL Docker 镜像首次启动时会**自动完成以下操作**（你不需要手动建库建表）：

1. 读取 `.env` 中的 `MYSQL_ROOT_PASSWORD`，设置 root 密码
2. 读取 `.env` 中的 `MYSQL_DATABASE=ea_video`，**自动创建 `ea_video` 数据库**
3. 读取 `.env` 中的 `MYSQL_USER` 和 `MYSQL_PASSWORD`，**自动创建用户并授权**
4. 执行 `scripts/init-db.sql`（挂载到容器内 `/docker-entrypoint-initdb.d/init.sql`），**自动建表 + 插入种子数据**

对应 `docker-compose.yml` 中的关键配置：

```yaml
mysql:
  image: mysql:8.0
  environment:
    MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}   # ← 第1步：设 root 密码
    MYSQL_DATABASE: ea_video                       # ← 第2步：自动创建数据库
    MYSQL_USER: ${MYSQL_USER}                      # ← 第3步：自动创建用户
    MYSQL_PASSWORD: ${MYSQL_PASSWORD}              # ← 第3步：设用户密码
  volumes:
    - mysql_data:/var/lib/mysql                    # ← 数据持久化
    - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql  # ← 第4步：自动执行建表SQL
```

`init-db.sql` 会自动创建 5 张表 + 插入 5 个医生、5 个患者、8 条系统配置作为演示数据。

> **注意**：以上自动初始化**只在首次启动时执行**（即 `mysql_data` 卷为空时）。如果之前已经启动过，MySQL 会跳过初始化脚本。需要重新初始化请参考第五部分「手动重置数据库」。

### 3.2 首次启动 MySQL

```bash
cd /opt/ea-video

# 第一步：拉取所有镜像
docker compose pull

# 第二步：先只启动 MySQL
docker compose up -d mysql
```

等待 MySQL 完成初始化（首次需要约 30-60 秒来建库建表）：

```bash
# 查看 MySQL 启动日志，确认初始化完成
docker compose logs mysql
```

你应该在日志中看到类似以下内容（表示自动建库建表成功）：

```
[System] [MY-010931] ... /usr/sbin/mysqld: ready for connections.
[Note] [Entrypoint]: Creating database ea_video
[Note] [Entrypoint]: Creating user ea_video_user
[Note] [Entrypoint]: Giving user ea_video_user access to database ea_video
[Note] [Entrypoint]: /usr/local/bin/docker-entrypoint.sh: running /docker-entrypoint-initdb.d/init.sql
```

确认容器状态为 healthy：

```bash
docker compose ps
# 确认 mysql 状态显示 Up (healthy) 再继续
```

### 3.3 验证数据库内容

现在数据库、用户、表、种子数据已经全部自动创建完毕。验证一下：

```bash
# 连接 MySQL（密码是你在 .env 中设置的 MYSQL_PASSWORD）
docker exec -it ea-video-mysql mysql -u ea_video_user -p
```

输入密码后进入 MySQL 终端，执行：

```sql
c
```

你应该看到：

```
+--------------------+
| Tables_in_ea_video |
+--------------------+
| audit_logs         |
| doctors            |
| meetings           |
| patients           |
| system_configs     |
+--------------------+
```

验证种子数据是否已插入：

```sql
SELECT uuid, name, specialty FROM doctors;
-- 应该看到 5 条医生数据

SELECT uuid, name, gender FROM patients;
-- 应该看到 5 条患者数据

SELECT config_key, config_value FROM system_configs;
-- 应该看到 8 条配置数据

-- 退出 MySQL
EXIT;
```

> 如果表不存在或数据为空，检查 `docker compose logs mysql` 看有没有 SQL 执行报错。

### 3.4 启动其余所有服务

```bash
# 启动 Jitsi 全套 + coturn + Backend
docker compose up -d

# 查看所有容器状态
docker compose ps
```

正常情况应看到类似输出：

```
NAME                STATUS
ea-video-mysql      Up (healthy)
ea-video-coturn     Up
ea-video-jitsi-web  Up
ea-video-prosody    Up
ea-video-jicofo     Up
ea-video-jvb        Up
ea-video-backend    Up
ea-video-frontend   Up      ← 此服务存在但你可以不用它，前端在本地跑
```

### 3.5 查看日志排查问题

```bash
# 查看所有服务日志
docker compose logs -f

# 只看某个服务的日志
docker compose logs -f backend
docker compose logs -f mysql
docker compose logs -f jitsi-web
docker compose logs -f coturn
docker compose logs -f prosody
```

### 3.6 验证各服务是否正常

```bash
# 1. Backend API 健康检查
curl http://localhost:58102/api/v1/config
# 应返回 JSON 配置列表

# 2. 测试登录
curl -X POST http://localhost:58102/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# 应返回 {"token":"...","username":"admin","role":"admin"}

# 3. 查看医生列表（需要 token）
TOKEN=$(curl -s -X POST http://localhost:58102/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -H "Authorization: Bearer $TOKEN" http://localhost:58102/api/v1/doctors
# 应返回 5 个医生的数据

# 4. 查看患者列表
curl -H "Authorization: Bearer $TOKEN" http://localhost:58102/api/v1/patients
# 应返回 5 个患者的数据

# 5. Jitsi Web 可访问性（HTTPS 自签名证书会报警，用 -k 忽略）
curl -k https://localhost:58103
# 应返回 Jitsi Meet 的 HTML 页面
```

---

## 第四部分：本地运行前端

### 4.1 前端环境要求

- **Node.js** >= 18.x（推荐 20 LTS）
- **npm** >= 9.x

### 4.2 安装依赖

```bash
# 在你的本地电脑上
cd d:/Agent/EA-Video/frontend
npm install
```

### 4.3 配置前端连接到服务器

编辑 `frontend/vite.config.js`，将代理目标指向你的服务器：

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://你的服务器IP:58102',  // ← 改为服务器地址
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://你的服务器IP:58102',  // ← 改为服务器地址
        ws: true,
      },
    },
  },
});
```

**示例**（假设服务器 IP 为 203.0.113.50）：

```js
proxy: {
  '/api': {
    target: 'http://203.0.113.50:58102',
    changeOrigin: true,
  },
  '/socket.io': {
    target: 'http://203.0.113.50:58102',
    ws: true,
  },
},
```

同时确认 `frontend/src/pages/MeetingRoom.jsx` 中的 Jitsi 域名能正确指向服务器。在项目根目录创建 `frontend/.env`（或修改已有的）：

```env
VITE_API_URL=http://203.0.113.50:58102
VITE_JITSI_DOMAIN=203.0.113.50:58103
```

### 4.4 启动前端开发服务器

```bash
cd d:/Agent/EA-Video/frontend
npm run dev
```

输出：

```
  VITE v5.x.x  ready

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

### 4.5 访问系统

打开浏览器访问 `http://localhost:5173`

**登录凭据**：

- 用户名：`admin`
- 密码：`admin123`

---

## 第五部分：数据库管理

### 5.1 从外部连接数据库

如果你开放了 58107 端口，可以用 MySQL 客户端（Navicat、DBeaver、MySQL Workbench 等）远程连接：


| 参数       | 值                   |
| -------- | ------------------- |
| Host     | 你的服务器 IP            |
| Port     | 58107               |
| User     | ea_video_user       |
| Password | 你设置的 MYSQL_PASSWORD |
| Database | ea_video            |


### 5.2 手动重置数据库

如果需要完全重置（**删除所有数据**）：

```bash
cd /opt/ea-video

# 停止所有服务
docker compose down

# 删除 MySQL 数据卷
docker volume rm ea-video_mysql_data

# 重新启动（会重新执行 init-db.sql）
docker compose up -d
```

### 5.3 手动执行 SQL

```bash
# 进入 MySQL 容器
docker exec -it ea-video-mysql mysql -u ea_video_user -p ea_video

# 然后执行任意 SQL，例如添加新医生：
INSERT INTO doctors (uuid, name, phone, email, specialty, title, department, is_active)
VALUES (UUID(), 'New Doctor', '13800000099', 'new@hospital.com', 'Surgery', 'Surgeon', 'Surgery', 1);
```

### 5.4 数据库备份与恢复

```bash
# 备份
docker exec ea-video-mysql mysqldump -u ea_video_user -p你的密码 ea_video > backup_$(date +%Y%m%d).sql

# 恢复
docker exec -i ea-video-mysql mysql -u ea_video_user -p你的密码 ea_video < backup_20260226.sql
```

---

## 第六部分：完整操作演示流程

### 6.1 创建一次问诊（端到端）

1. 浏览器打开 `http://localhost:5173`，用 admin/admin123 登录
2. 进入左侧菜单「Meetings」页面
3. 点击右上角「Create Consultation」按钮
4. 在弹出的表单中：
  - **Patient**：选择 `Zhao Lei`
  - **Doctor**：选择 `Zhang Wei`
  - **Scenario**：选择 `General`（时长自动填充 30 分钟）
  - **Encrypted**：保持打开
5. 点击「Create」
6. 成功后弹出对话框，显示：
  - **Doctor Join URL** — 发给医生的链接
  - **Patient Join URL** — 发给患者的链接
7. 分别在两个浏览器窗口（或无痕窗口）打开这两个链接
8. 双方进入 Jitsi 视频房间，可以开始视频通话

### 6.2 观察实时状态

1. 打开 Dashboard 页面
2. 在另一个标签页操作会议（创建/开始/结束）
3. Dashboard 的「Active Now」计数和表格会实时更新，无需手动刷新

### 6.3 测试时长控制

1. 创建一个会议，将 Max Duration 设为 `2`（分钟）
2. 进入 MeetingRoom 页面观察
3. 倒计时从 02:00 开始递减
4. 到 01:00 时收到黄色警告
5. 到 00:00 时会议自动结束，状态变为 `completed`，end_reason 为 `timeout`

### 6.4 会议终止与房间销毁流程

当会议结束（手动结束或超时）时，系统的完整流程：

1. **Backend** 调用 `prosodyService.destroyRoom(roomName)`
2. **ProsodyService** 发送 HTTP GET 请求到 Prosody：`/end-meeting/destroy?<roomName>`（带 `Host: muc.meet.jitsi` 头）
3. **mod_end_meeting.lua** 收到请求后：
   - 将房间名加入内存黑名单
   - 调用 `room:destroy()` 踢出所有参与者
   - 嵌入式 iframe 用户（前端）收到销毁通知后被 `forceHangup()` 踢出
   - 直接 Jitsi 链接用户收到 XMPP `<destroy>` 通知后看到"会议已结束"
4. **黑名单防重入**：如果有人尝试重新创建已销毁的房间：
   - 房间被允许短暂创建（2 秒）
   - 然后自动销毁，用户再次收到"会议已结束"通知
   - 黑名单条目 24 小时后自动清除

验证 Prosody 模块状态：

```bash
# 检查模块是否加载
docker logs ea-video-prosody 2>&1 | grep end_meeting | tail -5

# 健康检查（从 backend 容器内部）
docker exec ea-video-backend wget --header="Host: muc.meet.jitsi" -qO- http://xmpp.meet.jitsi:5280/end-meeting/health
# 应返回: OK | cached_rooms=0 | blacklisted=0 | jitsi_util=true
```

---

## 第七部分：常见问题排查

### Q1: Backend 无法连接 MySQL

```bash
# 检查 MySQL 容器是否正常
docker compose ps mysql
docker compose logs mysql

# 确认 MySQL 的环境变量一致
# .env 中的 MYSQL_USER 和 MYSQL_PASSWORD 必须和 backend 使用的一致
```

### Q2: Jitsi 页面打不开

```bash
# 检查 Jitsi Web 日志
docker compose logs jitsi-web

# 确认端口映射
docker port ea-video-jitsi-web
# 应显示 443/tcp -> 0.0.0.0:58103

# 浏览器访问时，因为是自签名证书，需要点击「高级 → 继续前往」
```

### Q3: 视频连不上（TURN/STUN 问题）

```bash
# 1. 检查 coturn 是否运行
docker compose logs coturn

# 2. 确认 coturn 端口可达
nc -zvu 你的服务器IP 58105

# 3. 确认 JVB_ADVERTISE_IPS 设置为服务器公网 IP（不是内网 IP）
grep JVB_ADVERTISE_IPS .env

# 4. 确认 TURN_HOST 设置为服务器公网 IP
grep TURN_HOST .env

# 5. 检查防火墙
sudo ufw status | grep 58104
sudo ufw status | grep 58105
```

### Q4: 前端代理报错 502/连接失败

```bash
# 确认 backend 在服务器上正常运行
curl http://你的服务器IP:58102/api/v1/config

# 如果连不上，检查防火墙和安全组是否放通了 58102/tcp
# 确认 vite.config.js 中的 target 地址正确
```

### Q5: 会议结束后直接链接用户没被踢出

```bash
# 1. 检查 Prosody 自定义模块是否加载
docker logs ea-video-prosody 2>&1 | grep "mod_end_meeting"
# 应看到: mod_end_meeting loaded on host: muc.meet.jitsi

# 2. 检查健康检查
docker exec ea-video-backend wget --header="Host: muc.meet.jitsi" -qO- http://xmpp.meet.jitsi:5280/end-meeting/health

# 3. 检查 Prosody 日志中的销毁记录
docker logs ea-video-prosody 2>&1 | grep -i "destroy\|blacklist\|end_meeting" | tail -20

# 4. 如果模块未加载，确认 docker-compose.yml 中有：
#    XMPP_MUC_MODULES=end_meeting
#    以及 prosody/custom-plugins 目录已挂载

# 5. 重启 Prosody（需要同时重启 jicofo 和 jvb）
docker compose restart prosody jicofo jvb
```

### Q6: 需要完全重新开始

```bash
cd /opt/ea-video

# 停止并删除所有容器和数据卷
docker compose down -v

# 删除 Jitsi 配置缓存
rm -rf jitsi-cfg

# 重新启动
docker compose up -d
```

---

## 第八部分：Jitsi 自定义配置说明

系统通过三个文件自定义 Jitsi Meet 的行为和界面，均以只读方式挂载到容器内：

### 8.1 `jitsi/custom-config.js`

覆盖 Jitsi 的 `config.js` 配置：

- **E2EE（端到端加密）**：启用加密选项，带自定义中文标签
- **预加入页禁用**：用户通过 JWT 链接直接进入会议，不显示预加入页
- **P2P 模式**：1 对 1 问诊时使用点对点连接，降低延迟
- **禁用欢迎页**：访问 Jitsi 根路径不显示"开始会议"按钮，防止未授权创会
- **禁用深度链接**：始终在浏览器内打开，不弹出 App 下载提示

### 8.2 `jitsi/custom-interface_config.js`

覆盖 Jitsi 的界面配置：

- 移除 Jitsi 水印
- 自定义品牌名称为 `EA-Video Consultation`
- 自定义背景色 `#1a1a2e`
- 保留所有默认工具栏按钮

### 8.3 `jitsi/custom-body.html`

注入到 Jitsi Meet 页面的自定义 HTML：

- 仅在根路径 `/` 显示，不影响会议房间页面
- 显示中文提示："您目前暂无获许访问的会议室，请使用 EyeAgent 授权的系统链接"
- 未持有有效 JWT 的用户访问 Jitsi 域名时看到此页面

### 8.4 `prosody/custom-plugins/mod_end_meeting.lua`

Prosody 自定义模块，通过 `XMPP_MUC_MODULES=end_meeting` 环境变量加载到 MUC 组件：

- 提供 HTTP API `/end-meeting/destroy?<roomName>` 供 Backend 调用销毁房间
- 提供 HTTP API `/end-meeting/health` 供健康检查
- 维护已销毁房间的内存黑名单（24 小时自动过期）
- 黑名单房间被重新创建时，延迟 2 秒后自动销毁，让 Jitsi 客户端收到正式的"会议已结束"通知

---

## 第九部分：服务管理命令速查

```bash
# 启动所有服务
docker compose up -d

# 停止所有服务
docker compose down

# 重启某个服务
docker compose restart backend
docker compose restart jitsi-web

# 重启 Prosody（修改 Lua 模块后，需同时重启 jicofo 和 jvb）
docker compose restart prosody jicofo jvb

# 查看实时日志
docker compose logs -f

# 重新构建 backend（代码修改后，需要 --build 重新打包镜像）
docker compose up -d --build backend

# 重新创建 jitsi-web（修改 custom-config.js / custom-body.html 后）
docker compose up -d --force-recreate jitsi-web

# 查看容器资源使用
docker stats

# 进入某个容器调试
docker exec -it ea-video-backend sh
docker exec -it ea-video-mysql bash
```

---

## 端口速查表


| 端口          | 协议      | 服务                      | 必须放通       |
| ----------- | ------- | ----------------------- | ---------- |
| 58101       | TCP     | Frontend Web UI         | 服务器部署前端时需要 |
| 58102       | TCP     | Backend API + WebSocket | **必须**     |
| 58103       | TCP     | Jitsi Web HTTPS         | **必须**     |
| 58104       | UDP     | JVB 视频媒体流               | **必须**     |
| 58105       | UDP+TCP | coturn STUN/TURN        | **必须**     |
| 58106       | TCP     | coturn TURNS (TLS)      | **必须**     |
| 58107       | TCP     | MySQL                   | 可选（远程调试用）  |
| 58110-58200 | UDP+TCP | coturn 中继端口池            | **必须**     |

