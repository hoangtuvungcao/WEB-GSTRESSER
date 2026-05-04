# G-STRESSER

A comprehensive network stress testing platform with CNC (Command & Control) management system.

## Features

- **API Server**: Node.js-based REST API for managing stress tests
- **CNC Terminal**: Go-based command & control interface via Telnet
- **Web Dashboard**: Browser-based management interface
- **Mobile App**: Flutter cross-platform mobile application
- **User Management**: JWT-based authentication with role-based access
- **Attack Methods**: Multiple DDoS/stress testing methods supported
- **Real-time Monitoring**: Live attack status and server monitoring
- **Plan System**: Tiered subscription plans with different capabilities

## Architecture

```
G-STRESSER/
├── cnc/              # Go-based CNC/C2 server
├── database/         # JSON-based configuration storage
├── mobile_app/       # Flutter mobile application
├── public/           # Web dashboard assets
├── src/              # Node.js API & Web server
│   ├── managers/     # Business logic managers
│   ├── middleware/   # Express middleware
│   ├── routes/       # API routes
│   └── workers/      # Background workers
└── _legacy/          # Legacy components
```

## Prerequisites

- Node.js v18.x or higher
- Go 1.22 or higher
- npm 9.x or higher
- PM2 (for process management)
- Linux VPS (Ubuntu recommended)

## Quick Start

### 1. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git build-essential screen unzip tmux libpcap-dev telnet

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Go
wget https://go.dev/dl/go1.22.1.linux-amd64.tar.gz
sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf go1.22.1.linux-amd64.tar.gz
echo "export PATH=\$PATH:/usr/local/go/bin" >> ~/.profile
source ~/.profile

# Install PM2
sudo npm install -g pm2
```

### 2. Install Project Dependencies

```bash
npm install
```

### 3. Configure Database

Edit `database/settings.json`:
```json
{
  "cncHost": "YOUR_VPS_IP",
  "cncPort": "1337"
}
```

### 4. Build CNC Server

```bash
cd cnc
go build -o cnc .
chmod +x cnc
```

### 5. Start Services

**Start CNC Server:**
```bash
cd cnc
screen -S cnc
./cnc > cnc.log 2>&1
# Press Ctrl+A, then D to detach
```

**Start Web/API Server:**
```bash
pm2 start src/server.js --name "g-stresser-web"
pm2 save
pm2 startup
```

### 6. Configure Firewall

```bash
sudo ufw allow 8880/tcp
sudo ufw allow 1337/tcp
sudo ufw reload
```

## Access Points

- **Web Dashboard**: `http://YOUR_VPS_IP:8880`
- **CNC Terminal**: `telnet YOUR_VPS_IP 1337`
- **API Endpoint**: `http://YOUR_VPS_IP:8880/api`

## Mobile App

The Flutter mobile app is located in `mobile_app/` directory.

### Build Mobile App

```bash
cd mobile_app
flutter pub get
flutter build apk --release
```

## Configuration Files

| File | Purpose |
|------|---------|
| `database/settings.json` | CNC & API configuration |
| `database/users.json` | User accounts |
| `database/plans.json` | Subscription plans |
| `database/methods.json` | Attack methods configuration |
| `src/config.js` | Server configuration |

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/verify` - Token verification

### Attack Management
- `POST /api/attack/start` - Start stress test
- `POST /api/attack/stop` - Stop stress test
- `GET /api/attack/status` - Get attack status
- `GET /api/attack/history` - Attack history

### User Management
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update profile
- `GET /api/user/plan` - Get subscription details

### Admin
- `GET /api/admin/users` - List all users
- `GET /api/admin/servers` - List all servers
- `GET /api/admin/logs` - System logs

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm start` | Start production server |
| `npm run legacy` | Run legacy API |

## Security Notice

This tool is designed for **authorized stress testing only**. Misuse of this software for unauthorized network attacks is illegal and punishable by law. Always ensure you have explicit permission before testing any network or system.

## License

ISC License - See package.json for details.

## Author

Project maintained by the G-STRESSER development team.

## Disclaimer

**WARNING**: This software is provided for educational and authorized testing purposes only. The authors assume no liability and are not responsible for any misuse or damage caused by this program. Use at your own risk and responsibility.
