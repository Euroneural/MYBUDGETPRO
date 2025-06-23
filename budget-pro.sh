#!/bin/bash

# Configuration
PORT=8000
APP_NAME="budget-pro"
LOG_FILE="app.log"
PID_FILE="app.pid"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is in use
is_port_in_use() {
    lsof -i ":$1" >/dev/null 2>&1
}

# Function to get the process ID using the port
get_pid_by_port() {
    lsof -ti ":$1" 2>/dev/null || echo ""
}

# Function to start the server
start_server() {
    echo -e "${YELLOW}Starting $APP_NAME...${NC}"
    
    # Check if port is already in use
    if is_port_in_use "$PORT"; then
        echo -e "${RED}Port $PORT is already in use.${NC}"
        echo -e "${YELLOW}Attempting to find and stop the conflicting process...${NC}"
        stop_server
    fi
    
    # Check if Python 3 is available
    if command_exists python3; then
        SERVER_CMD="python3 -m http.server $PORT"
    elif command_exists python; then
        # Check if Python 3 is the default python
        if python -c 'import sys; exit(0) if sys.version_info[0] == 3 else exit(1)'; then
            SERVER_CMD="python -m http.server $PORT"
        else
            echo -e "${RED}Python 3 is required but not found.${NC}"
            exit 1
        fi
    else
        echo -e "${RED}Python is not installed. Please install Python 3.${NC}"
        exit 1
    fi
    
    # Start the server in the background and log output
    $SERVER_CMD > "$LOG_FILE" 2>&1 &
    SERVER_PID=$!
    
    # Save the PID to a file
    echo $SERVER_PID > "$PID_FILE"
    
    # Give the server a moment to start
    sleep 2
    
    # Verify the server is running
    if ps -p $SERVER_PID > /dev/null; then
        echo -e "${GREEN}$APP_NAME started successfully on port $PORT${NC}"
        echo -e "${YELLOW}Open http://localhost:$PORT in your browser${NC}"
        echo -e "${YELLOW}Logs are being written to $LOG_FILE${NC}"
        
        # Try to open the browser
        if command_exists xdg-open; then
            xdg-open "http://localhost:$PORT" &
        elif command_exists open; then
            open "http://localhost:$PORT" &
        fi
    else
        echo -e "${RED}Failed to start $APP_NAME${NC}"
        echo -e "${YELLOW}Check $LOG_FILE for details${NC}"
        exit 1
    fi
}

# Function to stop the server
stop_server() {
    echo -e "${YELLOW}Stopping $APP_NAME...${NC}"
    
    # Try to get PID from file first
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null; then
            kill -9 $PID 2>/dev/null
            echo -e "${GREEN}Stopped process $PID${NC}"
        fi
        rm -f "$PID_FILE"
    fi
    
    # Also try to kill any process using the port
    PORT_PID=$(get_pid_by_port "$PORT")
    if [ ! -z "$PORT_PID" ]; then
        echo -e "${YELLOW}Found additional process(es) using port $PORT: $PORT_PID${NC}"
        kill -9 $PORT_PID 2>/dev/null
        echo -e "${GREEN}Stopped process(es) on port $PORT${NC}"
    fi
    
    # Clean up any remaining PID file
    rm -f "$PID_FILE"
    
    echo -e "${GREEN}$APP_NAME has been stopped${NC}"
}

# Function to restart the server
restart_server() {
    echo -e "${YELLOW}Restarting $APP_NAME...${NC}"
    stop_server
    start_server
}

# Function to check server status
status_server() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE" 2>/dev/null)
        if ps -p $PID > /dev/null; then
            echo -e "${GREEN}$APP_NAME is running (PID: $PID)${NC}"
            echo -e "${YELLOW}Access at: http://localhost:$PORT${NC}"
            return 0
        else
            echo -e "${YELLOW}PID file exists but process is not running${NC}"
            rm -f "$PID_FILE"
            return 1
        fi
    else
        PORT_PID=$(get_pid_by_port "$PORT")
        if [ ! -z "$PORT_PID" ]; then
            echo -e "${YELLOW}Found process(es) using port $PORT (PIDs: $PORT_PID) but no PID file${NC}"
            return 2
        else
            echo -e "${YELLOW}$APP_NAME is not running${NC}"
            return 3
        fi
    fi
}

# Function to show logs
tail_logs() {
    if [ -f "$LOG_FILE" ]; then
        echo -e "${YELLOW}=== Tailing logs (Ctrl+C to stop) ===${NC}"
        tail -f "$LOG_FILE"
    else
        echo -e "${YELLOW}No log file found at $LOG_FILE${NC}"
    fi
}

# Main script
case "$1" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        status_server
        ;;
    logs)
        tail_logs
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo "  start   - Start the server"
        echo "  stop    - Stop the server"
        echo "  restart - Restart the server"
        echo "  status  - Show server status"
        echo "  logs    - Tail the server logs"
        exit 1
        ;;
esac

exit 0
