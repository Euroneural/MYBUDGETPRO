#!/bin/bash

# App Manager for BudgetPro
# Usage: ./app-manager.sh [start|stop|restart|status]

APP_NAME="BudgetPro"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$APP_DIR/app.pid"
LOG_FILE="$APP_DIR/app.log"
PORT=8003

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if the app is running
is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            # Remove stale PID file
            rm -f "$PID_FILE"
        fi
    fi
    return 1
}

# Function to start the app
start_app() {
    if is_running; then
        echo -e "${YELLOW}$APP_NAME is already running (PID: $(cat "$PID_FILE"))${NC}"
        return 1
    fi
    
    echo -e "${GREEN}Starting $APP_NAME on port $PORT...${NC}"
    cd "$APP_DIR"
    nohup npx vite --port $PORT > "$LOG_FILE" 2>&1 & 
    echo $! > "$PID_FILE"
    
    # Wait for the app to start
    sleep 2
    
    if is_running; then
        echo -e "${GREEN}$APP_NAME started successfully (PID: $(cat "$PID_FILE"))${NC}"
        echo -e "${GREEN}Access the app at: http://localhost:$PORT${NC}"
    else
        echo -e "${RED}Failed to start $APP_NAME. Check $LOG_FILE for details.${NC}"
        return 1
    fi
}

# Function to stop the app
stop_app() {
    if ! is_running; then
        echo -e "${YELLOW}$APP_NAME is not running.${NC}"
        return 0
    fi
    
    local pid=$(cat "$PID_FILE")
    echo -e "${YELLOW}Stopping $APP_NAME (PID: $pid)...${NC}"
    
    # Try to kill the process gracefully first
    kill -TERM "$pid"
    
    # Wait for the process to exit
    local count=0
    while is_running; do
        count=$((count + 1))
        if [ $count -ge 10 ]; then
            echo -e "${RED}Force stopping $APP_NAME...${NC}"
            kill -9 "$pid"
            break
        fi
        sleep 1
    done
    
    rm -f "$PID_FILE"
    echo -e "${GREEN}$APP_NAME stopped.${NC}"
}

# Function to get app status
status_app() {
    if is_running; then
        local pid=$(cat "$PID_FILE")
        echo -e "${GREEN}$APP_NAME is running (PID: $pid)${NC}"
        echo -e "Access the app at: http://localhost:$PORT"
        echo -e "Log file: $LOG_FILE"
        return 0
    else
        echo -e "${YELLOW}$APP_NAME is not running.${NC}"
        return 1
    fi
}

# Main script logic
case "$1" in
    start)
        start_app
        ;;
    stop)
        stop_app
        ;;
    restart)
        stop_app
        start_app
        ;;
    status)
        status_app
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac

exit 0
